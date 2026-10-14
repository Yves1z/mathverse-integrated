import assert from 'node:assert/strict'
import test from 'node:test'
import { readAttemptCheckpoint, writeAttemptCheckpoint } from './attemptCheckpoint.js'
import { commitTypedAttempt } from './typedAttempt.js'

const key = 'mathverse:agent:attempt-checkpoint:v1'
function memoryStorage() {
  const values = new Map()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
}

test('reload restores exact unsent edits and source-bound submitted identity independently', () => {
  const storage = memoryStorage()
  const rawText = '  设 x=2\r\n\r\nx+1=4  '
  const attempt = commitTypedAttempt({ problemId: 'P1', rawText })
  const draft = rawText.replace('=4', '=3')
  attempt.apiKey = 'private-key'
  attempt.verification = 'must-not-revive'
  assert.equal(writeAttemptCheckpoint(storage, 'user:1', new Map([['P1', draft]]), new Map([['P1', attempt]])), true)
  const restored = readAttemptCheckpoint(storage, 'user:1')
  assert.equal(restored.drafts.get('P1'), draft)
  const submitted = restored.attempts.get('P1')
  assert.equal(submitted.id, attempt.id)
  assert.equal(submitted.version, 1)
  assert.deepEqual(submitted.steps, attempt.steps)
  assert.equal(submitted.rawArtifacts[0].content, rawText)
  assert.equal(commitTypedAttempt({ previous: submitted, problemId: 'P1', rawText }).version, 1)
  assert.equal(commitTypedAttempt({ previous: submitted, problemId: 'P1', rawText: draft }).version, 2)
  assert.doesNotMatch(storage.getItem(key), /private-key|must-not-revive/)
})

test('owner and problem isolation, explicit deletion and bounded checkpoint', () => {
  const storage = memoryStorage()
  const drafts = new Map(Array.from({ length: 45 }, (_, index) => [`P${index}`, `草稿${index}`]))
  assert.equal(writeAttemptCheckpoint(storage, 'anon', drafts, new Map()), true)
  assert.equal(readAttemptCheckpoint(storage, 'user:2').drafts.size, 0)
  const saved = readAttemptCheckpoint(storage, 'anon')
  assert.equal(saved.drafts.size, 40)
  assert.equal(saved.drafts.has('P0'), false)
  assert.equal(saved.drafts.get('P44'), '草稿44')
  saved.drafts.delete('P44')
  writeAttemptCheckpoint(storage, 'anon', saved.drafts, saved.attempts)
  assert.equal(readAttemptCheckpoint(storage, 'anon').drafts.has('P44'), false)
})

test('corrupt schema, source identity, versions and storage denial recover without throwing', () => {
  const storage = memoryStorage()
  const attempt = commitTypedAttempt({ problemId: 'P1', rawText: '2+2=5' })
  for (const patch of [{ version: 0 }, { version: '1' }, { problemId: 'P2' }, { rawText: '' }, { createdAt: 'bad' }]) {
    storage.setItem(key, JSON.stringify({ schemaVersion: 1, owner: 'anon', problems: [
      ['P1', { draftText: '未提交', attempt: { ...attempt, ...patch } }],
    ] }))
    assert.equal(readAttemptCheckpoint(storage, 'anon').status, 'unavailable')
    assert.equal(readAttemptCheckpoint(storage, 'anon').attempts.size, 0)
  }
  storage.setItem(key, '{broken')
  assert.equal(readAttemptCheckpoint(storage, 'anon').status, 'unavailable')
  const denied = { getItem() { throw new Error('denied') }, setItem() { throw new Error('quota') } }
  assert.equal(readAttemptCheckpoint(denied, 'anon').status, 'unavailable')
  assert.equal(writeAttemptCheckpoint(denied, 'anon', new Map(), new Map()), false)
  assert.equal(writeAttemptCheckpoint(storage, null, new Map(), new Map()), false)
})

test('restoration derives steps afresh and never loads forged tool results or AI authorship', () => {
  const storage = memoryStorage()
  const attempt = commitTypedAttempt({ problemId: 'P1', rawText: '2+2=5' })
  storage.setItem(key, JSON.stringify({ schemaVersion: 1, owner: 'anon', problems: [
    ['P1', { draftText: '2+2=5', attempt: { ...attempt, steps: [{ rawContent: '2+2=4' }], verification: 'correct' } }],
  ] }))
  const restored = readAttemptCheckpoint(storage, 'anon').attempts.get('P1')
  assert.equal(restored.steps[0].rawContent, '2+2=5')
  assert.equal(restored.verification, undefined)
  attempt.steps[0].author = 'accepted_ai_suggestion'
  assert.equal(writeAttemptCheckpoint(storage, 'anon', new Map([['P1', '2+2=5']]), new Map([['P1', attempt]])), false)
})
