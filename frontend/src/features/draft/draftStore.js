import { draftSceneSignature } from './inkSelection.js'
const DB_NAME = 'mathverse-draft'
const STORE = 'scenes'
const FORMAT = 'excalidraw-0.18'
const queues = new Map()

export function draftRecordKey(owner, problemId) {
  if (typeof owner !== 'string' || !/^(?:anon|user:.+)$/.test(owner) || owner.length > 120
    || problemId == null || !String(problemId).trim() || String(problemId).length > 120) {
    throw new Error('无法确认草稿所属账号或题目')
  }
  return `scoped:${JSON.stringify([owner, String(problemId)])}`
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.window?.indexedDB) return reject(new Error('本机存储不可用'))
    const request = window.indexedDB.open(DB_NAME, 1)
    let blocked = false
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
    }
    request.onsuccess = () => { if (blocked) request.result.close(); else resolve(request.result) }
    request.onerror = () => reject(request.error)
    request.onblocked = () => { blocked = true; reject(new Error('本机存储被其他页面占用')) }
  })
}

// Serialize same-page operations, including deletion after a pending save.
function transact(key, mode, operation) {
  const previous = queues.get(key) || Promise.resolve()
  const pending = previous.catch(() => {}).then(async () => {
    const db = await openDatabase()
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        let value
        tx.oncomplete = () => resolve(value)
        tx.onabort = () => reject(tx.error || new Error('草稿保存事务已中止'))
        tx.onerror = () => reject(tx.error || new Error('草稿存储失败'))
        const request = operation(tx.objectStore(STORE), key, tx)
        request.onsuccess = () => { value = request.result ?? null }
      })
    } finally { db.close() }
  })
  queues.set(key, pending)
  const cleanup = () => { if (queues.get(key) === pending) queues.delete(key) }
  pending.then(cleanup, cleanup)
  return pending
}

function validate(record, owner, problemId, legacy = false) {
  if (record == null) return null
  if (record.format !== FORMAT || record.version !== (legacy ? 1 : 2)
    || (!legacy && (record.owner !== owner || record.problemId !== String(problemId)))
    || !Array.isArray(record.elements) || !record.appState || typeof record.appState !== 'object'
    || Array.isArray(record.appState) || !record.files || typeof record.files !== 'object' || Array.isArray(record.files)) {
    throw new Error('保存的画板格式或来源无效，请导出备份后重试')
  }
  const { collaborators: _collaborators, activeTool: _activeTool, ...appState } = record.appState
  return { ...record, appState }
}

export async function readDraft(owner, problemId) {
  const record = await transact(draftRecordKey(owner, problemId), 'readonly', (store, key) => store.get(key))
  return validate(record, owner, problemId)
}

export async function readLegacyDraft(problemId) {
  draftRecordKey('anon', problemId)
  const record = await transact(`question-${problemId}`, 'readonly', (store, key) => store.get(key))
  return validate(record, null, problemId, true)
}

export function writeDraft(owner, problemId, scene) {
  const key = draftRecordKey(owner, problemId)
  const elements = scene.elements || []
  const referenced = new Set(elements.filter((e) => !e.isDeleted).map((e) => e.fileId).filter(Boolean))
  const files = Object.fromEntries(Object.entries(scene.files || {}).filter(([id]) => referenced.has(id)))
  const record = JSON.parse(JSON.stringify({ format: FORMAT, version: 2, owner, problemId: String(problemId),
    savedAt: new Date().toISOString(), elements, appState: scene.appState || {}, files }))
  validate(record, owner, problemId)
  return transact(key, 'readwrite', (store, recordKey, transaction) => {
    const request = store.get(recordKey)
    request.addEventListener('success', () => {
      try {
        const previous = request.result
        record.sourceVersion = previous?.sourceVersion && draftSceneSignature(previous) === draftSceneSignature(record)
          ? previous.sourceVersion : crypto.randomUUID()
        store.put(record, recordKey)
      } catch { transaction.abort() }
    })
    return request
  }).then(() => undefined)
}

export function deleteDraft(owner, problemId) {
  return transact(draftRecordKey(owner, problemId), 'readwrite', (store, key) => store.delete(key))
}

export function readInkCheckpoint(owner, problemId) {
  return transact(`ink-checkpoint:${draftRecordKey(owner, problemId)}`, 'readonly', (store, key) => store.get(key))
}
export function writeInkCheckpoint(owner, problemId, record) {
  return transact(`ink-checkpoint:${draftRecordKey(owner, problemId)}`, 'readwrite', (store, key) => store.put(record, key))
}
export function deleteInkCheckpoint(owner, problemId) {
  return transact(`ink-checkpoint:${draftRecordKey(owner, problemId)}`, 'readwrite', (store, key) => store.delete(key))
}

export function readPaperCheckpoint(owner, problemId) {
  return transact(`paper-checkpoint:${draftRecordKey(owner, problemId)}`, 'readonly', (store, key) => store.get(key))
}
export function writePaperCheckpoint(owner, problemId, record) {
  return transact(`paper-checkpoint:${draftRecordKey(owner, problemId)}`, 'readwrite', (store, key) => store.put(record, key))
}
export function deletePaperCheckpoint(owner, problemId) {
  return transact(`paper-checkpoint:${draftRecordKey(owner, problemId)}`, 'readwrite', (store, key) => store.delete(key))
}
