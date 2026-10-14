const { browserExecutable, getTestPort } = require('./browser-support.cjs')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const assert = require('node:assert/strict')
const path = require('node:path')
const { chromium } = require('playwright')
let browser, server
const statements = { S1: '已知 x∈[0,2]，讨论单调性。', S2: '已知 f(x)=x²，讨论单调性。', S3: '已知 x≥0，这项条件撤销。' }
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
    const id = route.request().url().match(/\/api\/v1\/problems\/(S[123])$/)?.[1]
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
    await drawer.getByLabel('我已核对题干、所选条件和当前说明的读法').check()
    const result = assistants.nth(await assistants.count()); await submit.click()
    await result.getByText(text).waitFor(); return result
  }
  await open('S1'); const firstMap = await map()
  await choose(firstMap, 0).click()
  let before = requests.length
  const valid = await check(/所选区间条件成立/)
  assert.equal(requests.length, before); assert.match(await valid.textContent(), /已核验 · 区间条件|仍待单独判断/)
  assert.equal(await valid.locator('.is-verification').count(), 1); assert.equal(await valid.locator('.is-question').count(), 0)
  await choose(firstMap, 1).click(); const invalid = await check(/候选条件与该范围冲突/)
  assert.equal(requests.length, before); assert.doesNotMatch(await invalid.textContent(), /草稿第|学生错误/)
  assert.equal(await invalid.getByRole('button', { name: '重新比较当前路线', exact: true }).count(), 1)
  assert.equal(await firstMap.locator('.ai-assistant-strategy-routes li').count(), 3)
  assert.match(await valid.textContent(), /已过期/)
  await choose(firstMap, 2).click(); const overlap = await check('该范围尚不足以证明整个候选方法。')
  assert.equal(requests.length, before + 1); assert.equal(await overlap.locator('.is-verification').count(), 0)
  assert.match(await overlap.textContent(), /未经数学工具验证/)
  assert.doesNotMatch(JSON.stringify(requests.at(-1).messages), /参考答案秘密|参考解秘密|候选首步秘密|候选成本秘密|候选换路秘密/)
  await note.fill('我准备讨论子区间。'); assert.match(await overlap.textContent(), /已过期/)
  await open('S3'); const withdrawnMap = await map(); await choose(withdrawnMap, 0).click()
  before = requests.length
  const withdrawn = await check('该范围尚不足以证明整个候选方法。')
  assert.equal(requests.length, before + 1); assert.equal(await withdrawn.locator('.is-verification').count(), 0)
  await open('S2'); const missingMap = await map(); await choose(missingMap, 0).click(); await note.fill('')
  before = requests.length
  const gap = await check('当前材料还不能核对所选区间条件。')
  assert.equal(requests.length, before); assert.equal(await gap.locator('.is-verification').count(), 0)
  assert.equal(await gap.locator('.is-question').count(), 1); assert.match(await gap.textContent(), /缺少材料不代表数学错误/)
  await gap.getByRole('button', { name: '补充讨论范围', exact: true }).click(); await note.fill('我只讨论 x≥0。')
  assert.match(await gap.textContent(), /已过期/)
  const supplied = await check('该范围尚不足以证明整个候选方法。')
  assert.equal(requests.length, before + 1); assert.equal(await supplied.locator('.is-verification').count(), 0)
  assert.equal(await note.inputValue(), '我只讨论 x≥0。')
  await drawer.getByLabel('随请求发送').uncheck(); await drawer.getByLabel('随请求发送').check()
  assert.match(await supplied.textContent(), /已过期/); assert.equal(await submit.isDisabled(), true)
  await page.setViewportSize({ width: 390, height: 844 })
  const mobileMap = await map(); await choose(mobileMap, 0).click(); await note.fill('')
  await check('当前材料还不能核对所选区间条件。')
  assert.ok((await drawer.evaluate(element => element.scrollWidth)) <= (await drawer.evaluate(element => element.clientWidth)) + 2)
  assert.deepEqual(errors, [])
  console.log('PASS: interval subset/disjoint without provider, partial overlap and withdrawn assumption unverified, missing range local single question, learner range not promoted to given, retained routes, edit/source expiry and mobile gap layout')
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  await browser?.close(); server?.kill()
})
