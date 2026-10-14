import { mathverseBrowserOptions } from '../../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const output = `${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/layered/space-revision-a-worlds`;
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ ...mathverseBrowserOptions(), headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: output + '/recording', size: { width: 1600, height: 900 } } });
let page = await context.newPage(); const video = page.video(), errors = [], checks = {};
const register = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', e => { if (e.type() === 'error') errors.push(e.text()); }); }; register(page);
const snap = () => page.evaluate(() => window.__mathverse.snapshot());
const study = () => page.evaluate(() => window.__spaceWorldStudy.snapshot());
const save = name => page.screenshot({ path: output + '/' + name + '.png' });
const waitRead = () => page.waitForFunction(() => window.__mathverse.snapshot().reading.phase === 'reading', null, { timeout: 90000 });
const open = async title => { await page.getByRole('button', { name: '数学索引', exact: true }).click(); await page.getByRole('button', { name: `打开${title}`, exact: true }).click(); await waitRead(); };
const close = async () => { await page.keyboard.press('Escape'); await page.waitForFunction(() => window.__mathverse.snapshot().reading.phase === 'closed', null, { timeout: 60000 }); };
const aim = async (yaw, pitch = 0) => {
  const width = page.viewportSize().width, height = page.viewportSize().height;
  for (let i = 0; i < 8; i++) {
    const s = await snap(), dx = Math.max(-width * .33, Math.min(width * .33, (yaw - s.targetYaw) * width / Math.PI)), dy = Math.max(-height * .33, Math.min(height * .33, (pitch - s.targetPitch) * width / Math.PI));
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) break;
    await page.mouse.move(width / 2, height / 2); await page.mouse.down(); await page.mouse.move(width / 2 + dx, height / 2 - dy, { steps: 20 }); await page.mouse.up();
  }
  await page.mouse.move(0, 0); await page.waitForTimeout(1000);
};
try {
  const response = await page.goto(`${INTEGRATION_BASE_URL}/space-a/worlds/`, { waitUntil: 'networkidle' }); assert.equal(response.status(), 200);
  await page.waitForFunction(() => window.__spaceWorldStudy?.snapshot().readyWorlds === 6 && window.__mathverse?.snapshot().worlds['euler-identity']);
  await page.waitForTimeout(700); await save('first-view');
  const beginning = await snap(); await page.waitForTimeout(1000); assert.ok((await snap()).z < beginning.z);
  await page.getByRole('button', { name: '暂停前进', exact: true }).click(); await page.waitForFunction(() => window.__mathverse.snapshot().speed === 0);
  await aim(-.55, .15); await save('mounted-identity');
  const visible = (await snap()).nodes.find(n => n.onScreen && !n.occluded && n.id === 'euler-identity'); assert.ok(visible, 'Hero window should be visible through its structural opening');
  await page.mouse.click(...visible.screen); await waitRead(); assert.equal((await snap()).reading.selectedId, 'euler-identity'); checks.actualPortalPicking = true;
  await page.waitForFunction(() => Math.abs(window.__mathverse.snapshot().speed - .021) < 1e-6, null, { timeout: 45000 });
  const before = await snap(); await page.waitForTimeout(900); const after = await snap();
  assert.ok(after.z < before.z); assert.equal(after.speedScale, .06); assert.ok(Math.abs(after.observation.area - .801) < 1e-6); checks.nonzeroReadingAnd80PercentWindow = true;
  const slider = page.getByRole('slider', { name: /改变角度/ }), box = await slider.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => Math.abs(window.__mathverse.snapshot().worlds['unit-circle'].angle - Math.PI) < .04, null, { timeout: 45000 });
  const half = await snap();
  for (const id of ['euler-identity', 'unit-circle', 'complex-rotation']) { const w = half.worlds[id], r = id === 'complex-rotation' ? 1.8 : 2; assert.equal(w.angle, half.worlds['euler-identity'].angle); assert.ok(Math.abs(w.marker[0] / r - Math.cos(w.angle)) < 1e-8); assert.ok(Math.abs(w.marker[1] / r - Math.sin(w.angle)) < 1e-8); }
  checks.threeWorldsShareActualMarkers = true; await save('reading-identity');
  await page.getByRole('button', { name: '继续阅读：单位圆', exact: true }).click(); await page.waitForTimeout(700); assert.equal((await snap()).reading.angle, half.reading.angle); await save('reading-circle');
  await page.getByRole('button', { name: '继续阅读：复数的旋转', exact: true }).click(); await page.waitForTimeout(700); await save('reading-rotation');
  await page.getByRole('button', { name: '继续阅读：莱昂哈德·欧拉', exact: true }).click(); await page.waitForTimeout(700); await save('euler-series');
  await page.getByRole('slider', { name: '展开级数项数', exact: true }).press('End'); assert.equal((await snap()).euler.terms, 48);
  await page.getByRole('button', { name: '欧拉故事：城市与关系', exact: true }).click();
  await page.getByRole('button', { name: '剥离地形', exact: true }).click();
  await page.waitForFunction(() => window.__mathverse.snapshot().euler.abstraction > .9, null, { timeout: 90000 }); await save('euler-bridges');
  await page.getByRole('button', { name: '欧拉故事：指数与旋转', exact: true }).click(); await page.waitForTimeout(700); await save('euler-rotation'); checks.eulerThreeStories = true;
  await close(); await page.waitForFunction(() => window.__mathverse.snapshot().speed === 0, null, { timeout: 45000 }); assert.equal((await snap()).paused, true); checks.restorePreviousPause = true;
  await aim(.84, .1); await save('right-windows'); await aim(-.24, .69); await save('crown-window'); await aim(Math.PI, .03); await save('back'); await aim(-.5, .15);
  await page.getByRole('button', { name: '观看一次折叠', exact: true }).click();
  await page.waitForFunction(() => { const angle = window.__spaceWorldStudy.snapshot().fold.angle; return angle > .24 && angle < .5; }, null, { timeout: 120000 });
  const middle = await study(); await save('fold-middle');
  assert.ok(middle.poses.find(n => n.id === 'complex-rotation').rotation[1] !== 0); checks.windowFollowsFourthAxis = true;
  await page.getByRole('button', { name: '定格结构', exact: true }).click();
  await page.waitForFunction(() => window.__mathverse.snapshot().yawVelocity === 0 && window.__mathverse.snapshot().pitchVelocity === 0);
  await page.waitForTimeout(500); const frozen = await study(), image = await page.screenshot({ clip: { x: 440, y: 100, width: 1050, height: 560 } });
  await page.waitForTimeout(900); const held = await study(), laterImage = await page.screenshot({ clip: { x: 440, y: 100, width: 1050, height: 560 } });
  assert.equal(held.fold.clock, frozen.fold.clock); assert.deepEqual(held.poses, frozen.poses); assert.ok(image.equals(laterImage), 'Camera and frozen worlds should produce stable scene pixels'); checks.freezeStablePixels = true;
  await fs.writeFile(output + '/frozen-region.png', image);
  const blur = await page.evaluate(() => { window.dispatchEvent(new Event('blur')); return window.__spaceWorldStudy.snapshot(); }); await page.waitForTimeout(500); assert.equal((await study()).fold.clock, blur.fold.clock);
  await page.evaluate(() => window.dispatchEvent(new Event('focus'))); checks.blurSuspends = true;
  await page.getByRole('button', { name: '继续结构', exact: true }).click();
  await page.waitForFunction(() => window.__spaceWorldStudy.snapshot().fold.phase === 'stable', null, { timeout: 120000 }); await save('fold-complete');
  await context.close(); await video.saveAs(output + '/worlds-demo.webm');
  assert.deepEqual(errors, []);
  await fs.writeFile(output + '/verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), checks, beginning, middle, frozen, errors }, null, 2)); console.log(JSON.stringify({ checks, errors }, null, 2));
} catch (e) { if (!page.isClosed()) { await save('failure'); console.log(JSON.stringify({ errors, snapshot: await snap().catch(() => null), study: await study().catch(() => null) })); } throw e; }
finally { await browser.close(); }
