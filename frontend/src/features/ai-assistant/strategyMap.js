import { assertContextIntegrity } from './contextIntegrity.js'

const field = (value, maximum) => typeof value === 'string' && value.trim().length > 0
  && value.trim().length <= maximum ? value.trim() : null
const keys = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === allowed.length && Object.keys(value).every(key => allowed.includes(key))
const sources = new Set(['problem', 'selection', 'none'])
const unsupportedOptimum = /(?:唯一(?:最优|最佳|最快)(?:方法|解法|路线)?|(?:一定|必然|保证|无疑|绝对)(?:是)?(?:最快|最优|最佳))/g

export const STRATEGY_MAP_OUTPUT_INSTRUCTION = '请为当前题目比较 2–3 条候选解法，不输出完整推导、最终答案或虚构例题链接。只返回 JSON 对象，字段仅为 overview（240 字内）、routes、preferredIndex（下标，不能建议优先路线时为 -1）、choiceRule（240 字内）。每条 route 仅含 name（60 字内）、when（适用条件，160 字内）、firstMove（第一步，160 字内）、workload（工作量，120 字内）、switchSignal（换路信号，160 字内）、basis。basis 仅含 source（problem、selection 或 none）、sourceQuote（从题目原文或当前步骤原文逐字引用 1–80 字；source=none 时为空）、missingCondition（还需满足的一个条件，160 字内；无待补条件时为空）。原文线索只是来源依据，不证明方法成立或最快，缺条件不可自行补全；没有明确线索时用 none 且说明缺什么。优先路线须有原文线索且没有待补条件，只能是 AI 初步建议，不能声称唯一最优或保证最快；其他路线仍可保留，用户不必换路。没有工具或题库检索证据，不得称已验证或编造链接。'

function validBasis(basis) {
  return keys(basis, ['source', 'sourceQuote', 'missingCondition']) && sources.has(basis.source)
    && typeof basis.sourceQuote === 'string' && basis.sourceQuote.length <= 80
    && typeof basis.missingCondition === 'string' && basis.missingCondition.length <= 160
    && (basis.source === 'none' ? basis.sourceQuote === '' && Boolean(field(basis.missingCondition, 160))
      : Boolean(field(basis.sourceQuote, 80)))
}

export function validateStrategyMap(map) {
  return Boolean(keys(map, ['overview', 'choiceRule', 'routes', 'preferredRouteId', 'provenance'])
    && field(map.overview, 240) && field(map.choiceRule, 240) && map.provenance === 'provider_unverified'
    && Array.isArray(map.routes) && map.routes.length >= 2 && map.routes.length <= 3
    && map.routes.every((route, index) => keys(route, ['id', 'name', 'when', 'firstMove', 'workload', 'switchSignal', 'basis'])
      && route.id === `method-${index + 1}` && field(route.name, 60) && field(route.when, 160)
      && field(route.firstMove, 160) && field(route.workload, 120) && field(route.switchSignal, 160) && validBasis(route.basis))
    && (map.preferredRouteId === null || map.routes.some(route => route.id === map.preferredRouteId
      && route.basis.source !== 'none' && !route.basis.missingCondition.trim())))
}

export function parseStrategyMapResponse(content, context) {
  let value
  try {
    const raw = String(content || '').trim()
    const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
    value = JSON.parse(fenced ? fenced[1] : raw)
  } catch {
    throw new Error('模型未按路线图格式返回内容；请重试，或改用普通提问。')
  }
  if (!keys(value, ['overview', 'routes', 'preferredIndex', 'choiceRule'])
    || !field(value.overview, 240) || !field(value.choiceRule, 240)
    || !Array.isArray(value.routes) || value.routes.length < 2 || value.routes.length > 3
    || !Number.isInteger(value.preferredIndex) || value.preferredIndex < -1 || value.preferredIndex >= value.routes.length) {
    throw new Error('模型返回的路线图结构不完整，请重试。')
  }
  assertContextIntegrity(context, 'strategy')
  if (!context.problem) throw new Error('路线比较需要当前题目原文，请开启题目上下文后重试。')
  const routes = value.routes.map((route, index) => {
    if (!keys(route, ['name', 'when', 'firstMove', 'workload', 'switchSignal', 'basis']) || !validBasis(route.basis)) {
      throw new Error('每条路线须说明原文线索或待补条件，请重新比较。')
    }
    const basis = { ...route.basis, missingCondition: route.basis.missingCondition.trim() }
    const sourceText = basis.source === 'problem' ? context.problem.statement
      : basis.source === 'selection' ? context.selection?.paragraphText : null
    if (basis.source !== 'none' && (typeof sourceText !== 'string' || !sourceText.includes(basis.sourceQuote))) {
      throw new Error('路线线索未逐字出现在本次题目或选中步骤，请重新比较。')
    }
    return { id: `method-${index + 1}`, name: field(route.name, 60), when: field(route.when, 160),
      firstMove: field(route.firstMove, 160), workload: field(route.workload, 120),
      switchSignal: field(route.switchSignal, 160), basis }
  })
  const map = { overview: value.overview.trim(), choiceRule: value.choiceRule.trim(), routes,
    preferredRouteId: value.preferredIndex === -1 ? null : routes[value.preferredIndex].id,
    provenance: 'provider_unverified' }
  if (value.preferredIndex >= 0 && (routes[value.preferredIndex].basis.source === 'none'
    || routes[value.preferredIndex].basis.missingCondition)) {
    throw new Error('推荐路线仍缺依据或条件，请先保留候选而不指定优先路线。')
  }
  if (!validateStrategyMap(map)) throw new Error('模型返回的路线图缺少方法或换路依据，请重试。')
  const text = [map.overview, map.choiceRule, ...routes.flatMap(route => [route.name, route.when,
    route.firstMove, route.workload, route.switchSignal, route.basis.missingCondition])].join('\n')
  if (/(?:https?:\/\/|www\.)/i.test(text)) throw new Error('本轮未检索例题，不能生成题目链接；请重新比较。')
  const hasGuarantee = [...text.matchAll(unsupportedOptimum)].some(match => {
    const prefix = text.slice(Math.max(0, match.index - 12), match.index)
    // Only direct negation of this phrase is exempt; it does not excuse a later assertion.
    return !/(?:不|无法|不能|难以|没有|并非|不是|未能)(?:称为|声称|认为|断言|说是)?$/.test(prefix)
  })
  if (hasGuarantee) throw new Error('没有比较验证依据，不能声称唯一最优或保证最快；请重新比较。')
  return map
}
