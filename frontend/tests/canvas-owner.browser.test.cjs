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
  server = spawn(process.execPath, [path.resolve(__dirname, '../node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: path.resolve(__dirname, '..'), windowsHide: true, stdio: 'inherit' })
  let ready = false
  for (let i = 0; i < 500; i++) { try { if ((await fetch(origin)).ok) { ready = true; break } } catch {} await delay(100) }
  assert.ok(ready)
  browser = await chromium.launch({ executablePath: browserExecutable, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (dialog) => dialog.accept())
  let owner = 'A', denied = false, paidCalls = 0
  await page.route('**/api/**', (route) => {
    const url = route.request().url()
    if (url.endsWith('/auth/me')) return route.fulfill(denied ? { status: 503, json: { error: { message: '身份暂不可用' } } } : { json: owner ? { authenticated: true, user: { id: owner, role: 'ADMIN' } } : { authenticated: false } })
    return route.fulfill({ json: url.endsWith('/problems/P30001') ? { id: 'P30001', title: '账号画板回归', type: 'solution', typeLabel: '解答题', content: '核对草稿', tags: [] } : [] })
  })
  await page.route('**/__mathverse_similarity_proxy', (route) => { paidCalls++; return route.fulfill({ status: 500, json: {} }) })
  await page.goto(`${origin}/problems/P30001`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '展开草稿区', exact: true }).click()
  await page.getByRole('button', { name: '全屏', exact: true }).click()
  const canvas = page.locator('.excalidraw__canvas.interactive')
  await canvas.waitFor({ timeout: 60000 })
  await page.locator('[data-testid="toolbar-freedraw"]').click({ force: true })
  await canvas.scrollIntoViewIfNeeded()
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  const box = await canvas.boundingBox()
  await page.mouse.move(box.x + box.width * .4, box.y + box.height * .5)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * .4 + 100, box.y + box.height * .5 + 20, { steps: 10 })
  await page.mouse.up()
  let a
  for (let i = 0; i < 100; i++) {
    a = await page.evaluate(async () => (await import('/src/features/draft/draftStore.js')).readDraft('user:A', 'P30001'))
    if (a?.elements?.length === 1) break
    await delay(100)
  }
  assert.equal(a?.elements?.length, 1, 'actual drawn stroke commits to account A')
  assert.ok(a.elements[0].points.length > 2)
  await page.locator('[data-testid="toolbar-selection"]').click({ force: true })
  await page.mouse.click(box.x + box.width * .8, box.y + box.height * .8)
  await page.keyboard.press('ControlOrMeta+A')
  await page.getByRole('button', { name: '提交选区给 AI', exact: true }).click()
  await page.locator('.ai-handwriting-review').waitFor()
  await page.evaluate(async () => { window.ownerCapture = (await import('/src/features/draft/draftAgentBridge.js')).handwritingRequest.value })
  await page.getByRole('button', { name: '关闭 AI 助手', exact: true }).click()
  async function changeOwner(value) {
    owner = value
    await page.evaluate(async () => { await (await import('/src/services/authService.js')).authService.me() })
    await canvas.waitFor()
  }
  await changeOwner('B')
  assert.equal(await page.evaluate(async () => (await import('/src/features/draft/draftAgentBridge.js')).isHandwritingCurrent(window.ownerCapture)), false)
  assert.equal(await page.evaluate(async () => (await import('/src/features/draft/draftStore.js')).readDraft('user:B', 'P30001')), null)
  await page.getByRole('button', { name: '全屏', exact: true }).click()
  await page.locator('.question-draft-menu').getByRole('button', { name: '导出', exact: false }).click()
  await page.getByRole('menuitem', { name: 'PNG 图片' }).click()
  await page.getByText('草稿还是空的，先写点东西吧', { exact: true }).waitFor()
  await page.getByRole('button', { name: '返回题目', exact: true }).click()
  await changeOwner('A')
  await page.getByText('已恢复本机草稿', { exact: true }).waitFor()
  assert.equal(await page.evaluate(async () => (await import('/src/features/draft/draftAgentBridge.js')).isHandwritingCurrent(window.ownerCapture)), false, 'A→B→A cannot revive old selected source')
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '展开草稿区', exact: true }).click()
  await page.getByText('已恢复本机草稿', { exact: true }).waitFor()
  // Seed the teammate's old unscoped record without assigning it to an account.
  await page.evaluate(async (scene) => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('mathverse-draft', 1)
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('scenes', 'readwrite')
        tx.objectStore('scenes').put({ ...scene, format: 'excalidraw-0.18', version: 1 }, 'question-P30001')
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => reject(tx.error)
      }
    })
  }, a)
  await changeOwner('B')
  await page.getByRole('button', { name: '确认归属并导入旧版草稿', exact: true }).waitFor()
  assert.equal(await page.evaluate(async () => (await import('/src/features/draft/draftStore.js')).readDraft('user:B', 'P30001')), null)
  await page.getByRole('button', { name: '确认归属并导入旧版草稿', exact: true }).click()
  await page.getByText('已恢复本机草稿', { exact: true }).waitFor()
  assert.equal((await page.evaluate(async () => (await import('/src/features/draft/draftStore.js')).readDraft('user:B', 'P30001'))).elements[0].id, a.elements[0].id)
  await page.getByRole('button', { name: '删除本题已保存画板', exact: true }).click()
  await page.getByText('空白草稿', { exact: true }).waitFor()
  assert.equal(await page.evaluate(async () => (await import('/src/features/draft/draftStore.js')).readDraft('user:B', 'P30001')), null)
  assert.ok(await page.evaluate(async () => (await import('/src/features/draft/draftStore.js')).readDraft('user:A', 'P30001')))
  assert.ok(await page.evaluate(async () => (await import('/src/features/draft/draftStore.js')).readLegacyDraft('P30001')))
  // Native transaction abort after request success must reject, never report saved.
  const transactionResult = await page.evaluate(async () => {
    const store = await import('/src/features/draft/draftStore.js')
    const original = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = function (...args) {
      const tx = original.apply(this, args)
      if (args[1] === 'readwrite') {
        const nativeStore = tx.objectStore.bind(tx)
        tx.objectStore = (...names) => {
          const object = nativeStore(...names), put = object.put.bind(object)
          object.put = (...values) => { const request = put(...values); request.addEventListener('success', () => tx.abort()); return request }
          return object
        }
      }
      return tx
    }
    let rejected = false
    try { await store.writeDraft('user:B', 'abort', { elements: [], appState: {}, files: {} }) } catch { rejected = true }
    finally { IDBDatabase.prototype.transaction = original }
    const scene = { elements: [{ id: 'queued' }], appState: {}, files: { unused: { dataURL: 'private-unused' } } }
    const save = store.writeDraft('user:B', 'queue', scene)
    scene.elements[0].id = 'mutated'
    const saved = await store.readDraft('user:B', 'queue')
    await save
    await Promise.all([store.writeDraft('user:B', 'queue', scene), store.deleteDraft('user:B', 'queue')])
    return { rejected, aborted: await store.readDraft('user:B', 'abort'), savedId: saved.elements[0].id, unused: Object.keys(saved.files).length, removed: await store.readDraft('user:B', 'queue') }
  })
  assert.deepEqual(transactionResult, { rejected: true, aborted: null, savedId: 'queued', unused: 0, removed: null })
  denied = true
  await page.evaluate(async () => { try { await (await import('/src/services/authService.js')).authService.me() } catch {} })
  await page.getByText(/账号尚未确认，暂不打开或保存画板/).waitFor()
  assert.equal(await canvas.count(), 0)
  denied = false
  owner = null
  await page.getByRole('button', { name: '重新确认账号', exact: true }).click()
  await canvas.waitFor()
  await page.getByText(/当前为访客草稿/).waitFor()
  assert.equal(paidCalls, 0, 'storage never calls a model')
  assert.deepEqual(errors, [])
  console.log('PASS canvas owner: real ink refresh, A/B/visitor isolation, legacy explicit import, deletion, transaction abort, queued snapshot and unknown identity')
})().catch((e) => { console.error(e); process.exitCode = 1 }).finally(async () => { await browser?.close(); server?.kill() })
