import { Buffer } from 'node:buffer'
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildInkCheckpoint, normalizeInkCheckpoint, inkHash } from './handwritingCheckpoint.js'
import { commitTypedAttempt, restoreHandwritingAttempt } from './typedAttempt.js'
import { confirmHandwriting } from './handwritingRecognition.js'
import { buildAgentContext } from './contextEngine.js'

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/r9sAAAAASUVORK5CYII='
async function fixture() {
  const originalBlob = new Blob([Buffer.from(png, 'base64')], { type: 'image/png' })
  const artifact = { id: 'saved-ink', owner: 'user:A', ownerEpoch: 3, problemId: 'P1', sourceRevision: 2,
    sourceSessionId: 'session-before-refresh', sceneSignature: 'full-scene-including-unselected-secret',
    rawScene: JSON.stringify({ elements: [{ id: 'stroke', points: [[0, 0], [1, 1]], pressures: [.2, .8] }], files: {}, appState: {} }),
    originalBlob, contentHash: await inkHash(originalBlob), dataUrl: `data:image/png;base64,${png}`, width: 1, height: 1 }
  const recognition = { blocks: [{ id: 'block1', text: '2+2=6', alternatives: ['2+2=5'], confidence: .4, uncertainty: '末尾数字' }], text: '2+2=6',
    provider: { endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-vl-plus', key: 'secret-key' } }
  const confirmed = confirmHandwriting(artifact, recognition, '2+2=5', true)
  const attempt = commitTypedAttempt({ problemId: 'P1', rawText: confirmed.text, handwriting: confirmed })
  const record = await buildInkCheckpoint({ artifact, text: '2+2=5', editorText: '2+2=7', recognition, attempt, canvas: { sourceVersion: 'durable-version' }, key: 'secret-key' })
  return { artifact, recognition, attempt, record }
}

test('checkpoint preserves selected native ink, original PNG, corrected reading and unsent editor independently', async () => {
  const { artifact, record, attempt } = await fixture()
  assert.equal(record.text, '2+2=5')
  assert.equal(record.editorText, '2+2=7')
  assert.equal(record.submitted.rawText, attempt.rawText)
  assert.equal(record.submitted.version, 1)
  assert.equal(record.snapshot.rawScene, artifact.rawScene)
  assert.equal(await inkHash(record.snapshot.originalBlob), artifact.contentHash)
  assert.deepEqual(record.recognition.blocks[0].alternatives, ['2+2=5'])
  assert.equal(record.submitted.recognitionStatus, 'user_edited_transcription')
  assert.doesNotMatch(JSON.stringify(record), /secret-key|unselected-secret|ownerEpoch|sceneSignature|mathEvidence/)
})

test('refresh rebuilds source-bound submitted attempt identity and version, not prior mathematical feedback', async () => {
  const { record } = await fixture()
  const artifact = { ...record.snapshot, ownerEpoch: 10, sourceRevision: 1, sceneSignature: 'restored-current' }
  const confirmed = { artifact, recognition: record.submitted.recognition, text: record.submitted.rawText, confirmedAt: new Date().toISOString() }
  const restored = restoreHandwritingAttempt({ ...record.submitted, toolResults: ['forged'], steps: ['forged'] }, confirmed)
  assert.equal(restored.id, record.submitted.id)
  assert.equal(restored.version, 1)
  assert.equal(restored.recognition.ownerEpoch, 10)
  assert.equal(restored.rawArtifacts[1].originalBlob, record.snapshot.originalBlob)
  assert.equal(restored.toolResults, undefined)
  assert.equal(restored.steps[0].rawContent, '2+2=5')
  assert.equal(commitTypedAttempt({ previous: restored, problemId: 'P1', rawText: restored.rawText, handwriting: confirmed }).version, 1)
  assert.equal(commitTypedAttempt({ previous: restored, problemId: 'P1', rawText: '2+2=7', handwriting: confirmed }).version, 2)
  assert.doesNotThrow(() => buildAgentContext({ intent: 'diagnose', page: { type: 'problem', id: 'P1', text: '核对运算' }, attempt: restored }))
})

test('owner, problem, image bytes, native source and preview tampering reject restoration', async () => {
  const { record } = await fixture()
  await assert.rejects(normalizeInkCheckpoint(record, 'user:B', 'P1'))
  await assert.rejects(normalizeInkCheckpoint(record, 'user:A', 'P2'))
  for (const snapshot of [
    { ...record.snapshot, originalBlob: new Blob(['tampered'], { type: 'image/png' }) },
    { ...record.snapshot, rawScene: JSON.stringify({ elements: [{ id: 'changed' }] }) },
    { ...record.snapshot, dataUrl: record.snapshot.dataUrl + 'AAAA' },
    { ...record.snapshot, dataUrl: 'https://private.example/image' },
  ]) await assert.rejects(normalizeInkCheckpoint({ ...record, snapshot }, 'user:A', 'P1'))
})

test('bounds, invalid identities and submitted versions reject; unconfirmed unreadable text can be backed up', async () => {
  const { record } = await fixture()
  await assert.rejects(normalizeInkCheckpoint({ ...record, text: 'x'.repeat(6001) }, 'user:A', 'P1'))
  await assert.rejects(normalizeInkCheckpoint({ ...record, sourceRevision: 0 }, 'user:A', 'P1'))
  await assert.rejects(normalizeInkCheckpoint({ ...record, submitted: { ...record.submitted, version: 0 } }, 'user:A', 'P1'))
  const unreadable = await normalizeInkCheckpoint({ ...record, text: '[无法辨认]', submitted: null }, 'user:A', 'P1')
  assert.equal(unreadable.text, '[无法辨认]')
  assert.equal(unreadable.submitted, null)
})

test('credential-bearing recognition receipts fail while extraneous feedback is excluded', async () => {
  const { record } = await fixture()
  await assert.rejects(normalizeInkCheckpoint({ ...record, recognition: { ...record.recognition,
    provider: { ...record.recognition.provider, endpoint: 'https://api.example/test?api_key=private' } } }, 'user:A', 'P1'))
  const safe = await normalizeInkCheckpoint({ ...record, key: 'private', consent: true, toolResults: ['forged'], responseCache: ['hidden'], mathFeedback: 'wrong' }, 'user:A', 'P1')
  assert.doesNotMatch(JSON.stringify(safe), /private|consent|toolResults|responseCache|mathFeedback/)
})
