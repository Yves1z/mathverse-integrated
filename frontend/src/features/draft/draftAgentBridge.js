import { reactive, shallowRef, watch } from 'vue'
import { authOwner } from '../../services/authIdentity.js'
import { prepareSimilarityImage } from '../similar-problems/imageInput.js'
import { draftSceneSignature } from './inkSelection.js'

export const handwritingRequest = shallowRef(null)
export const draftSessionId = crypto.randomUUID()
const sceneSignatures = reactive(new Map())
const sceneRevisions = reactive(new Map())
const paperSources = reactive(new Map())
let activeOwner = authOwner.value
let ownerEpoch = 0
watch(authOwner, (owner) => {
  activeOwner = owner
  ownerEpoch += 1
  sceneSignatures.clear()
  sceneRevisions.clear()
  paperSources.clear()
  clearHandwritingRequest()
}, { flush: 'sync' })

export function publishDraftScene(problemId, scene, owner = activeOwner) {
  if (owner !== activeOwner) return
  const id = String(problemId)
  const signature = draftSceneSignature(scene)
  if (sceneSignatures.get(id) !== signature) sceneRevisions.set(id, (sceneRevisions.get(id) || 0) + 1)
  sceneSignatures.set(id, signature)
}

export function currentDraftRevision(problemId) { return sceneRevisions.get(String(problemId)) || 0 }
export function draftSourceReference(problemId) {
  return { problemId: String(problemId), owner: activeOwner, ownerEpoch,
    sourceRevision: currentDraftRevision(problemId), sceneSignature: sceneSignatures.get(String(problemId)) }
}

export function isHandwritingCurrent(artifact) {
  if (artifact?.sourceKind === 'paper_image') {
    const current = paperSources.get(artifact.problemId)
    return Boolean(current && artifact.owner === activeOwner && artifact.ownerEpoch === ownerEpoch
      && artifact.sceneSignature === current.sceneSignature && artifact.sourceRevision === current.sourceRevision)
  }
  return Boolean(artifact && sceneSignatures.get(artifact.problemId) === artifact.sceneSignature
    && artifact.owner === activeOwner && artifact.ownerEpoch === ownerEpoch
    && sceneRevisions.get(artifact.problemId) === artifact.sourceRevision)
}

export function revisePaperSource(problemId, invalidate = true) {
  const id = String(problemId)
  if (!activeOwner) throw new Error('请等待账号身份确认后选择照片')
  const previous = paperSources.get(id)
  if (!invalidate && previous) return { ...previous }
  const source = Object.freeze({ problemId: id, owner: activeOwner, ownerEpoch, sourceKind: 'paper_image',
    sourceRevision: (previous?.sourceRevision || 0) + 1, sceneSignature: crypto.randomUUID() })
  paperSources.set(id, source)
  return source
}

export function paperSourceReference(problemId) {
  return { problemId: String(problemId), owner: activeOwner, ownerEpoch,
    sourceRevision: 0, sceneSignature: undefined, ...paperSources.get(String(problemId)) }
}

export function installRestoredPaper(snapshot, expected) {
  const current = paperSourceReference(snapshot.problemId)
  if (snapshot.owner !== current.owner || expected.ownerEpoch !== current.ownerEpoch
    || expected.sourceRevision !== current.sourceRevision || expected.sceneSignature !== current.sceneSignature) {
    throw new Error('恢复期间账号或照片选区已变化，请重试')
  }
  // Explicit recovery is a new source revision. It never revives an old token.
  const source = revisePaperSource(snapshot.problemId)
  return installPaperImage(Object.freeze({ ...snapshot, ...source, sourceSessionId: draftSessionId,
    restored: true, restorationId: crypto.randomUUID() }))
}

export function installPaperImage(artifact) {
  if (artifact.sourceKind !== 'paper_image' || !isHandwritingCurrent(artifact)) {
    throw new Error('裁剪期间账号或选区已变化，请重新提交')
  }
  handwritingRequest.value = artifact
  return artifact
}

export function clearHandwritingRequest() {
  handwritingRequest.value = null
}

export async function requestHandwritingReview(problemId, capture) {
  const owner = activeOwner
  const epoch = ownerEpoch
  if (!owner || capture.owner !== owner || capture.ownerEpoch !== epoch) throw new Error('账号已变化或未确认，请重新打开画板')
  const id = String(problemId || '')
  const image = await prepareSimilarityImage(capture.blob)
  const digest = await crypto.subtle.digest('SHA-256', await capture.blob.arrayBuffer())
  const contentHash = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join('')
  const artifact = Object.freeze({
    id: crypto.randomUUID(), problemId: id, owner, ownerEpoch: epoch, sourceSessionId: draftSessionId,
    sceneSignature: capture.sceneSignature, sourceRevision: capture.sourceRevision,
    contentHash, rawScene: JSON.stringify(capture.scene), originalBlob: capture.blob,
    dataUrl: image.dataUrl, width: image.width, height: image.height,
  })
  if (!isHandwritingCurrent(artifact)) throw new Error('导出期间画板已变化，请重新选择并提交')
  handwritingRequest.value = artifact
  return artifact
}

export function installRestoredHandwriting(snapshot, source) {
  const current = draftSourceReference(snapshot.problemId)
  if (current.owner !== snapshot.owner || current.ownerEpoch !== source.ownerEpoch
    || current.sourceRevision !== source.sourceRevision || current.sceneSignature !== source.sceneSignature) {
    throw new Error('恢复期间账号或画板已变化，请重试')
  }
  const artifact = Object.freeze({ ...snapshot, ...current, sourceSessionId: draftSessionId,
    restored: true, restorationId: crypto.randomUUID() })
  handwritingRequest.value = artifact
  return artifact
}
