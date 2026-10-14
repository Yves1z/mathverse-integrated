import test from 'node:test'
import assert from 'node:assert/strict'
import { splitPaperChoices } from './questionChoices.js'

test('分行书写的选项按标记拆成四段', () => {
  const source = '12. 已知 $A.B=1$，求值。\nA. $1$    B. $2$    C. $3$    D. $4$'
  const split = splitPaperChoices(source)
  assert.equal(split.stem, '12. 已知 $A.B=1$，求值。')
  assert.deepEqual(split.options, ['$1$', '$2$', '$3$', '$4$'])
})

test('写成一整个公式的选项也能拆成四段', () => {
  const source =
    '已知集合 $M=\\{-2, -1\\}$，则 $M\\cap N=$（ ）\n$\\text{A. }\\{-2, -1, 0, 1\\}\\qquad\\text{B. }\\{0, 1, 2\\}\\qquad\\text{C. }\\{-2\\}\\qquad\\text{D. }\\{2\\}$'
  const split = splitPaperChoices(source)
  assert.equal(split.stem, '已知集合 $M=\\{-2, -1\\}$，则 $M\\cap N=$（ ）')
  assert.deepEqual(split.options, [
    '$\\{-2, -1, 0, 1\\}$',
    '$\\{0, 1, 2\\}$',
    '$\\{-2\\}$',
    '$\\{2\\}$',
  ])
})

test('全角字母与全角句点同样识别，非标准公式不误拆', () => {
  const full =
    '$\\text{Ａ．}d=3\\qquad \\text{Ｂ．}d=4\\qquad \\text{Ｃ．}d=5\\qquad \\text{Ｄ．}d=6$'
  assert.deepEqual(splitPaperChoices(`求 $d$ 的值。\n\n${full}`).options, [
    '$d=3$',
    '$d=4$',
    '$d=5$',
    '$d=6$',
  ])
  assert.equal(splitPaperChoices('由 $x\\text{A．}y$ 可得。'), null)
  assert.equal(
    splitPaperChoices('已知三项 $\\text{A．}1\\qquad \\text{B．}2\\qquad \\text{C．}3$'),
    null,
  )
  assert.equal(
    splitPaperChoices('选项 $\\text{A．}x\\text{B．}y\\text{C．}z\\text{D．}w\\text{E．}v$'),
    null,
  )
})
