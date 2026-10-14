const { browserExecutable, getTestPort } = require('./browser-support.cjs')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const assert = require('node:assert/strict')
const path = require('node:path')
const { chromium } = require('playwright')
let browser, server
const base = { overview: '比较求导和代数结构，保留两种候选。', routes: [
  { name: '求导', when: '在可导区间内讨论导数符号', firstMove: '写出导函数', workload: '核对区间与符号',
    switchSignal: '导数难以整理时比较另一方法', basis: { source: 'problem', sourceQuote: 'f(x)=x²', missingCondition: '' } },
  { name: '代数结构', when: '能等价化为便于比较的形式', firstMove: '观察表达式结构', workload: '检查等价条件',
    switchSignal: '需要讨论过多分支时改看导数', basis: { source: 'none', sourceQuote: '', missingCondition: '需确认能等价化为简单结构' } },
], preferredIndex: 0, choiceRule: '优先比较变形与核对成本，无法保证最快。' }
function fixture(mode) {
  const value = structuredClone(base)
  if (mode === 'wrong_quote') value.routes[0].basis.sourceQuote = '伪造题目线索秘密'
  if (mode === 'missing_preferred') value.preferredIndex = 1
  if (mode === 'unknown') {
    value.preferredIndex = -1
    value.routes[0].basis = { source: 'none', sourceQuote: '', missingCondition: '需确认讨论区间' }
  }
  if (mode === 'guarantee') value.choiceRule = '求导一定最快。'
  if (mode === 'leak') value.routes[1].basis.missingCondition = '最终答案：2'
  return value
}
;(async () => {
  const port = await getTestPort()
  const origin = `http://127.0.0.1:${port}`
  const frontend = path.resolve(__dirname, '..')
  const relayRequests = [], modes = [], pageErrors = []
  server = spawn(process.execPath, [path.join(frontend, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1',
    '--port', String(port), '--strictPort'], { cwd: frontend, windowsHide: true, stdio: 'inherit' })
  let ready = false
  for (let i = 0; i < 300; i += 1) {
    try { if ((await fetch(origin)).ok) { ready = true; break } } catch {}
    await delay(100)
  }
  assert.equal(ready, true, 'local browser test server starts')
  browser = await chromium.launch({ executablePath: browserExecutable, headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.route('**/api/v1/problems/S1', route => route.fulfill({ json: {
    id: 'S1', title: '方法依据测试', type: 'solution', typeLabel: '解答题', content: '已知 f(x)=x²，判断单调性。',
    tags: ['函数'], answer: '参考答案秘密', solution: '参考解析秘密',
  } }))
  await page.route('**/api/**', route => route.request().url().includes('/api/v1/problems/S1')
    ? route.fallback() : route.fulfill({ json: { authenticated: true, user: { id: 'agent-test-admin', username: 'Agent regression', role: 'ADMIN' } } }))
  await page.route('**/__mathverse_similarity_proxy', route => {
    const request = route.request().postDataJSON()
    relayRequests.push(request)
    return route.fulfill({ json: { content: JSON.stringify(fixture(modes.shift() || 'valid')),
      model: request.model, elapsedMs: 10 } })
  })
  await page.goto(`${origin}/problems/S1`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '打开 Mathverse AI 助手' }).click()
  const drawer = page.getByRole('dialog', { name: 'Mathverse AI 学习助手' })
  await drawer.getByRole('button', { name: 'Qwen 百炼' }).click()
  await drawer.getByLabel('API Key').fill('synthetic-strategy-key')
  await drawer.getByRole('button', { name: '返回对话' }).click()
  const compare = drawer.getByRole('button', { name: /^比较解法路线/ })
  async function request(mode, errorPattern = null) {
    modes.push(mode)
    const selector = errorPattern ? '.ai-assistant-message.is-error' : '.ai-assistant-message.is-assistant'
    const message = drawer.locator(selector).nth(await drawer.locator(selector).count())
    await compare.click()
    await message.getByText(errorPattern || '解法路线图 · AI 初步比较').waitFor()
    return message
  }
  const first = await request('valid')
  assert.match(await first.textContent(), /题目原文线索：.*f/)
  assert.match(await first.textContent(), /还需核对：需确认能等价化为简单结构/)
  assert.match(await first.textContent(), /优先尝试 · AI 初步建议/)
  assert.equal(await first.locator('.ai-assistant-strategy-routes li').count(), 2)
  assert.equal(relayRequests[0].taskType, 'assistant-strategy')
  assert.equal(relayRequests[0].jsonMode, true)
  assert.match(relayRequests[0].messages.at(-1).content, /sourceQuote|missingCondition/)
  assert.doesNotMatch(JSON.stringify(relayRequests[0].messages), /参考答案秘密|参考解析秘密/)

  const unknown = await request('unknown')
  assert.match(await unknown.textContent(), /还需核对：需确认讨论区间/)
  assert.doesNotMatch(await unknown.textContent(), /优先尝试 · AI 初步建议/)
  const bad = await request('wrong_quote', /路线线索未逐字出现/)
  assert.doesNotMatch(await drawer.textContent(), /伪造题目线索秘密/)
  const retry = drawer.locator('.ai-assistant-message.is-assistant').nth(await drawer.locator('.ai-assistant-message.is-assistant').count())
  await bad.getByRole('button', { name: '重试', exact: true }).click()
  await retry.getByText('解法路线图 · AI 初步比较').waitFor()
  await request('missing_preferred', /推荐路线仍缺依据或条件/)
  await request('guarantee', /不能声称唯一最优或保证最快/)
  modes.push('leak')
  const hidden = drawer.locator('.ai-assistant-message.is-assistant').nth(await drawer.locator('.ai-assistant-message.is-assistant').count())
  await compare.click()
  await hidden.getByText(/路线图可能提前泄露答案，已隐藏/).waitFor()
  assert.equal(await hidden.locator('.is-strategy_map').count(), 0)
  assert.doesNotMatch(await drawer.textContent(), /最终答案：2/)
  const retryHidden = drawer.locator('.ai-assistant-message.is-assistant').nth(await drawer.locator('.ai-assistant-message.is-assistant').count())
  await hidden.getByRole('button', { name: '重新比较解法', exact: true }).click()
  await retryHidden.getByText('解法路线图 · AI 初步比较').waitFor()

  // Changing the sending scope expires successful maps and old error actions.
  await drawer.getByLabel('随请求发送').uncheck()
  await first.getByText(/已过期，仅供回顾/).waitFor()
  assert.equal(await bad.getByRole('button', { name: '重试', exact: true }).count(), 0)
  const callsBeforeOptOut = relayRequests.length
  await drawer.getByPlaceholder('向 AI 提问…').fill('比较解法路线')
  await drawer.getByRole('button', { name: '发送', exact: true }).click()
  await drawer.getByText('请先开启题目上下文，再比较当前题目的解法。').waitFor()
  assert.equal(relayRequests.length, callsBeforeOptOut)
  await drawer.getByRole('button', { name: '开启题目上下文', exact: true }).click()
  assert.match(await first.textContent(), /已过期，仅供回顾/)
  const current = await request('valid')

  // A -> B -> A source changes cannot accept a late map, even if transport ignores abort.
  await page.evaluate(() => {
    const originalFetch = window.fetch
    window.fetch = (url, options) => {
      if (String(url).includes('/__mathverse_similarity_proxy')) {
        window.fetch = originalFetch
        return new Promise(resolve => { window.__releaseStrategy = body => resolve(new Response(JSON.stringify(body), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        })) })
      }
      return originalFetch(url, options)
    }
  })
  await compare.click()
  await page.waitForFunction(() => Boolean(window.__releaseStrategy))
  await drawer.getByLabel('包含答案解析').check()
  await drawer.getByText('题目、引用或发送范围已变化，旧请求已取消。请按当前上下文重试。').waitFor()
  await drawer.getByLabel('包含答案解析').uncheck()
  const old = fixture('valid'); old.overview = '迟到路线不应显示。'
  await page.evaluate(body => window.__releaseStrategy(body), { content: JSON.stringify(old) })
  await page.waitForTimeout(50)
  assert.equal(await drawer.getByText('迟到路线不应显示。').count(), 0)
  assert.match(await current.textContent(), /已过期，仅供回顾/)
  await page.setViewportSize({ width: 390, height: 844 })
  const mobile = await request('valid')
  assert.match(await mobile.textContent(), /还需核对/)
  const width = await drawer.evaluate(element => element.scrollWidth)
  const clientWidth = await drawer.evaluate(element => element.clientWidth)
  assert.ok(width <= clientWidth + 2, 'basis cards fit the mobile drawer')
  assert.deepEqual(pageErrors, [])
  console.log('PASS: exact route clues, explicit missing conditions, cautious preference, bad-quote retry, guarantee rejection, leakage hiding, stale map/action cancellation and mobile layout')
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  await browser?.close(); server?.kill()
})
