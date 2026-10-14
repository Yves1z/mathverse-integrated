import test from 'node:test'
import assert from 'node:assert/strict'
import { commitTypedAttempt, attemptReference } from './typedAttempt.js'
import { validateDraftStepTarget, bindDraftHintActions } from './draftHint.js'
import { buildAgentContext } from './contextEngine.js'
import { assertContextIntegrity } from './contextIntegrity.js'
import { renderDraftHintPrompt } from './contextPrompt.js'
import { parseDraftStepHintRequest, resolveLearningIntent } from './learningFlow.js'

const page={type:'problem',id:'P-local',text:'沿自己的路线研究函数',answer:'参考答案秘密',solution:'参考解析秘密'}
function fixture() {
  const attempt=commitTypedAttempt({problemId:page.id,rawText:'远处前文秘密\n\n设 x>0\n\n令 t=x+1\n\n研究 t 的范围\n\n后续步骤秘密'})
  const target={attemptRef:attemptReference(attempt),stepId:attempt.steps[3].id,obstacle:'不知道条件怎样使用'}
  return {attempt,target}
}

test('local hints contain the selected step and at most two preceding steps, without later/history/reference text',()=>{
  const {attempt,target}=fixture()
  const context=buildAgentContext({intent:'hint',page,attempt,attemptHintTarget:target,includeReference:true,
    hintState:{level:2,revealed:['此前提示中的后续秘密']},hintLevel:3})
  assert.deepEqual(context.attempt.localSteps.map(s=>s.order),[2,3,4])
  assert.equal(context.request.explicitTarget.id,target.stepId)
  assert.equal(context.attempt.hintTarget.obstacle,target.obstacle)
  const prompt=renderDraftHintPrompt(context)
  assert.match(prompt,/本轮焦点：草稿第 4 步/);assert.match(prompt,/不知道条件怎样使用/)
  assert.doesNotMatch(prompt,/远处前文秘密|后续步骤秘密|此前提示中的后续秘密|参考答案秘密|参考解析秘密/)
  assert.match(prompt,/第 3 级/,'revealed level is retained without unrelated hint bodies')
  for(const index of [0,1]) {
    const first=buildAgentContext({intent:'hint',page,attempt,attemptHintTarget:{...target,stepId:attempt.steps[index].id}})
    assert.equal(first.attempt.localSteps.length,index+1)
  }
})

test('learner can add one distant premise with source identity, without broadening to omitted or future steps',()=>{
  const {attempt,target}=fixture()
  const chosen={...target,premiseStepId:attempt.steps[0].id}
  const context=buildAgentContext({intent:'hint',page,attempt,attemptHintTarget:chosen,includeReference:true,
    hintState:{revealed:['旧提示中的答案秘密']},hintLevel:2})
  assert.deepEqual(context.attempt.localSteps.map(s=>s.order),[1,2,3,4])
  assert.equal(context.attempt.hintTarget.premiseStepNumber,1)
  assert.deepEqual(context.attempt.localSteps[0].sourceRange,attempt.steps[0].sourceRange)
  assert.ok(context.contextMetadata.selectedItems.some(item=>item.source==='attempt.explicit_premise'))
  const prompt=renderDraftHintPrompt(context)
  assert.match(prompt,/学生选入的较早前提（草稿原文，尚未验证）· 第 1 步：远处前文秘密/)
  assert.match(prompt,/前提与题目冲突或依据不足/)
  assert.doesNotMatch(prompt,/后续步骤秘密|旧提示中的答案秘密|参考答案秘密|参考解析秘密/)
})

test('selected premise must be a distant earlier step from the same bound attempt',()=>{
  const {attempt,target}=fixture()
  for(const premiseStepId of ['missing',attempt.steps[1].id,attempt.steps[2].id,
    attempt.steps[3].id,attempt.steps[4].id,13]) {
    assert.throws(()=>validateDraftStepTarget(attempt,{...target,premiseStepId}),/补入的前提/)
  }
  assert.throws(()=>validateDraftStepTarget(attempt,{...target,premiseStepId:attempt.steps[0].id,
    attemptRef:{...target.attemptRef,version:2}}),/重新选择/)
  const context=buildAgentContext({intent:'hint',page,attempt,attemptHintTarget:{...target,premiseStepId:attempt.steps[0].id}})
  for(const change of [
    {hintTarget:{...context.attempt.hintTarget,premiseStepNumber:2}},
    {hintTarget:{...context.attempt.hintTarget,premiseStepId:attempt.steps[4].id}},
    {localSteps:[...context.attempt.localSteps.slice(1),context.attempt.localSteps[0]]},
  ]) assert.throws(()=>assertContextIntegrity({...context,attempt:{...context.attempt,...change}},'hint'),{name:'ContextIntegrityError'})
})

test('step targets reject wrong versions/problems/ids and oversized obstacle text before provider work',()=>{
  const {attempt,target}=fixture()
  for(const patch of [{stepId:'unknown'},{attemptRef:{...target.attemptRef,version:2}},
    {attemptRef:{...target.attemptRef,problemId:'other'}},{obstacle:'x'.repeat(501)},{obstacle:null}]) {
    assert.throws(()=>validateDraftStepTarget(attempt,{...target,...patch}),/重新选择/)
    assert.throws(()=>buildAgentContext({intent:'hint',page,attempt,attemptHintTarget:{...target,...patch}}))
  }
  assert.throws(()=>buildAgentContext({intent:'diagnose',page,attempt,attemptHintTarget:target}),/仅用于提示/)
})

test('forged local context cannot move the declared focus or append a later step',()=>{
  const {attempt,target}=fixture(), context=buildAgentContext({intent:'hint',page,attempt,attemptHintTarget:target})
  for(const change of [{hintTarget:{...context.attempt.hintTarget,stepNumber:5}},
    {hintTarget:{...context.attempt.hintTarget,attemptRef:{...target.attemptRef,version:2}}},
    {currentFocusStepId:attempt.steps[2].id},
    {localSteps:[...context.attempt.localSteps,{stepId:attempt.steps[4].id,order:5,rawContent:'后续步骤秘密',author:'user'}]}]) {
    assert.throws(()=>assertContextIntegrity({...context,attempt:{...context.attempt,...change}},'hint'),{name:'ContextIntegrityError'})
  }
})

test('local continuation preserves target/obstacle and solution remains explicit; language uses the same intent',()=>{
  const {attempt,target}=fixture(), normalized=validateDraftStepTarget(attempt,target)
  const actions=bindDraftHintActions([{taskType:'hint'},{taskType:'solution'}],attempt,normalized,3)
  assert.equal(actions[0].taskType,'draft-step-hint');assert.equal(actions[0].targetRevision,3)
  assert.equal(actions[0].draftHintTarget.stepNumber,4)
  assert.equal(actions[1].draftHintTarget,undefined)
  for(const text of ['草稿第2步给我一个提示','请针对草稿第 2 步给提示','给草稿第4步一个提示：缺少什么条件'])
    assert.equal(resolveLearningIntent('chat',text),'draft-step-hint')
  assert.equal(resolveLearningIntent('chat','草稿第2步给提示，但直接给完整解答'),'solution')
  assert.notEqual(resolveLearningIntent('chat','不要针对草稿第2步给提示'),'draft-step-hint')
  const withPremise='把草稿第1步作为前提，给草稿第4步提示：这里为什么需要定义域'
  assert.equal(resolveLearningIntent('chat',withPremise),'draft-step-hint')
  assert.deepEqual(parseDraftStepHintRequest(withPremise),{
    stepNumber:4,premiseStepNumber:1,obstacle:'这里为什么需要定义域',
  })
  assert.deepEqual(parseDraftStepHintRequest('针对草稿第4步给提示，把草稿第1步作为前提'),{
    stepNumber:4,premiseStepNumber:1,obstacle:'',
  })
})
