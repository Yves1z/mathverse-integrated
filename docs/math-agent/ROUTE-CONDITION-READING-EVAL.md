# 单条件显式读法确认（2026-10-06）

**后续范围增量**：显式讨论范围与单问题目的/局部停止已接入，见 `ROUTE-CONDITION-RANGE-EVAL.md` 和 `CURRENT_STATE.md`。原始自由说明 RCQ02 样本未改写，其一般语义重复追问仍保持残留失败；显式动作变体单独评测。

## 差距与本步范围

遵循 AGENTS、Constitution、TASK-ROUTING 及 active 00/02/03/05/07/09/10，落实 roadmap 的 RCQ08 增量。原路径只有自由说明和模型 `addressed/needs_input/uncertain`，没有正式读法状态。RCQ08 的“记号像 ≥ 也像 >”仍可能得到“记号已清楚且条件已满足”，虽然带未验证警示，错误肯定仍会展示。区间工具已有 readingUncertain 参数，之前的路线入口没有独立确认事件，不能凭模型或完整字段推断已确认。

本步是既有“选中一个候选条件”的本地确认闭环，不新增 OCR 或通用识别器。它只记录学生已核对当前题干、所选条件、当前引用与说明的**读法**，不判断说明充分、条件为真、方法成立或已掌握。

## 可见流程与状态

1. 比较路线 → 选择一个条件：默认 unconfirmed。说明可保留，选择本身不调用模型。
2. 编辑器显示“我已核对题干、所选条件和当前说明的读法”复选框，以及当前状态。只有明确勾选才确认；也可保留未确认并修改说明。
3. 未确认时提交：只显示一条本地读法 Question 和警示，数学状态 unknown。没有模型请求、数学工具调用、Verification、error_location 或学习状态 patch。“检查并确认读法”只定位复选框，不自动勾选。
4. 用户确认后再次明确提交：继续既有差值/区间核验或未验证模型路径。确认动作本身不自动请求模型。缺范围仍可询问范围，unsupported/overlap 仍 unknown。
5. 修改说明、改选路线/条件、取消、来源/发送范围改变、清空对话均使确认失效。撤销后再次确认产生新 revision；A→B→A 不复活旧确认、反馈或重试。读法状态改变会取消正在运行的核对，迟到结果不能显示。

自然输入“我确认当前条件读法”与“当前条件读法还不确定 / 撤销当前条件读法确认”进入相同确认/撤销函数，只作用于已选中且当前有效的条件，且不自动提交核对。无当前目标时给选择入口。否定、疑问、引用、假设和编号核对请求中的说明片段不是确认命令；自由说明里写“已确认”也不会勾选。其他学习入口和明确完整解答请求保持原路径。

## 领域、上下文与回复边界

`routeConditionReading.js` 不依赖 UI 或 Provider。记录仅有 state、origin、revision、binding：confirmed 的 origin 是 learner_action，默认 unconfirmed 是 context_policy。binding 是当前完整目标、题干、当前选中步骤 ID/原文/选区、修整后的说明的精确序列化；revision 单独严格比较。来源 revision 和 scope 在目标中。记录冻结，进入不可变 Context 前再次校验。缺记录明确生成 unconfirmed；过期、错误来源/字段或与内容不符的记录拒绝。

读法来源文本最多 16000 字，与现有 Context 的总预算协调；说明仍最多 1000 字，binding 最多 20000 字，并完整计入上下文容量，不能为节省预算删除确认门禁。确认范围不能继承数学工具更窄的 6000 字限制：较长原生题干可以被学生核对，但工具超范围仍 unknown，不能标为数学已验证。界面捕获确认建模错误，保留未确认状态和恢复入口。

- Context Engine 负责构造与容量；Context Integrity 在快照复检时验证内容及修订号。
- `reviewRouteCondition` 在任何数学工具执行前返回未确认的 unknown（tool=null）。
- `renderTurnPrompt` 拒绝为未确认条件构造模型 Prompt；UI 对这条本地分支不调用它。
- 本地 Response 生成一个读法问题，来源 context_policy、readingState=unconfirmed；校验不能把它变成已确认或工具证明。
- `composeRouteConditionResponse` 现在要求当前完整 Context，并复核目标。一旦读法未确认，即使直接给它伪造的肯定分析，也只返回本地确认问题。只在已确认的快照下组合正常模型反馈。
- 模型协议仍只有原六字段，不接受 readingConfirmed/readingState/provenance 等确认或证明字段。原文线索匹配不等于确认。内部 binding/用户动作来源字段/地图身份不进入模型 Prompt；只传达本次用户已确认读法、数学尚待核验的界限。

此记录是应用内明确操作的领域状态，不是服务端签名或真实识别质量评价；没有数据库、会话恢复或后端接口变更。

## 成对样本与试错验证

`frontend/evals/route-condition-reading-pairs.json` 是 12 例 / 六组成对**合成**输入：区间成立、候选符号冲突、读法疑问/纠正、缺范围、说明文字不能代替动作、已确认但语法不支持。每组区分无确认事件与模拟明确确认事件；假造模型肯定保留用于绕过测试，不计教师/学生接受。

基线 RCQ08 已在前一步的银行诊断中复现：模型错误肯定进入 Text/Warning。现在默认无确认的 RCQ07/08 都是本地 unknown Question，没有 providerEligible、数学证明或错误定位。原 RCQ03/04 的缺范围问题和 RCQ05/06 的窄符号核验仍保留，测试为这些既有路径增加了明确用户确认动作；原始假造回复未改写。**RCQ02 的多余追问仍是唯一保留的该银行语义失败。** 不把这项门禁修复说成读法理解、OCR 或所有模型语义问题已解决。

试做时补查发现，仅在请求分支加门禁不够：原回复组合函数只接收 analysis/target，不知道读法状态。已改为要求 Context，再用直接注入肯定回复的对照证明未确认时不能绕过。首轮既有测试 31/32 通过，失败是旧测试仅匹配“上下文”错误文字，而新读法绑定更早拒绝了改动的来源；更新为允许明确的读法失效错误后 32/32 通过，没有放宽拒绝行为。

新增 11 个测试组还覆盖：说明/题干/选区/目标/修订号变化、A→B→A、冻结与快照二次检查、伪造 origin/状态/额外模型字段、局部回复目标不符、自然命令的否定/引语/疑问对照、上下文容量及大于数学工具范围的原生题干。

新增浏览器旅程通过实际勾选/撤销而非注入状态，观察：无确认不调用 relay 且没有工具标识；定位动作不确认；确认本身不请求模型；确认后才出现窄核验；说明/目标 A→B→A 失效；unsupported 继续未验证反馈；忽略 AbortSignal 的迟到模型回复仍被读法 revision 拒绝；旧重试不可用；自然确认与撤销、无目标错误、来源关闭→开启、390 像素布局、长原生题干未标数学证明。无 pageerror。

## 实际验证

原目录 frontend：

```powershell
npm test
$env:CHROME_EXECUTABLE='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
node tests/route-condition-reading.browser.test.cjs
node tests/route-condition-sign.browser.test.cjs
node tests/route-condition-interval.browser.test.cjs
node tests/route-condition.browser.test.cjs
node tests/strategy-map.browser.test.cjs
node src/features/ai-assistant/aiAssistant.browser.test.cjs
node tests/teach-back.browser.test.cjs
npm run build
```

**238/238 单元测试、七个浏览器旅程、生产构建通过。** 浏览器使用安装的 Edge；所有 Provider 回复都是模拟，没有真实 API Key/付费模型调用。既有可选画板/图表大分包提示保留。无新依赖或架构原则变化。

真实读法/OCR、数学教师与学生体验、真实触屏和模型教学质量仍待验收。用户可能错误确认，模型也可能在确认后给错误数学意见；本步没有将读法操作当成真实正确率、长期掌握或整条路线证明。刷新后不恢复读法确认或旧数学结果。

## 下一步

围绕 RCQ02 的重复范围追问，先设计显式“讨论范围”补充与问题目的、来源和局部停止约束。学生限定范围与题设范围分开；不能从自由说明里出现一个范围就自动证明方法或假设。用“范围已填写/未填写、仍有另一缺口/无缺口、范围修改后旧问题失效”的成对样本验证，再接入当前单条件流程。
