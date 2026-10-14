const STATUSES = new Set(['clear', 'needs_probe', 'uncertain'])
const PROBE_KINDS = new Set(['condition', 'reasoning', 'reading', 'method'])

export const TEACH_BACK_OUTPUT_INSTRUCTION = '只返回 JSON 对象，字段仅为 status、feedback、nextQuestion、probe。status 为 clear、needs_probe 或 uncertain；feedback 为不超过 200 字的简短陈述，不再提问。解释已清楚且无重要缺口时 status=clear，nextQuestion=""，probe=null，及时停止。否则 nextQuestion 只提出一个不超过 200 字的主要问题，不附其他任务；probe 是单个对象，仅含 kind（condition、reasoning、reading 或 method）、sourceQuote（从本次学生解释逐字引用的 1–80 字原话，不取自题干、参考解或旧反馈）、purpose（120 字内说明本次核对的一个条件、理由、读法或方法选择，不另提问）。读法不明确时用 uncertain，先问读法，不判数学错。保留学生可行路线，不因与参考方法不同而要求换路。'

export function parseTeachBackResponse(content, explanation = '', followUp = null) {
  if (followUp) assertTeachBackFollowUp(followUp)
  let value
  try {
    const raw = String(content || '').trim().replace(/^\uFEFF/, '')
    const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
    const candidate = fenced ? fenced[1] : raw
    value = JSON.parse(candidate)
  } catch {
    throw new Error('模型没有按理解反馈格式返回内容。请重试；若持续出现，可切换“快速”模式。你的解释已保留。')
  }
  const status = value?.status
  const feedback = typeof value?.feedback === 'string' ? value.feedback.trim() : ''
  const nextQuestion = typeof value?.nextQuestion === 'string' ? value.nextQuestion.trim() : ''
  if (!value || typeof value !== 'object' || Array.isArray(value) || !STATUSES.has(status)
    || Object.keys(value).some(key => !['status', 'feedback', 'nextQuestion', 'probe'].includes(key))
    || !feedback || feedback.length > 200 || /[?？]/.test(feedback)
    || typeof value.nextQuestion !== 'string' || nextQuestion.length > 200
    || (status === 'clear' ? Boolean(nextQuestion) : !nextQuestion)
    || (nextQuestion.match(/[?？]/g) || []).length > 1) {
    throw new Error('模型理解反馈格式不正确，请重试')
  }
  const probe = value.probe
  if (status === 'clear') {
    if (probe != null) throw new Error('解释已清楚时应停止追问，请重试')
    return { status, feedback, nextQuestion, probe: null, provenance: 'provider_unverified' }
  }
  if (!probe || typeof probe !== 'object' || Array.isArray(probe)
    || Object.keys(probe).some(key => !['kind', 'sourceQuote', 'purpose'].includes(key))
    || !PROBE_KINDS.has(probe.kind)
    || typeof probe.sourceQuote !== 'string' || !probe.sourceQuote.trim() || probe.sourceQuote.length > 80
    || typeof explanation !== 'string' || !explanation.includes(probe.sourceQuote)
    || typeof probe.purpose !== 'string' || !probe.purpose.trim() || probe.purpose.length > 120
    || /[?？]/.test(probe.purpose)) {
    throw new Error('追问须引用本次解释原话并说明一个核对目的，请重新提交；你的解释已保留。')
  }
  if (followUp) {
    if (probe.kind !== followUp.probe.kind || probe.purpose.trim() !== followUp.probe.purpose) {
      throw new Error('本次应重检同一核对目的，模型却换了目标。补充已保留，可重试或修改整段解释。')
    }
    const questionKey = (text) => text.replace(/[\s？?。.!！]/g, '')
    if (questionKey(nextQuestion) === questionKey(followUp.question)) {
      throw new Error('模型重复了已回答的追问。补充已保留，可重试或修改整段解释。')
    }
  }
  return { status, feedback, nextQuestion,
    probe: { kind: probe.kind, sourceQuote: probe.sourceQuote, purpose: probe.purpose.trim() },
    provenance: 'provider_unverified' }
}

export function teachBackReference(scopeKey, revision) {
  if (typeof scopeKey !== 'string' || !scopeKey || !Number.isSafeInteger(revision) || revision < 0) {
    throw new Error('解释版本引用无效')
  }
  return Object.freeze({ scopeKey, revision })
}

export function isCurrentTeachBackReference(reference, scopeKey, revision) {
  return typeof reference?.scopeKey === 'string' && Boolean(reference.scopeKey)
    && Number.isSafeInteger(reference.revision) && reference.revision >= 0
    && reference.scopeKey === scopeKey && reference.revision === revision
}

// One explicit probe → one supplementary answer → one scoped recheck.
// The excerpt is copied verbatim, never summarized or treated as math evidence.
export function createTeachBackFollowUp({ explanation, analysis, reference, questionId }) {
  const checked = parseTeachBackResponse(JSON.stringify({ status: analysis.status, feedback: analysis.feedback,
    nextQuestion: analysis.nextQuestion, probe: analysis.probe }), explanation)
  if (!checked.probe) throw new Error('已结束的解释没有可回答的追问')
  const at = explanation.indexOf(checked.probe.sourceQuote)
  const start = Math.max(0, at - 80)
  const end = Math.min(explanation.length, at + checked.probe.sourceQuote.length + 80)
  const target = { questionId, reference: { ...reference }, question: checked.nextQuestion,
    probe: { ...checked.probe }, originalExcerpt: explanation.slice(start, end), sourceRange: { start, end } }
  assertTeachBackFollowUp(target, { explanation, reference })
  Object.freeze(target.reference); Object.freeze(target.probe); Object.freeze(target.sourceRange)
  return Object.freeze(target)
}

export function assertTeachBackFollowUp(target, { explanation, reference } = {}) {
  const bounded = (text, max) => typeof text === 'string' && Boolean(text.trim()) && text.length <= max
  const keys = (object, allowed) => object && typeof object === 'object' && !Array.isArray(object)
    && Object.keys(object).length === allowed.length && Object.keys(object).every(key => allowed.includes(key))
  const t = target
  if (!keys(t, ['questionId', 'reference', 'question', 'probe', 'originalExcerpt', 'sourceRange'])
    || !bounded(t.questionId, 100) || !bounded(t.question, 200)
    || (t.question.match(/[?？]/g) || []).length > 1
    || !keys(t.reference, ['scopeKey', 'revision'])
    || !isCurrentTeachBackReference(t.reference, t.reference.scopeKey, t.reference.revision)
    || !keys(t.probe, ['kind', 'sourceQuote', 'purpose']) || !PROBE_KINDS.has(t.probe.kind)
    || !bounded(t.probe.sourceQuote, 80) || !bounded(t.probe.purpose, 120) || /[?？]/.test(t.probe.purpose)
    || !bounded(t.originalExcerpt, 240) || !t.originalExcerpt.includes(t.probe.sourceQuote)
    || !keys(t.sourceRange, ['start', 'end']) || !Number.isSafeInteger(t.sourceRange.start)
    || !Number.isSafeInteger(t.sourceRange.end) || t.sourceRange.start < 0
    || t.sourceRange.end - t.sourceRange.start !== t.originalExcerpt.length
    || (explanation !== undefined && (typeof explanation !== 'string'
      || explanation.slice(t.sourceRange.start, t.sourceRange.end) !== t.originalExcerpt))
    || (reference && !isCurrentTeachBackReference(t.reference, reference.scopeKey, reference.revision))) {
    throw new Error('追问关联与当前解释不一致，请重新选择当前追问；补充已保留。')
  }
  return t
}
