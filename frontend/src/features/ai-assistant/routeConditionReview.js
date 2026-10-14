import { assertContextIntegrity } from './contextIntegrity.js'
import { verifyOrderedDifferenceSign } from './premiseSignVerifier.js'
import { verifyIntervalCondition } from './intervalConditionVerifier.js'

// Only the exact AI-declared condition is checked under the current problem givens.
// Learner notes, relevance/necessity and entire candidate routes are not certified.
export function reviewRouteCondition(context) {
  assertContextIntegrity(context, 'route_condition')
  if (context.routeConditionReading.state !== 'confirmed') return {
    tool: null, version: 1, scope: 'route_condition_reading', status: 'unknown',
    reason: 'unconfirmed_reading', checkedClaim: null, assumptions: [], expectedClaim: null,
  }
  if (needsDiscussionRangeCorrection(context)) return {
    tool: null, version: 1, scope: 'learner_discussion_range', status: 'unknown',
    reason: 'unsupported_discussion_range', checkedClaim: null, assumptions: [], expectedClaim: null,
  }
  const sign = verifyOrderedDifferenceSign({ problemStatement: context.problem.statement,
    premiseText: context.routeCondition.conditionText })
  return sign.status !== 'unknown' ? sign : verifyIntervalCondition({
    problemStatement: context.problem.statement, conditionText: context.routeCondition.conditionText })
}

// A supported interval claim without an explicit range needs material, not a math accusation.
export function needsRouteConditionRange(context, review = reviewRouteCondition(context)) {
  return review.tool === 'verify_interval_condition' && review.status === 'unknown'
    && review.reason === 'missing_range' && !context.request.userMessage.trim() && !context.routeConditionDiscussionRange
}

export function needsDiscussionRangeCorrection(context) {
  return context.routeConditionReading.state === 'confirmed' && context.routeConditionDiscussionRange?.state === 'unsupported'
}

export function needsRouteConditionReading(context, review = reviewRouteCondition(context)) {
  return review.status === 'unknown' && review.reason === 'unconfirmed_reading'
}
