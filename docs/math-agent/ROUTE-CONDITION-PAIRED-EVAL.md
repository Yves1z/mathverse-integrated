# 单条件核对成对失败库与差值符号修复（2026-10-06）

**后续范围增量**：显式讨论范围与单问题目的/局部停止已接入，见 `ROUTE-CONDITION-RANGE-EVAL.md` 和 `CURRENT_STATE.md`。原始自由说明 RCQ02 样本未改写，其一般语义重复追问仍保持残留失败；显式动作变体单独评测。

**后续状态**：本文记录差值修复时的基线与结果。其后的区间增量已截住 RCQ03/04 的模型反馈，仍保持数学 unknown；后续读法门禁也已截住无用户确认的 RCQ07/08，当前仍保留 RCQ02 的多余追问。更新后的观察见 `INTERVAL-CONDITION-EVAL.md`、`ROUTE-CONDITION-READING-EVAL.md` 和 `CURRENT_STATE.md`，原始失败回复保留。

## 目标、差距和样本来源

按 roadmap 和 00/02/03/05/07/09/10，先复现当前单条件反馈的具体失败，再选择可以在明确假设下可靠证明的窄类型。

原代码已限制路线/条件回显、上下文和问题数量，但 `addressed` 的数学真实性由模型给出。即使当前题设为 `a>b`，模型肯定所选 AI 条件 `a-b<0` 仍会成为正常 Text，并附未验证警示。警示没有阻止这个已可确定反驳的断言。

样本：`frontend/evals/route-condition-pairs.json`，8 例、4 对，标明 `agent_authored_synthetic_not_live_or_teacher_accepted`。测试：`frontend/src/features/ai-assistant/routeConditionPairedEval.test.js`。数据是本轮构造的题设、条件、学生说明及模型回复；质量标签为样本设计判断，没有教师、学生或真实模型评审。

## 基线、修复和剩余失败

每例经过真实路线 map 解析、当前范围/来源绑定、不可变 Context、Prompt、模型输出解析及 Response Blocks。诊断记录发送资格、局部工具状态、块类型、是否追问、模拟断言是否展示和剩余合成失败。

| ID | 对照条件/模拟回复 | 基线实际观察 | 修复后实际观察 |
|---|---|---|---|
| RCQ01 | 学生已说明只讨论非负区间，模型 addressed | Text + Warning，无追问 | unknown，保留同一未验证路径 |
| RCQ02 | 与 RCQ01 同材料，模型再次问讨论哪个区间 | 重复问题展示，语义失败 | **仍未解决**，unknown + 一个问题 |
| RCQ03 | 未给讨论区间，模型要求补充 | 一个问题 + 未验证警示 | unknown，保持这一模拟谨慎路径 |
| RCQ04 | 与 RCQ03 同材料，模型声称非负条件已成立 | 错误肯定展示 | **仍未解决**，unknown + 未验证 Text |
| RCQ05 | 已知 a>b，AI 条件 a-b<0，模型 addressed | 错误肯定展示，测试失败 | invalid，局部符号核验 + 范围警示，不进入模型 |
| RCQ06 | 与 RCQ05 同题设，AI 条件 a-b>0 | 基线组在 RCQ05 失败后未执行到 | valid，局部符号核验 + 范围警示，不再追问或进入模型 |
| RCQ07 | 记号读法未确认，模型 uncertain | 一个读法问题，无数学错误标签 | unknown，保留同一模拟谨慎路径 |
| RCQ08 | 与 RCQ07 同材料，模型声称读法清楚且满足 | 错误确认展示 | **仍未解决**，unknown + 未验证 Text |

基线 4 组有 3 组通过边界/记录断言、1 组失败；这不意味着前三组教学质量合格。RCQ02/04/08 在基线与修复后始终明确记录为语义失败。修复后 8 例的工具结果为 **1 invalid、1 valid、6 unknown**；未知条件仍不能依据模型状态自动当作已证明。

## 有限修复与用户动作

复用已有 `verify_ordered_difference_sign` v1。没有扩展该工具的数学范围或文本语法：只接受明确严格大小关系题设及一个受支持的差值正/负/零声明；后续分支/其他关系、复合语句、非严格关系、未知字符等仍 unknown。

`routeConditionReview.js` 先检查当前 Context 完整性，再用 **当前题干 + 所选 AI 条件原文** 调用工具。学生说明、选中解析中的断言和其他候选不被充当新的题设。纯符号成立也只核验这条候选条件，学生说明仍待判断。

`composeRouteConditionReviewResponse(context)` 从验证过的快照重新计算证据，生成带路线 ID、条件类型/原文、题目/地图/快照 ID、检查命题、题设假设、预期符号及工具版本/范围的 Verification 块。来源是 math_tool。共享回复校验要求新局部核验块带这些条件字段；模型协议仍拒绝额外 verified 字段。

界面路径保持 **比较路线 → 选择条件 → 明确提交**：

- invalid：说明“AI 候选条件…与题设…冲突”，给出仅此差值的正确符号，可点“重新比较当前路线”或另选现有候选；不把它标成学生草稿错误。
- valid：在明确题设下显示该差值符号成立，局部结束，没有模型调用或多余问题。
- unknown：沿用原结构化 AI 反馈与未经验证标识，仍可补充、重试、取消。

方法适用性、前提必要/充分、整条路线和学生独立掌握均不由这个结果判定。候选卡与学生说明不被覆盖，不自动换方法。反馈继续绑定原选择与单调 revision，编辑/改选/发送范围变化使旧核验和操作过期。没有新的揭示事件、HintState 或 mastery patch。

## 对照边界与页面验证

新增测试还覆盖 12 类不支持/分支文本、变量改名、明确等价字形、学生说明与所选 AI 条件分离、错误 intent、额外模型证明字段，以及被删去条件的 Verification 块。它们经过相同 Context/Response 边界；unknown 不能被工具误判 valid/invalid。

新 `frontend/tests/route-condition-sign.browser.test.cjs` 中，模拟服务预设会错误肯定差值条件；实际页面在 invalid/valid 检查时均没有 relay 请求，因而该错误回复不会展示。页面验证：明确冲突来源、仅差值标识、局部结束、原说明与三个候选保持、旧证明/动作过期、unknown 读法仍发允许范围内的请求、显式重新比较后改选纠正条件、自然语言进入同一工具路径、关闭发送→重新开启后的过期，以及 390 像素布局。无 pageerror。

在原目录 frontend 执行：

```powershell
node --test src/features/ai-assistant/routeConditionPairedEval.test.js
npm test
$env:CHROME_EXECUTABLE='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
node tests/route-condition-sign.browser.test.cjs
node tests/route-condition.browser.test.cjs
node tests/strategy-map.browser.test.cjs
node src/features/ai-assistant/aiAssistant.browser.test.cjs
node tests/teach-back.browser.test.cjs
npm run build
```

结果：**212/212 单元测试、五个浏览器旅程与生产构建通过**。6 个新增测试组包括四组成对观察和两组边界。既有可选画板/图表大分包提示保留。没有新依赖、后端接口、持久化格式或架构原则变更。

## 未验收与下一步

单元诊断中的 providerEligible 只是发送资格；页面调用计数来自实际模拟 relay。均不代表真实 Provider、OCR 或教师/学生验收。狭窄差值推断为确定性数学结论；其他路线条件、问题价值、读法真实性及独立学习进展尚未验证。测试通过不能把 RCQ02/04/08 的语义失败算作通过。

下一步以 RCQ04 为起点设计有界单变量区间证据核对，先明确题设范围、声明范围、开闭端点和误报/漏报对照；有据推出/确证冲突与缺少材料分开。读法不明、分支与没有区间证据继续 unknown，不能把“缺少依据”判为数学错误。冗余问题和读法确认继续单独评测。
