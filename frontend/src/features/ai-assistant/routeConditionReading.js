import { assertDiscussionRange } from './routeConditionRange.js'
import { assertRouteConditionTarget } from './routeCondition.js'
const keys = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === allowed.length && Object.keys(value).every(key => allowed.includes(key))

// Exact binding, not a semantic interpretation or a mathematical proof. Never sent to a provider.
function binding({ target, problemStatement, selection = null, note = '', discussionRange = null, revision }) {
  assertRouteConditionTarget(target)
  if (typeof problemStatement !== 'string' || !problemStatement.trim() || problemStatement.length > 16000
    || typeof note !== 'string' || note.length > 1000 || !Number.isSafeInteger(revision) || revision < 0) {
    throw new Error('读法确认目标不完整，请按当前条件重新确认。')
  }
  const selected = selection ? { stepId: String(selection.sourceStepId ?? selection.stepId ?? ''),
    selectedText: String(selection.selectedText || ''), paragraphText: String(selection.paragraphText || '') } : null
  const value = JSON.stringify({ target, problemStatement, selected, note: note.trim(), discussionRange: assertDiscussionRange(discussionRange) })
  if (value.length > 20000) throw new Error('读法确认内容过长，请缩小当前引用。')
  return value
}
export function createRouteConditionReading(input, confirmed = false) {
  if (typeof confirmed !== 'boolean') throw new Error('读法确认必须是明确的用户操作。')
  return Object.freeze({ state: confirmed ? 'confirmed' : 'unconfirmed',
    origin: confirmed ? 'learner_action' : 'context_policy', revision: input.revision, binding: binding(input) })
}
export function assertRouteConditionReading(reading, input) {
  if (!keys(reading, ['state', 'origin', 'revision', 'binding'])
    || !['confirmed', 'unconfirmed'].includes(reading.state)
    || reading.origin !== (reading.state === 'confirmed' ? 'learner_action' : 'context_policy')
    || reading.revision !== input.revision || reading.binding !== binding(input)) {
    throw new Error('读法确认已过期或来源不符，请按当前条件重新确认。')
  }
  return reading
}
export function parseRouteConditionReadingRequest(value = '') {
  const text = String(value).trim()
  if (/^(?:我)?确认当前条件读法[。！!]?$/.test(text)) return 'confirm'
  if (/^(?:当前条件读法(?:未确认|还不确定)|撤销当前条件读法确认)[。！!]?$/.test(text)) return 'revoke'
  return null
}
