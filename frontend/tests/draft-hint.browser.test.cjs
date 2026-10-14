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
      ? { blocks:mode === 'late' ? [{text:'迟到转录不可显示',confidence:.4,alternatives:[],uncertainty:''}] : [{text:'2+2=5',confidence:.4,alternatives:['2+2=6'],uncertainty:'分支顺序'}, {text:'2+2=6',confidence:.3,alternatives:['2+2=7'],uncertainty:'模糊末位数字'}, {text:'[无法辨认]',confidence:.1,alternatives:['划去','保留'],uncertainty:'排除候选秘密'}] }
      : request.taskType === 'assistant-hint' ? (mode === 'leak' ? '最终答案：4' : mode === 'late' ? '迟到草稿提示不可显示' : '先检查等号两边表示的量是否一致。') : request.taskType === 'assistant-solution' ? '这是用户明确请求的完整解答。' : { routeStatus:'valid_but_incomplete', firstIssueStep:null, feedback:'当前路线可继续。',nextQuestion:'' }
    try { await route.fulfill({json:{content:typeof value === 'string' ? value : JSON.stringify(value),model:request.model}}) } catch {}
  })
  await page.goto(`${origin}/problems/P30001`, {waitUntil:'networkidle'})
  await page.getByRole('button',{name:'打开 Mathverse AI 助手'}).click()
  const drawer = page.getByRole('dialog',{name:'Mathverse AI 学习助手'})
  await drawer.getByRole('button',{name:'Qwen 手写识别',exact:true}).click()
  await drawer.getByLabel('API Key',{exact:true}).fill('paper-mock-key')
  await drawer.getByRole('button',{name:'返回对话',exact:true}).click()
  const input = drawer.locator('.ai-paper-input'), panel = drawer.locator('.ai-handwriting-review')


  const hintButton=drawer.getByRole('button',{name:'基于这版草稿给最小提示',exact:true})
  await hintButton.click();await drawer.getByText(/请先提交并检查草稿/).waitFor()
  assert.equal(requests.length,0)
  const png=await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=600;c.height=400
    const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,600,400)
    ctx.fillStyle='blue';ctx.font='30px sans-serif';ctx.fillText('2+2=5',50,120)
    return c.toDataURL().split(',')[1]
  })
  await input.getByLabel('选择草稿照片',{exact:true}).setInputFiles({name:'hint.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')})
  await input.locator('.ai-paper-preview').first().waitFor()
  await input.getByRole('checkbox',{name:'我已选择需要识别的区域'}).check()
  await input.getByRole('button',{name:'提交照片选区',exact:true}).click()
  await panel.waitFor()
  await panel.getByRole('checkbox',{name:'我同意将此选区发送给上述模型用于识别'}).check()
  await panel.getByRole('button',{name:'识别手写选区',exact:true}).click()
  await panel.locator('.ai-reading-blocks').waitFor()
  await panel.getByRole('checkbox',{name:'保留片段 3',exact:true}).uncheck()
  await hintButton.click();assert.equal(requests.length,1)
  await panel.getByRole('button',{name:'用逐块核对内容替换下方转录'}).click()
  const text=panel.getByLabel('手写转录内容',{exact:true})
  const readCheck=panel.getByRole('checkbox',{name:'我已核对原图，关键符号和步骤顺序准确'})
  await readCheck.check();await panel.getByRole('button',{name:'确认读法并检查'}).click()
  await drawer.getByText('已验证的算术问题 · 第 1 步',{exact:true}).waitFor()
  // An unrelated selected reference must not enter an explicitly targeted draft hint.
  await page.evaluate(async()=>{(await import('/src/features/ai-assistant/assistantContext.js')).setAssistantFocus({type:'solution_step',problemId:'P30001',stepId:'reference',stepNumber:1,selectedText:'不相关解析秘密',paragraphText:'不相关解析秘密',sourceType:'official'})})
  await hintButton.click()
  await drawer.getByText('第 0 级提示',{exact:true}).waitFor()
  const hintRequests=()=>requests.filter(r=>r.taskType==='assistant-hint')
  assert.equal(hintRequests().length,1)
  const prompt=hintRequests()[0].messages.at(-1).content
  assert.match(prompt,/2\+2=5/);assert.match(prompt,/第 1 版/)
  assert.doesNotMatch(prompt,/参考答案秘密|参考解析秘密|不相关解析秘密|排除候选秘密|\[无法辨认\]|data:image/)
  assert.match(await drawer.textContent(),/尚未经完整验证/)
  const message=()=>drawer.locator('.ai-assistant-message.is-assistant').last()
  await message().getByRole('button',{name:'再提示一点',exact:true}).click()
  await drawer.getByText('第 1 级提示',{exact:true}).waitFor()
  assert.match(hintRequests()[1].messages.at(-1).content,/此前已展示的提示/)
  state='leak';await message().getByRole('button',{name:'再提示一点',exact:true}).click()
  await drawer.getByText(/模型回复可能提前泄露答案/).waitFor()
  assert.doesNotMatch(await drawer.textContent(),/最终答案：4/)
  state='normal';await message().getByRole('button',{name:'重新请求草稿提示',exact:true}).click()
  await drawer.getByText('第 2 级提示',{exact:true}).waitFor()
  assert.match(hintRequests().at(-1).messages.at(-1).content,/第 2 级/,'hidden output does not consume reveal level')
  const draft=drawer.locator('.ai-assistant-attempt textarea')
  state='late';await hintButton.click()
  while(!release)await delay(20)
  await draft.fill('2+2=9')
  release();await delay(200)
  assert.doesNotMatch(await drawer.textContent(),/迟到草稿提示不可显示/)
  const count=requests.length
  await hintButton.click();await drawer.getByText(/草稿已有未提交修改/).waitFor()
  assert.equal(requests.length,count)
  // Reading edits also expire hint targets even when the lower editor is unchanged.
  await draft.fill('2+2=5\n\n2+2=6')
  await text.fill('2+2=7')
  await hintButton.click();await drawer.getByText(/图片读法或选区尚未重新确认/).waitFor()
  assert.equal(requests.length,count)
  state='normal';await readCheck.check();await panel.getByRole('button',{name:'确认读法并检查'}).click()
  await drawer.locator('.ai-assistant-attempt-heading').getByText('已提交第 2 版',{exact:true}).waitFor()
  state='failure';await hintButton.click()
  await drawer.getByText(/照片识别暂时失败/).waitFor()
  const error=drawer.locator('.ai-assistant-message.is-error').last()
  state='normal';await error.getByRole('button',{name:'重试',exact:true}).click()
  await drawer.getByText('第 3 级提示',{exact:true}).waitFor()
  assert.match(hintRequests().at(-1).messages.at(-1).content,/第 2 版/)
  assert.match(hintRequests().at(-1).messages.at(-1).content,/2\+2=7/)
  assert.equal(await text.inputValue(),'2+2=7')
  // The explicit natural-language entry shares the same draft target and reveal state.
  const composer=drawer.getByPlaceholder('向 AI 提问…')
  await composer.fill('基于这版草稿给最小提示')
  await drawer.getByRole('button',{name:'发送',exact:true}).click()
  await drawer.getByText('第 4 级提示',{exact:true}).waitFor()
  assert.match(hintRequests().at(-1).messages.at(-1).content,/第 2 版/)
  await panel.getByRole('button',{name:'保存本题照片备份',exact:true}).click()
  await panel.getByText(/已保存本题照片备份；/).waitFor()
  page.on('dialog',d=>d.accept())
  const calls=requests.length
  await page.reload({waitUntil:'networkidle'})
  await page.getByRole('button',{name:'打开 Mathverse AI 助手'}).click()
  await drawer.getByRole('button',{name:'返回对话',exact:true}).click()
  await drawer.getByRole('button',{name:'恢复本题已保存照片',exact:true}).click()
  await panel.waitFor()
  await hintButton.click();await drawer.getByText(/图片读法或选区尚未重新确认/).waitFor()
  assert.equal(requests.length,calls,'recovery and unconfirmed draft hints never call a provider')
  // Reveals survive refresh and current-source edits never erase them.
  assert.match(await drawer.textContent(),/已看 5 条提示/)
  assert.deepEqual(errors,[])
  console.log('PASS draft hints: confirmed crop-only text, excluded/reference privacy, progressive guarded hints, current-version binding, stale cancellation, failure/retry, language entry, recovery/reveal continuity')
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()})
