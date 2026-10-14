import test from 'node:test'
import assert from 'node:assert/strict'
import { requireDraftHint, bindDraftHintActions } from './draftHint.js'
import { commitTypedAttempt, attemptReference } from './typedAttempt.js'
import { buildAgentContext } from './contextEngine.js'
import { renderDraftHintPrompt } from './contextPrompt.js'
import { composeDraftHintResponse } from './responseBlocks.js'
import { resolveLearningIntent, responseActions } from './learningFlow.js'

const page={type:'problem',id:'P-hint',text:'检查自己的路线',answer:'参考答案秘密',solution:'参考解析秘密'}
function fixture() { return commitTypedAttempt({problemId:page.id,rawText:'2+2=5'}) }

test('draft hints require the current submitted text, opt-in context and renewed reading/source',()=>{
  const attempt=fixture(), base={attempt,problemId:page.id,editorText:attempt.rawText,includePage:true}
  assert.equal(requireDraftHint(base),attempt)
  for(const patch of [{attempt:null},{editorText:'2+2=7'},{includePage:false},{needsConfirmation:true},
    {sourceCurrent:false},{selectedArtifactId:'unconfirmed'},{problemId:'another'}]) assert.throws(()=>requireDraftHint({...base,...patch}))
})

test('hint context prioritizes the submitted route and omits OCR exclusions, old diagnoses and reference focus',()=>{
  const attempt=fixture()
  attempt.rawArtifacts.push({id:'old-ocr',content:'排除片段秘密'})
  const context=buildAgentContext({intent:'hint',page,attempt,expectedAttemptRef:attemptReference(attempt),hintLevel:0,includeReference:true,
    focus:{type:'solution_step',problemId:page.id,stepId:'official-step',selectedText:'解析焦点秘密'},
    recentMessages:[{role:'assistant',scopeKey:'scope',content:'旧批改秘密'}],conversationScope:'scope'})
  assert.equal(context.selection,undefined)
  assert.equal(context.solution,undefined)
  const prompt=renderDraftHintPrompt(context)
  assert.match(prompt,/第 1 版/);assert.match(prompt,/2\+2=5/);assert.match(prompt,/第 0 级/)
  assert.match(prompt,/沿用户仍可行的路线/)
  assert.doesNotMatch(prompt,/参考答案秘密|参考解析秘密|解析焦点秘密|排除片段秘密|旧批改秘密/)
  assert.match(prompt,/第 1 步：invalid/)
  assert.doesNotMatch(prompt,/= 4|应为 4/,'hint prompt includes statuses, not the verifier correction')
})

test('draft hint response guards disclosure and marks ordinary hints as preliminary rather than verified math',()=>{
  const hint=composeDraftHintResponse({content:'先检查等号两边表示的量是否相同。',hintLevel:1})
  assert.equal(hint.blocks[0].type,'hint');assert.equal(hint.blocks[0].hintLevel,1)
  assert.equal(hint.blocks[1].type,'warning');assert.match(hint.blocks[1].content,/尚未经完整验证/)
  const leak=composeDraftHintResponse({content:'最终答案：4',hintLevel:0})
  assert.equal(leak.blocks.length,1);assert.equal(leak.blocks[0].type,'warning')
  assert.doesNotMatch(leak.blocks[0].content,/最终答案：4/)
})

test('explicit draft-hint language and continuation carry the same attempt target while direct answer stays available',()=>{
  for(const text of ['基于这版草稿给最小提示','请根据我的路线给我一个提示','沿着我的思路给一个提示'])
    assert.equal(resolveLearningIntent('chat',text),'draft-hint')
  assert.equal(resolveLearningIntent('chat','基于草稿给提示，但直接给完整解答'),'solution')
  assert.notEqual(resolveLearningIntent('chat','不要基于草稿给提示'),'draft-hint')
  const attempt=fixture(), actions=bindDraftHintActions(responseActions('hint',0,{canWriteAttempt:true}),attempt)
  assert.equal(actions.find(a=>a.taskType==='draft-hint').attemptRef.version,1)
  assert.equal(actions.find(a=>a.taskType==='solution').attemptRef,undefined)
})
