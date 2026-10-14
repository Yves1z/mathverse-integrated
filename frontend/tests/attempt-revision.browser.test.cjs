const { browserExecutable, getTestPort } = require('./browser-support.cjs')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const assert = require('node:assert/strict')
const path = require('node:path')
const { chromium } = require('playwright')

let browser
let server

;(async () => {
  const port = await getTestPort()
  const origin = `http://127.0.0.1:${port}`
  const frontend = path.resolve(__dirname, '..')
  const requests = []
  let providerState = 'normal'
  server = spawn(process.execPath, [path.join(frontend, 'node_modules/vite/bin/vite.js'),
    '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: frontend, windowsHide: true, stdio: 'inherit' })
  let ready = false
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try { if ((await fetch(origin)).ok) { ready = true; break } } catch { /* wait for Vite */ }
    await delay(100)
  }
  assert.ok(ready, 'Vite must start before running the browser journey')
  browser = await chromium.launch({ executablePath: browserExecutable, headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route('**/api/v1/problems/P30001', (route) => route.fulfill({ json: {
    id: 'P30001', title: '草稿修改与重检', type: 'solution', typeLabel: '解答题',
    content: '已知 x = 2，求 x + 1。', tags: ['代数'], answer: '参考答案秘密', solution: '参考解析秘密',
  } }))
  await page.route('**/api/**', (route) => route.request().url().includes('/api/v1/problems/P30001')
    ? route.fallback() : route.fulfill({ json: { authenticated: true, user: { id: 'agent-test-admin', username: 'Agent regression', role: 'ADMIN' } } }))
  await page.route('**/__mathverse_similarity_proxy', (route) => {
    const request = route.request().postDataJSON()
    requests.push(request)
    if (providerState === 'failure') return route.fulfill({ status: 503, json: { error: { message: '模型暂时不可用' } } })
    const incorrect = request.messages.at(-1).content.includes('x + 1 = 4')
    const analysis = providerState === 'earlier'
      ? { routeStatus: 'contains_logical_gap', firstIssueStep: 1, evidenceQuote: '两边除以 x', feedback: '不能在未确认非零时作除法。', nextQuestion: '除数可能为零吗？' }
      : providerState === 'uncertain'
      ? { routeStatus: 'uncertain', firstIssueStep: null, feedback: '前面的条件尚不充分。', nextQuestion: '请补充除数的条件。' }
      : providerState === 'beyond'
      ? { routeStatus: 'contains_execution_error', firstIssueStep: 2, evidenceQuote: '2 + 2 = 5', feedback: '越界定位不应显示', nextQuestion: '' }
      : providerState === 'wrong_quote'
      ? { routeStatus: 'contains_execution_error', firstIssueStep: 2, evidenceQuote: '设 x = 2', feedback: '伪造定位不应展示', nextQuestion: '' }
      : providerState === 'false_combo'
      ? { routeStatus: 'contains_logical_gap', firstIssueStep: 1, evidenceQuote: 'C(9,3)=84',
          feedback: '这个计数一定错误。', nextQuestion: '' }
      : providerState === 'contradictory'
      ? { routeStatus: 'valid', firstIssueStep: 2, evidenceQuote: 'x + 1 = 4', feedback: '矛盾反馈不应展示', nextQuestion: '' }
      : incorrect
        ? { routeStatus: 'contains_execution_error', firstIssueStep: 2, evidenceQuote: 'x + 1 = 4',
            feedback: '第二步的代入结果需要修正，否则后续计算会沿用错误数值。', nextQuestion: '代入 x 后相加得到多少？' }
        : { routeStatus: 'valid_but_incomplete', firstIssueStep: null,
            feedback: '当前路线可继续。', nextQuestion: '' }
    return route.fulfill({ json: { content: '```json\n' + JSON.stringify(analysis) + '\n```',
      model: request.model, elapsedMs: 10 } })
  })

  await page.goto(`${origin}/problems/P30001`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '打开 Mathverse AI 助手' }).click()
  const drawer = page.getByRole('dialog', { name: 'Mathverse AI 学习助手' })
  await drawer.getByRole('button', { name: 'Qwen 百炼' }).click()
  await drawer.getByLabel('API Key').fill('attempt-revision-test-key')
  await drawer.getByRole('button', { name: '返回对话' }).click()
  const draft = drawer.locator('.ai-assistant-attempt textarea')
  const check = drawer.getByRole('button', { name: /^检查我的思路/ })
  const original = '设 x = 2\n\n由此得到 x + 1 = 4'
  const corrected = '设 x = 2\n\n由此得到 x + 1 = 3'
  await draft.fill(original)
  await check.click()
  const first = drawer.locator('.ai-assistant-message.is-assistant').nth(0)
  await first.getByText('AI 初步定位 · 第 2 步', { exact: true }).waitFor()
  assert.match(await first.textContent(), /第 1 版草稿反馈 · 对应当前草稿/)
  assert.match(await first.textContent(), /尚未经确定性数学工具验证/)
  assert.doesNotMatch(requests[0].messages.at(-1).content, /参考答案秘密|参考解析秘密/)
  await first.getByRole('button', { name: '修改草稿', exact: true }).click()
  assert.equal(await draft.evaluate((editor) => editor.value.slice(editor.selectionStart, editor.selectionEnd)),
    '由此得到 x + 1 = 4', 'repair action must select the exact original source step')

  await draft.fill(corrected)
  await first.getByText(/已过期，仅供回顾/).waitFor()
  assert.equal(await first.getByRole('button', { name: '修改草稿', exact: true }).count(), 0)
  await first.getByRole('button', { name: '按当前草稿重新检查' }).click()
  const second = drawer.locator('.ai-assistant-message.is-assistant').nth(1)
  await second.getByText('当前路线可继续。', { exact: true }).waitFor()
  assert.match(await second.textContent(), /第 2 版草稿反馈 · 对应当前草稿/)
  assert.match(requests[1].messages.at(-1).content, /x \+ 1 = 3/)
  assert.doesNotMatch(requests[1].messages.at(-1).content, /x \+ 1 = 4/)
  await second.getByRole('button', { name: '继续补充草稿' }).click()
  assert.equal(await draft.evaluate((editor) => editor.selectionStart), corrected.length)
  assert.match(await first.textContent(), /已过期/)

  // Even if the raw text returns to v1, its committed feedback must not revive.
  await draft.fill(original)
  assert.match(await first.textContent(), /已过期/)
  providerState = 'contradictory'
  await check.click()
  await drawer.getByText('模型草稿分析的路线判断与问题定位矛盾，请重新检查', { exact: true }).waitFor()
  assert.equal(await drawer.getByText('矛盾反馈不应展示', { exact: true }).count(), 0)
  assert.equal(await draft.inputValue(), original)
  providerState = 'normal'
  await drawer.locator('.ai-assistant-message.is-error').last().getByRole('button', { name: '重试', exact: true }).click()
  const third = drawer.locator('.ai-assistant-message.is-assistant').nth(2)
  await third.getByText(/第 3 版草稿反馈 · 对应当前草稿/).waitFor()

  providerState = 'failure'
  await draft.fill(corrected)
  await check.click()
  await drawer.getByText('模型暂时不可用', { exact: true }).waitFor()
  assert.equal(await draft.inputValue(), corrected)
  providerState = 'normal'
  await drawer.locator('.ai-assistant-message.is-error').last().getByRole('button', { name: '重试', exact: true }).click()
  await drawer.getByText(/第 4 版草稿反馈 · 对应当前草稿/).waitFor()

  const beforeArithmetic = requests.length
  await draft.fill('2 + 2 = 5')
  await check.click()
  const arithmetic = drawer.locator('.ai-assistant-message.is-assistant').last()
  await arithmetic.getByText('已验证的算术问题 · 第 1 步', { exact: true }).waitFor()
  assert.match(await arithmetic.textContent(), /左侧等于 4，右侧等于 5/)
  assert.match(await arithmetic.textContent(), /此前与其它逻辑尚未核验/)
  assert.equal(requests.length, beforeArithmetic, 'supported arithmetic error uses the local tool')
  await arithmetic.getByRole('button', { name: '修正这一行' }).click()
  assert.equal(await draft.evaluate((editor) => editor.value.slice(editor.selectionStart, editor.selectionEnd)), '2 + 2 = 5')
  await draft.fill('')
  assert.equal(await arithmetic.getByRole('button', { name: '按当前草稿重新检查' }).isDisabled(), true)
  await drawer.getByPlaceholder('向 AI 提问…').fill('说明当前题目的条件')
  await drawer.getByRole('button', { name: '发送', exact: true }).click()
  await drawer.getByRole('button', { name: '发送', exact: true }).waitFor()
  assert.equal(requests.at(-1).taskType, 'assistant-chat')
  assert.equal(requests.at(-1).messages.length, 2, 'outdated draft feedback and its user messages must not reenter chat context')

  const mixed = '设 x = 0，因此可以两边除以 x\n\n2 + 2 = 5\n\n后续步骤暗号'
  providerState = 'earlier'
  await draft.fill(mixed)
  await check.click()
  await drawer.getByText(/草稿原文：两边除以 x[\s\S]*不能在未确认非零时作除法。/).waitFor()
  let reply = drawer.locator('.ai-assistant-message.is-assistant').last()
  assert.match(await reply.textContent(), /AI 初步定位 · 第 1 步/)
  assert.doesNotMatch(await reply.textContent(), /已验证的算术问题|左侧等于 4/)
  assert.doesNotMatch(requests.at(-1).messages.at(-1).content, /2 \+ 2 = 5|后续步骤暗号/)
  await reply.getByRole('button', { name: '修改草稿', exact: true }).click()
  assert.equal(await draft.evaluate((editor) => editor.value.slice(editor.selectionStart, editor.selectionEnd)), '设 x = 0，因此可以两边除以 x')

  providerState = 'uncertain'
  await check.click()
  await drawer.getByText('前面的条件尚不充分。', { exact: true }).waitFor()
  reply = drawer.locator('.ai-assistant-message.is-assistant').last()
  assert.doesNotMatch(await reply.textContent(), /已验证的算术问题|左侧等于 4/)
  assert.match(await reply.textContent(), /未展示的后续步骤不代表正确/)

  providerState = 'beyond'
  await check.click()
  await drawer.getByText('模型定位超出本轮检查范围，请重新检查前面的步骤', { exact: true }).waitFor()
  assert.equal(await drawer.getByText('越界定位不应显示', { exact: true }).count(), 0)
  providerState = 'normal'
  await draft.fill('已确认 x 不等于零，两边除以 x\n\n2 + 2 = 5')
  await check.click()
  reply = drawer.locator('.ai-assistant-message.is-assistant').last()
  await reply.getByText('已验证的算术问题 · 第 2 步', { exact: true }).waitFor()
  assert.match(await reply.textContent(), /前面的步骤仅经 AI 初步分析/)
  assert.match(await reply.textContent(), /左侧等于 4，右侧等于 5/)

  providerState = 'failure'
  await draft.fill(mixed)
  const beforeFailure = await drawer.locator('.ai-assistant-message.is-assistant').count()
  await check.click()
  await drawer.getByText('模型暂时不可用', { exact: true }).last().waitFor()
  assert.equal(await drawer.locator('.ai-assistant-message.is-assistant').count(), beforeFailure,
    'provider failure cannot silently fall back to a later arithmetic correction')
  assert.equal(await draft.inputValue(), mixed)
  providerState = 'wrong_quote'
  await draft.fill(original)
  await check.click()
  await drawer.getByText('模型引用的草稿片段与定位步骤不一致，请重新检查', { exact: true }).waitFor()
  assert.equal(await drawer.getByText('伪造定位不应展示', { exact: true }).count(), 0)
  assert.equal(await draft.inputValue(), original)
  providerState = 'normal'
  const conditional = '总取法为 C(9,3)=84。\n\n在至少一蓝的条件下，样本空间仍是所有取法。\n\n2 + 2 = 5'
  await draft.fill(conditional)
  await check.click()
  reply = drawer.locator('.ai-assistant-message.is-assistant').last()
  await reply.getByText(/第 2 步声称加入条件后样本空间仍是全部/).waitFor()
  assert.doesNotMatch(await reply.textContent(), /已验证的算术问题|左侧等于 4/)
  await reply.getByRole('button', { name: '检查这一行' }).click()
  assert.equal(await draft.evaluate((editor) => editor.value.slice(editor.selectionStart, editor.selectionEnd)),
    '在至少一蓝的条件下，样本空间仍是所有取法。')
  await draft.fill('先计算 \\ln(-1)+1。\n\n1+1=3')
  await check.click()
  reply = drawer.locator('.ai-assistant-message.is-assistant').last()
  await reply.getByText(/第 1 步出现对非正数取对数/).waitFor()
  await reply.getByRole('button', { name: '检查这一行' }).click()
  assert.equal(await draft.evaluate((editor) => editor.value.slice(editor.selectionStart, editor.selectionEnd)),
    '先计算 \\ln(-1)+1。')
  await draft.fill('有人称“在至少一蓝条件下样本空间仍是所有取法”，但这不成立，应排除无蓝取法。\n\n2+2=5')
  await check.click()
  reply = drawer.locator('.ai-assistant-message.is-assistant').last()
  await reply.getByText('已验证的算术问题 · 第 2 步', { exact: true }).waitFor()
  assert.doesNotMatch(await reply.textContent(), /声称加入条件后样本空间仍是全部/)
  providerState = 'false_combo'
  await draft.fill('总取法为 C(9,3)=84。\n\n2 + 2 = 5')
  await check.click()
  reply = drawer.locator('.ai-assistant-message.is-assistant').last()
  await reply.getByText(/C\(9,3\)=84 数值成立/).waitFor()
  assert.doesNotMatch(await reply.textContent(), /这个计数一定错误/)
  providerState = 'normal'
  await draft.fill('令 z=0\n\n计算 ln z+1。\n\n1+1=3')
  await check.click()
  await drawer.locator('.ai-assistant-message.is-assistant').last()
    .getByText(/第 1 步明确取 z=0.*第 2 步/).waitFor()
  const bindingReply = drawer.locator('.ai-assistant-message.is-assistant')
    .nth(await drawer.locator('.ai-assistant-message.is-assistant').count() - 1)
  assert.doesNotMatch(await bindingReply.textContent(), /已验证的算术问题/)
  await bindingReply.getByRole('button', { name: '检查这一行' }).click()
  assert.equal(await draft.evaluate((editor) => editor.value.slice(editor.selectionStart, editor.selectionEnd)), '计算 ln z+1。')
  await draft.fill('令 z=1\n\n计算 ln z+1。\n\n1+1=3')
  await check.click()
  reply = drawer.locator('.ai-assistant-message.is-assistant').last()
  await reply.getByText('已验证的算术问题 · 第 3 步', { exact: true }).waitFor()
  assert.match(await bindingReply.textContent(), /已过期/)

  // Refresh preserves an unsent edit separately from the last submitted version.
  await draft.fill('2+2=5')
  await check.click()
  await drawer.locator('.ai-assistant-message.is-assistant').last()
    .getByText('已验证的算术问题 · 第 1 步', { exact: true }).waitFor()
  const persisted = await page.evaluate(() => JSON.parse(sessionStorage.getItem('mathverse:agent:attempt-checkpoint:v1')))
  const submitted = persisted.problems.find(([id]) => id === 'P30001')[1].attempt
  await draft.fill('2+2=6')
  await page.reload()
  await page.getByRole('button', { name: '打开 Mathverse AI 助手' }).click()
  await drawer.getByRole('button', { name: '返回对话' }).click()
  await drawer.getByText('已恢复此题草稿与最近提交版本。请按当前草稿重新检查。', { exact: true }).waitFor()
  assert.equal(await draft.inputValue(), '2+2=6')
  assert.equal(await drawer.locator('.ai-assistant-message.is-assistant').count(), 0, 'no old diagnosis is restored')
  assert.match(await drawer.textContent(), /草稿已修改，待重新检查/)
  const beforeReloadCheck = requests.length
  await check.click()
  await drawer.getByText(`第 ${submitted.version + 1} 版草稿反馈 · 对应当前草稿`, { exact: true }).waitFor()
  assert.equal(requests.length, beforeReloadCheck, 'refresh itself never makes a provider request')
  let saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('mathverse:agent:attempt-checkpoint:v1')))
  assert.equal(saved.problems[0][1].attempt.id, submitted.id)
  await page.reload()
  await page.getByRole('button', { name: '打开 Mathverse AI 助手' }).click()
  await drawer.getByRole('button', { name: '返回对话' }).click()
  await drawer.getByText(`已提交第 ${submitted.version + 1} 版`, { exact: true }).waitFor()
  await check.click()
  await drawer.getByText(`第 ${submitted.version + 1} 版草稿反馈 · 对应当前草稿`, { exact: true }).waitFor()
  await drawer.getByRole('button', { name: '修正这一行' }).click()
  assert.equal(await draft.evaluate((editor) => editor.value.slice(editor.selectionStart, editor.selectionEnd)), '2+2=6')
  await drawer.getByRole('button', { name: '清除此题草稿', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: '打开 Mathverse AI 助手' }).click()
  await drawer.getByRole('button', { name: '返回对话' }).click()
  assert.equal(await draft.inputValue(), '')
  assert.equal(await check.isDisabled(), true)
  // Denied writes are visible and do not prevent a local draft check.
  await page.evaluate(() => {
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'mathverse:agent:attempt-checkpoint:v1') throw new Error('quota')
      return originalSetItem.call(this, key, value)
    }
  })
  await draft.fill('3+3=7')
  await drawer.getByText('此时无法保存或恢复草稿；离开前请复制备份，仍可继续检查。', { exact: true }).waitFor()
  await check.click()
  await drawer.getByText('已验证的算术问题 · 第 1 步', { exact: true }).waitFor()
  assert.equal(await draft.inputValue(), '3+3=7')
  assert.deepEqual(pageErrors, [])
  console.log('PASS: attempt revision, grounded quotes, cautious prerequisite review, source selection, retry and arithmetic evidence')
})().catch((error) => { console.error(error); process.exitCode = 1 })
  .finally(async () => { await browser?.close(); server?.kill() })
