require('./browser-support.cjs')
const { browserExecutable, getTestPort } = require('./browser-support.cjs')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const assert = require('node:assert/strict')
const path = require('node:path')
const { chromium } = require('playwright')

let browser
let server

async function selectStepText(page, text) {
  const step = page.locator('[data-solution-step]').filter({ hasText: text }).first()
  await step.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    const node = walker.nextNode()
    if (!node) throw new Error('No selectable text node')
    const range = document.createRange()
    range.selectNodeContents(element)
    const selection = getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })
  await page.getByRole('toolbar', { name: '向 AI 询问选中的解析' }).waitFor()
}

;(async () => {
  const port = await getTestPort()
  const origin = `http://127.0.0.1:${port}`
  const frontend = path.resolve(__dirname, '..')
  const relayRequests = []
  server = spawn(
    process.execPath,
    [
      path.join(frontend, 'node_modules/vite/bin/vite.js'),
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    { cwd: frontend, windowsHide: true, stdio: 'ignore' },
  )

  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      if ((await fetch(origin)).ok) break
    } catch {
      // Wait for the bounded local test server startup.
    }
    await delay(100)
  }

  browser = await chromium.launch({ executablePath: browserExecutable, headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route('**/api/v1/problems/P20001', (route) =>
    route.fulfill({
      json: {
        id: 'P20001',
        title: '变量代换测试题',
        type: 'solution',
        typeLabel: '解答题',
        content: '已知表达式反复出现 x+y，化简并求值。',
        tags: ['函数'],
        answer: '结果为 2。',
        solution: '观察到原式反复出现 x+y。\n\n因此令 u=x+y。\n\n原式转化为关于 u 的一元方程。',
        solutionSourceType: 'community',
        solutionReviewStatus: 'pending',
      },
    }),
  )
  await page.route('**/api/**', (route) => {
    if (route.request().url().includes('/api/v1/problems/P20001')) return route.fallback()
    return route.fulfill({ json: { authenticated: true, user: { id: 'agent-test-admin', username: 'Agent regression', role: 'ADMIN' } } })
  })
  await page.route('**/__mathverse_similarity_proxy', async (route) => {
    const request = route.request().postDataJSON()
    relayRequests.push(request)
    await route.fulfill({
      json: {
        content: request.taskType === 'assistant-diagnose'
          ? JSON.stringify({ routeStatus: 'valid_but_incomplete', firstIssueStep: null, feedback: '这条草稿路线可以继续。', nextQuestion: '代换后会得到什么？' })
          : '这一步正确。反复出现 x+y 是引入整体变量的直接线索。',
        model: request.model,
        usage: { promptTokens: 70, completionTokens: 20, totalTokens: 90 },
        elapsedMs: 35,
      },
    })
  })

  await page.goto(`${origin}/problems/P20001`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '显示答案' }).click()
  await selectStepText(page, '因此令 u=x+y')
  await page.getByRole('button', { name: '解释动机' }).click()

  const drawer = page.getByRole('dialog', { name: 'Mathverse AI 学习助手' })
  await drawer.waitFor()
  assert.equal(relayRequests.length, 0, 'opening from a selection must not spend API quota')
  assert.match(await drawer.getByPlaceholder('向 AI 提问…').inputValue(), /为什么会想到/)
  assert.equal(await drawer.getByText(/P20001 · 解析 · 第 2 步/).isVisible(), true)
  assert.equal(await drawer.getByText(/因此令 u=x\+y/).isVisible(), true)
  assert.equal(await drawer.getByText(/社区解析尚未审核/).isVisible(), true)

  await drawer.getByText('设置', { exact: true }).click()
  await drawer.getByRole('button', { name: 'Qwen 百炼' }).click()
  await drawer.getByLabel('API Key').fill('selection-test-key')
  await drawer.getByRole('button', { name: '返回对话' }).click()
  await drawer.getByRole('button', { name: '发送' }).click()
  await drawer.getByText(/这一步正确/).waitFor()

  assert.equal(relayRequests.length, 1)
  const requestText = relayRequests[0].messages.at(-1).content
  assert.match(requestText, /先独立检查当前步骤的数学正确性/)
  assert.match(requestText, /观察到原式反复出现 x\+y/)
  assert.match(requestText, /因此令 u=x\+y/)
  assert.match(requestText, /原式转化为关于 u 的一元方程/)
  assert.match(relayRequests[0].messages[0].content, /只处理高中数学范围/)

  await drawer.getByRole('button', { name: /给一个提示/ }).click()
  await drawer.getByText('当前焦点已看 1 条提示').waitFor()
  const hintRequest = relayRequests[1].messages.at(-1).content
  assert.match(hintRequest, /第 0 级渐进提示/)
  assert.doesNotMatch(hintRequest, /原式转化为关于 u 的一元方程/)
  assert.doesNotMatch(hintRequest, /参考答案：/)

  await drawer.getByRole('button', { name: /解释这一步/ }).click()
  await drawer.getByText('这一步正确。反复出现 x+y 是引入整体变量的直接线索。', { exact: true }).last().waitFor()
  const explanationRequest = relayRequests[2].messages.at(-1).content
  assert.match(explanationRequest, /解释为什么想到它/)
  assert.doesNotMatch(explanationRequest, /请分析这道题的考点、突破口和关键步骤/)

  await drawer.locator('.ai-assistant-attempt textarea').fill('观察到原式反复出现 x+y')
  await drawer.getByRole('button', { name: /检查我的思路/ }).click()
  await drawer.getByText('这条草稿路线可以继续。').waitFor()
  assert.equal(relayRequests[3].taskType, 'assistant-diagnose')
  assert.doesNotMatch(relayRequests[3].messages.at(-1).content, /当前步骤原文|原式转化为关于 u 的一元方程/)

  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '显示答案' }).click()
  await selectStepText(page, '因此令 u=x+y')
  await page.getByRole('button', { name: '解释动机' }).click()
  await drawer.getByText('当前焦点已看 1 条提示').waitFor()
  await drawer.getByText('设置', { exact: true }).click()
  assert.equal(await drawer.getByLabel('API Key').inputValue(), '', 'API key must stay in memory only')
  await drawer.getByRole('button', { name: '返回对话' }).click()
  await drawer.getByPlaceholder('向 AI 提问…').fill('只检查这一步：1/2+1/3=5/6')
  await drawer.getByRole('button', { name: '发送' }).click()
  await drawer.getByText('已验证 · 精确算术').waitFor()
  assert.equal(relayRequests.length, 4, 'exact arithmetic should not consume model quota')

  await drawer.getByRole('button', { name: '关闭 AI 助手' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await selectStepText(page, '因此令 u=x+y')
  const toolbarBox = await page.getByRole('toolbar', { name: '向 AI 询问选中的解析' }).boundingBox()
  assert.ok(toolbarBox.x >= 0 && toolbarBox.x + toolbarBox.width <= 390)
  assert.deepEqual(pageErrors, [])
  console.log('PASS: solution selection opens a draft, preserves context, verifies community work, and fits mobile')
})()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await browser?.close()
    server?.kill()
  })
