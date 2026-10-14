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
      ? { blocks:mode === 'late' ? [{text:'迟到转录不可显示',confidence:.4,alternatives:[],uncertainty:''}] : [{text:'2+2=5',confidence:.4,alternatives:['2+2=6'],uncertainty:'分支顺序'}, {text:'2+2=6',confidence:.3,alternatives:['2+2=7'],uncertainty:'模糊末位数字'}, {text:'[无法辨认]',confidence:.1,alternatives:['划去','保留'],uncertainty:'涂改'}] }
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

  // Raster provides a real image source; replies and user corrections are synthetic fixtures.
  const png=await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=600;c.height=400
    const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,600,400)
    ctx.fillStyle='blue';ctx.font='30px sans-serif';ctx.fillText('2+2=5       2+2=6',50,120)
    ctx.fillText('crossed out',50,240);ctx.fillRect(40,225,210,4)
    return c.toDataURL().split(',')[1]
  })
  await input.getByLabel('选择草稿照片',{exact:true}).setInputFiles({name:'branches.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')})
  await input.locator('.ai-paper-preview').first().waitFor()
  await input.getByRole('checkbox',{name:'我已选择需要识别的区域'}).check()
  await input.getByRole('button',{name:'提交照片选区',exact:true}).click()
  await panel.waitFor()
  const text=panel.getByLabel('手写转录内容',{exact:true})
  const readCheck=panel.getByRole('checkbox',{name:'我已核对原图，关键符号和步骤顺序准确'})
  const consent=panel.getByRole('checkbox',{name:'我同意将此选区发送给上述模型用于识别'})
  await consent.check();await panel.getByRole('button',{name:'识别手写选区',exact:true}).click()
  await panel.getByRole('region',{name:'逐块核对阅读顺序'}).waitFor()
  const blocks=panel.locator('.ai-reading-blocks')
  assert.equal(await text.inputValue(),'2+2=5\n\n2+2=6\n\n[无法辨认]')
  await blocks.getByRole('button',{name:'上移片段 2',exact:true}).click()
  await blocks.getByLabel('片段 2 核对内容',{exact:true}).fill('2+2=7')
  await blocks.getByRole('checkbox',{name:'保留片段 3',exact:true}).uncheck()
  assert.deepEqual(await blocks.locator('.ai-reading-block').evaluateAll(nodes=>nodes.map(n=>n.dataset.blockId)),['block2','block1','block3'])
  assert.match(await text.inputValue(),/无法辨认/,'staged edits do not silently replace manual text')
  await readCheck.check()
  assert.equal(await panel.getByRole('button',{name:'确认读法并检查'}).isDisabled(),true)
  const save=panel.getByRole('button',{name:'保存本题照片备份',exact:true})
  await save.click();await panel.getByText(/已保存本题照片备份；/).waitFor()
  async function record() {return page.evaluate(async()=>{
    const r=await(await import('/src/features/draft/draftStore.js')).readPaperCheckpoint('user:agent-test-admin','P30001')
    return {recognition:r.recognition,text:r.text,submitted:r.submitted}
  })}
  const pending=await record()
  assert.equal(pending.recognition.readingReview.pending,true)
  assert.equal(pending.recognition.blocks[1].text,'2+2=6')
  assert.deepEqual(pending.recognition.blocks[1].alternatives,['2+2=7'])
  const count=requests.length
  page.on('dialog',dialog=>dialog.accept())
  async function recover() {
    await page.reload({waitUntil:'networkidle'})
    await page.getByRole('button',{name:'打开 Mathverse AI 助手'}).click()
    await drawer.getByRole('button',{name:'返回对话',exact:true}).click()
    await drawer.getByRole('button',{name:'恢复本题已保存照片',exact:true}).click()
    await blocks.waitFor()
  }
  await recover()
  assert.equal(requests.length,count)
  assert.deepEqual(await blocks.locator('.ai-reading-block').evaluateAll(nodes=>nodes.map(n=>n.dataset.blockId)),['block2','block1','block3'])
  assert.equal(await blocks.getByLabel('片段 2 核对内容',{exact:true}).inputValue(),'2+2=7')
  assert.equal(await blocks.getByRole('checkbox',{name:'保留片段 3',exact:true}).isChecked(),false)
  await readCheck.check()
  assert.equal(await panel.getByRole('button',{name:'确认读法并检查'}).isDisabled(),true)
  await blocks.getByRole('button',{name:'用逐块核对内容替换下方转录',exact:true}).click()
  assert.equal(await text.inputValue(),'2+2=7\n\n2+2=5')
  assert.equal(await readCheck.isChecked(),false)
  // A supported provider/key is needed by the existing diagnosis UI, even for local arithmetic.
  await panel.getByRole('button',{name:'选择视觉模型 / 填写 Key'}).click()
  await drawer.getByRole('button',{name:'Qwen 手写识别',exact:true}).click()
  await drawer.getByLabel('API Key',{exact:true}).fill('reading-mock-key')
  await drawer.getByRole('button',{name:'返回对话',exact:true}).click()
  assert.equal(await blocks.getByLabel('片段 2 核对内容',{exact:true}).inputValue(),'2+2=7','settings retains edits')
  await readCheck.check();await panel.getByRole('button',{name:'确认读法并检查'}).click()
  await drawer.getByText('已验证的算术问题 · 第 1 步',{exact:true}).last().waitFor()
  await drawer.locator('.ai-assistant-attempt-heading').getByText('已提交第 1 版',{exact:true}).waitFor()
  await blocks.getByLabel('片段 3 核对内容',{exact:true}).fill('学生确认已划去')
  await drawer.getByRole('button',{name:/^检查我的思路/}).click()
  await drawer.getByText(/恢复的照片需先/).waitFor()
  assert.equal(requests.length,count)
  await blocks.getByRole('button',{name:'用逐块核对内容替换下方转录',exact:true}).click()
  await readCheck.check();await panel.getByRole('button',{name:'确认读法并检查'}).click()
  await drawer.locator('.ai-assistant-attempt-heading').getByText('已提交第 2 版',{exact:true}).waitFor()
  await save.click();await panel.getByText(/已保存本题照片备份；/).waitFor()
  const submitted=await record()
  assert.equal(submitted.submitted.version,2)
  assert.equal(submitted.submitted.recognitionStatus,'user_edited_transcription')
  assert.equal(submitted.submitted.recognition.readingReview.items[2].text,'学生确认已划去')
  // New provider avoids the retained-source OCR cache; failure preserves the block plan and applied text.
  await panel.getByRole('button',{name:'选择视觉模型 / 填写 Key'}).click()
  await drawer.getByRole('button',{name:'OpenAI',exact:true}).click()
  await drawer.getByLabel('模型',{exact:true}).fill('gpt-4.1-mini')
  await drawer.getByLabel('API Key',{exact:true}).fill('reading-openai-mock-key')
  await drawer.getByRole('button',{name:'返回对话',exact:true}).click()
  state='failure';await consent.check()
  await panel.getByRole('checkbox',{name:'再次识别时，用新读法替换我修改或手动填写的转录'}).check()
  await panel.getByRole('button',{name:'识别手写选区',exact:true}).click()
  await panel.getByText(/照片识别暂时失败/).waitFor()
  assert.equal(await text.inputValue(),submitted.text)
  assert.equal(await blocks.getByLabel('片段 3 核对内容',{exact:true}).inputValue(),'学生确认已划去')
  state='late';await panel.getByRole('checkbox',{name:'再次识别时，用新读法替换我修改或手动填写的转录'}).check()
  await panel.getByRole('button',{name:'识别手写选区',exact:true}).click()
  while(!release)await delay(20)
  await panel.getByRole('button',{name:'停止识别',exact:true}).click()
  await blocks.getByLabel('片段 1 核对内容',{exact:true}).fill('2+2=9')
  release();await delay(200)
  assert.equal(await blocks.getByLabel('片段 1 核对内容',{exact:true}).inputValue(),'2+2=9')
  assert.doesNotMatch(await panel.textContent(),/迟到转录不可显示/)
  // Manual text is never silently overwritten by a staged plan.
  await blocks.getByRole('button',{name:'保留下方手动转录',exact:true}).click()
  assert.equal(await text.inputValue(),submitted.text)
  await recover()
  assert.equal(await readCheck.isChecked(),false)
  assert.equal(await text.inputValue(),submitted.text)
  assert.equal(await blocks.getByLabel('片段 1 核对内容',{exact:true}).inputValue(),'2+2=5','unsaved later edits do not replace the explicit backup')
  assert.deepEqual(errors,[])
  console.log('PASS block review: original/candidates, explicit order/exclusion/correction, pending recovery, unchanged-text versions, settings, failed and late OCR, manual preservation')
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()})
