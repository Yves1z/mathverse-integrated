import assert from 'node:assert/strict'
import test from 'node:test'
import { verifyArithmeticEquality, verifyCombinationEquality } from './arithmeticVerifier.js'

test('exact rational arithmetic verifies valid and invalid claims', () => {
  assert.equal(verifyArithmeticEquality('1/2+1/3=5/6').status, 'valid')
  assert.equal(verifyArithmeticEquality('0.1+0.2=0.3').status, 'valid')
  assert.equal(verifyArithmeticEquality('2*(3-1)=5').status, 'invalid')
  assert.equal(verifyArithmeticEquality('只检查这一步：1/2 + 1/3 = 5/6').status, 'valid')
})

test('unsupported expressions are never guessed from samples', () => {
  for (const value of ['x+1=2', 'x^2=4', '1/0=3', '1=1=1', '\\frac{1}{2}=0.5', '2(3)=6']) {
    assert.equal(verifyArithmeticEquality(value).status, 'unsupported', value)
  }
})

test('a narrow combination identity check verifies numbers but not counting applicability', () => {
  assert.equal(verifyCombinationEquality('C(9,3)=84').status, 'valid')
  assert.equal(verifyCombinationEquality('C(9,3)=83').status, 'invalid')
  assert.equal(verifyCombinationEquality('C(9,0)=1').status, 'valid')
  for (const claim of ['C(9,10)=0', 'C(201,3)=1333300', 'C(x,3)=84', '总取法 C(9,3)=84']) {
    assert.equal(verifyCombinationEquality(claim).status, 'unsupported', claim)
  }
})
