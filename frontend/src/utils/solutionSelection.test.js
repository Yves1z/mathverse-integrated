import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSolutionSelectionContext,
  resolveSolutionTrust,
  segmentSolutionText,
} from '../features/ai-assistant/solutionSelection.js'

test('解析文本按段落生成稳定且可追踪的步骤', () => {
  const source = '先求导。\n\n令 $f\'(x)=0$ 得到临界点。\n\n根据符号变化判断单调性。'
  const first = segmentSolutionText(source)
  const second = segmentSolutionText(source)

  assert.equal(first.length, 3)
  assert.deepEqual(first.map(({ id }) => id), second.map(({ id }) => id))
  assert.match(first[1].id, /^solution-step-2-/)
})

test('选区上下文只携带必要前文、当前步骤和一个后续步骤', () => {
  const text = '观察重复结构。\n\n令 u=x+y。\n\n原式转化为关于 u 的方程。\n\n最后回代。'
  const steps = segmentSolutionText(text)
  const context = buildSolutionSelectionContext({
    problem: { id: 'P1', title: '变量代换', solutionSourceType: 'official', reviewStatus: 'approved' },
    sectionType: 'solution',
    sectionLabel: '解析',
    sectionText: text,
    steps,
    stepIndex: 1,
    selectedText: '令 u=x+y',
  })

  assert.equal(context.type, 'solution_step')
  assert.equal(context.stepNumber, 2)
  assert.deepEqual(context.previousSteps, ['观察重复结构。'])
  assert.equal(context.nextStep, '原式转化为关于 u 的方程。')
  assert.equal(context.sourceType, 'official')
  assert.equal(context.reviewStatus, 'approved')
})

test('未审核社区解析会被识别为需要先核验的来源', () => {
  assert.deepEqual(
    resolveSolutionTrust({ solutionSourceType: 'community', solutionReviewStatus: 'pending' }),
    { sourceType: 'community', reviewStatus: 'pending' },
  )
})

