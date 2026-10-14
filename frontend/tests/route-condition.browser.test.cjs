const { browserExecutable, getTestPort } = require('./browser-support.cjs')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const assert = require('node:assert/strict')
const path = require('node:path')
const { chromium } = require('playwright')
let browser, server
const mapFixture = { overview: '整图概述秘密', choiceRule: '整图标准秘密', preferredIndex: -1, routes: [
  { name: '求导路线秘密', when: '在可导区间讨论导数符号', firstMove: '首步秘密一', workload: '成本秘密一', switchSignal: '换路秘密一',
    basis: { source: 'problem', sourceQuote: '单调性', missingCondition: '' } },
  { name: '代数结构', when: '平方结构可用于比较大小', firstMove: '首步秘密二', workload: '成本秘密二', switchSignal: '换路秘密二',
    basis: { source: 'problem', sourceQuote: 'f(x)=x²', missingCondition: '需核对自变量的范围' } },
] }
function targetFromRequest(request) {
  const prompt = request.messages.at(-1).content
  const line = prompt.split('\n').find(line => line.startsWith('{"routeId"'))
  assert.ok(line, 'actual selected-target JSON is present')
  return JSON.parse(line)
}
function response(target, mode = 'needs_input') {
  const value = { routeId: target.routeId, conditionKind: target.conditionKind, conditionText: target.conditionText,
    status: mode === 'addressed' ? 'addressed' : mode === 'uncertain' ? 'uncertain' : 'needs_input',
    feedback: mode === 'addressed' ? '本次范围说明已回应该条件。' : mode === 'uncertain' ? '区间记号读法还不明确。' : '目前还缺少明确区间。',
    nextQuestion: mode === 'addressed' ? '' : '你准备限定哪个讨论区间？' }
  if (mode === 'switched') { value.conditionText = '擅自切换条件'; value.feedback = '不应显示的换条件回复' }
  if (mode === 'leak') value.feedback = '最终答案：2'
  return value
}
;(async () => {
  const port = await getTestPort(), origin = `http://127.0.0.1:${port}`
  const frontend = path.resolve(__dirname, '..')
  const requests = [], modes = [], pageErrors = []
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
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.route('**/api/v1/problems/S1', route => route.fulfill({ json: {
    id: 'S1', title: '路线条件测试', type: 'solution', typeLabel: '解答题', content: '已知 f(x)=x²，判断单调性。',
    tags: ['函数'], answer: '参考答案秘密', solution: '参考解析秘密',
  } }))
  await page.route('**/api/**', route => route.request().url().includes('/api/v1/problems/S1')
    ? route.fallback() : route.fulfill({ json: { authenticated: true, user: { id: 'agent-test-admin', username: 'Agent regression', role: 'ADMIN' } } }))
  await page.route('**/__mathverse_similarity_proxy', route => {
    const request = route.request().postDataJSON()
    requests.push(request)
    if (request.taskType === 'assistant-strategy') return route.fulfill({ json: { content: JSON.stringify(mapFixture), model: request.model } })
    assert.equal(request.taskType, 'assistant-route_condition')
    assert.equal(request.jsonMode, true)
    const target = targetFromRequest(request), mode = modes.shift() || 'needs_input'
    if (mode === 'failed') return route.fulfill({ status: 503, json: { error: '合成服务故障' } })
    return route.fulfill({ json: { content: JSON.stringify(response(target, mode)), model: request.model } })
  })
  await page.goto(`${origin}/problems/S1`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '打开 Mathverse AI 助手' }).click()
  const drawer = page.getByRole('dialog', { name: 'Mathverse AI 学习助手' })
  await drawer.getByRole('button', { name: 'Qwen 百炼' }).click()
  await drawer.getByLabel('API Key').fill('synthetic-route-key')
  await drawer.getByRole('button', { name: '返回对话' }).click()
  const compare = drawer.getByRole('button', { name: /^比较解法路线/ })
  const composer = drawer.getByRole('region', { name: '路线条件核对' })
  const note = drawer.getByLabel('我的条件说明（选填）')
  const submit = drawer.getByRole('button', { name: '提交条件核对' })
  async function compareMap() {
    const message = drawer.locator('.ai-assistant-message.is-assistant').nth(await drawer.locator('.ai-assistant-message.is-assistant').count())
    await compare.click(); await message.getByText('解法路线图 · AI 初步比较').waitFor()
    return message
  }
  async function check(mode, pattern, error = false, action = null) {
    await drawer.getByLabel('我已核对题干、所选条件和当前说明的读法').check()
    modes.push(mode)
    const selector = error ? '.ai-assistant-message.is-error' : '.ai-assistant-message.is-assistant'
    const message = drawer.locator(selector).nth(await drawer.locator(selector).count())
    await (action || submit).click(); await message.getByText(pattern).waitFor()
    return message
  }
  const map = await compareMap()
  const routes = map.locator('.ai-assistant-strategy-routes li')
  const choose = index => routes.nth(index).getByRole('button', { name: '核对这条路线的条件' })
  const callsBeforeSelection = requests.length
  await choose(1).click()
  assert.equal(requests.length, callsBeforeSelection, 'selection alone does not call the model')
  assert.equal(await drawer.getByLabel('本次核对的条件').inputValue(), 'missing')
  await composer.getByText('AI 提出的条件：需核对自变量的范围').waitFor()
  await note.fill('我还没有决定讨论区间。')
  const missing = await check('needs_input', '你准备限定哪个讨论区间？')
  assert.match(await missing.textContent(), /仅核对.*需核对自变量的范围.*对应当前条件/)
  assert.equal(await missing.getByRole('button', { name: '补充这个条件' }).count(), 1)
  const payload = JSON.stringify(requests.at(-1).messages)
  assert.match(payload, /代数结构|需核对自变量的范围|我还没有决定讨论区间/)
  assert.doesNotMatch(payload, /求导路线秘密|整图概述秘密|整图标准秘密|首步秘密|成本秘密|换路秘密|参考答案秘密|参考解析秘密/)
  await missing.getByRole('button', { name: '补充这个条件' }).click()
  assert.equal(await note.evaluate(element => element === document.activeElement), true)
  await note.fill('我准备限定在非负区间。')
  assert.match(await missing.textContent(), /已过期/)
  const stopped = await check('addressed', '本次范围说明已回应该条件。')
  assert.equal(await stopped.locator('.is-question').count(), 0)
  assert.equal(await stopped.locator('.ai-assistant-message-actions button').count(), 0)
  assert.doesNotMatch(await stopped.textContent(), /已验证 ·|长期掌握/)
  await drawer.getByLabel('本次核对的条件').selectOption('applicability')
  assert.match(await stopped.textContent(), /已过期/)
  const applicable = await check('uncertain', '区间记号读法还不明确。')
  assert.equal(targetFromRequest(requests.at(-1)).conditionKind, 'applicability')
  assert.doesNotMatch(JSON.stringify(requests.at(-1).messages), /需核对自变量的范围|本次范围说明已回应/)
  assert.doesNotMatch(await applicable.textContent(), /数学错误|已验证 ·/)

  const failure = await check('failed', /合成服务故障|503|服务/, true)
  const retry = failure.getByRole('button', { name: '重试', exact: true })
  const failedTarget = targetFromRequest(requests.at(-1))
  const retried = await check('needs_input', '你准备限定哪个讨论区间？', false, retry)
  assert.deepEqual(targetFromRequest(requests.at(-1)), failedTarget, 'unchanged retry stays on the same condition')
  await note.fill('更改后的说明。')
  assert.match(await failure.textContent(), /已过期/)
  assert.equal(await failure.getByRole('button', { name: '重试', exact: true }).count(), 0)
  assert.match(await retried.textContent(), /已过期/)
  const wrong = await check('switched', /模型换了路线或条件/, true)
  assert.equal(await drawer.getByText('不应显示的换条件回复').count(), 0)
  await check('leak', /条件核对回复可能提前泄露答案，已隐藏/)
  assert.equal(await drawer.getByText('最终答案：2', { exact: true }).count(), 0)

  // Ignore AbortSignal deliberately to exercise cancellation independently of transport support.
  async function holdConditionRequest() {
    await page.evaluate(() => {
    window.__releaseRoute = null
    const original = window.fetch
    window.fetch = (url, options) => {
      if (String(url).includes('/__mathverse_similarity_proxy')) {
        window.fetch = original
        window.__heldRouteRequest = JSON.parse(options.body)
        return new Promise(resolve => { window.__releaseRoute = body => resolve(new Response(JSON.stringify(body), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        })) })
      }
      return original(url, options)
    }
    })
  }
  await holdConditionRequest()
  await drawer.getByLabel('我已核对题干、所选条件和当前说明的读法').check()
  await submit.click()
  await page.waitForFunction(() => Boolean(window.__releaseRoute))
  await choose(0).click(); await choose(1).click()
  const cancellation = drawer.locator('.ai-assistant-message.is-error').filter({ hasText: '路线条件核对已取消；说明已保留，可重新选择。' }).last()
  assert.match(await cancellation.textContent(), /已过期/, 'cancelled-run retry must expire after changing the target')
  assert.equal(await cancellation.getByRole('button', { name: '按当前上下文重试', exact: true }).count(), 0)
  const held = await page.evaluate(() => window.__heldRouteRequest)
  const late = response(targetFromRequest(held), 'addressed'); late.feedback = '迟到条件核对不应显示。'
  await page.evaluate(body => window.__releaseRoute(body), { content: JSON.stringify(late) })
  await page.waitForTimeout(80)
  assert.equal(await drawer.getByText('迟到条件核对不应显示。').count(), 0)
  assert.match(await wrong.textContent(), /已过期/)
  await holdConditionRequest()
  await drawer.getByLabel('我已核对题干、所选条件和当前说明的读法').check()
  await submit.click()
  await page.waitForFunction(() => Boolean(window.__releaseRoute))
  const stoppedRequest = await page.evaluate(() => window.__heldRouteRequest)
  await drawer.getByRole('button', { name: '停止', exact: true }).click()
  const stoppedRun = drawer.locator('.ai-assistant-message.is-error').filter({ hasText: '已停止本次请求。' }).last()
  assert.match(await stoppedRun.textContent(), /对应当前条件/)
  await check('needs_input', '你准备限定哪个讨论区间？', false,
    stoppedRun.getByRole('button', { name: '按当前上下文重试', exact: true }))
  assert.deepEqual(targetFromRequest(requests.at(-1)), targetFromRequest(stoppedRequest))
  const stoppedLate = response(targetFromRequest(stoppedRequest), 'addressed'); stoppedLate.feedback = '停止后迟到回复不应显示。'
  await page.evaluate(body => window.__releaseRoute(body), { content: JSON.stringify(stoppedLate) })
  await page.waitForTimeout(80)
  assert.equal(await drawer.getByText('停止后迟到回复不应显示。').count(), 0)
  await drawer.getByRole('button', { name: '取消条件核对' }).click()
  assert.match(await stoppedRun.textContent(), /已过期/)
  assert.equal(await stoppedRun.getByRole('button', { name: '按当前上下文重试', exact: true }).count(), 0)
  assert.equal(await note.inputValue(), '更改后的说明。')
  assert.equal(await submit.isDisabled(), true)
  await composer.getByText(/说明已保留，尚未选中路线条件/).waitFor()

  const chat = drawer.getByPlaceholder('向 AI 提问…')
  const send = drawer.getByRole('button', { name: '发送', exact: true })
  modes.push('needs_input')
  let natural = drawer.locator('.ai-assistant-message.is-assistant').nth(await drawer.locator('.ai-assistant-message.is-assistant').count())
  await chat.fill('核对第2条路线的待补条件：我想限定区间。'); await send.click()
  await natural.getByText('当前条件读法尚未确认，先核对关键符号。').waitFor()
  await drawer.getByLabel('我已核对题干、所选条件和当前说明的读法').check()
  natural = drawer.locator('.ai-assistant-message.is-assistant').nth(await drawer.locator('.ai-assistant-message.is-assistant').count())
  await submit.click()
  await natural.getByText('你准备限定哪个讨论区间？').waitFor()
  assert.equal(await note.inputValue(), '我想限定区间。')
  assert.equal(targetFromRequest(requests.at(-1)).routeId, 'method-2')
  await drawer.getByLabel('随请求发送').uncheck(); await drawer.getByLabel('随请求发送').check()
  assert.match(await natural.textContent(), /已过期/)
  assert.equal(await submit.isDisabled(), true)
  const beforeBlocked = requests.length
  await chat.fill('核对第2条路线的条件'); await send.click()
  await drawer.getByText('请先比较当前题目的路线，再选择一条条件进行核对。').waitFor()
  assert.equal(requests.length, beforeBlocked, 'expired source cannot reach the provider')

  const current = await compareMap()
  await current.locator('.ai-assistant-strategy-routes li').nth(1).getByRole('button', { name: '核对这条路线的条件' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  assert.ok((await drawer.evaluate(element => element.scrollWidth)) <= (await drawer.evaluate(element => element.clientWidth)) + 2)
  await check('addressed', '本次范围说明已回应该条件。')
  assert.deepEqual(pageErrors, [])
  console.log('PASS: route selection without calls, one-condition actual payload, one question/local stop, missing/uncertain feedback, unchanged retry, edited stale retry, switched target rejection, leakage hiding, A-B-A late reply, cancellation, natural routing, source opt-out expiry and mobile layout')
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  await browser?.close(); server?.kill()
})
