import test from 'node:test'
import assert from 'node:assert/strict'
import { commitTypedAttempt } from './typedAttempt.js'
import { buildAgentContext } from './contextEngine.js'
import { parseAttemptDiagnosis } from './attemptDiagnosis.js'
import { resolveAttemptReview } from './attemptReview.js'
import { composeAttemptResponse } from './responseBlocks.js'
import { findExplicitLogBindingRisk } from './explicitLogBinding.js'

const attemptFor = (rawText) => commitTypedAttempt({ problemId: 'P1', rawText })

test('explicit numeric assignments bind a later simple log argument to its source step', () => {
  for (const raw of ['令 x=0\n\n计算 \\ln x+1。', '取 t=-2\n\n计算 ln(t)。',
    '设 $x=0$，计算 \\ln(x)。']) {
    const attempt = attemptFor(raw)
    const risk = findExplicitLogBindingRisk(attempt.steps)
    assert.ok(risk)
    assert.equal(risk.bindingStep.id, attempt.steps[0].id)
    assert.equal(risk.step.id, attempt.steps.at(-1).id)
    assert.ok(risk.value <= 0)
  }
})

test('positive, rebound, symbolic, branch and rejected assumptions do not reuse a stale binding', () => {
  const safe = [
    '令 x=1\n\n计算 ln x。',
    '令 x=0\n\n改取 x=1\n\n计算 ln x。',
    '令 x=0\n\n令 x=a\n\n计算 ln x。',
    '令 x=0\n\nx=1\n\n计算 ln x。',
    '令 x=0\n\n若 x>0，计算 ln x。',
    '假设 x=0，使用 ln x 进行反证。',
    '不能令 x=0\n\n计算 ln x。',
    '令 x=0\n\nln x 无定义，因此不能代入。',
    '令 x=0\n\n计算 ln(x+1)。',
    '令 x=0\n\n计算 ln x^2。',
    '令 x=-1\n\n计算 ln x²。',
  ]
  for (const raw of safe) assert.equal(findExplicitLogBindingRisk(attemptFor(raw).steps), null, raw)
})

test('the ordered review withholds a later arithmetic correction and binds the caution to the log step', () => {
  const attempt = attemptFor('令 x=0\n\n计算 \\ln x+1。\n\n1+1=3')
  const context = buildAgentContext({ intent: 'diagnose', page: { type: 'problem', id: 'P1', text: '讨论实数函数。' }, attempt })
  const analysis = parseAttemptDiagnosis(JSON.stringify({ routeStatus: 'valid_but_incomplete',
    firstIssueStep: null, evidenceQuote: '', feedback: '可以继续。', nextQuestion: '' }), attempt)
  const resolved = resolveAttemptReview(attempt, context.attempt.review, analysis)
  assert.equal(resolved.arithmeticIssue, null)
  assert.equal(resolved.reviewCaution.step.number, 2)
  const response = composeAttemptResponse({ attempt, ...resolved })
  assert.equal(response.blocks[0].source, 'response_guard')
  assert.match(response.blocks[0].content, /第 1 步.*x=0.*第 2 步/)
  assert.equal(response.blocks[0].stepNumber, 2)
  const fixed = attemptFor('令 x=1\n\n计算 \\ln x+1。\n\n1+1=3')
  assert.equal(findExplicitLogBindingRisk(fixed.steps), null)
})
