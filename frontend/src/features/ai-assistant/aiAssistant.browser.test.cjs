const { browserExecutable, getTestPort } = require('../../../tests/browser-support.cjs')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const assert = require('node:assert/strict')
const path = require('node:path')
const { chromium } = require('playwright')

let browser
let server

async function delayNextModelResponse(page) {
  // Simulate a provider/transport that still resolves after AbortController fires.
  await page.evaluate(() => {
    const originalFetch = window.fetch
    window.__releaseModelResponse = null
    window.fetch = (url, options) => {
      if (String(url).includes('/__mathverse_similarity_proxy')) {
        window.fetch = originalFetch
        return new Promise((resolve) => {
          window.__releaseModelResponse = (body, status = 200) => resolve(new Response(JSON.stringify(body), {
            status, headers: { 'Content-Type': 'application/json' },
          }))
        })
      }
      return originalFetch(url, options)
    }
  })
}

async function releaseModelResponse(page, body, status = 200) {
  await page.evaluate(({ body, status }) => window.__releaseModelResponse(body, status), { body, status })
  // Let the ignored transport completion, response parsing and Vue update finish.
  await page.waitForTimeout(50)
}

;(async () => {
  const port = await getTestPort()
  const origin = `http://127.0.0.1:${port}`
  const frontend = path.resolve(__dirname, '../../..')
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
      // Vite may still be starting; retry until the bounded loop ends.
    }
    await delay(100)
  }

  browser = await chromium.launch({ executablePath: browserExecutable, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route('**/api/v1/problems/P10002', (route) =>
    route.fulfill({
      json: {
        id: 'P10002',
        title: '2024 年全国甲卷 · T21',
        type: 'solution',
        typeLabel: '解答题',
        content: '已知函数 f(x)=x³−3x²+a，求单调区间并讨论极值。',
        tags: ['函数', '导数'],
        answer: '按导数符号分类。',
        solution: '先求导，再由临界点判断单调性。',
      },
    }),
  )
  await page.route('**/api/**', (route) => {
    if (route.request().url().includes('/api/v1/problems/P10002')) return route.fallback()
    return route.fulfill({ json: { authenticated: true, user: { id: 'agent-test-admin', username: 'Agent regression', role: 'ADMIN' } } })
  })
  await page.route('**/__mathverse_similarity_proxy', async (route) => {
    const request = route.request().postDataJSON()
    relayRequests.push(request)
    if (request.messages.at(-1)?.content?.includes('请验证生成额度恢复') && request.generationBudgetMode === 'auto') {
      await route.fulfill({ status: 502, json: { error: { message: '模型达到本次生成额度上限，未能完成答案。请调高生成额度后重试' } } })
      return
    }
    await route.fulfill({
      json: {
        content: request.taskType === 'connection-test'
          ? 'OK'
          : request.taskType === 'assistant-diagnose'
            ? JSON.stringify({
              routeStatus: 'valid_but_incomplete',
              firstIssueStep: null,
              feedback: '目前的求导路线可行，但尚未判断导函数符号。',
              nextQuestion: '你能找出导函数的零点吗？',
            })
            : request.taskType === 'assistant-strategy'
              ? JSON.stringify({
                overview: '先比较直接求导与代数变形。',
                routes: [
                  { name: '直接求导', when: '导数容易计算', firstMove: '求导并找临界点', workload: '一次求导与符号表', switchSignal: '导数难以整理时换路', basis: { source: 'problem', sourceQuote: '单调区间', missingCondition: '' } },
                  { name: '代数变形', when: '能化成已知结构', firstMove: '整理表达式', workload: '检查等价条件', switchSignal: '分支过多时换路', basis: { source: 'none', sourceQuote: '', missingCondition: '需核对能否等价化为简单结构' } },
                ],
                preferredIndex: 0,
                choiceRule: '先选前提最容易验证、运算量较小的方法。',
              })
            : '先求导，观察导函数零点与符号变化。',
        model: request.model,
        usage: { promptTokens: 30, completionTokens: 12, totalTokens: 42 },
        providerRequestId: 'assistant-browser-request',
        elapsedMs: 86,
      },
    })
  })

  await page.goto(`${origin}/login`, { waitUntil: 'networkidle' })
  assert.equal(await page.getByRole('button', { name: '打开 Mathverse AI 助手' }).isVisible(), true)

  await page.goto(`${origin}/problems/P10002`, { waitUntil: 'networkidle' })
  const launcherBox = await page.getByRole('button', { name: '打开 Mathverse AI 助手' }).boundingBox()
  await page.mouse.move(launcherBox.x + launcherBox.width / 2, launcherBox.y + launcherBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(1420, 28, { steps: 8 })
  await page.mouse.up()
  const restoreButton = page.getByRole('button', { name: '显示 Mathverse AI 学习助手' })
  assert.equal(await restoreButton.isVisible(), true)
  const restoreBox = await restoreButton.boundingBox()
  await page.mouse.move(restoreBox.x + restoreBox.width / 2, restoreBox.y + restoreBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(1150, 150, { steps: 8 })
  await page.mouse.up()
  assert.equal(await page.getByRole('button', { name: '打开 Mathverse AI 助手' }).isVisible(), true)
  await page.getByRole('button', { name: '打开 Mathverse AI 助手' }).click()
  await page.waitForTimeout(220)
  const resetSizeButton = await page.getByRole('button', { name: '恢复默认对话框大小' }).boundingBox()
  const closeButton = await page.getByRole('button', { name: '关闭 AI 助手' }).boundingBox()
  assert.deepEqual(
    [Math.round(resetSizeButton.width), Math.round(resetSizeButton.height)],
    [36, 36],
  )
  assert.deepEqual(
    [Math.round(closeButton.width), Math.round(closeButton.height)],
    [36, 36],
  )
  const drawerBeforeResize = await page.getByRole('dialog', { name: 'Mathverse AI 学习助手' }).boundingBox()
  const resizeCorner = await page.getByRole('button', { name: '调整对话框宽度和高度' }).boundingBox()
  await page.mouse.move(resizeCorner.x + resizeCorner.width / 2, resizeCorner.y + resizeCorner.height / 2)
  await page.mouse.down()
  await page.mouse.move(resizeCorner.x + 90, resizeCorner.y - 90, { steps: 8 })
  await page.mouse.up()
  const drawerAfterResize = await page.getByRole('dialog', { name: 'Mathverse AI 学习助手' }).boundingBox()
  assert.equal(drawerAfterResize.width < drawerBeforeResize.width, true)
  assert.equal(drawerAfterResize.height < drawerBeforeResize.height, true)
  await page.getByRole('button', { name: 'Qwen 百炼' }).click()
  await page.getByLabel('API Key').fill('assistant-browser-key')
  await page.getByRole('button', { name: 'Qwen 3.8 Max' }).click()
  assert.equal(await page.getByRole('textbox', { name: '模型' }).inputValue(), 'qwen3.8-max')
  assert.equal(await page.getByLabel('API Key').inputValue(), 'assistant-browser-key', 'same-host variants retain the key')
  await page.getByRole('button', { name: 'Kimi K3' }).click()
  assert.equal(await page.getByRole('textbox', { name: '模型' }).inputValue(), 'kimi-k3')
  assert.equal(await page.getByLabel('API Key').inputValue(), '', 'cross-provider switch clears the old key')
  await page.getByRole('button', { name: 'DeepSeek V4 Pro' }).click()
  assert.equal(await page.getByRole('textbox', { name: '模型' }).inputValue(), 'deepseek-v4-pro')
  await page.getByRole('button', { name: 'Qwen 百炼' }).click()
  await page.getByLabel('API Key').fill('assistant-browser-key')
  await page.getByRole('button', { name: '测试连接' }).click()
  await page.getByText('连接成功 · 42 Token', { exact: true }).waitFor()
  await page.getByRole('button', { name: '返回对话' }).click()
  const titleBox = await page.locator('.ai-assistant-header h2').boundingBox()
  const beforeMove = await page.getByRole('dialog', { name: 'Mathverse AI 学习助手' }).boundingBox()
  await page.mouse.move(titleBox.x + titleBox.width / 2, titleBox.y + titleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(titleBox.x + titleBox.width / 2 - 120, titleBox.y + titleBox.height / 2 + 25, { steps: 8 })
  await page.mouse.up()
  const afterMove = await page.getByRole('dialog', { name: 'Mathverse AI 学习助手' }).boundingBox()
  assert.equal(afterMove.x < beforeMove.x, true, 'drawer header should move the entire assistant')
  const upperBeforeSplit = await page.locator('.ai-assistant-workspace').boundingBox()
  const divider = await page.getByRole('separator', { name: '调整上方操作区与下方对话区高度' }).boundingBox()
  await page.mouse.move(divider.x + divider.width / 2, divider.y + divider.height / 2)
  await page.mouse.down()
  await page.mouse.move(divider.x + divider.width / 2, divider.y + divider.height / 2 + 40, { steps: 6 })
  await page.mouse.up()
  const upperAfterSplit = await page.locator('.ai-assistant-workspace').boundingBox()
  assert.equal(upperAfterSplit.height > upperBeforeSplit.height, true, 'divider should enlarge the upper workspace')
  await page.getByRole('separator', { name: '调整上方操作区与下方对话区高度' }).focus()
  await page.keyboard.press('ArrowUp')
  const upperAfterKey = await page.locator('.ai-assistant-workspace').boundingBox()
  assert.equal(upperAfterKey.height < upperAfterSplit.height, true, 'divider should support keyboard adjustment')

  assert.equal(await page.getByText(/P10002 · 2024 年全国甲卷/).isVisible(), true)
  const actionBar = page.getByRole('region', { name: '学习操作' })
  assert.equal(await actionBar.getByRole('button').count(), 4)
  const checkThinking = actionBar.getByRole('button', { name: /检查我的思路/ })
  assert.equal(await checkThinking.isDisabled(), true, 'checking needs a draft')
  await page.getByRole('button', { name: '深度', exact: true }).click()
  await actionBar.getByRole('button', { name: /给一个提示/ }).click()
  await page.getByText('先求导，观察导函数零点与符号变化。', { exact: true }).waitFor()
  const firstHintActions = page.locator('.ai-assistant-message.is-assistant').last()
  assert.equal(await firstHintActions.locator('button.is-primary').innerText(), '写下我的下一步')
  assert.equal(await firstHintActions.getByRole('button', { name: '再提示一点' }).isVisible(), true)
  assert.equal(await firstHintActions.getByRole('button', { name: '查看完整解答' }).isVisible(), true)
  await firstHintActions.getByRole('button', { name: '写下我的下一步' }).click()
  assert.equal(await page.locator('.ai-assistant-attempt textarea').evaluate((editor) => document.activeElement === editor), true)
  assert.equal(await actionBar.getByRole('button', { name: /再提示一点/ }).getAttribute('aria-pressed'), 'true')
  assert.equal(relayRequests[1].taskType, 'assistant-hint')
  assert.equal(relayRequests[1].reasoningLevel, 'deep')
  await page.getByRole('button', { name: '标准', exact: true }).click()
  assert.match(relayRequests[1].messages.at(-1).content, /f\(x\)=x³−3x²\+a/)
  assert.match(relayRequests[1].messages.at(-1).content, /第 0 级渐进提示/)
  assert.equal(await page.getByText('真实请求', { exact: true }).isVisible(), true)
  assert.equal(await page.getByText('42', { exact: true }).isVisible(), true)
  assert.equal(await page.getByText(/assistant-browser-request/).isVisible(), true)

  await actionBar.getByRole('button', { name: /再提示一点/ }).click()
  await page.getByText('当前焦点已看 2 条提示').waitFor()
  assert.equal(relayRequests.length, 3)
  assert.match(relayRequests[2].messages.at(-1).content, /第 1 级渐进提示/)
  assert.match(relayRequests[2].messages.at(-1).content, /此前已展示的提示/)

  const draft = page.locator('.ai-assistant-attempt textarea')
  await draft.fill('先求导：1 + 1 = 3')
  assert.equal(await checkThinking.isEnabled(), true)
  await checkThinking.click()
  await page.getByText('已验证的算术问题 · 第 1 步').waitFor()
  assert.equal(await page.locator('.ai-assistant-message.is-assistant').last()
    .locator('button.is-primary').innerText(), '修正这一行')
  assert.equal(relayRequests.length, 3)
  await draft.fill('先求导，得到 f′(x)=3x²−6x')
  await checkThinking.click()
  await page.getByText('AI 初步分析，尚未经确定性数学工具验证', { exact: false }).waitFor()
  assert.equal(relayRequests[3].taskType, 'assistant-diagnose')
  assert.equal(relayRequests[3].jsonMode, true)
  assert.equal(await page.getByText('已提交第 2 版').isVisible(), true)
  const diagnosisAction = page.locator('.ai-assistant-message.is-assistant').last().getByRole('button', { name: '继续补充草稿' })
  await diagnosisAction.click()
  assert.deepEqual(await draft.evaluate((editor) => [document.activeElement === editor, editor.selectionStart, editor.value.length]),
    [true, '先求导，得到 f′(x)=3x²−6x'.length, '先求导，得到 f′(x)=3x²−6x'.length])

  await actionBar.getByRole('button', { name: /^查看完整解答/ }).click()
  await page.getByText('当前焦点已查看完整解答').waitFor()
  assert.equal(relayRequests[4].taskType, 'assistant-solution')
  assert.match(relayRequests[4].messages.at(-1).content, /用户明确要求完整解答/)
  assert.equal(await page.locator('.ai-assistant-message.is-assistant').last()
    .locator('.ai-assistant-message-actions').count(), 0)
  assert.equal(await actionBar.getByRole('button', { name: /再提示一点/ }).isDisabled(), true)

  await actionBar.getByRole('button', { name: /解释当前题/ }).click()
  await page.waitForFunction(() => document.querySelectorAll('.ai-assistant-message.is-assistant').length >= 6)
  assert.equal(await actionBar.getByRole('button', { name: /解释当前题/ }).getAttribute('aria-pressed'), 'true')
  assert.equal(relayRequests[5].taskType, 'assistant-explain')
  assert.match(relayRequests[5].messages.at(-1).content, /分析这道题的考点/)
  assert.equal(await page.locator('.ai-assistant-message.is-assistant').last()
    .locator('button.is-primary').innerText(), '写下我的下一步')

  await delayNextModelResponse(page)
  await actionBar.getByRole('button', { name: /^查看完整解答/ }).click()
  await page.waitForFunction(() => Boolean(window.__releaseModelResponse))
  assert.equal(await actionBar.getByRole('button', { name: '停止本次操作' }).isVisible(), true)
  assert.equal(await actionBar.getByRole('button', { name: /^查看完整解答/ }).isDisabled(), true)
  await actionBar.getByRole('button', { name: '停止本次操作' }).click()
  await actionBar.getByRole('button', { name: '重试此操作' }).click()
  await page.waitForFunction(() => document.querySelectorAll('.ai-assistant-message.is-assistant').length >= 7)
  await releaseModelResponse(page, { content: '已取消的完整解答不应覆盖重试结果' })
  assert.equal(await page.getByText('已取消的完整解答不应覆盖重试结果', { exact: true }).count(), 0)
  assert.equal(relayRequests.at(-1).taskType, 'assistant-solution')

  const composer = page.getByPlaceholder('向 AI 提问…')
  const generationBudget = page.getByLabel('生成额度', { exact: true })
  await generationBudget.selectOption('32768')
  await composer.fill('请验证手动额度')
  let assistantCount = await page.locator('.ai-assistant-message.is-assistant').count()
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await page.waitForFunction((count) => document.querySelectorAll('.ai-assistant-message.is-assistant').length > count, assistantCount)
  assert.equal(relayRequests.at(-1).maxTokens, 32_768)
  assert.equal(relayRequests.at(-1).generationBudgetMode, 'manual')

  await generationBudget.selectOption('custom')
  await page.getByLabel('自定义 Token 上限').fill('25000')
  await composer.fill('请验证自定义额度')
  assistantCount = await page.locator('.ai-assistant-message.is-assistant').count()
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await page.waitForFunction((count) => document.querySelectorAll('.ai-assistant-message.is-assistant').length > count, assistantCount)
  assert.equal(relayRequests.at(-1).maxTokens, 25_000)

  await generationBudget.selectOption('auto')
  await composer.fill('请验证生成额度恢复')
  await page.getByRole('button', { name: '发送', exact: true }).click()
  const budgetFailure = page.locator('.ai-assistant-message.is-error').last()
  await budgetFailure.getByRole('button', { name: '调整生成额度' }).click()
  assert.equal(await generationBudget.evaluate((control) => document.activeElement === control), true)
  await generationBudget.selectOption('16384')
  assistantCount = await page.locator('.ai-assistant-message.is-assistant').count()
  await budgetFailure.getByRole('button', { name: '按当前额度重试' }).click()
  await page.waitForFunction((count) => document.querySelectorAll('.ai-assistant-message.is-assistant').length > count, assistantCount)
  assert.equal(relayRequests.at(-1).maxTokens, 16_384)
  assert.equal(relayRequests.at(-1).generationBudgetMode, 'manual')
  await generationBudget.selectOption('auto')

  const cancelledReply = '旧上下文的迟到结果不应显示'
  await delayNextModelResponse(page)
  await composer.fill('为什么选择这个方法？')
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await page.waitForFunction(() => Boolean(window.__releaseModelResponse))
  // A -> B -> A in the same tick defeats final-value comparisons alone.
  await page.getByLabel('随请求发送').evaluate((checkbox) => {
    checkbox.checked = false
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))
    checkbox.checked = true
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.getByText('题目、引用或发送范围已变化，旧请求已取消。请按当前上下文重试。', { exact: true }).waitFor()
  await page.getByRole('button', { name: '按当前上下文重试', exact: true }).last().click()
  await page.getByRole('button', { name: '发送', exact: true }).waitFor()
  await releaseModelResponse(page, { content: cancelledReply, providerRequestId: 'stale-request', model: 'stale-model' })
  assert.equal(await page.getByText(cancelledReply, { exact: true }).count(), 0)
  assert.equal(await page.getByText(/stale-request|stale-model/).count(), 0, 'stale completion must not replace call metadata')
  assert.equal(await page.getByText('当前焦点已查看完整解答').isVisible(), true)

  await delayNextModelResponse(page)
  await checkThinking.click()
  await page.waitForFunction(() => Boolean(window.__releaseModelResponse))
  await draft.evaluate((textarea) => {
    const original = textarea.value
    textarea.value += '（修改中）'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    textarea.value = original
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.getByText('草稿已修改，旧分析已取消。请重新检查。', { exact: true }).waitFor()
  await releaseModelResponse(page, { content: JSON.stringify({
    routeStatus: 'valid', firstIssueStep: null, feedback: cancelledReply, nextQuestion: '',
  }) })
  assert.equal(await page.getByText(cancelledReply, { exact: true }).count(), 0)

  await delayNextModelResponse(page)
  await composer.fill('说明一下判断条件')
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await page.waitForFunction(() => Boolean(window.__releaseModelResponse))
  await page.getByRole('button', { name: '停止', exact: true }).click()
  await page.getByText('已停止本次请求。你可以修改问题后发送，或重新尝试。', { exact: true }).last().waitFor()
  await releaseModelResponse(page, { error: { message: '迟到的旧错误' } }, 500)
  assert.equal(await page.getByText('迟到的旧错误', { exact: true }).count(), 0)

  await delayNextModelResponse(page)
  await composer.fill('准备清空的请求')
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await page.waitForFunction(() => Boolean(window.__releaseModelResponse))
  await page.getByRole('button', { name: '清空当前对话', exact: true }).click()
  await releaseModelResponse(page, { content: cancelledReply })
  assert.equal(await page.locator('.ai-assistant-message').count(), 0, 'clearing cannot be undone by a pending request')
  assert.equal(await page.getByText('当前焦点已查看完整解答').isVisible(), true)

  await delayNextModelResponse(page)
  await composer.fill('失败后保留我的提问')
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await page.waitForFunction(() => Boolean(window.__releaseModelResponse))
  await releaseModelResponse(page, { error: { message: '模型暂时不可用' } }, 503)
  await page.getByText('模型暂时不可用', { exact: true }).waitFor()
  assert.equal(await composer.inputValue(), '失败后保留我的提问')

  await page.getByLabel('随请求发送').uncheck()
  await composer.fill('只回答这个新问题')
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await page.getByRole('button', { name: '发送', exact: true }).waitFor()
  assert.equal(relayRequests.at(-1).messages.length, 2, 'detached requests omit problem-scoped history')
  assert.equal(relayRequests.at(-1).messages.at(-1).content, '只回答这个新问题')

  await page.getByLabel('随请求发送').check()
  await page.getByRole('button', { name: /比较解法路线/ }).click()
  await page.getByText('解法路线图 · AI 初步比较').waitFor()
  assert.equal(await page.getByText('换路信号：导数难以整理时换路').isVisible(), true)
  assert.equal(relayRequests.at(-1).taskType, 'assistant-strategy')
  assert.equal(relayRequests.at(-1).jsonMode, true)

  await delayNextModelResponse(page)
  await composer.fill('请解释这道题里的公式')
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await page.waitForFunction(() => Boolean(window.__releaseModelResponse))
  await releaseModelResponse(page, { content: String.raw`行内 $f_a'(x)=3(x^2-a)$，又有 \(x=\sqrt a\)。
\[f_a(\sqrt a)=2-2a^{3/2}\]
<img src=x onerror=alert(1)>` })
  const mathReply = page.locator('.ai-assistant-message.is-assistant').last()
  await mathReply.locator('.katex').first().waitFor()
  assert.equal(await mathReply.locator('.katex').count(), 3, 'inline and display math should render')
  assert.equal(await mathReply.locator('img').count(), 0, 'model HTML stays escaped')

  await page.getByText('设置', { exact: true }).click()
  await page.getByRole('button', { name: '返回对话' }).click()
  await page.getByRole('button', { name: /寻找相似题/ }).click()
  await page.waitForURL('**/similar-problems**')
  await page.getByText('外部 API', { exact: true }).click()
  assert.equal(await page.getByLabel(/^模型名称/).inputValue(), 'qwen3.8-flash')
  assert.equal(await page.getByLabel(/API Key/).inputValue(), 'assistant-browser-key')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${origin}/problems/P10002`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '打开 Mathverse AI 助手' }).click()
  const returnToChat = page.getByRole('button', { name: '返回对话' })
  if (await returnToChat.isVisible()) await returnToChat.click()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  await actionBar.getByRole('button', { name: /^查看完整解答/ }).scrollIntoViewIfNeeded()
  const mobileAction = await actionBar.getByRole('button', { name: /^查看完整解答/ }).boundingBox()
  const mobileDrawer = await page.getByRole('dialog', { name: 'Mathverse AI 学习助手' }).boundingBox()
  assert.ok(mobileAction.y >= mobileDrawer.y && mobileAction.y + mobileAction.height <= mobileDrawer.y + mobileDrawer.height)
  assert.equal(await composer.isVisible(), true)
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('button', { name: '打开 Mathverse AI 助手' }).isVisible(), true)
  assert.equal(pageErrors.length, 0)
  console.log('AI assistant: context integrity, stale success/error cancellation, retry, privacy, progressive hints, diagnosis and mobile layout passed')
})()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await browser?.close()
    server?.kill()
  })

/* global require, __dirname, process */
