import { normalizeReadingReview, readingReviewChanged, readingReviewFingerprint } from './readingReview.js'

const MAX_ATTEMPT_LENGTH = 6000
const MAX_STEPS = 40

// Rebuild source ranges from immutable text instead of trusting stored derived steps.
export function restoreTypedAttempt(value, problemId) {
  if (!value || typeof value !== 'object' || value.problemId !== problemId
    || typeof value.id !== 'string' || !value.id.trim() || value.id.length > 120
    || !Number.isSafeInteger(value.version) || value.version < 1 || value.version > 1_000_000
    || typeof value.rawText !== 'string' || !value.rawText.trim() || value.rawText.length > MAX_ATTEMPT_LENGTH
    || typeof value.createdAt !== 'string' || value.createdAt.length > 40 || !Number.isFinite(Date.parse(value.createdAt))
    || typeof value.updatedAt !== 'string' || value.updatedAt.length > 40 || !Number.isFinite(Date.parse(value.updatedAt))
    || Date.parse(value.createdAt) > Date.parse(value.updatedAt)) {
    throw new Error('保存的草稿版本无效')
  }
  return {
    id: value.id, problemId, version: value.version, rawText: value.rawText,
    source: attemptSource(value.rawText),
    rawArtifacts: [{ id: `${value.id}:v${value.version}:raw`, type: 'typed_text', content: value.rawText }],
    steps: parseSteps(value.rawText, value.id, value.version),
    edges: [], currentFocus: null, currentFrontier: [], status: 'submitted',
    createdAt: value.createdAt, updatedAt: value.updatedAt,
  }
}

export function attemptReference(attempt) {
  return { id: attempt.id, problemId: attempt.problemId, version: attempt.version }
}

export function restoreHandwritingAttempt(value, handwriting) {
  const base = restoreTypedAttempt(value, handwriting.artifact.problemId)
  const source = commitTypedAttempt({ problemId: base.problemId, rawText: base.rawText, handwriting })
  return { ...base, source: 'mixed', rawArtifacts: [base.rawArtifacts[0], source.rawArtifacts[1]], recognition: source.recognition }
}

export function isCurrentAttemptReference(reference, attempt, rawText) {
  return Boolean(reference && attempt && reference.id === attempt.id
    && reference.problemId === attempt.problemId && reference.version === attempt.version
    && rawText === attempt.rawText)
}

function attemptSource(text) {
  const hasLatex = /\\[A-Za-z]+|\$/.test(text)
  const hasProse = /[\u4e00-\u9fff]/.test(text)
  if (hasLatex && hasProse) return 'mixed'
  return hasLatex ? 'latex' : 'plain_text'
}

function parseSteps(sourceText, attemptId, version) {
  const steps = []
  let cursor = 0
  // Empty lines delimit steps; a single newline may be part of aligned mathematics.
  for (const paragraph of sourceText.split(/\r?\n[\t ]*\r?\n(?:[\t ]*\r?\n)*/)) {
    const content = paragraph.trim()
    if (!content) continue
    const start = sourceText.indexOf(content, cursor)
    if (start < 0) throw new Error('草稿步骤无法定位，请重新输入')
    steps.push({
      id: `${attemptId}:v${version}:step${steps.length + 1}`,
      number: steps.length + 1,
      type: 'note',
      rawContent: content,
      sourceRange: { start, end: start + content.length },
      author: 'user',
    })
    cursor = start + content.length
  }
  if (!steps.length || steps.length > MAX_STEPS) throw new Error(`草稿须包含 1～${MAX_STEPS} 个步骤`)
  return steps
}

export function commitTypedAttempt({ previous = null, problemId, rawText, handwriting = null }) {
  const id = String(problemId || '').trim()
  const sourceText = String(rawText ?? '')
  if (!id) throw new Error('请先打开一道题目，再提交草稿')
  if (!sourceText.trim()) throw new Error('请先输入草稿')
  if (sourceText.length > MAX_ATTEMPT_LENGTH) throw new Error(`草稿不能超过 ${MAX_ATTEMPT_LENGTH} 个字符`)
  if (handwriting && (handwriting.artifact?.problemId !== id || !handwriting.confirmedAt)) {
    throw new Error('手写来源与当前题目不一致，请重新确认')
  }
  const readingReview = handwriting?.recognition?.readingReview ? normalizeReadingReview({ ...handwriting.recognition.readingReview,
    mode: sourceText === handwriting.text ? handwriting.recognition.readingReview.mode : 'manual' }, handwriting.recognition) : null
  if (previous?.problemId === id && previous.rawText === sourceText
    && (previous.recognition?.artifactId || null) === (handwriting?.artifact?.id || null)
    && readingReviewFingerprint(previous.recognition) === readingReviewFingerprint(handwriting ? { ...handwriting.recognition, readingReview } : null)) return previous

  const attemptId = previous?.problemId === id ? previous.id : crypto.randomUUID()
  const version = previous?.problemId === id ? previous.version + 1 : 1
  const steps = parseSteps(sourceText, attemptId, version)
  const now = new Date().toISOString()
  return {
    id: attemptId,
    problemId: id,
    source: handwriting ? 'mixed' : attemptSource(sourceText),
    version,
    rawText: sourceText,
    rawArtifacts: [{ id: `${attemptId}:v${version}:raw`, type: 'typed_text', content: sourceText },
      ...(handwriting ? [{ id: handwriting.artifact.id, type: handwriting.artifact.sourceKind === 'paper_image' ? 'image_crop' : 'ink_snapshot',
        ...(handwriting.artifact.sourceKind === 'paper_image' ? {
          crop: handwriting.artifact.crop, rotation: handwriting.artifact.rotation ?? 0, croppedBlob: handwriting.artifact.croppedBlob, originalHash: handwriting.artifact.originalHash,
        } : { content: handwriting.artifact.rawScene }), originalBlob: handwriting.artifact.originalBlob,
        dataUrl: handwriting.artifact.dataUrl, contentHash: handwriting.artifact.contentHash }] : [])],
    ...(handwriting ? { recognition: {
      artifactId: handwriting.artifact.id, sceneSignature: handwriting.artifact.sceneSignature,
      sourceKind: handwriting.artifact.sourceKind || 'ink',
      owner: handwriting.artifact.owner, ownerEpoch: handwriting.artifact.ownerEpoch,
      sourceRevision: handwriting.artifact.sourceRevision,
      confirmedAt: handwriting.confirmedAt,
      status: !readingReviewChanged(handwriting.recognition) && sourceText === (handwriting.recognition.blocks.length
        ? handwriting.recognition.text : handwriting.text) ? 'user_confirmed' : 'user_edited_transcription',
      method: handwriting.recognition.blocks.length ? 'vision_transcription' : 'manual_transcription',
      provider: handwriting.recognition.provider || null,
      blocks: handwriting.recognition.blocks,
      ...(readingReview ? { readingReview } : {}),
    } } : {}),
    steps,
    edges: [],
    currentFocus: null,
    currentFrontier: [],
    status: 'submitted',
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  }
}
