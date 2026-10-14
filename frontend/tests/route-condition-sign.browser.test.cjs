const { browserExecutable, getTestPort } = require('./browser-support.cjs')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const assert = require('node:assert/strict')
const path = require('node:path')
const { chromium } = require('playwright')
let browser, server
function mapFixture(corrected = false) {
  return { overview: '比较差值与其他候选，尚未核验适用性。', choiceRule: '由学生核对条件后选择。', preferredIndex: -1, routes: [
    { name: '差值比较候选', when: corrected ? 'a-b>0' : 'a-b<0', firstMove: '第一路线首步秘密', workload: '第一路线成本秘密', switchSignal: '第一路线换路秘密',
      basis: { source: 'problem', sourceQuote: 'a>b', missingCondition: '' } },
    { name: '反向差值候选', when: 'b-a<0', firstMove: '第二路线首步秘密', workload: '第二路线成本秘密', switchSignal: '第二路线换路秘密',
      basis: { source: 'problem', sourceQuote: 'a>b', missingCondition: '' } },
    { name: '其他候选', when: '需确认 x 的范围', firstMove: '第三路线首步秘密', workload: '第三路线成本秘密', switchSignal: '第三路线换路秘密',
      basis: { source: 'none', sourceQuote: '', missingCondition: '需确认 x 的范围' } },
  ] }
}
;(async () => {
  const port = await getTestPort(), origin = `http://127.0.0.1:${port}`
  const frontend = path.resolve(__dirname, '..'), requests = [], pageErrors = []
  let corrected = false
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
    id: 'S1', title: '候选条件符号测试', type: 'solution', typeLabel: '解答题', content: '已知实数 a>b，研究差值符号。',
    answer: '参考答案秘密', solution: '参考解秘密', tags: ['不等式'],
  } }))
  await page.route('**/api/**', route => route.request().url().includes('/api/v1/problems/S1')
    ? route.fallback() : route.fulfill({ json: { authenticated: true, user: { id: 'agent-test-admin', username: 'Agent regression', role: 'ADMIN' } } }))
  await page.route('**/__mathverse_similarity_proxy', route => {
    const request = route.request().postDataJSON(); requests.push(request)
    if (request.taskType === 'assistant-strategy') return route.fulfill({ json: { content: JSON.stringify(mapFixture(corrected)), model: request.model } })
    assert.equal(request.taskType, 'assistant-route_condition')
    const target = JSON.parse(request.messages.at(-1).content.split('\n').find(line => line.startsWith('{"routeId"')))
    const unsupported = target.routeId === 'method-3'
    return route.fulfill({ json: { model: request.model, content: JSON.stringify({
      routeId: target.routeId, conditionKind: target.conditionKind, conditionText: target.conditionText,
      status: unsupported ? 'uncertain' : 'addressed',
      feedback: unsupported ? '范围记号读法还不明确。' : 'a-b<0 已成立，可以继续。',
      nextQuestion: unsupported ? '你能确认范围记号的读法吗？' : '',
    }) } })
  })
  await page.goto(`${origin}/problems/S1`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '打开 Mathverse AI 助手' }).click()
  const drawer = page.getByRole('dialog', { name: 'Mathverse AI 学习助手' })
  await drawer.getByRole('button', { name: 'Qwen 百炼' }).click()
  await drawer.getByLabel('API Key').fill('synthetic-route-sign-key')
  await drawer.getByRole('button', { name: '返回对话' }).click()
  const compare = drawer.getByRole('button', { name: /^比较解法路线/ })
  const submit = drawer.getByRole('button', { name: '提交条件核对' })
  const note = drawer.getByLabel('我的条件说明（选填）')
  const assistants = drawer.locator('.ai-assistant-message.is-assistant')
  async function newMap(action = compare) {
    const message = assistants.nth(await assistants.count())
    await action.click(); await message.getByText('解法路线图 · AI 初步比较').waitFor(); return message
  }
  async function localCheck(pattern) {
    await drawer.getByLabel('我已核对题干、所选条件和当前说明的读法').check()
    const message = assistants.nth(await assistants.count())
    await submit.click(); await message.getByText(pattern).waitFor(); return message
  }
  const map = await newMap()
  const choose = (message, index) => message.locator('.ai-assistant-strategy-routes li').nth(index)
    .getByRole('button', { name: '核对这条路线的条件' })
  await choose(map, 0).click(); await note.fill('我还不确定这个候选条件。')
  const beforeConflict = requests.length
  const invalid = await localCheck(/AI 候选条件.*与题设.*冲突/)
  assert.equal(requests.length, beforeConflict, 'conflicting condition is stopped before provider work')
  assert.match(await invalid.textContent(), /已核验 · 差值符号|a-b>0|本次未发送给模型/)
  assert.doesNotMatch(await invalid.textContent(), /草稿第|第.*步的错误|数学错误|a-b<0 已成立/)
  assert.equal(await invalid.locator('.is-verification').count(), 1)
  assert.equal(await invalid.locator('.is-question').count(), 0)
  assert.equal(await invalid.getByRole('button', { name: '重新比较当前路线', exact: true }).count(), 1)
  assert.equal(await note.inputValue(), '我还不确定这个候选条件。')
  assert.equal(await map.locator('.ai-assistant-strategy-routes li').count(), 3, 'all candidates remain available')

  await choose(map, 1).click()
  const beforeValid = requests.length
  const valid = await localCheck(/所选条件.*差值符号成立/)
  assert.equal(requests.length, beforeValid, 'true sign is settled without a redundant provider question')
  assert.match(await valid.textContent(), /b-a<0|路线是否适用.*仍待单独判断/)
  assert.equal(await valid.locator('.is-question').count(), 0)
  assert.equal(await valid.locator('.ai-assistant-message-actions button').count(), 0)
  assert.match(await invalid.textContent(), /已过期/)
  assert.equal(await invalid.getByRole('button', { name: '重新比较当前路线', exact: true }).count(), 0)

  await choose(map, 2).click(); await note.fill('我还没有确认范围记号。')
  const beforeUnknown = requests.length
  const unknown = await localCheck('范围记号读法还不明确。')
  assert.equal(requests.length, beforeUnknown + 1)
  assert.equal(await unknown.locator('.is-verification').count(), 0)
  assert.equal(await unknown.locator('.is-question').count(), 1)
  assert.match(await unknown.textContent(), /未经数学工具验证/)
  assert.doesNotMatch(JSON.stringify(requests.at(-1).messages), /a-b<0|b-a<0|首步秘密|成本秘密|换路秘密|参考答案秘密|参考解秘密/)

  await choose(map, 0).click()
  const conflictAgain = await localCheck(/AI 候选条件.*与题设.*冲突/)
  corrected = true
  const nextMap = await newMap(conflictAgain.getByRole('button', { name: '重新比较当前路线', exact: true }))
  await choose(nextMap, 0).click()
  const beforeCorrected = requests.length
  const correctedProof = await localCheck(/所选条件.*差值符号成立/)
  assert.equal(requests.length, beforeCorrected)
  assert.match(await correctedProof.textContent(), /a-b>0/)
  assert.match(await conflictAgain.textContent(), /已过期/)
  assert.equal(await note.inputValue(), '我还没有确认范围记号。')

  const input = drawer.getByPlaceholder('向 AI 提问…')
  const beforeNatural = requests.length
  let natural = assistants.nth(await assistants.count())
  await input.fill('核对第2条路线的适用条件：只核对这个差值。')
  await drawer.getByRole('button', { name: '发送', exact: true }).click()
  await natural.getByText('当前条件读法尚未确认，先核对关键符号。').waitFor()
  await drawer.getByLabel('我已核对题干、所选条件和当前说明的读法').check()
  natural = assistants.nth(await assistants.count()); await submit.click()
  await natural.getByText(/所选条件.*差值符号成立/).waitFor()
  assert.equal(requests.length, beforeNatural)
  assert.match(await natural.textContent(), /b-a<0/)
  await drawer.getByLabel('随请求发送').uncheck(); await drawer.getByLabel('随请求发送').check()
  assert.match(await natural.textContent(), /已过期/)
  assert.equal(await submit.isDisabled(), true)
  await page.setViewportSize({ width: 390, height: 844 })
  const mobileMap = await newMap(); await choose(mobileMap, 0).click()
  const mobileProof = await localCheck(/所选条件.*差值符号成立/)
  assert.match(await mobileProof.textContent(), /已核验 · 差值符号/)
  assert.ok((await drawer.evaluate(element => element.scrollWidth)) <= (await drawer.evaluate(element => element.clientWidth)) + 2)
  assert.deepEqual(pageErrors, [])
  console.log('PASS: contradictory AI condition before provider, narrow valid sign without extra question, preserved candidates/notes, stale proof/action, unsupported reading through bounded provider, explicit recompare/correction, natural request, opt-out expiry and mobile proof layout')
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  await browser?.close(); server?.kill()
})
