import { restoreTypedAttempt } from './typedAttempt.js'

const STORAGE_KEY = 'mathverse:agent:attempt-checkpoint:v1'
const MAX_PROBLEMS = 40
const MAX_SERIALIZED_LENGTH = 1_000_000

function validateEntry(problemId, entry) {
  if (typeof problemId !== 'string' || !problemId.trim() || problemId.length > 120
    || !entry || typeof entry.draftText !== 'string' || entry.draftText.length > 6000) {
    throw new Error('保存的草稿无效')
  }
  const attempt = entry.attempt == null ? null : restoreTypedAttempt(entry.attempt, problemId)
  return { draftText: entry.draftText, attempt }
}

export function readAttemptCheckpoint(storage, owner) {
  const result = { drafts: new Map(), attempts: new Map(), status: 'empty' }
  if (!owner) return result
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return result
    if (raw.length > MAX_SERIALIZED_LENGTH) throw new Error('checkpoint too large')
    const value = JSON.parse(raw)
    if (value?.owner !== owner) return result
    if (value.schemaVersion !== 1 || !Array.isArray(value.problems)
      || value.problems.length > MAX_PROBLEMS) throw new Error('invalid checkpoint')
    for (const row of value.problems) {
      if (!Array.isArray(row) || row.length !== 2) throw new Error('invalid entry')
      const [id, entry] = row
      const valid = validateEntry(id, entry)
      if (result.drafts.has(id)) throw new Error('duplicate problem')
      result.drafts.set(id, valid.draftText)
      if (valid.attempt) result.attempts.set(id, valid.attempt)
    }
    result.status = 'restored'
    return result
  } catch {
    return { drafts: new Map(), attempts: new Map(), status: 'unavailable' }
  }
}

export function writeAttemptCheckpoint(storage, owner, drafts, attempts) {
  if (!owner) return false
  try {
    const ids = [...attempts.keys()].filter((id) => !drafts.has(id))
      .concat([...drafts.keys()]).slice(-MAX_PROBLEMS)
    // Image provenance is memory-only in this slice; do not restore its text as a typed-only attempt.
    const problems = ids.filter((id) => !attempts.get(id)?.recognition).map((id) => {
      const attempt = attempts.get(id)
      // This checkpoint slice supports user-authored typed steps only.
      if (attempt?.steps.some((step) => step.author !== 'user')) throw new Error('unsupported authorship')
      const valid = validateEntry(id, { draftText: drafts.get(id) ?? attempt?.rawText ?? '', attempt })
      const storedAttempt = valid.attempt ? {
        id: valid.attempt.id, problemId: id, version: valid.attempt.version,
        rawText: valid.attempt.rawText, createdAt: valid.attempt.createdAt, updatedAt: valid.attempt.updatedAt,
      } : null
      return [id, { draftText: valid.draftText, attempt: storedAttempt }]
    })
    const raw = JSON.stringify({ schemaVersion: 1, owner, problems })
    if (raw.length > MAX_SERIALIZED_LENGTH) return false
    storage.setItem(STORAGE_KEY, raw)
    return true
  } catch {
    return false
  }
}
