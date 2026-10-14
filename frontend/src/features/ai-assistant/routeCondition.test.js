import { createRouteConditionReading } from './routeConditionReading.js'
import assert from 'node:assert/strict'
import test from 'node:test'
import { createRouteConditionTarget, parseRouteConditionRequest, parseRouteConditionResponse } from './routeCondition.js'
import { parseStrategyMapResponse } from './strategyMap.js'
import { buildAgentContext } from './contextEngine.js'
import { assertContextIntegrity } from './contextIntegrity.js'
import { renderTurnPrompt } from './contextPrompt.js'
import { composeRouteConditionResponse, validateAgentResponse } from './responseBlocks.js'
import { learningScopeKey, resolveLearningIntent } from './learningFlow.js'

const page = { owner: 'local', type: 'problem', id: 'RC1', title: '路线条件', text: '已知 f(x)=x²，判断单调性。',
  answer: '参考答案秘密', solution: '参考解秘密' }
const focus = { type: 'solution_step', problemId: 'RC1', stepId: 'step-2', stepNumber: 2,
  selectedText: '平方变形', paragraphText: '先检查 x 的范围，再考虑平方变形。',
  previousSteps: ['必要前文'], nextStep: '未来答案秘密', sourceType: 'official', reviewStatus: 'approved' }
const reference = { scopeKey: learningScopeKey(page, focus), revision: 3 }
const rawMap = { overview: '整图概述秘密', choiceRule: '整图选择标准秘密', preferredIndex: -1, routes: [
  { name: '求导路线秘密', when: '在可导区间讨论导数符号', firstMove: '首步秘密一', workload: '成本秘密一', switchSignal: '换路秘密一',
    basis: { source: 'problem', sourceQuote: '单调性', missingCondition: '' } },
  { name: '代数结构', when: '平方结构可用于比较大小', firstMove: '首步秘密二', workload: '成本秘密二', switchSignal: '换路秘密二',
    basis: { source: 'selection', sourceQuote: '平方变形', missingCondition: '需核对自变量的范围' } },
] }
const map = parseStrategyMapResponse(JSON.stringify(rawMap), buildAgentContext({ intent: 'strategy', page, focus }))
const target = createRouteConditionTarget({ map, mapId: 'map-current', routeId: 'method-2', reference })
const options = { intent: 'route_condition', page, focus, routeConditionTarget: target, routeConditionMap: map,
  routeConditionMapId: 'map-current', expectedStrategyRef: reference, conversationScope: reference.scopeKey,
  hintState: { level: 2, revealed: ['另一方法旧提示秘密'], solutionRevealed: false },
  includeReference: true, userMessage: '我的说明：x 在非负区间。',
  recentMessages: [{ role: 'assistant', scopeKey: reference.scopeKey, content: '历史诊断秘密' }] }
options.routeConditionReading = createRouteConditionReading({ target, problemStatement: page.text, selection: focus,
  note: options.userMessage, revision: 0 }, true)
const reply = (overrides = {}) => ({ routeId: target.routeId, conditionKind: target.conditionKind,
  conditionText: target.conditionText, status: 'needs_input', feedback: '目前还缺少明确区间。',
  nextQuestion: '题目或你的讨论限定了什么区间？', ...overrides })
const parse = value => parseRouteConditionResponse(JSON.stringify(value), target)

test('RC01 only the selected condition, its clue and permitted current context enter the actual prompt', () => {
  const context = buildAgentContext(options)
  const prompt = renderTurnPrompt(context, 'route_condition')
  assert.equal(context.routeCondition.conditionKind, 'missing')
  assert.equal(context.request.action, 'check_route_condition')
  assert.match(prompt, /代数结构|需核对自变量的范围|平方变形|必要前文|我的说明/)
  assert.doesNotMatch(prompt, /求导路线秘密|整图概述秘密|整图选择标准秘密|首步秘密|成本秘密|换路秘密|参考答案秘密|参考解秘密|未来答案秘密|历史诊断秘密|map-current/)
  assert.equal(context.attempt, undefined); assert.equal(context.conversation, undefined)
  assert.deepEqual(context.tutoring.revealedInformation, [])
  assert.doesNotMatch(JSON.stringify(context), /另一方法旧提示秘密/)
  assert.equal(context.solution, undefined); assert.equal(context.selection.nextStep, '')
  assert.equal(Object.isFrozen(context.routeCondition.clue), true)
  assert.ok(context.contextMetadata.omittedItems.some(item => item.source === 'strategy.other_routes_and_history'))
})

test('RC02 applicability and missing prerequisites are separate targets; selecting one never sends the other', () => {
  const applicability = createRouteConditionTarget({ map, mapId: 'map-current', routeId: 'method-2', conditionKind: 'applicability', reference })
  const prompt = renderTurnPrompt(buildAgentContext({ ...options, routeConditionTarget: applicability,
    routeConditionReading: createRouteConditionReading({ target: applicability, problemStatement: page.text, selection: focus,
      note: options.userMessage, revision: 0 }, true) }), 'route_condition')
  assert.match(prompt, /平方结构可用于比较大小/)
  assert.doesNotMatch(prompt, /需核对自变量的范围/)
  const defaultFirst = createRouteConditionTarget({ map, mapId: 'map-current', routeId: 'method-1', reference })
  assert.equal(defaultFirst.conditionKind, 'applicability')
  assert.throws(() => createRouteConditionTarget({ map, mapId: 'map-current', routeId: 'method-1', conditionKind: 'missing', reference }), /不完整/)
  assert.throws(() => createRouteConditionTarget({ map, mapId: 'map-current', routeId: 'method-9', reference }), /没有这条路线/)
})

test('RC03 a forged map identity, changed condition or source clue fails before prompt/provider use', () => {
  for (const patch of [{ mapId: 'other-map' }, { routeName: '其他方法' }, { conditionText: '擅自换条件' },
    { clue: { source: 'problem', sourceQuote: '单调性' } }, { extra: true }]) {
    assert.throws(() => buildAgentContext({ ...options, routeConditionTarget: { ...target, ...patch } }))
  }
  const forgedMap = structuredClone(map); delete forgedMap.routes[1].basis
  assert.throws(() => buildAgentContext({ ...options, routeConditionMap: forgedMap }), /重新选择/)
})

test('RC04 stale map revisions and different current problem/focus cannot reuse the same target', () => {
  assert.throws(() => buildAgentContext({ ...options, expectedStrategyRef: { ...reference, revision: 4 } }), /过期/)
  assert.throws(() => buildAgentContext({ ...options, page: { ...page, id: 'RC2' }, focus: null }), /重新选择/)
  assert.throws(() => buildAgentContext({ ...options, focus: { ...focus, stepId: 'other-step' } }), /重新选择/)
  // A coherent forged target/ref for another scope still conflicts with this page's canonical scope.
  const otherRef = { ...reference, scopeKey: learningScopeKey({ ...page, id: 'RC2' }, null) }
  assert.throws(() => buildAgentContext({ ...options, expectedStrategyRef: otherRef, conversationScope: otherRef.scopeKey,
    routeConditionTarget: { ...target, reference: otherRef } }), /重新选择/)
})

test('RC05 matched quotes are checked against the immutable named source, including selected-step changes', () => {
  assert.throws(() => buildAgentContext({ ...options, focus: { ...focus, selectedText: '区间', paragraphText: '改看区间。' } }), /上下文|读法确认/)
  const context = structuredClone(buildAgentContext(options))
  context.routeCondition.clue.sourceQuote = '未来答案秘密'
  assert.throws(() => assertContextIntegrity(context), /上下文|读法确认/)
  context.routeCondition = null
  assert.throws(() => assertContextIntegrity(context), /不完整/)
})

test('RC06 one missing-material question and uncertain reading stay unverified without advancing hints', () => {
  for (const status of ['needs_input', 'uncertain']) {
    const value = parse(reply({ status, feedback: status === 'uncertain' ? '区间记号读法还不明确。' : '尚缺讨论范围。' }))
    const response = composeRouteConditionResponse(value, target, buildAgentContext(options))
    assert.deepEqual(response.blocks.map(block => block.type), ['text', 'question', 'warning'])
    assert.equal(value.provenance, 'provider_unverified')
    assert.equal(response.blocks[1].conditionText, target.conditionText)
    assert.equal(response.statePatch, undefined)
    assert.match(response.blocks.at(-1).content, /未经数学工具验证/)
    assert.equal(response.blocks.some(block => block.type === 'verification' || block.type === 'error_location'), false)
    assert.equal(validateAgentResponse(response), true)
  }
})

test('RC07 addressed stops at local feedback without asking another question or declaring mastery', () => {
  const response = composeRouteConditionResponse(parse(reply({ status: 'addressed', feedback: '本次范围说明已回应该条件。', nextQuestion: '' })), target, buildAgentContext(options))
  assert.deepEqual(response.blocks.map(block => block.type), ['text', 'warning'])
  assert.equal(response.metadata.status, 'addressed'); assert.equal(response.statePatch, undefined)
})

test('RC08 switched target, malformed output, extra verification and multiple questions are rejected', () => {
  for (const overrides of [{ routeId: 'method-1' }, { conditionKind: 'applicability' }, { conditionText: '换成另一条件' },
    { status: 'clear' }, { verified: true }, { feedback: '为什么？' }, { nextQuestion: '范围？符号？' },
    { status: 'addressed' }, { nextQuestion: '' }, { feedback: '字'.repeat(241) }, { nextQuestion: '字'.repeat(201) }]) {
    assert.throws(() => parse(reply(overrides)))
  }
  assert.throws(() => parseRouteConditionResponse('plain answer', target), /未按条件核对格式/)
  assert.equal(parseRouteConditionResponse('```json\n' + JSON.stringify(reply()) + '\n```', target).status, 'needs_input')
})

test('RC09 obvious answers in local feedback or the question are hidden; forged question blocks fail', () => {
  for (const overrides of [{ feedback: '最终答案：2' }, { nextQuestion: '答案为 2，对吗？' }]) {
    const response = composeRouteConditionResponse(parse(reply(overrides)), target, buildAgentContext(options))
    assert.deepEqual(response.blocks.map(block => block.type), ['warning'])
    assert.doesNotMatch(response.blocks[0].content, /答案[:：为] ?2/)
  }
  const response = composeRouteConditionResponse(parse(reply()), target, buildAgentContext(options))
  response.blocks[1].conditionText = ''
  assert.equal(validateAgentResponse(response), false)
})

test('RC10 source opt-out, missing map, oversized note and insufficient budget cannot make a request', () => {
  for (const changes of [{ includePage: false }, { routeConditionMap: null }, { routeConditionTarget: null },
    { userMessage: '字'.repeat(1001) }, { maxContextChars: 10 }]) assert.throws(() => buildAgentContext({ ...options, ...changes }))
})

test('RC11 explicit numbered natural-language selection is bounded and does not redirect denials or full answers', () => {
  assert.deepEqual(parseRouteConditionRequest('请核对第 2 条路线的待补条件：x 非负'), { routeIndex: 1, conditionKind: 'missing', note: 'x 非负' })
  assert.equal(resolveLearningIntent('chat', '核对第1条路线的适用条件'), 'route_condition')
  assert.equal(resolveLearningIntent('chat', '不要核对第2条路线的条件'), 'chat')
  assert.equal(resolveLearningIntent('chat', '核对第2条路线的条件是什么意思'), 'chat')
  assert.equal(resolveLearningIntent('chat', '给出完整解答'), 'solution')
  assert.equal(parseRouteConditionRequest('核对第0条路线的条件').routeIndex, -1)
})
