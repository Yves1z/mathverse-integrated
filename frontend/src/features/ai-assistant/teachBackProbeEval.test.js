import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAgentContext } from './contextEngine.js'
import { renderTurnPrompt } from './contextPrompt.js'
import { composeTeachBackResponse } from './responseBlocks.js'
import { parseTeachBackResponse, teachBackReference, isCurrentTeachBackReference } from './teachBack.js'

const explanation = '我把两边平方，再解得到的方程。'
const reply = { status: 'needs_probe', feedback: '平方之前的等价条件还没说明。',
  nextQuestion: '平方之前需要两边满足什么条件？',
  probe: { kind: 'condition', sourceQuote: '两边平方', purpose: '核对平方变形的等价条件' } }
const cases = [
  { id: 'TB01', explanation, reply, expected: 'question' },
  { id: 'TB02', explanation: '我令 t=sqrt(x)，限制 t>=0，解关于 t 的方程，再代回原式核对。',
    reply: { status: 'clear', feedback: '你交代了代换的范围和回代核对，可以先独立继续。', nextQuestion: '', probe: null }, expected: 'stop' },
  { id: 'TB03', explanation: '先要求 x>=2，两边非负后平方，求得候选值再代回原式核对。',
    reply: { status: 'clear', feedback: '本次解释说明了等价条件与核对步骤。', nextQuestion: '', probe: null }, expected: 'stop' },
  { id: 'TB04', explanation: '转录里 x-? 的符号尚不清楚。',
    reply: { status: 'uncertain', feedback: '先确认转录读法，再讨论数学推理。', nextQuestion: '这个位置原来写的是什么符号？',
      probe: { kind: 'reading', sourceQuote: 'x-?', purpose: '确认符号读法' } }, expected: 'question' },
  { id: 'TB05', explanation, reply: { ...reply, probe: { ...reply.probe, sourceQuote: '参考解析要求两边非负' } }, expected: 'rejected' },
  { id: 'TB06', explanation, reply: { ...reply, probe: { kind: 'condition', sourceQuote: '两边平方' } }, expected: 'rejected' },
  { id: 'TB07', explanation, reply: { ...reply, feedback: '为何平方？' }, expected: 'rejected' },
  { id: 'TB08', explanation, reply: { ...reply, probe: [reply.probe, reply.probe] }, expected: 'rejected' },
  { id: 'TB09', explanation, reply: { ...reply, status: 'clear' }, expected: 'rejected' },
  { id: 'TB10', explanation, reply: { ...reply, probe: { ...reply.probe, purpose: '最终答案：3' } }, expected: 'hidden' },
  { id: 'TB11', explanation: '我改用代换，并先说明新变量范围。', reply, expected: 'rejected' },
  { id: 'TB12', explanation, reply: { ...reply, nextQuestion: '为何平方？还可以怎样做？' }, expected: 'rejected' },
  { id: 'TB13', explanation, reply: { ...reply, probe: undefined }, expected: 'rejected' },
]

test('teach-back probe bank grounds one structured question and keeps clear/uncertain behavior separate', t => {
  const page = { type: 'problem', id: 'P-teach-probe', text: '解方程 sqrt(x)=x-2，说明变形的等价条件。',
    answer: '参考答案秘密', solution: '参考解析秘密' }
  for (const item of cases) {
    const context = buildAgentContext({ intent: 'teach_back', page, userMessage: item.explanation, includeReference: true })
    const prompt = renderTurnPrompt(context, 'teach_back')
    assert.match(prompt, /sourceQuote|probe/)
    assert.ok(prompt.includes(item.explanation))
    assert.doesNotMatch(prompt, /参考答案秘密|参考解析秘密/)
    let observed
    try {
      const analysis = parseTeachBackResponse(JSON.stringify(item.reply), item.explanation)
      const response = composeTeachBackResponse(analysis)
      assert.equal(response.statePatch, undefined)
      if (response.blocks.length === 1) observed = 'hidden'
      else if (response.blocks.some(b => b.type === 'question')) {
        observed = 'question'
        const question = response.blocks.find(b => b.type === 'question')
        assert.ok(item.explanation.includes(question.sourceQuote))
        assert.equal(question.purpose, item.reply.probe.purpose)
        assert.equal(question.source, 'provider')
      } else observed = 'stop'
    } catch (error) {
      if (!['TB05', 'TB06', 'TB07', 'TB08', 'TB09', 'TB11', 'TB12', 'TB13'].includes(item.id)) throw error
      observed = 'rejected'
    }
    t.diagnostic(JSON.stringify({ id: item.id, expected: item.expected, observed,
      mathOrTeachingQuality: 'not evaluated; fabricated provider reply' }))
    assert.equal(observed, item.expected, item.id)
  }
})

test('explanation references expire on editing, A-B-A and scope changes without storing mastery', () => {
  const reference = teachBackReference('problem-a', 1)
  assert.equal(isCurrentTeachBackReference(reference, 'problem-a', 1), true)
  assert.equal(isCurrentTeachBackReference(reference, 'problem-a', 2), false)
  assert.equal(isCurrentTeachBackReference(reference, 'problem-a', 3), false)
  assert.equal(isCurrentTeachBackReference(reference, 'problem-b', 1), false)
  assert.equal(isCurrentTeachBackReference({ scopeKey: 'problem-a', revision: '1' }, 'problem-a', 1), false)
  assert.throws(() => teachBackReference('', 1))
})
