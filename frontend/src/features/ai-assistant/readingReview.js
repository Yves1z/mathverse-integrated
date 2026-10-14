const invalid = () => { throw new Error('逐块核对记录无效，请重新核对读法') }

export function createReadingReview(recognition) {
  return { mode: 'blocks', pending: false, items: recognition.blocks.map((b) => ({ blockId: b.id, text: b.text, included: true })) }
}

// The OCR blocks are immutable evidence; this is a separate learner-owned linearization.
export function normalizeReadingReview(value, recognition) {
  if (value == null) return null // Existing checkpoints have no block review.
  if (!value || !['blocks', 'manual'].includes(value.mode) || typeof value.pending !== 'boolean'
    || !Array.isArray(value.items) || value.items.length !== recognition.blocks.length || value.items.length > 40
    || JSON.stringify(value).length > 40_000) invalid()
  const ids = new Set(recognition.blocks.map((b) => b.id)), seen = new Set()
  const items = value.items.map((item) => {
    if (!item || !ids.has(item.blockId) || seen.has(item.blockId) || typeof item.text !== 'string'
      || item.text.length > 6000 || typeof item.included !== 'boolean') invalid()
    seen.add(item.blockId)
    return { blockId: item.blockId, text: item.text, included: item.included }
  })
  const review = { mode: value.mode, pending: value.pending, items }
  if (readingReviewText(review).length > 6000) invalid()
  return review
}

export function readingReviewText(review) {
  return review.items.filter((i) => i.included).map((i) => i.text).join('\n\n')
}

export function readingReviewChanged(recognition) {
  const review = recognition.readingReview
  return Boolean(review && JSON.stringify(review.items) !== JSON.stringify(createReadingReview(recognition).items))
}

export function readingReviewFingerprint(recognition) {
  return recognition?.readingReview && (readingReviewChanged(recognition) || recognition.readingReview.pending)
    ? JSON.stringify(recognition.readingReview) : null
}

export function assertReadingConfirmation(recognition, text) {
  const review = normalizeReadingReview(recognition?.readingReview, recognition || { blocks: [] })
  if (review && (review.pending || (review.mode === 'blocks' && readingReviewText(review) !== text)
    || (review.mode === 'blocks' && review.items.some((i) => i.included && !i.text.trim())))) {
    throw new Error('请先应用逐块核对内容，或明确保留下方手动转录，再确认读法')
  }
  return review
}
