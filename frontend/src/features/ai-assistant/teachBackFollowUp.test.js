import assert from 'node:assert/strict'
import test from 'node:test'
import { assertTeachBackFollowUp, createTeachBackFollowUp, parseTeachBackResponse, teachBackReference } from './teachBack.js'
import { buildAgentContext } from './contextEngine.js'
import { assertContextIntegrity } from './contextIntegrity.js'
import { renderTurnPrompt } from './contextPrompt.js'
import { composeTeachBackResponse } from './responseBlocks.js'
import { resolveLearningIntent } from './learningFlow.js'

const explanation = '无关开头秘密。' + '前文'.repeat(60) + '两边平方' + '后文'.repeat(60) + '无关结尾秘密。'
const reference = teachBackReference('problem:P1', 3)
const analysis = { status: 'needs_probe', feedback: '等价条件还未说明。', nextQuestion: '平方前两边需要满足什么条件？',
  probe: { kind: 'condition', sourceQuote: '两边平方', purpose: '核对平方变形的等价条件' } }
const target = createTeachBackFollowUp({ explanation, analysis, reference, questionId: 'probe-1' })
const build = (overrides = {}) => buildAgentContext({ intent: 'teach_back',
  page: { type: 'problem', id: 'P1', text: '讨论等式变形。', answer: '参考答案秘密', solution: '参考解析秘密' },
  userMessage: '两边非负，且变形后需要回代核对。', teachBackFollowUp: target,
  teachBackExplanation: explanation, expectedTeachBackRef: reference, conversationScope: reference.scopeKey,
  includeReference: true, recentMessages: [{ role: 'assistant', content: '旧反馈秘密', scopeKey: reference.scopeKey }], ...overrides })
const reply = (overrides = {}) => ({ status: 'needs_probe', feedback: '已说明符号，还需说明回代的作用。',
  nextQuestion: '回代在这个等价核对中排除什么情况？',
  probe: { ...analysis.probe, sourceQuote: '回代' }, ...overrides })

test('TF01 bound answer context preserves only the exact local excerpt, current probe and supplement', () => {
  const context = build()
  const prompt = renderTurnPrompt(context, 'teach_back')
  assert.equal(target.originalExcerpt.length, 164)
  assert.equal(explanation.slice(target.sourceRange.start, target.sourceRange.end), target.originalExcerpt)
  assert.equal(context.teachBackFollowUp.questionId, 'probe-1')
  assert.match(prompt, /平方前两边需要满足什么条件/)
  assert.match(prompt, /两边非负，且变形后需要回代核对/)
  assert.doesNotMatch(prompt, /无关开头秘密|无关结尾秘密|旧反馈秘密|参考答案秘密|参考解析秘密/)
  assert.equal(context.conversation, undefined)
  assert.equal(Object.isFrozen(context.teachBackFollowUp.probe), true)
  assert.notEqual(context.teachBackFollowUp, target)
  assert.equal(context.contextMetadata.selectedItems.some(item => item.source === 'teach_back.current_probe'), true)
})

test('TF02 supplementation resolves the selected gap and stops without mastery or a forced probe', () => {
  const parsed = parseTeachBackResponse(JSON.stringify(reply({ status: 'clear', feedback: '这次补充已说明本次等价条件。',
    nextQuestion: '', probe: null })), build().request.userMessage, target)
  const response = composeTeachBackResponse(parsed)
  assert.deepEqual(response.blocks.map(block => block.type), ['text', 'warning'])
  assert.equal(response.statePatch, undefined)
})

test('TF03 a remaining gap uses the same purpose and quotes the new supplement', () => {
  const parsed = parseTeachBackResponse(JSON.stringify(reply()), build().request.userMessage, target)
  assert.equal(parsed.probe.purpose, target.probe.purpose)
  assert.equal(composeTeachBackResponse(parsed).blocks.filter(block => block.type === 'question').length, 1)
})

test('TF04-06 repeated question, switched purpose and quoting only the old explanation are rejected', () => {
  const answer = build().request.userMessage
  assert.throws(() => parseTeachBackResponse(JSON.stringify(reply({ nextQuestion: '平方前 两边需要满足什么条件?' })), answer, target), /重复/)
  assert.throws(() => parseTeachBackResponse(JSON.stringify(reply({ probe: { ...reply().probe, purpose: '核对新方法' } })), answer, target), /换了目标/)
  assert.throws(() => parseTeachBackResponse(JSON.stringify(reply({ probe: { ...analysis.probe } })), answer, target), /本次解释原话/)
})

test('TF07-09 stale scope/revision, changed or forged original ranges fail before a provider call', () => {
  for (const ref of [teachBackReference('problem:P2', 3), teachBackReference(reference.scopeKey, 4)]) {
    assert.throws(() => build({ expectedTeachBackRef: ref }), /追问关联|当前题目/)
  }
  assert.throws(() => build({ teachBackExplanation: '已修改的解释' }), /追问关联/)
  assert.throws(() => assertTeachBackFollowUp({ ...target, sourceRange: { start: -1, end: 163 } }), /追问关联/)
  assert.throws(() => assertTeachBackFollowUp({ ...target, secretHistory: explanation }), /追问关联/)
  assert.throws(() => assertContextIntegrity({ ...build(), request: { ...build().request, action: 'ask' } }), /不完整/)
})

test('TF10-11 opt-out, oversized answers and context budget cannot silently omit the binding', () => {
  assert.throws(() => build({ includePage: false }), /当前题目/)
  assert.throws(() => build({ userMessage: '字'.repeat(1001) }), /1000/)
  assert.throws(() => build({ maxContextChars: 250 }), /容量/)
  assert.throws(() => build({ expectedTeachBackRef: null }), /当前题目/)
})

test('TF12 only an explicit affirmative supplementary-answer request routes to the same UI action', () => {
  assert.equal(resolveLearningIntent('teach-back-reply'), 'teach-back-reply')
  assert.equal(resolveLearningIntent('chat', '回答本次追问：两边应非负。'), 'teach-back-reply')
  assert.equal(resolveLearningIntent('chat', '请回答本次追问：两边应非负。'), 'teach-back-reply')
  assert.equal(resolveLearningIntent('chat', '不要回答本次追问：先给提示。'), 'chat')
})

test('TF13 obvious answer disclosure in a supplementary recheck stays hidden and produces no learning evidence', () => {
  const parsed = parseTeachBackResponse(JSON.stringify(reply({ feedback: '最终答案：2' })), build().request.userMessage, target)
  const response = composeTeachBackResponse(parsed)
  assert.deepEqual(response.blocks.map(block => block.type), ['warning'])
  assert.doesNotMatch(response.blocks[0].content, /最终答案：2/)
  assert.equal(response.statePatch, undefined)
})
