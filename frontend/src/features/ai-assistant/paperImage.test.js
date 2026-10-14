import test from 'node:test'
import assert from 'node:assert/strict'
import { validatePaperImage, paperCropBounds, paperCropFromPercent, paperCropToPercent, orientedPaperDimensions } from './paperImage.js'
import { revisePaperSource, installPaperImage, isHandwritingCurrent, handwritingRequest } from '../draft/draftAgentBridge.js'
import { beginIdentityCheck, finishIdentityCheck } from '../../services/authIdentity.js'
import { commitTypedAttempt } from './typedAttempt.js'
import { confirmHandwriting } from './handwritingRecognition.js'
import { handwritingMessages } from './handwritingProvider.js'
import { buildAgentContext } from './contextEngine.js'

function owner(id) { finishIdentityCheck(beginIdentityCheck(), { authenticated: true, user: { id } }) }

test('quarter turns map displayed selections to the immutable original and restore exact pixel bounds', () => {
  const percent = { x: 20, y: 20, width: 40, height: 30 }
  const expected = [
    { x: 200, y: 120, width: 400, height: 180 },
    { x: 200, y: 240, width: 300, height: 240 },
    { x: 400, y: 300, width: 400, height: 180 },
    { x: 500, y: 120, width: 300, height: 240 },
  ]
  for (const [i, rotation] of [0,90,180,270].entries()) {
    const crop = paperCropFromPercent(1000, 600, percent, rotation)
    assert.deepEqual(crop, { ...expected[i], originalWidth: 1000, originalHeight: 600 })
    for (const c of [crop, {x:0,y:0,width:1000,height:600,originalWidth:1000,originalHeight:600},
      {x:37,y:29,width:311,height:179,originalWidth:997,originalHeight:613}]) {
      assert.deepEqual(paperCropFromPercent(c.originalWidth,c.originalHeight,paperCropToPercent(c,rotation),rotation),c)
    }
    assert.deepEqual(orientedPaperDimensions(1000,600,rotation), rotation % 180 ? {width:600,height:1000} : {width:1000,height:600})
  }
  for (const rotation of [null, '90', 45, -90, 360, NaN]) assert.throws(() => paperCropFromPercent(1000,600,percent,rotation), /方向/)
})

test('paper crop retains original pixel coordinates, rejects invalid bounds and excessive sources', () => {
  assert.deepEqual(paperCropBounds(4000, 3000, { x: 25, y: 10, width: 50, height: 40 }),
    { x: 1000, y: 300, width: 2000, height: 1200, originalWidth: 4000, originalHeight: 3000 })
  for (const bounds of [{ x: -1, y: 0, width: 10, height: 10 }, { x: 90, y: 0, width: 11, height: 10 },
    { x: 0, y: 0, width: 0, height: 10 }, { x: 0, y: NaN, width: 10, height: 10 }]) {
    assert.throws(() => paperCropBounds(100, 100, bounds))
  }
  assert.throws(() => paperCropBounds(9000, 9000, { x: 0, y: 0, width: 100, height: 100 }), /4000/)
  assert.throws(() => paperCropBounds(100, 100, { x: 0, y: 0, width: 1, height: 1 }), /太小/)
  for (const blob of [new Blob([],{type:'image/png'}), new Blob(['svg'],{type:'image/svg+xml'}),
    new Blob([new Uint8Array(12 * 1024 * 1024 + 1)],{type:'image/jpeg'})]) assert.throws(() => validatePaperImage(blob))
})

test('paper changes and undo cannot revive sources; account transitions reject late crops', () => {
  owner('paper-A')
  const source = revisePaperSource('P-photo')
  const artifact = { ...source, id: 'photo1' }
  installPaperImage(artifact)
  assert.equal(isHandwritingCurrent(artifact), true)
  assert.deepEqual(revisePaperSource('P-photo', false), source, 'decode guard preserves an existing crop')
  revisePaperSource('P-photo')
  assert.equal(isHandwritingCurrent(artifact), false)
  revisePaperSource('P-photo')
  assert.equal(isHandwritingCurrent(artifact), false)
  assert.throws(() => installPaperImage(artifact), /已变化/)
  owner('paper-B'); owner('paper-A')
  assert.equal(handwritingRequest.value, null)
  assert.throws(() => installPaperImage(artifact), /已变化/)
})

test('confirmed photo uses image provenance, retains original/crop, versions edits and source replacement', () => {
  const originalBlob = new Blob(['original-photo-secret'], { type:'image/png' })
  const croppedBlob = new Blob(['selected-only'], { type:'image/png' })
  const artifact = { id:'photo2', problemId:'P-photo', sourceKind:'paper_image', originalBlob, croppedBlob,
    originalHash:'a'.repeat(64), contentHash:'b'.repeat(64), dataUrl:'data:image/png;base64,YQ==',
    crop:paperCropBounds(100,100,{x:10,y:10,width:50,height:50}), sceneSignature:'token', sourceRevision:1 }
  const confirmed = confirmHandwriting(artifact, null, '2+2=5', true)
  const attempt = commitTypedAttempt({problemId:'P-photo',rawText:confirmed.text,handwriting:confirmed})
  assert.equal(attempt.rawArtifacts[1].type, 'image_crop')
  assert.equal(attempt.rawArtifacts[1].originalBlob, originalBlob)
  assert.equal(attempt.rawArtifacts[1].croppedBlob, croppedBlob)
  assert.deepEqual(attempt.rawArtifacts[1].crop, artifact.crop)
  assert.equal(attempt.recognition.sourceKind, 'paper_image')
  assert.equal(attempt.rawArtifacts[1].content, undefined, 'photo is not fabricated native ink')
  const context = buildAgentContext({intent:'diagnose', page:{type:'problem',id:'P-photo',text:'检查运算'},attempt})
  assert.equal(context.attempt.recognition.artifactId, artifact.id)
  for (const invalid of [{crop:null}, {originalBlob:null}, {croppedBlob:null}, {originalHash:'bad'},
    {crop:{...artifact.crop,width:101}}, {type:'ink_snapshot',content:'fake-native-ink'}]) {
    assert.throws(()=>buildAgentContext({intent:'diagnose', page:{type:'problem',id:'P-photo',text:'检查运算'},
      attempt:{...attempt,rawArtifacts:[attempt.rawArtifacts[0],{...attempt.rawArtifacts[1],...invalid}]}}), /不一致/)
  }
  assert.equal(commitTypedAttempt({previous:attempt,problemId:'P-photo',rawText:confirmed.text,handwriting:confirmed}), attempt)
  const edited = commitTypedAttempt({previous:attempt,problemId:'P-photo',rawText:'2+2=4',handwriting:confirmed})
  assert.equal(edited.version, 2)
  assert.equal(edited.recognition.status, 'user_edited_transcription')
  const replaced = commitTypedAttempt({previous:edited,problemId:'P-photo',rawText:'2+2=4',handwriting:{...confirmed, artifact:{...artifact,id:'photo3'}}})
  assert.equal(replaced.version, 3)
  assert.throws(() => confirmHandwriting(artifact,null,'2+2=5',false), /已修改/)
  const messages = handwritingMessages(artifact)
  assert.equal(messages[1].content[1].image_url.url, artifact.dataUrl)
  assert.doesNotMatch(JSON.stringify(messages), /original-photo-secret|original-hash|originalWidth/)
})
