const { browserExecutable, getTestPort } = require('./browser-support.cjs')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const assert = require('node:assert/strict')
const path = require('node:path')
const { chromium } = require('playwright')
let browser, server
;(async () => {
  const port = await getTestPort(), origin = `http://127.0.0.1:${port}`
  server = spawn(process.execPath, [path.resolve(__dirname, '../node_modules/vite/bin/vite.js'),
    '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: path.resolve(__dirname, '..'), windowsHide: true, stdio: 'inherit' })
  let ready = false
  for (let i = 0; i < 500; i++) { try { if ((await fetch(origin)).ok) { ready = true; break } } catch {} await delay(100) }
  assert.ok(ready)
  browser = await chromium.launch({ executablePath: browserExecutable, headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errors = [], requests = []
  let state = 'normal', _release, identity = { authenticated: true, user: { id: 'agent-test-admin', username: 'Agent regression', role: 'ADMIN' } }
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/api/**', (route) => route.fulfill({ json: route.request().url().includes('/api/v1/problems/P30001')
    ? { id: 'P30001', title: '照片选区检查', type: 'solution', content: '检查自己的计算。', answer: '参考答案秘密', solution: '参考解析秘密', tags:['代数'] }
    : identity }))
  await page.route('**/__mathverse_similarity_proxy', async (route) => {
    const request = route.request().postDataJSON(); requests.push(request)
    const mode = state
    if (mode === 'late') await new Promise((resolve) => { _release = resolve })
    if (mode === 'failure') return route.fulfill({ status:503, json:{error:{message:'照片识别暂时失败'}} })
    const value = request.taskType === 'assistant-handwriting-recognition'
      ? { blocks:[{text:mode === 'late' ? '迟到转录不可显示' : '[无法辨认]', confidence:.4, alternatives:['2+2=5','2+2=6'],uncertainty:'末尾数字'}] }
      : { routeStatus:'valid_but_incomplete', firstIssueStep:null, feedback:'当前路线可继续。',nextQuestion:'' }
    try { await route.fulfill({json:{content:JSON.stringify(value),model:request.model}}) } catch {}
  })
  await page.goto(`${origin}/problems/P30001`, {waitUntil:'networkidle'})
  await page.getByRole('button',{name:'打开 Mathverse AI 助手'}).click()
  const drawer = page.getByRole('dialog',{name:'Mathverse AI 学习助手'})
  await drawer.getByRole('button',{name:'Qwen 手写识别',exact:true}).click()
  await drawer.getByLabel('API Key',{exact:true}).fill('paper-mock-key')
  await drawer.getByRole('button',{name:'返回对话',exact:true}).click()
  const input = drawer.locator('.ai-paper-input'), panel = drawer.locator('.ai-handwriting-review')
  // A fabricated raster with a red excluded zone makes crop leakage measurable.
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width=1000; canvas.height=600
    const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1000,600)
    ctx.fillStyle='red';ctx.fillRect(0,0,100,600)
    ctx.fillStyle='blue';ctx.font='50px sans-serif';ctx.fillText('2+2=5',210,200)
    return canvas.toDataURL().split(',')[1]
  })
  const file = {name:'paper.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')}
  await input.getByLabel('选择草稿照片',{exact:true}).setInputFiles({name:'invalid.png',mimeType:'image/png',buffer:Buffer.from('broken')})
  await input.getByText(/照片无法解码/).waitFor()
  await input.getByLabel('选择草稿照片',{exact:true}).setInputFiles(file)
  await input.locator('.ai-paper-preview').first().waitFor()
  for (const [label,value] of [['选区左侧','20'],['选区顶部','20'],['选区宽度','40'],['选区高度','30']]) await input.getByLabel(label,{exact:true}).fill(value)
  assert.equal(await input.getByRole('button',{name:'提交照片选区',exact:true}).isDisabled(),true)
  await input.getByRole('checkbox',{name:'我已选择需要识别的区域'}).check()
  await input.getByRole('button',{name:'提交照片选区',exact:true}).click()
  await panel.waitFor()
  assert.equal(requests.length,0)
  const artifact = await page.evaluate(async () => {
    const a=(await import('/src/features/draft/draftAgentBridge.js')).handwritingRequest.value
    const image = new Image(); await new Promise((r)=>{image.onload=r;image.src=a.dataUrl})
    const c=document.createElement('canvas');c.width=image.width;c.height=image.height
    const ctx=c.getContext('2d');ctx.drawImage(image,0,0)
    const pixels=ctx.getImageData(0,0,c.width,c.height).data
    let red=0;for(let i=0;i<pixels.length;i+=4) if(pixels[i]>200&&pixels[i+1]<80&&pixels[i+2]<80) red++
    return {id:a.id,crop:a.crop,width:a.width,height:a.height,originalSize:a.originalBlob.size,cropSize:a.croppedBlob.size,red,dataUrl:a.dataUrl}
  })
  assert.deepEqual(artifact.crop,{x:200,y:120,width:400,height:180,originalWidth:1000,originalHeight:600})
  assert.equal(artifact.width,400);assert.equal(artifact.height,180);assert.equal(artifact.red,0)
  assert.equal(artifact.originalSize,file.buffer.length)
  assert.equal(await panel.getByRole('button',{name:'保存本题手写备份'}).count(),0)
  const consent=panel.getByRole('checkbox',{name:'我同意将此选区发送给上述模型用于识别'})
  assert.equal(await consent.isChecked(),false)
  await consent.check(); await panel.getByRole('button',{name:'识别手写选区',exact:true}).click()
  const text=panel.getByLabel('手写转录内容',{exact:true})
  await panel.getByText(/待核对：末尾数字/).waitFor()
  assert.equal(await text.inputValue(),'[无法辨认]')
  assert.equal(await panel.getByRole('button',{name:'确认读法并检查'}).isDisabled(),true)
  assert.equal(requests[0].messages[1].content[1].image_url.url,artifact.dataUrl)
  assert.doesNotMatch(JSON.stringify(requests[0]),/参考答案秘密|参考解析秘密|originalWidth/)
  await text.fill('2+2=5')
  await panel.getByRole('checkbox',{name:'我已核对原图，关键符号和步骤顺序准确'}).check()
  await panel.getByRole('button',{name:'确认读法并检查'}).click()
  await drawer.getByText('已验证的算术问题 · 第 1 步',{exact:true}).waitFor()
  const draft=drawer.locator('.ai-assistant-attempt textarea')
  const read=()=>page.evaluate(async()=>{
    const {readPaperCheckpoint}=await import('/src/features/draft/draftStore.js')
    return await readPaperCheckpoint('user:agent-test-admin','P30001')
  })
  assert.equal(await read(),null,'selection and recognition do not persist by default')
  await draft.fill('2+2=7')
  await panel.getByRole('button',{name:'保存本题照片备份',exact:true}).click()
  await panel.getByText(/已保存本题照片备份；/).waitFor()
  const summary=await page.evaluate(async()=>{
    const r=await (await import('/src/features/draft/draftStore.js')).readPaperCheckpoint('user:agent-test-admin','P30001')
    return {text:r.text,editorText:r.editorText,version:r.submitted.version,id:r.submitted.id,crop:r.snapshot.crop,
      originalSize:r.snapshot.originalBlob.size,hash:r.snapshot.originalHash,keys:Object.keys(r),imageKeys:Object.keys(r.snapshot)}
  })
  assert.equal(summary.text,'2+2=5');assert.equal(summary.editorText,'2+2=7');assert.equal(summary.version,1)
  assert.deepEqual(summary.crop,artifact.crop);assert.equal(summary.originalSize,file.buffer.length)
  assert.doesNotMatch(JSON.stringify(summary),/ownerEpoch|apiKey|consent|feedback|responseCache/)
  page.on('dialog',(dialog)=>dialog.accept())
  async function reloadChat() {
    await page.reload({waitUntil:'networkidle'})
    assert.equal(await page.locator('.ai-handwriting-review').count(),0,'photo recovery is explicit')
    await page.getByRole('button',{name:'打开 Mathverse AI 助手'}).click()
    assert.equal(await drawer.getByLabel('API Key',{exact:true}).inputValue(),'','key is not restored')
    await drawer.getByRole('button',{name:'返回对话',exact:true}).click()
  }
  const count=requests.length
  await reloadChat()
  assert.equal(requests.length,count,'refresh performs no model call')
  assert.equal(await draft.inputValue(),'','photo-linked editor does not return as typed text')
  await drawer.getByRole('button',{name:'恢复本题已保存照片',exact:true}).click()
  await panel.waitFor()
  assert.equal(await text.inputValue(),'2+2=5');assert.equal(await draft.inputValue(),'2+2=7')
  await input.locator('.ai-paper-preview').first().waitFor()
  assert.equal(await input.getByLabel('选区左侧',{exact:true}).inputValue(),'20')
  const restored=await page.evaluate(async()=>{
    const {handwritingRequest,isHandwritingCurrent}=await import('/src/features/draft/draftAgentBridge.js')
    return {hash:handwritingRequest.value.originalHash,current:isHandwritingCurrent(handwritingRequest.value)}
  })
  assert.equal(restored.hash,summary.hash);assert.equal(restored.current,true)
  assert.equal(await panel.getByRole('checkbox',{name:'我已核对原图，关键符号和步骤顺序准确'}).isChecked(),false)
  assert.equal(await drawer.locator('.ai-assistant-message.is-assistant').count(),0,'old mathematics is not restored')
  await drawer.getByRole('button',{name:/^检查我的思路/}).click()
  await drawer.getByText(/恢复的照片需先/).waitFor()
  assert.equal(requests.length,count)
  await panel.getByRole('button',{name:'选择视觉模型 / 填写 Key'}).click()
  await drawer.getByRole('button',{name:'Qwen 手写识别',exact:true}).click()
  await drawer.getByLabel('API Key',{exact:true}).fill('paper-checkpoint-mock-key')
  await drawer.getByRole('button',{name:'返回对话',exact:true}).click()
  assert.equal(await consent.isChecked(),false,'send consent is renewed')
  await panel.getByRole('checkbox',{name:'我已核对原图，关键符号和步骤顺序准确'}).check()
  await panel.getByRole('button',{name:'确认读法并检查'}).click()
  await drawer.getByText('已验证的算术问题 · 第 1 步',{exact:true}).waitFor()
  assert.match(await drawer.locator('.ai-assistant-attempt-heading').textContent(),/第 1 版/)
  await draft.fill('2+2=7')
  await panel.getByRole('button',{name:'将恢复的文字编辑稿放入转录区核对'}).click()
  await panel.getByRole('checkbox',{name:'我已核对原图，关键符号和步骤顺序准确'}).check()
  await panel.getByRole('button',{name:'确认读法并检查'}).click()
  await drawer.locator('.ai-assistant-attempt-heading').getByText('已提交第 2 版',{exact:true}).waitFor()
  // Same-page recovery of an older saved submission must not reuse a version already assigned to different text.
  await drawer.getByRole('button',{name:'恢复本题已保存照片',exact:true}).click()
  await page.waitForFunction(()=>document.querySelector('.ai-handwriting-review textarea[aria-label="手写转录内容"]')?.value==='2+2=5')
  assert.equal(await text.inputValue(),'2+2=5')
  await panel.getByRole('checkbox',{name:'我已核对原图，关键符号和步骤顺序准确'}).check()
  await panel.getByRole('button',{name:'确认读法并检查'}).click()
  await drawer.locator('.ai-assistant-attempt-heading').getByText('已提交第 3 版',{exact:true}).waitFor()
  await text.fill('2+2=7')
  await panel.getByRole('checkbox',{name:'我已核对原图，关键符号和步骤顺序准确'}).check()
  await panel.getByRole('button',{name:'确认读法并检查'}).click()
  await drawer.locator('.ai-assistant-attempt-heading').getByText('已提交第 4 版',{exact:true}).waitFor()
  await panel.getByRole('button',{name:'保存本题照片备份',exact:true}).click()
  await panel.getByText(/已保存本题照片备份；/).waitFor()
  assert.equal((await read()).submitted.version,4)
  // Write failure retains the old record and the learner's current correction.
  await page.evaluate(()=>{
    const original=IDBObjectStore.prototype.put
    window.restorePaperPut=()=>{IDBObjectStore.prototype.put=original}
    IDBObjectStore.prototype.put=function(value,key){if(String(key).startsWith('paper-checkpoint:'))throw new DOMException('fixture quota','QuotaExceededError');return original.call(this,value,key)}
  })
  await text.fill('2+2=8')
  await panel.getByRole('button',{name:'保存本题照片备份',exact:true}).click()
  await panel.getByText(/当前选区仍保留/).waitFor()
  assert.equal(await text.inputValue(),'2+2=8');assert.equal((await read()).text,'2+2=7')
  await page.evaluate(()=>window.restorePaperPut())
  // Edits during a slow recovery, including edit/undo, must cancel replacement.
  await page.evaluate(()=>{
    const original=crypto.subtle.digest.bind(crypto.subtle),waiting=[]
    crypto.subtle.digest=(...args)=>new Promise((resolve,reject)=>waiting.push(()=>original(...args).then(resolve,reject)))
    window.resumeHashes=()=>{crypto.subtle.digest=original;for(const run of waiting)run()}
  })
  await drawer.getByRole('button',{name:'恢复本题已保存照片',exact:true}).click()
  await draft.fill('2+2=9');await draft.fill('2+2=7')
  await page.evaluate(()=>window.resumeHashes())
  await drawer.getByText(/恢复已取消，账号、题目或备份已变化/).waitFor()
  assert.equal(await text.inputValue(),'2+2=8','edit/undo during recovery does not replace current review')
  assert.equal(await draft.inputValue(),'2+2=7')
  // Keep a test-only copy to restore corruption controls, never in the product record.
  await page.evaluate(async()=>{
    const store=await import('/src/features/draft/draftStore.js')
    window.goodPaperRecord=await store.readPaperCheckpoint('user:agent-test-admin','P30001')
    await store.writeInkCheckpoint('user:agent-test-admin','P30001',{sentinel:'separate-ink-record'})
    await store.writePaperCheckpoint('user:agent-test-admin','P30001',{...window.goodPaperRecord,snapshot:{...window.goodPaperRecord.snapshot,dataUrl:'https://external.test/picture.png'}})
  })
  await drawer.getByRole('button',{name:'恢复本题已保存照片',exact:true}).click()
  await drawer.getByText(/照片备份格式或来源无效/).waitFor()
  assert.equal(await text.inputValue(),'2+2=8')
  await page.evaluate(async()=>{
    const {inkHash}=await import('/src/features/ai-assistant/handwritingCheckpoint.js')
    const crop={...window.goodPaperRecord.snapshot.crop,originalWidth:1001}
    await (await import('/src/features/draft/draftStore.js')).writePaperCheckpoint('user:agent-test-admin','P30001',{
      ...window.goodPaperRecord,snapshot:{...window.goodPaperRecord.snapshot,crop,cropHash:await inkHash(JSON.stringify(crop))}})
  })
  await drawer.getByRole('button',{name:'恢复本题已保存照片',exact:true}).click()
  await drawer.getByText(/照片备份尺寸与裁剪来源不一致/).waitFor()
  assert.equal(await text.inputValue(),'2+2=8')
  await page.evaluate(async()=>{
    const {inkHash}=await import('/src/features/ai-assistant/handwritingCheckpoint.js')
    const originalBlob=new Blob(['invalid raster'],{type:'image/png'})
    await (await import('/src/features/draft/draftStore.js')).writePaperCheckpoint('user:agent-test-admin','P30001',{
      ...window.goodPaperRecord,snapshot:{...window.goodPaperRecord.snapshot,originalBlob,originalHash:await inkHash(originalBlob)}})
  })
  await drawer.getByRole('button',{name:'恢复本题已保存照片',exact:true}).click()
  await drawer.getByText(/照片备份无法解码/).waitFor()
  assert.equal(await text.inputValue(),'2+2=8')
  await page.evaluate(async()=>{
    await (await import('/src/features/draft/draftStore.js')).writePaperCheckpoint('user:agent-test-admin','P30001',window.goodPaperRecord)
  })
  // Delete during hash preparation: a cancelled late save cannot revive disk data.
  await page.evaluate(()=>{
    const original=crypto.subtle.digest.bind(crypto.subtle), waiting=[]
    crypto.subtle.digest=(...args)=>new Promise((resolve,reject)=>waiting.push(()=>original(...args).then(resolve,reject)))
    window.resumeHashes=()=>{crypto.subtle.digest=original;for(const run of waiting)run()}
  })
  await panel.getByRole('button',{name:'保存本题照片备份',exact:true}).click()
  await page.evaluate(async()=>{
    await (await import('/src/features/ai-assistant/paperPersistence.js')).deletePhotoCheckpoint('user:agent-test-admin','P30001')
    window.resumeHashes()
  })
  await panel.getByText(/保存已取消/).waitFor()
  assert.equal(await read(),null)
  await text.fill('2+2=7')
  await panel.getByRole('button',{name:'保存本题照片备份',exact:true}).click()
  await panel.getByText(/已保存本题照片备份；/).waitFor()
  // A different account cannot restore visitor data, and returning does not revive the old in-page source.
  identity={authenticated:true,user:{id:'paper-other',role:'ADMIN'}}
  await page.evaluate(async()=>{await (await import('/src/services/authService.js')).authService.me()})
  assert.equal(await panel.count(),0)
  await drawer.getByRole('button',{name:'恢复本题已保存照片',exact:true}).click()
  await drawer.getByText('本题没有主动保存的照片备份',{exact:true}).waitFor()
  identity={ authenticated: true, user: { id: 'agent-test-admin', username: 'Agent regression', role: 'ADMIN' } }
  await page.evaluate(async()=>{await (await import('/src/services/authService.js')).authService.me()})
  await drawer.getByRole('button',{name:'恢复本题已保存照片',exact:true}).click()
  await panel.waitFor()
  assert.equal(await text.inputValue(),'2+2=7')
  // Unconfirmed recovery must not become a typed-only checkpoint.
  await page.evaluate(async()=>{
    const store=await import('/src/features/draft/draftStore.js'),r=await store.readPaperCheckpoint('user:agent-test-admin','P30001')
    await store.writePaperCheckpoint('user:agent-test-admin','P30001',{...r,submitted:null,text:'[无法辨认]',editorText:'[无法辨认]'})
  })
  await reloadChat()
  await drawer.getByRole('button',{name:'恢复本题已保存照片',exact:true}).click()
  await panel.waitFor();assert.equal(await text.inputValue(),'[无法辨认]')
  const checkpoint=await page.evaluate(()=>sessionStorage.getItem('mathverse:agent:attempt-checkpoint:v1'))
  assert.doesNotMatch(checkpoint,/无法辨认|image_crop|data:image/)
  assert.equal(await panel.getByRole('button',{name:'确认读法并检查'}).isDisabled(),true)
  await drawer.getByRole('button',{name:'删除本题照片备份',exact:true}).click()
  await drawer.getByText(/本机照片备份已删除/).waitFor()
  assert.equal(await read(),null)
  assert.equal(await panel.count(),1,'disk deletion retains current selected crop')
  assert.equal(await page.evaluate(async()=>{
    const r=await (await import('/src/features/draft/draftStore.js')).readInkCheckpoint('user:agent-test-admin','P30001');return r.sentinel
  }),'separate-ink-record','photo deletion does not affect native/ink backups')
  await page.evaluate(async()=>{await (await import('/src/features/draft/draftStore.js')).deleteInkCheckpoint('user:agent-test-admin','P30001')})
  await reloadChat()
  await drawer.getByRole('button',{name:'恢复本题已保存照片',exact:true}).click()
  await drawer.getByText('本题没有主动保存的照片备份',{exact:true}).waitFor()
  assert.equal(requests.length,count,'only the initial mocked OCR call ran; recovery is local')
  assert.deepEqual(errors,[])
  console.log('PASS paper checkpoint: source-complete opt-in save, refresh/reconfirmation, edited-text versions, corruption/decode rejection, write failures, delete/save cancellation and account isolation')
})().catch((e)=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()})
