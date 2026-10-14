// Human-review prompts for the development-only evaluation page.
export const MATH_AGENT_EVAL_SCENARIOS = [
  {
    id: 'E01', problemId: 'MATEST001', title: '临界参数：结论细微错误',
    action: '检查我的思路', ability: '第一处实质错误、分类讨论',
    draft: String.raw`f_a'(x)=3(x^2-a)。

x=\sqrt a 是正半轴的极小点，f_a(\sqrt a)=2-2a^{3/2}。

当 a\ge1 时极小值不大于 0，所以总有两个不同的正根。`,
    expected: '前两步可行；第 3 步把 a=1 误算成两个不同正根。此时 x=1 是二重根，只有一个不同正根。',
  },
  {
    id: 'E02', problemId: 'MATEST001', title: '代入计算：较早的错误',
    action: '检查我的思路', ability: '按先后定位、避免只纠正最后结论',
    draft: String.raw`f_a'(x)=3(x^2-a)，所以 x=\sqrt a 是极小点。

f_a(\sqrt a)=a^{3/2}-3a^{3/2}+2=2-a^{3/2}。

因此临界值是 a=2^{2/3}。`,
    expected: '最早错误在第 2 步：a^{3/2}-3a^{3/2}=-2a^{3/2}。第 3 步只是后续结果。',
  },
  {
    id: 'E03', problemId: 'MATEST001', title: '只要第一层提示',
    action: '给一个提示', ability: '最小有效帮助、答案防泄露',
    draft: '',
    expected: '引导观察正半轴上的极值与端点趋势；不应直接给出参数分界和完整解法。',
  },
  {
    id: 'E04', problemId: 'MATEST001', title: '理解检验：极值与边界误解',
    action: '检验我是否真正理解', ability: '聚焦一处误解、一次只问一个问题',
    draft: '导数等于零就一定是极大值；x=0 也可以作为正根来统计。',
    expected: '应指出关键概念缺口，并最多追问一个具体问题；不能把这段解释当作掌握证据。',
  },
  {
    id: 'E05', problemId: 'MATEST002', title: '条件概率：分母错误',
    action: '检查我的思路', ability: '条件样本空间、第一处实质错误',
    draft: String.raw`总取法为 C(9,3)=84。

“两红且至少一蓝”的取法为 C(4,2)C(3,1)=18。

因此在至少一蓝的条件下，P(X=2)=18/84=3/14。`,
    expected: '前两步正确；第 3 步分母仍用了无条件的 84，应改用至少一蓝的 64，结果 9/32。',
  },
  {
    id: 'E06', problemId: 'MATEST002', title: '纯数值等式：算错约分',
    action: '检查我的思路', ability: '确定性算术核验与反馈边界',
    draft: String.raw`至少一蓝的取法是 84-C(6,3)=64。

两红且至少一蓝的取法是 C(4,2)C(3,1)=18。

18/64=3/8。`,
    expected: '前两步成立；最后 18/64=3/8 错，应为 9/32。若显示“已验证”，应确有算术工具依据。',
  },
  {
    id: 'E07', problemId: 'MATEST003', title: '正确的非标准几何路线',
    action: '检查我的思路', ability: '尊重用户路线、避免误报',
    draft: String.raw`设 B=(u,v)。以 OA 为底，高就是 |u|，所以 S=|u|/2。

椭圆上 |u|\le2，故 S\le1。

等号在 B=(2,0) 或 (-2,0) 取到，对应斜率 -1/2 和 1/2。`,
    expected: '这是一条完整且正确的几何路线；不应强迫改用设直线斜率、代入判别式或求导。',
  },
  {
    id: 'E08', problemId: 'MATEST003', title: '面积符号：漏掉一个极值分支',
    action: '检查我的思路', ability: '符号与漏情况',
    draft: String.raw`设 B=(u,v)。三角形面积 S=u/2。

椭圆上 u\le2，所以最大面积是 1。

只有 B=(2,0) 时取等，故斜率只可能是 -1/2。`,
    expected: '第一步就漏了绝对值：面积应为 |u|/2。最终还漏掉 B=(-2,0)、斜率 1/2。',
  },
  {
    id: 'E09', problemId: 'MATEST004', title: '导数方程：倒数写反',
    action: '检查我的思路', ability: '导数零点、定义域与后续传染错误',
    draft: String.raw`g_a'(x)=1/x-a。

令 g_a'(x)=0，得 x=a。

于是最大值为 g_a(a)=\ln a-a^2+1。`,
    expected: '第一处错误在第 2 步：1/x=a 推出 x=1/a，不是 x=a；第 3 步随之失效。',
  },
  {
    id: 'E10', problemId: 'MATEST004', title: '明确索取完整解答',
    action: '查看完整解答', ability: '尊重直接求解意图、答案准确性',
    draft: '',
    expected: '应允许给完整过程，正确讨论 0<a<1、a=1、a>1；不应强制先做提示练习。',
  },
  {
    id: 'E11', problemId: 'MATEST002', title: '较早的条件样本空间错误与较晚的算术错误',
    action: '检查我的思路', ability: '混合草稿的第一处障碍、条件概率分母',
    draft: `总取法为 C(9,3)=84。\n\n在“至少一蓝”的条件下，样本空间仍是所有 84 种取法。\n\n两红且至少一蓝的取法为 C(4,2)C(3,1)=18。\n\n18/64=3/8`,
    expectedFirstIssueStep: 2,
    expected: '先定位第 2 步：条件样本空间应排除没有蓝球的取法，分母是 64。第 4 步另有可验证算术错误，但不能盖过第 2 步。',
  },
  {
    id: 'E12', problemId: 'MATEST004', title: '定义域错误先于数值等式错误',
    action: '检查我的思路', ability: '定义域前提、不要被后续算术吸引',
    draft: `因为要讨论 x=0 处的根，先计算 g_a(0)=\\ln 0+1。\n\n再令 g_a'(0)=0。\n\n1+1=3`,
    expectedFirstIssueStep: 1,
    expected: '先指出第 1 步：题目要求 x>0，\\ln 0 无定义。不要把第 3 步的算术错误当作第一处障碍。',
  },
  {
    id: 'E13', problemId: 'MATEST002', title: '可行的组合计数与后续算术错误',
    action: '检查我的思路', ability: '保留可行路线、区分模型分析和工具证据',
    draft: `至少一个蓝球的取法是 84-C(6,3)=64。\n\n两红且至少一蓝的取法是 C(4,2)C(3,1)=18。\n\n18/64=3/8`,
    expectedFirstIssueStep: 3,
    expected: '前两步可行，第 3 步的等式经精确算术工具验证不成立；不能声称前两步已由该工具证明。',
  },
  {
    id: 'E14', problemId: 'MATEST001', title: '真算术等式不能证明无关结论',
    action: '检查我的思路', ability: '真实数值等式与路线正确性分离',
    draft: `1+1=2\n\n所以对任意 a>0，方程 f_a(x)=0 都有两个不同正根。`,
    expectedFirstIssueStep: 2,
    expected: '第 1 步的数值等式本身成立，但不能推出第 2 步；第 2 步的结论在 a≤1 时错误。',
  },
]
