import test from 'node:test'
import assert from 'node:assert/strict'
import { PREMISE_SIGN_TOOL, verifyOrderedDifferenceSign } from './premiseSignVerifier.js'
import { commitTypedAttempt, attemptReference } from './typedAttempt.js'
import { buildAgentContext } from './contextEngine.js'

const problem = '已知实数 a>b>0，研究 ln((a-b)/b) 是否有定义。'
const verify = (premiseText, problemStatement = problem) =>
  verifyOrderedDifferenceSign({ problemStatement, premiseText })

test('bounded deterministic tool proves only the difference sign under explicit strict order', () => {
  assert.equal(PREMISE_SIGN_TOOL.name, 'verify_ordered_difference_sign')
  assert.equal(PREMISE_SIGN_TOOL.executionType, 'deterministic')
  assert.equal(PREMISE_SIGN_TOOL.costClass, 'low')
  for (const [claim, expected] of [
    ['由 a>b>0 可知 a-b>0。', 'valid'],
    ['由 a>b>0 可知 a-b<0。', 'invalid'],
    ['由 a>b>0 可知 a-b=0。', 'invalid'],
    ['由 a>b>0 可知 b-a<0。', 'valid'],
    ['由 a>b>0 可知 b-a>0。', 'invalid'],
    ['a-b>0', 'valid'],
  ]) {
    const result = verify(claim)
    assert.equal(result.status, expected, claim)
    assert.deepEqual(result.assumptions, ['a>b'])
    assert.equal(result.scope, 'single_difference_sign')
  }
  assert.equal(verify('由 x>y 可知 y-x<0。', '已知实数 x>y，讨论表达式。').status, 'valid')
  assert.equal(verify('由 x>y 可知 x-y<0。', '已知实数 x>y，讨论表达式。').status, 'invalid')
  assert.equal(verify('由 x＞y 可知 x−y＜0。', '已知实数 x＞y，讨论表达式。').status, 'invalid')
})

test('ambiguous, negated, compound and unsupported statements stay unknown', () => {
  for (const [statement, premise] of [
    ['已知实数 a≥b，讨论表达式。', 'a-b>0'],
    ['已知实数 a>b>0 或 a=b。', 'a-b>0'],
    ['已知实数 a>b>0，或者 a=b。', 'a-b>0'],
    ['已知实数 a>b>0，接下来假设 a=b 并比较两种情形。', 'a-b>0'],
    ['已知实数 a>b>0，且 a<b。', 'a-b>0'],
    ['已知实数 a>b>0，另有 a<b。', 'a-b>0'],
    ['已知实数 a>b>0，a=b。', 'a-b>0'],
    ['已知实数 a>b>0，当 a=b 时讨论另一情形。', 'a-b>0'],
    ['有人声称已知实数 a>b>0。', 'a-b>0'],
    [problem, '有人说 a-b<0，但这不成立。'],
    [problem, '由 a>b>0 可知 a-b<0，但这不成立。'],
    [problem, '假设 a-b<0 进行反证。'],
    [problem, '由 a>b>0 可知 a-b>0 且 b>0。'],
    [problem, '由 a>b>0 可知 c-d<0。'],
    [problem, '由 b>a 可知 a-b<0。'],
    [problem, '$a-b<0$'],
    [problem, '由 a>b>0 可知 a–b＜0。'],
  ]) assert.equal(verify(premise, statement).status, 'unknown', `${statement} / ${premise}`)
  assert.equal(verifyOrderedDifferenceSign({ problemStatement: null, premiseText: 'a-b<0' }).status, 'unknown')
  assert.equal(verifyOrderedDifferenceSign({ problemStatement: problem, premiseText: 'a-b<0', extra: true }).status, 'unknown')
  assert.equal(verify('a-b<0'.repeat(1000)).status, 'unknown')
})

test('local hint blocks a proven conflicting premise before provider work, then accepts a corrected version', () => {
  const page = { type: 'problem', id: 'P-sign-gate', text: problem }
  const lines = ['由 a>b>0 可知 a-b<0。', '设 u=(a-b)/b。', '把表达式写为 ln u。',
    '研究 u 的范围。', '判断 ln u 的真数条件。', '后续答案秘密。']
  const attempt = commitTypedAttempt({ problemId: page.id, rawText: lines.join('\n\n') })
  const target = { attemptRef: attemptReference(attempt), stepId: attempt.steps[4].id,
    premiseStepId: attempt.steps[0].id, obstacle: '' }
  assert.throws(() => buildAgentContext({ intent: 'hint', page, attempt, attemptHintTarget: target }), error => {
    assert.equal(error.name, 'PremiseConflictError')
    assert.equal(error.recovery, 'edit_attempt')
    assert.equal(error.toolResult.status, 'invalid')
    assert.match(error.message, /未发送给模型/)
    assert.doesNotMatch(error.message, /后续答案秘密/)
    return true
  })
  lines[0] = '由 a>b>0 可知 a-b>0。'
  const corrected = commitTypedAttempt({ previous: attempt, problemId: page.id, rawText: lines.join('\n\n') })
  assert.ok(corrected.version > attempt.version)
  assert.throws(() => buildAgentContext({ intent: 'hint', page, attempt: corrected, attemptHintTarget: target }))
  const current = { attemptRef: attemptReference(corrected), stepId: corrected.steps[4].id,
    premiseStepId: corrected.steps[0].id, obstacle: '' }
  const context = buildAgentContext({ intent: 'hint', page, attempt: corrected, attemptHintTarget: current })
  assert.deepEqual(context.attempt.localSteps.map(step => step.order), [1, 3, 4, 5])
  assert.equal(context.attempt.hintTarget.premiseStepNumber, 1)
})
