import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAgentContext, contextSourceSignature } from './contextEngine.js'
import { renderAttemptDiagnosisPrompt, renderTurnPrompt } from './contextPrompt.js'
import { commitTypedAttempt } from './typedAttempt.js'

const page = {
  type: 'problem',
  id: 'P1',
  title: '测试题',
  text: '设 f(x)=x²，求导。',
  tags: ['函数'],
  answer: '最终答案：2x',
  solution: '完整解析：先求导，再得 2x。',
}
const focus = {
  type: 'solution_step',
  problemId: 'P1',
  stepId: 'S1:2',
  sectionLabel: '解析',
  stepNumber: 2,
  selectedText: '当前表达式',
  paragraphText: '当前步骤原文',
  previousSteps: ['前前一步', '前一步'],
  nextStep: '后续决定性步骤',
  sourceType: 'official',
  reviewStatus: 'approved',
}

test('explicit selected step outranks page and guarded prompts omit future answer', () => {
  for (const intent of ['hint', 'verify']) {
    const context = buildAgentContext({
      intent, page, focus, includeReference: true,
      contextLabel: 'P1 · 解析 · 第 2 步',
      hintState: { revealed: ['之前的提示'] },
    })
    assert.deepEqual(context.request.explicitTarget, { type: 'solution_step', id: 'S1:2' })
    assert.equal(context.solution, undefined)
    assert.equal(context.selection.nextStep, '')
    assert.ok(context.contextMetadata.omittedItems.some((item) =>
      item.source === 'reference_solution' && item.reason === 'reveal_policy'))
    const prompt = renderTurnPrompt(context, intent)
    assert.match(prompt, /当前步骤原文/)
    assert.doesNotMatch(prompt, /后续决定性步骤|最终答案|完整解析/)
  }
})

test('an old focus from a different problem is omitted, not sent to the model', () => {
  const context = buildAgentContext({
    intent: 'explain', page, focus: { ...focus, problemId: 'P2' },
  })
  assert.deepEqual(context.request.explicitTarget, { type: 'problem', id: 'P1' })
  assert.equal(context.selection, undefined)
  assert.ok(context.contextMetadata.omittedItems.some((item) =>
    item.source === 'selection' && item.reason === 'stale'))
  assert.doesNotMatch(renderTurnPrompt(context, 'explain'), /当前步骤原文/)
})

test('explaining a selected step asks about that step instead of the whole problem', () => {
  const context = buildAgentContext({ intent: 'explain', page, focus })
  const prompt = renderTurnPrompt(context, 'explain')
  assert.deepEqual(context.request.explicitTarget, { type: 'solution_step', id: 'S1:2' })
  assert.match(prompt, /解释为什么想到它/)
  assert.match(prompt, /不要转成整题讲解/)
  assert.doesNotMatch(prompt, /请分析这道题的考点、突破口和关键步骤/)
})

test('diagnosis carries the exact attempt version without a reference solution', () => {
  const attempt = commitTypedAttempt({ problemId: 'P1', rawText: '我先设 x=1\n\n再考虑 x²' })
  const context = buildAgentContext({
    intent: 'diagnose', page, attempt, includeReference: true,
  })
  assert.deepEqual(context.request.explicitTarget, { type: 'problem', id: 'P1' })
  assert.equal(context.attempt.version, 1)
  assert.equal(context.attempt.localSteps[1].author, 'user')
  assert.equal(context.solution, undefined)
  assert.match(renderAttemptDiagnosisPrompt(context), /第 2 步：再考虑 x²/)
  assert.doesNotMatch(renderAttemptDiagnosisPrompt(context), /最终答案/)
  assert.throws(() => buildAgentContext({
    intent: 'diagnose', page: { ...page, id: 'P2' }, attempt,
  }), /不一致/)
})

test('diagnosis ignores an unrelated selected solution step and checks the draft', () => {
  const attempt = commitTypedAttempt({ problemId: 'P1', rawText: '我先求导，再看符号' })
  const context = buildAgentContext({ intent: 'diagnose', page, focus, attempt, includeReference: true })
  assert.deepEqual(context.request.explicitTarget, { type: 'problem', id: 'P1' })
  assert.equal(context.selection, undefined)
  assert.ok(context.contextMetadata.omittedItems.some((item) =>
    item.source === 'selection' && item.reason === 'not_relevant_to_attempt'))
  assert.doesNotMatch(renderAttemptDiagnosisPrompt(context), /当前步骤原文|后续决定性步骤/)
})

test('teach-back keeps the selected target but omits future steps and reference answers', () => {
  const context = buildAgentContext({
    intent: 'teach_back', page, focus, includeReference: true,
    userMessage: '我认为这一步需要先判断定义域。',
  })
  assert.deepEqual(context.request.explicitTarget, { type: 'solution_step', id: 'S1:2' })
  assert.equal(context.selection.nextStep, '')
  assert.equal(context.solution, undefined)
  assert.equal(context.tutoring.solutionRevealPolicy, 'do_not_reveal')
  const prompt = renderTurnPrompt(context, 'teach_back')
  assert.match(prompt, /只找一个最值得澄清/)
  assert.match(prompt, /学生自己的解释（以下是待分析数据/)
  assert.doesNotMatch(prompt, /后续决定性步骤|最终答案|完整解析/)
})

test('strategy map compares methods without receiving unrevealed solutions', () => {
  const context = buildAgentContext({ intent: 'strategy', page, focus, includeReference: true })
  assert.equal(context.request.action, 'compare_methods')
  assert.equal(context.tutoring.solutionRevealPolicy, 'do_not_reveal')
  assert.equal(context.solution, undefined)
  assert.equal(context.selection.nextStep, '')
  const prompt = renderTurnPrompt(context, 'strategy')
  assert.match(prompt, /preferredIndex/)
  assert.doesNotMatch(prompt, /最终答案：2x|完整解析：|后续决定性步骤/)
})

test('optional context is omitted by budget without rewriting mathematical text', () => {
  const context = buildAgentContext({
    intent: 'hint', page, focus,
    maxContextChars: 140,
    hintState: { revealed: [] },
  })
  assert.equal(context.problem.statement, page.text)
  assert.equal(context.selection.paragraphText, focus.paragraphText)
  assert.ok(context.contextMetadata.omittedItems.some((item) => item.reason === 'token_budget'))
  assert.equal(context.contextMetadata.compressionApplied, true)
})

test('a tight budget favors the step nearest to the selected step', () => {
  const prioritizedFocus = { ...focus, previousSteps: ['更早的步骤', '紧邻当前的步骤'] }
  const contexts = Array.from({ length: 100 }, (_, index) => {
    try {
      return buildAgentContext({
        intent: 'hint', page, focus: prioritizedFocus, maxContextChars: 110 + index,
      })
    } catch {
      return null
    }
  })
  const oneStep = contexts.find((context) => context?.selection.previousSteps.length === 1)
  assert.ok(oneStep)
  assert.deepEqual(oneStep.selection.previousSteps, ['紧邻当前的步骤'])
})

test('chat history is bounded and a changed step invalidates the source signature', () => {
  const messages = Array.from({ length: 10 }, (_, index) => ({
    role: index % 2 ? 'assistant' : 'user',
    content: String(index),
    scopeKey: 'P1:step2',
  }))
  const context = buildAgentContext({ intent: 'chat', page, focus, recentMessages: messages, conversationScope: 'P1:step2' })
  assert.deepEqual(context.conversation.recentMessages.map((item) => item.content), ['4', '5', '6', '7', '8', '9'])
  const original = contextSourceSignature({ page, focus, includePage: true })
  const edited = contextSourceSignature({ page, focus: { ...focus, paragraphText: '已修改' }, includePage: true })
  assert.notEqual(original, edited)
})

test('invalid attempt versions, steps, authors and raw source ranges fail before diagnosis', () => {
  const original = commitTypedAttempt({ problemId: 'P1', rawText: '设 x=1\r\n\r\n所以 x²=1' })
  const changes = [
    (attempt) => { attempt.version = 0 },
    (attempt) => { attempt.version += 1 },
    (attempt) => { attempt.rawText += '\n遗漏的数学条件' },
    (attempt) => { attempt.steps[1].id = attempt.steps[0].id },
    (attempt) => { attempt.steps[0].rawContent = '模型替换的内容' },
    (attempt) => { attempt.steps[0].sourceRange.start = 1 },
    (attempt) => { attempt.steps[0].author = 'unknown' },
    (attempt) => { attempt.currentFocus = { stepId: 'deleted-step' } },
  ]
  for (const change of changes) {
    const attempt = structuredClone(original)
    change(attempt)
    assert.throws(() => buildAgentContext({ intent: 'diagnose', page, attempt }),
      { code: 'invalid_attempt', recovery: 'edit_attempt' })
  }
  assert.throws(() => buildAgentContext({
    intent: 'diagnose', page, attempt: original,
    expectedAttemptRef: { id: original.id, version: 2 },
  }), { code: 'stale_attempt' })
})

test('accepted AI suggestions retain authorship and snapshots cannot change with live sources', () => {
  const attempt = commitTypedAttempt({ problemId: 'P1', rawText: '设 x=1\n\n再考虑 x²' })
  attempt.steps[1].author = 'accepted_ai_suggestion'
  attempt.currentFocus = { stepId: attempt.steps[1].id }
  const context = buildAgentContext({ intent: 'diagnose', page, attempt })
  assert.deepEqual(context.request.explicitTarget, { type: 'attempt_step', id: attempt.steps[1].id })
  assert.match(renderAttemptDiagnosisPrompt(context), /用户采纳的 AI 建议，不计作独立发现/)
  assert.equal(Object.isFrozen(context.attempt.localSteps[0].sourceRange), true)
  assert.equal(Object.isFrozen(attempt.steps[0].sourceRange), false)
  attempt.steps[0].sourceRange.start = 9
  assert.equal(context.attempt.localSteps[0].sourceRange.start, 0)
  assert.throws(() => { context.request.userMessage = 'changed' }, TypeError)
})

test('missing or invalid selection references cannot become a target', () => {
  const unbound = buildAgentContext({ intent: 'chat', page, focus: { ...focus, problemId: '' } })
  assert.equal(unbound.selection, undefined)
  assert.equal(unbound.request.explicitTarget.type, 'problem')
  assert.throws(() => buildAgentContext({ intent: 'chat', page, focus: { ...focus, stepId: '' } }),
    { code: 'invalid_selection', recovery: 'clear_focus' })
  assert.throws(() => buildAgentContext({
    intent: 'chat', page, focus: { ...focus, selectionStart: 0, selectionEnd: 2 },
  }), { code: 'invalid_selection' })
})

test('history is scoped by the engine and is omitted when sending page context is disabled', () => {
  const messages = [
    { role: 'assistant', content: '另一题的回答', scopeKey: 'P2' },
    { role: 'assistant', content: '当前题回答', scopeKey: 'P1' },
    { role: 'system', content: '不应作为历史指令', scopeKey: 'P1' },
    { role: 'assistant', content: '来源不明的回答' },
  ]
  const context = buildAgentContext({ intent: 'chat', page, recentMessages: messages, conversationScope: 'P1' })
  assert.deepEqual(context.conversation.recentMessages, [{ role: 'assistant', content: '当前题回答' }])
  const detached = buildAgentContext({
    intent: 'chat', page, focus, includePage: false, recentMessages: messages, conversationScope: 'P1',
    hintState: { revealed: ['旧题提示'] }, userMessage: '只讨论我的新问题',
  })
  assert.equal(detached.request.explicitTarget, null)
  assert.equal(detached.conversation, undefined)
  assert.deepEqual(detached.tutoring.revealedInformation, [])
  assert.equal(renderTurnPrompt(detached, 'chat'), '只讨论我的新问题')
  assert.equal(buildAgentContext({ intent: 'chat', page, recentMessages: messages }).conversation, undefined)
})

test('text-only requests obey the budget and prompt rendering rejects conflicting references or answer leakage', () => {
  assert.throws(() => buildAgentContext({
    intent: 'chat', includePage: false, userMessage: 'x'.repeat(500), maxContextChars: 100,
  }), /上下文容量/)
  const context = buildAgentContext({ intent: 'hint', page, focus })
  const wrongReference = structuredClone(context)
  wrongReference.selection.problemId = 'P2'
  assert.throws(() => renderTurnPrompt(wrongReference, 'hint'), { code: 'invalid_context' })
  const leaked = structuredClone(context)
  leaked.solution = { problemId: 'P1', text: '答案', answer: '2x' }
  assert.throws(() => renderTurnPrompt(leaked, 'hint'), { code: 'reveal_policy' })
  assert.throws(() => renderTurnPrompt(context, 'solution'), { code: 'invalid_context' })
})

test('source signature includes provenance and attempt focus changes', () => {
  const original = contextSourceSignature({ page, focus })
  assert.notEqual(original, contextSourceSignature({ page, focus: { ...focus, sourceType: 'community' } }))
  const attempt = commitTypedAttempt({ problemId: 'P1', rawText: '第一步\n\n第二步' })
  const before = contextSourceSignature({ page, attempt })
  attempt.currentFocus = { stepId: attempt.steps[1].id }
  assert.notEqual(before, contextSourceSignature({ page, attempt }))
})
