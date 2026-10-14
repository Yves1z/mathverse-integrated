import { mathverseBrowserOptions } from '../../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const output = `${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/layered/space-revision-a-worlds`, errors = [], checks = {}, viewports = [];
const browser = await chromium.launch({ ...mathverseBrowserOptions(), headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } }); let page = await context.newPage();
const register = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); }; register(page);
const snap = () => page.evaluate(() => window.__mathverse.snapshot());
const study = () => page.evaluate(() => window.__spaceWorldStudy.snapshot());
const open = async title => { await page.getByRole('button', { name: '数学索引', exact: true }).click(); await page.getByRole('button', { name: `打开${title}`, exact: true }).click(); await page.waitForFunction(() => window.__mathverse.snapshot().reading.phase === 'reading', null, { timeout: 90000 }); };
const close = async () => { await page.keyboard.press('Escape'); await page.waitForFunction(() => window.__mathverse.snapshot().reading.phase === 'closed', null, { timeout: 60000 }); };
try {
  await page.goto(`${INTEGRATION_BASE_URL}/space-a/worlds/`, { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__spaceWorldStudy?.snapshot().readyWorlds === 6);
  for (const [width, height] of [[1280, 720], [1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    const bounds = await page.locator('.study-controls button,.worlds-navigation').evaluateAll(items => items.map(e => e.getBoundingClientRect().toJSON())); assert.ok(bounds.every(b => b.x >= 0 && b.right <= width && b.bottom <= height));
    await open('单位圆'); const rect = await page.getByTestId('reading-window').boundingBox(), panel = await page.locator('.reading-panel').boundingBox();
    assert.ok(Math.abs(rect.width * rect.height / (width * height) - .801) < .001); assert.ok(panel.x >= rect.x && panel.x + panel.width <= rect.x + rect.width + .1);
    await page.screenshot({ path: output + '/desktop-' + width + '.png' }); viewports.push({ width, height, area: .801 }); await close();
  }
  await open('高斯积分'); await page.screenshot({ path: output + '/reading-gaussian.png' }); await close();
  await open('莫比乌斯带'); await page.screenshot({ path: output + '/reading-mobius.png' }); await close(); checks.allSixWindowsHaveReading = true;
  const start = await study();
  for (let i = 0; i < 6; i++) { await open('欧拉恒等式'); await close(); }
  const end = await study(); assert.equal(end.geometries, start.geometries); assert.equal(end.textures, start.textures); checks.sixCyclesResourcesStable = true;
  await page.goto(`${INTEGRATION_BASE_URL}/space-a/`, { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__spaceStudy?.snapshot().structure);
  assert.equal((await page.evaluate(() => window.__spaceStudy.snapshot())).structure.particles, 0);
  await page.goto(`${INTEGRATION_BASE_URL}/`, { waitUntil: 'networkidle' }); await page.getByRole('button', { name: '推门进入', exact: true }).waitFor(); checks.originalEntranceAndPureStudy = true; await context.close();
  const reduced = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' }); page = await reduced.newPage(); register(page);
  await page.goto(`${INTEGRATION_BASE_URL}/space-a/worlds/`, { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__spaceWorldStudy?.snapshot().readyWorlds === 6);
  const r0 = await study(); assert.equal(r0.motion.paused, true); assert.equal(r0.motion.spaceFrozen, true);
  await page.getByRole('button', { name: '切换结构状态', exact: true }).click(); await page.waitForFunction(() => window.__spaceWorldStudy.snapshot().fold.angle === .52);
  await open('莱昂哈德·欧拉'); await page.getByRole('button', { name: '欧拉故事：城市与关系', exact: true }).click(); assert.equal((await snap()).euler.chapter, 1);
  await close(); checks.reducedMotionManualContent = true; await reduced.close();
  assert.deepEqual(errors, []);
  const report = { checkedAt: new Date().toISOString(), browser: browser.version(), checks, viewports, resources: { start: [start.geometries, start.textures], end: [end.geometries, end.textures] }, errors, scope: 'Functional checks and bounded resources over six reading cycles. Hardware GPU performance and long-duration Stage E remain separate.' };
  await fs.writeFile(output + '/qa-verification.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} catch (e) { if (!page.isClosed()) await page.screenshot({ path: output + '/qa-failure.png' }); throw e; }
finally { await browser.close(); }
