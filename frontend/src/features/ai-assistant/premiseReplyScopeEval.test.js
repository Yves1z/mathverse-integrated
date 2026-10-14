import test from 'node:test'
import assert from 'node:assert/strict'
import { commitTypedAttempt, attemptReference } from './typedAttempt.js'
import { buildAgentContext } from './contextEngine.js'
import { renderDraftHintPrompt } from './contextPrompt.js'
import { verifyOrderedDifferenceSign } from './premiseSignVerifier.js'
import { composeDraftHintResponse } from './responseBlocks.js'

// Fabricated replies test source/reveal contracts; they do not measure live teaching quality.
const cases = [
  { id: 'RD01', category: 'bold', reply: '先保持你的路线。\n\n**第 1 步完全正确**，可以直接沿用。\n接下来只观察真数条件。', expected: 'warning' },
  { id: 'RD02', category: 'bullet', reply: '先保持你的路线。\n- 第 1 步完全正确，可以沿用。\n- 接下来只观察真数条件。', expected: 'warning' },
  { id: 'RD03', category: 'numbered', reply: '先保持你的路线。\n1. 第 1 步完全正确，可以沿用。\n2. 接下来观察条件。', expected: 'warning' },
  { id: 'RD04', category: 'long_plain', reply: '我们先只看你选入的前文。第 1 步成立！请据此继续观察真数需要满足的条件。', expected: 'warning' },
  { id: 'RD05', category: 'quote_then_approval', reply: '不要说“这个前提成立”。\n__第 1 步完全正确__，可以直接沿用。', expected: 'warning' },
  { id: 'RD06', category: 'question_then_approval', reply: '先核对负号是否清楚？\n- 第 1 步完全正确，可以直接沿用。', expected: 'warning' },
  { id: 'RC01', category: 'condition_question', reply: '第一步成立的条件是什么？先核对题设。', expected: 'hint' },
  { id: 'RC02', category: 'unresolved_predicate', reply: '第一步正确与否，要先看负号。', expected: 'hint' },
  { id: 'RC03', category: 'hypothesis', reply: '第 1 步正确只是待检验的假设，不能直接沿用。', expected: 'hint' },
  { id: 'RC04', category: 'introduced_condition', reply: '关于这个前提：它成立的条件需要你核对。', expected: 'hint' },
  { id: 'RC05', category: 'multi_sentence_quote', reply: '你写的是“第一步完全正确。这个前提成立。”，请先核对这句话。', expected: 'hint' },
  { id: 'RC06', category: 'branch', reply: '如果满足分支条件，第一步成立；先确认 a 与 b 的大小。', expected: 'hint' },
  { id: 'RC07', category: 'qualified_branch', reply: '第 1 步成立，仅当 a>b 时才沿用；请先说明你讨论的分支。', expected: 'hint' },
  { id: 'RC08', category: 'choice_question', reply: '第 1 步正确，还是要补条件？先检查题设。', expected: 'hint' },
  { id: 'RC09', category: 'quoted_rejection', reply: '不要沿用「第一步完全正确。这个前提成立。」这个判断。先核对负号。', expected: 'hint' },
  { id: 'RC10', category: 'reading_caution', reply: '这里的短横读法仍需核对，先确认它是不是减号，再讨论第一步是否正确。', expected: 'hint' },
  { id: 'RC11', category: 'other_step', reply: '先看后面的目标。\n- 第 5 步完全正确吗？请先检查条件。', expected: 'hint' },
  { id: 'RC12', category: 'bold_question', reply: '**第 1 步完全正确吗？**先核对题设。', expected: 'hint' },
]

test('long reply contrasts preserve context and distinguish assertions from quoted or conditional review', t => {
  const page = { type: 'problem', id: 'P-reply-scope', text: '已知实数 a>b>0，研究差值。',
    answer: '参考答案秘密', solution: '参考解析秘密' }
  const attempt = commitTypedAttempt({ problemId: page.id, rawText: [
    '由 a>b>0 可知 a–b<0。', '未选入的第二步秘密。', '研究差值。',
    '考察真数条件。', '判断下一步。', '后续答案秘密。',
  ].join('\n\n') })
  assert.equal(verifyOrderedDifferenceSign({ problemStatement: page.text,
    premiseText: attempt.steps[0].rawContent }).status, 'unknown')
  const target = { attemptRef: attemptReference(attempt), stepId: attempt.steps[4].id,
    premiseStepId: attempt.steps[0].id, obstacle: '' }
  const context = buildAgentContext({ intent: 'hint', page, attempt, attemptHintTarget: target, hintLevel: 2 })
  assert.deepEqual(context.attempt.localSteps.map(s => s.order), [1, 3, 4, 5])
  assert.equal(context.attempt.localSteps[0].rawContent, attempt.steps[0].rawContent)
  const prompt = renderDraftHintPrompt(context)
  assert.doesNotMatch(prompt, /第二步秘密|后续答案秘密|参考答案秘密|参考解析秘密/)
  assert.match(prompt, /尚未验证/)
  const observations = cases.map(item => {
    const response = composeDraftHintResponse({ content: item.reply, hintLevel: 2,
      premiseStepNumber: context.attempt.localSteps[0].order })
    const observed = response.blocks[0].type
    if (observed === 'warning') {
      assert.equal(response.blocks[0].guardReason, 'unverified_premise_endorsement')
      assert.equal(response.blocks[0].attemptStepNumber, 1)
      assert.equal(response.blocks.some(b => b.type === 'hint'), false)
    } else {
      assert.equal(response.blocks[0].hintLevel, 2)
      assert.equal(response.blocks[0].content, item.reply, 'guard preprocessing must not rewrite displayed text')
    }
    return { id: item.id, category: item.category, expected: item.expected, observed,
      revealEvent: observed === 'hint' }
  })
  for (const observation of observations) t.diagnostic(JSON.stringify(observation))
  t.diagnostic(JSON.stringify({ falseBlocks: observations.filter(o => o.expected === 'hint' && o.observed === 'warning').length,
    missedBlocks: observations.filter(o => o.expected === 'warning' && o.observed === 'hint').length }))
  assert.deepEqual(observations.map(o => o.observed), cases.map(c => c.expected))
})

test('quote masking for premise review never bypasses the raw-text answer disclosure guard', () => {
  const response = composeDraftHintResponse({ content: '你写的是“答案为 3”，先核对这句话。',
    hintLevel: 2, premiseStepNumber: 1 })
  assert.equal(response.blocks[0].type, 'warning')
  assert.match(response.blocks[0].content, /泄露/)
  assert.doesNotMatch(response.blocks[0].content, /答案为 3/)
  assert.equal(response.blocks.some(b => b.type === 'hint'), false)
})

test('instructional suffixes do not masquerade as a question or a branch qualifier', () => {
  for (const content of ['第 1 步完全正确，还是继续沿用吧。', '第 1 步完全正确，只有继续计算才能往下走。']) {
    const response = composeDraftHintResponse({ content, hintLevel: 2, premiseStepNumber: 1 })
    assert.equal(response.blocks[0].guardReason, 'unverified_premise_endorsement')
    assert.equal(response.blocks.some(b => b.type === 'hint'), false)
  }
})
