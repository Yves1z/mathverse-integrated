require('./browser-support.cjs')
const { chromium } = require('playwright')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict')
const root = path.resolve(__dirname, '../..'),
  fixtures = require('./choice-layout.fixture.json')
let browser, server
;(async () => {
  const port = String(await require('./browser-support.cjs').getTestPort())
  const origin = `http://127.0.0.1:${port}`
  server = spawn(
    process.execPath,
    [
      path.join(root, 'frontend/node_modules/vite/bin/vite.js'),
      '--host',
      '127.0.0.1',
      '--port',
      port,
      '--strictPort',
    ],
    { cwd: path.join(root, 'frontend'), windowsHide: true, stdio: 'ignore' },
  )
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin)).ok) break
    } catch {}
    await delay(100)
  }
  const chrome =
    process.env.CHROME_EXECUTABLE ||
    (process.platform === 'win32' &&
    fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
      ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
      : undefined)
  browser = await chromium.launch({ executablePath: chrome, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/api/**', async (r) => {
    const u = new URL(r.request().url())
    let body = {}
    if (u.pathname === '/api/v1/auth/me') body = { authenticated: false }
    else if (u.pathname === '/api/v1/curriculum') body = require('./curriculum.fixture.cjs')
    else if (u.pathname === '/api/v1/problems/tag-taxonomy')
      body = require('../../backend/src/main/resources/tag-taxonomy.json')
    else if (u.pathname === '/api/v1/problems')
      body = {
        items: fixtures,
        pagination: { page: 1, pageSize: 20, total: fixtures.length, hasNext: false },
      }
    else if (u.pathname.startsWith('/api/v1/problems/'))
      body = {
        ...fixtures.find((p) => u.pathname.endsWith(p.id)),
        answer: '答案',
        solution: '解析',
        viewerState: {},
        uploader: {},
      }
    else if (u.pathname === '/api/v1/problem-stats')
      body = { total: fixtures.length, yearCount: 1, tagCount: 2 }
    await r.fulfill({ json: body })
  })
  await page.goto(origin + '/problems', { waitUntil: 'networkidle' })

  const card = (id) =>
    page.locator(`article.bank-result-problem-panel-view-card[data-problem-id="${id}"]`)
  const choices = (id) => card(id).locator('.bank-problem-screen-content .math-choices')
  const optionRows = (id) =>
    choices(id)
      .locator('.math-choice')
      .evaluateAll(
        (items) => new Set(items.map((item) => Math.round(item.getBoundingClientRect().top))).size,
      )
  const noOverflow = (id) =>
    choices(id).evaluate(
      (el) =>
        el.scrollWidth <= el.clientWidth + 1 &&
        [...el.querySelectorAll('.math-choice-content')].every(
          (item) => item.scrollWidth <= item.clientWidth + 1,
        ),
    )

  await choices('GC000001').waitFor()
  assert.equal(
    await choices('GC000001').locator('.math-choice').count(),
    4,
    '四个选项都要拆成独立格子',
  )
  assert.deepEqual(
    await choices('GC000001')
      .locator('.math-choice-content')
      .evaluateAll((items) => items.map((item) => item.textContent.trim().slice(0, 2))),
    ['A．', 'B．', 'C．', 'D．'],
  )
  assert.equal(await optionRows('GC000001'), 1, '短选项宽屏排成一行四项')
  assert.ok((await optionRows('GC000002')) <= 2, '长选项宽屏不挤成一行四项')
  assert.ok((await noOverflow('GC000001')) && (await noOverflow('GC000002')))
  assert.equal(
    await choices('GC000004').locator('.math-choice').count(),
    4,
    '整段公式里的选项也要拆开',
  )
  assert.deepEqual(
    await choices('GC000004')
      .locator('.math-choice-content')
      .evaluateAll((items) => items.map((item) => item.textContent.trim().slice(0, 2))),
    ['A．', 'B．', 'C．', 'D．'],
  )
  assert.ok((await optionRows('GC000004')) <= 2, '公式型选项宽屏不挤成一行四项')
  assert.ok(await noOverflow('GC000004'))
  assert.equal(
    await card('GF000003').locator('.bank-problem-screen-content .math-choices').count(),
    0,
    '填空题不套用选项排版',
  )
  await page.screenshot({ path: path.join(root, '.tmp/choice-layout-desktop.png') })

  // 卡片动作：曾经还有个「查看详情」，与标题链接重复，已移除。
  assert.equal(
    await card('GC000001').getByRole('link', { name: '查看详情' }).count(),
    0,
    '题卡不再有查看详情按钮',
  )
  await card('GC000001').locator('.bank-problem-export > button').click()
  assert.deepEqual(
    await card('GC000001').locator('.bank-problem-export-menu [role="menuitem"]').allInnerTexts(),
    ['导出为 PDF', '导出为图片（PNG）', '复制为 Markdown'],
    '导出菜单只剩 PDF、图片与 Markdown',
  )

  // 导出图片曾经把 content 当纯文本画到 canvas 上，导出的 PNG 里是 LaTeX 源码。
  await page.evaluate(() => {
    window.__exportDocuments = []
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          const document = node.nodeType === 1 ? node.querySelector?.('.pdf-document') : null
          if (document?.querySelector('math'))
            window.__exportDocuments.push(document.innerHTML.length)
        }
      }
    }).observe(document.body, { childList: true })
  })
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    card('GC000001').getByRole('menuitem', { name: '导出为图片（PNG）' }).click(),
  ])
  assert.equal(download.suggestedFilename(), '等差数列的通项.png')
  const image = path.join(root, '.tmp/choice-layout-export.png')
  await download.saveAs(image)
  assert.ok(fs.statSync(image).size > 20000, '导出的 PNG 体积过小，可能没渲染出公式')
  assert.equal(
    await page.evaluate(() => window.__exportDocuments.length),
    1,
    '导出图片应先把渲染后的 MathML 文档挂到页面里',
  )
  assert.ok(await page.getByText('题目图片已导出', { exact: true }).count())
  console.log('✓ 导出图片走渲染后的 MathML 文档')

  // 导出 PDF 与图片同一条管线：曾用 blob URL 的 foreignObject SVG，画布被污染后 toDataURL 抛错。
  await card('GC000001').locator('.bank-problem-export > button').click()
  const [pdfDownload] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    card('GC000001').getByRole('menuitem', { name: '导出为 PDF' }).click(),
  ])
  const pdf = path.join(root, '.tmp/choice-layout-export.pdf')
  await pdfDownload.saveAs(pdf)
  assert.ok(fs.statSync(pdf).size > 5000, '导出的 PDF 体积过小，可能渲染失败')
  console.log('✓ 导出 PDF 可用')

  // 打印：宿主曾经是 display:none，MathText 量不到宽度，选项在打印里只能一行一个。
  await page.evaluate(() => {
    window.print = () => {
      window.__printed = true
    }
  })
  await card('GC000002').getByRole('button', { name: '打印', exact: true }).click()
  await page.waitForFunction(() => window.__printed)
  const printHost = await page.evaluate(() => {
    const host = document.querySelector('#print-view')
    const text = host.querySelector('.bank-problem-print-content .math-text')
    const choices = text.querySelector('.math-choices')
    const items = [...choices.querySelectorAll('.math-choice')]
    return {
      display: getComputedStyle(host).display,
      width: Math.round(host.getBoundingClientRect().width),
      textWidth: Math.round(text.getBoundingClientRect().width),
      columns: getComputedStyle(choices).getPropertyValue('--choice-columns').trim(),
      rows: new Set(items.map((item) => Math.round(item.getBoundingClientRect().top))).size,
      overflow: choices.scrollWidth > choices.clientWidth + 1,
    }
  })
  assert.notEqual(printHost.display, 'none', '打印宿主必须在屏幕上有真实布局')
  assert.ok(
    Math.abs(printHost.width - 665) <= 2,
    `打印宿主宽度应为 @page 的 A4 正文宽度（176mm ≈ 665px），实际 ${printHost.width}`,
  )
  assert.equal(printHost.columns, '2', '长选项在打印里按页面宽度排两列')
  assert.equal(printHost.rows, 2)
  assert.equal(printHost.overflow, false, '打印里选项不应溢出')
  await page.emulateMedia({ media: 'print' })
  await page.setViewportSize({ width: printHost.width, height: 1000 })
  await page.waitForTimeout(200)
  const printedGeometry = await page.evaluate(() => {
    const text = document.querySelector('#print-view .bank-problem-print-content .math-text')
    return {
      width: Math.round(text.getBoundingClientRect().width),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    }
  })
  assert.equal(printedGeometry.width, printHost.textWidth, '打印宽度应与离屏测量的一致')
  assert.equal(printedGeometry.overflow, false)
  await page.emulateMedia({ media: null })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await page.waitForFunction(() => !document.body.classList.contains('is-printing-problems'))
  console.log('✓ 打印选项按 A4 正文宽度分列')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(300)
  assert.equal(await optionRows('GC000001'), 1, '短选项手机上也排一行四项')
  assert.ok((await optionRows('GC000002')) >= 2, '较长选项手机上自动减少列数')
  assert.ok((await optionRows('GC000004')) >= 2, '公式型选项手机上自动减少列数')
  assert.ok(
    (await noOverflow('GC000001')) &&
      (await noOverflow('GC000002')) &&
      (await noOverflow('GC000004')),
  )
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2))
  await page.screenshot({ path: path.join(root, '.tmp/choice-layout-mobile.png') })

  assert.deepEqual(errors, [])
  console.log('choice layout ok')
  await browser.close()
  server.kill()
})().catch(async (error) => {
  console.error(error)
  await browser?.close()
  server?.kill()
  process.exit(1)
})
