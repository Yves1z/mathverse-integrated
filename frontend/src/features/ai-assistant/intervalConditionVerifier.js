// Exact set relations for one explicit, nonempty real interval. No code evaluation.
export const INTERVAL_CONDITION_TOOL = Object.freeze({
  name: 'verify_interval_condition', version: 1, category: 'verification',
  description: '核对显式题设范围与单个候选区间的包含或不相交关系',
  executionType: 'deterministic', permissions: [], timeoutMs: 100, costClass: 'low',
  inputSchema: { type: 'object', required: ['problemStatement', 'conditionText'], additionalProperties: false,
    properties: { problemStatement: { type: 'string', maxLength: 6000 },
      conditionText: { type: 'string', maxLength: 160 }, readingUncertain: { type: 'boolean' } } },
  outputSchema: { status: ['valid', 'invalid', 'unknown'], scope: 'single_variable_interval',
    relation: ['subset', 'disjoint', 'overlap', 'unknown'] },
})

const NUMBER = '[+-]?(?:\\d{1,9}(?:\\.\\d{1,6})?|\\d{1,9}/\\d{1,6})'
const BOUND = `(?:${NUMBER}|[+-]?∞)`
const LITERAL = new RegExp(`^([A-Za-z])∈([[(])(${BOUND}),(${BOUND})([\\])])$`)
const SINGLE = new RegExp(`^([A-Za-z])([<>]=?)(${NUMBER})$`)
const CHAIN = new RegExp(`^(${NUMBER})(<=?)([A-Za-z])(<=?)(${NUMBER})$`)
function normalize(text) {
  let value = text.trim().replace(/。$/, '').trim()
  if (value.startsWith('$') && value.endsWith('$') && !value.startsWith('$$')) value = value.slice(1, -1)
  // Whitespace may separate operators, but must not silently fuse numeric tokens.
  if (/\d\s+\d/.test(value)) return ''
  return value.replace(/\\(?:geq|ge)(?![A-Za-z])/g, '>=').replace(/\\(?:leq|le)(?![A-Za-z])/g, '<=')
    .replace(/\\infty(?![A-Za-z])/g, '∞').replace(/\\in(?![A-Za-z])/g, '∈')
    .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/−/g, '-').replace(/＞/g, '>').replace(/＜/g, '<')
    .replace(/\s/g, '')
}
function gcd(a, b) { while (b) { const next = a % b; a = b; b = next } return a < 0n ? -a : a }
function bound(text) {
  if (text === '-∞') return { infinity: -1, text }
  if (text === '∞' || text === '+∞') return { infinity: 1, text: '+∞' }
  let n, d
  if (text.includes('/')) { const pieces = text.split('/'); n = BigInt(pieces[0]); d = BigInt(pieces[1]) }
  else if (text.includes('.')) { const pieces = text.split('.'); n = BigInt(pieces.join('')); d = 10n ** BigInt(pieces[1].length) }
  else { n = BigInt(text); d = 1n }
  if (d === 0n) return null
  const common = gcd(n, d); n /= common; d /= common
  return { n, d, text: d === 1n ? String(n) : `${n}/${d}` }
}
function compare(a, b) {
  if (a.infinity || b.infinity) return Math.sign((a.infinity || 0) - (b.infinity || 0))
  const delta = a.n * b.d - b.n * a.d
  return delta === 0n ? 0 : delta > 0n ? 1 : -1
}
function parseRange(text) {
  const value = normalize(text)
  let variable, lower, upper, lowerClosed, upperClosed
  const literal = value.match(LITERAL), single = value.match(SINGLE), chain = value.match(CHAIN)
  if (literal) {
    variable = literal[1]; lower = bound(literal[3]); upper = bound(literal[4])
    lowerClosed = literal[2] === '['; upperClosed = literal[5] === ']'
  } else if (single) {
    variable = single[1]; const finite = bound(single[3]), greater = single[2].startsWith('>')
    lower = greater ? finite : bound('-∞'); upper = greater ? bound('+∞') : finite
    lowerClosed = greater && single[2] === '>='; upperClosed = !greater && single[2] === '<='
  } else if (chain) {
    variable = chain[3]; lower = bound(chain[1]); upper = bound(chain[5])
    lowerClosed = chain[2] === '<='; upperClosed = chain[4] === '<='
  } else return null
  if (!lower || !upper || lower.infinity === 1 || upper.infinity === -1
    || (lower.infinity && lowerClosed) || (upper.infinity && upperClosed)) return null
  const order = compare(lower, upper)
  if (order > 0 || (order === 0 && !(lowerClosed && upperClosed))) return null
  return { variable, lower, upper, lowerClosed, upperClosed,
    text: `${variable}∈${lowerClosed ? '[' : '('}${lower.text},${upper.text}${upperClosed ? ']' : ')'}` }
}
// Syntax descriptor only: supplies no mathematical truth or problem-source authority.
export function describeSingleInterval(value) {
  if (typeof value !== 'string' || value.length > 160) return null
  const range = parseRange(value)
  return range ? Object.freeze({ variable: range.variable, text: range.text }) : null
}
function explicitGiven(statement) {
  const prefix = statement.trim().match(/^已知\s*(?:实数\s*)?/)
  if (!prefix) return null
  const rest = statement.trim().slice(prefix[0].length)
  // Try bounded punctuation boundaries; commas inside [a,b] are not statement separators.
  for (let end = 1; end <= Math.min(rest.length, 160); end += 1) {
    if (end < rest.length && !/[，,。；;]/.test(rest[end])) continue
    const interval = parseRange(rest.slice(0, end))
    if (interval) return { interval, tail: rest.slice(end) }
  }
  return null
}
export function verifyIntervalCondition(input) {
  const result = { tool: INTERVAL_CONDITION_TOOL.name, version: 1, scope: 'single_variable_interval',
    status: 'unknown', relation: 'unknown', checkedClaim: null, expectedClaim: null,
    assumptions: [], variable: null, reason: 'unsupported_claim' }
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => !['problemStatement', 'conditionText', 'readingUncertain'].includes(key))
    || typeof input.problemStatement !== 'string' || input.problemStatement.length > 6000
    || typeof input.conditionText !== 'string' || input.conditionText.length > 160
    || ('readingUncertain' in input && typeof input.readingUncertain !== 'boolean')) return { ...result, reason: 'invalid_input' }
  if (input.readingUncertain) return { ...result, reason: 'unconfirmed_reading' }
  const claim = parseRange(input.conditionText)
  if (!claim) return result
  const scoped = { ...result, variable: claim.variable, checkedClaim: claim.text }
  const given = explicitGiven(input.problemStatement)
  if (!given) return { ...scoped, reason: 'missing_range' }
  // Closed grammar for the remainder: unparsed qualifications must never become proof.
  // These task phrases add no new assumption, branch or withdrawal of the given range.
  if (!/^[，,。；;\s]*(?:(?:讨论|研究)(?:单调性|差值符号|符号)?[。.]?\s*)?$/.test(given.tail))
    return { ...scoped, reason: 'qualified_context' }
  const source = given.interval
  if (source.variable !== claim.variable) return { ...scoped, reason: 'variable_mismatch' }
  const evidence = { ...scoped, assumptions: [source.text], expectedClaim: source.text }
  const lo = compare(source.lower, claim.lower), hi = compare(source.upper, claim.upper)
  const subset = (lo > 0 || (lo === 0 && (!source.lowerClosed || claim.lowerClosed)))
    && (hi < 0 || (hi === 0 && (!source.upperClosed || claim.upperClosed)))
  if (subset) return { ...evidence, status: 'valid', relation: 'subset', reason: 'interval_relation' }
  const left = compare(source.upper, claim.lower), right = compare(claim.upper, source.lower)
  const disjoint = left < 0 || (left === 0 && !(source.upperClosed && claim.lowerClosed))
    || right < 0 || (right === 0 && !(claim.upperClosed && source.lowerClosed))
  return { ...evidence, status: disjoint ? 'invalid' : 'unknown', relation: disjoint ? 'disjoint' : 'overlap',
    reason: 'interval_relation' }
}
