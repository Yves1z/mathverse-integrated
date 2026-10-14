import assert from 'node:assert/strict'
import { MATH_AGENT_EVAL_PROBLEMS } from '../src/config/mathAgentEvalProblems.js'
import { MATH_AGENT_EVAL_SCENARIOS } from '../src/config/mathAgentEvalScenarios.js'
import { commitTypedAttempt } from '../src/features/ai-assistant/typedAttempt.js'
import { buildAgentContext } from '../src/features/ai-assistant/contextEngine.js'
import { parseAttemptDiagnosis } from '../src/features/ai-assistant/attemptDiagnosis.js'
import { resolveAttemptReview } from '../src/features/ai-assistant/attemptReview.js'
import { composeAttemptResponse } from '../src/features/ai-assistant/responseBlocks.js'

// Deliberately fabricated provider replies. This probes the current contract;
// it does not measure any live provider's error rate or mathematical ability.
const bindingProblem = '在实数范围检查草稿中的运算是否有定义，并核对数值等式。'
const cases = [
  { id: 'S01', scenario: 'E11', failure: 'quote from another step', expected: 'rejected',
    reply: { routeStatus: 'contains_logical_gap', firstIssueStep: 2,
      evidenceQuote: '总取法', feedback: '条件样本空间需要检查。', nextQuestion: '' } },
  { id: 'S02', scenario: 'E11', failure: 'location beyond reviewed prefix', expected: 'rejected',
    reply: { routeStatus: 'contains_execution_error', firstIssueStep: 4,
      evidenceQuote: '18/64=3/8', feedback: '这个等式不成立。', nextQuestion: '' } },
  { id: 'S03', scenario: 'E11', failure: 'correct first step falsely accused', expected: 'cautioned',
    reply: { routeStatus: 'contains_logical_gap', firstIssueStep: 1,
      evidenceQuote: 'C(9,3)=84', feedback: '这一步的总取法有问题。', nextQuestion: '' } },
  { id: 'S04', scenario: 'E11', failure: 'conditional denominator overlooked', expected: 'cautioned',
    reply: { routeStatus: 'valid_but_incomplete', firstIssueStep: null,
      evidenceQuote: '', feedback: '前面的步骤可以继续。', nextQuestion: '' } },
  { id: 'S05', scenario: 'E12', failure: 'domain restriction overlooked', expected: 'cautioned',
    reply: { routeStatus: 'valid_but_incomplete', firstIssueStep: null,
      evidenceQuote: '', feedback: '前面的步骤可以继续。', nextQuestion: '' } },
  { id: 'S06', scenario: 'E13', failure: 'valid prefix then false arithmetic', expected: 'correct',
    reply: { routeStatus: 'valid_but_incomplete', firstIssueStep: null,
      evidenceQuote: '', feedback: '前两步可以继续。', nextQuestion: '' } },
  { id: 'S07', scenario: 'E14', failure: 'true equality used to bless a false conclusion', expected: 'cautioned',
    reply: { routeStatus: 'valid', firstIssueStep: null,
      evidenceQuote: '', feedback: '整条路线正确。', nextQuestion: '' } },
  { id: 'S08', scenario: 'E14', failure: 'logical gap correctly located', expected: 'correct',
    reply: { routeStatus: 'contains_logical_gap', firstIssueStep: 2,
      evidenceQuote: '任意 a>0', feedback: '这个结论没有由前面的等式推出。', nextQuestion: '' } },
  { id: 'S09', scenario: 'E12', failure: 'negative literal logarithm overlooked', expected: 'cautioned',
    draft: '先计算 g_a(-1)=\\ln(-1)+a+1。\n\n1+1=3', expectedFirstIssueStep: 1,
    reply: { routeStatus: 'valid_but_incomplete', firstIssueStep: null,
      evidenceQuote: '', feedback: '前面可以继续。', nextQuestion: '' } },
  { id: 'S10', scenario: 'E11', failure: 'conditional sample-space paraphrase overlooked', expected: 'cautioned',
    draft: '总取法为 C(9,3)=84。\n\n已知至少一蓝时，样本空间还是所有 84 种取法。\n\n2+2=5',
    expectedFirstIssueStep: 2,
    reply: { routeStatus: 'valid_but_incomplete', firstIssueStep: null,
      evidenceQuote: '', feedback: '前面可以继续。', nextQuestion: '' } },
  { id: 'S11', scenario: 'E12', failure: 'learner explicitly rejects ln 0', expected: 'correct',
    draft: '因为 \\ln 0 无定义，不能在 x=0 代入。\n\n1+1=3', expectedFirstIssueStep: 2,
    reply: { routeStatus: 'valid_but_incomplete', firstIssueStep: null,
      evidenceQuote: '', feedback: '前面可以继续。', nextQuestion: '' } },
  { id: 'S12', scenario: 'E11', failure: 'learner correctly restricts conditional sample space', expected: 'correct',
    draft: '在至少一蓝的条件下，样本空间排除没有蓝球的取法。\n\n2+2=5',
    expectedFirstIssueStep: 2,
    reply: { routeStatus: 'valid_but_incomplete', firstIssueStep: null,
      evidenceQuote: '', feedback: '前面可以继续。', nextQuestion: '' } },
  { id: 'S13', scenario: 'E11', failure: 'learner rejects a quoted false sample-space claim', expected: 'correct',
    draft: '有人称“在至少一蓝条件下样本空间仍是所有取法”，但这不成立，应排除无蓝取法。\n\n2+2=5',
    expectedFirstIssueStep: 2,
    reply: { routeStatus: 'valid_but_incomplete', firstIssueStep: null,
      evidenceQuote: '', feedback: '前面可以继续。', nextQuestion: '' } },
  { id: 'S14', scenario: 'E12', failure: 'later word 错误 hides an earlier ln 0 use', expected: 'cautioned',
    draft: '先计算 \\ln 0+1。后面那步有错误。\n\n1+1=3', expectedFirstIssueStep: 1,
    reply: { routeStatus: 'valid_but_incomplete', firstIssueStep: null,
      evidenceQuote: '', feedback: '前面可以继续。', nextQuestion: '' } },
  { id: 'S15', scenario: 'E14', failure: 'universal implication paraphrase overlooked', expected: 'cautioned',
    draft: '1+1=2\n\n由此可知，对于任何 a>0，方程 f_a(x)=0 都有两个不同正根。',
    expectedFirstIssueStep: 2,
    reply: { routeStatus: 'valid', firstIssueStep: null,
      evidenceQuote: '', feedback: '整条路线正确。', nextQuestion: '' } },
  { id: 'S16', scenario: 'E12', failure: 'positive logarithm is not a domain risk', expected: 'correct',
    draft: '先计算 \\ln 1=0。\n\n1+1=3', expectedFirstIssueStep: 2,
    reply: { routeStatus: 'valid_but_incomplete', firstIssueStep: null,
      evidenceQuote: '', feedback: '前面可以继续。', nextQuestion: '' } },
  { id: 'S17', scenario: 'E12', failure: 'explicit zero binding followed by variable log', expected: 'cautioned',
    problemText: bindingProblem,
    draft: '令 x=0\n\n计算 \\ln x+1。\n\n1+1=3', expectedFirstIssueStep: 2,
    reply: { routeStatus: 'valid_but_incomplete', firstIssueStep: null,
      evidenceQuote: '', feedback: '前面可以继续。', nextQuestion: '' } },
  { id: 'S18', scenario: 'E12', failure: 'negative binding and log in the same step', expected: 'cautioned',
    problemText: bindingProblem,
    draft: '取 t=-2，计算 ln(t)。\n\n1+1=3', expectedFirstIssueStep: 1,
    reply: { routeStatus: 'valid_but_incomplete', firstIssueStep: null,
      evidenceQuote: '', feedback: '前面可以继续。', nextQuestion: '' } },
  { id: 'S19', scenario: 'E12', failure: 'positive binding control', expected: 'correct',
    problemText: bindingProblem,
    draft: '令 x=1\n\n计算 ln x+1。\n\n1+1=3', expectedFirstIssueStep: 3,
    reply: { routeStatus: 'valid_but_incomplete', firstIssueStep: null,
      evidenceQuote: '', feedback: '前面可以继续。', nextQuestion: '' } },
  { id: 'S20', scenario: 'E12', failure: 'rebound variable must not retain the old zero', expected: 'correct',
    problemText: bindingProblem,
    draft: '令 x=0\n\n改取 x=1\n\n计算 ln x+1。\n\n1+1=3', expectedFirstIssueStep: 4,
    reply: { routeStatus: 'valid_but_incomplete', firstIssueStep: null,
      evidenceQuote: '', feedback: '前面可以继续。', nextQuestion: '' } },
  { id: 'S21', scenario: 'E12', failure: 'legitimate contradiction route notes the undefined value', expected: 'correct',
    problemText: '已知 ln x 在实数范围有定义，用反证说明 x 不等于 0。随后检查草稿中的数值等式。',
    draft: '假设 x=0，ln x 无定义，与函数已定义矛盾，故 x不等于0。\n\n1+1=3', expectedFirstIssueStep: 2,
    reply: { routeStatus: 'valid_but_incomplete', firstIssueStep: null,
      evidenceQuote: '', feedback: '前面可以继续。', nextQuestion: '' } },
  { id: 'S22', scenario: 'E12', failure: 'nontrivial argument ln(x+1) is outside literal substitution guard', expected: 'correct',
    problemText: bindingProblem,
    draft: '令 x=0\n\n计算 ln(x+1)。\n\n1+1=3', expectedFirstIssueStep: 3,
    reply: { routeStatus: 'valid_but_incomplete', firstIssueStep: null,
      evidenceQuote: '', feedback: '前面可以继续。', nextQuestion: '' } },
]

const results = cases.map((sample) => {
  const scenario = MATH_AGENT_EVAL_SCENARIOS.find((item) => item.id === sample.scenario)
  const problem = MATH_AGENT_EVAL_PROBLEMS.find((item) => item.id === scenario.problemId)
  const attempt = commitTypedAttempt({ problemId: problem.id, rawText: sample.draft ?? scenario.draft })
  const context = buildAgentContext({ intent: 'diagnose',
    page: { type: 'problem', id: problem.id, text: sample.problemText ?? problem.content }, attempt })
  let result
  try {
    const analysis = parseAttemptDiagnosis(JSON.stringify(sample.reply), attempt)
    const resolved = resolveAttemptReview(attempt, context.attempt.review, analysis)
    const response = composeAttemptResponse({ attempt, ...resolved })
    const shownStep = resolved.reviewCaution?.step.number
      ?? resolved.arithmeticIssue?.step.number ?? resolved.analysis?.firstIssueStep ?? null
    const expectedFirstIssue = sample.expectedFirstIssueStep ?? scenario.expectedFirstIssueStep
    const behavior = resolved.reviewCaution ? 'cautioned'
      : shownStep === expectedFirstIssue ? 'correct' : 'semantic_escape'
    result = { id: sample.id, scenario: sample.scenario, behavior,
      expectedFirstIssue, shownStep,
      source: response.blocks[0]?.source ?? 'none',
      failure: sample.failure }
  } catch (error) {
    result = { id: sample.id, scenario: sample.scenario, behavior: 'rejected',
      expectedFirstIssue: sample.expectedFirstIssueStep ?? scenario.expectedFirstIssueStep, shownStep: null,
      reason: error.message, failure: sample.failure }
  }
  assert.equal(result.behavior, sample.expected, `${sample.id}: observed behavior changed; inspect the case`)
  return result
})

console.table(results)
const counts = Object.fromEntries(['rejected', 'correct', 'cautioned', 'semantic_escape']
  .map((status) => [status, results.filter((item) => item.behavior === status).length]))
console.log('Synthetic provider replies only:', counts)
console.log('Cautioned means the model verdict was withheld for review, not that the first issue was mathematically proved.')
