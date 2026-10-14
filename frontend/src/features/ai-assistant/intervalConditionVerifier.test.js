import { createRouteConditionReading } from './routeConditionReading.js'
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { verifyIntervalCondition, INTERVAL_CONDITION_TOOL } from './intervalConditionVerifier.js'
import { buildAgentContext } from './contextEngine.js'
import { parseStrategyMapResponse } from './strategyMap.js'
import { createRouteConditionTarget, parseRouteConditionResponse } from './routeCondition.js'
import { learningScopeKey } from './learningFlow.js'
import { reviewRouteCondition, needsRouteConditionRange } from './routeConditionReview.js'
import { composeRouteConditionReviewResponse, validateAgentResponse } from './responseBlocks.js'
const bank = JSON.parse(readFileSync(new URL('../../../evals/interval-condition-cases.json', import.meta.url), 'utf8'))
for (const group of new Set(bank.cases.map(item => item.group))) {
  test(`IC independently specified interval contrast: ${group}`, () => {
    for (const sample of bank.cases.filter(item => item.group === group)) {
      const result = verifyIntervalCondition({ problemStatement: sample.problem, conditionText: sample.condition,
        readingUncertain: sample.readingUncertain })
      assert.equal(result.status, sample.status, sample.id)
      assert.equal(result.relation, sample.relation, sample.id)
      assert.equal(result.scope, 'single_variable_interval')
      assert.doesNotThrow(() => JSON.stringify(result))
    }
  })
}
test('IC validates bounded input and never executes expressions or assumes ambiguous readings', () => {
  const base = { problemStatement: '已知 x≥0，讨论。', conditionText: 'x≥0' }
  for (const input of [null, [], {}, { ...base, execute: 'code' }, { ...base, readingUncertain: 'false' },
    { ...base, problemStatement: 'x'.repeat(6001) }, { ...base, conditionText: 'x'.repeat(161) }]) {
    assert.equal(verifyIntervalCondition(input).reason, 'invalid_input')
  }
  for (const conditionText of ['x>=Math.random()', 'x∈[0,sqrt(2)]', '$x>=0', 'x>＝0', 'x∈[0;2]', 'x∈[0,2]?']) {
    assert.equal(verifyIntervalCondition({ ...base, conditionText }).status, 'unknown')
  }
  assert.equal(verifyIntervalCondition({ ...base, readingUncertain: true }).reason, 'unconfirmed_reading')
  assert.deepEqual(INTERVAL_CONDITION_TOOL.permissions, [])
})
function sampleContext(sample) {
  const page = { owner: 'synthetic', type: 'problem', id: sample.id, title: '单条件成对评测', text: sample.problem,
    answer: '参考答案秘密', solution: '参考解秘密' }
  const reference = { scopeKey: learningScopeKey(page, null), revision: 2 }
  const map = parseStrategyMapResponse(JSON.stringify({ overview: '整图秘密', choiceRule: '整图取舍秘密', preferredIndex: -1, routes: [
    { name: '差值或区间比较', when: sample.condition, firstMove: '所选首步秘密', workload: '所选成本秘密', switchSignal: '所选换路秘密',
      basis: { source: 'problem', sourceQuote: sample.problem.slice(0, 8), missingCondition: '' } },
    { name: '其他路线秘密', when: '另一条件秘密', firstMove: '另一首步秘密', workload: '另一成本秘密', switchSignal: '另一换路秘密',
      basis: { source: 'none', sourceQuote: '', missingCondition: '其他待补秘密' } },
  ] }), buildAgentContext({ intent: 'strategy', page }))
  const target = createRouteConditionTarget({ map, mapId: 'current-map', routeId: 'method-1', reference })
  const reading = sample.pair === 'uncertain_reading' ? null : createRouteConditionReading({
    target, problemStatement: page.text, note: sample.note, revision: 2 }, true)
  return buildAgentContext({ intent: 'route_condition', page, routeConditionTarget: target,
    routeConditionReading: reading, routeConditionRevision: 2,
    routeConditionMap: map, routeConditionMapId: 'current-map', expectedStrategyRef: reference,
    conversationScope: reference.scopeKey, userMessage: sample.note, includeReference: true,
    hintState: { revealed: ['旧提示秘密'] }, recentMessages: [{ role: 'assistant', scopeKey: reference.scopeKey, content: '旧判断秘密' }] })
}

test('IC local proof binds exactly one AI condition and never certifies notes or a whole method', () => {
  for (const [condition, status] of [['x≥0', 'valid'], ['x<0', 'invalid']]) {
    const context = sampleContext({ id: 'integration', problem: '已知 x∈[0,2]，讨论单调性。',
      condition, note: '我把 x 看成 y，还未确认读法。' })
    const response = composeRouteConditionReviewResponse(context), evidence = response.blocks[0]
    assert.equal(evidence.status, status); assert.equal(evidence.source, 'math_tool')
    assert.equal(evidence.provenance.tool, 'verify_interval_condition')
    assert.equal(evidence.contextRef.snapshotId, context.contextMetadata.snapshotId)
    assert.equal(evidence.conditionText, condition); assert.equal(evidence.routeId, 'method-1')
    assert.match(response.blocks.at(-1).content, /学生说明仍待单独判断/)
    assert.equal(response.blocks.some(item => ['question', 'error_location'].includes(item.type)), false)
    assert.equal(response.statePatch, undefined); assert.equal(validateAgentResponse(response), true)
    evidence.relation = status === 'valid' ? 'disjoint' : 'subset'; assert.equal(validateAgentResponse(response), false)
    evidence.relation = status === 'valid' ? 'subset' : 'disjoint'
    evidence.provenance.scope = 'single_difference_sign'; assert.equal(validateAgentResponse(response), false)
  }
})
test('IC missing material stops before a false affirmation and asks one scoped question without math-error evidence', () => {
  const context = sampleContext({ id: 'gap', problem: '已知 f(x)=x²，讨论单调性。', condition: 'x≥0', note: '' })
  assert.equal(reviewRouteCondition(context).status, 'unknown'); assert.equal(needsRouteConditionRange(context), true)
  const response = composeRouteConditionReviewResponse(context)
  assert.equal(response.metadata.status, 'unknown'); assert.equal(validateAgentResponse(response), true)
  assert.equal(response.blocks.filter(item => item.type === 'question').length, 1)
  assert.equal(response.blocks.some(item => ['verification', 'error_location'].includes(item.type) || item.source === 'provider'), false)
  assert.match(response.blocks.at(-1).content, /缺少材料不代表数学错误/)
  response.blocks[1].reason = 'interval_relation'; assert.equal(validateAgentResponse(response), false)
})
test('IC overlap, unsupported syntax and learner-supplied range never become automatic proof or redundant local range question', () => {
  for (const [problem, condition, note] of [
    ['已知 x∈[0,2]，讨论。', 'x>0', ''],
    ['已知 x≥0，或 x<0。', 'x≥0', ''],
    ['已知 f(x)=x²，讨论。', 'x≥0', '我只讨论 x≥0。'],
    ['已知 x∈[0,2]，讨论。', '需确认范围记号', ''],
  ]) {
    const context = sampleContext({ id: 'unsupported', problem, condition, note })
    assert.equal(reviewRouteCondition(context).status, 'unknown')
    assert.equal(needsRouteConditionRange(context), false)
    assert.throws(() => composeRouteConditionReviewResponse(context), /没有可用/)
  }
  const context = sampleContext({ id: 'forge', problem: '已知 x≥0，讨论。', condition: 'x≥0', note: '' })
  assert.throws(() => parseRouteConditionResponse(JSON.stringify({ routeId: 'method-1', conditionKind: 'applicability',
    conditionText: 'x≥0', status: 'addressed', feedback: '已核验', nextQuestion: '', provenance: { tool: 'verify_interval_condition' } }), context.routeCondition))
  const wrongAction = structuredClone(context); wrongAction.request.action = 'chat'
  assert.throws(() => reviewRouteCondition(wrongAction))
})

// Independent oracle for these finite integer-endpoint fixtures: one witness for each
// endpoint and each open cell covers every possible change of interval membership.
test('IC all finite small endpoint pairs agree with independent membership witnesses', () => {
  const ranges = []
  for (const lo of [-1, 0, 1]) for (const hi of [-1, 0, 1])
    for (const lc of [false, true]) for (const uc of [false, true]) {
      if (lo > hi || (lo === hi && !(lc && uc))) continue
      ranges.push({ lo, hi, lc, uc, text: `x∈${lc ? '[' : '('}${lo},${hi}${uc ? ']' : ')'}` })
    }
  const witnesses = [-2, -1, -0.5, 0, 0.5, 1, 2]
  const includes = (range, point) => (point > range.lo || (range.lc && point === range.lo))
    && (point < range.hi || (range.uc && point === range.hi))
  for (const given of ranges) for (const claim of ranges) {
    const subset = witnesses.every(point => !includes(given, point) || includes(claim, point))
    const overlap = witnesses.some(point => includes(given, point) && includes(claim, point))
    const expected = subset ? 'valid' : overlap ? 'unknown' : 'invalid'
    assert.equal(verifyIntervalCondition({ problemStatement: `已知 ${given.text}，讨论。`, conditionText: claim.text }).status,
      expected, `${given.text} / ${claim.text}`)
  }
})
