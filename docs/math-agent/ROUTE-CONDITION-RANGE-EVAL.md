# 显式讨论范围、单问题目的与局部停止（2026-10-06）

## 规范与代码差距

按 AGENTS、Constitution、TASK-ROUTING 及 active 00/02/03/05/07/09/10，落实 NEXT_ROADMAP 的 RCQ02 增量。原入口只有自由说明；“我只讨论 x≥0”没有独立来源或正式已提供状态，模型仍可问“你讨论什么区间”。本步复用已有区间解析语法与路线/读法修订保护，不把自由说明抽成题设，不增加数学证明能力。

## 可见最小闭环

1. 比较路线 → 选择一个条件 → 填写“本次讨论范围（选填）”，最多 160 字。可写 `x≥0`、`x∈[0,2]` 或支持的单变量明确区间；复杂并集、符号端点、空/倒序区间及混合叙述保持 unsupported。
2. 范围输入独立标明是学生选择；修改后读法确认撤销。确认再明确提交，没有自动发送。自然命令“本次讨论范围：x≥0”更新同一输入框，不确认也不提交；无当前目标时给恢复入口。
3. confirmed + unsupported：本地 unknown，保留原输入，仅问一个读法问题并定位范围框；不调用模型或数学工具，不判数学错。默认未确认时仍先走既有读法门禁。
4. 有支持的范围、数学工具仍 unknown 时，发送原生题干与独立范围数据。模型问同变量范围则隐藏本次反馈和重复问题，只显示 `range_recorded` 与未验证警示；只结束范围补充，不宣称所选条件 addressed 或路线充分。该判断发生在模拟/真实模型回复之后，不能算零 Provider 调用。
5. 仍缺比较理由等其他材料时，只保留一个带目的和精确来源的问题。合法 addressed 无追问，仍是模型未验证反馈。
6. 范围编辑、取消、改选路线/条件、来源变化和 A→B→A 使旧确认、反馈、操作及迟到回复过期。取消/换目标清空该目标的范围；已有自由说明仍保留。范围及确认不持久化，不增加学习状态 patch。

## 数据与回复契约

`routeConditionDiscussionRange` 为 null，或仅有 `origin: learner_scope`、raw、state、variable、canonical。canonical 只是区间语法规范化，不是数学成立证据；它与原生 problem.statement 分开，包含在读法 binding 与 Context 容量检查中。来源或规范化结果伪造在完整性检查处拒绝。

显式范围路径的回复仍有原六字段，并严格新增 `probe`：addressed 时为 null，否则仅有 kind、variable、source、sourceQuote、purpose。kind 是 discussion_range / condition_reasoning / reading；仅 discussion_range 必须指定一个英文字母变量，其他为 null。source 可为当前 condition、problem、selection、note、discussion_range；sourceQuote 从命名来源逐字引用 1–80 字。purpose 是 120 字内的一个目的，不能另问问题；反馈不另问，nextQuestion 最多一个问号。未知字段、伪造来源、缺目的和错引被拒绝，说明与范围保留可重试。

同变量 discussion_range 目的在已填范围后局部停止；另一变量仍可保留一个来源匹配的问题。少量完整直接改写（包括 RCQ02 的“你讨论什么区间”）在目的被错标时也停止。此有限文字守卫不理解任意隐含问题；purpose/问题语义不一致、单问号中的多任务及复杂引用仍可能误报或漏报。题目/AI 条件的原文匹配只证明来源，不证明问题值得问。

**兼容边界**：未填写独立范围时维持既有六字段协议；不自动从自由说明提取范围。因此原始 RCQ02 的自由说明样本仍是残留失败。原始 `route-condition-pairs.json` 与诊断未改写；RCD02 是增加显式用户动作后的对应闭环，不把原样本统计为已修复。未填范围路径的目的/来源协议统一留到下一增量。

题设工具仍只读取原生题干。学生选 `x≥0` 不能覆盖题设 `x<0`，学生选 `x<0` 也不会改变工具对原题 `x≥0` 的包含核对。任何 Verification 的 assumptions 仍来自题设；本步没有将学生范围拼成“已知”或新增验证工具。

## 成对样本与复查

样本库 `frontend/evals/route-condition-range-pairs.json` 为 16 个合成案例，8 组：显式范围有/无、局部停止/仍有理由缺口、同/不同变量、两种原题与学生范围对照、unsupported/支持语法、错误目的标签/合法理由、自由说明/独立字段、题设范围缺失/显式学生范围。通过真实 map、target、读法、Context、Prompt 和回复块；模拟数学验收为 false。

结果为 6 个 range_recorded、5 个保留一个问题、1 个模型 addressed、1 个题设工具 valid、1 个 invalid、1 个 unsupported 范围读法问题、1 个缺题设范围问题。13 个新增测试组另覆盖来源伪造、格式、读法 binding、预算、编辑/A→B→A 失效、明显答案隐藏、绕过 Provider 路由时 unsupported 仍不能被肯定。

代码复查修正三处边界：unsupported 范围在回复组合处再次走本地门禁，避免伪造 addressed 绕过 UI 路由；新路径直接声明七个字段，消除“仅六字段”与追加 probe 的提示歧义。新回复标明 range_scoped_v1，在回复块校验阶段也不能删掉问题目的/来源而退回旧协议。范围完整性校验比较字段值，不依赖 JSON 键顺序。

页面旅程实际填写范围、确认与提交，检查调用数、重复问题隐藏、一个带来源的理由问题、输入保留/修正、自然命令、错误来源恢复、取消/换源、A→B→A 的迟到结果和旧重试、390px 布局，以及原题冲突不会被学生范围覆盖。全部 Provider 响应模拟，无真实模型或教师/学生验收。

## 验证命令与实际结果

在原目录 frontend 执行 `npm test`：**251/251**；`npm run build` 通过。安装 Edge 配合 CHROME_EXECUTABLE 跑以下 **8 个浏览器旅程**通过：

- tests/route-condition-range.browser.test.cjs
- tests/route-condition-reading.browser.test.cjs
- tests/route-condition-sign.browser.test.cjs
- tests/route-condition-interval.browser.test.cjs
- tests/route-condition.browser.test.cjs
- tests/strategy-map.browser.test.cjs
- src/features/ai-assistant/aiAssistant.browser.test.cjs
- tests/teach-back.browser.test.cjs

无新增依赖、后端接口、持久化格式或架构原则修改；既有可选画板/图表大分包保持。真实 Provider、范围选择是否合理、一般数学条件充分性、OCR 与真实触屏教学效果均待验收。

## 下一选定增量

先将单问题目的/命名来源契约覆盖未填独立范围的现有路径，再用隐含重复问题、错标目的和一个问号中的多任务做失败/合法对照。保留可行学生路线，停止不需要的范围追问，同时避免隐藏真正的比较理由问题。不要通过继续扩大关键词列表声称一般教学判断已解决。
