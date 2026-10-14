const { browserExecutable, getTestPort } = require('./browser-support.cjs')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const assert = require('node:assert/strict')
const path = require('node:path')
const { chromium } = require('playwright')
let browser, server
const statements = { D1: '已知 f(x)=x²，讨论单调性。', D2: '已知 x<0，讨论。' }
function mapFixture() {
  return { overview: '比较候选路线，尚未核验方法。', choiceRule: '由学生核对后选择。', preferredIndex: -1,
    routes: ['在非负区间内比较平方大小', 'x≥0'].map((when, index) => ({ name: `讨论候选${index + 1}`, when,
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
    const id = route.request().url().match(/\/api\/v1\/problems\/(D[12])$/)?.[1]
    return route.fulfill({ json: id ? { id, title: '讨论范围测试', type: 'solution', typeLabel: '解答题', content: statements[id],
      answer: '参考答案秘密', solution: '参考解秘密', tags: ['函数'] } : { authenticated: true, user: { id: 'agent-test-admin', username: 'Agent regression', role: 'ADMIN' } } })
  })
  await page.route('**/__mathverse_similarity_proxy', route => {
    const request = route.request().postDataJSON(); requests.push(request)
    if (request.taskType === 'assistant-strategy') return route.fulfill({ json: { content: JSON.stringify(mapFixture()), model: request.model } })
    assert.equal(request.taskType, 'assistant-route_condition')
    const prompt = request.messages.at(-1).content
    const target = JSON.parse(prompt.split('\n').find(line => line.startsWith('{"routeId"')))
    const explicit = prompt.includes('学生选定的本次讨论范围')
    const reasoning = prompt.includes('检查理由')
    const response = { routeId: target.routeId, conditionKind: target.conditionKind, conditionText: target.conditionText,
      status: 'needs_input', feedback: reasoning ? '范围已提供，比较理由还待说明。' : '合成错误反馈：还要确认你的区间。',
      nextQuestion: reasoning ? '在该范围内，平方大小如何由原数大小推出？' : '你讨论什么区间？',
      ...(explicit ? { probe: { kind: reasoning ? 'condition_reasoning' : 'discussion_range', variable: reasoning ? null : 'x',
        source: 'condition', sourceQuote: prompt.includes('坏来源') ? '不存在的来源' : target.conditionText.slice(0, 8),
        purpose: reasoning ? '说明比较平方大小的理由' : '补充 x 的讨论范围' } } : {}) }
    return route.fulfill({ json: { model: request.model, content: JSON.stringify(response) } })
  })
  const drawer = page.getByRole('dialog', { name: 'Mathverse AI 学习助手' })
  async function open(id) {
    await page.goto(`${origin}/problems/${id}`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: '打开 Mathverse AI 助手' }).click()
    if (await drawer.getByRole('button', { name: 'Qwen 百炼' }).isVisible()) {
      await drawer.getByRole('button', { name: 'Qwen 百炼' }).click()
      await drawer.getByLabel('API Key').fill('synthetic-discussion-key')
      await drawer.getByRole('button', { name: '返回对话' }).click()
    }
  }
  const assistants = drawer.locator('.ai-assistant-message.is-assistant')
  const note = drawer.getByLabel('我的条件说明（选填）')
  const range = drawer.getByLabel('本次讨论范围（选填）')
  const reading = drawer.getByLabel('我已核对题干、所选条件和当前说明的读法')
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

  await open('D1'); const firstMap = await map()
  await choose(firstMap, 1).click(); await reading.check()
  const before = requests.length
  const missing = await check('当前材料还不能核对所选区间条件。')
  assert.equal(requests.length, before)
  await missing.getByRole('button', { name: '补充讨论范围', exact: true }).click()
  assert.equal(await range.evaluate(element => element === document.activeElement), true)
  assert.equal(await range.inputValue(), '')

  // An explicit learner scope is recorded, never promoted to a native assumption or a math proof.
  await choose(firstMap, 0).click(); await note.fill('我只讨论 x≥0。'); await range.fill('x≥0')
  assert.equal(await reading.isChecked(), false)
  await reading.check()
  const stopped = await check('已记录你选定的讨论范围：x≥0。本次停止重复询问该范围。')
  assert.equal(requests.length, before + 1)
  assert.equal(await stopped.locator('.is-question').count(), 0)
  assert.equal(await stopped.locator('.is-verification').count(), 0)
  assert.equal(await stopped.getByRole('button', { name: '补充这个条件' }).count(), 0)
  assert.doesNotMatch(await stopped.textContent(), /合成错误反馈|你讨论什么区间/)
  assert.match(await stopped.textContent(), /只结束这项范围补充/)
  assert.match(JSON.stringify(requests.at(-1).messages), /独立于题设|probe/)
  assert.doesNotMatch(JSON.stringify(requests.at(-1).messages), /参考答案秘密|参考解秘密|候选首步秘密|候选成本秘密|候选换路秘密|binding|learner_scope/)

  await note.fill('检查理由'); await reading.check()
  const gap = await check('范围已提供，比较理由还待说明。')
  assert.equal(await gap.locator('.is-question').count(), 1)
  assert.match(await gap.textContent(), /这次只核对：说明比较平方大小的理由/)
  assert.match(await gap.textContent(), /AI 条件：在非负区间内比/)
  await range.fill('x>0'); await range.fill('x≥0')
  assert.equal(await reading.isChecked(), false)
  assert.match(await gap.textContent(), /已过期/)
  assert.equal(await gap.getByRole('button', { name: '补充这个条件' }).count(), 0)
  await reading.check()

  // Hold a real UI submission while ignoring abort; A-B-A must reject the late reply and retry.
  await page.evaluate(() => {
    const original = window.fetch; window.__releaseRange = null
    window.fetch = (url, options) => {
      if (String(url).includes('/__mathverse_similarity_proxy')) {
        window.fetch = original; window.__heldRange = JSON.parse(options.body)
        return new Promise(resolve => { window.__releaseRange = body => resolve(new Response(JSON.stringify(body), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        })) })
      }
      return original(url, options)
    }
  })
  await submit.click(); await page.waitForFunction(() => Boolean(window.__releaseRange))
  await range.fill('x>0'); await range.fill('x≥0'); await reading.check()
  const held = await page.evaluate(() => window.__heldRange)
  const target = JSON.parse(held.messages.at(-1).content.split('\n').find(line => line.startsWith('{"routeId"')))
  await page.evaluate(body => window.__releaseRange(body), { content: JSON.stringify({ routeId: target.routeId,
    conditionKind: target.conditionKind, conditionText: target.conditionText, status: 'addressed',
    feedback: '迟到范围结果秘密', nextQuestion: '', probe: null }) })
  await page.waitForTimeout(80)
  assert.equal(await drawer.getByText('迟到范围结果秘密').count(), 0)
  const cancelled = drawer.locator('.ai-assistant-message.is-error').filter({ hasText: '讨论范围已修改' }).last()
  assert.match(await cancelled.textContent(), /已过期/)
  assert.equal(await cancelled.getByRole('button', { name: '重试' }).count(), 0)

  let checkpoint = requests.length
  await range.fill('x∈[2,1]'); await reading.check()
  const unsupported = await check('讨论范围尚不能按支持语法读取，原输入已保留。')
  assert.equal(requests.length, checkpoint); assert.equal(await unsupported.locator('.is-question').count(), 1)
  assert.equal(await range.inputValue(), 'x∈[2,1]')
  assert.match(await unsupported.textContent(), /不代表数学错误/)
  await unsupported.getByRole('button', { name: '补充讨论范围', exact: true }).click()
  assert.equal(await range.evaluate(element => element === document.activeElement), true)

  // Natural command updates the same field without making a call or confirming reading.
  await drawer.getByPlaceholder('向 AI 提问…').fill('本次讨论范围：x≥0')
  await drawer.getByRole('button', { name: '发送', exact: true }).click()
  assert.equal(await range.inputValue(), 'x≥0'); assert.equal(await reading.isChecked(), false)
  assert.equal(requests.length, checkpoint)
  await note.fill('坏来源'); await reading.check(); await submit.click()
  const malformed = drawer.locator('.ai-assistant-message.is-error').filter({ hasText: '逐字匹配的命名来源' }).last()
  await malformed.waitFor(); assert.equal(await range.inputValue(), 'x≥0')
  await note.fill('检查理由'); await reading.check()
  assert.match(await malformed.textContent(), /已过期/)
  await check('范围已提供，比较理由还待说明。')

  await drawer.getByRole('button', { name: '取消条件核对', exact: true }).click()
  await choose(firstMap, 0).click(); assert.equal(await range.inputValue(), '')
  await range.fill('x≥0'); await reading.check()
  await choose(firstMap, 1).click(); assert.equal(await range.inputValue(), '')
  assert.equal(await reading.isChecked(), false)
  const source = drawer.getByLabel('随请求发送', { exact: true })
  await range.fill('x≥0'); await reading.check(); await source.uncheck(); await source.check()
  await choose((await map()), 0).click(); assert.equal(await range.inputValue(), '')

  await page.setViewportSize({ width: 390, height: 844 })
  await range.fill('x∈[0,2]')
  assert.equal(await drawer.evaluate(element => element.scrollWidth <= element.clientWidth + 2), true)
  await open('D2'); const nativeMap = await map(); await choose(nativeMap, 1).click()
  await range.fill('x≥0'); await reading.check(); checkpoint = requests.length
  const conflict = await check(/候选条件与该范围冲突/)
  assert.equal(requests.length, checkpoint); assert.equal(await conflict.locator('.is-verification').count(), 1)
  assert.match(await conflict.textContent(), /x∈\(-∞,0\)/)
  assert.deepEqual(errors, [])
  console.log('Discussion-range browser journey passed: explicit scope, one grounded question, local stop, invalid input, edit/late/retry/source boundaries, mobile, and native assumption isolation.')
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  if (browser) await browser.close()
  if (server && !server.killed) server.kill()
})
