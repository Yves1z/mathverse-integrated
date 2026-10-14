import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyOrderedDifferenceSign } from './premiseSignVerifier.js'
import { composeDraftHintResponse } from './responseBlocks.js'

const base = '已知实数 a>b>0，研究差值。'
const cases = [
  { id: 'UE01', premise: '由 a>b>0 可知 a–b<0。', problem: base,
    reply: '第一步完全正确，可以直接沿用。', expected: 'warning' },
  { id: 'UE02', premise: 'a-b<0', problem: '已知实数 a>b>0，当 c=0 时讨论结果。',
    reply: '第 1 步完全正确，可以直接沿用。', expected: 'warning' },
  { id: 'UE03', premise: '有人说 a-b<0，但这不成立。', problem: base,
    reply: '补入的前提完全正确。', expected: 'warning' },
  { id: 'UE04', premise: '由 a>b>0 可知 a-?＜0。', problem: base,
    reply: '这个前提没问题。', expected: 'warning' },
  { id: 'UE05', premise: '由 a>b>0 可知 a–b<0。', problem: base,
    reply: '先看第 1 步：这一步没错，可以沿用。', expected: 'warning' },
  { id: 'UE06', premise: '由 a>b>0 可知 a–b<0。', problem: base,
    reply: '第 1 步是对的，继续往下推。', expected: 'warning' },
  { id: 'UE07', premise: '由 a>b>0 可知 a–b<0。', problem: base,
    reply: '这个前提可以放心沿用。', expected: 'warning' },
  { id: 'UE08', premise: '由 a>b>0 可知 a–b<0。', problem: base,
    reply: '关于补入的前提：它完全正确。', expected: 'warning' },
  { id: 'UC01', premise: '由 a>b>0 可知 a–b<0。', problem: base,
    reply: '先核对第 1 步中的减号写法。', expected: 'hint' },
  { id: 'UC02', premise: '由 a>b>0 可知 a–b<0。', problem: base,
    reply: '不要断言第一步完全正确，先核对条件。', expected: 'hint' },
  { id: 'UC03', premise: '由 a>b>0 可知 a–b<0。', problem: base,
    reply: '第一步是否正确？先核对题设。', expected: 'hint' },
  { id: 'UC04', premise: '由 a>b>0 可知 a–b<0。', problem: base,
    reply: '第一步完全正确，可以直接沿用。', premiseStepNumber: null, expected: 'hint' },
  { id: 'UC05', premise: '由 a>b>0 可知 a–b<0。', problem: base,
    reply: '第一步完全正确吗？先核对条件。', expected: 'hint' },
  { id: 'UC06', premise: '由 a>b>0 可知 a–b<0。', problem: base,
    reply: '第 5 步完全正确。', expected: 'hint' },
  { id: 'UC07', premise: '由 a>b>0 可知 a–b<0。', problem: base,
    reply: '如果第 1 步正确，再检查下一步。', expected: 'hint' },
  { id: 'UC08', premise: '由 a>b>0 可知 a–b<0。', problem: base,
    reply: '关于补入的前提：它完全正确吗？先核对符号。', expected: 'hint' },
  { id: 'UC09', premise: '由 a>b>0 可知 a–b<0。', problem: base,
    reply: '不要说“第 1 步完全正确”，先看条件。', expected: 'hint' },
  { id: 'UC10', premise: '由 a>b>0 可知 a–b<0。', problem: base,
    reply: '先看第 5 步：这一步没错。', expected: 'hint' },
]

test('unknown-premise endorsement bank separates scoped approval from questions and conditions', t => {
  for (const item of cases) {
    const tool = verifyOrderedDifferenceSign({ problemStatement: item.problem, premiseText: item.premise })
    assert.equal(tool.status, 'unknown', item.id)
    const response = composeDraftHintResponse({ content: item.reply, hintLevel: 0,
      premiseStepNumber: item.premiseStepNumber === null ? null : 1 })
    const observed = response.blocks[0].type
    t.diagnostic(JSON.stringify({ id: item.id, tool: tool.status, expected: item.expected,
      observed, revealEvent: observed === 'hint' }))
    assert.equal(observed, item.expected, item.id)
    if (observed === 'warning') {
      assert.doesNotMatch(response.blocks[0].content, /完全正确|没问题|是对的|没错|放心沿用/)
      assert.equal(response.blocks[0].guardReason, 'unverified_premise_endorsement')
    }
  }
})
