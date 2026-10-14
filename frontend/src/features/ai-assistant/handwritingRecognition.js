import { assertReadingConfirmation } from './readingReview.js'

export function parseHandwritingRecognition(content) {
  let value
  try { value = JSON.parse(String(content).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) }
  catch { throw new Error('手写识别未返回完整的结构化内容，请重试或手动转录') }
  const invalid = () => { throw new Error('手写识别格式不正确，请重试或手动转录') }
  if (!value || Object.keys(value).some((key) => key !== 'blocks') || !Array.isArray(value.blocks)
    || !value.blocks.length || value.blocks.length > 40) invalid()
  const blocks = value.blocks.map((block, index) => {
    if (!block || Object.keys(block).some((key) => !['text', 'alternatives', 'confidence', 'uncertainty'].includes(key))
      || typeof block.text !== 'string' || !block.text.trim() || block.text.length > 6000
      || !Array.isArray(block.alternatives) || block.alternatives.length > 5
      || !block.alternatives.every((a) => typeof a === 'string' && a.length <= 6000)
      || typeof block.uncertainty !== 'string' || block.uncertainty.length > 500
      || (block.confidence !== null && (typeof block.confidence !== 'number'
        || !Number.isFinite(block.confidence) || block.confidence < 0 || block.confidence > 1))) invalid()
    return { id: `block${index + 1}`, text: block.text, alternatives: [...block.alternatives],
      confidence: block.confidence, uncertainty: block.uncertainty }
  })
  const text = blocks.map((b) => b.text).join('\n\n')
  if (text.length > 6000 || JSON.stringify(blocks).length > 40_000) invalid()
  return { blocks, text }
}

export function needsTranscriptionReplacement(text, recognition) {
  return Boolean(text.trim()) && text !== recognition?.text
}

// Apply only parsed results, including cache hits. OCR never owns learner edits.
export function applyHandwritingRecognition({ result, text, recognition, allowReplacement = false }) {
  if (needsTranscriptionReplacement(text, recognition) && !allowReplacement) {
    throw new Error('当前转录已手动填写或修改，请明确选择替换后再识别')
  }
  return { text: result.text, recognition: result }
}

export function confirmHandwriting(artifact, recognition, text, sourceCurrent) {
  if (!sourceCurrent) throw new Error('图片或画板来源已修改，请重新选择并提交区域')
  if (!artifact?.id || !text?.trim() || text.length > 6000 || text.includes('[无法辨认]')) {
    throw new Error('请先补全无法辨认的内容，再确认读法')
  }
  assertReadingConfirmation(recognition, text)
  return { artifact, recognition: recognition || { blocks: [], text: '' }, text,
    confirmedAt: new Date().toISOString() }
}
