import assert from 'node:assert/strict'
import test from 'node:test'
import {
  attemptFollowUpAction,
  buildTurnPrompt,
  hintInstruction,
  learningScopeKey,
  nextHintLevel,
  resolveLearningIntent,
  responseActions,
} from './learningFlow.js'

test('explicit natural language and buttons resolve to the same learning intent', () => {
  assert.equal(resolveLearningIntent('hint'), 'hint')
  assert.equal(resolveLearningIntent('chat', '再提示一点'), 'hint')
  assert.equal(resolveLearningIntent('chat', '请直接给我答案'), 'solution')
  assert.equal(resolveLearningIntent('chat', '只检查这一步，不要告诉我答案'), 'verify')
  assert.equal(resolveLearningIntent('chat', '为什么会想到这样做？'), 'chat')
  assert.equal(resolveLearningIntent('chat', '请检验我的理解'), 'teach_back_entry')
  assert.equal(resolveLearningIntent('chat', '检验我的理解：导数为正时函数递增'), 'teach_back')
  assert.equal(resolveLearningIntent('chat', '检验我的理解：完整解答应先求导'), 'teach_back')
  assert.equal(resolveLearningIntent('chat', '哪种方法更快？'), 'strategy')
})

test('hints progress within the reveal ladder and retain previous hints', () => {
  assert.equal(nextHintLevel(-1), 0)
  assert.equal(nextHintLevel(0), 1)
  assert.equal(nextHintLevel(4), 4)
  assert.equal(nextHintLevel(5), 5)
  assert.match(hintInstruction(5), /已经查看完整解答/)
  assert.match(hintInstruction(1, ['先观察导数的零点。']), /不要重复/)
  assert.equal(responseActions('hint', 0)[0].label, '再提示一点')
  assert.equal(responseActions('hint', 4)[0].label, '查看完整解答')
})

test('learning responses prioritize a learner attempt and keep more help available', () => {
  const hint = responseActions('hint', 1, { canWriteAttempt: true })
  assert.deepEqual(hint.map((action) => action.label), ['写下我的下一步', '再提示一点', '查看完整解答'])
  assert.equal(hint.filter((action) => action.primary).length, 1)
  assert.deepEqual(responseActions('hint', 4, { canWriteAttempt: true }).map((action) => action.label),
    ['写下我的下一步', '查看完整解答'])
  assert.equal(responseActions('explain', 0, { canWriteAttempt: true })[0].type, 'continue_attempt')
  assert.equal(responseActions('verify', 0, { canWriteAttempt: false }).length, 0)
  assert.equal(responseActions('solution', 5, { canWriteAttempt: true }).length, 0)
  assert.equal(attemptFollowUpAction({ routeStatus: 'valid_but_incomplete' }).label, '继续补充草稿')
  assert.equal(attemptFollowUpAction({ routeStatus: 'contains_logical_gap' }).label, '修改草稿')
  assert.equal(attemptFollowUpAction({ arithmeticIssue: true }).label, '修正这一行')
})

test('conversation scope includes the selected solution step', () => {
  const context = { owner: 'question', id: 'P1' }
  assert.notEqual(
    learningScopeKey(context, { type: 'solution_step', stepId: 'step-1' }),
    learningScopeKey(context, { type: 'solution_step', stepId: 'step-2' }),
  )
  assert.notEqual(learningScopeKey(context), learningScopeKey({ owner: 'question', id: 'P2' }))
})

test('hint and current-step checks omit future steps and reference solutions', () => {
  const options = {
    context: { id: 'P1', text: '题干', answer: '最终答案', solution: '完整解析' },
    focus: {
      type: 'solution_step',
      sectionLabel: '解析',
      stepNumber: 2,
      selectedText: '当前步骤',
      paragraphText: '当前步骤原文',
      previousSteps: ['前一步'],
      nextStep: '决定性后续步骤',
      sourceType: 'official',
      reviewStatus: 'approved',
    },
    contextLabel: 'P1 · 解析 · 第 2 步',
    includeContext: true,
    includeSolution: true,
  }
  for (const intent of ['hint', 'verify']) {
    const prompt = buildTurnPrompt({ ...options, intent })
    assert.match(prompt, /当前步骤原文/)
    assert.doesNotMatch(prompt, /决定性后续步骤|最终答案|完整解析/)
  }
  assert.match(buildTurnPrompt({ ...options, intent: 'solution' }), /完整解析/)
})
