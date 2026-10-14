import assert from 'node:assert/strict'
import test from 'node:test'
import { applyHandwritingRecognition, needsTranscriptionReplacement, parseHandwritingRecognition, confirmHandwriting } from './handwritingRecognition.js'
import { commitTypedAttempt } from './typedAttempt.js'
import { buildAgentContext } from './contextEngine.js'
import { handwritingMessages } from './handwritingProvider.js'

// Fabricated OCR replies and learner corrections, not measured image recognition.
const cases = [
  { id: 'H01', title: 'superscript versus coefficient', read: 'x2=4', correct: '$x^2=4$', alternatives: ['$x^2=4$'], uncertainty: '2 的位置', confidence: .99 },
  { id: 'H02', title: 'fraction grouping', read: '$1/x+1$', correct: '$\\frac{1}{x+1}$', alternatives: ['$\\frac{1}{x+1}$'], uncertainty: '分母范围', confidence: .7 },
  { id: 'H03', title: 'minus sign versus equality', read: '$x=1$', correct: '$x-1$', alternatives: ['$x-1$'], uncertainty: '横线数量', confidence: null },
  { id: 'H04', title: 'crossed out expression', read: '$x=3$', correct: '已划去 $x=3$，改为 $x=2$', alternatives: ['$x=2$'], uncertainty: '涂改前后', confidence: .8 },
  { id: 'H05', title: 'horizontal branch order', read: '情况二：x<0\n\n情况一：x>0', correct: '情况一：x>0\n\n情况二：x<0', alternatives: ['先左后右'], uncertainty: '横向分支的阅读顺序', confidence: .9 },
  { id: 'H06', title: 'geometry appearance is not a stated constraint', read: '$AB\\perp CD$', correct: '图中标注 AB、CD；没有垂直条件', alternatives: ['AB、CD'], uncertainty: '不能把外观作为垂直条件', confidence: .95 },
]

for (const item of cases) test(`${item.id}: ${item.title} retains source and learner correction across retry`, () => {
  const reply = parseHandwritingRecognition(JSON.stringify({ blocks: [{ text: item.read, alternatives: item.alternatives, uncertainty: item.uncertainty, confidence: item.confidence }] }))
  const initial = applyHandwritingRecognition({ result: reply, text: '', recognition: null })
  assert.equal(initial.text, item.read)
  assert.deepEqual(initial.recognition.blocks[0].alternatives, item.alternatives)
  assert.equal(initial.recognition.blocks[0].confidence, item.confidence)
  assert.equal(needsTranscriptionReplacement(item.correct, reply), true)
  assert.throws(() => applyHandwritingRecognition({ result: reply, text: item.correct, recognition: reply }), /替换/)
  const artifact = { id: item.id, problemId: item.id, rawScene: `immutable-native-ink-${item.id}`, sceneSignature: item.id, sourceRevision: 1, contentHash: item.id }
  const confirmed = confirmHandwriting(artifact, reply, item.correct, true)
  const attempt = commitTypedAttempt({ problemId: item.id, rawText: item.correct, handwriting: confirmed })
  assert.equal(attempt.recognition.status, 'user_edited_transcription')
  assert.equal(attempt.rawArtifacts[1].content, artifact.rawScene)
  const context = buildAgentContext({ intent: 'diagnose', page: { type: 'problem', id: item.id, text: '检查选区' }, attempt })
  assert.equal(context.attempt.recognition.status, 'user_edited_transcription')
  assert.equal(context.attempt.recognition.uncertainBlockCount, 1)
  // Explicitly choosing replacement revokes the correction; UI must request confirmation anew.
  assert.equal(applyHandwritingRecognition({ result: reply, text: item.correct, recognition: reply, allowReplacement: true }).text, item.read)
})

test('H07: manual transcription, even without OCR history, requires explicit replacement', () => {
  const result = parseHandwritingRecognition(JSON.stringify({ blocks: [{ text: '2+2=5', alternatives: [], confidence: 1, uncertainty: '' }] }))
  assert.equal(needsTranscriptionReplacement('手动转录', null), true)
  assert.throws(() => applyHandwritingRecognition({ result, text: '手动转录', recognition: null }), /替换/)
  assert.equal(needsTranscriptionReplacement(result.text, result), false)
  assert.equal(applyHandwritingRecognition({ result, text: result.text, recognition: result }).text, result.text)
  assert.equal(needsTranscriptionReplacement('  ', result), false)
})

test('H08: unreadable and truncated recognition cannot become a confirmed attempt', () => {
  assert.throws(() => parseHandwritingRecognition('{"blocks":['), /完整/)
  const unreadable = parseHandwritingRecognition(JSON.stringify({ blocks: [{ text: '[无法辨认]', alternatives: [], confidence: null, uncertainty: '指数不清' }] }))
  assert.throws(() => confirmHandwriting({ id: 'H08' }, unreadable, unreadable.text, true), /补全/)
  assert.throws(() => confirmHandwriting({ id: 'H08' }, unreadable, 'x^2', false), /修改/)
  assert.throws(() => parseHandwritingRecognition(JSON.stringify({ blocks: [{ text: 'x=2', alternatives: [], confidence: .99, uncertainty: '', mathCorrect: true }] })), /格式/)
})

test('recognizer instructions separate notation, branch order and drawn appearance from mathematics', () => {
  const messages = handwritingMessages({ id: 'selected', dataUrl: 'data:image/png;base64,YQ==' })
  assert.match(messages[0].content, /上下标.*分数.*负号/)
  assert.match(messages[0].content, /不把不同分支拼成一条推导/)
  assert.match(messages[0].content, /不从画面外观推断/)
  assert.equal(messages[1].content.length, 2, 'only selected image and transcription request')
})
