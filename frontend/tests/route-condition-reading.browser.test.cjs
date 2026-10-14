const { browserExecutable, getTestPort } = require('./browser-support.cjs')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const assert = require('node:assert/strict')
const path = require('node:path')
const { chromium } = require('playwright')
let browser, server
const statements = { S1: '已知 x∈[0,2]，讨论单调性。', S2: '已知 f(x)=x²，讨论单调性。', S3: '已知 x≥0，这项条件撤销。', S4: '已知 x≥0，讨论。' + '。'.repeat(6000) }
function mapFixture() {
  return { overview: '比较候选路线，尚未核验方法。', choiceRule: '由学生核对后选择。', preferredIndex: -1,
    routes: ['x≥0', 'x<0', 'x>0'].map((when, index) => ({ name: `区间候选${index + 1}`, when,
      firstMove: '候选首步秘密', workload: '候选成本秘密', switchSignal: '候选换路秘密',
      basis: { source: 'none', sourceQuote: '', missingCondition: when } })) }
}
;(async () => {
  const port = await getTestPort(), origin = `http://127.0.0.1:${port}`, requests = [], errors = []
  const frontend = path.resolve(__dirname, '..')
  server = spawn(process.execPath, [path.join(frontend, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1',
    '--port', String(port), '--strictPort'], { cwd: frontend, windowsHide: true, stdio: 'inherit' })
  let ready = false
  for (let i = 0; i < 300; i += 1) {
    try { if ((await fetch(origin)).ok) { ready = true; break } } catch {}
    await delay(100)
  }
  assert.equal(ready, true)
  browser = await chromium.launch({ executablePath: browserExecutable, headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', route => {
    const id = route.request().url().match(/\/api\/v1\/problems\/(S[1234])$/)?.[1]
    return route.fulfill({ json: id ? { id, title: '区间条件测试', type: 'solution', typeLabel: '解答题', content: statements[id],
      answer: '参考答案秘密', solution: '参考解秘密', tags: ['函数'] } : { authenticated: true, user: { id: 'agent-test-admin', username: 'Agent regression', role: 'ADMIN' } } })
  })
  await page.route('**/__mathverse_similarity_proxy', route => {
    const request = route.request().postDataJSON(); requests.push(request)
    if (request.taskType === 'assistant-strategy') return route.fulfill({ json: { content: JSON.stringify(mapFixture()), model: request.model } })
    assert.equal(request.taskType, 'assistant-route_condition')
    const target = JSON.parse(request.messages.at(-1).content.split('\n').find(line => line.startsWith('{"routeId"')))
    return route.fulfill({ json: { model: request.model, content: JSON.stringify({
      routeId: target.routeId, conditionKind: target.conditionKind, conditionText: target.conditionText,
      status: 'uncertain', feedback: '该范围尚不足以证明整个候选方法。', nextQuestion: '你打算在哪个范围继续讨论？',
    }) } })
  })
  const drawer = page.getByRole('dialog', { name: 'Mathverse AI 学习助手' })
  async function open(id) {
    await page.goto(`${origin}/problems/${id}`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: '打开 Mathverse AI 助手' }).click()
    // A new page needs settings; config persists across reloads.
    if (await drawer.getByRole('button', { name: 'Qwen 百炼' }).isVisible()) {
      await drawer.getByRole('button', { name: 'Qwen 百炼' }).click()
      await drawer.getByLabel('API Key').fill('synthetic-interval-key')
      await drawer.getByRole('button', { name: '返回对话' }).click()
    }
  }
  const assistants = drawer.locator('.ai-assistant-message.is-assistant')
  const note = drawer.getByLabel('我的条件说明（选填）')
  const submit = drawer.getByRole('button', { name: '提交条件核对' })
  async function map() {
    const result = assistants.nth(await assistants.count())
    await drawer.getByRole('button', { name: /^比较解法路线/ }).click()
    await result.getByText('解法路线图 · AI 初步比较').waitFor(); return result
  }
  const choose = (map, index) => map.locator('.ai-assistant-strategy-routes li').nth(index)
    .getByRole('button', { name: '核对这条路线的条件' })
  async function check(text) {
    const result = assistants.nth(await assistants.count()); await submit.click()
    await result.getByText(text).waitFor(); return result
  }

  await open('S1'); const firstMap = await map()
  const reading = drawer.getByLabel('我已核对题干、所选条件和当前说明的读法')
  await choose(firstMap, 0).click(); assert.equal(await reading.isChecked(), false)
  let before = requests.length
  const unconfirmed = await check('当前条件读法尚未确认，先核对关键符号。')
  assert.equal(requests.length, before); assert.equal(await unconfirmed.locator('.is-verification').count(), 0)
  assert.equal(await unconfirmed.locator('.is-question').count(), 1)
  assert.match(await unconfirmed.textContent(), /本次未调用模型或数学工具/)
  await unconfirmed.getByRole('button', { name: '检查并确认读法', exact: true }).click()
  assert.equal(await reading.isChecked(), false, 'focus action must not secretly confirm')
  assert.equal(await reading.evaluate(element => element === document.activeElement), true)
  await reading.check(); assert.match(await unconfirmed.textContent(), /已过期/)
  assert.equal(requests.length, before, 'confirmation alone makes no call')
  const valid = await check(/所选区间条件成立/)
  assert.equal(requests.length, before); assert.equal(await valid.locator('.is-verification').count(), 1)
  await note.fill('记号像 ≥ 也像 >，我还不确定。'); await note.fill('')
  assert.equal(await reading.isChecked(), false); assert.match(await valid.textContent(), /已过期/)
  const again = await check('当前条件读法尚未确认，先核对关键符号。')
  assert.equal(requests.length, before); assert.equal(await again.locator('.is-verification').count(), 0)
  await choose(firstMap, 1).click(); await reading.check()
  const invalid = await check(/候选条件与该范围冲突/)
  assert.equal(requests.length, before); assert.equal(await invalid.locator('.is-verification').count(), 1)
  await choose(firstMap, 0).click(); await choose(firstMap, 1).click()
  assert.equal(await reading.isChecked(), false); assert.match(await invalid.textContent(), /已过期/)

  // Unknown mathematics after an actual reading confirmation still requires an unverified model response.
  await choose(firstMap, 2).click(); await note.fill('我核对后读作 x>0。'); await reading.check()
  const provider = await check('该范围尚不足以证明整个候选方法。')
  assert.equal(requests.length, before + 1); assert.equal(await provider.locator('.is-verification').count(), 0)
  assert.match(JSON.stringify(requests.at(-1).messages), /用户已明确核对/)
  assert.doesNotMatch(JSON.stringify(requests.at(-1).messages), /binding|learner_action|参考答案秘密|参考解秘密/)
  assert.match(await provider.textContent(), /未经数学工具验证/)

  // Ignore cancellation in transport to ensure a reading change still rejects a late success.
  await page.evaluate(() => {
    const original = window.fetch; window.__releaseReading = null
    window.fetch = (url, options) => {
      if (String(url).includes('/__mathverse_similarity_proxy')) {
        window.fetch = original; window.__heldReading = JSON.parse(options.body)
        return new Promise(resolve => { window.__releaseReading = body => resolve(new Response(JSON.stringify(body), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        })) })
      }
      return original(url, options)
    }
  })
  await submit.click(); await page.waitForFunction(() => Boolean(window.__releaseReading))
  await reading.uncheck(); await reading.check()
  const held = await page.evaluate(() => window.__heldReading)
  const target = JSON.parse(held.messages.at(-1).content.split('\n').find(line => line.startsWith('{"routeId"')))
  await page.evaluate(body => window.__releaseReading(body), { content: JSON.stringify({ routeId: target.routeId,
    conditionKind: target.conditionKind, conditionText: target.conditionText, status: 'addressed',
    feedback: '迟到模型错误宣称读法已清楚。', nextQuestion: '' }) })
  await page.waitForTimeout(80)
  assert.equal(await drawer.getByText('迟到模型错误宣称读法已清楚。').count(), 0)
  const cancelled = drawer.locator('.ai-assistant-message.is-error').filter({ hasText: '读法状态已改变' }).last()
  assert.match(await cancelled.textContent(), /已过期/)
  assert.equal(await cancelled.getByRole('button', { name: '按当前上下文重试', exact: true }).count(), 0)

  const chat = drawer.getByPlaceholder('向 AI 提问…'), send = drawer.getByRole('button', { name: '发送', exact: true })
  await chat.fill('当前条件读法还不确定'); await send.click()
  assert.equal(await reading.isChecked(), false)
  const naturalBefore = requests.length
  await chat.fill('我确认当前条件读法。'); await send.click()
  assert.equal(await reading.isChecked(), true); assert.equal(requests.length, naturalBefore)
  await drawer.getByRole('button', { name: '取消条件核对' }).click()
  await chat.fill('我确认当前条件读法'); await send.click()
  await drawer.getByText('请先选择当前路线条件，再确认读法。').waitFor()
  assert.equal(requests.length, naturalBefore)

  await choose(firstMap, 0).click(); await reading.check()
  await drawer.getByLabel('随请求发送').uncheck(); await drawer.getByLabel('随请求发送').check()
  assert.equal(await submit.isDisabled(), true)
  const fresh = await map(); await choose(fresh, 0).click(); assert.equal(await reading.isChecked(), false)
  await page.setViewportSize({ width: 390, height: 844 })
  await check('当前条件读法尚未确认，先核对关键符号。'); await reading.check()
  await check(/所选区间条件成立/)
  assert.ok((await drawer.evaluate(element => element.scrollWidth)) <= (await drawer.evaluate(element => element.clientWidth)) + 2)
  await open('S4'); const longSourceMap = await map(); await choose(longSourceMap, 0).click()
  await note.fill(''); await reading.check(); assert.equal(await reading.isChecked(), true)
  const longResult = await check('该范围尚不足以证明整个候选方法。')
  assert.equal(await longResult.locator('.is-verification').count(), 0)
  assert.deepEqual(errors, [])
  console.log('PASS: default unconfirmed gate before provider/tools, focused user confirmation, local proof only after confirmation, note/target A-B-A expiry, unverified provider continuation, revoke/reconfirm late success rejection, scoped natural confirmation, source opt-out and mobile layout')
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  await browser?.close(); server?.kill()
})
