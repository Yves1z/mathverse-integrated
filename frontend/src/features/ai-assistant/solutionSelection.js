export const MATH_CONTEXT_TYPES = Object.freeze({
  GENERAL_CHAT: 'general_chat',
  PROBLEM: 'problem',
  SOLUTION_STEP: 'solution_step',
  FORMULA: 'formula',
  GRAPH: 'graph',
})

function hashText(value) {
  let hash = 2166136261
  for (const character of String(value ?? '')) {
    hash ^= character.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function segmentSolutionText(value, sectionType = 'solution') {
  const source = String(value ?? '').replace(/\r\n?/g, '\n').trim()
  if (!source) return []

  const paragraphBlocks = source
    .split(/\n[\t ]*\n+/)
    .map((text) => text.trim())
    .filter(Boolean)
  const stepPrefix = /^(?:步骤\s*\d+|解[:：]|证明[:：]|\(?\d+\)|（\d+）|\d+[.、])/i
  const blocks = paragraphBlocks.flatMap((paragraph) => {
    const lines = paragraph.split('\n').map((line) => line.trim()).filter(Boolean)
    if (lines.length < 2 || !lines.slice(1).some((line) => stepPrefix.test(line))) return [paragraph]
    const groups = []
    for (const line of lines) {
      if (!groups.length || stepPrefix.test(line)) groups.push(line)
      else groups[groups.length - 1] += `\n${line}`
    }
    return groups
  })

  return blocks.map((text, index) => ({
    id: `${sectionType}-step-${index + 1}-${hashText(text)}`,
    index,
    number: index + 1,
    text,
  }))
}

export function resolveSolutionTrust(problem = {}) {
  const declaredSource = String(
    problem.solutionSourceType || problem.answerSourceType || problem.contentSourceType || '',
  ).toLowerCase()
  const sourceType = ['official', 'community'].includes(declaredSource) ? declaredSource : 'unknown'
  const declaredReview = String(
    problem.solutionReviewStatus || problem.answerReviewStatus || problem.reviewStatus || '',
  ).toLowerCase()
  const reviewStatus = ['approved', 'pending', 'rejected'].includes(declaredReview)
    ? declaredReview
    : 'unknown'
  return { sourceType, reviewStatus }
}

export function buildSolutionSelectionContext({
  problem,
  sectionType,
  sectionLabel,
  sectionText,
  steps,
  stepIndex,
  selectedText,
}) {
  const safeSteps = Array.isArray(steps) ? steps : []
  const step = safeSteps[stepIndex]
  if (!step) return null
  const selection = String(selectedText ?? '').trim().slice(0, 800)
  const selectionStart = step.text.indexOf(selection)
  const trust = resolveSolutionTrust(problem)

  return {
    type: MATH_CONTEXT_TYPES.SOLUTION_STEP,
    problemId: String(problem?.id || ''),
    problemTitle: String(problem?.title || ''),
    solutionId: `${problem?.id || 'problem'}:${sectionType}:${hashText(sectionText)}`,
    sectionType,
    sectionLabel,
    stepId: step.id,
    stepNumber: step.number,
    selectedText: selection,
    paragraphText: step.text,
    previousSteps: safeSteps.slice(Math.max(0, stepIndex - 2), stepIndex).map(({ text }) => text),
    nextStep: safeSteps[stepIndex + 1]?.text || '',
    selectionStart,
    selectionEnd: selectionStart >= 0 ? selectionStart + selection.length : -1,
    ...trust,
  }
}
