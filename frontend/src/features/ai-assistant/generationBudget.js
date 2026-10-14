export const MAX_GENERATION_TOKENS = 65_536

const PRESET_TOKENS = new Map([
  ['8192', 8_192],
  ['16384', 16_384],
  ['32768', 32_768],
  ['65536', MAX_GENERATION_TOKENS],
])

export function resolveGenerationBudget(selection, customTokens, automaticTokens) {
  if (selection === 'auto') return { mode: 'auto', maxTokens: automaticTokens }
  if (PRESET_TOKENS.has(selection)) return { mode: 'manual', maxTokens: PRESET_TOKENS.get(selection) }
  if (selection !== 'custom') throw new Error('请选择有效的生成额度')
  const maxTokens = Number(customTokens)
  if (!Number.isInteger(maxTokens) || maxTokens < 256 || maxTokens > MAX_GENERATION_TOKENS) {
    throw new Error('自定义生成额度请输入 256–65,536 之间的整数')
  }
  return { mode: 'manual', maxTokens }
}
