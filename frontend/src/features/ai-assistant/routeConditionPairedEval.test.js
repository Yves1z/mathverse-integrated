import { createRouteConditionReading } from './routeConditionReading.js'
import { reviewRouteCondition, needsRouteConditionRange, needsRouteConditionReading } from './routeConditionReview.js'
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { buildAgentContext } from './contextEngine.js'
import { renderTurnPrompt } from './contextPrompt.js'
import { parseStrategyMapResponse } from './strategyMap.js'
import { createRouteConditionTarget, parseRouteConditionResponse } from './routeCondition.js'
import { composeRouteConditionResponse, composeRouteConditionReviewResponse, validateAgentResponse } from './responseBlocks.js'
import { learningScopeKey } from './learningFlow.js'

const bank = JSON.parse(readFileSync(new URL('../../../evals/route-condition-pairs.json', import.meta.url), 'utf8'))
export function sampleContext(sample) {
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
function runSample(sample) {
  const context = sampleContext(sample)
  const prompt = context.routeConditionReading.state === 'confirmed' ? renderTurnPrompt(context, 'route_condition')
    : (assert.throws(() => renderTurnPrompt(context, 'route_condition'), /尚未确认/), sample.condition)
  assert.match(prompt, new RegExp(sample.condition.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(prompt, /参考答案秘密|参考解秘密|整图秘密|整图取舍秘密|首步秘密|成本秘密|换路秘密|其他路线秘密|另一条件秘密|其他待补秘密|旧提示秘密|旧判断秘密/)
  const review = reviewRouteCondition(context)
  if (review.status !== 'unknown' || needsRouteConditionRange(context, review) || needsRouteConditionReading(context, review)) return { context, response: composeRouteConditionReviewResponse(context), providerEligible: false, toolStatus: review.status }
  const analysis = parseRouteConditionResponse(JSON.stringify({ routeId: context.routeCondition.routeId,
    conditionKind: context.routeCondition.conditionKind, conditionText: context.routeCondition.conditionText,
    status: sample.status, feedback: sample.feedback, nextQuestion: sample.question }), context.routeCondition)
  const response = composeRouteConditionResponse(analysis, context.routeCondition, context)
  assert.equal(response.statePatch, undefined)
  assert.equal(response.blocks.some(block => block.type === 'hint' || block.type === 'solution'), false)
  return { context, response, providerEligible: true, toolStatus: 'unknown' }
}
function record(t, sample, outcome) {
  const hasQuestion = outcome.response.blocks.some(block => block.type === 'question')
  const modelFeedbackShown = outcome.response.blocks.some(block => block.source === 'provider' && block.content === sample.feedback)
  t.diagnostic(JSON.stringify({ id: sample.id, pair: sample.pair, fixtureQuality: sample.quality,
    toolStatus: outcome.toolStatus, providerEligible: outcome.providerEligible,
    blockTypes: outcome.response.blocks.map(block => block.type), hasQuestion, modelFeedbackShown,
    residualSyntheticFailure: modelFeedbackShown && sample.quality !== 'acceptable_mock' }))
}

for (const pair of ['addressed', 'missing_interval', 'explicit_conflict', 'uncertain_reading']) {
  test(`RCQ paired contrast: ${pair}`, t => {
    const samples = bank.cases.filter(sample => sample.pair === pair)
    assert.equal(samples.length, 2)
    const outcomes = samples.map(sample => runSample(sample))
    samples.forEach((sample, index) => record(t, sample, outcomes[index]))
    for (const [index, sample] of samples.entries()) {
      const outcome = outcomes[index]
      if (pair === 'explicit_conflict') {
        assert.equal(outcome.providerEligible, false, 'an explicit strict-order sign should be settled before model work')
        assert.equal(outcome.response.blocks[0].type, 'verification')
        assert.equal(outcome.response.blocks[0].status, sample.tool)
        assert.equal(outcome.response.blocks.some(block => block.source === 'provider'), false)
      } else {
        assert.equal(outcome.response.blocks.some(block => block.type === 'verification'), false)
        assert.equal(outcome.response.blocks.some(block => block.type === 'error_location'), false)
        assert.match(outcome.response.blocks.at(-1).content, /未经数学工具验证/)
        assert.equal(outcome.response.blocks.some(block => block.type === 'question'), ['missing_interval', 'uncertain_reading'].includes(pair) ? true : Boolean(sample.question))
        if (['missing_interval', 'uncertain_reading'].includes(pair)) assert.equal(outcome.providerEligible, false)
      }
    }
  })
}


test('RCQ unsupported conditions and branches never acquire sign proof or an automatic learner error', () => {
  const base = bank.cases.find(sample => sample.id === 'RCQ05')
  for (const [problem, condition] of [
    ['已知实数 a≥b，研究差值。', 'a-b>0'],
    ['已知实数 a>b，或 a=b。', 'a-b<0'],
    ['已知实数 a>b，当 a=b 时讨论。', 'a-b<0'],
    ['已知实数 a>b，另有 a<b。', 'a-b<0'],
    [base.problem, '若 a-b<0 则尝试反证'],
    [base.problem, '有人说 a-b<0，但这不成立'],
    [base.problem, 'a-b<0 且 b>0'],
    [base.problem, 'a–b<0'],
    [base.problem, '$a-b<0$'],
    [base.problem, 'c-d<0'],
    [base.problem, '需确认 a-b>0'],
    ['讨论差值 a-b 的符号。', 'a-b<0'],
  ]) {
    const context = sampleContext({ ...base, problem, condition })
    assert.equal(reviewRouteCondition(context).status, 'unknown', `${problem} / ${condition}`)
    assert.throws(() => composeRouteConditionReviewResponse(context), /没有可用/)
  }
})

test('RCQ tool evidence is scoped to the selected AI condition, never student prose or a provider verification field', () => {
  const base = bank.cases.find(sample => sample.id === 'RCQ06')
  for (const [problem, condition, expected] of [
    ['已知实数 x>y，研究差值。', 'y-x<0', 'valid'],
    ['已知实数 x>y，研究差值。', 'x-y<0', 'invalid'],
    ['已知实数 p＞q，研究差值。', 'p−q＞0。', 'valid'],
  ]) {
    const context = sampleContext({ ...base, problem, condition, note: '假设 a-b<0，我也不确定记号。' })
    const response = composeRouteConditionReviewResponse(context)
    assert.equal(reviewRouteCondition(context).status, expected)
    assert.equal(response.blocks[0].status, expected)
    assert.equal(response.blocks[0].conditionText, condition)
    assert.equal(response.blocks[0].routeId, context.routeCondition.routeId)
    assert.equal(response.blocks[0].contextRef.snapshotId, context.contextMetadata.snapshotId)
    assert.match(response.blocks.at(-1).content, /学生说明仍待单独判断/)
    assert.equal(response.blocks.some(block => block.type === 'question' || block.type === 'error_location'), false)
    assert.equal(response.statePatch, undefined)
    assert.equal(validateAgentResponse(response), true)
    response.blocks[0].conditionText = ''
    assert.equal(validateAgentResponse(response), false)
  }
  const wrongAction = structuredClone(sampleContext(base)); wrongAction.request.action = 'chat'
  assert.throws(() => reviewRouteCondition(wrongAction))
  const context = sampleContext(base)
  assert.throws(() => parseRouteConditionResponse(JSON.stringify({ routeId: 'method-1', conditionKind: 'applicability',
    conditionText: base.condition, status: 'addressed', feedback: '模型自称已核验。', nextQuestion: '', verified: true }), context.routeCondition))
})
