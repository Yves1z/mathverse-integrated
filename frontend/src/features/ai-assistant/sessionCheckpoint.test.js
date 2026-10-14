import assert from 'node:assert/strict'
import test from 'node:test'
import { readHintCheckpoint, writeHintCheckpoint } from './sessionCheckpoint.js'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

test('hint reveal state survives reload but never includes API credentials', () => {
  const storage = memoryStorage()
  const states = new Map([['["question","P1",""]', {
    level: 2,
    shownCount: 3,
    revealed: ['观察对称性'],
    apiKey: 'must-not-persist',
  }]])
  assert.equal(writeHintCheckpoint(storage, 'user:1', states), true)
  assert.equal(readHintCheckpoint(storage, 'user:1').get('["question","P1",""]').level, 2)
  assert.deepEqual(readHintCheckpoint(storage, 'user:2'), new Map())
  assert.doesNotMatch(storage.getItem('mathverse:agent:hint-checkpoint:v1'), /must-not-persist/)
})

test('corrupt checkpoint cannot lower or invent a valid reveal state', () => {
  const storage = memoryStorage()
  storage.setItem('mathverse:agent:hint-checkpoint:v1', JSON.stringify({
    owner: 'anon', scopes: [['scope', { level: 99, shownCount: 1 }]],
  }))
  assert.equal(readHintCheckpoint(storage, 'anon').size, 0)
})
