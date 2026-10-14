import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveGenerationBudget } from './generationBudget.js'

test('generation budget is independent of reasoning mode and visible answer length', () => {
  assert.deepEqual(resolveGenerationBudget('auto', 32_768, 500), { mode: 'auto', maxTokens: 500 })
  assert.deepEqual(resolveGenerationBudget('32768', 500, 500), { mode: 'manual', maxTokens: 32_768 })
  assert.deepEqual(resolveGenerationBudget('custom', 25_000, 900), { mode: 'manual', maxTokens: 25_000 })
})

test('custom budget rejects invalid or excessive values instead of silently clamping', () => {
  for (const value of [0, 255, 65_537, 1.5, 'not a number']) {
    assert.throws(() => resolveGenerationBudget('custom', value, 900), /256–65,536/)
  }
  assert.throws(() => resolveGenerationBudget('unknown', 900, 900), /有效的生成额度/)
})
