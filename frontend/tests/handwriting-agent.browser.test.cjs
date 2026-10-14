const { browserExecutable, getTestPort } = require('./browser-support.cjs')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const assert = require('node:assert/strict')
const path = require('node:path')
const { chromium } = require('playwright')
let browser, server
;(async () => {
  const port = await getTestPort()
  const origin = `http://127.0.0.1:${port}`
  server = spawn(process.execPath, [path.resolve(__dirname, '../node_modules/vite/bin/vite.js'),
    '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: path.resolve(__dirname, '..'), windowsHide: true, stdio: 'inherit' })
  let ready = false
  for (let i = 0; i < 500; i += 1) {
    try { if ((await fetch(origin)).ok) { ready = true; break } } catch {}
    await delay(100)
  }
  assert.ok(ready, 'test server ready')
  browser = await chromium.launch({ executablePath: browserExecutable, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(e.message))
  await page.route('**/api/**', (route) => route.fulfill({ json: route.request().url().endsWith('/api/v1/problems/P30001') ? {
    id: 'P30001', title: '手写草稿接入', type: 'solution', typeLabel: '解答题',
    content: '核对自己的运算过程。', tags: ['代数'], answer: '参考答案秘密', solution: '参考解析秘密',
  } : { authenticated: true, user: { id: 'agent-test-admin', username: 'Agent regression', role: 'ADMIN' } } }))
  let providerMode = 'normal'
  let release
  const requests = []
  await page.route('**/__mathverse_similarity_proxy', async (route) => {
    const request = route.request().postDataJSON()
    requests.push(request)
    if (providerMode === 'failure') return route.fulfill({ status: 503, json: { error: { message: '识别服务暂时不可用' } } })
    if (providerMode === 'late') await new Promise((resolve) => { release = resolve })
    const response = request.taskType === 'assistant-handwriting-recognition'
      ? { blocks: [{ text: '[无法辨认]', alternatives: ['2+2=5', '2+2=6'], confidence: .4, uncertainty: '末尾数字' }] }
      : { routeStatus: 'valid_but_incomplete', firstIssueStep: null, feedback: 'AI 初步判断，仍需核验条件。', nextQuestion: '' }
    try { await route.fulfill({ json: { content: JSON.stringify(response), model: request.model } }) } catch {}
  })
  await page.goto(`${origin}/problems/P30001`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '展开草稿区', exact: true }).click()
  await page.getByRole('button', { name: '全屏', exact: true }).click()
  const canvas = page.locator('.excalidraw__canvas.interactive')
  await canvas.waitFor({ timeout: 60000 })
  const stage = page.locator('.question-draft-stage')
  await stage.scrollIntoViewIfNeeded()
  async function draw(fraction) {
    await page.locator('[data-testid="toolbar-freedraw"]').click({ force: true })
    await canvas.scrollIntoViewIfNeeded()
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const box = await canvas.boundingBox()
    const startX = box.x + box.width * .5
    const y = box.y + box.height * fraction
    await page.mouse.move(startX, y)
    await page.mouse.down()
    for (let i = 1; i <= 12; i += 1) await page.mouse.move(startX + i * 9, y + Math.sin(i / 3) * 14)
    await page.mouse.up()
  }
  async function selectFirst() {
    await page.locator('[data-testid="toolbar-selection"]').click({ force: true })
    await canvas.scrollIntoViewIfNeeded()
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const box = await canvas.boundingBox()
    const startX = box.x + box.width * .5
    const startY = box.y + box.height * .35
    await page.mouse.move(startX - 18, startY - 25)
    await page.mouse.down()
    await page.mouse.move(startX + 135, startY + 25, { steps: 8 })
    await page.mouse.up()
  }
  await draw(.35)
  await draw(.65)
  await selectFirst()
  await page.getByRole('button', { name: '提交选区给 AI', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Mathverse AI 学习助手' })
  // The section has an accessible name; use its stable class where no region role is exposed.
  const panel = drawer.locator('.ai-handwriting-review')
  await panel.waitFor()
  assert.equal(requests.length, 0, 'no image leaves the browser on selection submission')
  const source = await page.evaluate(async () => {
    const { handwritingRequest } = await import('/src/features/draft/draftAgentBridge.js')
    const artifact = handwritingRequest.value
    return { scene: JSON.parse(artifact.rawScene), width: artifact.width, height: artifact.height }
  })
  assert.equal(source.scene.elements.length, 1, 'unselected second stroke must not be exported')
  assert.ok(source.scene.elements[0].points.length > 2, 'native pen points remain available')
  assert.ok(source.height < 100, 'PNG bounds contain only the selected stroke')
  await panel.getByRole('button', { name: '选择视觉模型 / 填写 Key' }).click()
  await drawer.getByRole('button', { name: 'DeepSeek', exact: true }).click()
  await drawer.getByLabel('API Key', { exact: true }).fill('handwriting-mock-key')
  await drawer.getByRole('button', { name: '返回对话', exact: true }).click()
  assert.equal(await panel.getByRole('button', { name: '识别手写选区', exact: true }).isDisabled(), true)
  await panel.getByRole('button', { name: '选择视觉模型 / 填写 Key' }).click()
  await drawer.getByRole('button', { name: 'Qwen 手写识别', exact: true }).click()
  assert.equal(await drawer.getByLabel('API Key', { exact: true }).inputValue(), '', 'host switch clears the other provider key')
  await drawer.getByLabel('API Key', { exact: true }).fill('handwriting-mock-key')
  await drawer.getByRole('button', { name: '返回对话', exact: true }).click()
  const consent = panel.getByRole('checkbox', { name: '我同意将此选区发送给上述模型用于识别' })
  await drawer.getByLabel('生成额度', { exact: true }).selectOption('8192')
  assert.equal(await consent.isChecked(), false)
  await consent.check()
  await panel.getByRole('button', { name: '识别手写选区', exact: true }).click()
  const text = panel.getByLabel('手写转录内容', { exact: true })
  await panel.getByText(/待核对：末尾数字/).waitFor()
  assert.equal(await text.inputValue(), '[无法辨认]')
  assert.equal(await panel.getByRole('button', { name: '确认读法并检查' }).isDisabled(), true)
  assert.equal(await drawer.locator('.ai-assistant-message.is-assistant').count(), 0)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].maxTokens, 8192)
  assert.equal(requests[0].generationBudgetMode, 'manual')
  assert.equal(requests[0].messages[1].content[1].type, 'image_url')
  assert.doesNotMatch(JSON.stringify(requests[0].messages), /参考答案秘密|参考解析秘密|核对自己的运算过程/)
  await text.fill('2+2=5')
  const replacement = panel.getByRole('checkbox', { name: '再次识别时，用新读法替换我修改或手动填写的转录' })
  assert.equal(await replacement.isChecked(), false)
  assert.equal(await panel.getByRole('button', { name: '识别手写选区', exact: true }).isDisabled(), true,
    'retry cannot silently overwrite a learner correction')
  await replacement.check()
  await panel.getByRole('button', { name: '识别手写选区', exact: true }).click()
  assert.equal(await text.inputValue(), '[无法辨认]', 'explicit replacement also applies to cached recognition')
  assert.equal(await panel.getByRole('checkbox', { name: '我已核对原图，关键符号和步骤顺序准确' }).isChecked(), false)
  assert.equal(requests.length, 1, 'same source/model retry reuses cached recognition')
  await text.fill('2+2=5')
  await replacement.check()
  // Going to settings preserves a manual correction and revokes image-send authorization.
  await panel.getByRole('button', { name: '选择视觉模型 / 填写 Key' }).click()
  await drawer.getByRole('button', { name: '返回对话', exact: true }).click()
  assert.equal(await text.inputValue(), '2+2=5')
  assert.equal(await consent.isChecked(), false)
  assert.equal(await replacement.isChecked(), false, 'settings cannot retain permission to replace learner edits')
  await panel.getByRole('checkbox', { name: '我已核对原图，关键符号和步骤顺序准确' }).check()
  await panel.getByRole('button', { name: '确认读法并检查' }).click()
  await drawer.getByText('已验证的算术问题 · 第 1 步', { exact: true }).waitFor()
  assert.equal(requests.length, 1, 'confirmed arithmetic goes through the same deterministic checker')
  const stored = await page.evaluate(() => sessionStorage.getItem('mathverse:agent:attempt-checkpoint:v1'))
  assert.doesNotMatch(stored, /2\+2=5|ink_snapshot|data:image/, 'refresh must not strip handwriting provenance')
  if (process.env.HANDWRITING_SCREENSHOT) await page.screenshot({ path: process.env.HANDWRITING_SCREENSHOT })
  await drawer.getByRole('button', { name: '关闭 AI 助手', exact: true }).click()
  await stage.scrollIntoViewIfNeeded()
  const nextBox = await canvas.boundingBox()
  await page.locator('[data-testid="toolbar-freedraw"]').click({ force: true })
  await page.mouse.move(nextBox.x + nextBox.width * .5, nextBox.y + nextBox.height * .8)
  await page.mouse.down()
  await page.mouse.move(nextBox.x + nextBox.width * .5 + 50, nextBox.y + nextBox.height * .8 + 12, { steps: 5 })
  await page.mouse.up()
  await page.getByRole('button', { name: '打开 Mathverse AI 助手' }).click()
  await panel.getByText(/画板已修改，此选区/).waitFor()
  assert.match(await drawer.locator('.ai-assistant-message.is-assistant').textContent(), /已过期/)
  assert.equal(await panel.getByRole('button', { name: '确认读法并检查' }).isDisabled(), true)
  // Detaching explicitly makes the reviewed transcription a new typed version.
  await panel.getByRole('button', { name: '按文字草稿继续', exact: true }).click()
  assert.equal(await panel.count(), 0)
  await drawer.getByRole('button', { name: /^检查我的思路/ }).click()
  await drawer.getByText('第 2 版草稿反馈 · 对应当前草稿', { exact: true }).waitFor()
  await drawer.getByRole('button', { name: '关闭 AI 助手', exact: true }).click()
  await page.getByRole('button', { name: '全屏', exact: true }).click()
  await page.locator('[data-testid="toolbar-selection"]').click({ force: true })
  const retryBox = await canvas.boundingBox()
  await page.mouse.click(retryBox.x + retryBox.width * .5, retryBox.y + retryBox.height * .9)
  await page.keyboard.press('ControlOrMeta+A')
  await page.getByRole('button', { name: '提交选区给 AI', exact: true }).click()
  await panel.waitFor()
  providerMode = 'failure'
  await text.fill('手动转录：2+2=7')
  await consent.check()
  await replacement.check()
  await panel.getByRole('button', { name: '识别手写选区', exact: true }).click()
  await panel.getByText(/识别服务暂时不可用/).waitFor()
  assert.equal(await panel.getByAltText('本次选择的手写区域').isVisible(), true)
  assert.equal(await text.inputValue(), '手动转录：2+2=7', 'failed replacement preserves manual transcription')
  assert.equal(await replacement.isChecked(), false)
  providerMode = 'late'
  await replacement.check()
  await panel.getByRole('button', { name: '识别手写选区', exact: true }).click()
  for (let i = 0; i < 50 && !release; i += 1) await delay(50)
  assert.ok(release, 'recognition request is in flight')
  await panel.getByRole('button', { name: '停止识别', exact: true }).click()
  release()
  assert.equal(await text.inputValue(), '手动转录：2+2=7', 'stopping replacement preserves manual transcription')
  assert.equal(await replacement.isChecked(), false)
  release = null
  await replacement.check()
  await panel.getByRole('button', { name: '识别手写选区', exact: true }).click()
  for (let i = 0; i < 50 && !release; i += 1) await delay(50)
  assert.ok(release, 'next retry has a new request')
  // Draw in the visible canvas while recognition is pending: source change cancels it.
  await draw(.8)
  await panel.getByText(/画板已修改，此选区/).waitFor()
  release()
  assert.equal(await text.inputValue(), '手动转录：2+2=7', 'a late recognition cannot replace manual transcription')
  assert.equal(await panel.getByRole('button', { name: '确认读法并检查' }).isDisabled(), true)
  await panel.getByRole('button', { name: '移除此选区与识别', exact: true }).click()
  assert.equal(await panel.count(), 0)
  assert.equal(await drawer.locator('.ai-assistant-attempt textarea').inputValue(), '2+2=5', 'removing an unconfirmed image must preserve the existing typed draft')
  await page.setViewportSize({ width: 390, height: 844 })
  assert.ok(await drawer.isVisible())
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(pageErrors, [])
  console.log('PASS handwriting: selected native ink, consent, correction protection, explicit cache replacement, failed/stopped/late retry recovery, shared checker and stale source')
})().catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(async () => { await browser?.close(); server?.kill() })
