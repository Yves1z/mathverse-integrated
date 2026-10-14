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
  let hintReply = '先只核对真数需要满足什么条件。'
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', route => route.fulfill({ json: route.request().url().includes('/api/v1/problems/P40001')
    ? { id: 'P40001', title: '差值符号', type: 'solution',
      content: '已知实数 a>b>0，研究 ln((a-b)/b) 是否有定义。',
      answer: '参考答案秘密', solution: '参考解析秘密', tags: ['代数'] }
    : { authenticated: true, user: { id: 'agent-test-admin', username: 'Agent regression', role: 'ADMIN' } } }))
  await page.route('**/__mathverse_similarity_proxy', route => {
    const request = route.request().postDataJSON(); requests.push(request)
    const value = request.taskType === 'assistant-hint' ? hintReply
      : { routeStatus: 'valid_but_incomplete', firstIssueStep: null,
        feedback: '请继续核对条件。', nextQuestion: '' }
    return route.fulfill({ json: { content: typeof value === 'string' ? value : JSON.stringify(value), model: request.model } })
  })
  await page.goto(`${origin}/problems/P40001`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '打开 Mathverse AI 助手' }).click()
  const drawer = page.getByRole('dialog', { name: 'Mathverse AI 学习助手' })
  await drawer.getByRole('button', { name: 'Qwen 手写识别', exact: true }).click()
  await drawer.getByLabel('API Key', { exact: true }).fill('sign-mock-key')
  await drawer.getByRole('button', { name: '返回对话', exact: true }).click()
  const draft = drawer.locator('.ai-assistant-attempt textarea')
  const lines = ['由 a>b>0 可知 a-b<0。', '设 u=(a-b)/b。', '把表达式写为 ln u。',
    '研究 u 的范围。', '判断 ln u 的真数条件。', '后续答案秘密。']
  await draft.fill(lines.join('\n\n'))
  await drawer.getByRole('button', { name: /^检查我的思路/ }).click()
  await drawer.locator('.ai-assistant-attempt-heading').getByText('已提交第 1 版', { exact: true }).waitFor()
  await page.waitForFunction(() => document.querySelectorAll('.ai-assistant-message.is-assistant').length > 0)
  const local = drawer.getByRole('region', { name: '草稿局部提示', exact: true })
  const step = local.getByLabel('卡住的草稿步骤', { exact: true })
  const premise = local.getByLabel('补入较早前提', { exact: true })
  const hint = local.getByRole('button', { name: '只提示选中的草稿步骤', exact: true })
  await step.selectOption({ index: 5 }); await premise.selectOption({ index: 1 })
  const hintCount = () => requests.filter(request => request.taskType === 'assistant-hint').length
  await hint.click()
  await drawer.getByText(/与题目条件.*冲突/).waitFor()
  assert.equal(hintCount(), 0, 'the contradictory selected premise must not reach the provider')
  assert.match(await drawer.textContent(), /已核验 · 差值符号/)
  assert.match(await drawer.textContent(), /只核对这一条差值符号，未验证整步/)
  // A sentence targeting the same step goes through the same gate.
  await drawer.getByPlaceholder('向 AI 提问…').fill('把草稿第1步作为前提，给草稿第5步提示')
  await drawer.getByRole('button', { name: '发送', exact: true }).click()
  await drawer.getByText(/与题目条件.*冲突/).last().waitFor()
  assert.equal(hintCount(), 0)
  lines[0] = '由 a>b>0 可知 a−b＞0。'
  await draft.fill(lines.join('\n\n'))
  const previousReplies = await drawer.locator('.ai-assistant-message.is-assistant').count()
  await drawer.getByRole('button', { name: /^检查我的思路/ }).click()
  await drawer.locator('.ai-assistant-attempt-heading').getByText('已提交第 2 版', { exact: true }).waitFor()
  await page.waitForFunction(n => document.querySelectorAll('.ai-assistant-message.is-assistant').length > n, previousReplies)
  assert.equal(await step.inputValue(), '', 'a new attempt version requires fresh step selection')
  await step.selectOption({ index: 5 }); await premise.selectOption({ index: 1 })
  await hint.click()
  await drawer.getByText('第 0 级提示', { exact: true }).waitFor()
  assert.equal(hintCount(), 1)
  const sent = requests.find(request => request.taskType === 'assistant-hint').messages.at(-1).content
  assert.match(sent, /第 1 步：由 a>b>0 可知 a−b＞0/)
  assert.doesNotMatch(sent, /后续答案秘密|参考答案秘密|参考解析秘密/)
  // Unsupported transcription stays unknown; a fabricated endorsement must not become a revealed hint.
  lines[0] = '由 a>b>0 可知 a–b<0。'
  await draft.fill(lines.join('\n\n'))
  const repliesBefore = await drawer.locator('.ai-assistant-message.is-assistant').count()
  await drawer.getByRole('button', { name: /^检查我的思路/ }).click()
  await drawer.locator('.ai-assistant-attempt-heading').getByText('已提交第 3 版', { exact: true }).waitFor()
  await page.waitForFunction(n => document.querySelectorAll('.ai-assistant-message.is-assistant').length > n, repliesBefore)
  await step.selectOption({ index: 5 }); await premise.selectOption({ index: 1 })
  hintReply = '先保持你的路线。\n\n**第 1 步完全正确**，可以直接沿用。\n接下来只观察真数条件。'
  const previousHintCalls = hintCount()
  await hint.click()
  await drawer.getByText(/模型直接肯定了学生选入的第 1 步/).waitFor()
  assert.equal(hintCount(), previousHintCalls + 1, 'the guard acts on a received mock provider reply')
  assert.doesNotMatch(await drawer.textContent(), /第 1 步完全正确|先保持你的路线/)
  assert.equal(await drawer.getByText('第 1 级提示', { exact: true }).count(), 0)
  await drawer.getByRole('button', { name: '核对这一步', exact: true }).click()
  await page.waitForFunction(() => document.activeElement === document.querySelector('.ai-assistant-attempt textarea'))
  hintReply = '第一步成立的条件是什么？先核对题设。'
  await hint.click()
  await drawer.getByText('第 1 级提示', { exact: true }).waitFor()
  assert.match(await drawer.textContent(), /第一步成立的条件是什么/)
  assert.equal(hintCount(), previousHintCalls + 2)
  // A cautious question must not disable the guard on the next formatted assertion.
  hintReply = '先检查范围。\n1. 第 1 步完全正确，可以沿用。\n2. 接下来观察条件。'
  await hint.click()
  await drawer.getByText(/模型直接肯定了学生选入的第 1 步/).nth(1).waitFor()
  assert.doesNotMatch(await drawer.textContent(), /先检查范围|第 1 步完全正确/)
  assert.equal(await drawer.getByText('第 2 级提示', { exact: true }).count(), 0)
  assert.equal(hintCount(), previousHintCalls + 3)
  hintReply = '你写的是“第一步完全正确。这个前提成立。”，请先核对这句话。'
  await hint.click()
  await drawer.getByText('第 2 级提示', { exact: true }).waitFor()
  assert.match(await drawer.textContent(), /你写的是“第一步完全正确/)
  assert.equal(hintCount(), previousHintCalls + 4)
  assert.deepEqual(errors, [])
  console.log('PASS premise sign: conflict/correction, formatted endorsements hidden without reveal, condition questions and quoted review proceed')
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => { await browser?.close(); server?.kill() })
