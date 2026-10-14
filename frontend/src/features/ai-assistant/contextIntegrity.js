import { assertDiscussionRange } from './routeConditionRange.js'
import { assertRouteConditionReading } from './routeConditionReading.js'
import { assertAttemptReview } from './attemptReview.js'
import { assertReadingConfirmation } from './readingReview.js'
import { assertTeachBackFollowUp } from './teachBack.js'
import { assertRouteConditionTarget } from './routeCondition.js'

// Runtime contract for the currently supported, provider-independent context slice.
export const CONTEXT_SCHEMA_VERSION = 1
export const CONTEXT_ACTIONS = Object.freeze({
  chat: 'ask',
  'search-help': 'ask',
  hint: 'request_hint',
  verify: 'verify',
  diagnose: 'diagnose_attempt',
  teach_back: 'teach_back',
  strategy: 'compare_methods',
  route_condition: 'check_route_condition',
  solution: 'show_solution',
  explain: 'explain_step',
})
const AUTHORS = new Set(['user', 'accepted_ai_suggestion'])
const TYPED_SOURCES = new Set(['plain_text', 'latex', 'mixed'])
const GUARDED_ACTIONS = new Set(['request_hint', 'verify', 'diagnose_attempt', 'teach_back', 'compare_methods', 'check_route_condition'])
const ACTIONS = new Set(Object.values(CONTEXT_ACTIONS))
const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0
const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0

export class ContextIntegrityError extends Error {
  constructor(code, message, recovery = 'retry') {
    super(message)
    this.name = 'ContextIntegrityError'
    this.code = code
    this.recovery = recovery
  }
}

function requireContext(condition, code, message, recovery) {
  if (!condition) throw new ContextIntegrityError(code, message, recovery)
}

export function assertAttemptIntegrity(attempt, problemId, expectedRef = null) {
  const message = '草稿步骤与原文或版本不一致，请修改草稿后重新检查'
  const check = (condition) => requireContext(condition, 'invalid_attempt', message, 'edit_attempt')
  check(attempt && nonEmpty(attempt.id) && positiveInteger(attempt.version))
  requireContext(nonEmpty(problemId) && attempt.problemId === problemId,
    'wrong_problem', '草稿与当前题目不一致，请重新打开题目后再检查', 'edit_attempt')
  if (expectedRef) {
    requireContext(attempt.id === expectedRef.id && attempt.version === expectedRef.version,
      'stale_attempt', '草稿版本已更新，请重新检查当前草稿', 'edit_attempt')
  }
  check(TYPED_SOURCES.has(attempt.source) && nonEmpty(attempt.rawText) && attempt.rawText.length <= 6000)
  check(Array.isArray(attempt.steps) && attempt.steps.length > 0 && attempt.steps.length <= 40)
  if (attempt.recognition) {
    const recognition = attempt.recognition
    try { assertReadingConfirmation(recognition, attempt.rawText) }
    catch { check(false) }
    check(nonEmpty(recognition.artifactId) && nonEmpty(recognition.sceneSignature)
      && positiveInteger(recognition.sourceRevision)
      && ['user_confirmed', 'user_edited_transcription'].includes(recognition.status)
      && nonEmpty(recognition.confirmedAt) && Number.isFinite(Date.parse(recognition.confirmedAt))
      && Array.isArray(recognition.blocks) && recognition.blocks.length <= 40)
    check(Array.isArray(attempt.rawArtifacts) && attempt.rawArtifacts.some((artifact) => (
      artifact.id === recognition.artifactId && (recognition.sourceKind === 'paper_image'
        ? validPaperArtifact(artifact)
        : artifact.type === 'ink_snapshot' && nonEmpty(artifact.content))
    )))
  }
  const ids = new Set()
  let previousEnd = 0
  attempt.steps.forEach((step, index) => {
    check(step && nonEmpty(step.id) && !ids.has(step.id) && step.number === index + 1)
    check(step.id === `${attempt.id}:v${attempt.version}:step${step.number}`)
    check(nonEmpty(step.rawContent) && AUTHORS.has(step.author))
    const range = step.sourceRange
    check(range && Number.isSafeInteger(range.start) && Number.isSafeInteger(range.end)
      && range.start >= previousEnd && range.end > range.start && range.end <= attempt.rawText.length)
    check(attempt.rawText.slice(range.start, range.end) === step.rawContent)
    check(!attempt.rawText.slice(previousEnd, range.start).trim())
    ids.add(step.id)
    previousEnd = range.end
  })
  check(!attempt.rawText.slice(previousEnd).trim())
  if (attempt.currentFocus != null) check(nonEmpty(attempt.currentFocus.stepId) && ids.has(attempt.currentFocus.stepId))
}

export function validPaperArtifact(artifact) {
  const crop = artifact.crop
  const blob = (value) => value instanceof Blob && ['image/png', 'image/jpeg', 'image/webp'].includes(value.type)
    && value.size > 0 && value.size <= 12 * 1024 * 1024
  const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
  return artifact.type === 'image_crop' && blob(artifact.originalBlob) && blob(artifact.croppedBlob)
    && [0, 90, 180, 270].includes(artifact.rotation === undefined ? 0 : artifact.rotation)
    && hash(artifact.originalHash) && hash(artifact.contentHash)
    && typeof artifact.dataUrl === 'string' && artifact.dataUrl.length <= 3_000_000
    && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(artifact.dataUrl)
    && crop && [crop.x, crop.y, crop.width, crop.height, crop.originalWidth, crop.originalHeight].every(Number.isSafeInteger)
    && crop.x >= 0 && crop.y >= 0 && crop.width >= 8 && crop.height >= 8
    && crop.originalWidth > 0 && crop.originalHeight > 0 && crop.originalWidth <= 12000 && crop.originalHeight <= 12000
    && crop.originalWidth * crop.originalHeight <= 40_000_000
    && crop.x + crop.width <= crop.originalWidth && crop.y + crop.height <= crop.originalHeight
}

export function assertSelectionIntegrity(focus) {
  // Rendered LaTeX can differ from the raw source. Check offsets only when the UI
  // was able to map the selection back to exact raw text (otherwise they are -1).
  const valid = nonEmpty(focus?.stepId) && positiveInteger(focus?.stepNumber)
    && nonEmpty(focus?.paragraphText) && typeof focus?.selectedText === 'string'
  requireContext(valid, 'invalid_selection', '当前引用无法定位，请取消引用后重新选择', 'clear_focus')
  if (focus.selectionStart >= 0) {
    requireContext(Number.isSafeInteger(focus.selectionStart) && Number.isSafeInteger(focus.selectionEnd)
      && focus.selectionEnd > focus.selectionStart && focus.selectionEnd <= focus.paragraphText.length
      && focus.paragraphText.slice(focus.selectionStart, focus.selectionEnd) === focus.selectedText,
    'invalid_selection', '当前引用与原文不一致，请取消引用后重新选择', 'clear_focus')
  }
}

export function assertContextIntegrity(context, intent = null) {
  const check = (condition) => requireContext(condition, 'invalid_context', '当前学习上下文不完整，请重新选择题目或引用')
  check(context?.contextMetadata?.schemaVersion === CONTEXT_SCHEMA_VERSION
    && nonEmpty(context.contextMetadata.snapshotId))
  check(ACTIONS.has(context.request?.action) && typeof context.request.userMessage === 'string')
  if (intent !== null) check(CONTEXT_ACTIONS[intent] === context.request.action)
  check(context.ui && typeof context.ui.contextLabel === 'string')
  check(context.tutoring && Number.isInteger(context.tutoring.currentHelpLevel)
    && context.tutoring.currentHelpLevel >= 0 && context.tutoring.currentHelpLevel <= 5
    && Array.isArray(context.tutoring.revealedInformation)
    && context.tutoring.revealedInformation.every((item) => typeof item === 'string'))
  if (context.problem) {
    check(nonEmpty(context.problem.problemId) && typeof context.problem.statement === 'string'
      && Array.isArray(context.problem.tags) && context.problem.tags.every((tag) => typeof tag === 'string'))
  }
  if (context.selection) {
    check(context.problem && context.selection.problemId === context.problem.problemId
      && nonEmpty(context.selection.sourceStepId) && typeof context.selection.paragraphText === 'string'
      && typeof context.selection.selectedText === 'string' && Array.isArray(context.selection.previousSteps)
      && context.selection.previousSteps.every((step) => typeof step === 'string'))
  }
  if (context.solution) check(context.problem && context.solution.problemId === context.problem.problemId)
  if (context.attempt) {
    const attempt = context.attempt
    check(nonEmpty(attempt.attemptId) && positiveInteger(attempt.version) && nonEmpty(attempt.problemId)
      && (!context.problem || context.problem.problemId === attempt.problemId)
      && Array.isArray(attempt.localSteps) && attempt.localSteps.length > 0)
    const ids = new Set()
    attempt.localSteps.forEach((step) => {
      check(step && nonEmpty(step.stepId) && !ids.has(step.stepId) && positiveInteger(step.order)
        && nonEmpty(step.rawContent) && AUTHORS.has(step.author))
      ids.add(step.stepId)
    })
    if (attempt.currentFocusStepId) check(ids.has(attempt.currentFocusStepId))
    if (attempt.hintTarget) {
      const t = attempt.hintTarget
      const explicitPremise = t.premiseStepId != null
      const windowSteps = explicitPremise ? attempt.localSteps.slice(1) : attempt.localSteps
      check(t.stepId === attempt.currentFocusStepId && ids.has(t.stepId)
        && t.attemptRef?.id === attempt.attemptId && t.attemptRef?.version === attempt.version
        && t.attemptRef?.problemId === attempt.problemId && typeof t.obstacle === 'string' && t.obstacle.length <= 500
        && windowSteps.length > 0 && windowSteps.length <= 3 && attempt.localSteps.at(-1).stepId === t.stepId
        && attempt.localSteps.at(-1).order === t.stepNumber
        && windowSteps.every((s, index) => s.order === t.stepNumber - windowSteps.length + index + 1)
        && (explicitPremise
          ? attempt.localSteps.length === 4 && windowSteps.length === 3
            && nonEmpty(t.premiseStepId) && positiveInteger(t.premiseStepNumber)
            && attempt.localSteps[0].stepId === t.premiseStepId
            && attempt.localSteps[0].order === t.premiseStepNumber
            && t.premiseStepNumber < windowSteps[0].order
          : t.premiseStepNumber == null))
    }
    if (attempt.review) assertAttemptReview(attempt.review, attempt)
  }
  const target = context.request.explicitTarget
  if (target) {
    check(nonEmpty(target.id))
    if (target.type === 'problem') check(target.id === (context.problem?.problemId || context.attempt?.problemId))
    else if (target.type === 'solution_step') check(target.id === context.selection?.sourceStepId)
    else if (target.type === 'attempt_step') check(context.attempt?.localSteps.some((step) => step.stepId === target.id))
    else check(false)
  }
  if (GUARDED_ACTIONS.has(context.request.action)) {
    requireContext(!context.solution && !context.selection?.nextStep
      && context.tutoring.solutionRevealPolicy === 'do_not_reveal',
    'reveal_policy', '本轮上下文超出了允许的提示范围，请重新请求')
  }
  if (context.request.action === 'diagnose_attempt') check(Boolean(context.attempt))
  if (context.teachBackFollowUp) {
    check(context.request.action === 'teach_back' && Boolean(context.problem) && !context.attempt && !context.conversation
      && nonEmpty(context.request.userMessage) && context.request.userMessage.length <= 1000)
    assertTeachBackFollowUp(context.teachBackFollowUp)
  }
  if (context.routeCondition || context.request.action === 'check_route_condition') {
    check(context.request.action === 'check_route_condition' && Boolean(context.problem) && !context.attempt
      && !context.conversation && context.request.userMessage.length <= 1000)
    assertRouteConditionTarget(context.routeCondition)
    assertDiscussionRange(context.routeConditionDiscussionRange)
    assertRouteConditionReading(context.routeConditionReading, { target: context.routeCondition,
      problemStatement: context.problem.statement, selection: context.selection || null,
      note: context.request.userMessage, discussionRange: context.routeConditionDiscussionRange, revision: context.routeConditionRevision })
    const clue = context.routeCondition.clue
    const source = clue.source === 'problem' ? context.problem.statement : context.selection?.paragraphText
    check(clue.source === 'none' || (typeof source === 'string' && source.includes(clue.sourceQuote)))
  }
  if (context.conversation) {
    check(Array.isArray(context.conversation.recentMessages)
      && context.conversation.recentMessages.length <= 6
      && context.conversation.recentMessages.every((message) => (
        message && ['user', 'assistant'].includes(message.role) && typeof message.content === 'string'
      )))
  }
  return context
}

export function freezeContext(context) {
  for (const value of Object.values(context)) {
    if (value && typeof value === 'object') freezeContext(value)
  }
  return Object.freeze(context)
}
