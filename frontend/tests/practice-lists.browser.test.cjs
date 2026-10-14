// 我的题单：整卡点击进入题单 + 批量选中删除。
const { getTestPort, browserExecutable } = require('./browser-support.cjs')
const { chromium } = require('playwright')
const { spawn } = require('node:child_process')
const { setTimeout: delay } = require('node:timers/promises')
const path = require('node:path'),
  assert = require('node:assert/strict')

const root = path.resolve(__dirname, '../..')
let browser, server

const OWNER = { publicId: 'owner', uid: 'UID00000001', username: 'mathverseadmin' }

function summary(id, title, extra = {}) {
  return {
    id,
    title,
    description: '',
    isDefault: false,
    isPublic: true,
    isOfficial: false,
    canEdit: true,
    owner: OWNER,
    createdAt: '2026-09-01T03:54:00.672153Z',
    updatedAt: '2026-09-22T03:54:00.672153Z',
    problemCount: 0,
    completedCount: 0,
    ...extra,
  }
}

const LISTS = [
  summary('mine-1', '圆锥曲线大题', { isDefault: true, problemCount: 5, completedCount: 3 }),
  summary('mine-2', '导数·基础'),
  summary('official-1', '官方起步题单', { isOfficial: true, problemCount: 1 }),
]

;(async () => {
  const port = await getTestPort()
  const origin = `http://127.0.0.1:${port}`
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  const deletedIds = []
  const patched = []
  const created = []
  page.on('pageerror', (e) => {
    errors.push(e.message)
    console.error('Browser error:', e.message)
  })

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const pathname = url.pathname
    const method = request.method()
    const ownedPrefix = '/api/v1/users/me/practice-lists'

    if (pathname === '/api/v1/auth/csrf') {
      return route.fulfill({ json: { headerName: 'X-XSRF-TOKEN', token: 'test-token' } })
    }
    if (pathname === '/api/v1/auth/me') {
      return route.fulfill({
        json: {
          authenticated: true,
          user: { id: 1, role: 'ADMIN', officialListOwner: true, username: 'mathverseadmin' },
        },
      })
    }
    if (pathname === ownedPrefix && method === 'GET') {
      return route.fulfill({ json: LISTS })
    }
    if (pathname === ownedPrefix && method === 'POST') {
      const body = JSON.parse(request.postData() || '{}')
      created.push(body)
      const list = summary('mine-new', body.title, { isPublic: body.isPublic === true })
      LISTS.push(list)
      return route.fulfill({ status: 201, json: list })
    }
    if (pathname.startsWith(`${ownedPrefix}/`) && method === 'GET') {
      const id = decodeURIComponent(pathname.slice(ownedPrefix.length + 1))
      const found = LISTS.find((list) => list.id === id)
      if (!found) return route.fulfill({ status: 404, json: { error: { message: 'not found' } } })
      return route.fulfill({ json: { ...found, items: [] } })
    }
    if (pathname.startsWith(`${ownedPrefix}/`) && method === 'DELETE') {
      const id = decodeURIComponent(pathname.slice(ownedPrefix.length + 1))
      deletedIds.push(id)
      const index = LISTS.findIndex((list) => list.id === id)
      if (index >= 0) LISTS.splice(index, 1)
      return route.fulfill({ json: { message: '题单已删除' } })
    }
    if (pathname.startsWith(`${ownedPrefix}/`) && method === 'PATCH') {
      const id = decodeURIComponent(pathname.slice(ownedPrefix.length + 1))
      const body = JSON.parse(request.postData() || '{}')
      patched.push({ id, ...body })
      const found = LISTS.find((list) => list.id === id)
      if (found) Object.assign(found, body)
      return route.fulfill({ json: found ?? {} })
    }
    if (pathname === '/api/v1/practice-lists') {
      if (url.searchParams.get('kind') === 'official') {
        return route.fulfill({
          json: [
            summary('official-a', '立体几何·压轴', { isOfficial: true, problemCount: 22 }),
            summary('official-b', '立体几何·基础', {
              isOfficial: true,
              problemCount: 3,
              completedCount: 3,
            }),
            summary('official-c', '导数·基础', { isOfficial: true, problemCount: 9 }),
            summary('official-d', '立体几何·提高', {
              isOfficial: true,
              problemCount: 20,
              completedCount: 5,
            }),
          ],
        })
      }
      return route.fulfill({ json: [] })
    }
    if (pathname === '/api/v1/practice-lists/stats') {
      return route.fulfill({
        json: { publicListCount: 7, publicContributorCount: 3, totalListCount: 12 },
      })
    }
    return route.fulfill({ json: {} })
  })

  await page.goto(`${origin}/training?tab=mine`)
  await page.locator('.training-card').first().waitFor()
  assert.equal(await page.locator('.training-card').count(), 3)
  assert.equal(
    await page.locator('.app-page-quote').count(),
    1,
    '页头应带一条励志语（与题库页同一套排版）',
  )

  // 顶部概况：公开题单 / 贡献者 / 累计创建。
  const headerStats = await page.locator('.app-page-stats').innerText()
  for (const label of ['已公开题单', '贡献者', '累计创建']) {
    assert.ok(headerStats.includes(label), `概况应包含「${label}」`)
  }
  const statValues = await page.locator('.app-page-stats dd').allInnerTexts()
  assert.deepEqual(statValues, ['7', '3', '12'])
  console.log('✓ 题单页顶部显示统计概况')

  await page.screenshot({ path: path.join(root, '.tmp/practice-lists-normal.png') })

  // 「打开题单」入口已移除，卡片本身即可点击。
  assert.equal(await page.getByText('打开题单').count(), 0)
  assert.equal(await page.getByRole('button', { name: /编辑题单：/ }).count(), 3)
  assert.equal(await page.getByRole('button', { name: /删除题单：/ }).count(), 3)

  // 图标按钮不应带框，图标必须居中（基础 button 样式的边框和内边距会挤歪它）。
  const editButton = page.getByRole('button', { name: '编辑题单：圆锥曲线大题' })
  const iconBox = await editButton.boundingBox()
  assert.equal(Math.round(iconBox.width), 30)
  assert.equal(Math.round(iconBox.height), 30)
  const iconMetrics = await editButton.evaluate((element) => {
    const style = getComputedStyle(element)
    const icon = element.querySelector('svg').getBoundingClientRect()
    const box = element.getBoundingClientRect()
    return {
      borderTopWidth: style.borderTopWidth,
      paddingLeft: style.paddingLeft,
      offsetX: Math.abs(icon.left + icon.width / 2 - (box.left + box.width / 2)),
      offsetY: Math.abs(icon.top + icon.height / 2 - (box.top + box.height / 2)),
    }
  })
  assert.equal(iconMetrics.borderTopWidth, '0px')
  assert.equal(iconMetrics.paddingLeft, '0px')
  assert.ok(iconMetrics.offsetX < 1 && iconMetrics.offsetY < 1, '图标应居中')
  console.log('✓ 图标按钮无框且居中')

  // 官方题单不再显示「由数海……」说明小字。
  await page.getByRole('tab', { name: '官方题单' }).click()
  await page.locator('.official-chart').waitFor()
  assert.equal(await page.getByText('由数海首位用户负责维护').count(), 0)
  // 加粗标题也去掉了：选择栏里已经有「官方题单」。
  assert.equal(await page.getByRole('heading', { name: '官方题单' }).count(), 0)

  // 排序按钮与标签栏同一行，且只显示三条线。
  const sortToggle = page.getByRole('button', { name: /题单排序：/ })
  assert.equal((await sortToggle.innerText()).trim(), '')
  const barGeometry = await page.evaluate(() => {
    const box = (selector) => document.querySelector(selector).getBoundingClientRect()
    const toggle = box('.official-chart-sort-toggle')
    const tabs = box('.training-main-tabs')
    return {
      toggleCenterY: toggle.top + toggle.height / 2,
      tabsCenterY: tabs.top + tabs.height / 2,
      rowCount: document.querySelectorAll('.training-shell-bar').length,
    }
  })
  assert.equal(barGeometry.rowCount, 1)
  assert.ok(
    Math.abs(barGeometry.toggleCenterY - barGeometry.tabsCenterY) < 2,
    '排序按钮不能另占一行',
  )
  await page.screenshot({ path: path.join(root, '.tmp/practice-lists-official.png') })
  console.log('✓ 官方题单无标题小字，排序按钮并入标签栏')

  // 排序：默认按数量，切换后立即改变顺序。
  const chartTitles = () => page.locator('.official-chart-title').allInnerTexts()
  const chooseSort = async (label) => {
    await page.getByRole('button', { name: /题单排序：/ }).click()
    await page.getByRole('menuitemradio', { name: label }).click()
  }

  assert.deepEqual(await chartTitles(), [
    '立体几何·基础',
    '导数·基础',
    '立体几何·提高',
    '立体几何·压轴',
  ])

  await chooseSort(/按名称/)
  const byName = await chartTitles()
  const start = byName.indexOf('立体几何·基础')
  assert.deepEqual(byName.slice(start, start + 3), [
    '立体几何·基础',
    '立体几何·提高',
    '立体几何·压轴',
  ])

  await chooseSort(/倒序/)
  assert.deepEqual(await chartTitles(), [...byName].reverse())

  await chooseSort(/按完成程度/)
  // 3/3 完成度最高，倒序时排在最前。
  assert.equal((await chartTitles())[0], '立体几何·基础')

  await chooseSort(/顺序/)
  await chooseSort(/按难度/)
  // 顺序下难度递增：基础 → 提高 → 压轴（同难度内按主题名）。
  const levelRanks = (await chartTitles()).map((title) =>
    ['基础', '提高', '压轴'].indexOf(title.split('·')[1]),
  )
  assert.deepEqual(
    levelRanks,
    [...levelRanks].sort((a, b) => a - b),
  )
  assert.equal(levelRanks[0], 0)
  assert.equal(levelRanks.at(-1), 2)

  await chooseSort(/按数量/)
  await page.getByRole('button', { name: /题单排序：/ }).click()
  // 菜单会被 Teleport 到 body；若留在题单面板里会被 .training-shell 的
  // overflow: hidden 裁掉，底部的「倒序」就点不到了。
  const menuGeometry = await page.evaluate(() => {
    const menu = document.querySelector('.official-chart-sort-menu')
    const options = [...menu.querySelectorAll('[role="menuitemradio"]')]
    const last = options.at(-1)
    const lastBox = last.getBoundingClientRect()
    const hit = document.elementFromPoint(
      lastBox.left + lastBox.width / 2,
      lastBox.top + lastBox.height / 2,
    )
    return {
      optionCount: options.length,
      menuBottom: Math.round(menu.getBoundingClientRect().bottom),
      lastOptionText: last.textContent.trim(),
      lastOptionHit: hit === last || last.contains(hit),
    }
  })
  assert.equal(menuGeometry.optionCount, 6)
  assert.equal(menuGeometry.lastOptionHit, true, '菜单底部选项必须可点击')
  console.log('✓ 排序菜单不被面板裁剪')
  await page.screenshot({ path: path.join(root, '.tmp/practice-lists-sort-menu.png') })
  await page.keyboard.press('Escape')
  console.log('✓ 官方题单排序（名称/数量/完成程度/难度 + 顺序倒序）')

  // 题单广场本版本未开放。
  await page.getByRole('tab', { name: '题单广场' }).click()
  await page.getByText('该版本未开放，敬请期待').waitFor()
  await page.screenshot({ path: path.join(root, '.tmp/practice-lists-square.png') })
  console.log('✓ 题单广场显示未开放提示')

  await page.getByRole('tab', { name: '我的题单' }).click()
  await page.locator('.training-card').first().waitFor()

  // 新题单可以直接在列表里改名。
  await page.getByRole('button', { name: '编辑题单：导数·基础' }).click()
  await page.locator('#training-edit-list-title').fill('导数·基础（已改名）')
  await page.locator('#training-edit-list-description').fill('改过的说明')
  await page.getByRole('button', { name: '保存修改' }).click()
  await page.locator('.training-operation-feedback').filter({ hasText: '题单信息已保存' }).waitFor()
  assert.equal(
    await page.locator('.training-card').filter({ hasText: '导数·基础（已改名）' }).count(),
    1,
  )
  assert.equal(patched.length, 1)
  assert.equal(patched[0].id, 'mine-2')
  assert.equal(patched[0].title, '导数·基础（已改名）')
  console.log('✓ 列表页可以编辑题单名称')

  // 1) 点击卡片空白处即可进入题单，不要求点「打开题单」。
  await page.locator('.training-card').first().click()
  await page.waitForURL(/\/training\/mine-1$/)
  console.log('✓ 点击整张卡片可以进入题单')

  await page.goBack()
  await page.locator('.training-card').first().waitFor()

  // 官方题单没有删除入口，也不能被选中。
  const officialCard = page.locator('.training-card').filter({ hasText: '官方起步题单' })
  // 调试阶段官方题单同样可以删除。
  assert.equal(await officialCard.getByRole('button', { name: /删除题单：/ }).count(), 1)

  // 2) 批量选中删除。
  await page.getByRole('button', { name: '批量管理' }).click()
  await page.getByText('已选 0 / 3').waitFor()

  await page.locator('.training-card').filter({ hasText: '圆锥曲线大题' }).click()
  await page.locator('.training-card').filter({ hasText: '导数·基础' }).click()
  await page.getByText('已选 2 / 3').waitFor()
  await page.screenshot({ path: path.join(root, '.tmp/practice-lists-selecting.png') })

  // 官方题单现在也能被选中。
  await officialCard.click()
  await page.getByText('已选 3 / 3').waitFor()

  await page.getByRole('button', { name: '删除选中' }).click()
  await page.locator('.training-confirm-dialog').getByRole('button', { name: '删除选中' }).click()
  await page
    .locator('.training-operation-feedback')
    .filter({ hasText: '已删除 3 份题单' })
    .waitFor()

  assert.deepEqual(deletedIds.sort(), ['mine-1', 'mine-2', 'official-1'])
  assert.equal(await page.locator('.training-card').count(), 0)
  await page.locator('.training-empty-state').waitFor()
  console.log('✓ 批量选中删除生效，官方题单同样可删除')

  // 新建题单不再提供公开选项，创建出来默认私密。
  await page.getByRole('button', { name: '创建第一份题单' }).click()
  await page
    .locator('.training-dialog')
    .getByText('公开题单暂未开放，创建的题单仅自己可见。')
    .waitFor()
  await page.locator('#training-list-title').fill('私有题单测试')
  await page.locator('.training-dialog').getByRole('button', { name: '创建题单' }).click()
  const createdCard = page.locator('.training-card').filter({ hasText: '私有题单测试' })
  await createdCard.waitFor()
  assert.equal(created.length, 1)
  assert.equal(created[0].isPublic, false)
  assert.equal(await createdCard.getByText('私密题单').count(), 1)
  console.log('✓ 新建题单一律私密，公开入口已移除')

  await page.screenshot({ path: path.join(root, '.tmp/practice-lists-desktop.png') })

  assert.deepEqual(errors, [])
  console.log('Practice list browser checks passed')
})()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await browser?.close()
    server?.kill()
  })
