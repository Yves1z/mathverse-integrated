import test from 'node:test'
import assert from 'node:assert/strict'
import { parseHandwritingRecognition, confirmHandwriting } from './handwritingRecognition.js'
import { createReadingReview, normalizeReadingReview, readingReviewText } from './readingReview.js'
import { recognitionValue, linkedSubmission, submittedCheckpoint } from './handwritingCheckpoint.js'
import { commitTypedAttempt } from './typedAttempt.js'
import { assertAttemptIntegrity } from './contextIntegrity.js'

function fixture() {
  const recognition = parseHandwritingRecognition(JSON.stringify({ blocks: [
    { text: '2+2=5', alternatives:['2+2=6'],confidence:.4,uncertainty:'分支顺序' },
    { text: '[无法辨认]', alternatives:['已划去','保留'],confidence:.1,uncertainty:'涂改' },
  ] }))
  recognition.readingReview = createReadingReview(recognition)
  const artifact = { id:'reading-photo',problemId:'P-reading',sourceKind:'paper_image',sceneSignature:'reading-source',sourceRevision:1 }
  return { recognition, artifact }
}

test('learner linearization keeps original blocks/candidates and permits explicit exclusion of unreadable crossed-out text', () => {
  const {recognition,artifact}=fixture(), original=structuredClone(recognition.blocks)
  recognition.readingReview.items[1].included=false
  recognition.readingReview.items.reverse()
  recognition.readingReview.items[1].text='2+2=7'
  const text=readingReviewText(recognition.readingReview)
  assert.equal(text,'2+2=7')
  assert.deepEqual(recognition.blocks,original)
  const confirmed=confirmHandwriting(artifact,recognition,text,true)
  const attempt=commitTypedAttempt({problemId:artifact.problemId,rawText:text,handwriting:confirmed})
  assert.equal(attempt.recognition.status,'user_edited_transcription')
  assert.deepEqual(attempt.recognition.blocks,original)
  assert.equal(attempt.recognition.readingReview.items[0].included,false)
})

test('pending edits, included unreadable/blank fragments and unapplied composition cannot be confirmed', () => {
  const {recognition,artifact}=fixture()
  assert.throws(()=>confirmHandwriting(artifact,recognition,readingReviewText(recognition.readingReview),true),/补全/)
  recognition.readingReview.items[1].included=false
  recognition.readingReview.pending=true
  assert.throws(()=>confirmHandwriting(artifact,recognition,'2+2=5',true),/应用/)
  recognition.readingReview.pending=false
  assert.throws(()=>confirmHandwriting(artifact,recognition,'2+2=6',true),/应用/)
  recognition.readingReview.items[0].text=''
  assert.throws(()=>confirmHandwriting(artifact,recognition,'2+2=6',true),/应用/)
  recognition.readingReview.mode='manual'
  assert.equal(confirmHandwriting(artifact,recognition,'2+2=6',true).text,'2+2=6')
})

test('backup validation rejects unknown/duplicate/missing block references and invalid bounded edits', () => {
  const {recognition}=fixture(), review=recognition.readingReview
  for(const patch of [{mode:'auto'}, {pending:0}, {items:[]},
    {items:[review.items[0],review.items[0]]},
    {items:[{...review.items[0],blockId:'other'},review.items[1]]},
    {items:[{...review.items[0],included:'false'},review.items[1]]},
    {items:[{...review.items[0],text:'x'.repeat(6001)},review.items[1]]}]) {
    assert.throws(()=>normalizeReadingReview({...review,...patch},recognition),/无效/)
    assert.throws(()=>recognitionValue({...recognition,readingReview:{...review,...patch}}),/无效/)
  }
  assert.deepEqual(recognitionValue(recognition).readingReview,review)
  const legacy={...recognition};delete legacy.readingReview
  assert.equal(recognitionValue(legacy).readingReview,undefined)
})

test('identical text with different excluded-content evidence advances the version; unchanged and lower-editor text remain stable', () => {
  const {recognition,artifact}=fixture()
  recognition.readingReview.items[1].included=false
  let confirmed=confirmHandwriting(artifact,recognition,'2+2=5',true)
  const first=commitTypedAttempt({problemId:artifact.problemId,rawText:confirmed.text,handwriting:confirmed})
  const changed=structuredClone(recognition)
  changed.readingReview.items[1].text='用户确认已划去'
  confirmed=confirmHandwriting(artifact,changed,'2+2=5',true)
  const second=commitTypedAttempt({previous:first,problemId:artifact.problemId,rawText:confirmed.text,handwriting:confirmed})
  assert.equal(second.version,2)
  assert.equal(commitTypedAttempt({previous:second,problemId:artifact.problemId,rawText:confirmed.text,handwriting:confirmed}),second)
  const lower=commitTypedAttempt({previous:second,problemId:artifact.problemId,rawText:'2+2=7',handwriting:confirmed})
  assert.equal(lower.recognition.readingReview.mode,'manual')
  assert.equal(commitTypedAttempt({previous:lower,problemId:artifact.problemId,rawText:'2+2=7',handwriting:confirmed}),lower)
  const record=linkedSubmission(second,artifact)
  assert.deepEqual(submittedCheckpoint(record,artifact.problemId).recognition.readingReview,changed.readingReview)
  assert.throws(()=>submittedCheckpoint({...record,recognition:{...record.recognition,readingReview:{...changed.readingReview,pending:true}}},artifact.problemId),/应用/)
})

test('context rejects forged pending or reordered block provenance before mathematics', () => {
  const {recognition,artifact}=fixture()
  artifact.sourceKind='ink';artifact.rawScene='original native strokes'
  recognition.readingReview.items[1].included=false
  const confirmed=confirmHandwriting(artifact,recognition,'2+2=5',true)
  const attempt=commitTypedAttempt({problemId:artifact.problemId,rawText:confirmed.text,handwriting:confirmed})
  assertAttemptIntegrity(attempt,artifact.problemId)
  for(const review of [{...recognition.readingReview,pending:true},
    {...recognition.readingReview,items:[{...recognition.readingReview.items[0],text:'2+2=7'},recognition.readingReview.items[1]]}]) {
    assert.throws(()=>assertAttemptIntegrity({...attempt,recognition:{...attempt.recognition,readingReview:review}},artifact.problemId),/不一致/)
  }
})
