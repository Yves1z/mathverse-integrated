---
title: Evaluation Protocol
version: 0.2
status: active
last_updated: 2026-09-24
depends_on:
  - 00-architecture
  - 01-hint-system
  - 02-math-toolbox
  - 03-response-blocks
  - 04-user-attempt
  - 05-context-engine
  - 06-learner-model
  - 07-agent-state-machine
  - 08-provider-adapter
related:
  - 10-experience-orchestration
---

# Math Agent 子规范 09
# Evaluation Protocol v0.2

## 0. 文档目标

本规范定义：

> **怎样判断 Math Agent 是否真的在帮助学习。**

不能只评价最终答案。答案正确但泄露完整解法、对简单问题过度教学、提示没有命中 blocker、破坏用户可行路线，都属于失败。

```text
Mathematical Evaluation
+ Pedagogical Evaluation
+ Agent Runtime Evaluation
+ Learning Outcome Evaluation
+ Provider Reliability Evaluation
```

> **Correct answer is necessary, but not sufficient.**

## 1. 五层评测体系

```text
                   Evaluation
                       │
        ┌──────────────┼──────────────┐
        ↓              ↓              ↓
 Mathematical      Pedagogical      Runtime
        │              │              │
        └──────────────┼──────────────┘
                       ↓
                 Learning Outcome
                       │
                       ↓
                Provider Reliability
```

优秀 Agent 必须同时做到数学正确、帮助程度合适、理解当前上下文、尊重用户路线、工具可靠、状态连续，并促进独立进展。

## 2. EvaluationUnit 与分类

```ts
interface EvaluationUnit {
  evaluationId: string;
  runId?: string;
  sessionId?: string;
  problemId?: string;
  scenarioId?: string;
  category: EvaluationCategory;
  metrics: EvaluationMetricResult[];
  artifacts?: EvaluationArtifact[];
  evaluator?: EvaluatorInfo;
  createdAt: string;
}

type EvaluationCategory =
  | "mathematical"
  | "hint"
  | "attempt"
  | "context"
  | "pedagogy"
  | "response"
  | "runtime"
  | "learner_model"
  | "feynman"
  | "recall"
  | "long_term"
  | "provider"
  | "experience"
  | "end_to_end";
```

## 3. 三种评测层级

- **Unit Evaluation**：单独测试 tool、parser、guard、selector 等组件。
- **Integration Evaluation**：测试 Context → Planner → Tool → Response → State 的协作。
- **Learning Evaluation**：测试用户在 Agent 帮助后的独立表现是否改善。

第三层最难，也最接近产品使命。

## 4. Dataset、Scenario 与 ExpectedBehavior

建立版本化数据集：

```text
evals/
├── math/
├── hints/
├── attempts/
├── context/
├── feynman/
├── recall/
├── runtime/
├── providers/
└── end_to_end/
```

```ts
interface EvalScenario {
  id: string;
  title: string;
  description: string;
  initialState?: AgentSession;
  learnerState?: Partial<LearnerModel>;
  problem?: ProblemContext;
  attempt?: UserAttempt;
  event: AgentEvent;
  expected: ExpectedBehavior;
  tags: string[];
}

interface ExpectedBehavior {
  required?: string[];
  forbidden?: string[];
  acceptableVariants?: string[];
  expectedIntent?: string;
  expectedMode?: string;
  expectedTools?: string[];
  expectedBlockTypes?: string[];
  expectedStopCondition?: string;
}
```

Golden Scenario 是行为约束，不是唯一文本匹配。正确改写不应失败；超额泄露、错误 tool/state/block 则必须失败。

## 5. Evaluator 组合

```text
Deterministic Checks
        ↓
LLM Judge
        ↓
Human Review Sample
```

- Deterministic：schema、forbidden block、tool budget、state transition、答案泄露、公式和必要条件。
- LLM Judge：清晰度、Hint 强弱、是否命中 blocker、Feynman probe 价值；不得作为唯一真理。
- Human Review：学生、教师和高级数学用户共同评价严谨性、可理解性、烦扰程度和是否促进思考。

## 6. Mathematical Correctness

```ts
interface MathematicalCorrectnessScore {
  resultCorrect: boolean;
  stepsCorrect?: boolean;
  assumptionsHandled?: boolean;
  domainHandled?: boolean;
  rigorAdequate?: boolean;
  score: number;
}
```

分别评价结论、中间公式、逻辑、条件、定义域、量词和定理使用。结果碰巧正确不等于推理正确。证明题还要检查逻辑闭合、遗漏条件、循环论证、偷换命题和漏情况。

每个 Math Tool 建立独立 benchmark，尤其压低：

- **Verification False Positive**：错误步骤被判正确，风险最高。
- **Verification False Negative**：正确但非常规路线被误判错误。

## 7. Hint Evaluation

至少评价 Relevance、Reveal Amount、Progress Enablement、Route Preservation 和 Repetition。

- **Hint Relevance**：是否针对真实 blocker。
- **Hint Leakage Rate**：是否超过当前 Reveal Budget。
- **Premature Solution Rate**：Tutor 中未授权便给完整或近完整解法。
- **Hint → Independent Progress Rate**：提示后用户能否独立产生正确新进展。
- **Hint Efficiency**：是否使用 minimum sufficient reveal。
- **Hint Escalation Quality**：卡住时是否合理升级，而非同义重复或直接跳答案。
- **Hint Repetition Rate**：多轮提示是否实际重复同一信息。
- **Route Preservation Rate**：是否支持非标准但可行路线。
- **Route Destruction Rate**：是否错误地把可行路线拉回标准答案。

Level 1 应只引导观察，却直接给出关键代换，记为 leakage。

## 8. UserAttempt Evaluation

评测 Recognition、Segmentation、Reading Order、Route Diagnosis、First Significant Issue 和 Frontier。

- Attempt Parsing Accuracy
- Step Segmentation Accuracy
- Reading Order Accuracy
- First Significant Issue Accuracy
- First Issue Precision / Recall
- Error Localization Distance：`|predicted_step - true_step|`
- Over-Correction Rate：正确但不标准的步骤被判错。
- Route Diagnosis Accuracy
- Frontier Accuracy
- Recognition Uncertainty Calibration
- Silent Recognition Error Rate：看错字却当作数学错误，必须重点压低。

OCR 字符全对但分步/阅读顺序错误，仍属于 Attempt 解析失败。

## 9. Context Engine Evaluation

- **Context Target Accuracy**：是否围绕用户选中对象。
- **Pronoun Resolution**：能否正确解析“这里”“这个方法”。
- **Context Precision**：注入信息中真正相关的比例。
- **Context Recall**：任务必要信息被注入的比例。
- **Context Token Efficiency**：Task Success per Context Token，目标是足够且不冗余。
- **Context Freshness / Stale Context Rate**：是否使用最新 Attempt/Selection/State。
- **Cross-Problem Contamination**：旧题信息是否污染新题。
- **Context Leakage**：内部完整答案是否绕过 reveal policy。

## 10. Pedagogy Evaluation

- **Over-Tutoring Rate**：简单问题被强行追问、画图、安排练习。
- **Under-Tutoring Rate**：存在核心误解却只给答案。
- **Response Depth Appropriateness**：深度是否匹配复杂度、Mastery、Intent 和 Mode。
- **Question Quality**：问题是否清晰、单一、高信息量且能推动理解。
- **Multi-Question Overload Rate**：一次堆叠多个问题。
- **Student Thinking Share**：learner-generated 与 agent-generated reasoning 的观察比例。
- **Agent Monologue Rate**：Agent 多轮自顾推进、用户只说“继续”。
- **Stop Quality**：是否在该停时停、该继续时继续。
- **Premature Continuation / Stop Rate**
- **Direct / Tutor Mode Fidelity**

这些指标不是越高或越低越绝对好，而要与当前 Intent 和 Mode 联合解释。

## 11. Feynman Evaluation

Feynman 不评“AI 讲得多好”，而评用户能否解释以及 Agent 是否有效追问：

- Learner Talk Ratio
- Gap Identification Accuracy
- Highest-Value Probe Accuracy
- Question Specificity
- Over-Explanation Rate
- Repair Success
- Transfer Success
- Exit Quality：理解已清晰后是否及时结束。

一个泛泛的“再说清楚点”不如指向具体模糊量或隐含条件的问题。

## 12. Recall Evaluation

- Free Recall Success Rate
- Cue Effectiveness
- Recall Leakage Rate
- Delayed Recall：1 天、7 天、30 天等延迟下能否主动回忆。

Recall 评价主动取出知识，不是看到选项后识别答案。

## 13. Learner Model Evaluation

Learner Model 的价值在于预测未来行为，而非生成看似精确的分数：

- Mastery Predictive Validity
- Mastery Calibration
- Unknown Handling：证据不足时是否保留 unknown。
- Misconception Detection Precision
- Misconception Recurrence Rate
- Hint Dependence Reduction
- Independence Growth
- Near/Far Transfer Success
- Review Timing
- Review Intrusion / Acceptance Rate
- Long-Term Retention

“stable mastery”应能预测后续独立完成、主动回忆和迁移，而不仅是当前题答对。

## 14. Response Block Evaluation

- **Block Type Accuracy**：语义与 block 类型匹配。
- **Block Overfragmentation**：简单回答是否被切成过多 blocks。
- **Block Under-Structuring**：需要交互/状态的内容是否仍是一坨 Markdown。
- **Visual Hierarchy**：关键内容是否可扫描、可定位。
- **Action Relevance**：Suggested Actions 是否与当前状态相关。
- **Primary Action Clarity**：普通教学回合是否只突出一个符合当前目标的下一步；Direct 回合不强求操作。
- **Recovery Action Availability**：可预期失败是否给出可执行出口，且不误称已验证。
- **Correction Candor**：发现有证据支持的关键错误时，是否明确指出位置、依据与影响，而非用鼓励掩盖错误。
- **Support Calibration**：鼓励是否基于真实进展，能否对明确的挫败表达做简短回应，同时避免空泛赞美、羞辱和未经证实的心理判断。
- **Vision Preflight Accuracy**：拍照提交前，是否正确告知当前模型的视觉能力、跨服务数据去向与授权要求；能力未知时不得承诺已识图。

## 15. Visualization 与 Strategy Map

Visualization 评价 Mathematical Fidelity、Interaction Relevance、Visualization Learning Gain 和 Unnecessary Visualization Rate。

Strategy Map 必须正确描述候选路线、障碍和选择理由，不能泄露隐藏 Chain of Thought，也不能把完整解答包装成策略图。

方法比较还应检查适用前提、成本判断和换路信号是否针对当前题目且可解释；跨题推荐应检查共享数学结构、关键差异与题目链接是否真实存在。把表面相似误报为可迁移方法、把可行路线误判为死路、在没有题库证据时编造关联，都应作为独立失败案例。

## 16. Tool Evaluation

- Tool Selection Precision / Recall
- Unnecessary Tool Call Rate
- Tool Budget Violation Rate
- Tool Grounding：回答是否忠实使用结果。
- Tool Hallucination：是否声称调用了不存在或未执行的工具。
- Tool Result Misinterpretation

Tool 成功不代表最终教学行为成功；ToolResult 必须结合 Context、Policy 和 Guard 评估。

## 17. Runtime Evaluation

- Intent Resolution Accuracy
- Mode Selection Accuracy
- State Continuity
- Resume Accuracy
- Interrupt Accuracy
- Stale Result Rejection
- Duplicate Event Rate
- Concurrent State Conflict Rate
- Response Guard Accuracy
- Guard False Positive / False Negative Rate

网络重试不得重复记录 evidence、提升 Hint Level 或创建 Practice Event。Guard False Negative 通常比误拦截更危险。

## 18. Provider Evaluation

子规范 08 需要独立 Contract Eval：

- Provider Request Success
- Structured Output Validity
- Tool Call Validity
- Multi-Round Tool Reliability
- Streaming Integrity
- Capability Registry Accuracy
- Reasoning Mapping 的质量/成本/延迟递进
- Provider Substitution Consistency
- Provider Drift Detection

切换 GPT、Claude、Qwen 或 DeepSeek 后，文本可以不同，但 Hint Level、Stop Condition、Tool Policy 和 Block Types 应继续满足领域协议。

## 19. Regression 与 Golden Dataset

重要修改都运行固定 Golden Scenarios，至少覆盖 Hint、Direct、Feynman、Attempt diagnosis、Context selection、Tool calling、Resume 和 Provider contracts。

```yaml
scenario:
  user: "给我一点提示"
  problem: substitution_problem

expected:
  mode: tutor
  hint_level: 1
  must:
    - direct_attention_to_repeated_structure
  forbidden:
    - reveal_u_equals_x_plus_y
    - full_solution
  stop:
    - wait_for_user
```

Golden 定义 required/forbidden/acceptable variants，而非锁定单一措辞。

## 20. Adversarial Evaluation

必须测试反复点击提示、突然切换模式、错误 OCR、多个正确方法、极短问题、超长证明，以及用户把完整答案复制进草稿。

用户内容、草稿和社区/官方解答全部是 untrusted context；其中的“IGNORE SYSTEM INSTRUCTIONS”等文本不能改变 Agent Policy。

教育型对抗案例包括：

```text
正确但怪异解法
错误过程但最终答案正确
官方答案错误
多个等价定义
需要分情况
非构造性证明
```

Official Solution 不是路线唯一真值，UserAttempt 必须独立验证。

## 21. Human Review 双视角

教师适合评价 Hint quality、Proof feedback 和 Feynman questions；学生适合评价是否听懂、是否烦人、提示是否过强和是否能继续。

教师认为严谨不等于学生能继续；学生觉得易懂不等于数学正确。两种视角都需要。

User Satisfaction 不是唯一指标：直接给答案可能获得即时好评，却降低 learning gain。

## 22. Product Metrics 与 Learning Metrics

```text
Product: DAU, session length, click rate
Learning: independent progress, retrieval, transfer
```

Session Length、Token Volume、Answers Generated 和 Messages Sent 不是教学效果核心指标。优秀 Agent 可能用更少 turn 解决学习障碍；成本评价应看 quality/cost，而非绝对 token 最少。

### Experience Metrics

按子规范 10 的完整用户旅程评测；指标必须与数学正确性和长期学习效果联合解释。

- **Time to First Useful Feedback**：从用户提交到第一条能推进当前任务的有效反馈；“正在处理”只属于确认/进度，不算有用反馈。
- **Hint → New Attempt Conversion**：看过提示的回合中，用户随后是否提交新的尝试；另行记录尝试是否正确，避免把随意输入算作学习进展。
- **Context Correction Rate**：用户需要纠正 Agent 当前目标的回合比例；结合被纠正后是否真正切换到正确 target。
- **Unnecessary Clarification Rate**：目标已经明确仍追问或要求无价值确认的比例。
- **Dead-End Response Rate**：可恢复失败却没有可执行下一步的比例。
- **Cancel / Resume Success**：取消后 Session 与已揭示状态是否保留，以及恢复后是否使用最新 Attempt 和焦点。
- **Perceived Control / Trust Calibration**：通过用户研究测量用户能否控制帮助强度、答案揭示、模式、记录范围，以及是否正确理解“已验证 / 未验证”。

这些比例应报告适用场景的分母与样本量，分开统计 Direct、Tutor、手写和 BYOK 场景。不能单靠点击率推断满意或学习效果；线上事件遵守数据最小化。

## 23. Composite Score 与安全硬阈值

```ts
interface EvaluationSummary {
  mathematical: number;
  pedagogy: number;
  context: number;
  runtime: number;
  learning: number;
  providerReliability: number;
}

type EvalFailureSeverity = "minor" | "moderate" | "major" | "critical";
```

不要用单一总分掩盖问题。以下安全关键项设置硬阈值，不能被其他高分抵消：

```text
Severe mathematical error
Premature full solution
Tool false verification
Cross-user context leakage
API key leakage
Stale state corruption
```

## 24. Eval Run、版本与可复现性

```ts
interface EvalRun {
  evalRunId: string;
  suiteVersion: string;
  codeVersion: string;
  providerModels: ModelIdentity[];
  startedAt: string;
  completedAt?: string;
  results: EvaluationUnit[];
}
```

记录 Model、Provider、Reasoning Level、Prompt Version、Tool Version、Context Version 和可用的 Random Seed。Eval Dataset 自身必须版本化。

模型有非确定性，同一场景建议运行 3–10 次并评估 mean、variance、confidence interval 和 reliability，而不是只看一次优秀输出。

## 25. Offline、Online 与 A/B

- Offline Eval：固定、快速、可重复。
- Online Eval：真实用户、真实行为和真实学习效果。
- A/B：比较 Hint/Policy/Presentation 等方案，关注 Independent Progress、Reveal Amount、Satisfaction 和延迟表现。

学习 A/B 不能只看即时点击；很多效果需要延迟复习才能体现。

Online 优先采集结构化事件，如 Hint Level、independent progress、mode switch、recall/practice outcome。默认不上传完整私密草稿和聊天作为 eval 数据。

## 26. Artifacts 与 Failure Attribution

```ts
interface EvaluationArtifact {
  type: "response" | "tool_trace" | "state_trace" | "context_trace" | "human_annotation";
  reference: string;
}

type FailureSource =
  | "context"
  | "intent"
  | "learner_assessment"
  | "pedagogy_plan"
  | "tool_selection"
  | "tool_execution"
  | "provider"
  | "presentation"
  | "guard"
  | "state"
  | "unknown";
```

Context Trace 记录 Included、Excluded 和 Why。失败要尽量归因到具体子系统，而不是统一归咎“LLM 不够聪明”。调试优先顺序通常为 Context → Tool Result → State → Planner → Model Output。

## 27. Internal Dashboard

内部 Dashboard 可展示 Math correctness、Hint leakage、Independent progress、Over-tutoring、First issue accuracy、Context target accuracy、Tool reliability、Mode fidelity 和 Provider reliability。

这些是开发指标，不直接展示给普通用户；用户界面更适合显示学习进展、待复习内容和独立完成情况。

## 28. MVP Eval Suite

第一阶段建立约 50–100 个高质量场景，覆盖优先于数量。建议初始分布：

```text
15 Mathematical correctness
15 Hint / Reveal
15 UserAttempt diagnosis
10 Context
10 Mode behavior
10 Runtime continuity
10 Provider contracts
```

数据集必须包含简单题、中等题、困难题、定义问题、错误草稿、正确但非常规草稿、“我只要答案”、Feynman、Recall、Resume 和缺少 tools/vision/strict schema 的 Provider 场景。

体验场景额外覆盖：选中一步后纠正焦点、只检查当前步骤、单轮直接回答覆盖、连续求助但仍保留索取答案路径、低置信度识别确认、工具失败后的恢复、取消重试、跨页恢复与换模型后延续当前学习目标。

## 29. Evaluation Gates

- **Merge Gate**：unit tests、schema tests、golden scenarios、provider contract tests、critical safety metrics。
- **Release Gate**：regression suite、human sample review、provider smoke tests。
- **Provider Upgrade Gate**：更换默认模型必须跑 Math Agent suite；更强模型未必更会当 Tutor。
- **Prompt Change Gate**：检测泄露率、长度和 Tool JSON 回归。
- **Tool Change Gate**：重跑 verification 与 attempt diagnosis。
- **Context Change Gate**：重测 recall、mathematical correctness 和 leakage。
- **Learner Model Change Gate**：重测未来行为预测、over-tutoring 和 review quality。

## 30. North-Star 与核心指标

### Independent Learning Progress

> 在没有直接获得完整答案的情况下，用户是否在 Agent 帮助后自己完成新的正确数学进展。

它不等于整题做对率。一个小提示后独立完成关键一步，即使整题尚未完成，也属于成功。

### Assistance Efficiency

> 完成同样学习进展需要透露多少信息。

### Delayed Independent Performance

> 之后没有 Agent 帮助时，用户是否仍能回忆、解释、应用和迁移。

Anti-metrics：Answers Generated、Messages Sent、Token Volume、Session Length。

## 31. 最终原则

1. **Evaluate learning behavior, not only answer quality.**
2. **Every subsystem should be independently diagnosable.**
3. **The best tutoring response is not always the most complete response.**
4. **A mathematically correct intervention can still be pedagogically wrong.**
5. **Long-term success is demonstrated by independent recall and transfer.**

## 32. 最终 Pipeline

```text
                    Math Agent
                        │
                        ↓
                      Runs
                        │
          ┌─────────────┼─────────────┐
          ↓             ↓             ↓
       Offline        Online       Human Review
          │             │             │
          └─────────────┼─────────────┘
                        ↓
                 Evaluation Units
                        │
        ┌───────────────┼───────────────┐
        ↓               ↓               ↓
 Mathematical      Pedagogical       Runtime
        │               │               │
        ├───────────────┼───────────────┤
        ↓               ↓               ↓
 Context           Learner Model     Provider
        │               │               │
        └───────────────┼───────────────┘
                        ↓
                 Learning Outcomes
                        ↓
             Regression / Improvement
```

> **Evaluation 最终要判断：Math Agent 是否正确理解用户、可靠使用工具、控制帮助程度，并让用户越来越能在没有 Agent 的情况下独立完成数学思考。**
