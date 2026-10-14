---
title: Learner Model Protocol
version: 0.2
status: active
last_updated: 2026-09-23
depends_on:
  - 00-architecture
  - 01-hint-system
  - 04-user-attempt
  - 05-context-engine
related:
  - 02-math-toolbox
  - 03-response-blocks
  - 07-agent-state-machine
  - 09-evaluation
  - 10-experience-orchestration
---

# Math Agent 子规范 06
# Learner Model Protocol v0.2

## 0. 文档目标

Learner Model 回答三个必须严格分开的问题：

> **这个用户喜欢怎样学习？**

> **这个用户实际上掌握了什么？**

> **此时此刻应该采用什么教学方式？**

```text
Preference
≠ Mastery
≠ Learning Mode
≠ Session State
```

本轮教学策略由用户偏好、当前掌握程度、题目难度、当前学习模式和明确用户意图共同决定。Learner Model 的目标不是让 AI 记住更多用户信息，而是基于可靠证据，在正确时间提供正确深度的帮助。

## 1. 总体架构

```text
                     Learner Model
                           │
       ┌───────────────────┼───────────────────┐
       ↓                   ↓                   ↓
 Preferences          Mastery Model       Learning Memory
       │                   │                   │
 喜欢怎样学           实际掌握多少         长期学习历史
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ↓
                     Mode Controller
                           ↓
                   Pedagogy Planner
                           ↓
          ┌────────────────┼────────────────┐
          ↓                ↓                ↓
       简洁回答          Hint          Feynman / Recall
```

```ts
interface LearnerModel {
  userId: string;
  preferences: LearningPreferences;
  conceptStates: Record<string, ConceptLearningState>;
  misconceptionStates: MisconceptionState[];
  learningMemory: LearningMemory;
  modePreferences: ModePreferences;
  reviewState?: ReviewState;
  modelMetadata: LearnerModelMetadata;
}
```

## 2. Learning Preferences

Preference 只描述用户希望 Agent 怎样交流和教学，不代表能力水平。

```ts
interface LearningPreferences {
  explanationDepth: "concise" | "normal" | "detailed";
  rigor: "intuitive" | "balanced" | "rigorous";
  explanationOrder: "intuition_first" | "formal_first" | "adaptive";
  solutionRevealPolicy: "hint_first" | "ask_first" | "direct_allowed";
  visualization: "minimal" | "when_helpful" | "frequent";
  strategyMap: "never" | "complex_only" | "frequent";
  questionFrequency: "low" | "normal" | "high";
  preferredLanguage?: string;
  bilingualMode?: boolean;
  customInstructions?: string;
}
```

“喜欢详细解释”不能导致所有问题都冗长。回答深度仍要结合问题复杂度、Mastery、Learning Mode 和当前明确请求。

## 3. Adaptive Brevity 与意图优先级

```ts
type PedagogicalIntensity = "minimal" | "normal" | "guided" | "deep";
```

> **High mastery should usually decrease explanation overhead.**

掌握越稳定，Agent 越应尊重用户时间。系统拥有某项教学能力，不意味着每次都要使用。

行为优先级：

```text
Explicit Current Request
> Current Learning Mode
> Current Session State
> Long-term Preferences
> Long-term Mastery Estimate
```

即使 mastery 很高，用户明确要求详细解释时仍应详细解释；即使 mastery 较低，用户明确要求直接答案时也应尊重，仅在必要时附轻量提醒。

## 4. ConceptLearningState

Mastery 不能只表示为一个分数。

```ts
interface ConceptLearningState {
  conceptId: string;
  masteryEstimate: number;
  masteryConfidence: number;
  retrievalStrength?: number;
  transferStrength?: number;
  independence?: number;
  hintDependence?: number;
  misconceptionRisk?: number;
  lastEvidenceAt?: string;
  lastRetrievedAt?: string;
  lastPracticedAt?: string;
  nextReviewAt?: string;
  evidenceIds: string[];
}
```

- `masteryEstimate`：当前掌握程度的内部摘要，不应直接展示虚假精度。
- `masteryConfidence`：系统对估计有多确定；高估计、低置信度意味着需要更多证据。
- `retrievalStrength`：没有提示时能否主动回忆。
- `transferStrength`：形式变化后能否识别和应用同一思想。
- `independence`：完成任务时对帮助的依赖程度。
- `hintDependence`：是否经常需要高级提示；它只是信号，不等于能力差。

## 5. Mastery Evidence

所有 Mastery 变化都必须来自可追踪 evidence。

```ts
interface MasteryEvidence {
  evidenceId: string;
  conceptId: string;
  source:
    | "problem_attempt"
    | "retrieval"
    | "teach_back"
    | "near_transfer"
    | "far_transfer"
    | "proof"
    | "conversation"
    | "review";
  outcome: "success" | "partial" | "failure" | "uncertain";
  assistanceLevel:
    | "none"
    | "nudge"
    | "hint"
    | "key_move"
    | "guided"
    | "solution_seen";
  strength: "weak" | "medium" | "strong";
  confidence?: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
```

证据强度原则：

```text
看懂解释 / 自我报告“明白了”                 → weak
有提示完成同类型题                           → medium
无提示主动回忆或独立完成                     → strong
无提示完成 far-transfer                      → very strong candidate
```

具体权重不在 v0.1 写死，必须通过 Evaluation 调整。用户在 Agent 已透露关键步骤后完成，不能与独立完成形成同等 mastery evidence。

## 6. Teach-Back Evidence

用户能用自己的语言准确解释概念，是比“看懂了”更强的证据。

```ts
interface TeachBackEvidence extends MasteryEvidence {
  explanationQuality?: {
    correctness: number;
    completeness: number;
    conceptualDepth?: number;
  };
}
```

高质量 teach-back 还应检查用户能否回答 why、识别隐含条件、处理反例并应用于新例子。

## 7. Misconception Model

Learner Model 不只记录会不会，还记录当前观察到的具体误解。

```ts
interface MisconceptionState {
  misconceptionId: string;
  conceptIds: string[];
  label: string;
  status: "suspected" | "active" | "resolved" | "recurred";
  confidence: number;
  evidenceIds: string[];
  lastObservedAt?: string;
}

interface ErrorPattern {
  patternId: string;
  label: string;
  conceptIds: string[];
  frequency: number;
  confidence: number;
  lastObservedAt: string;
}
```

记录“交换极限时忽略存在性条件”比“极限题做错”更有价值。Misconception 具有生命周期，不能成为永久标签；具体数学错误也不能泛化为“粗心”“不适合数学”等人格判断。

## 8. Learning Modes

```ts
type LearningMode =
  | "auto"
  | "tutor"
  | "feynman"
  | "recall"
  | "direct";

type ModeScope = "turn" | "session" | "problem" | "long_term";
```

同一用户在不同时间目标不同：第一次理解、做题辅导、主动回忆、快速查结论或长期巩固，不能使用同一套固定 Tutor Policy。

模式切换可来自 UI，也可来自自然语言。一次性的“这题直接给答案”只作用于当前 turn，不能自动修改长期 Preference。

界面入口优先使用任务语言，例如“陪我一步步做”“直接帮我解决”“检验我是否真的理解”，底层仍映射到既有 `LearningMode`。用户明确表达的 `turn` 模式覆盖 Session 默认值；`problem`、`session` 和 `long_term` 作用域需要明确可见。切换模式保留本题草稿与已揭示信息，清除不再适用的 expected input。

原则上每轮只有一个 Primary Learning Mode。长期学习是 persistence policy，而不是与 Feynman/Recall 完全同级的教学模式。

## 9. Auto Mode

Auto 是默认模式，由 Context 和 Learner Model 动态选择策略：

```text
简单问题 + 高 mastery         → concise direct answer
新概念 + mastery unknown      → intuition + example
复杂题 + 用户卡住             → Hint Ladder
关键概念刚学会                → optional teach-back
```

普通用户不应频繁切模式；Mode 是需要明确控制时的 override。

```ts
interface ModeDecision {
  effectiveMode: LearningMode;
  pedagogicalIntensity: PedagogicalIntensity;
  reasons: string[];
  confidence: number;
}
```

Auto Mode 参考显式意图、题目复杂度、blocker、concept mastery、mastery confidence、hint history、recent errors、当前时间目标和偏好。

## 10. Tutor Mode

目标是陪用户自己完成题目：不默认给答案、小步推进、使用 Hint Ladder、理解 UserAttempt、定位 Current Frontier。

```text
User Attempt
→ 理解当前进度
→ 判断 blocker
→ Minimum Useful Help
→ 等待用户尝试
→ 重新评估
```

## 11. Feynman Mode

Feynman Mode 让用户通过向 Agent “讲课”检测理解。Agent 是认真但不断追问的学生，不是再次长篇讲课的老师。

```text
选择概念
→ 用户不用资料解释
→ 识别模糊点 / 跳步 / 隐含假设
→ 只追问一个最有信息量的问题
→ 用户重新解释
→ 必要时补充最小信息
→ 再次 Teach Back
→ 新例子或 transfer test
```

```ts
interface FeynmanState {
  targetConceptIds: string[];
  explanationRound: number;
  claimsMadeByLearner: LearnerClaim[];
  unresolvedGaps: ConceptGap[];
  questionsAsked: string[];
  repairedGaps: string[];
  transferTestCompleted?: boolean;
}

interface LearnerClaim {
  claimId: string;
  content: string;
  status: "correct" | "partially_correct" | "incorrect" | "vague" | "unverified";
  relatedConceptIds: string[];
}
```

重点寻找 vague understanding、hidden assumption 和 memorized language without meaning。一次只问一个关键问题，避免变成考试。

结束条件不能只是用户说“懂了”；应至少满足若干：关键概念解释正确、主要 misconception 已修复、能回答 why、能处理反例或简单 transfer task。用户已经熟练时应及时结束。

```ts
type FeynmanWorthiness = "low" | "medium" | "high";
```

Feynman 应优先用于具有概念结构的知识，而不是简单事实。

## 12. Recall Mode

Recall Mode 目标是主动回忆，而不是重新学习或评分。Agent 先不给内容，失败后逐步提供 retrieval cue。

```text
Recall Level 0   完全自由回忆
Recall Level 1   类别提示
Recall Level 2   部分结构
Recall Level 3   首步 / 关键词
Recall Level 4   展示答案
```

Recall 的提示与普通 Hint Ladder 相关但独立记录，因为它衡量的是 retrieval strength。

## 13. Direct Mode

Direct Mode 适用于用户此刻不想接受教学，只想快速获得结果。它应给出简洁答案、必要公式和极少教学追问。

好的 Tutor 必须知道什么时候教学，什么时候只是工具。不能永远以“我不能直接告诉你答案”阻碍明确用户意图。

## 14. 长期学习与 Persistence Policy

长期学习不是“ChatGPT 记住更多东西”，而是将当前活动纳入 Learner Model 与复习计划。

```ts
interface LearningPersistencePolicy {
  enabled: boolean;
  trackMastery: boolean;
  trackMisconceptions: boolean;
  scheduleReview: boolean;
  useCrossSessionHistory: boolean;
}

interface ModePreferences {
  defaultMode: LearningMode;
  persistencePolicy: LearningPersistencePolicy;
  autoSuggestFeynman?: boolean;
  autoSuggestRecall?: boolean;
}
```

```text
Learning Activity
→ Evidence
→ Concept State
→ Misconception
→ Retrieval / Review
→ Near Transfer
→ Far Transfer
```

长期模式自动介入必须克制，用户可忽略复习建议，不应制造“逾期负债”压力。

## 15. Learning Memory

```ts
interface LearningMemory {
  conceptMemories: Record<string, ConceptMemory>;
  learningEvents: LearningEvent[];
  activeLearningGoals?: LearningGoal[];
  reviewQueue?: ReviewItem[];
}

interface ConceptMemory {
  conceptId: string;
  firstSeenAt?: string;
  lastStudiedAt?: string;
  lastRetrievedAt?: string;
  successfulRetrievals: number;
  failedRetrievals: number;
  nearTransferSuccesses: number;
  farTransferSuccesses: number;
  unresolvedMisconceptionIds: string[];
  evidenceIds: string[];
  nextReviewAt?: string;
}

interface LearningEvent {
  eventId: string;
  type:
    | "study"
    | "attempt"
    | "hint"
    | "retrieval"
    | "teach_back"
    | "review"
    | "near_transfer"
    | "far_transfer"
    | "misconception_detected"
    | "misconception_resolved";
  conceptIds: string[];
  outcome?: string;
  assistanceLevel?: string;
  timestamp: string;
}
```

Conversation Memory 记录最近说了什么；Learning Memory 记录学习证据与知识状态。禁止把完整聊天历史当作 Learner Model。

## 16. Review State 与 Review Type

```ts
interface ReviewState {
  queue: ReviewItem[];
  defaultStrategy: "adaptive" | "spaced_repetition";
  dailyReviewLimit?: number;
}

interface ReviewItem {
  reviewId: string;
  conceptId: string;
  dueAt: string;
  reviewType: "recall" | "teach_back" | "repair" | "near_transfer" | "far_transfer";
  priority: number;
  reason: string;
}

type ReviewIntrusion = "silent" | "suggest" | "integrate";
```

默认采用 `suggest`，而不是强行打断当前任务。数学复习不应退化为 Flashcard：定义型概念适合 recall、teach-back 和例/反例；方法型知识适合方法识别和迁移；证明型知识适合证明骨架与条件检查；计算技巧适合短练习与错误修复。

Review Scheduler 可使用 FSRS 或其他算法，但领域模型只依赖接口：

```ts
interface ReviewScheduler {
  schedule(
    state: ConceptLearningState,
    evidence: MasteryEvidence[]
  ): ReviewItem | null;
}
```

## 17. Concept Graph、Learning Goal 与 Mastery Dimensions

Learner Model 可与课程定义的 Concept Dependency Graph 联动，进行 prerequisite diagnosis。依赖关系必须来自课程体系或可靠知识结构，不能从概念名称猜测。

```ts
interface LearningGoal {
  goalId: string;
  title: string;
  conceptIds: string[];
  targetLevel?: "recognition" | "understanding" | "application" | "proof" | "transfer";
  deadline?: string;
  status: "active" | "paused" | "completed";
}

interface MasteryDimensions {
  recognition?: number;
  recall?: number;
  explanation?: number;
  application?: number;
  proof?: number;
  transfer?: number;
}
```

MVP 只保留 `understanding / independence / retrieval / transfer` 四维，避免过早复杂化。一个 mastery number 只能作为摘要。

## 18. Evidence Decay、Retrieval 与 Transfer

很久以前的证据不永久等同于今天。应主要降低 retrievability 或增加 uncertainty，而不是粗暴断定理解下降。

- **Retrieval success**：提高 retrieval strength 和 confidence。
- **Near transfer**：在结构相近、表面略变的任务中应用。
- **Far transfer**：在表面差异明显时识别相同核心策略，是强 evidence。
- **Misconception repair**：通过恰好暴露错误理解的反例或任务修复，而不是只扣 mastery 分。

长期模式可以 interleave 相近但不同的方法，训练方法识别，而不是反复练同一表面题。

## 19. Learner Model Update Pipeline

```text
Learning Event
→ Evidence Extraction
→ Evidence Validation
→ Concept Mapping
→ Update Concept State
→ Update Misconceptions
→ Update Review Schedule
→ Persist
```

LLM 输出 Evidence，不直接写 Mastery：

```json
{
  "concept": "sequential_compactness",
  "event": "independent_correct_application",
  "assistance": "none",
  "confidence": 0.92
}
```

```ts
interface MasteryUpdater {
  update(
    previous: ConceptLearningState,
    evidence: MasteryEvidence[]
  ): ConceptLearningState;
}
```

MasteryUpdater 可从规则模型逐步升级到 Bayesian、BKT/IRT-inspired 或其他模型。Provider 只负责 evidence interpretation，确定性 Learner Model Service 负责 state update。所有 Provider 使用统一 Evidence Schema。

## 20. Response Complexity Controller

```ts
interface ResponseComplexityDecision {
  answerDetail: "minimal" | "concise" | "normal" | "detailed";
  questioning: "none" | "optional" | "active";
  visualization: "none" | "optional" | "recommended";
  reason: string;
}
```

输入包括 Task Complexity、Concept Mastery、Mastery Confidence、Preference、Learning Mode、Explicit Request 和 Current Blocker。

粗略原则：

| | Mastery low | Mastery high |
|---|---|---|
| Simple | concise | very concise |
| Complex | guided | challenge / expert compression |

高 mastery + 高 confidence 时，可使用 Expert Compression，只指出关键思路、关键障碍和必要条件，不重复基础概念。Mastery-aware vocabulary 允许对熟悉术语不再重复解释。

## 21. 模式与响应示例

同一问题“单调收敛定理要求什么条件？”：

- Auto + high mastery：简洁给出关键条件与结论后结束。
- Recall：先让用户回忆关键条件，不立即展示答案。
- Feynman：让用户解释为什么单调条件允许积分与极限交换。
- Direct：直接给结论，不追加教学流程。
- Long-term enabled：后台记录 evidence 并安排未来 retrieval，不必继续聊天。

模式改变，行为随之改变；长期保存策略与当前教学模式可以组合，但不得无限叠加多个 primary modes。

## 22. User Control、Transparency 与 Conflict Resolution

用户应能查看“我的学习状态”，包括正在学习的概念、近期薄弱点、待复习内容、长期目标和学习偏好；并能关闭长期学习、清空记录、修正偏好和查看追踪范围。

UI 使用“正在建立 / 需要复习 / 基本掌握 / 掌握稳定 / 需要迁移练习”等可理解标签，不展示 `74.23%` 一类虚假精度。

普通解题回合不主动展示掌握分数或能力判断。若个性化导致明显的提示强度或解释深度变化，可用一句可纠正的话说明依据，例如“我先给一条短提示，你可以让我展开”。“不记录这次长期学习”仅覆盖当前回合的长期 evidence 写入策略，不能删除本题运行所需的临时状态。

用户纠正系统判断时，记录 self-report、降低当前判断 confidence，并可通过 Recall/Transfer 验证；不能直接把 mastery 拉满。

长期 evidence 与当前错误冲突时，先区分遗忘、特殊题型、计算错误、误解复发或识别错误，不立即推翻全部 mastery。

## 23. Privacy 与数据最小化

长期建议保存：Concept State、Evidence 摘要、Misconception State、Review State、Learning Goal 和 Preference。

默认不长期保存完整纸质草稿、完整私密对话、每一个 token、临时 UI selection 和视觉模型原始中间输出。

Learner Model 只描述当前可观察的学习状态，不进行聪明、懒惰、天赋、人格或固定“视觉型学习者”等判断。表达方式根据当前任务的效果 evidence 调整，不泛化为人格身份。

## 24. Uncertainty 与 Cold Start

证据不足时必须保留 uncertainty。一次错误只能记录当前相关 evidence 和低 confidence，不能断言用户不懂某概念。

新用户初始状态：

```text
Mastery = unknown
Confidence = low
```

不能设为 `Mastery = 0`。系统可通过最初几次任务的难度、UserAttempt、独立完成程度和对 Hint 的反应逐步适应；可选 Placement Session 不属于 MVP。

## 25. 与其他系统联动

### Similar Problems

推荐结合 Mastery、Misconception、Hint Dependence、Transfer Need 和 Review State，形成：

```text
Repair Problem
→ Near Transfer
→ Far Transfer
→ Delayed Retrieval
```

### Hint System

高 mastery 用户当前卡住时，Hint 更倾向高层方向而不是重讲基础概念。Assistance Level 必须进入 evidence。

### Feynman / Recall

application 高但 explanation evidence 缺失时适合 Feynman；understanding 高但 retrieval 低时适合 Recall，而不是重新讲课。

### Visualization

公式解释反复失败时可提高 visualization value。视觉化效果只能形成当前概念/任务的 strategy evidence，不能贴永久“视觉学习者”标签。

### Context Engine

只向当前任务注入相关 Preference、Concept State、Misconception 和 Review 信号，不发送完整 Learner Profile。

## 26. Event Bus 与状态写入边界

Hint System、UserAttempt、Practice、Feynman Session 和 Recall Session 产生统一 `LearningEvent`。任何模块都不能直接执行 `mastery += 0.1`。

```text
Modules
→ Learning Events
→ Evidence Extraction
→ Learner Model Service
→ State Update
```

状态更新必须统一、可追踪、可回放，并与 Provider 解耦。

## 27. 推荐工程模块

```text
learner/
├── domain/
│   ├── LearnerModel
│   ├── ConceptLearningState
│   ├── MasteryEvidence
│   ├── MisconceptionState
│   └── LearningGoal
├── preferences/
│   ├── preferenceService
│   └── preferenceResolver
├── mastery/
│   ├── evidenceExtractor
│   ├── masteryUpdater
│   └── confidenceUpdater
├── modes/
│   ├── modeController
│   ├── feynmanMode
│   ├── recallMode
│   └── tutorMode
├── memory/
│   ├── learningMemory
│   └── learningEvents
├── review/
│   ├── scheduler
│   ├── reviewQueue
│   └── retrievalPlanner
└── misconceptions/
    ├── misconceptionDetector
    └── misconceptionLifecycle
```

## 28. 推荐 Service API

```text
getLearnerContext()
recordLearningEvent()
extractMasteryEvidence()
updateConceptState()
updateMisconceptionState()
selectLearningMode()
planReview()
getDueReviews()
startFeynmanSession()
startRecallSession()
```

## 29. 分阶段实现

### MVP

```text
LearningPreferences
Auto / Tutor / Feynman / Direct
Concept Mastery: unknown / learning / familiar / stable
Mastery Evidence
Hint Dependence
Basic Misconception Tracking
Basic Long-Term Learning Toggle
```

MVP Feynman：选择概念 → 用户解释 → Agent 找一个关键 gap → 追问 → 用户修正 → 简短总结。

MVP Long-Term：记录学了什么、是否独立完成、提示等级、具体错误和最近练习时间；暂不实现复杂 FSRS。

### 第二阶段

```text
Retrieval Strength
Teach-Back Evidence
Near Transfer
Review Queue
Basic Spaced Review
```

### 第三阶段

```text
Far Transfer
Adaptive Interleaving
Advanced Review Scheduler
Concept Dependency Graph
More rigorous mastery models
```

## 30. Evaluation

Learner Model 评测不只关心 mastery prediction，还包括：

- 是否减少简单问题的冗余回答。
- 是否在适当时机进入深度教学。
- 是否过度追问或教学不足。
- Feynman 是否暴露真实概念 gap。
- Recall 是否改善后续独立表现。
- Mastery 是否能预测 transfer。
- 是否错误降低高级用户体验。

关键指标：

- **Over-Tutoring Rate**：用户只需短答案，系统却追问、讲背景、画图和安排练习。
- **Under-Tutoring Rate**：用户存在核心误解，系统却只给答案。
- **Feynman Success**：能否独立解释、回答 why、处理反例、发现 gap 和迁移。
- **Long-Term Success**：Delayed Recall、Independent Solving、Near/Far Transfer、Misconception Recurrence 和 Hint Dependence Reduction。

目标是：

```text
Right Help
at Right Depth
at Right Time
```

## 31. 最终原则

1. **The Learner Model models evidence, not identity.**
2. **Mastery must be evidence-based and uncertainty-aware.**
3. **A good tutor becomes shorter when the learner no longer needs the explanation.**
4. **Feynman Mode turns the learner into the teacher.**
5. **Long-Term Learning is not long-term chat memory.**

## 32. 最终 Pipeline

```text
                    Learning Activity
                          │
                          ↓
                     Learning Event
                          │
                          ↓
                   Evidence Extraction
                          │
              ┌───────────┼───────────┐
              ↓           ↓           ↓
          Mastery     Misconception  Retrieval
              │           │           │
              └───────────┼───────────┘
                          ↓
                    Learner Model
                          │
           ┌──────────────┼──────────────┐
           ↓              ↓              ↓
       Mode Choice    Hint Policy    Review Plan
           │              │              │
           └──────────────┼──────────────┘
                          ↓
                   Pedagogy Planner
                          ↓
            Right Help · Right Depth
                     · Right Time
```

> **Learner Model 应根据可靠的学习证据，越来越准确地知道什么时候该讲、讲多少、什么时候该问、什么时候该让用户自己讲，以及什么时候应该什么都不多说。**
