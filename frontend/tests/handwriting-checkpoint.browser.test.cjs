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
  let _release
  const requests = []
  await page.route('**/__mathverse_similarity_proxy', async (route) => {
    const request = route.request().postDataJSON()
    requests.push(request)
    if (providerMode === 'failure') return route.fulfill({ status: 503, json: { error: { message: '识别服务暂时不可用' } } })
    if (providerMode === 'late') await new Promise((resolve) => { _release = resolve })
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
  const { readInkCheckpoint } = await page.evaluate(async () => ({ readInkCheckpoint: await (await import('/src/features/draft/draftStore.js')).readInkCheckpoint('user:agent-test-admin', 'P30001') }))
  assert.equal(readInkCheckpoint, null, 'default handwriting does not persist a selected image')
  const editor = drawer.locator('.ai-assistant-attempt textarea')
  async function saveBackup() {
    let committed = false
    for (let i = 0; i < 100; i++) {
      committed = await page.evaluate(async () => {
        const { handwritingRequest } = await import('/src/features/draft/draftAgentBridge.js')
        const { readDraft } = await import('/src/features/draft/draftStore.js')
        const { draftSceneSignature } = await import('/src/features/draft/inkSelection.js')
        const scene = await readDraft('user:agent-test-admin', 'P30001')
        return Boolean(scene && draftSceneSignature(scene) === handwritingRequest.value?.sceneSignature)
      })
      if (committed) break
      await delay(100)
    }
    assert.ok(committed, 'native source is committed before backing up selected handwriting')
    await panel.getByRole('button', { name: '保存本题手写备份', exact: true }).click()
    await panel.getByText(/^已保存本题手写备份/).waitFor()
  }
  await editor.fill('2+2=7')
  await saveBackup()
  const identity = await page.evaluate(async () => {
    const value = await (await import('/src/features/draft/draftStore.js')).readInkCheckpoint('user:agent-test-admin', 'P30001')
    return { id: value.submitted.id, version: value.submitted.version, text: value.text, editor: value.editorText,
      blobSize: value.snapshot.originalBlob.size, points: JSON.parse(value.snapshot.rawScene).elements[0].points.length,
      secretFree: !JSON.stringify(value).includes('handwriting-mock-key') }
  })
  assert.equal(identity.version, 1)
  assert.equal(identity.text, '2+2=5')
  assert.equal(identity.editor, '2+2=7')
  assert.ok(identity.blobSize > 0 && identity.points > 2 && identity.secretFree)
  let checkpointAccount = 'B'
  await page.route('**/api/v1/auth/me*', (route) => route.fulfill({ json: checkpointAccount
    ? { authenticated: true, user: { id: checkpointAccount, role: 'ADMIN' } } : { authenticated: true, user: { id: 'agent-test-admin', username: 'Agent regression', role: 'ADMIN' } } }))
  await page.evaluate(async () => { await (await import('/src/services/authService.js')).authService.me() })
  assert.equal(await panel.count(), 0, 'switching accounts removes the previous selected source')
  await drawer.getByRole('button', { name: '恢复本题已保存手写', exact: true }).click()
  await drawer.getByText('本题没有主动保存的手写备份', { exact: true }).waitFor()
  assert.equal(await page.evaluate(async () => (await import('/src/features/draft/draftStore.js')).readInkCheckpoint('user:B', 'P30001')), null)
  checkpointAccount = null
  await page.evaluate(async () => { await (await import('/src/services/authService.js')).authService.me() })
  async function reloadToChat() {
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('button', { name: '打开 Mathverse AI 助手' }).click()
    const back = drawer.getByRole('button', { name: '返回对话', exact: true })
    if (await back.isVisible()) await back.click()
  }
  // Recover an unconfirmed image draft; it must not become a typed-only checkpoint.
  await page.evaluate(async () => {
    const store = await import('/src/features/draft/draftStore.js')
    const record = await store.readInkCheckpoint('user:agent-test-admin', 'P30001')
    await store.writeInkCheckpoint('user:agent-test-admin', 'test-confirmed-baseline', record)
    record.submitted = null
    await store.writeInkCheckpoint('user:agent-test-admin', 'P30001', record)
  })
  await reloadToChat()
  await drawer.getByRole('button', { name: '恢复本题已保存手写', exact: true }).click()
  await panel.waitFor()
  assert.equal(await text.inputValue(), '2+2=5')
  assert.equal(await editor.inputValue(), '2+2=7')
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
  const typedOnly = await page.evaluate(() => sessionStorage.getItem('mathverse:agent:attempt-checkpoint:v1'))
  assert.doesNotMatch(typedOnly || '', /2\+2=5|2\+2=7|saved-ink|data:image/, 'unconfirmed restored image text cannot silently become typed provenance')
  await page.evaluate(async () => {
    const store = await import('/src/features/draft/draftStore.js')
    await store.writeInkCheckpoint('user:agent-test-admin', 'P30001', await store.readInkCheckpoint('user:agent-test-admin', 'test-confirmed-baseline'))
    await store.deleteInkCheckpoint('user:agent-test-admin', 'test-confirmed-baseline')
  })
  await reloadToChat()
  assert.equal(await panel.count(), 0, 'no automatic image restoration')
  assert.equal(requests.length, 1, 'no automatic recognition or paid resume')
  await drawer.getByRole('button', { name: '恢复本题已保存手写', exact: true }).click()
  await panel.waitFor()
  assert.equal(await text.inputValue(), '2+2=5')
  assert.equal(await editor.inputValue(), '2+2=7')
  await panel.getByRole('button', { name: '选择视觉模型 / 填写 Key' }).click()
  await drawer.getByRole('button', { name: 'Qwen 手写识别', exact: true }).click()
  assert.equal(await drawer.getByLabel('API Key', { exact: true }).inputValue(), '', 'backup never restores credentials')
  await drawer.getByLabel('API Key', { exact: true }).fill('handwriting-mock-key')
  await drawer.getByRole('button', { name: '返回对话', exact: true }).click()
  assert.equal(await consent.isChecked(), false, 'image-send authorization is not restored')
  const confirmReading = panel.getByRole('checkbox', { name: '我已核对原图，关键符号和步骤顺序准确' })
  assert.equal(await confirmReading.isChecked(), false)
  assert.equal(await panel.getByRole('button', { name: '确认读法并检查' }).isDisabled(), true)
  assert.equal(await drawer.locator('.ai-assistant-message.is-assistant').count(), 0, 'no old diagnosis restored')
  await drawer.getByRole('button', { name: /^检查我的思路/ }).click()
  await drawer.getByText(/恢复的手写需先在上方重新核对原图并确认读法/).waitFor()
  assert.equal(requests.length, 1, 'general diagnosis cannot bypass renewed reading confirmation')
  await drawer.getByText('已提交第 1 版', { exact: true }).waitFor({ state: 'hidden' })
  await confirmReading.check()
  await panel.getByRole('button', { name: '确认读法并检查' }).click()
  await drawer.getByText('第 1 版草稿反馈 · 对应当前草稿', { exact: true }).waitFor()
  assert.equal(requests.length, 1, 'same text recheck remains local and keeps its version')
  await text.fill('2+2=7')
  await confirmReading.check()
  await panel.getByRole('button', { name: '确认读法并检查' }).click()
  await drawer.getByText('第 2 版草稿反馈 · 对应当前草稿', { exact: true }).waitFor()
  await saveBackup()
  const after = await page.evaluate(async () => (await (await import('/src/features/draft/draftStore.js')).readInkCheckpoint('user:agent-test-admin', 'P30001')).submitted)
  assert.equal(after.id, identity.id)
  assert.equal(after.version, 2)
  // Deny only checkpoint writes, preserving independent native canvas storage.
  await page.evaluate(() => {
    window.nativePut = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (value, key) {
      if (String(key).startsWith('ink-checkpoint:')) throw new DOMException('备份空间不足', 'QuotaExceededError')
      return window.nativePut.call(this, value, key)
    }
  })
  await text.fill('2+2=8')
  await panel.getByRole('button', { name: '保存本题手写备份', exact: true }).click()
  await panel.getByText(/备份空间不足/).waitFor()
  assert.equal(await text.inputValue(), '2+2=8')
  assert.equal(await panel.getByAltText('本次选择的手写区域').isVisible(), true)
  await page.evaluate(() => { IDBObjectStore.prototype.put = window.nativePut })
  assert.equal(await page.evaluate(async () => (await (await import('/src/features/draft/draftStore.js')).readInkCheckpoint('user:agent-test-admin', 'P30001')).text), '2+2=7')
  // Tampered preview is rejected before an image can be displayed or sent.
  await page.evaluate(async () => {
    const store = await import('/src/features/draft/draftStore.js')
    const record = await store.readInkCheckpoint('user:agent-test-admin', 'P30001')
    record.snapshot.dataUrl = 'https://private.example/tampered'
    await store.writeInkCheckpoint('user:agent-test-admin', 'P30001', record)
  })
  page.on('dialog', (dialog) => dialog.accept())
  await drawer.getByRole('button', { name: '恢复本题已保存手写', exact: true }).click()
  await drawer.getByText(/手写备份格式或来源无效/).waitFor()
  assert.equal(await text.inputValue(), '2+2=8', 'failed restore preserves current page edits')
  await saveBackup()
  await page.evaluate(async () => {
    const store = await import('/src/features/draft/draftStore.js')
    const original = await store.readDraft('user:agent-test-admin', 'P30001')
    const metadata = { ...original, appState: { ...original.appState, scrollX: 777 } }
    await store.writeDraft('user:agent-test-admin', 'P30001', metadata)
    if ((await store.readDraft('user:agent-test-admin', 'P30001')).sourceVersion !== original.sourceVersion) throw new Error('metadata should preserve source version')
    const changed = structuredClone(original)
    changed.elements[0].x += 10
    await store.writeDraft('user:agent-test-admin', 'P30001', changed)
    await store.writeDraft('user:agent-test-admin', 'P30001', original)
    if ((await store.readDraft('user:agent-test-admin', 'P30001')).sourceVersion === original.sourceVersion) throw new Error('edit then undo must advance durable source identity')
  })
  await reloadToChat()
  await drawer.getByRole('button', { name: '恢复本题已保存手写', exact: true }).click()
  await drawer.getByText(/画板来源已变化，旧备份不能作为当前草稿恢复/).waitFor()
  assert.equal(await panel.count(), 0)
  await drawer.getByRole('button', { name: '删除本题手写备份', exact: true }).click()
  await drawer.getByText(/本机手写备份已删除/).waitFor()
  await reloadToChat()
  await drawer.getByRole('button', { name: '恢复本题已保存手写', exact: true }).click()
  await drawer.getByText('本题没有主动保存的手写备份', { exact: true }).waitFor()
  assert.equal(requests.length, 1)
  assert.deepEqual(pageErrors, [])
  console.log('PASS handwriting checkpoint: opt-in source-complete save, edited text, refresh, consent reset, version continuity, failed writes, corruption rejection, undo expiry and deletion')
})().catch((error) => { console.error(error); process.exitCode = 1 }).finally(async () => { await browser?.close(); server?.kill() })
