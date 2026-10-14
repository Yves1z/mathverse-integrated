import test from 'node:test'
import assert from 'node:assert/strict'
import { commitTypedAttempt } from './typedAttempt.js'
import { buildAgentContext } from './contextEngine.js'
import { renderAttemptDiagnosisPrompt } from './contextPrompt.js'
import { parseAttemptDiagnosis } from './attemptDiagnosis.js'
import { resolveAttemptReview } from './attemptReview.js'
import { composeAttemptResponse } from './responseBlocks.js'

function fixture(rawText) {
  const attempt = commitTypedAttempt({ problemId: 'P1', rawText })
  const context = buildAgentContext({ intent: 'diagnose',
    page: { type: 'problem', id: 'P1', text: '讨论等价变形条件', answer: '参考答案暗号' }, attempt })
  return { attempt, context, review: context.attempt.review }
}
function diagnosis(attempt, routeStatus, firstIssueStep) {
  return parseAttemptDiagnosis(JSON.stringify({ routeStatus, firstIssueStep,
    evidenceQuote: firstIssueStep === null ? '' : attempt.steps[firstIssueStep - 1].rawContent,
    feedback: '检查前提。', nextQuestion: '这里的条件是什么？' }), attempt)
}
const mixed = () => fixture('设 x = 0，因此可以两边除以 x\n\n2 + 2 = 5\n\n后续步骤暗号')

test('mixed draft checks its prefix before the later false equality and bounds the prompt', () => {
  const { attempt, context, review } = mixed()
  assert.equal(review.needsProvider, true)
  assert.equal(review.reviewThrough, 1)
  assert.deepEqual(review.evidence.map((entry) => entry.status), ['unsupported', 'invalid'])
  assert.equal(Object.isFrozen(review.evidence[0]), true)
  const prompt = renderAttemptDiagnosisPrompt(context)
  assert.match(prompt, /两边除以 x/)
  assert.match(prompt, /第 1 步：unsupported/)
  assert.doesNotMatch(prompt, /2 \+ 2 = 5|后续步骤暗号|参考答案暗号/)
  const resolved = resolveAttemptReview(attempt, review, diagnosis(attempt, 'contains_logical_gap', 1))
  const response = composeAttemptResponse({ attempt, ...resolved })
  assert.equal(resolved.arithmeticIssue, null)
  assert.equal(response.blocks[0].stepNumber, 1)
  assert.equal(response.blocks[0].source, 'provider')
  assert.ok(!response.blocks.some((block) => block.type === 'verification'))
})

test('uncertainty and missing tools never become a cleared prefix', () => {
  const { attempt, review } = mixed()
  for (const status of ['uncertain', 'blocked_by_missing_tool']) {
    const result = resolveAttemptReview(attempt, review, diagnosis(attempt, status, null))
    assert.equal(result.arithmeticIssue, null)
    assert.equal(result.reviewScope, 1)
    assert.equal(result.analysis.routeStatus, status)
  }
  assert.throws(() => resolveAttemptReview(attempt, review), /尚未完成分析/)
})

test('a provisionally viable prefix reveals only the independently checked arithmetic issue', () => {
  const { attempt, review } = mixed()
  const result = resolveAttemptReview(attempt, review, diagnosis(attempt, 'valid_but_incomplete', null))
  assert.equal(result.analysis, null, 'model praise cannot declare the whole draft correct')
  assert.equal(result.arithmeticIssue.step.number, 2)
  const response = composeAttemptResponse({ attempt, ...result })
  assert.equal(response.blocks[1].status, 'invalid')
  assert.equal(response.blocks[1].checkedClaim, '2 + 2 = 5')
  assert.match(response.blocks.at(-1).content, /前面的步骤仅经 AI 初步分析/)
})

test('out of scope model locations and stale or forged evidence are rejected', () => {
  const { attempt, context, review } = mixed()
  for (const step of [2, 3]) {
    assert.throws(() => resolveAttemptReview(attempt, review,
      diagnosis(attempt, 'contains_execution_error', step)), /超出本轮/)
  }
  const changed = commitTypedAttempt({ previous: attempt, problemId: attempt.problemId, rawText: '2 + 2 = 4' })
  assert.throws(() => resolveAttemptReview(changed, review), /核验记录/)
  const forged = structuredClone(context)
  forged.attempt.review.evidence[0].status = 'valid'
  assert.throws(() => renderAttemptDiagnosisPrompt(forged), /核验记录/)
})

test('a first-line false equality stays local; true equalities do not verify the route', () => {
  const local = fixture('1 + 1 = 3\n\n未检查的后续')
  assert.equal(local.review.needsProvider, false)
  assert.equal(resolveAttemptReview(local.attempt, local.review).arithmeticIssue.step.number, 1)
  const truePrefix = fixture('1 + 1 = 2\n\n2 + 2 = 5')
  assert.equal(truePrefix.review.needsProvider, true, 'a true equality does not prove its role in a solution')
  const valid = fixture('1 + 1 = 2')
  assert.equal(valid.review.needsProvider, true)
  const result = resolveAttemptReview(valid.attempt, valid.review, diagnosis(valid.attempt, 'valid', null))
  assert.equal(result.arithmeticIssue, null)
  assert.equal(result.analysis.provenance, 'provider_unverified')
})

test('evidence consumes context budget instead of bypassing the capacity limit', () => {
  const { attempt } = mixed()
  assert.throws(() => buildAgentContext({ intent: 'diagnose', attempt,
    page: { id: 'P1', type: 'problem', text: '题目' },
    maxContextChars: attempt.rawText.length + 250 }), /上下文容量/)
})

test('a true quoted combination identity prevents an ungrounded accusation', () => {
  const { attempt, review } = fixture('总取法为 C(9,3)=84。\n\n后续结论')
  const analysis = parseAttemptDiagnosis(JSON.stringify({ routeStatus: 'contains_logical_gap',
    firstIssueStep: 1, evidenceQuote: 'C(9,3)=84', feedback: '这一步的总取法有问题。', nextQuestion: '' }), attempt)
  const resolved = resolveAttemptReview(attempt, review, analysis)
  assert.equal(resolved.reviewCaution.kind, 'verified_quote_conflict')
  const response = composeAttemptResponse({ attempt, ...resolved })
  assert.equal(response.blocks[0].type, 'warning')
  assert.equal(response.blocks[0].source, 'response_guard')
  assert.match(response.blocks[0].content, /数值成立.*不证明它适用于本题/)
  assert.throws(() => composeAttemptResponse({ attempt, reviewCaution: {
    ...resolved.reviewCaution, step: { ...resolved.reviewCaution.step, rawContent: '伪造步骤' },
  } }), /前提检查/)
})

test('explicit domain and conditional sample-space premises hold later arithmetic feedback', () => {
  const samples = [
    ['先计算 g(0)=\\ln 0+1\n\n2 + 2 = 5', 'literal_log_nonpositive', 1],
    ['先计算 g(-1)=\\ln(-1)+1\n\n2 + 2 = 5', 'literal_log_nonpositive', 1],
    ['先计算 ln(-0.5)+1。后面那步有错误。\n\n2 + 2 = 5', 'literal_log_nonpositive', 1],
    ['总取法是 84。\n\n在至少一蓝的条件下，样本空间仍是所有取法。\n\n2 + 2 = 5',
      'conditional_sample_space', 2],
    ['已知至少一蓝时，样本空间还是所有取法。\n\n2 + 2 = 5',
      'conditional_sample_space', 1],
  ]
  for (const [rawText, kind, stepNumber] of samples) {
    const { attempt, review } = fixture(rawText)
    const resolved = resolveAttemptReview(attempt, review, diagnosis(attempt, 'valid_but_incomplete', null))
    assert.equal(resolved.reviewCaution.kind, kind)
    assert.equal(resolved.reviewCaution.step.number, stepNumber)
    assert.equal(resolved.arithmeticIssue, null)
    assert.equal(composeAttemptResponse({ attempt, ...resolved }).blocks[0].type, 'warning')
  }
  const correctlyNoted = fixture('因为 ln 0 无定义，这里不能代入。\n\n2 + 2 = 5')
  assert.equal(resolveAttemptReview(correctlyNoted.attempt, correctlyNoted.review,
    diagnosis(correctlyNoted.attempt, 'valid_but_incomplete', null)).arithmeticIssue.step.number, 2)
  const correctedSpace = fixture('在至少一蓝的条件下，样本空间排除无蓝取法。\n\n2 + 2 = 5')
  assert.equal(resolveAttemptReview(correctedSpace.attempt, correctedSpace.review,
    diagnosis(correctedSpace.attempt, 'valid_but_incomplete', null)).arithmeticIssue.step.number, 2)
  const rejectedClaim = fixture('有人称“在至少一蓝条件下样本空间仍是所有取法”，但这不成立，应排除无蓝取法。\n\n2 + 2 = 5')
  assert.equal(resolveAttemptReview(rejectedClaim.attempt, rejectedClaim.review,
    diagnosis(rejectedClaim.attempt, 'valid_but_incomplete', null)).arithmeticIssue.step.number, 2)
  const positiveLog = fixture('先计算 \\ln 1=0。\n\n2 + 2 = 5')
  assert.equal(resolveAttemptReview(positiveLog.attempt, positiveLog.review,
    diagnosis(positiveLog.attempt, 'valid_but_incomplete', null)).arithmeticIssue.step.number, 2)
})

test('a true arithmetic equality does not certify a later universal implication', () => {
  const { attempt, review } = fixture('1+1=2\n\n所以对任意 a>0 都成立。')
  const resolved = resolveAttemptReview(attempt, review, diagnosis(attempt, 'valid', null))
  assert.equal(resolved.reviewCaution.kind, 'unverified_implication')
  assert.equal(resolved.reviewCaution.step.number, 2)
  const properlyLocated = resolveAttemptReview(attempt, review,
    diagnosis(attempt, 'contains_logical_gap', 2))
  assert.equal(properlyLocated.reviewCaution, undefined)
  assert.equal(properlyLocated.analysis.firstIssueStep, 2)
  const paraphrase = fixture('1+1=2\n\n由此可知，对于任何 a>0 都成立。')
  assert.equal(resolveAttemptReview(paraphrase.attempt, paraphrase.review,
    diagnosis(paraphrase.attempt, 'valid', null)).reviewCaution.kind, 'unverified_implication')
})
