import { verifyArithmeticEquality } from './arithmeticVerifier.js'
import { findAttemptReviewCaution } from './attemptRiskGuard.js'

// Evidence is scoped to literal equalities, never to the validity of a route.
// Stop scanning at the first false equality; review its prefix before showing it.
export function buildAttemptReview(attempt) {
  const evidence = []
  let firstInvalidStep = null
  for (const step of attempt.localSteps) {
    const verification = verifyArithmeticEquality(step.rawContent)
    evidence.push({ stepId: step.stepId, order: step.order, ...verification })
    if (verification.status === 'invalid') {
      firstInvalidStep = step.order
      break
    }
  }
  return {
    attemptId: attempt.attemptId,
    version: attempt.version,
    evidence,
    firstInvalidStep,
    reviewThrough: firstInvalidStep === null ? attempt.localSteps.length : firstInvalidStep - 1,
    needsProvider: firstInvalidStep !== 1,
  }
}

export function assertAttemptReview(review, attempt) {
  if (!review || JSON.stringify(review) !== JSON.stringify(buildAttemptReview(attempt))) {
    throw new Error('草稿核验记录与当前版本不一致，请重新检查')
  }
  return review
}

export function resolveAttemptReview(attempt, review, analysis = null) {
  const contextAttempt = { attemptId: attempt.id, version: attempt.version,
    localSteps: attempt.steps.map((step) => ({ stepId: step.id, order: step.number, rawContent: step.rawContent })) }
  assertAttemptReview(review, contextAttempt)
  if (review.needsProvider) {
    if (!analysis || analysis.attemptId !== attempt.id || analysis.attemptVersion !== attempt.version) {
      throw new Error('前序草稿尚未完成分析，请重新检查')
    }
    if (analysis.firstIssueStep !== null && (!Number.isInteger(analysis.firstIssueStep)
      || analysis.firstIssueStep < 1 || analysis.firstIssueStep > review.reviewThrough
      || attempt.steps[analysis.firstIssueStep - 1].id !== analysis.firstIssueStepId)) {
      throw new Error('模型定位超出本轮检查范围，请重新检查前面的步骤')
    }
    const reviewCaution = findAttemptReviewCaution(attempt, review, analysis)
    if (reviewCaution) return { analysis: null, arithmeticIssue: null, reviewCaution,
      reviewScope: review.firstInvalidStep === null ? null : review.reviewThrough }
    // A preceding issue or uncertainty takes priority. Do not present a second,
    // later correction, or turn "unknown" into an implicitly correct prefix.
    if (analysis.firstIssueStep !== null
      || !['valid', 'valid_but_incomplete', 'valid_but_inefficient'].includes(analysis.routeStatus)
      || review.firstInvalidStep === null) {
      return { analysis, arithmeticIssue: null,
        reviewScope: review.firstInvalidStep === null ? null : review.reviewThrough }
    }
  }
  const step = attempt.steps[review.firstInvalidStep - 1]
  const verification = review.evidence.find((entry) => entry.order === step.number)
  return { analysis: null, arithmeticIssue: { step, verification },
    prefixReviewed: review.needsProvider, reviewScope: null }
}
