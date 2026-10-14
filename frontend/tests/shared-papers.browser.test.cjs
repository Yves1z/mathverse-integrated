const { getTestPort, browserExecutable } = require('./browser-support.cjs')
const { chromium } = require('playwright')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const path = require('node:path'),
  assert = require('node:assert/strict')
const root = path.resolve(__dirname, '../..')
let browser, server
;(async () => {
  const port = await getTestPort(),
    origin = `http://127.0.0.1:${port}`
  server = spawn(
    process.execPath,
    [
      path.join(root, 'frontend/node_modules/vite/bin/vite.js'),
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
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
  browser = await chromium.launch({ executablePath: browserExecutable, headless: true })
  const page = await browser.newPage({ viewport: { width: 1480, height: 1000 } }),
    errors = [],
    requests = []
  page.on('pageerror', (e) => errors.push(e.message))
  const snapshot = {
    version: 1,
    title: '高三数学综合练习（一）',
    size: 'a4',
    targetScore: 150,
    items: [
      {
        problem: {
          id: 'GC000001',
          content: '已知集合 $A=\\{1,2,3\\}$，求 $A$ 的子集个数。',
          type: 'single-choice',
          typeLabel: '单选题',
          assets: [],
        },
        score: 5,
        space: 20,
        breakBefore: false,
      },
    ],
  }
  let paper = {
    id: '11111111-1111-4111-8111-111111111111',
    title: snapshot.title,
    kind: 'BUILDER',
    author: 'Aurora',
    source: '原创练习',
    year: 2026,
    exam_mode: '新高考Ⅰ卷',
    question_count: 1,
    total_score: 5,
    favorite_count: 0,
    rating_count: 0,
    canEdit: false,
    canCheck: true,
    favorite: false,
    myRating: [],
    snapshot,
    created_at: '2026-09-12T09:00:00Z',
    description: '集合与逻辑专题练习，适合一轮复习。',
  }
  let emptyScope = ''
  await page.route('**/api/**', async (r) => {
    const u = new URL(r.request().url()),
      method = r.request().method()
    requests.push({ path: u.pathname, method })
    let body = {}
    if (u.pathname === '/api/v1/auth/me')
      body = { authenticated: true, user: { id: 2, username: 'Reader', role: 'ADMIN' } }
    else if (u.pathname === '/api/v1/auth/csrf')
      body = { headerName: 'X-XSRF-TOKEN', token: 'test' }
    else if (u.pathname === '/api/v1/papers')
      body =
        emptyScope && u.searchParams.get('scope') === emptyScope
          ? { items: [], total: 0, page: 1 }
          : {
              items: [
                paper,
                ...Array.from({ length: 5 }, (_, i) => ({
                  ...paper,
                  id: `copy-${i}`,
                  title: [
                    '高考数学模拟卷 · 第二套',
                    '解析几何专项练习',
                    '高三数学阶段测试',
                    '函数与导数提升训练',
                    '概率统计专题',
                  ][i],
                  hot: i === 0,
                })),
              ],
              total: 6,
              page: 1,
            }
    else if (u.pathname === '/api/v1/papers/stats')
      body = { publicPaperCount: 6, publicContributorCount: 2, totalPaperCount: 8 }
    else if (u.pathname.endsWith('/favorite')) {
      paper.favorite = r.request().postDataJSON().favorite
      paper.favorite_count = Number(paper.favorite)
    } else if (u.pathname.endsWith('/rating')) {
      paper.myRating = [r.request().postDataJSON()]
      paper.rating_count = 1
    } else if (u.pathname.endsWith('/check')) {
      paper.checked_at = '2026-09-12T09:00:00Z'
      paper.check_note = r.request().postDataJSON().note
      paper.checked_by_name = 'Reviewer'
    } else if (u.pathname.endsWith('/access')) body = { ok: true }
    else if (u.pathname === `/api/v1/papers/${paper.id}`) body = paper
    else if (u.pathname === '/api/v1/papers/original-v2')
      body = { ...paper, id: 'original-v2', revision: 2 }
    else if (u.pathname === '/api/v1/curriculum') body = require('./curriculum.fixture.cjs')
    else if (u.pathname === '/api/v1/problems/tag-taxonomy')
      body = require('../../backend/src/main/resources/tag-taxonomy.json')
    else if (u.pathname === '/api/v1/problems')
      body = { items: [], pagination: { total: 0, page: 1, pageSize: 12, hasNext: false } }
    await r.fulfill({ json: body })
  })
  await page.goto(origin + '/papers', { waitUntil: 'networkidle' })
  assert.equal(await page.locator('.shared-row').count(), 6)
  // 页头励志语与题库页同一套排版。
  assert.deepEqual(
    await page
      .locator('.app-page-quote')
      .evaluateAll((items) =>
        items.map((item) => `${getComputedStyle(item).fontSize}/${getComputedStyle(item).color}`),
      ),
    ['16px/rgb(82, 109, 130)'],
  )
  assert.equal(
    requests.some((r) => r.path.endsWith('/access')),
    false,
  )

  // 顶部概况：已公开试卷 / 贡献者 / 累计创建（与题单页同一套样式）。
  assert.equal(
    requests.some((r) => r.path === '/api/v1/papers/stats'),
    true,
    '应请求试卷概况接口',
  )
  const paperStats = await page.locator('.app-page-stats').innerText()
  for (const label of ['已公开试卷', '贡献者', '累计创建']) {
    assert.ok(paperStats.includes(label), `概况应包含「${label}」`)
  }
  assert.deepEqual(await page.locator('.app-page-stats dd').allInnerTexts(), ['6', '2', '8'])
  console.log('✓ 试卷页顶部显示统计概况')
  await page.screenshot({ path: path.join(root, '.tmp/shared-papers-desktop.png'), fullPage: true })
  await page.locator('.shared-row').first().click()

  // 卷面直接渲染成打印排版，展全部题目，不再需要点进预览页。
  await page.waitForFunction(() =>
    document.querySelector('.paper-canvas .paper-sheet')?.innerText.includes('子集'),
  )
  const sheetGeometry = await page.evaluate((expectedTitle) => {
    const sheet = document.querySelector('.paper-canvas .paper-sheet')
    const canvas = document.querySelector('.paper-canvas')
    return {
      pages: document.querySelectorAll('.paper-canvas .paper-sheet').length,
      sheetWidth: Math.round(sheet.getBoundingClientRect().width),
      canvasWidth: Math.round(canvas.getBoundingClientRect().width),
      hasFooter: /第 1 页（共 1 页）/.test(sheet.innerText),
      hasHeading: sheet.innerText.includes(expectedTitle),
      horizontalScroll: document.documentElement.scrollWidth - window.innerWidth,
    }
  }, snapshot.title)
  assert.equal(sheetGeometry.pages, 1)
  assert.equal(sheetGeometry.hasFooter, true, '卷面应带页码页脚')
  assert.equal(sheetGeometry.hasHeading, true, '卷面应带试卷标题')
  assert.ok(
    sheetGeometry.sheetWidth > sheetGeometry.canvasWidth * 0.8,
    `默认适合宽度应基本填满画布（${sheetGeometry.sheetWidth}/${sheetGeometry.canvasWidth}）`,
  )
  assert.equal(sheetGeometry.horizontalScroll, 0)
  console.log('✓ 详情页直接显示完整卷面（默认适合宽度）')

  // 改窗口大小后必须重新适配：卷面曾经因为观察器绑在还没挂载的画布上而卡在旧缩放，
  // 缩窗后纸张比画布宽、右边被裁掉。
  for (const width of [1180, 1600, 2400, 1300]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.waitForTimeout(300)
    const fitted = await page.evaluate(() => {
      const canvas = document.querySelector('.paper-canvas')
      const style = getComputedStyle(canvas)
      const inner =
        canvas.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const sheet = document.querySelector('.paper-canvas .paper-sheet').getBoundingClientRect()
      return {
        inner: Math.round(inner),
        sheet: Math.round(sheet.width),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      }
    })
    assert.ok(
      fitted.sheet <= fitted.inner + 1,
      `${width}px 下卷面应完整落在画布内（${fitted.sheet}/${fitted.inner}）`,
    )
    assert.equal(fitted.overflow, 0)
  }
  await page.setViewportSize({ width: 1480, height: 1000 })
  console.log('✓ 窗口缩放后卷面重新适配、不被裁切')

  await page.getByRole('button', { name: '收藏试卷' }).click()
  await page.getByRole('button', { name: '取消收藏' }).waitFor()

  // 评价默认收起，展开后点星提交。
  await page.getByRole('button', { name: '写评价' }).click()
  await page.getByRole('radio', { name: '难度 4 星' }).click()
  await page.getByRole('radio', { name: '契合度 5 星' }).click()
  await page.getByRole('button', { name: '提交评价', exact: true }).click()
  await page.getByText('评价已保存', { exact: true }).waitFor()
  assert.equal(paper.myRating[0].difficulty, 4)
  assert.equal(paper.myRating[0].alignment, 5)

  // 管理员操作默认收起。
  assert.equal(await page.getByLabel('已核对的内容').count(), 0)
  await page.getByRole('button', { name: /管理员操作/ }).click()
  await page.getByLabel('已核对的内容').fill('已核对题干与配图')
  await page.getByRole('button', { name: '记录校核', exact: true }).click()
  await page.getByText('校核记录已保存', { exact: true }).waitFor()
  await page.screenshot({ path: path.join(root, '.tmp/shared-paper-detail.png'), fullPage: true })
  await page.evaluate((s) => {
    localStorage.setItem('mathverse:paper-draft:v1', JSON.stringify(s))
    localStorage.setItem(
      'mathverse:paper-library:v1',
      JSON.stringify([{ id: 'private', updatedAt: Date.now(), draft: s }]),
    )
  }, snapshot)
  const before = await page.evaluate(() => localStorage.getItem('mathverse:paper-draft:v1'))
  await page.evaluate(
    () =>
      (window.print = () => {
        window.__printed = !!document.querySelector('#paper-print-root .paper-sheet')
      }),
  )
  await page.getByRole('button', { name: '打印 / PDF', exact: true }).first().click()
  assert.equal(await page.evaluate(() => window.__printed), true)
  assert.equal(
    await page.locator('#paper-print-root .paper-sheet').count(),
    sheetGeometry.pages,
    '打印副本页数应与卷面一致',
  )
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  assert.equal(await page.locator('#paper-print-root').count(), 0)
  assert.equal(await page.evaluate(() => localStorage.getItem('mathverse:paper-draft:v1')), before)
  await page.getByRole('button', { name: '复制到我的组卷' }).click()
  await page.waitForURL('**/paper/edit/**')
  assert.equal(await page.getByLabel('试卷名称', { exact: true }).inputValue(), snapshot.title)

  // 发布入口已整体下线：旧链接回到试卷库，页面里不再有任何发布按钮。
  await page.goto(origin + '/papers/new?draft=private', { waitUntil: 'networkidle' })
  assert.equal(new URL(page.url()).pathname, '/papers')
  assert.equal(await page.getByRole('button', { name: '发布试卷', exact: true }).count(), 0)
  assert.equal(
    await page.getByText('PDF 上传暂未开放，可先分享站内组卷。', { exact: true }).count(),
    0,
  )

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(origin + '/papers', { waitUntil: 'networkidle' })
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  )
  await page.screenshot({ path: path.join(root, '.tmp/shared-papers-mobile.png'), fullPage: true })

  // 收藏为空时只说明怎么收藏：这一页不承担发布入口，「分享组卷」曾被误加回空状态。
  emptyScope = 'favorites'
  await page.setViewportSize({ width: 1480, height: 1000 })
  await page.goto(origin + '/papers?scope=favorites', { waitUntil: 'networkidle' })
  await page.getByText('还没有收藏的试卷', { exact: true }).waitFor()
  assert.equal(
    await page.getByText('在试卷详情页点「收藏试卷」，就会出现在这里。', { exact: true }).count(),
    1,
  )
  assert.equal(await page.getByRole('link', { name: '分享组卷' }).count(), 0)
  assert.equal(await page.getByRole('button', { name: '清除筛选条件' }).count(), 0)
  await page.screenshot({
    path: path.join(root, '.tmp/shared-papers-favorites-empty.png'),
    fullPage: true,
  })
  emptyScope = ''
  console.log('✓ 收藏空状态只给提示，不出现发布入口')
  paper.original_paper_id = 'original'
  paper.revision = 1
  paper.versions = [
    { id: 'original-v2', revision: 2, revision_note: '修正第1题' },
    { id: paper.id, revision: 1, revision_note: '首次核验' },
  ]
  await page.goto(origin + '/papers/' + paper.id, { waitUntil: 'networkidle' })
  await page.getByText('已有新版 v2，建议查看修订说明。').waitFor()
  await page.getByRole('link', { name: 'v2', exact: true }).click()
  await page.locator('.shared-meta .is-version').filter({ hasText: 'v2' }).waitFor()
  assert.equal(await page.getByText('已有新版 v2，建议查看修订说明。').count(), 0)
  assert.deepEqual(errors, [])
  console.log(
    'Shared papers: list, detail sheet, favorite, rating, review, print, draft isolation, copy, publish-entry removal and mobile checks passed',
  )
})()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await browser?.close()
    server?.kill()
  })
