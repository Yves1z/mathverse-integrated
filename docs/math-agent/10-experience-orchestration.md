---
title: Learning Experience Protocol
version: 0.2
status: active
last_updated: 2026-09-24
depends_on:
  - 00-architecture
  - 01-hint-system
  - 03-response-blocks
  - 05-context-engine
  - 06-learner-model
  - 07-agent-state-machine
related:
  - 04-user-attempt
  - 08-provider-adapter
  - 09-evaluation
---

# Math Agent 子规范 10
# Learning Experience Protocol v0.2

## 0. 目标与边界

本规范规定用户如何发起、理解、纠正和继续一次 Math Agent 交互。它把题目页、解析、草稿、图形与 Agent 面板视为同一数学工作区，并约束每轮反馈、操作、等待、失败恢复和可见状态。

体验层负责把用户操作转换为子规范 07 的 `AgentEvent`，并把子规范 03 的 `AgentResponse` 呈现在当前工作区。正式的数学、提示、学习与会话状态仍分别由 02、01、06、07 的 Domain Service 持有。体验层不另存一套 Hint Level、Mastery 或解题真相。

## 1. 用户旅程

至少覆盖：首次打开题目、从解析选中一步提问、提交草稿、逐级求助、检查错误、要求完整答案、识别纸质草稿、工具或 Provider 失败、取消长任务、跨页或刷新后恢复、切换模式与模型。

每个旅程应回答：当前焦点是什么、用户允许多少帮助、系统正在做什么、该由谁做下一步、失败时如何继续。能直接回答的明确请求不应被无价值的确认打断。

## 2. Learning Episode：会话的用户可见视图

一个 Session 可跨多个用户目标；一个 Run 只执行一轮。`LearningEpisodeView` 表示当前题目内的一个学习目标，例如“检查第 3 步”或“理解为什么使用分类讨论”。它由已验证的 `AgentSession`、`HintState`、当前 `UserAttempt`、`ContextTarget` 与最近的 `TeachingPlan` 派生，用于展示和恢复；不能作为并行的权威状态。

```ts
interface LearningEpisodeView {
  episodeId: string;
  sessionId: string;
  problemId: string;
  goal: string;
  focus?: ContextTarget;
  status: "working" | "waiting_for_user" | "paused" | "completed" | "failed";
  mode: LearningMode;
  helpLevel?: HelpLevel;
  currentFrontier?: AttemptFrontier;
  currentBlocker?: BlockerType;
  expectedNextActor: "user" | "agent" | "tool" | "none";
  expectedNextAction?: string;
}
```

`episodeId` 关联同一目标的交互和评测；目标改变时可创建新 episode。恢复时从正式 Domain State 重新计算视图，不从旧页面缓存恢复 Hint State。旧题的 Hint Level 不跨题继承。

## 3. 交互契约：目标、帮助边界与节奏

在现有 `ResolvedIntent.primary` 之上记录用户明确提出的约束，使用子规范 07 定义的 `InteractionConstraints`，不另建与其竞争的 Intent 分类器。

例：“检查我这一步，但先别告诉我后面怎么做”对应 `primary = verify`、明确的 `attempt_step` target、`requestedHelp = check_only`、`forbidFutureSteps = true`。这些约束进入 `TeachingPlan` 和 `ResponseGuard`，不能仅写入 Prompt。

约束优先级：本轮明确用户表达与 UI action > 当前 Session/Problem 设置 > 长期偏好 > Auto 推断。明确要求完整答案时，遵守宪法中的用户揭示控制；不得因默认 Tutor 模式重复要求确认。

## 4. 焦点显示与纠正

有明确 selection、attempt step 或 UI target 时，页面应显示简短的焦点标识，例如“正在检查：草稿第 3 步”。用户可取消绑定、改选其他步骤或说“我指上一行”。纠正事件携带新的 `ContextTarget` 和最新 `attemptVersion`，经 Context Engine 重建上下文并使旧结果失效。

焦点标识展示已确认的目标，不暴露 token budget、内部排名或无关 Learner Model。只有多个合理候选同时存在、且误选可能改变数学结论或揭示内容时，才请求一次最小澄清。

## 5. 可见状态与用户控制

可见状态应让用户理解当前目标、模式、已揭示的帮助、系统正在做的事和下一步归谁。简短示例：

```text
正在检查你的第 3 步 · 逐步提示 · 已看到 1 条提示
下一步：请尝试补充遗漏的分支
```

仅在相关时显示；简单直接问答不需要常驻仪表盘。可提供“改焦点”“改为直接回答”“暂停”“取消”“不记录长期学习”等操作。用户看到的提示次数来自已提交的 reveal event，而非生成次数。学习状态采用可解释标签，不显示虚假精度分数。

用户可以撤销偏好、关闭长期学习或纠正当前焦点。已经实际展示的关键提示或完整解答不能从 `revealedInformation` 中撤销；隐藏 UI 不等于用户未见过。清除数据的具体范围必须与删除学习记录、重置当前题状态区分。

## 6. 模式发现与作用域

默认入口使用用户任务语言，例如“陪我一步步做”和“直接帮我解决”。Feynman 与 Recall 可通过“检验我是否真正理解”“帮我回忆这个概念”等操作进入。底层仍使用子规范 06 的 `auto / tutor / feynman / recall / direct`。

一次性表达默认 `ModeScope = turn`，不得无提示地变成长期开关。用户明确指定“这道题都这样”可设为 `problem`；长期设置必须有可见入口。模式切换保留题目、草稿和已揭示内容，并清除不适用的 expected input。

## 7. 回合呈现与主操作

子规范 03 的 `AgentResponse` 保留为内容协议；体验层为每轮呈现增加 `InteractionEnvelope`：

```ts
interface InteractionEnvelope {
  response: AgentResponse;
  episode: LearningEpisodeView;
  primaryAction?: SuggestedAction;
  secondaryActions?: SuggestedAction[];
  expectedUserAction?: string;
  status?: UserVisibleStatus;
  recoveryActions?: SuggestedAction[];
}

type UserVisibleStatus =
  | { state: "received" | "working" | "waiting"; message: string }
  | { state: "failed"; message: string };
```

普通 Tutor 回合通常只有一个视觉上突出的下一步操作，例如“修改这一步”。“再提示一点”“换思路”“看完整答案”仍可访问，但不同时争夺主位置。Direct 回合可以没有 primary action。操作必须携带 target、session 和必要的版本信息，不能只把标签文本送给 LLM 猜。

问题应说明提问目的并限制为一个主要认知动作。系统若暂停提供提示以等待用户尝试，应解释原因，并仍保留用户明确索取更多帮助或答案的路径；不能用教学策略把用户困在循环里。

## 8. 可信度与来源

重要数学结论按已验证、基于题目条件推导、来自官方解析、模型判断、尚不确定等来源显示。普通视图用简短标识；展开后可看到验证对象、假设、工具来源和限制。标记“已验证”必须存在相应 `ToolResult` 与适用条件；不能把模型自信语气当作验证。

低置信度手写识别应先让用户确认系统读到的关键表达，再进行数学错误判断。识别不确定与数学正确性分开显示。来源展示不得泄露隐藏推理、未授权解答或私密上下文。

## 8.1 拍照批改的能力预检

用户选择照片后、提交给 Provider 前，应依据当前 `ModelIdentity` 的已知能力明确显示：该模型是否能直接读取图片；若不能，当前可用的识别服务、需要的授权与可能的数据接收方；若能力未知，不能承诺“已识图”。用户可改用文字输入、选择有视觉能力的模型，或明确授权独立识别服务。不得静默跨 Provider 转发照片，也不得把上传成功等同于完成识别。

识别结果应先展示关键数学表达与不确定区域，允许学生校正，再进入步骤批改。批改必须区分“图片读不清”“识别结果待确认”“数学判断未验证”“已由工具验证”；仅凭模型描述不能把学生的笔迹判成数学错误。识别与批改失败时应保留原始草稿及已确认的转写，给出可执行的继续路径。

## 8.2 坦诚且支持性的纠错反馈

当学生出现数学错误时，先清楚指出**具体位置、依据及影响**，再给一项可执行的修正动作。对可取的步骤或独立进展可以简短肯定，但不能为了鼓励而把错误说成正确，也不应使用空泛赞美、羞辱或居高临下的语气。用户明确要求“直接指出问题”时，应减少铺垫；用户表达挫败或焦虑时，可简短承认其感受，再回到可解决的数学任务，不以此推断人格、能力上限或心理诊断。

语气、解释深度和鼓励频率可由用户选择，并受本轮明确意图覆盖。系统只保存与学习有关且经证据支持的偏好或数学学习事件，不长期记录猜测的情绪标签。心理支持不能替代数学验证，也不能阻止学生要求完整答案。

## 9. 反馈、等待与取消

用户提交操作后及时确认已收到；耗时任务使用与用户任务对应的状态，例如“正在检查这一步的等价变形”。若处理持续，应显示仍在运行、是否可取消和已完成的安全部分。具体时间阈值由实际设备与线上测量制定，不在规范中硬编码毫秒数。

取消停止当前 `AgentRun` 的可停止工作，不删除 Session、Attempt 或已提交的 reveal。重试使用 idempotency key；迟到结果必须通过 context snapshot 和 attempt version 检查。页面刷新或跨页后从 checkpoint 恢复用户目标和下一步，不展示 Provider 内部节点名。

## 10. 失败时必须有下一条路

每个可预期失败状态应有可执行出口：

| 情况 | 对用户的说明 | 可用操作 |
|---|---|---|
| 草稿识别不清 | 指明不确定区域和读法 | 修改识别、手动输入、重试 |
| 数学验证未完成 | 明确“未验证”，不伪造正确性 | 重试、查看条件、继续人工讨论 |
| 关键工具超时 | 保留当前草稿与状态 | 取消、重试、使用较简单方法 |
| 模型缺少图片能力 | 说明当前模型无法直接读图 | 经授权使用识别服务、文字输入、换模型 |
| Context 指向错误 | 显示当前焦点 | 改焦点并重算 |
| Provider/BYOK 错误 | 给出可理解原因 | 检查配置、重试或选择获授权模型 |

Fallback 不得静默改变 Provider 隐私边界，也不得把未验证结果包装成已验证结果。

## 11. 个性化的可解释性

系统可根据偏好与近期学习证据调整回答深度，但只在调整明显或用户询问时简要说明，例如“我先给一条短提示，你可以让我展开”。不得在普通回合展示内部 mastery 分数、人格标签或未经证实的能力判断。

“不记录这次长期学习”只影响经子规范 06 管理的长期 evidence/persistence，不应删除完成当前回合所需的临时 Session State。用户需要能查看、修正和清理长期学习信息。

## 12. 体验评测

体验质量需结合子规范 09 的数学与学习效果判断。建议按完整旅程测试：

- 用户是否能定位并纠正 Agent 当前焦点；
- 从提示到用户新尝试的转换；
- 无意义澄清、重复追问与死路回复的比例；
- 首次有用反馈时间、取消成功和恢复成功；
- 帮助强度、模式与长期记录的可控感；
- 验证标识、识别置信度与真实可靠性的校准。

所有事件采集遵守数据最小化；默认不上传完整草稿、图片和聊天文本作为 UX 评测数据。即时满意度不能替代独立学习进展。

## 13. MVP 与实施顺序

首版先实现：明确的目标焦点、帮助约束、单一主操作、可见等待/取消、可恢复错误、模式单轮覆盖、提示揭示同步，以及最小旅程评测。`LearningEpisodeView` 可先由现有 Session/Run 派生，不要求新数据库表。

之后再扩展跨页 episode 历史、细粒度来源面板、自动个性化解释和复杂模式导航。具体 UI 布局应依据真实用户测试迭代，本规范固定语义与交互边界，不固定视觉样式。
