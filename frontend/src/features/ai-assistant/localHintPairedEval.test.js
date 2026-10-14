import test from 'node:test'
import assert from 'node:assert/strict'
import { commitTypedAttempt, attemptReference } from './typedAttempt.js'
import { buildAgentContext } from './contextEngine.js'
import { renderDraftHintPrompt } from './contextPrompt.js'
import { composeDraftHintResponse } from './responseBlocks.js'

// Original synthetic draft and fabricated provider replies. This suite measures
// context/reveal contracts, not a live model's mathematical or teaching quality.
const page = {
  type: 'problem', id: 'P-paired-local-hint',
  text: '已知实数 a>b>0，研究 ln((a-b)/b) 是否有定义。',
  answer: '参考答案秘密', solution: '参考解析秘密',
}
const steps = [
  '由 a>b>0 可知 a-b>0 且 b>0。',
  '设 u=(a-b)/b。',
  '把表达式写为 ln u。',
  '接下来研究 u 的取值。',
  '判断 ln u 的真数条件。',
  '后续秘密：答案为 0。',
]

function fixture({ premise = false, conflicting = false, skipContext = false } = {}) {
  const draft = [...steps]
  if (conflicting) draft[0] = '由 a>b>0 可知 a-b<0。'
  const attempt = commitTypedAttempt({ problemId: page.id, rawText: draft.join('\n\n') })
  const target = { attemptRef: attemptReference(attempt), stepId: attempt.steps[4].id,
    obstacle: '这里的对数真数是否为正？', ...(premise ? { premiseStepId: attempt.steps[0].id } : {}) }
  if (skipContext) return { attempt, target }
  const context = buildAgentContext({ intent: 'hint', page, attempt, attemptHintTarget: target,
    includeReference: true, hintLevel: 0, hintState: { revealed: ['旧提示秘密'] } })
  return { attempt, context, prompt: renderDraftHintPrompt(context) }
}

function record(t, id, context, response, semanticResult) {
  t.diagnostic(JSON.stringify({ id, sentStepNumbers: context.attempt.localSteps.map(s => s.order),
    hintLevel: context.tutoring.currentHelpLevel, displayed: response.blocks[0].type,
    revealEvent: response.blocks[0].type === 'hint', semanticResult }))
}

test('LH01: without the distant condition, local scope stays narrow and asks for a missing condition', t => {
  const { context, prompt } = fixture()
  assert.deepEqual(context.attempt.localSteps.map(s => s.order), [3, 4, 5])
  assert.doesNotMatch(prompt, /由 a>b>0 可知|设 u=|后续秘密|参考答案秘密|旧提示秘密/)
  assert.match(prompt, /条件不足时只问一个必要条件/)
  assert.match(prompt, /第 0 级渐进提示/)
  const response = composeDraftHintResponse({ content: '先核对对数真数需要满足什么条件。', hintLevel: 0 })
  assert.equal(response.blocks[0].type, 'hint')
  record(t, 'LH01', context, response, 'mock reply only; relevance and progress unverified')
})

test('LH02: the same target plus learner-selected condition adds exactly that source step', t => {
  const { attempt, context, prompt } = fixture({ premise: true })
  assert.deepEqual(context.attempt.localSteps.map(s => s.order), [1, 3, 4, 5])
  assert.equal(context.attempt.localSteps[0].rawContent, attempt.steps[0].rawContent)
  assert.deepEqual(context.attempt.localSteps[0].sourceRange, attempt.steps[0].sourceRange)
  assert.doesNotMatch(prompt, /设 u=|后续秘密|参考答案秘密|旧提示秘密/)
  assert.match(prompt, /学生选入的较早前提（草稿原文，尚未验证）/)
  const response = composeDraftHintResponse({ content: '回看第一步给出的符号条件，再判断它对真数意味着什么。', hintLevel: 0 })
  assert.equal(response.blocks[0].type, 'hint')
  record(t, 'LH02', context, response, 'mock reply only; premise necessity and route preservation unverified')
})

test('LH03: a conflicting selected premise is stopped before a false endorsement can be requested', t => {
  const { attempt, target } = fixture({ premise: true, conflicting: true, skipContext: true })
  assert.throws(() => buildAgentContext({ intent: 'hint', page, attempt, attemptHintTarget: target,
    includeReference: true, hintLevel: 0 }), error => {
    assert.equal(error.name, 'PremiseConflictError')
    assert.equal(error.toolResult.status, 'invalid')
    assert.equal(error.toolResult.checkedClaim, 'a-b<0')
    assert.match(error.message, /未发送给模型/)
    return true
  })
  t.diagnostic(JSON.stringify({ id: 'LH03', sentStepNumbers: [], hintLevel: 0,
    displayed: 'local_conflict', revealEvent: false,
    semanticResult: 'narrow strict-order contradiction checked; unsupported premise forms remain unknown' }))
})

test('LH04: later answer is excluded; an answer-wording reply is hidden without a reveal event', t => {
  const { context, prompt } = fixture({ premise: true })
  assert.deepEqual(context.attempt.localSteps.map(s => s.order), [1, 3, 4, 5])
  assert.doesNotMatch(prompt, /后续秘密|答案为 0|参考答案秘密|参考解析秘密/)
  const response = composeDraftHintResponse({ content: '答案为 0', hintLevel: 0 })
  assert.equal(response.blocks[0].type, 'warning')
  assert.doesNotMatch(response.blocks[0].content, /答案为 0/)
  assert.equal(response.blocks.some(block => block.type === 'hint'), false)
  record(t, 'LH04', context, response, 'obvious answer wording hidden; semantic near-solutions remain unverified')
})
