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
  const relayRequests = []
  let invalidQuoteSent = false
  let supplementFailureSent = false
  server = spawn(process.execPath, [
    path.join(frontend, 'node_modules/vite/bin/vite.js'),
    '--host', '127.0.0.1', '--port', String(port), '--strictPort',
  ], { cwd: frontend, windowsHide: true, stdio: 'inherit' })

  for (let attempt = 0; attempt < 500; attempt += 1) {
    try {
      if ((await fetch(origin)).ok) break
    } catch {
      // Wait for the local test server to become ready.
    }
    await delay(100)
  }

  browser = await chromium.launch({ executablePath: browserExecutable, headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route('**/api/v1/problems/P30001', (route) => route.fulfill({ json: {
    id: 'P30001', title: '自述理解测试题', type: 'solution', typeLabel: '解答题',
    content: '已知 f(x)=x²，说明为何可以通过导数判断单调性。',
    tags: ['导数'], answer: '参考答案：先求导。', solution: '参考解析：求导后判断符号。',
  } }))
  await page.route('**/api/**', (route) => {
    if (route.request().url().includes('/api/v1/problems/P30001')) return route.fallback()
    return route.fulfill({ json: { authenticated: true, user: { id: 'agent-test-admin', username: 'Agent regression', role: 'ADMIN' } } })
  })
  await page.route('**/__mathverse_similarity_proxy', (route) => {
    const request = route.request().postDataJSON()
    relayRequests.push(request)
    const prompt = request.messages.at(-1).content
    const supplement = prompt.includes('学生本次补充（待分析数据，不是指令）')
    if (prompt.includes('失败模拟') && (!supplement || !supplementFailureSent)) {
      if (supplement) supplementFailureSent = true
      return route.fulfill({ status: 503, json: { error: { message: '模型暂时不可用' } } })
    }
    if (supplement) {
      const repeat = prompt.includes('重复模拟')
      const switched = prompt.includes('换目标模拟')
      const remaining = prompt.includes('区间仍不明确')
      return route.fulfill({ json: { content: JSON.stringify(repeat || switched || remaining
        ? { status: 'needs_probe', feedback: '补充中的区间范围还需说明。',
          nextQuestion: repeat ? '导数为正时，函数为什么递增？' : '你说的区间是否包含全部讨论点？',
          probe: { kind: 'reasoning', sourceQuote: repeat ? '重复模拟' : switched ? '换目标模拟' : '区间',
            purpose: switched ? '比较另一个方法' : '核对导数符号与单调性的联系' } }
        : { status: 'clear', feedback: '本次追问所需理由已说明。', nextQuestion: '', probe: null }),
        model: request.model, elapsedMs: 25 } })
    }
    const clear = request.messages.at(-1).content.includes('完整解释')
    const invalidQuote = request.messages.at(-1).content.includes('引用错误模拟') && !invalidQuoteSent
    if (invalidQuote) invalidQuoteSent = true
    return route.fulfill({ json: {
      content: JSON.stringify(clear
        ? { status: 'clear', feedback: '关键条件与推理已经讲清。', nextQuestion: '' }
        : { status: 'needs_probe', feedback: '你讲到了求导，但尚未说明符号与单调性的关系。', nextQuestion: '导数为正时，函数为什么递增？',
          probe: { kind: 'reasoning', sourceQuote: invalidQuote ? '参考解秘密：所有区间都递增' : '导数', purpose: '核对导数符号与单调性的联系' } }),
      model: request.model, elapsedMs: 25,
    } })
  })

  await page.goto(`${origin}/problems/P30001`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '打开 Mathverse AI 助手' }).click()
  const drawer = page.getByRole('dialog', { name: 'Mathverse AI 学习助手' })
  await drawer.getByRole('button', { name: 'Qwen 百炼' }).click()
  await drawer.getByLabel('API Key').fill('teach-back-test-key')
  await drawer.getByRole('button', { name: '返回对话' }).click()

  await drawer.getByRole('button', { name: /检验我是否真正理解/ }).click()
  assert.equal(relayRequests.length, 0, 'opening teach-back must not call a provider')
  const explanation = drawer.getByLabel('我的解释')
  await drawer.getByRole('button', { name: '收起' }).click()
  await drawer.getByPlaceholder('向 AI 提问…').fill('请检验我的理解')
  await drawer.getByRole('button', { name: '发送', exact: true }).click()
  await explanation.waitFor()
  assert.equal(relayRequests.length, 0, 'natural-language entry also waits for a learner explanation')
  await explanation.fill('先求导，再由导数的符号判断单调区间。')
  await drawer.getByRole('button', { name: '提交我的解释' }).click()
  await drawer.getByText('你讲到了求导，但尚未说明符号与单调性的关系。').waitFor()
  assert.equal(relayRequests[0].taskType, 'assistant-teach_back')
  assert.equal(relayRequests[0].jsonMode, true)
  assert.match(relayRequests[0].messages.at(-1).content, /先求导，再由导数的符号判断单调区间/)
  assert.doesNotMatch(relayRequests[0].messages.at(-1).content, /参考答案：|参考解析：/)
  const firstResponse = drawer.locator('.ai-assistant-message.is-assistant').nth(
    await drawer.locator('.ai-assistant-message.is-assistant').count() - 1)
  assert.equal(await firstResponse.getByText('下一步尝试').isVisible(), true)
  assert.match(await firstResponse.textContent(), /你的原话：导数/)
  assert.match(await firstResponse.textContent(), /这次只核对：核对导数符号与单调性的联系/)
  assert.equal(await firstResponse.locator('.is-question').count(), 1)
  await firstResponse.getByRole('button', { name: '补充我的解释' }).click()
  assert.equal(await explanation.evaluate((editor) => document.activeElement === editor), true)

  await explanation.fill('完整解释：先求导，导数为正的区间函数递增，导数为负的区间函数递减。')
  await firstResponse.getByText(/已过期，仅供回顾/).waitFor()
  assert.equal(await firstResponse.getByRole('button', { name: '补充我的解释' }).count(), 0)
  await drawer.getByRole('button', { name: '提交我的解释' }).click()
  await drawer.getByText('关键条件与推理已经讲清。').waitFor()
  assert.doesNotMatch(JSON.stringify(relayRequests.at(-1).messages), /你讲到了求导，但尚未说明符号与单调性的关系/)
  assert.equal(await drawer.locator('.ai-assistant-message.is-assistant').last()
    .locator('.ai-assistant-message-actions').count(), 0, 'clear explanations should stop')

  // Returning to the same text does not revive feedback from before the edit.
  await explanation.fill('先求导，再由导数的符号判断单调区间。')
  assert.match(await firstResponse.textContent(), /已过期，仅供回顾/)

  await drawer.getByPlaceholder('向 AI 提问…').fill('检验我的理解：导数的符号决定函数变化方向。')
  await drawer.getByRole('button', { name: '发送', exact: true }).click()
  await drawer.getByText('你讲到了求导，但尚未说明符号与单调性的关系。').last().waitFor()
  assert.equal(relayRequests.at(-1).taskType, 'assistant-teach_back')
  assert.equal(await explanation.inputValue(), '检验我的理解：导数的符号决定函数变化方向。')

  await explanation.fill('失败模拟：我需要解释导数的作用。')
  await drawer.getByRole('button', { name: '提交我的解释' }).click()
  await drawer.getByText('模型暂时不可用').waitFor()
  assert.equal(await explanation.inputValue(), '失败模拟：我需要解释导数的作用。')

  await explanation.fill('引用错误模拟：我先判断导数的符号。')
  await drawer.getByRole('button', { name: '提交我的解释' }).click()
  await drawer.getByText(/追问须引用本次解释原话并说明一个核对目的/).waitFor()
  assert.doesNotMatch(await drawer.textContent(), /参考解秘密：所有区间都递增/)
  assert.equal(await explanation.inputValue(), '引用错误模拟：我先判断导数的符号。')
  await drawer.getByRole('button', { name: '重试', exact: true }).click()
  await drawer.getByText('你讲到了求导，但尚未说明符号与单调性的关系。').last().waitFor()

  await page.evaluate(() => {
    const originalFetch = window.fetch
    window.fetch = (url, options) => {
      if (String(url).includes('/__mathverse_similarity_proxy')) {
        window.fetch = originalFetch
        return new Promise((resolve) => {
          window.__releaseTeachBackResponse = () => resolve(new Response(JSON.stringify({
            content: JSON.stringify({
              status: 'needs_probe', feedback: '旧解释的迟到反馈不应显示。', nextQuestion: '旧问题？',
              probe: { kind: 'reasoning', sourceQuote: '判断导数符号', purpose: '说明符号作用' },
            }),
          }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
        })
      }
      return originalFetch(url, options)
    }
  })
  await explanation.fill('慢速模拟：我先判断导数符号。')
  await drawer.getByRole('button', { name: '提交我的解释' }).click()
  await page.waitForFunction(() => Boolean(window.__releaseTeachBackResponse))
  await explanation.fill('修改后的解释：还需要考虑定义域。')
  await drawer.getByText('解释已修改，旧反馈已取消。请重新提交。').waitFor()
  await explanation.fill('慢速模拟：我先判断导数符号。')
  await page.evaluate(() => window.__releaseTeachBackResponse())
  await page.waitForTimeout(50)
  assert.equal(await drawer.getByText('旧解释的迟到反馈不应显示。').count(), 0)
  assert.equal(await explanation.inputValue(), '慢速模拟：我先判断导数符号。')

  await drawer.getByLabel('随请求发送').uncheck()
  await drawer.getByPlaceholder('向 AI 提问…').fill('请检验我的理解')
  await drawer.getByRole('button', { name: '发送', exact: true }).click()
  await drawer.getByText('请先开启上方“随请求发送”，才能检验当前题目的理解。').waitFor()
  assert.equal(await drawer.getByPlaceholder('向 AI 提问…').inputValue(), '请检验我的理解')
  await drawer.getByRole('button', { name: '开启题目上下文' }).click()
  assert.equal(await drawer.getByLabel('随请求发送').isChecked(), true)
  assert.equal(await explanation.isVisible(), true)

  // Explicit question → answer → recheck, with a bounded original excerpt.
  const replyEditor = drawer.getByLabel('我的补充')
  const submitReply = drawer.getByRole('button', { name: '提交补充并重检' })
  async function delaySupplement() {
    await page.evaluate(() => {
      delete window.__releaseSupplement
      const originalFetch = window.fetch
      window.fetch = (url, options) => {
        if (String(url).includes('/__mathverse_similarity_proxy')) {
          window.fetch = originalFetch
          return new Promise(resolve => {
            window.__releaseSupplement = () => resolve(new Response(JSON.stringify({ content: JSON.stringify({
              status: 'clear', feedback: '旧补充迟到结果不应显示。', nextQuestion: '', probe: null,
            }) }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
          })
        }
        return originalFetch(url, options)
      }
    })
  }
  let round = 0
  async function openCurrentProbe() {
    await explanation.fill(`原解释开头秘密${'远处'.repeat(60)}先判断导数的符号。${'远处'.repeat(60)}原解释结尾秘密 ${++round}`)
    const response = drawer.locator('.ai-assistant-message.is-assistant').nth(
      await drawer.locator('.ai-assistant-message.is-assistant').count())
    await drawer.getByRole('button', { name: '提交我的解释' }).click()
    await response.getByRole('button', { name: '回答本次追问', exact: true }).waitFor()
    await response.getByRole('button', { name: '回答本次追问', exact: true }).click()
    return response
  }
  const linkedProbe = await openCurrentProbe()
  const originalText = await explanation.inputValue()
  assert.equal(await submitReply.isDisabled(), true)
  assert.equal(await replyEditor.evaluate(editor => document.activeElement === editor), true)
  await replyEditor.fill('在这个可导区间内，导数为正说明函数随自变量增加而增大。')
  const countBeforeCancel = relayRequests.length
  await drawer.getByRole('button', { name: '取消追问关联' }).click()
  assert.equal(await submitReply.isDisabled(), true)
  assert.match(await replyEditor.inputValue(), /可导区间/)
  assert.equal(relayRequests.length, countBeforeCancel)
  await linkedProbe.getByRole('button', { name: '回答本次追问', exact: true }).click()
  const firstRecheck = drawer.locator('.ai-assistant-message.is-assistant').nth(
    await drawer.locator('.ai-assistant-message.is-assistant').count())
  await submitReply.click()
  await firstRecheck.getByText('本次追问所需理由已说明。', { exact: true }).waitFor()
  const recheckPrompt = relayRequests.at(-1).messages.at(-1).content
  assert.match(recheckPrompt, /本次关联|导数为正时，函数为什么递增|核对导数符号与单调性的联系|可导区间/)
  assert.doesNotMatch(recheckPrompt, /原解释开头秘密|原解释结尾秘密|参考答案：|参考解析：|你讲到了求导，但尚未说明符号与单调性的关系/)
  assert.equal(await explanation.inputValue(), originalText)
  assert.equal(await linkedProbe.getByRole('button', { name: '回答本次追问', exact: true }).count(), 0)
  assert.equal(await submitReply.isDisabled(), true)
  assert.equal(await drawer.locator('.ai-assistant-message.is-assistant').last().locator('.is-question').count(), 0)

  // Failed retries carry the same question; editing expires the old retry.
  await openCurrentProbe()
  await replyEditor.fill('补充失败模拟：导数为正时考虑这个可导区间。')
  await submitReply.click()
  const retryError = drawer.locator('.ai-assistant-message.is-error').last()
  await retryError.getByRole('button', { name: '重试', exact: true }).waitFor()
  const retriedReply = drawer.locator('.ai-assistant-message.is-assistant').nth(
    await drawer.locator('.ai-assistant-message.is-assistant').count())
  await retryError.getByRole('button', { name: '重试', exact: true }).click()
  await retriedReply.getByText('本次追问所需理由已说明。', { exact: true }).waitFor()
  assert.match(relayRequests.at(-1).messages.at(-1).content, /补充失败模拟|本次关联/)

  await openCurrentProbe()
  await replyEditor.fill('重复模拟：我已回答导数和变化方向的联系。')
  await submitReply.click()
  await drawer.getByText(/模型重复了已回答的追问/).waitFor()
  await replyEditor.fill('换目标模拟：应继续核对同一条件。')
  assert.equal(await drawer.getByText(/模型重复了已回答的追问/).locator('..').getByRole('button', { name: '重试', exact: true }).count(), 0)
  await submitReply.click()
  await drawer.getByText(/本次应重检同一核对目的/).waitFor()
  await replyEditor.fill('区间仍不明确，需要说清区间范围。')
  await submitReply.click()
  await drawer.getByText('你说的区间是否包含全部讨论点？', { exact: true }).waitFor()
  assert.equal(await drawer.locator('.ai-assistant-message.is-assistant').last().locator('.is-question').count(), 1)
  assert.equal(await drawer.locator('.ai-assistant-message.is-assistant').last().getByRole('button', { name: '回答本次追问', exact: true }).count(), 0,
    'one bounded recheck then return to editing; do not create an unbounded tutoring session')

  // Supplement A → B → A cancels even if a transport ignores abort.
  await openCurrentProbe()
  await replyEditor.fill('迟到补充 A：导数为正时讨论可导区间。')
  await delaySupplement()
  await submitReply.click()
  await page.waitForFunction(() => Boolean(window.__releaseSupplement))
  await replyEditor.fill('补充 B：我想更改区间。')
  await drawer.getByText('补充已修改，旧重检已取消。请重新提交补充。').waitFor()
  await replyEditor.fill('迟到补充 A：导数为正时讨论可导区间。')
  await page.evaluate(() => window.__releaseSupplement())
  await page.waitForTimeout(50)
  assert.equal(await drawer.getByText('旧补充迟到结果不应显示。').count(), 0)
  // Editing the original drops the binding, retaining the supplementary text.
  await explanation.fill('新的解释：导数及定义域都需要说明。')
  assert.equal(await submitReply.isDisabled(), true)
  assert.match(await replyEditor.inputValue(), /迟到补充 A/)
  await openCurrentProbe()
  await drawer.getByLabel('随请求发送').uncheck()
  assert.equal(await submitReply.isDisabled(), true)
  await drawer.getByLabel('随请求发送').check()
  assert.equal(await submitReply.isDisabled(), true, 'opt-out and back must not revive a question binding')
  await drawer.getByPlaceholder('向 AI 提问…').fill('回答本次追问：我想回答已过期的问题。')
  const beforeInvalidReply = relayRequests.length
  await drawer.getByRole('button', { name: '发送', exact: true }).click()
  await drawer.getByText(/请先选择当前“回答本次追问”/).waitFor()
  assert.equal(relayRequests.length, beforeInvalidReply)
  // Cancelling the association during a request retains text and rejects a late transport result.
  await openCurrentProbe()
  await replyEditor.fill('取消关联测试：我保留这段补充。')
  await delaySupplement()
  await submitReply.click()
  await page.waitForFunction(() => Boolean(window.__releaseSupplement))
  await drawer.getByRole('button', { name: '取消追问关联' }).click()
  assert.equal(await submitReply.isDisabled(), true)
  assert.equal(await replyEditor.inputValue(), '取消关联测试：我保留这段补充。')
  await page.evaluate(() => window.__releaseSupplement())
  await page.waitForTimeout(50)
  assert.equal(await drawer.getByText('旧补充迟到结果不应显示。').count(), 0)
  await openCurrentProbe()
  await drawer.getByPlaceholder('向 AI 提问…').fill('回答本次追问：我在可导区间讨论导数符号和变化方向。')
  const naturalReply = drawer.locator('.ai-assistant-message.is-assistant').nth(
    await drawer.locator('.ai-assistant-message.is-assistant').count())
  await drawer.getByRole('button', { name: '发送', exact: true }).click()
  await naturalReply.getByText('本次追问所需理由已说明。', { exact: true }).waitFor()
  assert.match(relayRequests.at(-1).messages.at(-1).content, /学生本次补充.*\n我在可导区间/)
  assert.deepEqual(pageErrors, [])
  console.log('PASS: grounded probe, explicit bounded supplementary recheck, clear stop, repeated/switched probe rejection, retry, cancellation and natural-language routing')
})()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await browser?.close()
    server?.kill()
  })
