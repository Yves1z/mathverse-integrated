import { validPaperArtifact } from './contextIntegrity.js'
import { inkHash, recognitionValue, submittedCheckpoint, linkedSubmission } from './handwritingCheckpoint.js'

const invalid = () => { throw new Error('照片备份格式或来源无效，请重新选择照片') }
const bounded = (value, max, empty = false) => typeof value === 'string' && value.length <= max && (empty || value.trim())

export async function normalizePaperCheckpoint(value, owner, problemId) {
  if (typeof owner !== 'string' || !/^(?:anon|user:.+)$/.test(owner) || owner.length > 120
    || !String(problemId ?? '').trim() || String(problemId).length > 120
    || !value || value.format !== 'mathverse-paper-checkpoint' || ![1, 2].includes(value.version)
    || value.owner !== owner || value.problemId !== String(problemId)
    || !bounded(value.sourceVersion, 120) || !Number.isSafeInteger(value.sourceRevision) || value.sourceRevision < 1
    || !bounded(value.savedAt, 40) || !Number.isFinite(Date.parse(value.savedAt))
    || !bounded(value.text, 6000, true) || !bounded(value.editorText, 6000, true)) invalid()
  const image = value.snapshot
  if (!image || image.sourceKind !== 'paper_image' || !bounded(image.id, 120)
    || !validPaperArtifact({ ...image, type: 'image_crop' }) || image.croppedBlob.type !== 'image/png'
    || !Number.isSafeInteger(image.width) || image.width < 1 || image.width > 1800
    || !Number.isSafeInteger(image.height) || image.height < 1 || image.height > 1800) invalid()
  const c = image.crop
  const rotation = image.rotation === undefined ? 0 : image.rotation
  if (value.version === 1 && rotation !== 0) invalid()
  if (value.version === 2 && (image.rotation === undefined || await inkHash(String(rotation)) !== image.rotationHash)) invalid()
  const crop = Object.freeze({ x: c.x, y: c.y, width: c.width, height: c.height,
    originalWidth: c.originalWidth, originalHeight: c.originalHeight })
  const scale = Math.min(1, 1800 / Math.max(crop.width, crop.height))
  if (image.width !== Math.max(1, Math.round((rotation % 180 ? crop.height : crop.width) * scale))
    || image.height !== Math.max(1, Math.round((rotation % 180 ? crop.width : crop.height) * scale))) invalid()
  if (await inkHash(image.originalBlob) !== image.originalHash || await inkHash(image.croppedBlob) !== image.contentHash
    || await inkHash(image.dataUrl) !== image.imageHash || await inkHash(JSON.stringify(crop)) !== image.cropHash) invalid()
  // Explicit allowlist: originals/provenance and learner text, never prior math results or credentials.
  return { format: value.format, version: value.version, owner, problemId: String(problemId), savedAt: value.savedAt,
    sourceVersion: value.sourceVersion, sourceRevision: value.sourceRevision,
    text: value.text, editorText: value.editorText, recognition: recognitionValue(value.recognition),
    submitted: submittedCheckpoint(value.submitted, problemId),
    snapshot: { id: image.id, owner, problemId: String(problemId), sourceKind: 'paper_image',
      originalBlob: image.originalBlob, originalHash: image.originalHash, croppedBlob: image.croppedBlob,
      contentHash: image.contentHash, crop, cropHash: image.cropHash, rotation,
      ...(value.version === 2 ? { rotationHash: image.rotationHash } : {}),
      dataUrl: image.dataUrl, imageHash: image.imageHash, width: image.width, height: image.height } }
}

export function buildPaperCheckpoint({ artifact, text, recognition, attempt, editorText }) {
  const rotation = artifact.rotation === undefined ? 0 : artifact.rotation
  return Promise.all([inkHash(artifact.dataUrl), inkHash(JSON.stringify(artifact.crop)), inkHash(String(rotation))]).then(([imageHash, cropHash, rotationHash]) => (
    normalizePaperCheckpoint({ format: 'mathverse-paper-checkpoint', version: 2, owner: artifact.owner,
      problemId: artifact.problemId, savedAt: new Date().toISOString(), sourceVersion: artifact.sceneSignature,
      sourceRevision: artifact.sourceRevision, text, editorText: editorText ?? text, recognition,
      submitted: linkedSubmission(attempt, artifact), snapshot: { ...artifact, rotation, rotationHash, imageHash, cropHash } }, artifact.owner, artifact.problemId)
  ))
}
