---
title: Math Agent Architecture
version: 0.3
status: active
last_updated: 2026-09-23
depends_on: []
related:
  - 01-hint-system
  - 02-math-toolbox
  - 03-response-blocks
  - 04-user-attempt
  - 10-experience-orchestration
---

# Math Agent 总体设计与实施指南

## 1. Product Goal

将现有能力从 `AI Chat → Math Copilot → Math Agent`。Agent 不只回答孤立问题，而要理解用户正在看哪道题、哪一步解析、尝试了什么、卡在哪里，并决定此刻应该提示、解释、提问、验证、画图、比较方法，还是安排练习。

最终形态不是“网站 + AI”，而是网站本身具有上下文感知的数学学习能力。

## 2. Core Architecture

```text
User / Page Interaction
        ↓
Experience Input (focus / help constraints / actions)
        ↓
Context Engine ───── Learner Model
        ↓                  ↓
Session Learning State / Pedagogy Planner
        ↓
Agent Orchestrator
        ├── Reasoning Provider
        ├── Math Toolbox
        ├── Visualization Engine
        ├── Similar Problems
        └── Knowledge / Retrieval
        ↓
Presentation Planner / Response Guard
        ↓
Structured Response Blocks
        ↓
Experience Presentation (episode / next action / recovery)
        ↓
UI
```

- **Context Engine**：确定当前讨论对象并选择最小必要上下文。
- **Learning Experience Layer**：在输入侧传递焦点、帮助约束与操作；在输出侧呈现当前目标、下一步与恢复路径。正式学习状态仍由 Domain Service 持有。
- **Learner Model**：维护可审查的长期偏好与基于证据的掌握状态。
- **Pedagogy Planner**：先决定如何教，再决定说什么。
- **Agent Orchestrator**：执行多步模型与工具调用。
- **Math Toolbox**：提供受控的分析、计算、验证、证明、可视化与学习工具。
- **Presentation Planner**：选择最适合的响应块与交互。

## 3. Help Model

统一支持以下意图：

```text
Hint / Next Step / Diagnose / Strategy / Explain / Verify / Explore / Solution
```

默认使用分层提示和 Minimum Useful Help。完整答案是受控的 reveal 行为，但用户明确要求时必须允许。

## 4. Page Context

答案解析的逻辑步骤应有稳定 ID。选中文本后至少形成：

```ts
interface SolutionSelectionContext {
  problemId: string;
  solutionId?: string;
  stepId: string;
  selectedText: string;
  paragraphText?: string;
  previousSteps?: string[];
  nextStep?: string;
  selectionStart?: number;
  selectionEnd?: number;
}
```

Floating Toolbar 第一版支持：解释这一步、解释动机、展开推导、检查严谨性、画图解释、问 AI。所有入口映射到统一 Agent Intent，而非六套 API。

## 5. User Attempt

LaTeX、普通文本、站内笔迹、上传图片与图形草稿统一建模为 `UserAttempt`。分析目标是理解路线、确定当前 frontier、定位第一个实质性障碍并沿可行路线继续，而不是立即重写成标准答案。

## 6. Math and Visualization

LLM 不承担确定性计算，也不直接生成可执行绘图代码。

```text
LLM → validated Math Tool schema → controlled executor → structured result
LLM → Math Scene DSL → Visualization Engine → interactive component
```

第一批视觉场景优先覆盖函数、割线到切线、圆锥曲线、积分面积、向量和线性变换。动态参数、标注和播放行为均由受控 DSL 描述。

## 7. Strategy Map

Strategy Map 展示经整理的解题空间：候选方法、适用条件、失败原因、所选路线和验证节点。它不是模型隐藏思维链的逐 token 展示。

当存在多个候选方法、方法选择困难、长推导、分情况、常见死路或用户询问“为什么想到”时，Presentation Planner 可自动选择该组件；简单题不应滥用。

## 8. Context and Cost

不要每轮发送整页、全部历史和所有工具。先进行 Intent Routing，再选择必要上下文、工具和 reasoning 级别。可维护 `ProblemContextId`、`SolutionContextId`、`SelectedStepId`，按需扩展上下文窗口。

## 9. Preferences and Learning State

分开保存：

```text
长期 Learner Profile
+ 当前 Session Preference
+ 当前 Problem Requirement
+ 当前 User Intent
```

自然语言和设置 UI 都可更新偏好，但长期变化应明确、可见、可撤销。Reasoning Depth 与 Answer Detail 必须分离。

## 10. Provider Adapter

产品使用统一能力抽象：tool calling、vision、structured output、reasoning 和 streaming。Provider Adapter 将平台级 `fast / standard / deep / max / auto` 转译到具体模型支持的参数；不支持的等级降级到最近能力。

## 11. Agent State

Agent 不应一轮包办所有工作。典型循环：

```text
understand → diagnose → choose pedagogy → select tools → execute
→ validate → compose blocks → await learner → update state
```

Agent 可以在关键信息缺失时提出一个教学上有价值的问题。状态更新必须显式，避免重复回答或无意泄露后续答案。

## 12. Similar Problems

推荐不只按表面相似度。目标分三类：修复前置缺口、巩固当前结构、促进迁移。提示暴露程度与独立完成情况影响 mastery evidence 和练习选择。

## 13. Privacy and Safety

- API key 不进入日志、分析或错误报告。
- 手写原图和笔迹按数据最小化原则保存。
- 不用草稿推断无关人格特征。
- 任意模型生成代码不得直接执行。
- 识别置信度与数学正确性置信度必须分离。

## 14. Delivery Sequence

实现按可见用户行为逐层推进，而不是按后台架构的理论完整度推进：

```text
Phase 1  UI 骨架
         基础按钮、焦点、输入区、响应区、加载、空态、错误与取消
           ↓
Phase 2  最小功能闭环
         按钮映射统一 Intent，并携带当前题目、选中步骤或草稿完成真实请求
           ↓
Phase 3  教学策略
         分级提示、路线保留、第一处障碍、费曼与苏格拉底式追问
           ↓
Phase 4  完善 Context Engine
         在真实交互需求驱动下补齐检索、压缩、完整性、持久化与服务端边界
           ↓
Phase 5  长期学习 Agent
         Learner Model、长期证据、复习、迁移与主动学习编排
```

当前阶段以 Phase 1 为最高优先级。Phase 1 的目标不是展示不可用的功能，而是先固定用户可理解、可操作、可恢复的产品骨架；随后用 Phase 2 逐个接通真实能力。

未来能力尚无对应 UI 用户行为入口时，只维护必要的规范、领域接口和 TODO，不提前完整工程化。已经实现的 Context Engine、Hint State、Response Blocks、草稿诊断和安全边界继续保留并用于现有流程，不回滚；除修复正确性、安全性或支撑已存在 UI 闭环外，暂停 Context Engine 的深度扩张，直到 Phase 1–3 的真实需求提出明确约束。

第一批应验证的可见闭环是：用户通过明确按钮选择“提示 / 检查 / 解释 / 完整解答”等行为 → 看见当前焦点和运行状态 → 获得与行为一致的响应 → 可以继续、重试、取消或切换行为。

## 15. Architectural Boundaries

```text
Math logic ≠ UI
LLM ≠ Math engine
LLM ≠ Visualization engine
Provider ≠ Agent
Agent ≠ Learner Profile
Chat history ≠ Source of Truth
```

每项新功能都应回答：它需要什么上下文、属于哪个 Agent Intent、调用什么受控工具、输出什么 Response Block、怎样改变学习状态。

## 16. Experience Contract

每轮交互还必须明确：用户当前的数学目标与焦点、允许的帮助强度、此轮结束后由谁继续、用户怎样纠正焦点或取消。`LearningEpisodeView` 是从 Session、Hint State、Attempt 和 Teaching Plan 派生的用户可见视图，不另建平行的数学状态或提示状态。Response Blocks 与可见操作遵守子规范 10。

首版先验证“选中一步 → 得到针对性反馈 → 继续尝试”“提交草稿 → 看懂第一处问题 → 修改”“请求答案 → 获得答案”“错误/超时 → 可继续”“刷新后恢复”这五条真实旅程，再扩展复杂自动路由。
