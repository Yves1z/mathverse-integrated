// A deliberately narrow deterministic tool. Variables, functions, powers and LaTeX
// return unsupported; a numerical sample must never be presented as a proof.
const ALLOWED = /^[\d\s.+\-*/()=]+$/

function gcd(a, b) {
  a = a < 0n ? -a : a
  b = b < 0n ? -b : b
  while (b) [a, b] = [b, a % b]
  return a || 1n
}

function rational(n, d = 1n) {
  if (d === 0n) throw new Error('division_by_zero')
  if (d < 0n) [n, d] = [-n, -d]
  const divisor = gcd(n, d)
  return { n: n / divisor, d: d / divisor }
}

function decimal(value) {
  const [whole, fraction = ''] = value.split('.')
  if (!whole && !fraction) throw new Error('number_expected')
  const denominator = 10n ** BigInt(fraction.length)
  return rational(BigInt(`${whole || '0'}${fraction}`), denominator)
}

function format(value) {
  return value.d === 1n ? String(value.n) : `${value.n}/${value.d}`
}

function evaluate(expression) {
  const tokens = expression.match(/\d+(?:\.\d*)?|\.\d+|[()+\-*/]/g) || []
  if (tokens.length > 80 || tokens.join('') !== expression.replace(/\s/g, '')) throw new Error('unsupported_syntax')
  let cursor = 0
  function factor() {
    const token = tokens[cursor++]
    if (token === '+' || token === '-') {
      const value = factor()
      return token === '-' ? rational(-value.n, value.d) : value
    }
    if (token === '(') {
      const value = sum()
      if (tokens[cursor++] !== ')') throw new Error('unclosed_parenthesis')
      return value
    }
    if (!token || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token) || token.length > 15) {
      throw new Error('unsupported_syntax')
    }
    return decimal(token)
  }
  function product() {
    let value = factor()
    while (tokens[cursor] === '*' || tokens[cursor] === '/') {
      const operator = tokens[cursor++]
      const right = factor()
      value = operator === '*'
        ? rational(value.n * right.n, value.d * right.d)
        : rational(value.n * right.d, value.d * right.n)
    }
    return value
  }
  function sum() {
    let value = product()
    while (tokens[cursor] === '+' || tokens[cursor] === '-') {
      const operator = tokens[cursor++]
      const right = product()
      value = rational(
        value.n * right.d + (operator === '+' ? 1n : -1n) * right.n * value.d,
        value.d * right.d,
      )
    }
    return value
  }
  const result = sum()
  if (cursor !== tokens.length) throw new Error('trailing_tokens')
  return result
}

export function verifyArithmeticEquality(input) {
  const claim = String(input || '').trim().replace(/^.*?[：:]\s*(?=[\d.+\-()])/, '')
  if (!claim || claim.length > 120 || !ALLOWED.test(claim)) {
    return { status: 'unsupported', reason: '仅支持纯数字、四则运算和括号的等式' }
  }
  const sides = claim.split('=')
  if (sides.length !== 2 || !sides[0].trim() || !sides[1].trim()) {
    return { status: 'unsupported', reason: '需要一个完整的等式' }
  }
  try {
    const left = evaluate(sides[0])
    const right = evaluate(sides[1])
    const valid = left.n === right.n && left.d === right.d
    return {
      status: valid ? 'valid' : 'invalid',
      checkedClaim: claim,
      explanation: valid
        ? `这条算术等式成立：左右两侧都等于 ${format(left)}。`
        : `这条算术等式不成立：左侧等于 ${format(left)}，右侧等于 ${format(right)}。`,
    }
  } catch {
    return { status: 'unsupported', reason: '表达式超出当前算术验证范围，或包含除以零' }
  }
}

// Only checks the numerical identity C(n,k)=m. It says nothing about whether
// choosing n objects k at a time models the event in the learner's problem.
export function verifyCombinationEquality(input) {
  const match = String(input || '').trim().match(/^C\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)\s*=\s*(\d{1,100})$/i)
  if (!match) return { status: 'unsupported' }
  const n = Number(match[1])
  const k = Number(match[2])
  if (n > 200 || k > n) return { status: 'unsupported' }
  let actual = 1n
  for (let i = 1; i <= Math.min(k, n - k); i += 1) {
    actual = actual * BigInt(n - Math.min(k, n - k) + i) / BigInt(i)
  }
  return { status: actual === BigInt(match[3]) ? 'valid' : 'invalid',
    checkedClaim: match[0], actual: String(actual) }
}
