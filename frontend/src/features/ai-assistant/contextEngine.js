import { createDiscussionRange } from './routeConditionRange.js'
import { createRouteConditionReading, assertRouteConditionReading } from './routeConditionReading.js'
import { buildAttemptReview } from './attemptReview.js'
import { validateDraftStepTarget } from './draftHint.js'
import { verifyOrderedDifferenceSign } from './premiseSignVerifier.js'
import { assertTeachBackFollowUp } from './teachBack.js'
import { assertRouteConditionTarget } from './routeCondition.js'
import { validateStrategyMap } from './strategyMap.js'
import { learningScopeKey } from './learningFlow.js'
import {
  assertAttemptIntegrity,
  assertContextIntegrity,
  assertSelectionIntegrity,
  CONTEXT_ACTIONS,
  CONTEXT_SCHEMA_VERSION,
  freezeContext,
} from './contextIntegrity.js'

const GUARDED_INTENTS = new Set(['hint', 'verify', 'diagnose', 'teach_back', 'strategy', 'route_condition'])
const DEFAULT_MAX_CONTEXT_CHARS = 16000

function selectedItem(source, id) {
  return { source, id: String(id || '') }
}

function omittedItem(source, reason) {
  return { source, reason }
}

export function contextSourceSignature({ page, focus, attempt, includePage, includeReference }) {
  return JSON.stringify([
    page?.owner, page?.type, page?.id, page?.title, page?.tags, page?.text, page?.answer, page?.solution,
    focus?.type, focus?.problemId, focus?.solutionId, focus?.stepId, focus?.stepNumber,
    focus?.sectionLabel, focus?.selectedText, focus?.paragraphText,
    focus?.previousSteps, focus?.nextStep, focus?.sourceType, focus?.reviewStatus,
    focus?.selectionStart, focus?.selectionEnd,
    attempt?.id, attempt?.version, attempt?.rawText, attempt?.currentFocus, attempt?.steps,
    Boolean(includePage), Boolean(includeReference),
  ])
}

export function buildAgentContext({
  intent,
  page,
  focus = null,
  attempt = null,
  attemptHintTarget = null,
  expectedAttemptRef = null,
  hintState = null,
  hintLevel = 0,
  userMessage = '',
  routeConditionTarget = null,
  routeConditionReading = null,
  routeConditionRevision = 0,
  routeConditionRangeText = '',
  routeConditionMap = null,
  routeConditionMapId = null,
  expectedStrategyRef = null,
  teachBackFollowUp = null,
  teachBackExplanation = '',
  expectedTeachBackRef = null,
  contextLabel = '',
  includePage = true,
  includeReference = false,
  recentMessages = [],
  conversationScope = '',
  maxContextChars = DEFAULT_MAX_CONTEXT_CHARS,
}) {
  const pageId = String(page?.id || '')
  const selectedItems = []
  const omittedItems = []
  const selected = (source, id) => selectedItems.push(selectedItem(source, id))
  const omitted = (source, reason) => omittedItems.push(omittedItem(source, reason))
  const guarded = GUARDED_INTENTS.has(intent)
  const focusMatchesPage = page?.type === 'problem' && Boolean(pageId)
    && focus?.type === 'solution_step' && String(focus.problemId || '') === pageId
  if (focus?.type === 'solution_step' && !focusMatchesPage) omitted('selection', 'stale')
  const attemptTarget = Boolean(attempt) && (intent === 'diagnose' || intent === 'hint')
  if (focusMatchesPage && attemptTarget) omitted('selection', 'not_relevant_to_attempt')
  if (attempt) assertAttemptIntegrity(attempt, pageId, expectedAttemptRef)
  const localHintTarget = attemptHintTarget ? validateDraftStepTarget(attempt, attemptHintTarget) : null
  if (localHintTarget && intent !== 'hint') throw new Error('局部草稿目标仅用于提示')
  if (localHintTarget?.premiseStepId) {
    const premise = attempt.steps.find((step) => step.id === localHintTarget.premiseStepId)
    const signCheck = verifyOrderedDifferenceSign({ problemStatement: page?.text, premiseText: premise.rawContent })
    if (signCheck.status === 'invalid') {
      const error = new Error(`草稿第 ${premise.number} 步的“${signCheck.checkedClaim}”与题目条件“${signCheck.assumptions[0]}”冲突；由该条件可核对“${signCheck.expectedClaim}”。本次未发送给模型。请修改草稿或取消补入这一前提；这里只核对差值符号，未验证整步。`)
      error.name = 'PremiseConflictError'
      error.recovery = 'edit_attempt'
      error.toolResult = signCheck
      throw error
    }
  }
  const selectedFocus = includePage && focusMatchesPage && !attemptTarget
  if (selectedFocus) assertSelectionIntegrity(focus)
  const problemIncluded = includePage && page?.type === 'problem' && Boolean(pageId)
  if (intent === 'strategy' && !problemIncluded) throw new Error('请开启当前题目上下文后再比较解法路线')

  const request = {
    action: CONTEXT_ACTIONS[intent],
    userMessage: String(userMessage || ''),
    explicitTarget: localHintTarget ? { type: 'attempt_step', id: localHintTarget.stepId } : attempt?.currentFocus?.stepId
      ? { type: 'attempt_step', id: String(attempt.currentFocus.stepId) }
      : selectedFocus
        ? { type: 'solution_step', id: String(focus.stepId || '') }
        : problemIncluded || attempt ? { type: 'problem', id: pageId } : null,
    timestamp: new Date().toISOString(),
  }
  selected('request', request.action)
  if (request.explicitTarget) selected('target', request.explicitTarget.id)

  const result = {
    request,
    tutoring: {
      currentHelpLevel: Number(hintLevel) || 0,
      revealedInformation: intent !== 'route_condition' && !localHintTarget && includePage && Array.isArray(hintState?.revealed) ? hintState.revealed.slice(-3) : [],
      solutionRevealed: Boolean(hintState?.solutionRevealed),
      solutionRevealPolicy: guarded ? 'do_not_reveal' : intent === 'solution' ? 'explicit_user_request' : 'default',
    },
    ui: {
      pageType: page?.type === 'problem' ? 'problem' : 'other',
      contextLabel: String(contextLabel || page?.title || ''),
      visibleProblemId: pageId || undefined,
    },
    contextMetadata: {
      schemaVersion: CONTEXT_SCHEMA_VERSION,
      snapshotId: crypto.randomUUID(),
      selectedItems,
      omittedItems,
      tokenEstimate: 0,
      compressionApplied: false,
      expansionLevel: 0,
      generatedAt: request.timestamp,
    },
  }
  let usedChars = request.userMessage.length + JSON.stringify(result.tutoring).length
  const limit = Number.isFinite(maxContextChars) ? Math.max(0, maxContextChars) : DEFAULT_MAX_CONTEXT_CHARS
  const requireSpace = (source, size, id = pageId) => {
    if (usedChars + size > limit) throw new Error('当前题目或草稿超出本轮上下文容量，请缩小引用范围')
    usedChars += size
    selected(source, id)
  }

  // Enforce the budget even for text-only requests with no attached page.
  requireSpace('request_and_tutoring', 0)
  if (routeConditionTarget || intent === 'route_condition') {
    if (intent !== 'route_condition' || !problemIncluded || !validateStrategyMap(routeConditionMap)
      || !expectedStrategyRef || expectedStrategyRef.scopeKey !== conversationScope
      || conversationScope !== learningScopeKey(page, selectedFocus ? focus : null)
      || request.userMessage.length > 1000) throw new Error('请重新选择当前题目的路线条件；说明最多 1000 字。')
    assertRouteConditionTarget(routeConditionTarget, { map: routeConditionMap, mapId: routeConditionMapId, reference: expectedStrategyRef })
    result.routeCondition = structuredClone(routeConditionTarget)
    requireSpace('strategy.selected_condition', JSON.stringify(result.routeCondition).length, routeConditionTarget.routeId)
    omitted('strategy.other_routes_and_history', 'locality')
    omitted('tutoring.previous_hint_text', 'locality')
  }
  if (teachBackFollowUp) {
    if (intent !== 'teach_back' || !problemIncluded || !expectedTeachBackRef
      || expectedTeachBackRef.scopeKey !== conversationScope || !request.userMessage.trim()
      || request.userMessage.length > 1000) throw new Error('请在当前题目的追问中填写不超过 1000 字的补充')
    assertTeachBackFollowUp(teachBackFollowUp, { explanation: teachBackExplanation, reference: expectedTeachBackRef })
    // Clone before freezing: caller-owned UI state must not become context state.
    result.teachBackFollowUp = structuredClone(teachBackFollowUp)
    requireSpace('teach_back.current_probe', JSON.stringify(result.teachBackFollowUp).length, teachBackFollowUp.questionId)
    omitted('teach_back.full_explanation_and_history', 'locality')
  }
  const optional = (source, size, include) => {
    if (usedChars + size > limit) {
      omitted(source, 'token_budget')
      return false
    }
    usedChars += size
    include()
    selected(source, pageId)
    return true
  }

  // Reserve the submitted attempt before lower-priority optional page details.
  if (attempt) {
    const targetIndex = localHintTarget ? attempt.steps.findIndex((s) => s.id === localHintTarget.stepId) : -1
    const nearbySteps = localHintTarget ? attempt.steps.slice(Math.max(0, targetIndex - 2), targetIndex + 1) : attempt.steps
    const selectedSteps = localHintTarget?.premiseStepId
      ? [attempt.steps.find((step) => step.id === localHintTarget.premiseStepId), ...nearbySteps] : nearbySteps
    if (localHintTarget) {
      omitted('attempt.later_steps', 'reveal_policy')
      omitted('attempt.distant_previous_steps', 'locality')
      omitted('tutoring.previous_hint_text', 'locality')
      requireSpace('attempt.obstacle', localHintTarget.obstacle.length, localHintTarget.stepId)
      if (localHintTarget.premiseStepId) selected('attempt.explicit_premise', localHintTarget.premiseStepId)
    }
    const steps = selectedSteps.map((step) => ({
      stepId: step.id,
      order: step.number,
      rawContent: step.rawContent,
      author: step.author,
      sourceRange: { ...step.sourceRange },
    }))
    requireSpace('attempt', steps.reduce((sum, step) => sum + step.rawContent.length, 0), attempt.id)
    result.attempt = {
      attemptId: attempt.id,
      problemId: pageId,
      version: attempt.version,
      source: attempt.source,
      localSteps: steps,
      ...(attempt.recognition ? { recognition: {
        artifactId: attempt.recognition.artifactId, status: attempt.recognition.status,
        confirmedAt: attempt.recognition.confirmedAt,
        uncertainBlockCount: attempt.recognition.blocks.filter((b) => b.uncertainty || b.confidence === null || b.confidence < 0.85).length,
      } } : {}),
      currentFocusStepId: localHintTarget?.stepId || attempt.currentFocus?.stepId || undefined,
      ...(localHintTarget ? { hintTarget: localHintTarget } : {}),
    }
    result.attempt.review = buildAttemptReview(result.attempt)
    requireSpace('attempt_verification', JSON.stringify(result.attempt.review).length, attempt.id)
  }

  if (problemIncluded) {
    const statement = String(page.text || '')
    requireSpace('problem', statement.length)
    result.problem = {
      problemId: pageId,
      title: String(page.title || ''),
      statement,
      tags: [],
    }
    if (selectedFocus) {
      const selectedText = String(focus.selectedText || '')
      const paragraphText = String(focus.paragraphText || '')
      requireSpace('selection', selectedText.length + paragraphText.length, focus.stepId)
      result.selection = {
        sourceType: 'solution',
        problemId: pageId,
        sourceId: String(focus.solutionId || ''),
        sourceStepId: String(focus.stepId || ''),
        sectionLabel: String(focus.sectionLabel || '解析'),
        stepNumber: Number(focus.stepNumber) || 0,
        selectedText,
        paragraphText,
        previousSteps: [],
        nextStep: '',
        authorSource: focus.sourceType === 'official' ? 'official'
          : focus.sourceType === 'community' ? 'community' : 'unknown',
        reviewStatus: focus.reviewStatus === 'approved' ? 'approved' : 'unconfirmed',
      }
      const recentPrevious = Array.isArray(focus.previousSteps) ? focus.previousSteps.slice(-2) : []
      for (const previous of recentPrevious.toReversed()) {
        const text = String(previous)
        if (!optional('selection.previous_step', text.length, () => result.selection.previousSteps.unshift(text))) break
      }
      if (focus.nextStep) {
        if (guarded) omitted('selection.next_step', 'reveal_policy')
        else {
          const nextStep = String(focus.nextStep)
          optional('selection.next_step', nextStep.length, () => { result.selection.nextStep = nextStep })
        }
      }
    }
    if (Array.isArray(page.tags) && page.tags.length) {
      const tags = page.tags.map(String).slice(0, 12)
      optional('problem.tags', tags.join('、').length, () => { result.problem.tags = tags })
    }
    if (includeReference && (page.answer || page.solution)) {
      if (guarded) omitted('reference_solution', 'reveal_policy')
      else {
        const answer = String(page.answer || '')
        const solution = String(page.solution || '')
        optional('reference_solution', answer.length + solution.length, () => {
          result.solution = { problemId: pageId, answer, text: solution, isReferenceSolution: true }
        })
      }
    }
  } else if (page) {
    omitted('page', 'privacy')
  }

  if (Array.isArray(recentMessages) && recentMessages.length && intent === 'chat') {
    const eligible = recentMessages.filter((message) => {
      if (!includePage || !conversationScope) {
        omitted('conversation', 'privacy')
        return false
      }
      if (message?.scopeKey !== conversationScope) {
        omitted('conversation', 'stale')
        return false
      }
      return (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string'
    })
    const messages = eligible.slice(-6)
      .map((message) => ({ role: message.role, content: message.content }))
    const included = []
    for (const message of messages.toReversed()) {
      if (!optional('conversation', message.content.length, () => included.unshift(message))) break
    }
    if (included.length) result.conversation = { recentMessages: included }
  }
  if (result.routeCondition) {
    result.routeConditionDiscussionRange = createDiscussionRange(routeConditionRangeText)
    requireSpace('strategy.discussion_range', JSON.stringify(result.routeConditionDiscussionRange).length, result.routeCondition.routeId)
    const readingInput = { target: result.routeCondition, problemStatement: result.problem.statement,
      selection: result.selection || null, note: request.userMessage, discussionRange: result.routeConditionDiscussionRange, revision: routeConditionRevision }
    const reading = routeConditionReading || createRouteConditionReading(readingInput)
    assertRouteConditionReading(reading, readingInput)
    result.routeConditionReading = structuredClone(reading)
    result.routeConditionRevision = routeConditionRevision
    requireSpace('strategy.condition_reading', JSON.stringify(reading).length, result.routeCondition.routeId)
  }
  result.contextMetadata.tokenEstimate = Math.ceil(usedChars / 2)
  result.contextMetadata.compressionApplied = omittedItems.some((item) => item.reason === 'token_budget')
  return freezeContext(assertContextIntegrity(result))
}
