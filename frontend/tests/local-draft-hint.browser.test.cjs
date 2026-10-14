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
      : request.taskType === 'assistant-hint' ? (mode === 'leak' ? '答案为 4' : mode === 'late' ? '迟到局部提示不可显示' : '先检查选中步骤需要哪些条件。') : request.taskType === 'assistant-solution' ? '这是用户明确请求的完整解答。' : { routeStatus:'valid_but_incomplete', firstIssueStep:null, feedback:'当前路线可继续。',nextQuestion:'' }
    try { await route.fulfill({json:{content:typeof value === 'string' ? value : JSON.stringify(value),model:request.model}}) } catch {}
  })
  await page.goto(`${origin}/problems/P30001`, {waitUntil:'networkidle'})
  await page.getByRole('button',{name:'打开 Mathverse AI 助手'}).click()
  const drawer = page.getByRole('dialog',{name:'Mathverse AI 学习助手'})
  await drawer.getByRole('button',{name:'Qwen 手写识别',exact:true}).click()
  await drawer.getByLabel('API Key',{exact:true}).fill('paper-mock-key')
  await drawer.getByRole('button',{name:'返回对话',exact:true}).click()



  const draft=drawer.locator('.ai-assistant-attempt textarea')
  const raw='2+2=5\n\n设 x>0\n\n令 t=x+1\n\n研究 t 的范围\n\n后续步骤秘密'
  await draft.fill(raw)
  await drawer.getByRole('button',{name:/^检查我的思路/}).click()
  await drawer.getByText('已验证的算术问题 · 第 1 步',{exact:true}).waitFor()
  const local=drawer.getByRole('region',{name:'草稿局部提示',exact:true})
  const step=local.getByLabel('卡住的草稿步骤',{exact:true})
  const obstacle=local.getByLabel('具体卡点',{exact:true})
  const premise=local.getByLabel('补入较早前提',{exact:true})
  const hint=local.getByRole('button',{name:'只提示选中的草稿步骤',exact:true})
  await hint.click();await drawer.getByText(/草稿步骤或版本已变化/).waitFor()
  assert.equal(requests.length,0)
  await step.selectOption({index:4});await obstacle.fill('不清楚范围条件')
  await hint.click();await drawer.getByText('第 0 级提示',{exact:true}).waitFor()
  const hints=()=>requests.filter(r=>r.taskType==='assistant-hint')
  const content=()=>hints().at(-1).messages.at(-1).content
  assert.match(content(),/本轮焦点：草稿第 4 步/);assert.match(content(),/不清楚范围条件/)
  assert.match(content(),/设 x>0/);assert.match(content(),/令 t=x\+1/);assert.match(content(),/研究 t 的范围/)
  assert.doesNotMatch(content(),/2\+2=5|后续步骤秘密|参考答案秘密|参考解析秘密/)
  const message=()=>drawer.locator('.ai-assistant-message.is-assistant').last()
  await message().getByRole('button',{name:'再提示一点',exact:true}).click()
  await drawer.getByText('第 1 级提示',{exact:true}).waitFor()
  assert.match(content(),/草稿第 4 步/);assert.match(content(),/不清楚范围条件/)
  state='failure';await hint.click();await drawer.getByText(/照片识别暂时失败/).waitFor()
  state='normal';await drawer.locator('.ai-assistant-message.is-error').last().getByRole('button',{name:'重试',exact:true}).click()
  await drawer.getByText('第 2 级提示',{exact:true}).waitFor()
  assert.match(content(),/草稿第 4 步/);assert.match(content(),/不清楚范围条件/)
  // A -> B -> A changes target revision even if visible values return to the old target.
  const oldHint=message()
  state='late';await hint.click();while(!release)await delay(20)
  await step.selectOption({index:2});await step.selectOption({index:4})
  release();await delay(200)
  assert.doesNotMatch(await drawer.textContent(),/迟到局部提示不可显示/)
  assert.match(await oldHint.textContent(),/已过期/)
  state='normal';await hint.click();await drawer.getByText('第 3 级提示',{exact:true}).waitFor()
  assert.match(content(),/第 3 级/,'changing focus does not reset already shown help')
  // Explicit step language uses the same selection, request and guard.
  await drawer.getByPlaceholder('向 AI 提问…').fill('草稿第2步给提示：这一步需要什么条件')
  await drawer.getByRole('button',{name:'发送',exact:true}).click()
  await drawer.getByText('第 4 级提示',{exact:true}).waitFor()
  assert.match(content(),/本轮焦点：草稿第 2 步/);assert.match(content(),/这一步需要什么条件/)
  assert.match(content(),/2\+2=5/);assert.doesNotMatch(content(),/令 t=x\+1|研究 t 的范围|后续步骤秘密/)
  const before=requests.length
  await draft.fill('2+2=7\n\n设 x>0\n\n令 t=x+1\n\n研究 t 的范围\n\n后续步骤秘密')
  await hint.click();await drawer.getByText(/草稿已有未提交修改/).waitFor()
  assert.equal(requests.length,before)
  await drawer.getByRole('button',{name:/^检查我的思路/}).click()
  await drawer.locator('.ai-assistant-attempt-heading').getByText('已提交第 2 版',{exact:true}).waitFor()
  assert.equal(await step.inputValue(),'','new submission requires selecting its new step IDs')
  await hint.click();assert.equal(requests.length,before)
  await step.selectOption({index:3});await obstacle.fill('这一行怎么推进')
  await hint.click();await drawer.getByText('第 4 级提示',{exact:true}).last().waitFor()
  // Level 4 also belongs to the previous reply. Wait for this new hint to
  // finish and enter the reveal record before changing the draft target.
  await drawer.getByText(/当前焦点已看 6 条提示/).waitFor()
  assert.match(content(),/第 2 版/);assert.match(content(),/草稿第 3 步/)
  assert.doesNotMatch(content(),/研究 t 的范围|后续步骤秘密/)
  // Only the learner's chosen distant step may expand the local window.
  await step.selectOption({index:4});await obstacle.fill('跨步条件怎么用')
  assert.equal(await premise.locator('option').count(),2,'only step 1 is outside the three-step window')
  await premise.selectOption({index:1})
  let messageCount=await drawer.locator('.ai-assistant-message.is-assistant').count()
  await hint.click()
  await page.waitForFunction(n=>document.querySelectorAll('.ai-assistant-message.is-assistant').length>n,messageCount)
  await drawer.getByText(/当前焦点已看 7 条提示/).waitFor()
  assert.match(content(),/学生选入的较早前提（草稿原文，尚未验证）· 第 1 步：2\+2=7/)
  assert.match(content(),/第 2 步：设 x>0/);assert.match(content(),/第 3 步：令 t=x\+1/)
  assert.match(content(),/第 4 步：研究 t 的范围/)
  assert.doesNotMatch(content(),/后续步骤秘密|参考答案秘密|参考解析秘密/)
  // The corresponding sentence uses the same target and must not treat the premise as a new focus.
  messageCount=await drawer.locator('.ai-assistant-message.is-assistant').count()
  await drawer.getByPlaceholder('向 AI 提问…').fill('把草稿第1步作为前提，给草稿第4步提示：跨步条件仍不清楚')
  await drawer.getByRole('button',{name:'发送',exact:true}).click()
  await page.waitForFunction(n=>document.querySelectorAll('.ai-assistant-message.is-assistant').length>n,messageCount)
  await drawer.getByText(/当前焦点已看 8 条提示/).waitFor()
  assert.match(content(),/本轮焦点：草稿第 4 步/);assert.match(content(),/跨步条件仍不清楚/)
  assert.match(content(),/学生选入的较早前提/)
  // Switching a premise away and back cannot revive a delayed answer.
  state='late';release=undefined;await hint.click();while(!release)await delay(20)
  await premise.selectOption('');await premise.selectOption({index:1})
  release();await delay(200);state='normal'
  assert.doesNotMatch(await drawer.textContent(),/迟到局部提示不可显示/)
  messageCount=await drawer.locator('.ai-assistant-message.is-assistant').count()
  state='leak';await hint.click()
  await page.waitForFunction(n=>document.querySelectorAll('.ai-assistant-message.is-assistant').length>n,messageCount)
  assert.match(await message().textContent(),/可能提前泄露答案/)
  assert.doesNotMatch(await drawer.textContent(),/答案为 4/)
  state='normal'
  const count=requests.length
  await drawer.getByRole('checkbox',{name:'随请求发送',exact:true}).uncheck()
  await hint.click();await drawer.getByText(/请先开启“随请求发送”/).waitFor()
  assert.equal(requests.length,count)
  await drawer.getByRole('checkbox',{name:'随请求发送',exact:true}).check()
  // Refresh restores the draft/reveal record, never a stale selected-step action or a provider run.
  await page.reload({waitUntil:'networkidle'})
  await page.getByRole('button',{name:'打开 Mathverse AI 助手'}).click()
  await drawer.getByRole('button',{name:'返回对话',exact:true}).click()
  await local.waitFor()
  assert.equal(await step.inputValue(),'')
  assert.equal(await obstacle.inputValue(),'')
  assert.equal(await premise.inputValue(),'')
  assert.equal(requests.length,count)
  assert.match(await drawer.textContent(),/已看 8 条提示/)
  assert.deepEqual(errors,[])
  console.log('PASS local draft hints: explicit distant premise, bounded context, language/continuation/retry target, A-B-A cancellation, answer wording guard, privacy and refresh continuity')
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()})
