import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyOrderedDifferenceSign } from './premiseSignVerifier.js'
import { commitTypedAttempt, attemptReference } from './typedAttempt.js'
import { buildAgentContext } from './contextEngine.js'
import { renderDraftHintPrompt } from './contextPrompt.js'
import { composeDraftHintResponse, composePremiseSignResponse } from './responseBlocks.js'

const base = '已知实数 a>b>0，研究 ln((a-b)/b) 是否有定义。'
const cases = [
  { id: 'PS01', category: 'plain', problem: base, premise: '由 a>b>0 可知 a-b>0。', expected: 'valid' },
  { id: 'PS02', category: 'plain', problem: base, premise: '由 a>b>0 可知 a-b<0。', expected: 'invalid' },
  { id: 'PS03', category: 'reverse', problem: base, premise: '由 a>b>0 可知 b-a>0。', expected: 'invalid' },
  { id: 'PS04', category: 'branch', problem: '已知实数 a>b>0，当 a=b 时讨论另一情形。', premise: 'a-b<0', expected: 'unknown' },
  { id: 'PS05', category: 'later_condition', problem: '已知实数 a>b>0，a=b。', premise: 'a-b<0', expected: 'unknown' },
  { id: 'PS06', category: 'later_condition', problem: '已知实数 a>b>0，令 a=b。', premise: 'a-b<0', expected: 'unknown' },
  { id: 'PS07', category: 'confirmed_transcription', problem: base, premise: '由 a>b>0 可知 a−b＜0。', expected: 'invalid' },
  { id: 'PS08', category: 'confirmed_transcription', problem: '已知实数 x＞y，研究差值。', premise: '由 x＞y 可知 x−y＞0。', expected: 'valid' },
  { id: 'PS09', category: 'confirmed_transcription', problem: base, premise: '由 a>b>0 可知 a–b＜0。', expected: 'unknown' },
  { id: 'PS10', category: 'quoted_rejection', problem: base, premise: '有人说 a-b<0，但这不成立。', expected: 'unknown' },
  { id: 'PS11', category: 'other_variable', problem: base, premise: '由 a>b>0 可知 c-d<0。', expected: 'unknown' },
  { id: 'PS12', category: 'ambiguous_recognition', problem: base, premise: '由 a>b>0 可知 a-?＜0。', expected: 'unknown' },
  { id: 'PS13', category: 'legitimate_branch', problem: '已知实数 a>b>0，当 c=0 时讨论结果。', premise: 'a-b>0', expected: 'unknown' },
  { id: 'PS14', category: 'renamed_variables', problem: '已知实数 p>q>0，讨论差值。', premise: '由 p>q>0 可知 q−p＞0。', expected: 'invalid' },
]

test('adversarial premise bank records scoped statuses and keeps unsupported claims unknown', t => {
  const observations = cases.map(item => {
    const result = verifyOrderedDifferenceSign({ problemStatement: item.problem, premiseText: item.premise })
    return { id: item.id, category: item.category, expected: item.expected, observed: result.status }
  })
  for (const item of observations) t.diagnostic(JSON.stringify(item))
  assert.deepEqual(observations.map(item => item.observed), cases.map(item => item.expected))
})

function localRequest(problemText, premiseText) {
  const page = { type: 'problem', id: 'P-adversarial-sign', text: problemText }
  const attempt = commitTypedAttempt({ problemId: page.id, rawText: [premiseText,
    '设 u=(a-b)/b。', '把表达式写为 ln u。', '研究 u 的范围。', '判断真数条件。'].join('\n\n') })
  const target = { attemptRef: attemptReference(attempt), stepId: attempt.steps[4].id,
    premiseStepId: attempt.steps[0].id, obstacle: '' }
  return { page, attempt, target }
}

test('adversarial cases traverse the local context and mocked reveal contract', t => {
  for (const { id, problem, premise, expected } of cases) {
    const { page, attempt, target } = localRequest(problem, premise)
    if (expected === 'invalid') {
      let conflict = null
      try { buildAgentContext({ intent: 'hint', page, attempt, attemptHintTarget: target }) }
      catch (error) { conflict = error }
      assert.equal(conflict?.name, 'PremiseConflictError')
      assert.equal(conflict.toolResult.status, 'invalid')
      const response = composePremiseSignResponse(conflict.toolResult, 1)
      assert.deepEqual(response.blocks.map(block => block.type), ['verification', 'warning'])
      t.diagnostic(JSON.stringify({ id, providerEligible: false,
        displayed: response.blocks[0].type, mockRevealEvent: false }))
    } else {
      const context = buildAgentContext({ intent: 'hint', page, attempt, attemptHintTarget: target })
      const prompt = renderDraftHintPrompt(context)
      assert.match(prompt, /尚未验证/)
      assert.equal(context.attempt.localSteps[0].rawContent, premise)
      const reply = composeDraftHintResponse({ content: '先核对这一步需要的条件。', hintLevel: 0 })
      assert.deepEqual(reply.blocks.map(block => block.type), ['hint', 'warning'])
      t.diagnostic(JSON.stringify({ id, providerEligible: true,
        displayed: reply.blocks[0].type, mockRevealEvent: true }))
    }
  }
})
