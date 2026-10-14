---
title: Context Engine Protocol
version: 0.2
status: active
last_updated: 2026-09-23
depends_on:
  - 00-architecture
  - 01-hint-system
  - 03-response-blocks
  - 04-user-attempt
related:
  - 02-math-toolbox
  - 06-learner-model
  - 07-agent-state-machine
  - 10-experience-orchestration
---

# Math Agent 子规范 05
# Context Engine Protocol v0.2

## 0. 文档目标

Context Engine 负责回答一个基础但极其重要的问题：

> **Agent 在这一轮究竟应该知道什么？**

用户输入一句“为什么？”本身几乎没有意义。只有结合用户正在看的题目、当前答案解析、选中的步骤、已经获得的提示、自己的草稿、当前方法和相关学习偏好，才能理解这个问题真正指什么。

```text
User Message ≠ Agent Context

Agent Input
= User Message
+ Relevant Math Context
+ Relevant Learning State
```

Context Engine 的目标不是把更多内容塞进 Prompt，而是在每个教学瞬间，让 Agent 恰好知道真正需要知道的东西。

## 1. 职责与边界

Context Engine 负责：

```text
获取上下文
→ 标准化
→ 解析 Intent 和 Target
→ 判断相关性
→ 选择必要部分
→ 管理预算并压缩
→ 验证完整性与安全边界
→ 构造 AgentContext
```

它不负责解决数学问题、生成提示、判断证明是否正确或决定 UI 表达。这些分别属于 Math Toolbox、Hint System、Pedagogy Planner 和 Presentation Planner。

Context Engine 决定“有哪些信息”；Prompt Builder 决定“怎样向具体模型表达”。Context Domain Object 不依赖任何 Provider。

## 2. 总体架构

```text
                       Context Engine
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   Page Context         Learning Context      Conversation
        │                    │                    │
 Problem/Solution        Hint State           Messages
 Selection               User Attempt         Previous Blocks
 Current UI              Learner Profile      Current Reference
        │                    │                    │
        └────────────────────┼────────────────────┘
                             ↓
                      Context Resolver
                             ↓
                      Context Selector
                             ↓
                       Context Budget
                             ↓
                     Context Compressor
                             ↓
                    Integrity / Leakage Check
                             ↓
                        AgentContext
```

## 3. 核心原则：Relevant Context Only

禁止默认把整道题、整份答案、全部聊天、全部草稿、完整用户历史、全部 mastery 和偏好同时发送给模型。这样会增加 token、延迟、成本、注意力污染、旧信息干扰和隐私暴露。

> **只发送完成当前任务真正需要的上下文。**

显式用户交互优先于推断；数学注意力所在的位置是上下文中心；更多上下文不自动等于更好的上下文。

## 4. AgentContext

```ts
interface AgentContext {
  request: RequestContext;
  problem?: ProblemContext;
  solution?: SolutionContext;
  selection?: SelectionContext;
  attempt?: AttemptContext;
  tutoring?: TutoringContext;
  learner?: LearnerContext;
  conversation?: ConversationContext;
  ui?: UIContext;
  contextMetadata: ContextMetadata;
}
```

所有字段均为 provider-independent domain objects。Agent Runtime 接收 `AgentContext`，不得在 Chat Component、Provider Adapter、Tool Code 和 System Prompt 中各自临时拼接上下文。

## 5. RequestContext 与 ContextTarget

```ts
interface RequestContext {
  userMessage?: string;
  action?:
    | "ask"
    | "request_hint"
    | "request_next_step"
    | "diagnose_attempt"
    | "explain_step"
    | "explain_motivation"
    | "verify"
    | "visualize"
    | "switch_strategy"
    | "show_solution"
    | "practice";
  explicitTarget?: ContextTarget;
  requestedHelpLevel?: number;
  timestamp: string;
}

type ContextTarget =
  | { type: "problem"; id: string }
  | { type: "solution_step"; id: string }
  | { type: "attempt_step"; id: string }
  | { type: "response_block"; id: string }
  | { type: "visualization"; id: string }
  | { type: "strategy_node"; id: string }
  | { type: "concept"; id: string };
```

多个候选对象同时存在时，优先级为：

```text
用户明确选择
> 用户明确引用
> 当前交互 Block
> 当前草稿 Focus
> 当前答案 Step
> 页面默认 Problem
```

用户在题目页选中“因此令 u=x+y”时，该 Selection 必须成为上下文中心，而不是整页题目。

## 6. Problem 与 Solution Context

```ts
interface ProblemContext {
  problemId: string;
  statement: string;
  latex?: string;
  subject?: string;
  difficulty?: string;
  metadata?: Record<string, unknown>;
  concepts?: ConceptRef[];
  attachments?: ContextAttachmentRef[];
}

interface SolutionContext {
  solutionId: string;
  problemId: string;
  steps: SolutionStepContext[];
  selectedStepId?: string;
  solutionType?: "official" | "community" | "agent_generated";
  isReferenceSolution: boolean;
}

interface SolutionStepContext {
  stepId: string;
  order: number;
  text?: string;
  latex?: string;
  previousStepId?: string;
  nextStepId?: string;
  semanticRole?: string;
}
```

Problem 是多数数学操作的根节点。SolutionStep 必须拥有稳定 ID、顺序和邻接关系，以支持局部解释、动机分析和连续追问。

## 7. SelectionContext

页面选择行为是正式 Context，而不是临时字符串。

```ts
interface SelectionContext {
  sourceType:
    | "problem"
    | "solution"
    | "attempt"
    | "response"
    | "formula"
    | "image_region";
  selectedText?: string;
  selectedLatex?: string;
  sourceId?: string;
  sourceStepId?: string;
  boundingBox?: BoundingBox;
  surroundingContext?: { before?: string; after?: string };
}

interface ContextualAgentAction {
  action: string;
  target: ContextTarget;
  problemId: string;
  sessionId?: string;
}
```

不能只保存选中文字，还必须能定位所属题目、答案步骤、相邻步骤及原始对象。UI Action 应携带显式 Context Pointer，避免让 LLM 猜“这里”指什么。

## 8. AttemptContext

与子规范 04 联动：

```ts
interface AttemptContext {
  attemptId: string;
  version: number;
  currentFocusStepId?: string;
  currentFrontier?: AttemptFrontier;
  selectedStep?: AttemptStep;
  localSteps?: AttemptStep[];
  detectedMethods?: DetectedMethod[];
  routeStatus?: AttemptRouteStatus;
  firstIssue?: AttemptIssue;
}
```

默认不要发送完整 `UserAttempt`。若 40 步草稿中只询问某一步，优先选择当前步骤、必要的前 1–2 步、当前目标和关键假设；局部无法判断时再扩展。

Attempt 必须携带版本。旧版本标记为 `stale` 并重新加载，不能基于用户已删除或修改的步骤继续解释。

## 9. TutoringContext

```ts
interface TutoringContext {
  hintState?: HintState;
  currentHelpLevel?: number;
  currentBlocker?: BlockerType;
  currentMethod?: string;
  currentGoal?: string;
  revealedInformation?: RevealState;
  solutionRevealPolicy?: string;
  sessionLearningState?: SessionLearningState;
}
```

“再提示一点”“只告诉我下一步”“别告诉我答案”必须自动带入 Hint State、当前路线、已经暴露的信息和 reveal policy。没有这些状态，系统无法判断下一层最小帮助。

## 10. LearnerContext

```ts
interface LearnerContext {
  preferences?: RelevantLearningPreferences;
  mastery?: RelevantMasteryState[];
  recentErrorPatterns?: ErrorPattern[];
  languagePreferences?: LanguagePreference;
}

interface RelevantLearningPreferences {
  explanationDepth?: string;
  rigor?: string;
  intuitionFirst?: boolean;
  hintBeforeSolution?: boolean;
  visualizationPreference?: string;
  responseLanguage?: string;
}
```

只注入会改变当前回答的长期信息。Mastery 仅在影响教学决策时使用，不得成为回答限制。信号优先级：

```text
Current explicit user state
> Recent session evidence
> Long-term mastery estimate
```

## 11. ConversationContext

```ts
interface ConversationContext {
  recentMessages?: ContextMessage[];
  relevantMessages?: ContextMessage[];
  previousResponseBlocks?: PresentationBlock[];
  currentThreadSummary?: SessionSummary;
}

interface SessionSummary {
  problemId?: string;
  currentGoal?: string;
  methodsTried?: string[];
  importantReveals?: string[];
  diagnosedErrors?: string[];
  unresolvedQuestions?: string[];
  currentFrontier?: string;
}
```

聊天历史采用 `Recent Window + Relevant Retrieval + Structured Session Summary`，不得无限发送全部 messages，也不能只用自由文本总结关键学习状态。

## 12. UIContext

```ts
interface UIContext {
  pageType: "problem" | "similar_problems" | "profile" | "practice" | "other";
  activePanel?: string;
  visibleProblemId?: string;
  visibleSolutionStepId?: string;
  selectedAttemptStepId?: string;
  activeVisualizationId?: string;
  deviceType?: "desktop" | "mobile";
}
```

UI 可见性只是弱信号，不等于数学 Context。页面滚动到 Step 8 时，如果用户明确选择 Step 3，Step 3 优先。

## 13. 来源、元数据与可追踪性

```ts
interface ContextSource {
  type:
    | "page"
    | "selection"
    | "attempt"
    | "session"
    | "learner_profile"
    | "retrieval"
    | "tool";
  sourceId?: string;
  confidence?: number;
}

interface ContextMetadata {
  selectedItems: ContextSelectionRecord[];
  omittedItems?: ContextOmission[];
  tokenEstimate?: number;
  compressionApplied?: boolean;
  expansionLevel?: number;
  generatedAt: string;
}

interface ContextOmission {
  source: string;
  reason:
    | "irrelevant"
    | "token_budget"
    | "privacy"
    | "stale"
    | "duplicate"
    | "reveal_policy";
}
```

开发模式应支持 Context Trace，列明 included、excluded 和 omission reason，以回答“为什么这轮 Agent 看到了这些内容”。

## 14. Intent → Context Policy

| Intent | 优先上下文 | 通常不需要 |
|---|---|---|
| `request_hint` | Problem、Attempt Frontier、Hint State、Method、Blocker、相关偏好 | 完整答案的可见内容 |
| `request_next_step` | Problem、Attempt、Frontier、Method、Revealed Information | 无关长期历史 |
| `diagnose_attempt` | Problem、相关 Attempt Path、Focus、Route；必要时扩大 | 无关聊天 |
| `explain_step` | Selected Step、Previous/Next Step、Problem Goal | 整份标准答案 |
| `explain_motivation` | Problem Structure、Selected Step、2–3 个前置步骤、下一步用途、Candidate Methods | 完整 UserAttempt |
| `verify` | Current Step、Previous Step、Assumptions、Domain | 大量聊天历史 |
| `visualize` | Selected Mathematical Object、必要参数和交互状态 | 整题无关内容 |
| `practice` | Current Problem、Diagnosed Error、Concept、Method、相关 Mastery 和已解题记录 | 无关偏好 |

Reference Solution 可在内部用于确认路线和判断下一步，但受 Hint System 和 reveal policy 隔离。

## 15. Context Locality 与渐进扩展

```ts
type ContextScope = "local" | "problem" | "global";
```

- `local`：目标对象、前 1–2 步、下一步及必要假设。
- `problem`：整道题范围内相关 solution、attempt 和 tutoring state。
- `global`：长期偏好、跨题 mastery 和相关历史，仅在必要时调用。

默认策略：

```text
Local
↓ 是否足够？
Problem Scope
↓ 是否足够？
Relevant Global Context
```

扩大触发条件包括：局部逻辑依赖更早假设、路线跨多个分支、证明无法局部判断、代词无法解析，或工具返回 `insufficient_context`。工具可以返回明确的 `needs`，Context Engine 再加载缺失信息。

## 16. Token Budget 与优先级

```ts
interface ContextBudget {
  maxTokens: number;
  reservedForSystem: number;
  reservedForTools: number;
  reservedForResponse: number;
  availableForContext: number;
}
```

默认裁剪优先级：

```text
1 Explicit User Selection
2 Current User Message
3 Current Problem Statement
4 Current Attempt Frontier
5 Relevant Steps
6 Hint State
7 Current Method
8 Relevant Preferences
9 Relevant Conversation
10 Long-term Mastery
```

具体 Intent 可以调整，但永远不能裁掉显式 Target，却留下大量低价值旧历史。

## 17. Compression 与 Fidelity

压缩方式包括字段选择、旧步骤语义压缩、自然语言摘要和 session summary。数学表达、定义域、假设、量词、符号和逻辑方向必须保持精确。

可把旧步骤压缩为“建立有界性 → 取收敛子列”，但当前讨论的公式和步骤必须保留原文。不能把 `\frac{x^2-1}{x-1}` 摘要成“一个分式”，也不能随意省略 `∀`、`∃`、`⇒`、`⇔`。

## 18. Integrity、Version 与 Authorship

每次构造 Context 检查：

```text
是否遗漏关键假设
是否混入其他题目
是否引用错误步骤
是否使用过期 Attempt
是否把 Agent 建议误认为用户独立步骤
```

```ts
interface VersionRef {
  objectId: string;
  version: number;
}
```

Context 必须区分用户、Agent、官方答案和系统生成内容。Agent 曾透露的关键代换被用户写入草稿后，不能被记作用户独立发现。

## 19. Reference Solution 与泄露边界

```ts
interface ReferenceSolutionPolicy {
  availableInternally: boolean;
  revealAllowed: boolean;
  maxRevealLevel?: number;
}
```

核心边界：

```text
Known To Agent ≠ Allowed To User
```

完整答案可以存在于内部 Context，但当前 Hint Level 和 Reveal Policy 决定允许展示多少。Context Engine、Hint System 与 Response Guard 必须联合测试答案泄露。

## 20. Security 与 Privacy

- 用户长期数据必须 `user scoped`。
- Session 数据必须 `session scoped`。
- 只有公共 Problem 内容可以跨用户共享。
- Provider API Key 永远不进入 Prompt、Context、Tool Result 或 tracing text。
- 纸质草稿原图只在当前识别任务需要时发送；解释阶段优先使用结构化 Attempt。
- Context Omission 应明确记录 `privacy` 原因，但内部敏感元数据不直接展示给用户。

## 21. Cache、Canonical Object 与稳定 ID

适合缓存：Problem 规范化结果、Solution parsed steps、Concept extraction、Attempt parsed structure 和 Session Summary。不应盲目缓存动态 Hint decision、当前 UI selection 和即时 blocker。

Cache key 至少包含 object ID、object version、parser version 和 schema version。正式对象应有 canonical representation 和稳定 ID：

```text
problem:P10002
solution:S203
solution-step:S203:4
attempt:A938
attempt-step:A938:7
concept:compactness
```

页面、聊天和用户复制出现重复内容时，关联 canonical object 并去重。

## 22. Target Resolution 与 Ambiguity

UI 操作应携带明确 Target。自然语言如“第三行为什么”可结合当前可见对象、最近引用和步骤编号解析。高置信度时自动绑定；只有两个高度合理候选同时存在时才请求澄清。

```ts
interface ContextAmbiguity {
  candidates: ContextTarget[];
  confidence: number[];
}
```

用户已经选中文字后问“为什么”，不得再次询问“你指哪一句”。

当前解析出的 `ContextTarget` 应作为简短焦点锚点返回体验层。用户改选步骤、修正“我指上一行”或提交新版 Attempt 时，Context Engine 必须重建目标与 snapshot；旧 Run 的迟到结果不得覆盖新焦点。焦点锚点只展示已确认目标与必要来源，不公开内部评分、长历史或未揭示解答。

## 23. 与 Planner、Tools 和 Response Blocks 的关系

- Context Engine 决定给 Planner 什么信息；Planner 决定如何教学。
- Tool Selector 根据 selected step、domain 和 attempt type 只暴露必要工具。
- Response Block 保存 source context pointers。
- 用户点击某个 Response Block 后，该 block ID 成为下一轮 Context Target。

```text
Agent Response Block
→ User Interaction
→ Block ID becomes Context Target
→ Next Agent Turn
```

## 24. Visualization 与 Strategy Map Context

```ts
interface VisualizationInteractionContext {
  visualizationId: string;
  parameterValues: Record<string, number>;
  selectedObjectId?: string;
  interactionType?: string;
}
```

用户拖动参数后问“为什么这里突然变快了”，Agent 能定位具体状态。Strategy Map 节点同样具有稳定 Target，点击“方法 B”后可直接询问为什么不用该方法。

## 25. Snapshot、跨页、Pinned 与 Reset

```ts
interface ContextSnapshot {
  snapshotId: string;
  contextReferences: ContextReference[];
  schemaVersion: string;
  timestamp: string;
}

interface PinnedContext {
  target: ContextTarget;
  expires: "session" | "problem" | "manual";
}
```

Snapshot 用于调试、复现和评测，不要求永久保存所有原始内容。跨页比较可以临时保留 previous/current problem ID，但不无限保留浏览历史。

AI Panel 应展示少量主要 Context Anchor，并允许用户取消绑定。无需展示 mastery vector、token budget 和 tool metadata 等内部细节。

进入完全不同题目、创建新 tutoring session 或用户明确换题时 reset session context，但不删除长期 Learner Profile。

## 26. Persistence

```text
Problem Context      session / page
Hint State           session + problem
User Attempt         persistent if user saves
Learner Preference   long-term
Mastery              long-term
UI Selection         ephemeral
Visualization state  ephemeral unless explicitly saved
```

Session 状态和长期状态严格分离，避免某题的提示等级和路线污染其他题目。

## 27. Context Assembly Pipeline 与 API

```text
User Action
→ Resolve Target
→ Resolve Intent
→ Load Local Sources
→ Build Candidate Context
→ Apply Context Policy
→ Estimate Token Cost
→ Compress if Necessary
→ Validate Integrity / Privacy / Leakage
→ AgentContext
```

```text
buildAgentContext()
resolveContextTarget()
selectRelevantContext()
expandContext()
compressContext()
validateContext()
```

```ts
interface BuildContextRequest {
  userAction: RequestContext;
  uiState: UIContext;
  sessionId?: string;
  tokenBudget?: number;
}

type BuildContextResult = Promise<AgentContext>;
```

## 28. Context Evaluation

必须测试：目标步骤是否正确、关键假设是否遗漏、无关历史是否注入、Attempt 版本是否最新、后续答案是否泄露、Agent 建议是否被误作独立步骤。

- **Context Precision**：已注入信息中真正相关的比例。
- **Context Recall**：任务需要的信息中成功注入的比例。
- **Context Efficiency**：成功完成任务所需的上下文成本，而非盲目追求最少 token。
- **Context Leakage**：低 Hint Level 下是否意外透露高等级信息。

## 29. 分阶段实现

### MVP

```text
ProblemContext
SolutionStep Selection
UserAttempt Current Focus
Hint State
Recent Conversation
Basic Learning Preferences
Local Context Selection
Problem Context Expansion
Simple Token Budget
```

### 第二阶段

```text
Session Summary
Relevant Conversation Retrieval
Mastery-aware Context
Context Snapshot
Context Trace
```

### 第三阶段

```text
Visualization Interaction Context
Strategy Map Context
Cross-problem Context
Pinned Context
Advanced Context Compression
```

## 30. 推荐工程模块

```text
context/
├── domain/
│   ├── AgentContext
│   ├── ProblemContext
│   ├── SelectionContext
│   ├── AttemptContext
│   └── ContextPolicy
├── resolvers/
│   ├── intentResolver
│   ├── targetResolver
│   └── referenceResolver
├── loaders/
│   ├── problemLoader
│   ├── solutionLoader
│   ├── attemptLoader
│   ├── learnerLoader
│   └── conversationLoader
├── selection/
│   ├── contextSelector
│   ├── relevance
│   └── budget
├── compression/
│   ├── contextCompressor
│   └── sessionSummary
└── validation/
    ├── staleContext
    ├── integrity
    └── leakage
```

实际目录可以按现有代码调整，但领域边界必须保留。

## 31. 最终原则

1. **Context should follow the user's mathematical attention.**
2. **Explicit interaction beats inferred relevance.**
3. **More context is not automatically better context.**
4. **What the Agent knows and what the learner may see are different things.**
5. **Context is a product capability, not merely prompt engineering.**

## 32. 最终 Pipeline

```text
                 User Interaction
                        │
                        ↓
                 Request Context
                        │
          ┌─────────────┼─────────────┐
          ↓             ↓             ↓
      Page State     User Attempt   Session State
          │             │             │
          └─────────────┼─────────────┘
                        ↓
                 Context Resolver
                        ↓
                 Context Selector
                        ↓
                  Context Budget
                        ↓
                Context Compressor
                        ↓
                  Integrity Check
                        ↓
                    AgentContext
                        ↓
                Pedagogy Planner
                        ↓
                    Math Agent
```

> **Context Engine 要让 Agent 在每一个教学瞬间，都恰好知道它真正需要知道的东西。**
