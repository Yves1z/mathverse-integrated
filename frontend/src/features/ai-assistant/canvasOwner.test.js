import test from 'node:test'
import assert from 'node:assert/strict'
import { draftRecordKey } from '../draft/draftStore.js'
import { authOwner, ownerFromAuth, beginIdentityCheck, finishIdentityCheck } from '../../services/authIdentity.js'
import { publishDraftScene, currentDraftRevision, draftSourceReference, isHandwritingCurrent, requestHandwritingReview } from '../draft/draftAgentBridge.js'

test('unknown/malformed identity never becomes visitor storage', () => {
  for (const value of [null, {}, { authenticated: true }, { authenticated: true, user: { id: '' } }]) assert.equal(ownerFromAuth(value), null)
  assert.equal(ownerFromAuth({ authenticated: false }), 'anon')
  assert.equal(ownerFromAuth({ authenticated: true, user: { id: 7 } }), 'user:7')
  assert.throws(() => draftRecordKey(null, 'P1'), /所属/)
  assert.throws(() => draftRecordKey('user:', 'P1'), /所属/)
  assert.throws(() => draftRecordKey('anon', ''), /所属/)
  assert.notEqual(draftRecordKey('user:7', 'P1'), draftRecordKey('user:8', 'P1'))
  assert.notEqual(draftRecordKey('user:a', 'b:c'), draftRecordKey('user:a:b', 'c'))
})

test('late identity replies cannot overwrite login/logout; owner transitions invalidate identical scenes', () => {
  const before = beginIdentityCheck()
  const login = beginIdentityCheck({ changingSession: true })
  finishIdentityCheck(login, { authenticated: true, user: { id: 'A' } })
  finishIdentityCheck(before, { authenticated: false })
  assert.equal(authOwner.value, 'user:A')
  const scene = { elements: [{ id: 'ink', x: 2 }], files: {} }
  publishDraftScene('P1', scene, 'user:A')
  const capture = draftSourceReference('P1')
  assert.equal(isHandwritingCurrent(capture), true)
  const changing = beginIdentityCheck({ changingSession: true })
  assert.equal(authOwner.value, null)
  assert.equal(isHandwritingCurrent(capture), false)
  finishIdentityCheck(changing, { authenticated: true, user: { id: 'B' } })
  publishDraftScene('P1', scene, 'user:A')
  assert.equal(currentDraftRevision('P1'), 0, 'late writer cannot publish another account scene')
  finishIdentityCheck(beginIdentityCheck(), { authenticated: true, user: { id: 'A' } })
  publishDraftScene('P1', scene, 'user:A')
  assert.equal(isHandwritingCurrent(capture), false, 'same scene and revision after A→B→A still has a different owner epoch')
  assert.equal(isHandwritingCurrent({ ...capture, owner: undefined, ownerEpoch: undefined }), false)
  return assert.rejects(requestHandwritingReview('P1', capture), /账号已变化/).then(() => {
  finishIdentityCheck(beginIdentityCheck(), { authenticated: false })
  assert.equal(authOwner.value, 'anon')
  })
})
