// This tool proves only the sign of x-y under an explicit x>y condition.
// It never evaluates an entire draft step, route, logarithm, or OCR reading.
export const PREMISE_SIGN_TOOL = Object.freeze({
  name: 'verify_ordered_difference_sign', version: 1,
  description: '核对显式严格大小关系下的单条差值符号，不核验整步或解题路线',
  category: 'verification', executionType: 'deterministic', permissions: [], timeoutMs: 100,
  costClass: 'low',
  inputSchema: { type: 'object', required: ['problemStatement', 'premiseText'], additionalProperties: false,
    properties: { problemStatement: { type: 'string', maxLength: 6000 }, premiseText: { type: 'string', maxLength: 2000 } } },
  outputSchema: { status: ['valid', 'invalid', 'unknown'], scope: 'single_difference_sign' },
})

const ASSUMPTION = /^已知\s*(?:实数\s*)?([A-Za-z])\s*>\s*([A-Za-z])(?:\s*>\s*0)?(?=$|[，,。；;])/
const CLAIM = /^(?:由\s*([A-Za-z])\s*>\s*([A-Za-z])(?:\s*>\s*0)?\s*可知\s*)?([A-Za-z])\s*-\s*([A-Za-z])\s*([<>=])\s*0$/
// These glyphs have the same mathematical meaning in a confirmed transcription.
// Ambiguous dash/OCR characters remain unsupported.
const normalizeMathGlyphs = value => value.replace(/−/g, '-').replace(/＞/g, '>')
  .replace(/＜/g, '<').replace(/＝/g, '=')

export function verifyOrderedDifferenceSign(input) {
  const result = { tool: PREMISE_SIGN_TOOL.name, version: PREMISE_SIGN_TOOL.version,
    status: 'unknown', scope: 'single_difference_sign', checkedClaim: null,
    assumptions: [], expectedClaim: null, reason: 'unsupported' }
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => key !== 'problemStatement' && key !== 'premiseText')
    || typeof input.problemStatement !== 'string' || typeof input.premiseText !== 'string'
    || input.problemStatement.length > 6000 || input.premiseText.length > 2000) {
    return { ...result, reason: 'invalid_input' }
  }
  const problem = normalizeMathGlyphs(input.problemStatement.trim())
  const premise = normalizeMathGlyphs(input.premiseText.trim()).replace(/[。.]\s*$/, '').trim()
  const assumption = problem.match(ASSUMPTION)
  const claim = premise.match(CLAIM)
  if (!assumption || !claim || assumption[1] === assumption[2]) return result
  // Any later branch or qualification may change which conditions are active.
  if (/(?:或|但|不过|除非|不一定|未必|假设|若|当|如果|假如|改为|分情况|情形|且|并且|同时|又知|另有|[<>=≤≥])/.test(problem.slice(assumption[0].length))) return result
  const [, greater, lesser] = assumption
  const [, citedGreater, citedLesser, left, right, operator] = claim
  if (citedGreater && (citedGreater !== greater || citedLesser !== lesser)) return result
  const forward = left === greater && right === lesser
  const reverse = left === lesser && right === greater
  if (!forward && !reverse) return result
  const expectedOperator = forward ? '>' : '<'
  const checkedClaim = `${left}-${right}${operator}0`
  return { ...result, status: operator === expectedOperator ? 'valid' : 'invalid',
    checkedClaim, assumptions: [`${greater}>${lesser}`],
    expectedClaim: `${left}-${right}${expectedOperator}0`, reason: 'strict_order' }
}
