import assert from 'node:assert/strict'
import test from 'node:test'
import { composeAgentResponse, composeDraftHintResponse, composePremiseSignResponse, validateAgentResponse } from './responseBlocks.js'
import { verifyOrderedDifferenceSign } from './premiseSignVerifier.js'

test('hint is a typed block and obvious answer leakage is hidden', () => {
  const hint = composeAgentResponse({ intent: 'hint', content: '先观察对称性。', hintLevel: 1 })
  assert.equal(hint.blocks[0].type, 'hint')
  assert.equal(hint.blocks[0].hintLevel, 1)
  const leaked = composeAgentResponse({ intent: 'hint', content: '最终答案：3' })
  assert.equal(leaked.blocks[0].type, 'warning')
  assert.doesNotMatch(leaked.blocks[0].content, /最终答案：3/)
  for (const answer of ['答案为 3', '答案是3']) {
    const hidden = composeAgentResponse({ intent: 'hint', content: answer })
    assert.equal(hidden.blocks[0].type, 'warning')
    assert.doesNotMatch(hidden.blocks[0].content, /答案为 3|答案是3/)
  }
  assert.equal(composeAgentResponse({ intent: 'hint', content: '想想为什么答案的条件需要核对。' }).blocks[0].type, 'hint')
})

test('model-only verification is never marked verified', () => {
  const response = composeAgentResponse({ intent: 'verify', content: '这一步看起来成立。' })
  assert.deepEqual(response.blocks.map((item) => item.type), ['text', 'warning'])
  response.blocks[0].type = 'verification'
  assert.equal(validateAgentResponse(response), false)
})

test('conflicting premise gets scoped tool evidence without a hint or solution', () => {
  const evidence = verifyOrderedDifferenceSign({
    problemStatement: '已知 a>b>0，求证结论。',
    premiseText: '由 a>b>0 可知 a-b<0。',
  })
  const response = composePremiseSignResponse(evidence, 1)
  assert.deepEqual(response.blocks.map(item => item.type), ['verification', 'warning'])
  assert.equal(response.blocks[0].status, 'invalid')
  assert.equal(response.blocks[0].provenance.tool, 'verify_ordered_difference_sign')
  assert.equal(response.blocks[0].checkedClaim, 'a-b<0')
  assert.deepEqual(response.blocks[0].assumptions, ['a>b'])
  assert.equal(validateAgentResponse(response), true)

  response.blocks[0].provenance.tool = 'unverified_model_claim'
  assert.equal(validateAgentResponse(response), false)
  assert.throws(() => composePremiseSignResponse({ ...evidence, status: 'unknown' }, 1))
})

test('direct endorsement guard is bound to the selected earlier step', () => {
  const blocked = composeDraftHintResponse({ content: '第 2 步完全正确。', hintLevel: 0, premiseStepNumber: 2 })
  assert.deepEqual(blocked.blocks.map(item => item.type), ['warning'])
  assert.equal(blocked.blocks[0].guardReason, 'unverified_premise_endorsement')
  const otherStep = composeDraftHintResponse({ content: '第 2 步完全正确。', hintLevel: 0, premiseStepNumber: 1 })
  assert.deepEqual(otherStep.blocks.map(item => item.type), ['hint', 'warning'])
})

test('explicit solution gets a solution block', () => {
  assert.equal(composeAgentResponse({ intent: 'solution', content: '解答过程' }).blocks[0].type, 'solution')
  const hint = composeAgentResponse({ intent: 'hint', content: '先观察结构。' })
  hint.blocks[0].type = 'solution'
  assert.equal(validateAgentResponse(hint), false)
  assert.equal(composeAgentResponse({ intent: 'hint', content: '解释已经显示的解答。', hintLevel: 5 }).blocks[0].type, 'text')
})
