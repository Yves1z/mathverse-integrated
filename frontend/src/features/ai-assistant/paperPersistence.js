import { authOwner } from '../../services/authIdentity.js'
import { draftRecordKey, readPaperCheckpoint, writePaperCheckpoint, deletePaperCheckpoint } from '../draft/draftStore.js'
import { isHandwritingCurrent, paperSourceReference, installRestoredPaper } from '../draft/draftAgentBridge.js'
import { buildPaperCheckpoint, normalizePaperCheckpoint } from './paperCheckpoint.js'

const generations = new Map()
export function deletePhotoCheckpoint(owner, problemId) {
  const key = draftRecordKey(owner, problemId)
  generations.set(key, (generations.get(key) || 0) + 1)
  return deletePaperCheckpoint(owner, problemId)
}
export async function savePhotoCheckpoint(input) {
  const a = input.artifact, key = draftRecordKey(a.owner, a.problemId), generation = generations.get(key) || 0
  if (a.sourceKind !== 'paper_image' || !isHandwritingCurrent(a)) throw new Error('照片选区已过期，请重新提交后保存')
  const record = await buildPaperCheckpoint(input)
  if ((generations.get(key) || 0) !== generation) throw new Error('保存已取消，照片备份已删除')
  if (!isHandwritingCurrent(a) || authOwner.value !== a.owner) throw new Error('保存期间账号或照片已变化，请重试')
  await writePaperCheckpoint(a.owner, a.problemId, record)
  return record
}

// Decode each persisted image before it can be displayed or sent. Hashes alone do not establish an image's dimensions.
async function checkDecodedPhoto(snapshot) {
  const blobs = [snapshot.originalBlob, snapshot.croppedBlob,
    await (await fetch(snapshot.dataUrl)).blob()]
  const sizes = [[snapshot.crop.originalWidth, snapshot.crop.originalHeight],
    [snapshot.width, snapshot.height], [snapshot.width, snapshot.height]]
  for (let index = 0; index < blobs.length; index++) {
    const url = URL.createObjectURL(blobs[index])
    try {
      const image = new Image()
      await new Promise((resolve, reject) => {
        image.onload = resolve
        image.onerror = () => reject(new Error('照片备份无法解码，请重新选择照片'))
        image.src = url
      })
      if (image.naturalWidth !== sizes[index][0] || image.naturalHeight !== sizes[index][1]) {
        throw new Error('照片备份尺寸与裁剪来源不一致，请重新选择照片')
      }
    } finally { URL.revokeObjectURL(url) }
  }
}

export async function restorePhotoCheckpoint(owner, problemId, stillWanted) {
  const before = paperSourceReference(problemId), key = draftRecordKey(owner, problemId), generation = generations.get(key) || 0
  if (authOwner.value !== owner || before.owner !== owner || !stillWanted()) throw new Error('恢复已取消，账号或题目已变化')
  const raw = await readPaperCheckpoint(owner, problemId)
  if (!raw) throw new Error('本题没有主动保存的照片备份')
  const record = await normalizePaperCheckpoint(raw, owner, problemId)
  await checkDecodedPhoto(record.snapshot)
  if (authOwner.value !== owner || !stillWanted() || (generations.get(key) || 0) !== generation) throw new Error('恢复已取消，账号、题目或备份已变化')
  const artifact = installRestoredPaper({ ...record.snapshot,
    restoredReview: { text: record.text, recognition: record.recognition } }, before)
  return { record, artifact }
}
