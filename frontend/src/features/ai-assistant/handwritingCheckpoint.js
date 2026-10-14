import { parseHandwritingRecognition } from './handwritingRecognition.js'
import { restoreTypedAttempt } from './typedAttempt.js'
import { normalizeReadingReview, assertReadingConfirmation } from './readingReview.js'

const invalid = () => { throw new Error('手写备份格式或来源无效，请重新提交选区') }
const bounded = (value, size, empty = false) => typeof value === 'string' && value.length <= size && (empty || value.trim())
export async function inkHash(value) {
  const bytes = value instanceof Blob ? await value.arrayBuffer() : new TextEncoder().encode(value)
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (n) => n.toString(16).padStart(2, '0')).join('')
}

export function recognitionValue(value) {
  if (value == null) return null
  if (!Array.isArray(value.blocks)) invalid()
  if (!value.blocks.length) return null
  const parsed = parseHandwritingRecognition(JSON.stringify({ blocks: value.blocks.map(({ text, alternatives, confidence, uncertainty }) => ({ text, alternatives, confidence, uncertainty })) }))
  if (value.readingReview != null) parsed.readingReview = normalizeReadingReview(value.readingReview, parsed)
  if (value.provider) {
    let url
    try { url = new URL(value.provider.endpoint) } catch { invalid() }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !bounded(value.provider.model, 120)) invalid()
    parsed.provider = { endpoint: `${url.origin}${url.pathname}`, model: value.provider.model }
  }
  return parsed
}

export function submittedCheckpoint(value, problemId) {
  if (!value) return null
  const base = restoreTypedAttempt(value, String(problemId))
  if (!['user_confirmed', 'user_edited_transcription'].includes(value.recognitionStatus)
    || !Number.isFinite(Date.parse(value.confirmedAt))) invalid()
  const recognition = recognitionValue(value.recognition)
  assertReadingConfirmation(recognition, base.rawText)
  return { id: base.id, problemId: base.problemId, version: base.version, rawText: base.rawText,
    createdAt: base.createdAt, updatedAt: base.updatedAt, confirmedAt: value.confirmedAt,
    recognitionStatus: value.recognitionStatus, recognition }
}

export function linkedSubmission(attempt, artifact) {
  return attempt?.recognition?.artifactId === artifact.id ? {
    id: attempt.id, problemId: attempt.problemId, version: attempt.version, rawText: attempt.rawText,
    createdAt: attempt.createdAt, updatedAt: attempt.updatedAt, confirmedAt: attempt.recognition.confirmedAt,
    recognitionStatus: attempt.recognition.status, recognition: { blocks: attempt.recognition.blocks, provider: attempt.recognition.provider,
      readingReview: attempt.recognition.readingReview },
  } : null
}

export async function normalizeInkCheckpoint(value, owner, problemId) {
  if (typeof owner !== 'string' || !/^(?:anon|user:.+)$/.test(owner) || owner.length > 120
    || !String(problemId ?? '').trim() || String(problemId).length > 120
    || !value || value.format !== 'mathverse-ink-checkpoint' || value.version !== 1
    || value.owner !== owner || value.problemId !== String(problemId)
    || !bounded(value.sourceVersion, 120) || !/^[a-f0-9]{64}$/.test(value.sourceHash || '')
    || !bounded(value.sourceSessionId, 120) || !Number.isSafeInteger(value.sourceRevision) || value.sourceRevision < 1
    || !Number.isFinite(Date.parse(value.savedAt)) || !bounded(value.text, 6000, true)
    || !bounded(value.editorText, 6000, true)) invalid()
  const image = value.snapshot
  if (!image || !bounded(image.id, 120) || !bounded(image.rawScene, 4_000_000)
    || !(image.originalBlob instanceof Blob) || image.originalBlob.type !== 'image/png'
    || image.originalBlob.size < 1 || image.originalBlob.size > 8_000_000
    || !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image.dataUrl || '') || image.dataUrl.length > 3_000_000
    || !Number.isSafeInteger(image.width) || image.width < 1 || image.width > 1800
    || !Number.isSafeInteger(image.height) || image.height < 1 || image.height > 1800) invalid()
  let scene
  try { scene = JSON.parse(image.rawScene) } catch { invalid() }
  if (!Array.isArray(scene.elements) || !scene.elements.length || scene.elements.length > 500
    || !scene.elements.every((e) => bounded(e.id, 120) && !e.isDeleted)) invalid()
  if (await inkHash(image.originalBlob) !== image.contentHash || await inkHash(image.rawScene) !== image.rawSceneHash
    || await inkHash(image.dataUrl) !== image.imageHash) invalid()
  const recognition = recognitionValue(value.recognition)
  const submitted = submittedCheckpoint(value.submitted, problemId)
  // Explicit allowlist: never persist keys, consent, math feedback, tool results or cache.
  return { format: value.format, version: 1, owner, problemId: String(problemId), savedAt: value.savedAt,
    sourceVersion: value.sourceVersion, sourceHash: value.sourceHash, sourceSessionId: value.sourceSessionId,
    sourceRevision: value.sourceRevision, text: value.text, editorText: value.editorText, recognition, submitted,
    snapshot: { id: image.id, owner, problemId: String(problemId), rawScene: image.rawScene, originalBlob: image.originalBlob,
      dataUrl: image.dataUrl, width: image.width, height: image.height, contentHash: image.contentHash,
      rawSceneHash: image.rawSceneHash, imageHash: image.imageHash } }
}

export async function buildInkCheckpoint({ artifact, text, recognition, attempt, editorText, canvas }) {
  const submitted = linkedSubmission(attempt, artifact)
  const value = { format: 'mathverse-ink-checkpoint', version: 1, owner: artifact.owner, problemId: artifact.problemId,
    savedAt: new Date().toISOString(), sourceVersion: canvas.sourceVersion,
    sourceHash: await inkHash(artifact.sceneSignature), sourceSessionId: artifact.sourceSessionId,
    sourceRevision: artifact.sourceRevision, text, editorText: editorText ?? text, recognition, submitted,
    snapshot: { ...artifact, rawSceneHash: await inkHash(artifact.rawScene), imageHash: await inkHash(artifact.dataUrl) } }
  return normalizeInkCheckpoint(value, artifact.owner, artifact.problemId)
}
