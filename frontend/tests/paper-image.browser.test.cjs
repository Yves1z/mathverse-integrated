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
  let state = 'normal', release, identity = { authenticated: true, user: { id: 'agent-test-admin', username: 'Agent regression', role: 'ADMIN' } }
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
  const first=drawer.locator('.ai-assistant-message.is-assistant').first()
  await first.getByText('已验证的算术问题 · 第 1 步',{exact:true}).waitFor().catch(async (failure) => {
    console.error('PHOTO DIAGNOSIS STATE', await drawer.textContent(), errors)
    console.error(await page.evaluate(async()=>{const bridge=await import('/src/features/draft/draftAgentBridge.js');return {artifact:bridge.handwritingRequest.value?.sourceKind,current:bridge.isHandwritingCurrent(bridge.handwritingRequest.value)}}))
    throw failure
  })
  assert.equal(requests.length,1)
  assert.match(await first.textContent(),/第 1 版草稿反馈/)
  const draft=drawer.locator('.ai-assistant-attempt textarea')
  await draft.fill('2+2=4');await drawer.getByRole('button',{name:/^检查我的思路/}).click()
  await drawer.getByText('当前路线可继续。',{exact:true}).waitFor()
  assert.match(await drawer.locator('.ai-assistant-attempt-heading').textContent(),/第 2 版/)
  const saved=await page.evaluate(()=>sessionStorage.getItem('mathverse:agent:attempt-checkpoint:v1'))
  assert.doesNotMatch(saved,/2\+2=4|image_crop|data:image/)
  await input.getByLabel('选区左侧',{exact:true}).fill('21')
  await panel.getByText(/照片或选区已修改/).waitFor()
  await first.getByText(/已过期，仅供回顾/).waitFor()
  await input.getByLabel('选区左侧',{exact:true}).fill('20')
  assert.equal(await panel.getByRole('button',{name:'确认读法并检查'}).isDisabled(),true,'undo cannot revive an old source')
  await input.getByRole('checkbox',{name:'我已选择需要识别的区域'}).check()
  await input.getByRole('button',{name:'提交照片选区',exact:true}).click()
  assert.equal(await consent.isChecked(),false)
  await text.fill('2+2=4');await panel.getByRole('checkbox',{name:'我已核对原图，关键符号和步骤顺序准确'}).check()
  await panel.getByRole('button',{name:'确认读法并检查'}).click()
  await drawer.locator('.ai-assistant-attempt-heading').getByText('已提交第 3 版',{exact:true}).waitFor()
  // Fresh region: failed recognition preserves the original and learner text.
  await input.getByLabel('选区左侧',{exact:true}).fill('22')
  await input.getByRole('checkbox',{name:'我已选择需要识别的区域'}).check()
  await input.getByRole('button',{name:'提交照片选区',exact:true}).click()
  state='failure';await consent.check();await panel.getByRole('button',{name:'识别手写选区',exact:true}).click()
  await panel.getByRole('alert').waitFor()
  await text.fill('2+2=5')
  const replace=panel.getByRole('checkbox',{name:'再次识别时，用新读法替换我修改或手动填写的转录'})
  await replace.check();state='late'
  await panel.getByRole('button',{name:'识别手写选区',exact:true}).click()
  await page.waitForFunction(()=>document.querySelector('.ai-handwriting-review')?.textContent.includes('正在识别手写'))
  for(let i=0;i<100&&!release;i++) await delay(20)
  assert.ok(release)
  await input.getByLabel('选区左侧',{exact:true}).fill('23')
  release();state='normal'
  await panel.getByText(/照片或选区已修改/).waitFor()
  assert.equal(await text.inputValue(),'2+2=5','late reply cannot replace learner text')
  await input.getByRole('button',{name:'清除此照片与选区来源'}).click()
  assert.equal(await panel.count(),0)
  assert.equal(await input.locator('.ai-paper-preview').count(),0)
  assert.equal(await draft.inputValue(),'')
  // Account switching clears photo sources and returns with no resurrected image.
  await page.setViewportSize({width:390,height:844})
  await input.getByLabel('选择草稿照片',{exact:true}).setInputFiles(file)
  await input.getByRole('button',{name:'放大照片并框选'}).click()
  const enlarged=page.getByRole('dialog',{name:'放大照片选区',exact:true})
  const preview=enlarged.locator('.ai-paper-preview')
  await preview.locator('img').evaluate((image)=>image.decode())
  await preview.scrollIntoViewIfNeeded()
  await page.evaluate(()=>new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  const box=await preview.boundingBox()
  if (process.env.PAPER_SCREENSHOT) await page.screenshot({path:process.env.PAPER_SCREENSHOT})
  await page.mouse.move(box.x+box.width*.2,box.y+box.height*.2)
  await page.mouse.down()
  await page.mouse.move(box.x+box.width*.6,box.y+box.height*.5,{steps:8})
  await page.mouse.up()
  await enlarged.getByRole('button',{name:'返回照片设置'}).click()
  assert.ok(Math.abs(Number(await input.getByLabel('选区左侧',{exact:true}).inputValue())-20)<1,
    `pointer selection on mobile viewport: ${JSON.stringify(box)}, x=${await input.getByLabel('选区左侧',{exact:true}).inputValue()}`)
  assert.ok(Math.abs(Number(await input.getByLabel('选区宽度',{exact:true}).inputValue())-40)<1)
  await input.getByRole('checkbox',{name:'我已选择需要识别的区域'}).check()
  await input.getByRole('button',{name:'提交照片选区',exact:true}).click()
  identity={authenticated:true,user:{id:'paper-other',role:'ADMIN'}}
  await page.evaluate(async()=>{await (await import('/src/services/authService.js')).authService.me()})
  assert.equal(await panel.count(),0)
  assert.equal(await input.locator('.ai-paper-preview').count(),0)
  const count=requests.length
  await page.reload({waitUntil:'networkidle'})
  assert.equal(await page.locator('.ai-handwriting-review').count(),0)
  assert.equal(requests.length,count,'refresh never resumes recognition')
  assert.deepEqual(errors,[])
  console.log('PASS paper image: crop-only transmission, original provenance, consent/correction, versioning, failures, late replies, undo expiry, clearing and account/refresh isolation')
})().catch((e)=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()})
