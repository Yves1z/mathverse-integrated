const STORAGE_KEY = 'mathverse:agent:hint-checkpoint:v1'
const MAX_SCOPES = 40

function validHintState(value) {
  if (!value || typeof value !== 'object') return null
  const level = Number(value.level)
  const shownCount = Number(value.shownCount)
  if (!Number.isInteger(level) || level < -1 || level > 5) return null
  if (!Number.isInteger(shownCount) || shownCount < 0 || shownCount > 1000) return null
  return {
    level,
    shownCount,
    solutionRevealed: Boolean(value.solutionRevealed) || level === 5,
    revealed: Array.isArray(value.revealed)
      ? value.revealed.filter((text) => typeof text === 'string').slice(-5).map((text) => text.slice(0, 500))
      : [],
  }
}

export function readHintCheckpoint(storage, owner) {
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY) || 'null')
    if (!value || value.owner !== owner || !Array.isArray(value.scopes)) return new Map()
    const states = new Map()
    for (const [scope, state] of value.scopes.slice(-MAX_SCOPES)) {
      if (typeof scope !== 'string' || scope.length > 500) continue
      const valid = validHintState(state)
      if (valid) states.set(scope, valid)
    }
    return states
  } catch {
    return new Map()
  }
}

export function writeHintCheckpoint(storage, owner, states) {
  if (!owner) return false
  const scopes = [...states.entries()]
    .filter(([scope]) => typeof scope === 'string' && scope.length <= 500)
    .slice(-MAX_SCOPES)
    .map(([scope, state]) => [scope, validHintState(state)])
    .filter(([, state]) => state)
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ owner, scopes }))
    return true
  } catch {
    return false
  }
}
