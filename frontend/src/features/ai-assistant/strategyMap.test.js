import assert from 'node:assert/strict'
import test from 'node:test'
import { parseStrategyMapResponse, validateStrategyMap } from './strategyMap.js'
import { composeStrategyMapResponse, validateAgentResponse } from './responseBlocks.js'
import { buildAgentContext } from './contextEngine.js'
import { renderTurnPrompt } from './contextPrompt.js'

const page = { type: 'problem', id: 'S1', title: '方法比较', text: '已知 f(x)=x²，判断单调性。',
  answer: '参考答案秘密', solution: '参考解秘密' }
const focus = { type: 'solution_step', problemId: 'S1', stepId: 'step-1', stepNumber: 1,
  selectedText: '平方变形', paragraphText: '先检查 x 的范围，再考虑平方变形。',
  previousSteps: [], nextStep: '后续答案秘密', sourceType: 'official', reviewStatus: 'approved' }
const context = buildAgentContext({ intent: 'strategy', page, focus, includeReference: true })
const example = { overview: '比较求导与代数结构，保留可行路线。', routes: [
  { name: '求导', when: '在可导区间讨论导数符号', firstMove: '写出导函数', workload: '核对区间和符号',
    switchSignal: '导数难以整理时比较另一方法',
    basis: { source: 'problem', sourceQuote: '单调性', missingCondition: '' } },
  { name: '代数结构', when: '平方结构可以直接比较大小', firstMove: '检查自变量所在区间', workload: '核对比较条件',
    switchSignal: '讨论范围跨过多个分支时改看导数',
    basis: { source: 'problem', sourceQuote: 'f(x)=x²', missingCondition: '' } },
], preferredIndex: -1, choiceRule: '先核对适用条件，再比较变形和验证工作量。' }
const clone = () => structuredClone(example)
const parse = (value, source = context) => parseStrategyMapResponse(JSON.stringify(value), source)

test('SM01 two alternative routes show exact source clues without forcing a preferred method', () => {
  const map = parseStrategyMapResponse('```json\n' + JSON.stringify(example) + '\n```', context)
  const response = composeStrategyMapResponse(map)
  assert.equal(map.preferredRouteId, null)
  assert.deepEqual(map.routes.map(route => route.basis.sourceQuote), ['单调性', 'f(x)=x²'])
  assert.deepEqual(response.blocks.map(block => block.type), ['strategy_map', 'warning'])
  assert.match(response.blocks[1].content, /只核对了来源.*不证明/)
  assert.equal(response.statePatch, undefined)
})

test('SM02 selected-step evidence stays local and cannot use excluded future/reference text', () => {
  const value = clone()
  value.routes[1].basis = { source: 'selection', sourceQuote: '平方变形', missingCondition: '需核对两边符号' }
  assert.equal(parse(value).routes[1].basis.source, 'selection')
  for (const sourceQuote of ['后续答案秘密', '参考解秘密', '旧问题秘密']) {
    value.routes[1].basis.sourceQuote = sourceQuote
    assert.throws(() => parse(value), /未逐字出现/)
  }
})

test('SM03 a clue must match the named source and current snapshot, not a different problem', () => {
  const value = clone()
  value.routes[0].basis = { source: 'selection', sourceQuote: '单调性', missingCondition: '' }
  assert.throws(() => parse(value), /未逐字出现/)
  const nextContext = buildAgentContext({ intent: 'strategy', page: { ...page, id: 'S2', text: '三角形中比较边角。' } })
  assert.throws(() => parse(example, nextContext), /未逐字出现/)
})

test('SM04 missing prerequisites stay explicit and cannot become a preferred route', () => {
  const value = clone()
  value.routes[0].basis = { source: 'none', sourceQuote: '', missingCondition: '需确认讨论区间内连续可导' }
  assert.equal(parse(value).preferredRouteId, null)
  assert.match(parse(value).routes[0].basis.missingCondition, /连续可导/)
  value.preferredIndex = 0
  assert.throws(() => parse(value), /仍缺依据或条件/)
  value.routes[0].basis = { source: 'problem', sourceQuote: '单调性', missingCondition: '需确认区间' }
  assert.throws(() => parse(value), /仍缺依据或条件/)
})

test('SM05 a grounded preliminary preference keeps other candidate routes available', () => {
  const value = clone()
  value.preferredIndex = 0
  value.routes[1].basis = { source: 'none', sourceQuote: '', missingCondition: '需确认能化为简单结构' }
  const map = parse(value)
  assert.equal(map.preferredRouteId, 'method-1')
  assert.equal(map.routes.length, 2)
  assert.equal(map.provenance, 'provider_unverified')
})

test('SM06 unsupported guarantees fail, while explicit uncertainty must not be treated as a guarantee', () => {
  for (const overview of ['求导是唯一最优方法。', '求导一定最快。', '该方法保证最快。', '无法保证其他方法最快，但求导一定最快。']) {
    assert.throws(() => parse({ ...clone(), overview }), /不能声称/)
  }
  for (const choiceRule of ['无法保证最快，应先核对条件。', '不一定最快，仍可比较两种路线。', '没有唯一最优方法。']) {
    assert.equal(parse({ ...clone(), choiceRule }).preferredRouteId, null)
  }
})

test('SM07 legacy missing basis and invented links cannot silently pass as grounded routes', () => {
  const value = clone()
  delete value.routes[0].basis
  assert.throws(() => parse(value), /每条路线/)
  const withLink = clone()
  withLink.routes[0].exampleUrl = 'https://invented.example/problem/1'
  assert.throws(() => parse(withLink), /每条路线/)
  assert.throws(() => parse({ ...clone(), exampleLinks: [] }), /结构不完整/)
  const textLink = clone(); textLink.routes[0].firstMove = '查看 https://invented.example/problem/1'
  assert.throws(() => parse(textLink), /本轮未检索例题/)
})

test('SM08 unknown, empty, oversized and inconsistent basis fields fail before rendering', () => {
  for (const basis of [
    { source: 'reference', sourceQuote: '单调性', missingCondition: '' },
    { source: 'none', sourceQuote: '', missingCondition: '' },
    { source: 'none', sourceQuote: '猜测', missingCondition: '需确认条件' },
    { source: 'problem', sourceQuote: '', missingCondition: '' },
    { source: 'problem', sourceQuote: '字'.repeat(81), missingCondition: '' },
    { source: 'none', sourceQuote: '', missingCondition: '字'.repeat(161) },
  ]) {
    const value = clone(); value.routes[0].basis = basis
    assert.throws(() => parse(value), /每条路线/)
  }
})

test('SM09 new basis fields obey the same obvious-answer guard as the rest of the route', () => {
  const value = clone()
  value.routes[1].basis = { source: 'none', sourceQuote: '', missingCondition: '最终答案：2' }
  const response = composeStrategyMapResponse(parse(value))
  assert.deepEqual(response.blocks.map(block => block.type), ['warning'])
  assert.doesNotMatch(response.blocks[0].content, /最终答案：2/)
})

test('SM10 response schema rejects a forged map even if it has two routes', () => {
  const response = composeStrategyMapResponse(parse(example))
  delete response.blocks[0].map.routes[0].basis
  assert.equal(validateAgentResponse(response), false)
  assert.equal(validateStrategyMap(response.blocks[0].map), false)
  assert.throws(() => composeStrategyMapResponse(response.blocks[0].map), /结构校验/)
})

test('SM11 strategy prompt contains permitted source text and explicitly excludes future answers', () => {
  const prompt = renderTurnPrompt(context, 'strategy')
  assert.match(prompt, /sourceQuote|missingCondition|AI 初步建议/)
  assert.match(prompt, /先检查 x 的范围/)
  assert.doesNotMatch(prompt, /参考答案秘密|参考解秘密|后续答案秘密/)
})

test('SM12 source opt-out, wrong action, incomplete JSON and unavailable selection all recover', () => {
  assert.throws(() => buildAgentContext({ intent: 'strategy', page, includePage: false }), /开启/)
  assert.throws(() => parseStrategyMapResponse('{}', context), /结构不完整/)
  assert.throws(() => parseStrategyMapResponse('not json', context), /未按路线图/)
  const chatContext = buildAgentContext({ intent: 'chat', page })
  assert.throws(() => parse(example, chatContext), /上下文不完整/)
  const withoutSelection = buildAgentContext({ intent: 'strategy', page })
  const value = clone(); value.routes[0].basis = { source: 'selection', sourceQuote: '平方变形', missingCondition: '' }
  assert.throws(() => parse(value, withoutSelection), /未逐字出现/)
})
