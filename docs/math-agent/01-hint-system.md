---
title: Hint System Protocol
version: 0.2
status: active
last_updated: 2026-09-22
depends_on:
  - 00-architecture
related:
  - 03-response-blocks
  - 04-user-attempt
  - 05-context-engine
  - 10-experience-orchestration
---

# Hint System Protocol

## 1. Purpose

Hint System 控制帮助的时机、类型和信息量。目标不是把完整答案切成几段，而是为当前 blocker 生成最小有效帮助，并保留用户的独立推理空间。

## 2. Core Principles

1. 先诊断 blocker，再生成 hint。
2. 优先沿用户当前可行路线。
3. 每次只推进一个合理步幅。
4. 已揭示的信息不可假装未揭示。
5. 用户明确要求答案时允许 reveal solution。
6. UI action 与自然语言意图完全等价。

## 3. Hint Ladder

| Level | Name | Purpose |
|---|---|---|
| 0 | Nudge | 指出关注对象，不透露方法 |
| 1 | Observation | 提醒一个结构、性质或异常 |
| 2 | Direction | 指向方法、定理或表示方式 |
| 3 | Key Move | 揭示关键变换或中间目标 |
| 4 | Guided Step | 给出可执行步骤并让用户完成局部推理 |
| 5 | Solution | 展示完整解答与验证 |

Ladder 不是固定点击次数。Agent 可根据 blocker、已知状态和 reveal budget 跳级或停留，但不能无记录地降低已揭示等级。

## 4. Minimum Useful Hint

候选提示应按以下顺序选择：是否与当前 blocker 相关；是否足够让用户产生下一步；是否泄露了不必要的后续信息；是否保留用户路线；是否符合其请求的帮助强度。

## 5. Hint State

```ts
interface HintState {
  problemId: string;
  routeId?: string;
  currentLevel: 0 | 1 | 2 | 3 | 4 | 5;
  revealedConcepts: string[];
  revealedMoves: string[];
  revealedSteps: string[];
  revealBudget: number;
  blocker?: Blocker;
  events: HintEvent[];
}

interface HintEvent {
  id: string;
  action: "request_hint" | "request_more" | "diagnose" | "switch_route" | "reveal_solution";
  levelBefore: number;
  levelAfter: number;
  timestamp: string;
}
```

## 6. Blocker Taxonomy

```text
no_entry             不知道从哪里开始
concept_gap          缺少定义、定理或前置知识
method_selection     不知道选哪条路线
method_execution     知道方法但无法推进
algebra_error        计算或符号操作错误
logical_gap          推理缺少条件或论证
dead_end             当前路线无法继续
```

诊断“为什么做不下去”时进一步区分：

```text
invalid
valid_but_inefficient
valid_but_missing_tool
user_execution_error
not_actually_stuck
```

响应应说明当前路线状态和第一个关键障碍，再给与之匹配的最小提示。

## 7. Switching Routes

切换路线前先判断原路线是否无效、代价显著过高、缺少当前不可获得的工具，或用户明确要求。若仍可行，先解释如何继续；若切换，说明切换原因并保留原路线记录。

## 8. Reveal Budget

Reveal Budget 是信息暴露控制，不等同于字数。以下内容消耗较高预算：关键代换、核心定理、决定性构造、完整中间式和最终结论。系统应按语义记录已暴露内容，而非仅靠 prompt 自律。

## 9. Generation Input

```ts
interface HintRequest {
  problemContext: unknown;
  attempt?: unknown;
  currentFrontier?: unknown;
  hintState: HintState;
  requestedAction: string;
  learnerPreference?: unknown;
  candidateRoutes?: unknown[];
}
```

## 10. Output

```ts
interface HintDecision {
  blocker: Blocker;
  routeStatus: string;
  targetLevel: number;
  pedagogicalGoal: string;
  hintBlock: unknown;
  suggestedActions: string[];
  statePatch: Partial<HintState>;
}
```

面向用户的 HintBlock 不应暴露 hidden solution graph、内部评分或未使用路线的完整答案。

## 11. Hidden Solution Graph

Agent 内部可以维护多路线解题图用于判断当前位置、依赖与泄露风险，但不能把标准解答机械裁剪成提示。提示应从当前 learner frontier 和 blocker 出发重新生成。

## 12. UI

第一层快捷操作：

```text
给我一个提示 / 再提示一点 / 只告诉我下一步 / 为什么做不下去 / 是否该换思路 / 看完整解答
```

按钮根据状态动态变化。自然语言表达必须归一到相同 intent 与状态迁移。

## 13. Quality Evaluation

优质提示应满足：相关、足够、不过度、可执行、路线一致、数学正确，并让用户产生新的独立行为。不能只用“答案正确率”评价；还要追踪下一步是否由用户独立完成和 reveal 后依赖程度。

## 14. MVP

第一阶段实现 `HintState`、0–5 级 Ladder、核心 blocker 分类、Reveal tracking、结构化 HintBlock、自然语言/按钮统一意图，以及显式 Solution reveal。

## 15. Hint 体验约束

用户可看到本题已经展示的提示程度，以及“再提示一点”“先试一下”“看完整答案”等下一步选择。多次请求提示但没有新尝试时，系统可建议先执行一个具体动作，并说明为什么这有助于判断下一条提示；不能把该建议做成无法绕过的门槛。明确要求更强提示或完整答案时仍遵循用户意图与 Reveal Policy。

重复点击不能机械升级 `currentLevel`，也不能连续输出同义提示。用户已看到的关键 move 保留在 `revealedInformation` 中；关闭提示卡片、切换模式或重新打开页面都不能把它恢复为“未揭示”。
