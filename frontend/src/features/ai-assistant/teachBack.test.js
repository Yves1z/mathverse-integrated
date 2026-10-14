import assert from 'node:assert/strict'
import test from 'node:test'
import { parseTeachBackResponse } from './teachBack.js'
import { composeTeachBackResponse } from './responseBlocks.js'

test('teach-back returns one probe without asserting verified mastery', () => {
  const analysis = parseTeachBackResponse(JSON.stringify({
    status: 'needs_probe',
    feedback: '你指出了代换的动机，但还没说明适用条件。',
    nextQuestion: '若 x+y 不满足定义域条件，这一步还能成立吗？',
    probe: { kind: 'condition', sourceQuote: '代换', purpose: '核对代换所需定义域条件' },
  }), '我用代换来简化式子。')
  const response = composeTeachBackResponse(analysis)
  assert.deepEqual(response.blocks.map((item) => item.type), ['text', 'question', 'warning'])
  assert.match(response.blocks[2].content, /不作为长期掌握度评分/)
  assert.equal(response.statePatch, undefined)
})

test('clear explanations stop without a forced question', () => {
  const analysis = parseTeachBackResponse(JSON.stringify({
    status: 'clear', feedback: '关键条件和理由已讲清。', nextQuestion: '',
  }))
  assert.deepEqual(composeTeachBackResponse(analysis).blocks.map((item) => item.type), ['text', 'warning'])
})

test('teach-back accepts a JSON code fence without weakening schema validation', () => {
  const analysis = parseTeachBackResponse('```json\n{"status":"needs_probe","feedback":"思路有价值，但条件还不明确。","nextQuestion":"什么时候换方法？","probe":{"kind":"method","sourceQuote":"换方法","purpose":"说明换路条件"}}\n```', '我想换方法。')
  assert.equal(analysis.status, 'needs_probe')
  assert.equal(analysis.nextQuestion, '什么时候换方法？')
})

test('invalid multi-question or answer-leaking feedback is rejected or hidden', () => {
  assert.throws(() => parseTeachBackResponse('not json'), /理解反馈格式/)
  assert.throws(() => parseTeachBackResponse(JSON.stringify({
    status: 'needs_probe', feedback: '再想想。', nextQuestion: '为何这样？还能怎样？',
  })), /格式不正确/)
  assert.throws(() => parseTeachBackResponse(JSON.stringify({
    status: 'clear', feedback: '已经清楚。', nextQuestion: '再做什么？',
  })), /格式不正确/)
  const leaked = composeTeachBackResponse(parseTeachBackResponse(JSON.stringify({
    status: 'needs_probe', feedback: '最终答案：2x', nextQuestion: '为什么？',
    probe: { kind: 'reasoning', sourceQuote: '求导', purpose: '解释导数的作用' },
  }), '先求导。'))
  assert.equal(leaked.blocks.length, 1)
  assert.equal(leaked.blocks[0].type, 'warning')
  assert.doesNotMatch(leaked.blocks[0].content, /最终答案：2x/)
})
