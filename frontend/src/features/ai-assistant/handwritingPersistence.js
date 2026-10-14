import { authOwner } from '../../services/authIdentity.js'
import { readDraft, writeDraft, readInkCheckpoint, writeInkCheckpoint, deleteInkCheckpoint, draftRecordKey } from '../draft/draftStore.js'
import { draftSceneSignature } from '../draft/inkSelection.js'
import { draftSessionId, draftSourceReference, publishDraftScene, isHandwritingCurrent, installRestoredHandwriting } from '../draft/draftAgentBridge.js'
import { buildInkCheckpoint, normalizeInkCheckpoint, inkHash } from './handwritingCheckpoint.js'
const generations = new Map()

export function deleteHandwritingCheckpoint(owner, problemId) {
  const key = draftRecordKey(owner, problemId)
  generations.set(key, (generations.get(key) || 0) + 1)
  return deleteInkCheckpoint(owner, problemId)
}

export async function saveHandwritingCheckpoint(input) {
  const artifact = input.artifact
  const key = draftRecordKey(artifact.owner, artifact.problemId)
  const generation = generations.get(key) || 0
  if (!isHandwritingCurrent(artifact) || authOwner.value !== artifact.owner) throw new Error('选区已过期，请重新提交后保存')
  let canvas = await readDraft(artifact.owner, artifact.problemId)
  if (!canvas || draftSceneSignature(canvas) !== artifact.sceneSignature) throw new Error('画板尚未完成保存，请稍后再保存手写备份')
  if (!canvas.sourceVersion) {
    await writeDraft(artifact.owner, artifact.problemId, canvas)
    canvas = await readDraft(artifact.owner, artifact.problemId)
  }
  const record = await buildInkCheckpoint({ ...input, canvas })
  if ((generations.get(key) || 0) !== generation) throw new Error('保存已取消，备份已删除')
  if (!isHandwritingCurrent(artifact) || authOwner.value !== artifact.owner) throw new Error('保存期间账号或画板已变化，请重试')
  await writeInkCheckpoint(artifact.owner, artifact.problemId, record)
  return record
}

export async function restoreHandwritingCheckpoint(owner, problemId, stillWanted) {
  const before = draftSourceReference(problemId)
  const raw = await readInkCheckpoint(owner, problemId)
  if (!raw) throw new Error('本题没有主动保存的手写备份')
  const record = await normalizeInkCheckpoint(raw, owner, problemId)
  const canvas = await readDraft(owner, problemId)
  if (!canvas || canvas.sourceVersion !== record.sourceVersion || await inkHash(draftSceneSignature(canvas)) !== record.sourceHash) {
    throw new Error('画板来源已变化，旧备份不能作为当前草稿恢复；请重新提交选区')
  }
  if (authOwner.value !== owner || !stillWanted() || draftSourceReference(problemId).ownerEpoch !== before.ownerEpoch) throw new Error('恢复已取消，账号或题目已变化')
  let source = draftSourceReference(problemId)
  if (!source.sceneSignature) {
    publishDraftScene(problemId, canvas, owner)
    source = draftSourceReference(problemId)
  }
  if (await inkHash(source.sceneSignature) !== record.sourceHash
    || (record.sourceSessionId === draftSessionId && record.sourceRevision !== source.sourceRevision)) {
    throw new Error('当前画板已修改，旧备份不能恢复；请重新提交选区')
  }
  if (!stillWanted()) throw new Error('恢复已取消')
  const artifact = installRestoredHandwriting({ ...record.snapshot, restoredReview: { text: record.text, recognition: record.recognition } }, source)
  return { record, artifact }
}
