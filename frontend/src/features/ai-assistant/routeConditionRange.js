import { describeSingleInterval } from './intervalConditionVerifier.js'

// A learner's chosen discussion scope is input data, never a native problem assumption.
export function createDiscussionRange(raw = '') {
  if (typeof raw !== 'string' || raw.length > 160) throw new Error('讨论范围最多 160 字，请保留一个变量的明确区间。')
  if (!raw.trim()) return null
  const interval = describeSingleInterval(raw)
  return Object.freeze({ origin: 'learner_scope', raw: raw.trim(),
    state: interval ? 'provided' : 'unsupported', variable: interval?.variable || null,
    canonical: interval?.text || null })
}
export function assertDiscussionRange(value) {
  if (value === null) return null
  const expected = value && typeof value.raw === 'string' ? createDiscussionRange(value.raw) : null
  if (!expected || Array.isArray(value) || Object.keys(value).length !== 5
    || Object.keys(expected).some(key => value[key] !== expected[key])) {
    throw new Error('讨论范围记录或来源不符，请重新填写。')
  }
  return value
}
export function parseDiscussionRangeRequest(value = '') {
  const match = String(value).trim().match(/^本次讨论范围[：:]\s*([^\n]+)$/)
  return match ? match[1] : null
}

export const RANGE_CONDITION_OUTPUT_INSTRUCTION = '本次有独立的学生讨论范围，不能当作题设或条件证明。probe 为上述第七个字段。addressed 时 probe=null 且 nextQuestion 为空；否则 probe 仅含 kind（discussion_range、condition_reasoning、reading）、variable（discussion_range 时为所问的单个英文字母变量，否则为 null）、source（condition、problem、selection、note、discussion_range）、sourceQuote（从该命名来源逐字引用 1–80 字）、purpose（120 字内，一个核对目的，不另提问）。已提供的同变量讨论范围不能再次询问；若仅需该范围，本次局部停止，仍有其他缺口只问一个当前问题。范围填写不证明方法适用或充分。'

export function assertRangeProbe(probe, status, context) {
  if (status === 'addressed') {
    if (probe !== null) throw new Error('局部停止时不得保留追问目的。')
    return null
  }
  const sources = { condition: context.routeCondition.conditionText, problem: context.problem.statement,
    selection: context.selection?.paragraphText, note: context.request.userMessage,
    discussion_range: context.routeConditionDiscussionRange?.raw }
  if (!probe || Array.isArray(probe) || Object.keys(probe).length !== 5
    || Object.keys(probe).some(key => !['kind', 'variable', 'source', 'sourceQuote', 'purpose'].includes(key))
    || !['discussion_range', 'condition_reasoning', 'reading'].includes(probe.kind)
    || (probe.kind === 'discussion_range' ? !/^[A-Za-z]$/.test(probe.variable) : probe.variable !== null)
    || typeof probe.sourceQuote !== 'string' || !probe.sourceQuote.trim() || probe.sourceQuote.length > 80
    || !Object.hasOwn(sources, probe.source) || !sources[probe.source]?.includes(probe.sourceQuote)
    || typeof probe.purpose !== 'string' || !probe.purpose.trim() || probe.purpose.length > 120 || /[?？]/.test(probe.purpose)) {
    throw new Error('追问须有一个当前目的和逐字匹配的命名来源，请重试当前条件。')
  }
  return { ...probe, purpose: probe.purpose.trim() }
}

export function repeatsProvidedRange(analysis, range) {
  if (range?.state !== 'provided' || !analysis.nextQuestion) return false
  if (analysis.probe?.kind === 'discussion_range') return analysis.probe.variable === range.variable
  // Bounded direct rewordings, including a mislabeled purpose. Not general semantic understanding.
  const question = analysis.nextQuestion.replace(/[\s?？。]/g, '')
  return /^(?:请)?(?:你|本次|当前|你打算|你准备)?(?:讨论什么区间|讨论哪个区间|在哪个范围讨论|在哪个范围继续讨论|打算在哪个范围讨论|补充讨论范围|确认讨论范围)$/.test(question)
    || question === `请补充${range.variable}的讨论范围`
    || question === `${range.variable}的讨论范围是什么`
}
