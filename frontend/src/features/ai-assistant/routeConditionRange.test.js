import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createDiscussionRange, assertDiscussionRange, parseDiscussionRangeRequest } from './routeConditionRange.js'
import { createRouteConditionReading } from './routeConditionReading.js'
import { buildAgentContext } from './contextEngine.js'
import { assertContextIntegrity } from './contextIntegrity.js'
import { renderTurnPrompt } from './contextPrompt.js'
import { parseStrategyMapResponse } from './strategyMap.js'
import { createRouteConditionTarget, parseRouteConditionResponse } from './routeCondition.js'
import { reviewRouteCondition, needsRouteConditionReading, needsRouteConditionRange, needsDiscussionRangeCorrection } from './routeConditionReview.js'
import { composeRouteConditionResponse, composeRouteConditionReviewResponse, validateAgentResponse } from './responseBlocks.js'
import { learningScopeKey } from './learningFlow.js'
const bank = JSON.parse(readFileSync(new URL('../../../evals/route-condition-range-pairs.json', import.meta.url), 'utf8'))
function fixture(sample, revision = 4) {
  const page = { owner: 'synthetic', type: 'problem', id: 'discussion-fixture', text: sample.problem,
    answer: '参考答案秘密', solution: '参考解秘密' }
  const reference = { scopeKey: learningScopeKey(page, null), revision: 2 }
  const map = parseStrategyMapResponse(JSON.stringify({ overview: '整图秘密', choiceRule: '整图秘密', preferredIndex: -1,
    routes: [{ name: '当前候选', when: sample.condition, firstMove: '首步秘密', workload: '成本秘密', switchSignal: '换路秘密',
      basis: { source: 'problem', sourceQuote: sample.problem.slice(0, 8), missingCondition: '' } },
    { name: '其他路线秘密', when: '另一条件秘密', firstMove: '首步秘密', workload: '成本秘密', switchSignal: '换路秘密',
      basis: { source: 'none', sourceQuote: '', missingCondition: '其他内容秘密' } }] }), buildAgentContext({ intent: 'strategy', page }))
  const target = createRouteConditionTarget({ map, mapId: 'discussion-map', routeId: 'method-1', reference })
  const input = { target, problemStatement: page.text, note: sample.note, revision, discussionRange: createDiscussionRange(sample.range) }
  const options = { intent: 'route_condition', page, routeConditionTarget: target, routeConditionMap: map,
    routeConditionMapId: target.mapId, expectedStrategyRef: reference, conversationScope: reference.scopeKey,
    routeConditionRevision: revision, routeConditionRangeText: sample.range, userMessage: sample.note,
    routeConditionReading: createRouteConditionReading(input, true) }
  return { options, input, context: buildAgentContext(options) }
}
function reply(sample, context) {
  return { routeId: 'method-1', conditionKind: 'applicability', conditionText: sample.condition,
    status: sample.status, feedback: '合成模型反馈：条件材料仍需讨论。', nextQuestion: sample.question,
    ...(context.routeConditionDiscussionRange ? { probe: sample.status === 'addressed' ? null : {
      kind: sample.kind, variable: sample.variable, source: sample.source, sourceQuote: sample.sourceQuote, purpose: sample.purpose } } : {}) }
}
for (const group of new Set(bank.cases.map(item => item.group))) {
  test(`RCD paired range/question/stop contract: ${group}`, t => {
    for (const sample of bank.cases.filter(item => item.group === group)) {
      const { context } = fixture(sample), review = reviewRouteCondition(context)
      const local = review.status !== 'unknown' || needsRouteConditionReading(context, review)
        || needsRouteConditionRange(context, review) || needsDiscussionRangeCorrection(context)
      assert.equal(!local, sample.modelEligible, sample.id)
      const response = local ? composeRouteConditionReviewResponse(context)
        : composeRouteConditionResponse(parseRouteConditionResponse(JSON.stringify(reply(sample, context)), context.routeCondition, context), context.routeCondition, context)
      const observed = local ? review.status === 'unknown' ? review.reason : review.status
        : response.metadata.status === 'range_recorded' ? 'range_recorded' : sample.status === 'addressed' ? 'addressed' : 'question'
      assert.equal(observed, sample.expected, sample.id)
      assert.equal(validateAgentResponse(response), true); assert.equal(response.statePatch, undefined)
      assert.equal(response.blocks.filter(block => block.type === 'question').length, ['question', 'missing_range', 'unsupported_discussion_range'].includes(observed) ? 1 : 0)
      assert.equal(response.blocks.some(block => block.type === 'verification'), ['valid', 'invalid'].includes(observed))
      if (observed === 'range_recorded') {
        assert.doesNotMatch(JSON.stringify(response), /合成模型反馈|你讨论什么区间/)
        assert.match(response.blocks.at(-1).content, /仍未验证/)
      }
      if (!local) {
        const prompt = renderTurnPrompt(context, 'route_condition')
        assert.doesNotMatch(prompt, /参考答案秘密|参考解秘密|其他路线秘密|首步秘密|成本秘密|换路秘密|discussion-map|binding|learner_scope/)
        if (context.routeConditionDiscussionRange) {
          assert.match(prompt, /独立于题设|probe|未经数学核验/)
          assert.match(prompt, /、probe、nextQuestion/)
          assert.equal((prompt.match(/probe 为上述第七个字段/g) || []).length, 1)
        }
      }
      t.diagnostic(JSON.stringify({ id: sample.id, observed, provider: 'mock only', mathematicalAcceptance: false }))
    }
  })
}
test('RCD supported scope syntax does not grant mathematical authority or extract prose', () => {
  assert.equal(createDiscussionRange(''), null)
  for (const [raw, canonical] of [['x≥0', 'x∈[0,+∞)'], ['$x\\geq 0$', 'x∈[0,+∞)'], ['-1/2<x<=.5', null], ['x∈[1/2,0.5]', 'x∈[1/2,1/2]']]) {
    const value = createDiscussionRange(raw)
    assert.equal(value.canonical, canonical); assert.equal(value.origin, 'learner_scope')
    assert.equal(Object.isFrozen(value), true); assert.equal(assertDiscussionRange(value), value)
  }
  for (const raw of ['我只讨论 x≥0。', 'x≥0 或 x<0', 'x∈[2,1]', 'x>0，但这不成立', 'x∈(0,0)', 'x>=1 2', 'x∈[0,∞]', 'x>1/0']) {
    assert.equal(createDiscussionRange(raw).state, 'unsupported', raw)
  }
  assert.throws(() => createDiscussionRange('字'.repeat(161)))
  const value = createDiscussionRange('x≥0')
  for (const patch of [{ origin: 'problem' }, { state: 'provided', canonical: 'x∈(-∞,+∞)' }, { extra: true }, { variable: 'y' }]) {
    assert.throws(() => assertDiscussionRange({ ...value, ...patch }))
  }
})
test('RCD range edit, forged origin, source and A-B-A revision invalidate old confirmation at integrity and composition', () => {
  const sample = bank.cases[1], { context, options } = fixture(sample)
  for (const changes of [{ routeConditionRangeText: 'x>0' }, { routeConditionRevision: 6 }, { userMessage: '改后说明' },
    { page: { ...options.page, text: '题设修改' } }]) assert.throws(() => buildAgentContext({ ...options, ...changes }), /过期/)
  const stale = structuredClone(context); stale.routeConditionDiscussionRange = createDiscussionRange('x>0')
  assert.throws(() => assertContextIntegrity(stale), /过期/)
  assert.throws(() => composeRouteConditionResponse({}, stale.routeCondition, stale), /过期/)
  stale.routeConditionDiscussionRange = { ...context.routeConditionDiscussionRange, origin: 'problem' }
  assert.throws(() => assertContextIntegrity(stale), /来源/)
  const renewed = buildAgentContext({ ...options, routeConditionRevision: 6, routeConditionReading: null })
  assert.equal(reviewRouteCondition(renewed).reason, 'unconfirmed_reading')
  assert.ok(context.contextMetadata.selectedItems.some(item => item.source === 'strategy.discussion_range'))
  assert.throws(() => buildAgentContext({ ...options, maxContextChars: 100 }), /容量/)
})
test('RCD enhanced question requires one exact current source and purpose; no extras, old feedback or fabricated proof', () => {
  const sample = bank.cases[2], { context } = fixture(sample), value = reply(sample, context)
  for (const patch of [{ probe: undefined }, { probe: null }, { probe: [] }, { verified: true },
    { probe: { ...value.probe, source: 'reference_solution' } }, { probe: { ...value.probe, sourceQuote: '旧反馈秘密' } },
    { probe: { ...value.probe, variable: 'x' } }, { probe: { ...value.probe, kind: 'discussion_range', variable: null } },
    { probe: { ...value.probe, purpose: '理由？条件？' } }, { probe: { ...value.probe, purpose: '' } },
    { probe: { ...value.probe, source: 'note', sourceQuote: '非负区间' } }, { probe: { ...value.probe, extra: true } },
    { status: 'addressed', nextQuestion: '' }]) {
    assert.throws(() => parseRouteConditionResponse(JSON.stringify({ ...value, ...patch }), context.routeCondition, context))
  }
  const parsed = parseRouteConditionResponse(JSON.stringify(value), context.routeCondition, context)
  const response = composeRouteConditionResponse(parsed, context.routeCondition, context)
  assert.equal(response.blocks[1].sourceQuote, '非负区间'); assert.equal(response.blocks[1].purpose, sample.purpose)
  for (const field of ['probeKind', 'sourceQuote', 'purpose', 'quoteSource']) {
    const changed = structuredClone(response); delete changed.blocks[1][field]
    assert.equal(validateAgentResponse(changed), false, field)
  }
  response.blocks[1].quoteSource = 'reference_solution'; assert.equal(validateAgentResponse(response), false)
  for (const field of ['sourceQuote', 'purpose']) {
    const unsafe = { ...value, probe: { ...value.probe, [field]: '最终答案：2' } }
    if (field === 'sourceQuote') assert.throws(() => parseRouteConditionResponse(JSON.stringify(unsafe), context.routeCondition, context))
    else assert.deepEqual(composeRouteConditionResponse(parseRouteConditionResponse(JSON.stringify(unsafe), context.routeCondition, context), context.routeCondition, context).blocks.map(item => item.type), ['warning'])
  }
})
test('RCD unsupported range cannot be promoted through a fabricated provider addressed response', () => {
  const sample = bank.cases[8], { context } = fixture(sample)
  const response = composeRouteConditionResponse({ ...reply(sample, context), status: 'addressed', nextQuestion: '', probe: null }, context.routeCondition, context)
  assert.equal(response.metadata.status, 'unknown'); assert.equal(response.blocks.some(item => item.source === 'provider'), false)
})
test('RCD explicit range command is anchored, does not confirm, and does not redirect quotes or negations', () => {
  assert.equal(parseDiscussionRangeRequest('本次讨论范围：x≥0'), 'x≥0')
  for (const text of ['不要本次讨论范围：x≥0', '他说本次讨论范围：x≥0', '核对第1条路线的条件：本次讨论范围：x≥0']) {
    assert.equal(parseDiscussionRangeRequest(text), null)
  }
})
