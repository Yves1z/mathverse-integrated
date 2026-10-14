import assert from 'node:assert/strict'
import test from 'node:test'
import { selectInkScene, draftSceneSignature } from '../draft/inkSelection.js'
import { confirmHandwriting, parseHandwritingRecognition } from './handwritingRecognition.js'
import { handwritingCapability, handwritingMessages } from './handwritingProvider.js'
import { commitTypedAttempt } from './typedAttempt.js'
import { readAttemptCheckpoint, writeAttemptCheckpoint } from './attemptCheckpoint.js'
import { buildAgentContext } from './contextEngine.js'
import { renderAttemptDiagnosisPrompt } from './contextPrompt.js'
import { draftSourceReference, isHandwritingCurrent, publishDraftScene } from '../draft/draftAgentBridge.js'

const config = { endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-vl-plus' }
const artifact = { id: 'ink1', problemId: 'P1', owner: 'user:A', ownerEpoch: 42, dataUrl: 'data:image/png;base64,YQ==',
  rawScene: '{"elements":[{"id":"stroke1","points":[[0,0],[10,10]]}]}', contentHash: 'hash', sceneSignature: 'v1', sourceRevision: 1 }
const response = { blocks: [{ text: '2+2=5', alternatives: ['2+2=6'], confidence: .6, uncertainty: '末尾数字' }] }

test('selection captures only explicitly selected live elements and referenced files, preserving native ink', () => {
  const scene = { elements: [
    { id: 'a', type: 'freedraw', version: 1, points: [[0, 0], [1, 1]], pressures: [.3, .8] },
    { id: 'b', type: 'image', fileId: 'private', version: 1 },
    { id: 'c', type: 'image', fileId: 'selected', version: 1 },
    { id: 'd', isDeleted: true },
  ], appState: { selectedElementIds: { a: true, c: true, d: true }, scrollX: 55 },
  files: { private: { dataURL: 'private-page' }, selected: { dataURL: 'selected-image' } } }
  const selected = selectInkScene(scene)
  assert.deepEqual(selected.elements.map((e) => e.id), ['a', 'c'])
  assert.deepEqual(selected.elements[0].pressures, [.3, .8])
  assert.equal(selected.files.private, undefined)
  selected.elements[0].points[0][0] = 999
  assert.equal(scene.elements[0].points[0][0], 0)
  assert.throws(() => selectInkScene({ ...scene, appState: {} }), /框选/)
})

test('scene revisions invalidate captures while viewport and selection changes do not', () => {
  const scene = { elements: [{ id: 'a', version: 1, versionNonce: 2 }], files: {}, appState: {} }
  const signature = draftSceneSignature(scene)
  assert.equal(signature, draftSceneSignature({ ...scene, appState: { selectedElementIds: { a: true }, scrollX: 300 } }))
  assert.equal(signature, draftSceneSignature({ ...scene, elements: [{ id: 'a', version: 2, versionNonce: 3 }] }))
  assert.notEqual(signature, draftSceneSignature({ ...scene, elements: [{ id: 'a', version: 2, x: 100 }] }))
})

test('vision requires a documented exact model and official endpoint, never a brand guess', () => {
  assert.equal(handwritingCapability(config).supported, true)
  assert.equal(handwritingCapability({ endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4.1-mini' }).supported, true)
  for (const invalid of [{ ...config, model: 'qwen3.8-max' }, { ...config, model: 'my-vision-model' },
    { ...config, endpoint: 'https://dashscope.aliyuncs.com.attacker.example/compatible-mode/v1/chat/completions' },
    { ...config, endpoint: config.endpoint + '?other=1' }]) assert.equal(handwritingCapability(invalid).supported, false)
})

test('content edit then undo never revives an old capture; metadata-only restoration stays current', () => {
  const scene = { elements: [{ id: 'a', x: 0, version: 1 }], files: {} }
  publishDraftScene('revision-test', scene)
  const capture = draftSourceReference('revision-test')
  publishDraftScene('revision-test', { ...scene, elements: [{ id: 'a', x: 0, version: 2 }] })
  assert.equal(isHandwritingCurrent(capture), true)
  publishDraftScene('revision-test', { ...scene, elements: [{ id: 'a', x: 50, version: 3 }] })
  assert.equal(isHandwritingCurrent(capture), false)
  publishDraftScene('revision-test', scene)
  assert.equal(isHandwritingCurrent(capture), false)
})

test('recognition keeps alternatives and confidence separate, rejects diagnoses and malformed output', () => {
  const recognition = parseHandwritingRecognition('```json\n' + JSON.stringify(response) + '\n```')
  assert.equal(recognition.text, '2+2=5')
  assert.equal(recognition.blocks[0].confidence, .6)
  assert.deepEqual(recognition.blocks[0].alternatives, ['2+2=6'])
  assert.throws(() => parseHandwritingRecognition(JSON.stringify({ ...response, routeStatus: 'valid' })), /格式/)
  assert.throws(() => parseHandwritingRecognition(JSON.stringify({ blocks: [{ ...response.blocks[0], confidence: 99 }] })), /格式/)
  assert.throws(() => parseHandwritingRecognition('{truncated'), /完整/)
  assert.throws(() => handwritingMessages({ ...artifact, dataUrl: 'https://private.example/page' }), /图片无效/)
  assert.equal(handwritingMessages(artifact)[1].content[1].image_url.url, artifact.dataUrl)
})

test('only confirmed readable current text enters diagnosis and each new source creates a revision', () => {
  const recognition = parseHandwritingRecognition(JSON.stringify(response))
  assert.throws(() => confirmHandwriting(artifact, recognition, '2+2=5', false), /修改/)
  assert.throws(() => confirmHandwriting(artifact, recognition, '[无法辨认]', true), /补全/)
  const confirmed = confirmHandwriting(artifact, recognition, '2+2=5', true)
  const attempt = commitTypedAttempt({ problemId: 'P1', rawText: confirmed.text, handwriting: confirmed })
  assert.equal(attempt.rawArtifacts[1].content, artifact.rawScene)
  assert.equal(attempt.recognition.owner, artifact.owner)
  assert.equal(attempt.recognition.ownerEpoch, artifact.ownerEpoch)
  assert.equal(attempt.recognition.status, 'user_confirmed')
  assert.equal(commitTypedAttempt({ previous: attempt, problemId: 'P1', rawText: confirmed.text, handwriting: confirmed }).version, 1)
  const next = { ...confirmed, artifact: { ...artifact, id: 'ink2' } }
  assert.equal(commitTypedAttempt({ previous: attempt, problemId: 'P1', rawText: confirmed.text, handwriting: next }).version, 2)
  assert.equal(commitTypedAttempt({ previous: attempt, problemId: 'P1', rawText: '2+2=6', handwriting: confirmed }).recognition.status, 'user_edited_transcription')
  assert.equal(commitTypedAttempt({ previous: attempt, problemId: 'P1', rawText: '2+2=5' }).version, 2)
})

test('handwriting checkpoints omit image-linked drafts rather than restore them with false typed provenance', () => {
  const confirmed = confirmHandwriting(artifact, null, '2+2=5', true)
  const attempt = commitTypedAttempt({ problemId: 'P1', rawText: confirmed.text, handwriting: confirmed })
  let raw
  const storage = { setItem: (_key, value) => { raw = value }, getItem: () => raw }
  assert.equal(writeAttemptCheckpoint(storage, 'anon', new Map([['P1', '2+2=5'], ['P2', '文字']]), new Map([['P1', attempt]])), true)
  assert.equal(readAttemptCheckpoint(storage, 'anon').drafts.has('P1'), false)
  assert.equal(readAttemptCheckpoint(storage, 'anon').drafts.get('P2'), '文字')
  assert.doesNotMatch(raw, /ink1|data:image|stroke1/)
})

test('diagnosis receives confirmed transcription provenance but no raw image or reference solution', () => {
  const attempt = commitTypedAttempt({ problemId: 'P1', rawText: '设 x=2',
    handwriting: confirmHandwriting(artifact, parseHandwritingRecognition(JSON.stringify(response)), '设 x=2', true) })
  const context = buildAgentContext({ intent: 'diagnose', page: {
    type: 'problem', id: 'P1', text: '求 x+1', answer: '秘密答案', solution: '秘密解析',
  }, attempt })
  assert.equal(context.attempt.recognition.uncertainBlockCount, 1)
  const prompt = renderAttemptDiagnosisPrompt(context)
  assert.match(prompt, /手写选区的转录/)
  assert.doesNotMatch(prompt, /秘密答案|秘密解析|data:image|stroke1/)
  const forged = { ...attempt, rawArtifacts: attempt.rawArtifacts.filter((raw) => raw.type !== 'ink_snapshot') }
  assert.throws(() => buildAgentContext({ intent: 'diagnose', page: { type: 'problem', id: 'P1', text: '求 x+1' }, attempt: forged }), /原文或版本不一致/)
})
