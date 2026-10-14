---
title: Agent State Machine Protocol
version: 0.2
status: active
last_updated: 2026-09-23
depends_on:
  - 00-architecture
  - 01-hint-system
  - 02-math-toolbox
  - 03-response-blocks
  - 04-user-attempt
  - 05-context-engine
  - 06-learner-model
related:
  - 08-provider-adapter
  - 09-evaluation
  - 10-experience-orchestration
---

# Math Agent 子规范 07
# Agent State Machine Protocol v0.2

## 0. 文档目标

本规范定义 Math Agent 如何真正运行：已有的 Hint、Tool、Response Block、UserAttempt、Context Engine 和 Learner Model 按什么顺序协作，何时调用工具、何时重新规划、何时暂停等待用户，以及怎样安全更新状态。

```text
用户操作
→ Agent 状态
→ Context
→ Intent
→ Learning Mode
→ Teaching Plan
→ Tool / Replan
→ Response Blocks
→ State Update
→ Wait / Resume
```

## 1. 为什么必须有显式 State Machine

“超级 Prompt → LLM → Tool Calling → 回答”无法可靠控制提示泄露、工具预算、学习连续性、草稿版本、Learning Mode、checkpoint 和多 Provider 一致性。

正确架构需要：

```text
Explicit State
+ Explicit Transition
+ Explicit Policies
```

> **LLM participates in the state machine; it does not own the state machine.**

模型可分类、规划、建议工具和解释数学；正式状态转换由 Orchestrator 验证并执行。

## 2. 总体运行图

```text
                     USER EVENT
                         │
                         ↓
                 RECEIVE_REQUEST
                         ↓
                 RESOLVE_TARGET
                         ↓
                  BUILD_CONTEXT
                         ↓
                 INTERPRET_INTENT
                         ↓
                SELECT_LEARNING_MODE
                         ↓
               ASSESS_LEARNER_STATE
                         ↓
                  PLAN_TEACHING
                         │
          ┌──────────────┴──────────────┐
          ↓                             ↓
      EXECUTE_TOOLS                 NO TOOL
          ↓                             │
    EVALUATE_RESULTS                    │
          └──────────────┬──────────────┘
                         ↓
                COMPOSE_RESPONSE
                         ↓
                  RESPONSE_GUARD
                         ↓
                   EMIT_BLOCKS
                         ↓
                  UPDATE_STATE
                         ↓
               WAIT_FOR_LEARNER
```

## 3. 顶层 Agent 状态

```ts
type AgentStateName =
  | "idle"
  | "receiving"
  | "resolving_context"
  | "interpreting"
  | "assessing"
  | "planning"
  | "executing_tools"
  | "evaluating_tools"
  | "composing"
  | "guarding"
  | "streaming"
  | "waiting_for_user"
  | "paused"
  | "recovering"
  | "completed"
  | "failed";
```

内部状态与用户 UI copy 分离。用户可看到“正在检查这一步”，不需要看到 `EVALUATING_TOOLS`。

## 4. AgentRun 与 AgentSession

一次执行是 Run；持续学习过程是 Session。

```ts
interface AgentRun {
  runId: string;
  sessionId: string;
  userId?: string;
  problemId?: string;
  state: AgentStateName;
  request: AgentRequest;
  context?: AgentContext;
  intent?: ResolvedIntent;
  mode?: EffectiveLearningMode;
  learnerAssessment?: LearnerAssessment;
  teachingPlan?: TeachingPlan;
  toolState?: ToolExecutionState;
  responseDraft?: AgentResponse;
  statePatch?: AgentStatePatch;
  checkpointId?: string;
  startedAt: string;
  updatedAt: string;
  status: "running" | "waiting" | "completed" | "failed" | "cancelled";
}

interface AgentSession {
  sessionId: string;
  userId?: string;
  problemId?: string;
  activeMode: LearningMode;
  persistencePolicy?: LearningPersistencePolicy;
  hintState?: HintState;
  currentAttemptId?: string;
  currentMethod?: string;
  currentGoal?: string;
  currentBlocker?: BlockerType;
  currentFrontier?: AttemptFrontier;
  revealedInformation?: RevealState;
  attemptedMethods?: string[];
  sessionSummary?: SessionSummary;
  createdAt: string;
  updatedAt: string;
}
```

Session 保存多轮学习连续性；Run 保存一次执行轨迹。切换 Provider 不得丢失 Session State。

面向用户的 `LearningEpisodeView`（子规范 10）由 Session、Run、Hint State 与最新 Attempt 派生。它可关联同一目标的多轮交互，但不拥有另一份正式的 Hint、Mastery 或 Attempt 状态。

## 5. Event-Driven State Machine

```ts
type AgentEvent =
  | UserMessageEvent
  | UIActionEvent
  | SelectionEvent
  | AttemptChangedEvent
  | ToolCompletedEvent
  | ToolFailedEvent
  | QuestionAnsweredEvent
  | VisualizationInteractionEvent
  | ResumeEvent
  | CancelEvent;

interface UserMessageEvent {
  type: "user_message";
  message: string;
  sessionId: string;
  contextPointer?: ContextTarget;
}

interface UIActionEvent {
  type: "ui_action";
  action:
    | "request_hint"
    | "request_next_step"
    | "diagnose_attempt"
    | "explain_motivation"
    | "switch_strategy"
    | "visualize"
    | "show_solution"
    | "start_feynman"
    | "start_recall"
    | "correct_focus";
  target?: ContextTarget;
  payload?: Record<string, unknown>;
}
```

UI 已知 action 与 target 时必须结构化传递，不能退化成一句普通文字再让 LLM 猜测。

```ts
interface StateTransition {
  from: AgentStateName;
  to: AgentStateName;
  event?: AgentEvent;
  reason: string;
  timestamp: string;
}
```

开发环境保存 Transition Trace。

## 6. Receive、Target 与 Context

`RECEIVE_REQUEST` 创建 runId、验证 session、检查取消状态并建立最小 RequestContext，不进行数学推理。

`RESOLVE_TARGET` 调用 Context Engine 定位 Problem、SolutionStep、AttemptStep、Strategy Node 或 Visualization Object。只有真正歧义时才澄清。

`BUILD_CONTEXT` 默认先构造 local context。Planner 或 Tool 返回信息不足时，有限次调用 `expandContext()`。

## 7. Intent Resolution

优先级：

```text
Explicit UI Action
> Explicit Natural Language Command
> Contextual Intent Classification
```

```ts
interface InteractionConstraints {
  target?: ContextTarget;
  requestedHelp?: "check_only" | "minimal_hint" | "next_step" | "explain" | "full_solution";
  forbidFutureSteps?: boolean;
  responseDetail?: "minimal" | "concise" | "normal" | "detailed";
  modeOverride?: { mode: LearningMode; scope: ModeScope };
  persistenceOverride?: Partial<LearningPersistencePolicy>;
}

interface ResolvedIntent {
  primary:
    | "ask"
    | "hint"
    | "next_step"
    | "diagnose"
    | "verify"
    | "explain"
    | "explain_motivation"
    | "visualize"
    | "compare"
    | "switch_strategy"
    | "solve"
    | "practice"
    | "teach_back"
    | "recall";
  secondary?: string[];
  confidence: number;
  explicit: boolean;
  interactionConstraints?: InteractionConstraints;
}
```

多 Intent 存在依赖时按顺序执行。例如“先检查，对的话告诉下一步”必须先 verify，成功后才允许 next_step。

`InteractionConstraints` 记录本轮明确的 target、帮助边界、禁止后续步骤、回答详略、模式与长期记录覆盖。它与现有 `primary` 一起进入 TeachingPlan 和 Response Guard；体验呈现规则见子规范 10。例如“只检查这一步”不能被归一成允许解释后续完整解法的泛化 `verify`。

## 8. Learning Mode 与 Learner Assessment

```ts
interface EffectiveLearningMode {
  mode: "auto" | "tutor" | "feynman" | "recall" | "direct";
  persistence: LearningPersistencePolicy;
  scope: ModeScope;
  source: "explicit" | "session" | "auto";
  confidence?: number;
}

interface LearnerAssessment {
  relevantMastery?: ConceptLearningState[];
  currentBlocker?: BlockerType;
  currentFrontier?: AttemptFrontier;
  hintDependence?: number;
  misconceptionCandidates?: string[];
  pedagogicalIntensity: "minimal" | "normal" | "guided" | "deep";
  confidence: number;
}
```

教学模式和 Learning Persistence Policy 分离。Assessment 只提取当前任务相关状态，不在此直接更新完整 Learner Model；当前 Attempt、Message 和近期 Hint 反应优先于长期估计。

## 9. TeachingPlan

`PLAN_TEACHING` 是教学决策中心。

```ts
interface TeachingPlan {
  intent: ResolvedIntent;
  objective: string;
  helpLevel?: HelpLevel;
  pedagogicalStrategy: PedagogicalStrategy;
  reasoningLevel: ReasoningLevel;
  contextScope: "local" | "problem" | "global";
  toolPlan: PlannedToolCall[];
  presentationPlan: PresentationPlan;
  expectedUserAction?: string;
  stateEffects?: PlannedStateEffect[];
  stopCondition: StopCondition;
}

type PedagogicalStrategy =
  | "direct_answer"
  | "minimum_hint"
  | "guided_step"
  | "socratic_question"
  | "error_diagnosis"
  | "route_diagnosis"
  | "motivation_explanation"
  | "feynman_probe"
  | "retrieval_prompt"
  | "visual_exploration"
  | "solution_explanation"
  | "practice_recommendation";
```

Planner 决定做什么；Presentation Planner 决定怎样呈现。Planner 不直接输出最终回答。

Planner 必须保留显式交互约束；`requestedHelp = full_solution` 与默认 Tutor 状态冲突时，按宪法中的用户揭示控制处理。教学策略可建议用户先尝试，但不能形成拒绝更多帮助的强制循环。

## 10. StopCondition 与 One Cognitive Step

```ts
type StopCondition =
  | { type: "wait_for_user" }
  | { type: "after_tool"; toolId: string }
  | { type: "after_response" }
  | { type: "goal_reached"; description: string };
```

Tutor/Feynman/Recall 中，一个 Agent Turn 默认只推进一个主要认知步骤。给 Hint 或问一个关键问题后通常 `wait_for_user`，不能自己继续回答并一路输出完整解答。Direct Mode 可直接完成结论。

> **The state machine should stop as intelligently as it starts.**

## 11. Tool Plan、Policy 与 Budget

```ts
interface PlannedToolCall {
  toolId: string;
  purpose: string;
  priority: number;
  required: boolean;
  dependencies?: string[];
  inputSource: string[];
  allowParallel?: boolean;
}

interface ToolBudget {
  maxCalls: number;
  maxSequentialRounds: number;
  maxHeavyCalls: number;
  maxLLMToolCalls: number;
  maxVisualizationCalls: number;
}

interface RuntimeToolPolicy {
  allowedTools: string[];
  forbiddenTools: string[];
  budget: ToolBudget;
  revealBudget?: RevealBudget;
  modeRestrictions?: string[];
}
```

普通任务可默认 `maxCalls = 3`、`maxSequentialRounds = 2`；复杂证明诊断可配置更高预算。每轮模型只看到 Planner 允许的 Tool 子集。Hint Level 未到 solution 时，Runtime 拒绝 full-solution 工具与完整后续推导，即使模型请求。

## 12. Tool Execution 与 Result

```text
Tool Request
→ Schema Validation
→ Permission Check
→ Budget Check
→ Execution
→ Structured ToolResult
```

```ts
interface ToolResult<T = unknown> {
  toolCallId: string;
  toolId: string;
  status: "success" | "failure" | "partial" | "needs_more_context";
  data?: T;
  error?: ToolError;
  confidence?: number;
  latencyMs?: number;
}
```

`needs_more_context` 可触发 Context Expansion 后重试，但 `contextExpansionCount` 有上限。只有无依赖的工具可并行；parse → verify 之类链路必须顺序执行。

## 13. Tool Result Evaluation 与 Authority

工具输出不能直接展示。状态机先判断成功、充分性、冲突、是否需扩展 Context 和是否需重新规划。

数学证据大致优先级：

```text
Verified deterministic result
> Formally checked condition
> High-confidence structured reasoning
> Free-form LLM claim
```

并非所有证明都能确定性验证；无法裁决时保留 uncertainty。Replanning 仅在工具失败、假设被推翻、路线无效、识别不确定或发现新前置条件时触发，且受 sequential-round budget 限制。

## 14. Fast Path 与 Deep Path

意图明确、目标明确、复杂度低、没有 active tutoring state 和歧义时，可走 Fast Path：最小 Context → 必要工具 → Compose → Emit。

草稿路线诊断、证明 first gap 等任务走 Deep Path：Context → Attempt Parsing → Route Diagnosis → Learner Assessment → Teaching Plan → Tools → Guarded Response。

Fast Path 是同一 State Machine 的受控捷径，不是绕过安全策略。

## 15. Tutor Mode 子状态

```ts
type TutorSubstate =
  | "observe_attempt"
  | "locate_blocker"
  | "select_hint"
  | "deliver_hint"
  | "wait_for_attempt"
  | "evaluate_attempt"
  | "advance"
  | "complete";
```

```text
OBSERVE → LOCATE BLOCKER → SELECT MINIMUM HINT → DELIVER
→ WAIT → USER ATTEMPT → EVALUATE
  ├─ progress → ADVANCE
  └─ still stuck → stronger hint
```

Hint 不机械每轮 `level + 1`，而是依据用户尝试、Attempt 合理性和 blocker 是否改变。连续点击提示达到关键动作后，可暂停并请用户先尝试。

## 16. Feynman、Recall 与 Direct 子状态

```ts
type FeynmanSubstate =
  | "select_concept"
  | "prompt_explanation"
  | "listen"
  | "extract_claims"
  | "identify_gap"
  | "ask_probe"
  | "listen_revision"
  | "test_transfer"
  | "summarize"
  | "complete";

type RecallSubstate =
  | "select_target"
  | "prompt_free_recall"
  | "evaluate_recall"
  | "cue"
  | "retry"
  | "reveal"
  | "record_evidence"
  | "complete";
```

Feynman：让用户解释 → 提取 claims → 找最高价值 gap → 问一个问题 → 修正 → 必要时 transfer → 停止。解释正确且无重要 gap 时不为“模式完整”继续追问。

Recall：Free Recall → Evaluate → Cue → Retry → Evidence / Reveal。Direct：Understand → Solve/Verify → Answer → Stop，不强制教学循环。

Practice 可由 Intent 触发，但不是独立 Learning Mode。

## 17. WAIT_FOR_USER、Checkpoint 与 Resume

等待用户是正式 suspended state。

```ts
interface WaitingState {
  expectedInput?: "attempt" | "answer" | "explanation" | "choice" | "confirmation" | "free_text";
  expectedTarget?: string;
  resumeNode: string;
  checkpointId: string;
  expiresAt?: string;
}
```

进入等待前保存 Session、Hint State、Context pointers、Teaching Plan 和 Expected User Action。Checkpoint 保存 Domain State，不保存某 Provider 的不可移植隐藏对象。

Resume 时加载 checkpoint 和最新 Attempt、使 stale context 失效、重建 Context，再从预期节点继续。若用户的新意图偏离预期，重新做 Intent Resolution，新意图覆盖旧 expected input。

## 18. Interrupt、Cancel 与并发

用户换题、选择其他步骤、切换 Mode、要求直接答案或上传新草稿时允许 `interrupt → save → replan`。用户可取消长工具、复杂可视化和深度 reasoning；Run 标记 cancelled，Session 保留。

取消不能回滚已经实际展示的提示或解答。焦点纠正通过 `SelectionEvent` 或明确 `UIActionEvent` 携带新 target；Attempt 修正通过 `AttemptChangedEvent` 携带新版本。二者均使旧 Context snapshot 失效。重试与恢复使用 idempotency key，避免重复提示事件和 Learner Evidence。

同一 Session 中会修改状态的 Run 默认序列化；只读操作可酌情并行。前端可 optimistic 展示消息和 loading block，但 Hint Level 等状态只能在 Orchestrator 确认后更新。

## 19. Idempotency 与 Planned State Effect

重试不能重复更新 Mastery、插入 Hint Event 或创建 Practice Record。重要事件必须携带 idempotency key。

```ts
interface PlannedStateEffect {
  type:
    | "update_hint_state"
    | "set_current_method"
    | "set_blocker"
    | "record_learning_event"
    | "update_frontier"
    | "set_mode"
    | "set_goal";
  payload: unknown;
  commit: "before_response" | "after_response" | "after_user_view";
}
```

生成 Hint 不等于用户看过 Hint；revealed information 应在 `after_user_view` 提交。Teach-back success 只能在响应与评估完成后形成 Learning Event。

## 20. Response Composition

`COMPOSE_RESPONSE` 使用 TeachingPlan、ToolResults、AgentContext、Learning Mode 和 Preference，输出符合子规范 03 的 `AgentResponse`。

体验层把已守护的 `AgentResponse` 与派生的 `LearningEpisodeView` 组合为 `InteractionEnvelope`，确定一个主操作、必要的次要操作和下一步责任方；Envelope 不拥有 Domain State，也不绕过 Response Guard。

普通 Tutor Turn 通常只需 1–4 个核心 Blocks，例如 `HintBlock + QuestionBlock`，不应每轮生成完整 Dashboard。

## 21. Response Guard

最终输出前必须检查数学风险、Reveal Policy、Block Schema、Mode Constraints、Tool Grounding 和重复内容。Runtime Guard 与 Prompt Guard 分离。

- **Hint Guard**：Reveal Budget、SolutionBlock、Key Move 和 future-step 数量。
- **Feynman Guard**：是否变成长篇讲课、一次问多个问题或替用户完成 teach-back。
- **Recall Guard**：free recall 阶段是否提前展示答案。
- **Direct Guard**：是否出现不必要的苏格拉底追问。
- **Mathematical Guard**：高风险且可验证的结论是否完成验证。
- **Interaction Guard**：本轮明确的目标与帮助边界是否被遵守；是否错误宣称已验证；可预期失败是否有继续路径。

Guard Failure 优先删除非法 block、降低 reveal 或修复回答；有限次失败后安全退出。

## 22. Streaming

```ts
type AgentStreamEvent =
  | { type: "run_started" }
  | { type: "status"; value: string }
  | { type: "block_started"; blockId: string }
  | { type: "block_delta"; blockId: string; delta: string }
  | { type: "block_completed"; blockId: string }
  | { type: "tool_status"; toolId: string; status: string }
  | { type: "run_completed" }
  | { type: "run_failed"; error: string };
```

支持 Block-level streaming，但在 block 完成并被用户看到前，不提交 reveal。普通用户只能看到过程状态，不暴露原始 Chain of Thought。Strategy Map 是整理后的教学结构，不是隐藏推理 transcript。

用户可见状态使用任务语义，例如“正在检查草稿第 3 步”，并允许取消可停止的长任务。首次反馈、持续进度与超时提示应由真实用户测试设定阈值，不把固定毫秒数写入 Domain State Machine。

## 23. UPDATE_STATE 与审计

Response 完成后，依据 StatePatch、PlannedStateEffect 和 user-visible status 更新 Session、Hint State、Attempt State 和 Learner Event Queue。

LLM 只能建议 evidence 或 patch；Orchestrator 验证 schema、来源与 commit 条件后写入。所有重要 mutation 记录 before、after、reason 和 runId。

## 24. Error Handling

```ts
type AgentRuntimeError =
  | "context_error"
  | "intent_error"
  | "planner_error"
  | "provider_error"
  | "tool_error"
  | "schema_error"
  | "guard_error"
  | "state_conflict"
  | "timeout"
  | "cancelled";
```

区分 recoverable 与 fatal。可视化失败可退回文字；BYOK Provider 错误不得丢失 Session；可选工具超时可跳过，关键验证超时必须明确表示未完成验证，不得伪造。

## 25. Version Guards 与 State Conflict

Tool 输入携带 `attemptVersion` 和 `contextSnapshotId`，提交结果时重新比较。用户已从 Attempt v3 更新到 v4 时，丢弃 v3 的迟到结果，重建 Context，禁止覆盖新状态。

## 26. Reasoning Level

Runtime 使用平台抽象 `fast / standard / deep / max`，由 Provider Adapter 映射。Reasoning Level 是 per-turn，并与 Tool Call 数量和回答长度分离。

Complexity Router 可将 `simple / normal / complex / very_complex` 映射到 Reasoning Level；发生工具冲突或 planning failure 时最多有限次升级，简单 follow-up 可自动降级。

困难 Hint 可以 `reasoning = max` 而响应只有一句话。

## 27. Runtime Independence

LangGraph 或其他 runtime 可承担 graph execution、checkpoint、interrupt、resume、persistence hooks 和 tracing；`AgentSession`、`TeachingPlan`、`HintState`、`LearnerModel`、`ToolPolicy` 和 `ResponseBlocks` 仍属于自研 Domain。

禁止让 UserAttempt 继承某 runtime state，或把唯一正式状态锁在 proprietary checkpoint 中。

推荐单一职责 graph nodes：

```text
receive_request
resolve_context
interpret_intent
select_mode
assess_learner
plan_teaching
select_tools
execute_tools
evaluate_results
compose_response
guard_response
emit_response
update_state
wait_for_user
```

## 28. Human-in-the-Loop 与确认

数学学习本身就是 Human-in-the-Loop：Hint → Wait → Attempt → Resume 是核心产品行为。

低置信度手写识别、显示完整答案、切换完全不同路线时可请求最小确认，但不能滥用。用户已明确要求直接答案时不重复确认。

模式切换保留 Problem Context、Attempt、Learner Model 和已揭示信息，清理不再适用的 expected step。切换题目创建新的 Problem Tutoring State，但保留 Learner Model；旧题 Hint Level 不跨题继承。

## 29. Session Summary 与 Trace

每若干 turn 或暂停时，更新 currentGoal、methodsTried、revealedInformation、diagnosedErrors、unresolvedQuestions 和 frontier。Summary 用于恢复，但不能替代结构化 Hint Level 等正式状态。

开发环境 trace：Event、State、Intent、Mode、Context Scope、Teaching Plan、Tool Calls、Guard 和 State Patch。禁止记录 API Key、完整私密图片和不必要敏感数据。

## 30. Evaluation

分别测试 Intent、Mode、Hint Level、Tool Selection、Stop、Resume 和 State Update，而不只看最终答案。

关键指标：

- **Premature Solution Rate**：Tutor 中未请求答案却提前泄露完整解答。
- **Unnecessary Interaction Rate**：Direct/simple query 被强行追问或安排学习流程。
- **State Continuity**：暂停恢复后 Hint、Frontier 和 Reveal 是否延续。
- **Route Continuity**：是否持续尊重用户非官方但正确的路线。
- **Mode Fidelity**：Feynman 是否让用户解释、Recall 是否延迟答案、Direct 是否简洁。

## 31. 必测场景

1. **Hint**：最小提示 + 可选问题 → wait；禁止自动完整解题。
2. **UserAttempt**：使用最新版本，找 first significant issue，输出 ErrorLocationBlock 后等待。
3. **Feynman**：listen → extract claims → 单一最高价值 probe → wait。
4. **Direct**：明确请求结果时直接简洁回答。
5. **Handwriting uncertainty**：暂停分析，请求最小确认，确认后恢复；禁止把识别不确定当数学错误。
6. **Tool failure**：降级呈现，Session 继续。
7. **Stale Attempt**：丢弃旧结果并重建 Context。
8. **Focus correction**：用户改选后旧结果不落到新步骤，恢复时显示最新焦点。
9. **Help boundary**：只检查当前步骤时不输出后续步骤；明确要答案时不被额外确认卡住。
10. **Cancel/retry**：取消保留 Session 与已揭示信息，重试不重复写入 evidence。

## 32. MVP Runtime

```text
Receive
→ Build Context
→ Resolve Intent
→ Select Mode
→ Plan
→ Optional Tools
→ Compose
→ Guard
→ Update Session
→ Wait
```

MVP 必须支持 Session State、Hint State、UserAttempt version、Tool Budget、Learning Mode、Wait/Resume、Structured Response 和 Basic Checkpoint。

MVP 暂不需要复杂 multi-agent、分布式 Agent 网络、Agent-to-Agent 对话、几十个 specialised agents 或自动长期后台 planning。当前核心问题是 Context、教学策略、状态连续性、工具可靠性和 Reveal 控制。

未来 specialist 应作为 internal nodes/services，而不是多个人格长篇聊天。

## 33. Orchestrator 与 Runtime Services

```ts
interface MathAgentOrchestrator {
  run(
    event: AgentEvent,
    session: AgentSession
  ): AsyncIterable<AgentStreamEvent>;
}

interface AgentRuntimeServices {
  contextEngine: ContextEngine;
  intentResolver: IntentResolver;
  learnerService: LearnerService;
  pedagogyPlanner: PedagogyPlanner;
  toolRegistry: ToolRegistry;
  providerRouter: ProviderRouter;
  presentationPlanner: PresentationPlanner;
  responseGuard: ResponseGuard;
  sessionStore: SessionStore;
  checkpointStore: CheckpointStore;
}
```

`TeachingPlan` 属于 Domain；Graph Node 属于 Runtime。二者不得混淆。

## 34. 完整 Turn 示例

用户从 `(x-y)(x+y)=0` 只推出 `x-y=0`，点击“为什么这里不对？”：

```text
UIActionEvent(diagnose_attempt, attempt_step_3)
→ Resolve target and latest attempt
→ Build local context with assumptions
→ Intent = diagnose
→ Mode = tutor
→ Assess blocker = missing_case
→ Plan objective = 让用户发现另一分支
→ verify_step
→ Result = incomplete
→ ErrorLocationBlock + QuestionBlock
→ Guard: 不直接写出另一分支
→ Update issue without solution reveal
→ WAIT
```

这个 Turn 体现目标解析、最新版本、工具验证、Minimum Useful Help、Guard 和等待用户的完整闭环。

## 35. 核心原则

1. **The state machine should stop as intelligently as it starts.**
2. **State belongs to the application, not to the model.**
3. **Every important teaching action should be resumable.**
4. **Tool use is constrained execution, not model autonomy.**
5. **A learning Agent is inherently human-in-the-loop.**

## 36. 最终架构

```text
                       USER
                         │
                         ↓
                    Agent Event
                         ↓
                 Context Resolution
                         ↓
                  Intent Resolution
                         ↓
                  Learning Mode
                         ↓
                 Learner Assessment
                         ↓
                  Pedagogy Planner
                         │
             ┌───────────┴───────────┐
             ↓                       ↓
        Tool Execution          No Tool Needed
             │                       │
             └───────────┬───────────┘
                         ↓
                  Tool Evaluation
                         ↓
               Presentation Planner
                         ↓
                  Response Guard
                         ↓
              Structured UI Blocks
                         ↓
                 State / Evidence
                         ↓
                  WAIT FOR USER
                         ↓
                       USER
```

> **Math Agent State Machine 要把数学学习变成一个可持续、可暂停、可恢复、可验证、可控制帮助程度的交互循环。**
