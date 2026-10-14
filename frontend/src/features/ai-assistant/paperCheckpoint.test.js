import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPaperCheckpoint, normalizePaperCheckpoint } from './paperCheckpoint.js'
import { inkHash } from './handwritingCheckpoint.js'
import { commitTypedAttempt, restoreHandwritingAttempt } from './typedAttempt.js'
import { revisePaperSource, installRestoredPaper, isHandwritingCurrent, paperSourceReference } from '../draft/draftAgentBridge.js'
import { beginIdentityCheck, finishIdentityCheck } from '../../services/authIdentity.js'
import { restorePhotoCheckpoint } from './paperPersistence.js'

async function fixture() {
  // Structural/hash fixture; actual raster decoding is covered by the browser journey.
  const originalBlob = new Blob(['synthetic original'], { type: 'image/png' })
  const croppedBlob = new Blob(['synthetic crop'], { type: 'image/png' })
  const artifact = { id: 'paper-source', problemId: 'P-paper', owner: 'user:paper-A', sourceKind: 'paper_image',
    sceneSignature: 'source-version', sourceRevision: 2, originalBlob, croppedBlob,
    crop: Object.freeze({ x: 10, y: 20, width: 50, height: 40, originalWidth: 100, originalHeight: 80 }),
    originalHash: await inkHash(originalBlob), contentHash: await inkHash(croppedBlob),
    dataUrl: 'data:image/png;base64,YQ==', width: 50, height: 40 }
  const recognition = { blocks: [{ text: '[无法辨认]', confidence: .4, uncertainty: '末尾数字', alternatives: ['2+2=5','2+2=6'] }],
    text: '[无法辨认]', provider: { endpoint: 'https://example.test/v1/chat/completions', model: 'vision-fixture' } }
  const confirmed = { artifact, recognition, text: '2+2=5', confirmedAt: new Date().toISOString() }
  const attempt = commitTypedAttempt({ problemId: artifact.problemId, rawText: confirmed.text, handwriting: confirmed })
  return { artifact, recognition, attempt, text: confirmed.text, editorText: '2+2=7' }
}

test('rotated backups bind direction and swapped dimensions while legacy zero-direction backups remain readable', async () => {
  const input = await fixture()
  input.artifact = { ...input.artifact, rotation:90, width:40, height:50 }
  const record = await buildPaperCheckpoint(input)
  assert.equal(record.version,2)
  assert.equal(record.snapshot.rotation,90)
  for (const patch of [{rotation:270},{rotation:45},{rotation:null},{rotation:undefined},{rotationHash:'a'.repeat(64)}, {width:50,height:40}]) {
    await assert.rejects(normalizePaperCheckpoint({...record,snapshot:{...record.snapshot,...patch}},record.owner,record.problemId))
  }
  const zero = await buildPaperCheckpoint(await fixture())
  const legacy = { ...zero, version:1, snapshot:{...zero.snapshot} }
  delete legacy.snapshot.rotation; delete legacy.snapshot.rotationHash
  assert.equal((await normalizePaperCheckpoint(legacy,legacy.owner,legacy.problemId)).snapshot.rotation,0)
  await assert.rejects(normalizePaperCheckpoint({...record,version:1},record.owner,record.problemId))
  const restored = restoreHandwritingAttempt(record.submitted, {artifact:record.snapshot, recognition:record.submitted.recognition,
    text:record.submitted.rawText,confirmedAt:record.submitted.confirmedAt})
  assert.equal(restored.rawArtifacts[1].rotation,90)
})

test('photo checkpoint preserves original/crop provenance and unsent text, with an explicit secret-free allowlist', async () => {
  const input = await fixture()
  const record = await buildPaperCheckpoint({ ...input, consent: true, key: 'secret-key', feedback: 'old-math-result' })
  assert.equal(record.snapshot.originalBlob, input.artifact.originalBlob)
  assert.equal(record.snapshot.croppedBlob, input.artifact.croppedBlob)
  assert.deepEqual(record.snapshot.crop, input.artifact.crop)
  assert.equal(record.text, '2+2=5'); assert.equal(record.editorText, '2+2=7')
  assert.equal(record.submitted.version, 1)
  assert.equal(record.submitted.recognitionStatus, 'user_edited_transcription')
  const normalized = await normalizePaperCheckpoint({ ...record, key:'secret-key', consent:true, feedback:'old-math-result',
    snapshot:{...record.snapshot, ownerEpoch:999, toolResults:['forged']} }, record.owner, record.problemId)
  assert.doesNotMatch(JSON.stringify(normalized), /secret-key|old-math-result|forged|ownerEpoch|consent/)
})

test('photo restoration reconstructs exact submitted steps and keeps same/new text version continuity', async () => {
  const input = await fixture(), record = await buildPaperCheckpoint(input)
  const confirmed = { artifact: record.snapshot, recognition: record.submitted.recognition,
    text: record.submitted.rawText, confirmedAt: record.submitted.confirmedAt }
  const restored = restoreHandwritingAttempt(record.submitted, confirmed)
  assert.equal(restored.id, input.attempt.id); assert.equal(restored.version, 1)
  assert.equal(restored.rawArtifacts[1].type, 'image_crop')
  assert.equal(restored.steps[0].rawContent, '2+2=5')
  assert.equal(commitTypedAttempt({ previous:restored,problemId:restored.problemId,rawText:'2+2=5',handwriting:confirmed }), restored)
  assert.equal(commitTypedAttempt({ previous:restored,problemId:restored.problemId,rawText:'2+2=7',handwriting:confirmed }).version, 2)
})

test('wrong owner/problem and changed original, crop, preview or coordinates fail before display', async () => {
  const input = await fixture(), record = await buildPaperCheckpoint(input)
  await assert.rejects(normalizePaperCheckpoint(record,'user:paper-B',record.problemId))
  await assert.rejects(normalizePaperCheckpoint(record,record.owner,'P-other'))
  for (const patch of [ {originalBlob:new Blob(['changed'],{type:'image/png'})},
    {croppedBlob:new Blob(['changed'],{type:'image/png'})}, {dataUrl:'https://external.test/image.png'},
    {dataUrl:'data:image/png;base64,Yg=='}, {crop:{...record.snapshot.crop,x:11}},
    {crop:{...record.snapshot.crop,width:101}}, {width:51}, {sourceKind:'ink'} ]) {
    await assert.rejects(normalizePaperCheckpoint({...record,snapshot:{...record.snapshot,...patch}},record.owner,record.problemId))
  }
})

test('unconfirmed unreadable photo is recoverable without submission; bounded text and provider receipts are enforced', async () => {
  const input = await fixture()
  const record = await buildPaperCheckpoint({ ...input, attempt:null, text:'[无法辨认]',editorText:'[无法辨认]' })
  assert.equal(record.submitted,null)
  assert.equal(record.recognition.blocks[0].confidence,.4)
  for (const patch of [{text:'a'.repeat(6001)},{editorText:'a'.repeat(6001)},{sourceRevision:0},
    {submitted:{...input.attempt,recognitionStatus:'verified',confirmedAt:new Date().toISOString()}},
    {recognition:{...input.recognition,provider:{endpoint:'https://user:secret@example.test/',model:'vision'}}}]) {
    await assert.rejects(normalizePaperCheckpoint({...record,...patch},record.owner,record.problemId))
  }
})

test('explicit photo recovery creates a fresh source token and rejects an intervening crop edit or account transition', async () => {
  const input = await fixture()
  finishIdentityCheck(beginIdentityCheck(), {authenticated:true,user:{id:'paper-A'}})
  const before = revisePaperSource(input.artifact.problemId)
  const artifact = installRestoredPaper(input.artifact,before)
  assert.equal(isHandwritingCurrent(artifact),true)
  assert.notEqual(artifact.sceneSignature,before.sceneSignature)
  assert.equal(isHandwritingCurrent(before),false)
  const expected = paperSourceReference(input.artifact.problemId)
  revisePaperSource(input.artifact.problemId)
  assert.throws(()=>installRestoredPaper(input.artifact,expected), /已变化/)
  finishIdentityCheck(beginIdentityCheck(),{authenticated:true,user:{id:'paper-B'}})
  assert.throws(()=>installRestoredPaper(input.artifact,expected), /已变化/)
  await assert.rejects(restorePhotoCheckpoint('user:paper-A',input.artifact.problemId,()=>true), /恢复已取消/,
    'wrong identity is rejected before even reading local storage')
})
