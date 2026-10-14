import assert from 'node:assert/strict'
import test from 'node:test'
import { MATH_AGENT_EVAL_PROBLEMS } from './mathAgentEvalProblems.js'
import { MATH_AGENT_EVAL_SCENARIOS } from './mathAgentEvalScenarios.js'
import { commitTypedAttempt } from '../features/ai-assistant/typedAttempt.js'
import { buildAgentContext } from '../features/ai-assistant/contextEngine.js'

test('manual evaluation bank is isolated, complete, and uniquely addressed', () => {
  assert.equal(MATH_AGENT_EVAL_PROBLEMS.length, 4)
  assert.equal(new Set(MATH_AGENT_EVAL_PROBLEMS.map((problem) => problem.id)).size, 4)
  for (const problem of MATH_AGENT_EVAL_PROBLEMS) {
    assert.match(problem.id, /^MATEST\d{3}$/)
    assert.equal(problem.source, 'mock')
    assert.ok(problem.content && problem.answer && problem.solution)
  }
  assert.equal(MATH_AGENT_EVAL_SCENARIOS.length, 14)
  assert.equal(new Set(MATH_AGENT_EVAL_SCENARIOS.map((scenario) => scenario.id)).size, 14)
  for (const scenario of MATH_AGENT_EVAL_SCENARIOS) {
    assert.ok(MATH_AGENT_EVAL_PROBLEMS.some((problem) => problem.id === scenario.problemId))
    assert.ok(scenario.action && scenario.ability && scenario.expected)
  }
})

test('mixed-draft golden cases preserve the independently specified first-issue location', () => {
  const expected = [
    ['E11', 2, 4],
    ['E12', 1, 3],
    ['E13', 3, 3],
    ['E14', 2, null],
  ]
  for (const [id, firstIssue, firstArithmeticIssue] of expected) {
    const scenario = MATH_AGENT_EVAL_SCENARIOS.find((item) => item.id === id)
    const problem = MATH_AGENT_EVAL_PROBLEMS.find((item) => item.id === scenario.problemId)
    const attempt = commitTypedAttempt({ problemId: problem.id, rawText: scenario.draft })
    const context = buildAgentContext({ intent: 'diagnose',
      page: { type: 'problem', id: problem.id, text: problem.content, answer: problem.answer }, attempt })
    assert.equal(scenario.expectedFirstIssueStep, firstIssue)
    assert.ok(firstIssue >= 1 && firstIssue <= attempt.steps.length)
    assert.equal(context.attempt.review.firstInvalidStep, firstArithmeticIssue)
    assert.equal(context.solution, undefined)
  }
})

test('reference calculations at case boundaries agree with fixture answers', () => {
  const cubicMinimum = (a) => 2 - 2 * a ** 1.5
  assert.ok(cubicMinimum(0.25) > 0)
  assert.equal(cubicMinimum(1), 0)
  assert.ok(cubicMinimum(4) < 0)
  assert.equal(30 / 84, 5 / 14)
  assert.equal(18 / 64, 9 / 32)
  assert.notEqual(18 / 64, 3 / 8)
  for (const x of [-2, 2]) assert.equal(x * x / 4, 1)
  const logMaximum = (a) => -Math.log(a)
  assert.ok(logMaximum(0.5) > 0)
  assert.ok(Math.abs(logMaximum(1)) < 1e-12)
  assert.ok(logMaximum(2) < 0)
})
