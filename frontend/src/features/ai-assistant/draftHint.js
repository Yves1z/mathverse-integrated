import { assertAttemptIntegrity } from './contextIntegrity.js'
import { attemptReference } from './typedAttempt.js'

export function requireDraftHint({ attempt, problemId, editorText, includePage, needsConfirmation = false,
  sourceCurrent = true, selectedArtifactId = null }) {
  if (!includePage) throw new Error('请先开启“随请求发送”，再基于当前题目和草稿请求提示')
  if (!attempt) throw new Error('请先提交并检查草稿，再基于这版草稿请求提示')
  if (needsConfirmation || !sourceCurrent || (selectedArtifactId && selectedArtifactId !== attempt.recognition?.artifactId)) {
    throw new Error('图片读法或选区尚未重新确认，请先在核对区确认读法')
  }
  if (editorText !== attempt.rawText) throw new Error('草稿已有未提交修改，请先重新检查或确认读法，再请求草稿提示')
  assertAttemptIntegrity(attempt, String(problemId), attemptReference(attempt))
  return attempt
}

export function validateDraftStepTarget(attempt, target) {
  const ref = target?.attemptRef
  const targetIndex = attempt?.steps.findIndex((s) => s.id === target?.stepId) ?? -1
  const step = attempt?.steps[targetIndex]
  if (!step || !ref || ref.id !== attempt.id || ref.version !== attempt.version || ref.problemId !== attempt.problemId
    || typeof target.obstacle !== 'string' || target.obstacle.length > 500) {
    throw new Error('草稿步骤或版本已变化，请重新选择卡住的步骤')
  }
  const premiseId = target.premiseStepId
  const premiseIndex = premiseId ? attempt.steps.findIndex((s) => s.id === premiseId) : -1
  if (premiseId != null && premiseId !== '' && (typeof premiseId !== 'string'
    || premiseIndex < 0 || premiseIndex >= targetIndex - 2)) {
    throw new Error('补入的前提必须是这版草稿中窗口之外的更早一步，请重新选择')
  }
  return {
    attemptRef: attemptReference(attempt), stepId: step.id, stepNumber: step.number, obstacle: target.obstacle,
    ...(premiseIndex >= 0 ? { premiseStepId: attempt.steps[premiseIndex].id,
      premiseStepNumber: attempt.steps[premiseIndex].number } : {}),
  }
}

export function bindDraftHintActions(actions, attempt, target = null, targetRevision = null) {
  const binding = target ? { draftHintTarget: target, targetRevision } : {}
  return actions.map((action) => action.taskType === 'hint'
    ? { ...action, taskType: target ? 'draft-step-hint' : 'draft-hint', attemptRef: attemptReference(attempt), ...binding }
    : action.type === 'continue_attempt' ? { ...action, attemptRef: attemptReference(attempt), ...binding } : action)
}
