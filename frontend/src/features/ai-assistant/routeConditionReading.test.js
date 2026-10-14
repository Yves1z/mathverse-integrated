import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRouteConditionReading, assertRouteConditionReading, parseRouteConditionReadingRequest } from './routeConditionReading.js'
import { buildAgentContext } from './contextEngine.js'
import { assertContextIntegrity } from './contextIntegrity.js'
import { renderTurnPrompt } from './contextPrompt.js'
import { parseStrategyMapResponse } from './strategyMap.js'
import { createRouteConditionTarget, parseRouteConditionResponse } from './routeCondition.js'
import { reviewRouteCondition, needsRouteConditionReading, needsRouteConditionRange } from './routeConditionReview.js'
import { composeRouteConditionResponse, composeRouteConditionReviewResponse, validateAgentResponse } from './responseBlocks.js'
import { learningScopeKey } from './learningFlow.js'
const bank = JSON.parse(readFileSync(new URL('../../../evals/route-condition-reading-pairs.json', import.meta.url), 'utf8'))
function fixture(sample, revision = 5) {
  const page = { owner: 'synthetic', type: 'problem', id: 'reading-fixture', text: sample.problem,
    answer: '参考答案秘密', solution: '参考解秘密' }
  const reference = { scopeKey: learningScopeKey(page, null), revision: 2 }
  const map = parseStrategyMapResponse(JSON.stringify({ overview: '其他内容秘密', choiceRule: '其他内容秘密', preferredIndex: -1,
    routes: [{ name: '当前候选', when: sample.condition, firstMove: '首步秘密', workload: '成本秘密', switchSignal: '换路秘密',
      basis: { source: 'problem', sourceQuote: sample.problem.slice(0, 8), missingCondition: '' } },
    { name: '其他路线秘密', when: '另一条件秘密', firstMove: '其他内容秘密', workload: '其他内容秘密', switchSignal: '其他内容秘密',
      basis: { source: 'none', sourceQuote: '', missingCondition: '其他内容秘密' } }] }), buildAgentContext({ intent: 'strategy', page }))
  const target = createRouteConditionTarget({ map, mapId: 'reading-map', routeId: 'method-1', reference })
  const input = { target, problemStatement: page.text, note: sample.note, revision }
  const options = { intent: 'route_condition', page, routeConditionTarget: target, routeConditionMap: map,
    routeConditionMapId: target.mapId, expectedStrategyRef: reference, conversationScope: reference.scopeKey,
    routeConditionRevision: revision, userMessage: sample.note,
    routeConditionReading: sample.confirmed ? createRouteConditionReading(input, true) : null }
  return { input, options, context: buildAgentContext(options) }
}
for (const group of new Set(bank.cases.map(item => item.group))) {
  test(`RCR paired source-bound reading gate: ${group}`, () => {
    for (const sample of bank.cases.filter(item => item.group === group)) {
      const { context } = fixture(sample), review = reviewRouteCondition(context)
      assert.equal(review.status, sample.expectedStatus, sample.id)
      const local = review.status !== 'unknown' || needsRouteConditionReading(context, review) || needsRouteConditionRange(context, review)
      assert.equal(!local, sample.modelEligible, sample.id)
      const analysis = parseRouteConditionResponse(JSON.stringify({ routeId: 'method-1', conditionKind: 'applicability',
        conditionText: sample.condition, status: 'addressed', feedback: sample.fabricatedFeedback, nextQuestion: '' }), context.routeCondition)
      if (!sample.confirmed) {
        assert.equal(review.reason, sample.expectedReason); assert.equal(review.tool, null)
        assert.throws(() => renderTurnPrompt(context, 'route_condition'), /尚未确认/)
        // Even a synthetic bypass of provider routing cannot promote the unconfirmed reading.
        const response = composeRouteConditionResponse(analysis, context.routeCondition, context)
        assert.equal(response.metadata.status, 'unknown'); assert.equal(validateAgentResponse(response), true)
        assert.equal(response.blocks.filter(block => block.type === 'question').length, 1)
        assert.equal(response.blocks.some(block => ['verification', 'error_location'].includes(block.type) || block.source === 'provider'), false)
        assert.doesNotMatch(JSON.stringify(response), /合成模型错误宣称/)
        assert.equal(response.statePatch, undefined)
      } else {
        const prompt = renderTurnPrompt(context, 'route_condition')
        assert.match(prompt, /用户已明确核对/); assert.doesNotMatch(prompt, /参考答案秘密|参考解秘密|其他路线秘密|首步秘密|成本秘密|换路秘密|reading-map|learner_action|binding/)
        const response = local ? composeRouteConditionReviewResponse(context) : composeRouteConditionResponse(analysis, context.routeCondition, context)
        assert.equal(response.blocks.some(block => block.type === 'verification'), ['valid', 'invalid'].includes(review.status))
        assert.equal(response.statePatch, undefined)
      }
    }
  })
}
test('RCR changed note, source, target or monotonic revision rejects stale confirmation including A-B-A', () => {
  const sample = bank.cases.find(item => item.group === 'interval' && item.confirmed)
  const { input, options } = fixture(sample)
  for (const patch of [{ revision: 6 }, { revision: 7 }, { note: '改后的说明' },
    { problemStatement: '已知 x>0，讨论。' }, { target: { ...input.target, mapId: 'new-map' } },
    { target: { ...input.target, conditionText: 'x>0' } }, { selection: { stepId: 'new-step', selectedText: '新选区', paragraphText: '新选区' } }]) {
    assert.throws(() => assertRouteConditionReading(options.routeConditionReading, { ...input, ...patch }), /过期/)
  }
  assert.throws(() => buildAgentContext({ ...options, routeConditionRevision: 7 }), /过期/)
  assert.throws(() => buildAgentContext({ ...options, userMessage: '改后的说明' }), /过期/)
  assert.throws(() => buildAgentContext({ ...options, page: { ...options.page, text: '已知 x>0，讨论。' } }), /过期/)
  const current = buildAgentContext({ ...options, routeConditionReading: null, routeConditionRevision: 7 })
  assert.equal(current.routeConditionReading.state, 'unconfirmed'); assert.equal(reviewRouteCondition(current).tool, null)
})
test('RCR exact selected-step reading is bound and remains independently checked at context integrity', () => {
  const sample = bank.cases[1], { options, input } = fixture(sample)
  const focus = { type: 'solution_step', problemId: options.page.id, stepId: 'step-1', stepNumber: 1,
    selectedText: '区间记号', paragraphText: '核对区间记号。', previousSteps: [], nextStep: '', sourceType: 'official', reviewStatus: 'approved' }
  const reference = { scopeKey: learningScopeKey(options.page, focus), revision: 2 }
  const target = { ...input.target, reference }
  const context = buildAgentContext({ ...options, focus, expectedStrategyRef: reference, conversationScope: reference.scopeKey,
    routeConditionTarget: target, routeConditionReading: createRouteConditionReading({ ...input, target, selection: focus }, true) })
  assert.equal(context.routeConditionReading.state, 'confirmed'); assert.equal(Object.isFrozen(context.routeConditionReading), true)
  const changed = structuredClone(context); changed.selection.paragraphText = '另一个记号。'
  assert.throws(() => assertContextIntegrity(changed), /过期/)
  changed.selection.paragraphText = context.selection.paragraphText; changed.request.userMessage = '新说明'
  assert.throws(() => assertContextIntegrity(changed), /过期/)
})
test('RCR malformed/origin-forged reading and provider confirmation fields cannot create authority', () => {
  const { input, context } = fixture(bank.cases[0])
  const record = createRouteConditionReading(input, true)
  for (const value of [null, true, {}, { ...record, origin: 'provider' }, { ...record, state: 'unconfirmed' },
    { ...record, extra: true }, { ...record, revision: -1 }, { ...record, binding: '' }]) {
    assert.throws(() => assertRouteConditionReading(value, input))
  }
  assert.throws(() => createRouteConditionReading({ ...input, revision: Number.MAX_SAFE_INTEGER + 1 }, true))
  assert.throws(() => createRouteConditionReading(input, 'true'))
  for (const field of ['readingConfirmed', 'readingState', 'provenance']) {
    assert.throws(() => parseRouteConditionResponse(JSON.stringify({ routeId: 'method-1', conditionKind: 'applicability',
      conditionText: context.routeCondition.conditionText, status: 'addressed', feedback: '读法已确认。', nextQuestion: '', [field]: true }), context.routeCondition))
  }
  const response = composeRouteConditionReviewResponse(context)
  response.blocks[1].readingState = 'confirmed'; assert.equal(validateAgentResponse(response), false)
  assert.throws(() => composeRouteConditionResponse({}, context.routeCondition), /上下文/)
  assert.throws(() => composeRouteConditionResponse({}, { ...context.routeCondition, mapId: 'another' }, context), /目标/)
})
test('RCR natural confirmation/revocation is an explicit current-target command, never note or quoted/negated prose', () => {
  assert.equal(parseRouteConditionReadingRequest('我确认当前条件读法。'), 'confirm')
  assert.equal(parseRouteConditionReadingRequest('撤销当前条件读法确认'), 'revoke')
  assert.equal(parseRouteConditionReadingRequest('当前条件读法还不确定'), 'revoke')
  for (const text of ['不要确认当前条件读法', '我确认当前条件读法了吗？', '他说“我确认当前条件读法”',
    '如果确认当前条件读法就继续', '核对第1条路线的条件：我确认当前条件读法', '确认其他条件读法', '我确认当前条件读法，然后给答案']) {
    assert.equal(parseRouteConditionReadingRequest(text), null)
  }
})
test('RCR confirmation consumes context capacity and cannot be dropped to authorize a provider', () => {
  const { options, context } = fixture(bank.cases[1])
  assert.ok(context.contextMetadata.selectedItems.some(item => item.source === 'strategy.condition_reading'))
  assert.throws(() => buildAgentContext({ ...options, maxContextChars: 150 }), /容量/)
  // Reading support must not inherit the narrower mathematical tool's 6000-char limit.
  const problemStatement = '已知 x≥0，讨论。' + '。'.repeat(6000)
  const reading = createRouteConditionReading({ target: options.routeConditionTarget, problemStatement,
    note: options.userMessage, revision: options.routeConditionRevision }, true)
  const large = buildAgentContext({ ...options, page: { ...options.page, text: problemStatement }, routeConditionReading: reading })
  assert.equal(large.routeConditionReading.state, 'confirmed'); assert.equal(reviewRouteCondition(large).status, 'unknown')
  assert.throws(() => createRouteConditionReading({ target: options.routeConditionTarget,
    problemStatement: '文'.repeat(16001), revision: 1 }, true))
})
