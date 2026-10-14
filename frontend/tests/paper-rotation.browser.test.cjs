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
  let uncertainLabel = '末尾数字', state = 'normal', release, identity = { authenticated: true, user: { id: 'agent-test-admin', username: 'Agent regression', role: 'ADMIN' } }
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/api/**', (route) => route.fulfill({ json: route.request().url().includes('/api/v1/problems/P30001')
    ? { id: 'P30001', title: '照片选区检查', type: 'solution', content: '检查自己的计算。', answer: '参考答案秘密', solution: '参考解析秘密', tags:['代数'] }
    : identity }))
  await page.route('**/__mathverse_similarity_proxy', async (route) => {
    const request = route.request().postDataJSON(); requests.push(request)
    const mode = state
    if (mode === 'late') await new Promise((resolve) => { release = resolve })
    if (mode === 'failure') return route.fulfill({ status:503, json:{error:{message:'照片识别暂时失败'}} })
    const value = request.taskType === 'assistant-handwriting-recognition'
      ? { blocks:[{text:mode === 'late' ? '迟到转录不可显示' : '[无法辨认]', confidence:.4, alternatives:['2+2=5','2+2=6'],uncertainty:uncertainLabel}] }
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

  // Synthetic pixel fixture, not an OCR accuracy benchmark.
  const png = await page.evaluate(() => {
    const c=document.createElement('canvas');c.width=1000;c.height=600
    const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1000,600)
    ctx.fillStyle='red';ctx.fillRect(0,0,100,600)
    ctx.fillStyle='blue';ctx.fillRect(200,120,200,180)
    ctx.fillStyle='green';ctx.fillRect(400,120,200,180)
    return c.toDataURL().split(',')[1]
  })
  const file={name:'rotation.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')}
  await input.getByLabel('选择草稿照片',{exact:true}).setInputFiles(file)
  await input.locator('.ai-paper-preview').first().waitFor()
  async function choose(percent) {
    // Shrink first so intermediate numeric bounds cannot accidentally become valid stale input.
    for(const [label,value] of [['选区宽度',1],['选区高度',1],['选区左侧',percent.x],['选区顶部',percent.y],['选区宽度',percent.width],['选区高度',percent.height]])
      await input.getByLabel(label,{exact:true}).fill(String(value))
    assert.equal(await input.getByRole('button',{name:'提交照片选区',exact:true}).isDisabled(),true)
    await input.getByRole('checkbox',{name:'我已选择需要识别的区域'}).check()
    await input.getByRole('button',{name:'提交照片选区',exact:true}).click()
    await panel.waitFor()
    await page.waitForFunction(async()=>!!(await import('/src/features/draft/draftAgentBridge.js')).handwritingRequest.value)
  }
  async function inspect() {
    return page.evaluate(async()=>{
      const {handwritingRequest,isHandwritingCurrent}=await import('/src/features/draft/draftAgentBridge.js')
      const a=handwritingRequest.value
      const image=new Image();await new Promise(r=>{image.onload=r;image.src=a.dataUrl})
      const c=document.createElement('canvas');c.width=image.width;c.height=image.height
      const ctx=c.getContext('2d');ctx.drawImage(image,0,0)
      const p=ctx.getImageData(0,0,c.width,c.height).data
      let red=0;for(let i=0;i<p.length;i+=4)if(p[i]>200&&p[i+1]<80&&p[i+2]<80)red++
      const color=(x,y)=>Array.from(ctx.getImageData(x,y,1,1).data).slice(0,3)
      return {id:a.id,rotation:a.rotation,crop:a.crop,width:a.width,height:a.height,hash:a.originalHash,
        size:a.originalBlob.size,current:isHandwritingCurrent(a),red,
        colors:[color(c.width/4|0,c.height/4|0),color(c.width*3/4|0,c.height/4|0),color(c.width/4|0,c.height*3/4|0)],dataUrl:a.dataUrl}
    })
  }
  const originalCrop={x:200,y:120,width:400,height:180,originalWidth:1000,originalHeight:600}
  const baselinePercent={x:20,y:20,width:40,height:30}
  await choose(baselinePercent)
  const original=await inspect()
  const consent=panel.getByRole('checkbox',{name:'我同意将此选区发送给上述模型用于识别'})
  const text=panel.getByLabel('手写转录内容',{exact:true})
  const readCheck=panel.getByRole('checkbox',{name:'我已核对原图，关键符号和步骤顺序准确'})
  await consent.check();await panel.getByRole('button',{name:'识别手写选区',exact:true}).click()
  await panel.getByText(/待核对：末尾数字/).waitFor()
  await text.fill('2+2=5');await readCheck.check()
  await panel.getByRole('button',{name:'确认读法并检查'}).click()
  await drawer.getByText('已验证的算术问题 · 第 1 步',{exact:true}).last().waitFor()
  const colors=[[[0,0,255],[0,128,0]],[[0,128,0],[0,0,255]],[[0,128,0],[0,0,255]],[[0,0,255],[0,128,0]]]
  for (const [i,rotation] of [90,180,270,0].entries()) {
    await input.getByRole('button',{name:'向右旋转 90°',exact:true}).click()
    assert.equal((await inspect()).current,false,'changing direction expires the source')
    assert.equal(await input.getByRole('checkbox',{name:'我已选择需要识别的区域'}).isChecked(),false)
    const percent=await page.evaluate(async({crop,rotation})=>(await import('/src/features/ai-assistant/paperImage.js')).paperCropToPercent(crop,rotation),{crop:originalCrop,rotation})
    await choose(percent)
    const a=await inspect()
    assert.deepEqual(a.crop,originalCrop)
    assert.equal(a.rotation,rotation);assert.equal(a.hash,original.hash);assert.equal(a.size,file.buffer.length)
    assert.equal(a.red,0);assert.equal(a.width,rotation%180?180:400);assert.equal(a.height,rotation%180?400:180)
    // With 90/270 turns the split runs top/bottom, otherwise left/right.
    assert.deepEqual(a.colors[0],colors[i][0]);assert.deepEqual(a.colors[rotation%180?2:1],colors[i][1])
    assert.equal(await consent.isChecked(),false);assert.equal(await readCheck.isChecked(),false)
    assert.equal(await panel.getByRole('button',{name:'确认读法并检查'}).isDisabled(),true)
  }
  // Undoing orientation does not revive the original OCR or math feedback.
  assert.notEqual((await inspect()).id,original.id)
  assert.equal(requests.length,1)
  // Late OCR after rotation cannot overwrite corrected student text.
  state='late';await consent.check();await panel.getByRole('button',{name:'识别手写选区',exact:true}).click()
  while(!release)await delay(20)
  await input.getByRole('button',{name:'向左旋转 90°',exact:true}).click()
  release();await delay(200)
  assert.doesNotMatch(await drawer.textContent(),/迟到转录不可显示/)
  state='normal'
  const percent=await page.evaluate(async(crop)=>(await import('/src/features/ai-assistant/paperImage.js')).paperCropToPercent(crop,270),originalCrop)
  await choose(percent)
  // Failures are injected replies: blur, crossing out and branches remain reading uncertainty.
  for(const uncertainty of ['模糊的负号','涂改处保留还是删除','左右分支的阅读顺序']) {
    uncertainLabel=uncertainty
    await choose(percent)
    await consent.check();await panel.getByRole('button',{name:'识别手写选区',exact:true}).click()
    await panel.getByText(`待核对：${uncertainty}`,{exact:false}).waitFor()
    assert.equal(await text.inputValue(),'[无法辨认]')
    assert.equal(await panel.getByRole('button',{name:'确认读法并检查'}).isDisabled(),true)
    assert.doesNotMatch(await panel.textContent(),/已验证的算术问题/)
  }
  await text.fill('2+2=5');await readCheck.check()
  await panel.getByRole('button',{name:'确认读法并检查'}).click()
  await drawer.getByText('已验证的算术问题 · 第 1 步',{exact:true}).last().waitFor()
  await panel.getByRole('button',{name:'保存本题照片备份',exact:true}).click()
  await panel.getByText(/已保存本题照片备份；/).waitFor()
  const count=requests.length
  page.on('dialog',dialog=>dialog.accept())
  await page.reload({waitUntil:'networkidle'})
  await page.getByRole('button',{name:'打开 Mathverse AI 助手'}).click()
  await drawer.getByRole('button',{name:'返回对话',exact:true}).click()
  await drawer.getByRole('button',{name:'恢复本题已保存照片',exact:true}).click()
  await panel.waitFor()
  await input.getByText(/当前方向：顺时针 270°/).waitFor()
  const recovered=await inspect()
  assert.equal(recovered.rotation,270);assert.equal(recovered.hash,original.hash)
  assert.deepEqual(recovered.crop,originalCrop);assert.equal(recovered.width,180);assert.equal(recovered.height,400)
  assert.equal(await readCheck.isChecked(),false)
  await panel.getByRole('button',{name:'选择视觉模型 / 填写 Key'}).click()
  await drawer.getByRole('button',{name:'Qwen 手写识别',exact:true}).click()
  await drawer.getByLabel('API Key',{exact:true}).fill('rotation-mock-key')
  await drawer.getByRole('button',{name:'返回对话',exact:true}).click()
  assert.equal(await consent.isChecked(),false)
  assert.equal(requests.length,count,'restoration performs no provider call')
  assert.deepEqual(errors,[])
  console.log('PASS photo orientation: original pixels/hash, all quarter turns, excluded pixels, expired OCR and undo, explicit oriented recovery')
})().catch((e)=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()})
