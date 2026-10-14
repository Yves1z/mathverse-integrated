const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const { browserExecutable, getTestPort } = require('./browser-support.cjs')
const { chromium } = require('playwright')
const output = path.resolve(__dirname, '../../.tmp/mascot-motion')
fs.mkdirSync(output, { recursive: true })
let origin, browser, server

async function mockApi(page) {
  await page.route('**/api/**', route => route.fulfill({ json: { authenticated: true, user: { id: 'mascot-test-admin', role: 'ADMIN' } } }))
}
async function allImages(page, selector) {
  await page.locator(selector).evaluateAll(images => Promise.all(images.map(image => image.decode())))
}
async function state(page, selector, value) {
  await page.waitForFunction(({ selector, value }) => document.querySelector(selector)?.dataset.state === value, { selector, value })
}

;(async () => {
  const port = await getTestPort()
  origin = `http://127.0.0.1:${port}`
  const frontend = path.resolve(__dirname, '..')
  server = spawn(process.execPath, [path.join(frontend, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: frontend, windowsHide: true, stdio: 'ignore' })
  for (let i=0;i<500;i++) { try { if ((await fetch(origin)).ok) break } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  browser = await chromium.launch({ executablePath: browserExecutable, headless: true })
  const videoContext = await browser.newContext({ viewport: { width: 1200, height: 950 } })
  const gallery = await videoContext.newPage()
  const errors = []
  gallery.on('pageerror', error => errors.push(error.message))
  await mockApi(gallery)
  await gallery.goto(`${origin}/mascot-preview`, { waitUntil: 'networkidle' })
  await allImages(gallery, '.mascot-preview-main img')
  await gallery.screenshot({ path: path.join(output, 'mobius-motion-overview.png'), fullPage: true })
  await gallery.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1000; canvas.height = 700
    const ctx = canvas.getContext('2d')
    const stream = canvas.captureStream(30)
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_400_000 })
    const chunks = []
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
    const capture = { recorder, stream, chunks, frame: null }
    const render = () => {
      ctx.fillStyle = '#faf7f0'; ctx.fillRect(0, 0, 1000, 700)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#7e8aa0'; ctx.font = '16px Georgia, serif'; ctx.fillText('Mathverse', 500, 55)
      ctx.fillStyle = '#2c4164'; ctx.font = '27px "Microsoft YaHei", sans-serif'; ctx.fillText('莫比乌斯小兽 · 动态设计', 500, 100)
      const mascot = document.querySelector('.mascot-preview-main')
      const rig = mascot.querySelector('.mobius-rig')
      const bounds = mascot.getBoundingClientRect()
      const matrix = new DOMMatrix(getComputedStyle(rig).transform)
      ctx.save()
      ctx.translate(500, 145 + bounds.height * .82)
      ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f)
      ctx.translate(-bounds.width * .5, -bounds.height * .82)
      for (const img of rig.querySelectorAll('img')) {
        ctx.globalAlpha = Number(getComputedStyle(img).opacity)
        if (ctx.globalAlpha && img.complete) ctx.drawImage(img, 0, 0, bounds.width, bounds.height)
      }
      ctx.restore()
      ctx.globalAlpha = 1
      ctx.fillStyle = '#2c4164'; ctx.font = '25px "Microsoft YaHei", sans-serif'
      ctx.fillText(document.querySelector('.mascot-preview-caption h2').textContent, 500, 445)
      ctx.fillStyle = '#7a8595'; ctx.font = '15px "Microsoft YaHei", sans-serif'
      ctx.fillText(document.querySelector('.mascot-preview-caption p:last-child').textContent, 500, 485)
      const buttons = [...document.querySelectorAll('.mascot-preview-moments button')]
      buttons.forEach((button, i) => {
        const active = button.getAttribute('aria-pressed') === 'true'
        ctx.fillStyle = active ? '#e7edf5' : '#fffcf5'
        ctx.beginPath(); ctx.roundRect(24 + i * 195, 565, 172, 58, 18); ctx.fill()
        ctx.fillStyle = active ? '#344f79' : '#8b96a6'; ctx.font = '15px "Microsoft YaHei", sans-serif'
        ctx.fillText(button.querySelector('strong').textContent, 110 + i * 195, 600)
      })
      capture.frame = requestAnimationFrame(render)
    }
    render()
    recorder.start()
    window.__motionCapture = capture
  })
  const states = ['idle', 'curious', 'thinking', 'responding', 'sleeping']
  for (let i = 0; i < states.length; i++) {
    if (i) await gallery.locator('.mascot-preview-moments button').nth(i).click()
    await state(gallery, '.mascot-preview-main', states[i])
    const activePose = gallery.locator('.mascot-preview-main .mobius-pose.is-active')
    assert.match(await activePose.getAttribute('class'), new RegExp(`pose-${states[i]}\\b`))
    if (['curious', 'thinking', 'sleeping'].includes(states[i])) {
      assert.match(await activePose.getAttribute('src'), new RegExp(`mobius-${states[i]}-v2\\.webp`))
    }
    await gallery.waitForTimeout(i === 0 ? 7600 : 2300)
    await gallery.screenshot({ path: path.join(output, `mobius-${states[i]}.png`), fullPage: true })
  }
  const videoData = await gallery.evaluate(() => new Promise(resolve => {
    const capture = window.__motionCapture
    capture.recorder.onstop = () => {
      cancelAnimationFrame(capture.frame)
      capture.stream.getTracks().forEach(track => track.stop())
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.readAsDataURL(new Blob(capture.chunks, { type: 'video/webm' }))
    }
    capture.recorder.stop()
  }))
  fs.writeFileSync(path.join(output, 'mobius-motion-preview.webm'), Buffer.from(videoData, 'base64'))
  await gallery.setViewportSize({ width: 390, height: 844 })
  assert.equal(await gallery.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await gallery.screenshot({ path: path.join(output, 'mobius-motion-mobile.png'), fullPage: true })
  await videoContext.close()
  console.log('Five motion previews and mobile gallery rendered.')

  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  page.on('pageerror', error => errors.push(error.message))
  await page.clock.install()
  await mockApi(page)
  await page.goto(origin, { waitUntil: 'networkidle' })
  await allImages(page, '.home-mascot img')
  await state(page, '.home-mascot', 'idle')
  await page.locator('.home-mascot').evaluate(element => {
    for (const image of element.querySelectorAll('img')) {
      for (const animation of image.getAnimations()) animation.currentTime = 6970
    }
  })
  const blink = await page.locator('.home-mascot').evaluate(element => ({
    open: getComputedStyle(element.querySelector('.pose-idle')).opacity,
    closed: getComputedStyle(element.querySelector('.pose-blink')).opacity,
  }))
  assert.equal(blink.open, '0')
  assert.equal(blink.closed, '1')
  assert.equal(await page.locator('.home-mascot .pose-sleeping').evaluate(image => getComputedStyle(image).opacity), '0')
  await page.screenshot({ path: path.join(output, 'mobius-home-blink.png'), fullPage: true })
  await page.clock.fastForward(60_100)
  await state(page, '.home-mascot', 'sleeping')
  await page.screenshot({ path: path.join(output, 'mobius-home-rest.png'), fullPage: true })
  await page.locator('.home-brand').hover()
  await state(page, '.home-mascot', 'curious')
  await page.mouse.move(5, 5)
  await state(page, '.home-mascot', 'idle')
  await page.locator('#home-search-input').fill('导数')
  await state(page, '.home-mascot', 'curious')
  await page.locator('#home-search-input').fill('')
  await state(page, '.home-mascot', 'idle')
  console.log('Blink, 60-second rest, hover wake and typing response passed.')

  await page.locator('.ai-assistant-launcher').click()
  await page.getByRole('button', { name: 'DeepSeek', exact: true }).click()
  await page.getByLabel('API Key', { exact: true }).fill('mock-motion-key')
  await page.getByRole('button', { name: '返回对话' }).click()
  let release
  let requestCount = 0
  await page.route('**/__mathverse_similarity_proxy', async route => {
    requestCount++
    const result = await new Promise(resolve => { release = resolve })
    try {
      await route.fulfill(result === 'error'
        ? { status: 503, json: { error: { message: '服务暂时不可用，请稍后重试' } } }
        : { json: { content: '可以先把已知条件整理出来。', model: 'mock-model', elapsedMs: 100, usage: { totalTokens: 20 } } })
    } catch (error) {
      if (!/cancel|closed|disposed|handled/i.test(error.message)) throw error
    }
  })
  const composer = page.locator('.ai-assistant-composer textarea')
  await composer.fill('给我一个学习方向')
  await state(page, '.ai-assistant-header-mascot', 'curious')
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await state(page, '.ai-assistant-header-mascot', 'thinking')
  await page.screenshot({ path: path.join(output, 'mobius-assistant-thinking.png'), fullPage: true })
  while (!release) await new Promise(resolve => setTimeout(resolve, 20))
  release('success')
  await state(page, '.ai-assistant-header-mascot', 'responding')
  await page.screenshot({ path: path.join(output, 'mobius-assistant-response.png'), fullPage: true })
  await page.clock.fastForward(1900)
  await state(page, '.ai-assistant-header-mascot', 'idle')

  release = null
  await composer.fill('换一个学习方向')
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await state(page, '.ai-assistant-header-mascot', 'thinking')
  while (!release) await new Promise(resolve => setTimeout(resolve, 20))
  release('error')
  await page.getByText('服务暂时不可用，请稍后重试', { exact: true }).first().waitFor()
  assert.notEqual(await page.locator('.ai-assistant-header-mascot').getAttribute('data-state'), 'responding')

  release = null
  await composer.fill('这次先暂停')
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await state(page, '.ai-assistant-header-mascot', 'thinking')
  while (!release) await new Promise(resolve => setTimeout(resolve, 20))
  await page.getByRole('button', { name: '停止', exact: true }).click()
  release('success')
  await page.waitForTimeout(150)
  assert.notEqual(await page.locator('.ai-assistant-header-mascot').getAttribute('data-state'), 'thinking')
  assert.notEqual(await page.locator('.ai-assistant-header-mascot').getAttribute('data-state'), 'responding')
  console.log(`Actual assistant state transitions passed with ${requestCount} mocked requests; no live provider.`)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(100)
  const animations = await page.locator('.mathverse-mascot .mobius-rig').evaluateAll(rigs => rigs.map(rig => getComputedStyle(rig).animationName))
  assert.equal(animations.every(name => name === 'none'), true)
  assert.equal(await page.locator('.home-mascot').evaluate(element => getComputedStyle(element.querySelector('.pose-idle')).opacity), '1')
  await page.getByRole('button', { name: '关闭 AI 助手', exact: true }).click()
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    const geometry = await page.evaluate(() => ({
      viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
      launcherBottom: document.querySelector('.ai-assistant-launcher').getBoundingClientRect().bottom,
      footerTop: document.querySelector('.home-footer').getBoundingClientRect().top,
    }))
    assert.equal(geometry.documentWidth <= geometry.viewport, true)
    assert.equal(geometry.launcherBottom < geometry.footerTop, true)
    console.log('Mobile geometry:', JSON.stringify(geometry))
  }
  assert.deepEqual(errors, [])
  console.log('Reduced motion, mobile clearance and no runtime errors passed.')
  await page.close()
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => { await browser?.close(); server?.kill() })
