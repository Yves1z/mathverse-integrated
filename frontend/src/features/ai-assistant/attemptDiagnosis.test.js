import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAttemptDiagnosisPrompt, parseAttemptDiagnosis } from './attemptDiagnosis.js'
import { composeAttemptResponse, validateAgentResponse } from './responseBlocks.js'
import { attemptReference, commitTypedAttempt, isCurrentAttemptReference } from './typedAttempt.js'
import { verifyArithmeticEquality } from './arithmeticVerifier.js'

const attempt = commitTypedAttempt({
  problemId: 'GS000002',
  rawText: '设 x = 2\n\n由此得到 x + 1 = 4',
})

test('typed attempt preserves the original text and increments on revision', () => {
  assert.equal(attempt.version, 1)
  assert.equal(attempt.steps.length, 2)
  assert.equal(attempt.steps[1].number, 2)
  assert.equal(attempt.rawArtifacts[0].content, attempt.rawText)
  const revised = commitTypedAttempt({
    previous: attempt,
    problemId: attempt.problemId,
    rawText: '设 x = 2\n\n由此得到 x + 1 = 3',
  })
  assert.equal(revised.id, attempt.id)
  assert.equal(revised.version, 2)
  assert.equal(attempt.rawText, '设 x = 2\n\n由此得到 x + 1 = 4')
  assert.equal(commitTypedAttempt({ previous: revised, problemId: revised.problemId, rawText: revised.rawText }), revised)
})

test('attempts require a problem and a non-empty bounded draft', () => {
  assert.throws(() => commitTypedAttempt({ problemId: '', rawText: 'x = 1' }), /题目/)
  assert.throws(() => commitTypedAttempt({ problemId: 'GS000002', rawText: '   ' }), /草稿/)
  assert.throws(() => commitTypedAttempt({ problemId: 'GS000002', rawText: 'x'.repeat(6001) }), /6000/)
})

test('source ranges refer to the exact original CRLF draft', () => {
  const draft = '第一步\r\n\r\n  第二步'
  const submitted = commitTypedAttempt({ problemId: 'GS000002', rawText: draft })
  assert.equal(submitted.steps.length, 2)
  assert.equal(draft.slice(
    submitted.steps[1].sourceRange.start,
    submitted.steps[1].sourceRange.end,
  ), '第二步')
})

test('diagnosis prompt is scoped to a single obstacle and excludes reference solution', () => {
  const prompt = buildAttemptDiagnosisPrompt({
    attempt,
    problem: { text: '解方程', solution: '不要发送这份参考解答' },
  })
  assert.match(prompt, /第 2 步/)
  assert.match(prompt, /只指出第一个真正阻断/)
  assert.doesNotMatch(prompt, /不要发送这份参考解答/)
})

test('model diagnosis is unverified and tied to an existing attempt step', () => {
  const parsed = parseAttemptDiagnosis(JSON.stringify({
    routeStatus: 'contains_logical_gap',
    firstIssueStep: 2,
    evidenceQuote: 'x + 1 = 4',
    feedback: '第二步需要再检查。',
    nextQuestion: '把 x = 2 代入后得到多少？',
  }), attempt)
  assert.equal(parsed.firstIssueStepId, attempt.steps[1].id)
  assert.equal(parsed.evidenceQuote, 'x + 1 = 4')
  assert.equal(parsed.provenance, 'provider_unverified')
  const response = composeAttemptResponse({ attempt, analysis: parsed })
  assert.deepEqual(response.blocks.map((item) => item.type), ['error_location', 'question', 'warning'])
  assert.equal(response.blocks[0].source, 'provider')
  assert.match(response.blocks[0].content, /草稿原文：x \+ 1 = 4/)
  assert.equal(validateAgentResponse(response), true)
  assert.throws(() => parseAttemptDiagnosis(JSON.stringify({
    routeStatus: 'contains_logical_gap',
    firstIssueStep: 9,
    feedback: '错误步骤',
    nextQuestion: '',
  }), attempt), /步骤/)
})

test('arithmetic findings are source-marked and leakage is hidden', () => {
  const arithmeticAttempt = commitTypedAttempt({ problemId: 'GS000002', rawText: '1 + 1 = 3' })
  const verified = composeAttemptResponse({
    attempt: arithmeticAttempt,
    arithmeticIssue: { step: arithmeticAttempt.steps[0], verification: verifyArithmeticEquality('1 + 1 = 3') },
  })
  assert.equal(verified.blocks[0].source, 'math_tool')
  assert.equal(verified.blocks[0].attemptVersion, 1)
  assert.equal(verified.blocks[1].type, 'verification')
  assert.equal(verified.blocks[1].checkedClaim, '1 + 1 = 3')
  assert.match(verified.blocks[1].content, /左侧等于 2，右侧等于 3/)
  assert.match(verified.blocks[0].content, /此前与其它逻辑尚未核验/)
  const leaked = composeAttemptResponse({
    attempt,
    analysis: parseAttemptDiagnosis(JSON.stringify({ routeStatus: 'valid', firstIssueStep: null,
      feedback: '最终答案：3', nextQuestion: '' }), attempt),
  })
  assert.deepEqual(leaked.blocks.map((item) => item.type), ['warning'])
  assert.doesNotMatch(leaked.blocks[0].content, /最终答案：3/)
})

test('contradictory route judgments and incomplete errors are rejected, including fenced JSON', () => {
  for (const routeStatus of ['valid', 'valid_but_incomplete', 'valid_but_inefficient']) {
    assert.throws(() => parseAttemptDiagnosis(JSON.stringify({ routeStatus, firstIssueStep: 2,
      feedback: '这里有错误。', nextQuestion: '' }), attempt), /矛盾/)
  }
  for (const routeStatus of ['contains_execution_error', 'contains_logical_gap', 'invalid_route']) {
    assert.throws(() => parseAttemptDiagnosis(JSON.stringify({ routeStatus, firstIssueStep: null,
      feedback: '路线错误。', nextQuestion: '' }), attempt), /矛盾/)
  }
  const viable = { routeStatus: 'valid_but_incomplete', firstIssueStep: null,
    feedback: '这条几何路线可以继续，不必换成参考解法。', nextQuestion: '' }
  const parsed = parseAttemptDiagnosis('```json\n' + JSON.stringify(viable) + '\n```', attempt)
  assert.equal(parsed.provenance, 'provider_unverified')
  assert.equal(parsed.firstIssueStepId, null)
  assert.throws(() => parseAttemptDiagnosis(JSON.stringify({ ...viable, nextQuestion: [] }), attempt), /反馈/)
})

test('feedback cannot be applied to edited text, another attempt, or a newer revision', () => {
  const reference = attemptReference(attempt)
  assert.equal(isCurrentAttemptReference(reference, attempt, attempt.rawText), true)
  assert.equal(isCurrentAttemptReference(reference, attempt, attempt.rawText + '\n修改'), false)
  const revised = commitTypedAttempt({ previous: attempt, problemId: attempt.problemId, rawText: 'x = 3' })
  const restoredText = commitTypedAttempt({ previous: revised, problemId: attempt.problemId, rawText: attempt.rawText })
  assert.equal(isCurrentAttemptReference(reference, restoredText, restoredText.rawText), false)
  const other = commitTypedAttempt({ problemId: 'OTHER', rawText: attempt.rawText })
  assert.equal(isCurrentAttemptReference(reference, other, other.rawText), false)
  const analysis = parseAttemptDiagnosis(JSON.stringify({ routeStatus: 'contains_logical_gap',
    firstIssueStep: 2, evidenceQuote: 'x + 1 = 4', feedback: '第二步需要检查。', nextQuestion: '' }), attempt)
  assert.throws(() => composeAttemptResponse({ attempt: restoredText, analysis }), /版本/)
  assert.throws(() => composeAttemptResponse({ attempt, analysis: { ...analysis, firstIssueStepId: 'invented' } }), /版本/)
  const arithmetic = commitTypedAttempt({ problemId: 'GS000002', rawText: '1 + 1 = 3' })
  const fixed = commitTypedAttempt({ previous: arithmetic, problemId: arithmetic.problemId, rawText: '1 + 1 = 2' })
  assert.throws(() => composeAttemptResponse({ attempt: fixed, arithmeticIssue: {
    step: arithmetic.steps[0], verification: verifyArithmeticEquality(arithmetic.rawText),
  } }), /证据/)
})

test('issue evidence must quote the located step exactly', () => {
  const base = { routeStatus: 'contains_logical_gap', firstIssueStep: 2,
    evidenceQuote: 'x + 1 = 4', feedback: '代入结果不符。', nextQuestion: '' }
  for (const quote of ['', 'x + 1 = 3', '设 x = 2', 'x + 1 = 4'.repeat(25)]) {
    assert.throws(() => parseAttemptDiagnosis(JSON.stringify({ ...base, evidenceQuote: quote }), attempt), /引用/)
  }
  assert.throws(() => parseAttemptDiagnosis(JSON.stringify({ ...base,
    routeStatus: 'valid', firstIssueStep: null }), attempt), /引用/)
  const parsed = parseAttemptDiagnosis(JSON.stringify(base), attempt)
  const forged = { ...parsed, evidenceQuote: '不存在的原文' }
  assert.throws(() => composeAttemptResponse({ attempt, analysis: forged }), /版本/)
})
