import { assertRangeProbe } from './routeConditionRange.js'

const keys = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === allowed.length && Object.keys(value).every(key => allowed.includes(key))
const text = (value, limit) => typeof value === 'string' && Boolean(value.trim()) && value.length <= limit
const kinds = new Set(['applicability', 'missing'])

export const ROUTE_CONDITION_OUTPUT_INSTRUCTION = '本次只核对用户选中的一条候选路线的一个声明条件。条件和路线来自 AI 初步比较，原文线索只证明来源，不证明方法成立。依据当前题目/选中步骤和学生说明判断该条件是否已回应；材料不足则只问一个具体的补充问题，不猜测前提，不把读法疑问判成数学错误，不替学生换路线、完成首步或给整题答案。只返回 JSON 对象，字段仅为 routeId、conditionKind、conditionText（这三个字段逐字沿用本次目标）、status（addressed、needs_input、uncertain）、feedback（240 字内简短陈述，不另问问题）、nextQuestion（200 字内，一个主要问题，最多一个问号）。addressed 仅表示本次条件已回应，nextQuestion 必须为空，及时停止；另外两种状态 nextQuestion 必填。本次没有可用的确定性核验结论，不得声称已验证、整条路线成立或长期掌握。'

export function parseRouteConditionRequest(value = '') {
  const match = String(value).trim().match(/^(?:请)?核对第\s*(\d+)\s*条路线的(适用条件|待补条件|条件)(?:[：:]\s*([\s\S]*))?$/)
  return match ? { routeIndex: Number(match[1]) - 1,
    conditionKind: match[2] === '适用条件' ? 'applicability' : match[2] === '待补条件' ? 'missing' : null,
    note: match[3] || '' } : null
}

export function assertRouteConditionTarget(target, { map, mapId, reference } = {}) {
  const t = target
  const valid = keys(t, ['mapId', 'routeId', 'reference', 'routeName', 'conditionKind', 'conditionText', 'clue'])
    && text(t.mapId, 100) && /^method-[1-3]$/.test(t.routeId) && text(t.routeName, 60)
    && kinds.has(t.conditionKind) && text(t.conditionText, 160)
    && keys(t.reference, ['scopeKey', 'revision']) && text(t.reference.scopeKey, 1000)
    && Number.isSafeInteger(t.reference.revision) && t.reference.revision >= 0
    && keys(t.clue, ['source', 'sourceQuote']) && ['problem', 'selection', 'none'].includes(t.clue.source)
    && (t.clue.source === 'none' ? t.clue.sourceQuote === '' : text(t.clue.sourceQuote, 80))
  if (!valid) throw new Error('路线条件目标不完整，请重新选择当前路线和条件。')
  if (reference && (t.reference.scopeKey !== reference.scopeKey || t.reference.revision !== reference.revision)) {
    throw new Error('路线来源已过期，请按当前题目重新比较并选择。')
  }
  if (map) {
    const route = map.routes?.find(route => route.id === t.routeId)
    if (mapId !== t.mapId || !route || route.name !== t.routeName
      || (t.conditionKind === 'missing' ? route.basis?.missingCondition : route.when) !== t.conditionText
      || route.basis?.source !== t.clue.source || route.basis?.sourceQuote !== t.clue.sourceQuote) {
      throw new Error('所选条件与当前路线原文不一致，请重新选择。')
    }
  }
  return t
}

export function createRouteConditionTarget({ map, mapId, routeId, conditionKind = null, reference }) {
  const route = map?.routes?.find(route => route.id === routeId)
  if (!route) throw new Error('当前路线图没有这条路线，请重新选择。')
  const kind = conditionKind || (route.basis?.missingCondition ? 'missing' : 'applicability')
  const target = { mapId, routeId, reference: { ...reference }, routeName: route.name, conditionKind: kind,
    conditionText: kind === 'missing' ? route.basis?.missingCondition : route.when,
    clue: { source: route.basis?.source, sourceQuote: route.basis?.sourceQuote } }
  assertRouteConditionTarget(target, { map, mapId, reference })
  Object.freeze(target.reference)
  Object.freeze(target.clue)
  return Object.freeze(target)
}

export function parseRouteConditionResponse(content, target, context = null) {
  assertRouteConditionTarget(target)
  let value
  try {
    const raw = String(content || '').trim().replace(/^\uFEFF/, '')
    const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
    value = JSON.parse(fenced ? fenced[1] : raw)
  } catch { throw new Error('模型未按条件核对格式返回内容，请重试；你的说明已保留。') }
  const withRange = Boolean(context?.routeConditionDiscussionRange)
  if (!keys(value, ['routeId', 'conditionKind', 'conditionText', 'status', 'feedback', 'nextQuestion', ...(withRange ? ['probe'] : [])])
    || !['addressed', 'needs_input', 'uncertain'].includes(value.status)
    || !text(value.feedback, 240) || /[?？]/.test(value.feedback)
    || typeof value.nextQuestion !== 'string' || value.nextQuestion.length > 200
    || (value.status === 'addressed' ? Boolean(value.nextQuestion.trim()) : !value.nextQuestion.trim())
    || (value.nextQuestion.match(/[?？]/g) || []).length > 1) {
    throw new Error('条件核对应只给本次局部反馈或一个补充问题，请重试。')
  }
  if (value.routeId !== target.routeId || value.conditionKind !== target.conditionKind || value.conditionText !== target.conditionText) {
    throw new Error('模型换了路线或条件，本次回复未显示；请重试当前目标。')
  }
  const probe = withRange ? assertRangeProbe(value.probe, value.status, context) : undefined
  return { ...value, ...(withRange ? { probe } : {}), feedback: value.feedback.trim(), nextQuestion: value.nextQuestion.trim(), provenance: 'provider_unverified' }
}
