import { mathverseBrowserOptions } from '../../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { PerspectiveCamera, Vector3 } from 'three';
import { threeWorldPoint } from '../../../src/mathverse/experiments/fusion/fusionModel.ts';
import { tracePoint } from '../../../src/mathverse/shared/math/eulerTraceModel.ts';
const output = `${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/fusion/space-fusion-euler`; await fs.mkdir(output + '/raw-video', { recursive: true });
const browser = await chromium.launch({ ...mathverseBrowserOptions(), headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: output + '/raw-video', size: { width: 1600, height: 900 } } });
const page = await context.newPage(), video = page.video(), errors = [], checks = {};
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const snap = () => page.evaluate(() => window.__mathverse.snapshot()), field = () => page.evaluate(() => window.__orderedSpace.snapshot());
const button = name => page.getByRole('button', { name, exact: true }), save = name => page.screenshot({ path: output + '/' + name + '.png' });
const still = () => page.waitForFunction(() => { const s = window.__mathverse.snapshot(); return s.speed === 0 && s.yawVelocity === 0 && s.pitchVelocity === 0; });
const close = async () => { await page.keyboard.press('Escape'); await page.waitForFunction(() => window.__mathverse.snapshot().reading.phase === 'closed'); await still(); };
const aim = async (yaw, pitch) => { for (let i = 0; i < 9; i++) { const s = await snap(), dx = Math.max(-480, Math.min(480, (yaw - s.targetYaw) * 1600 / Math.PI)), dy = Math.max(-270, Math.min(270, (pitch - s.targetPitch) * 1600 / Math.PI)); if (Math.abs(dx) < 1 && Math.abs(dy) < 1) break; await page.mouse.move(800, 450); await page.mouse.down(); await page.mouse.move(800 + dx, 450 - dy, { steps: 18 }); await page.mouse.up(); } await page.mouse.move(0, 0); await still(); };
const catalog = async title => { await button('数学索引').click(); await button('打开' + title).click(); await page.waitForFunction(() => window.__mathverse.snapshot().reading.phase === 'reading'); };
const pickPaper = async () => {
  const eye = await snap(), s = await field(), camera = new PerspectiveCamera(55, 1600 / 900, .05, 620);
  camera.position.fromArray(eye.position); camera.quaternion.fromArray(eye.quaternion); camera.updateMatrixWorld();
  for (const pageIndex of [0, 1, 2]) for (const u of [0, -.3, .3]) for (const v of [0, -.3, .3]) {
    const p = new Vector3(...threeWorldPoint(0, [...tracePoint(pageIndex, u, v), -1], s.humanTrace.angle)).project(camera);
    if (Math.abs(p.x) > .9 || Math.abs(p.y) > .8) continue;
    const pixel = [(p.x + 1) * 800, (1 - p.y) * 450]; await page.mouse.move(...pixel); await page.waitForTimeout(120);
    if ((await snap()).reading.hoveredId === 'leonhard-euler') { await page.mouse.click(...pixel); await page.waitForFunction(() => window.__mathverse.snapshot().reading.phase === 'reading'); return pixel; }
  }
  throw Error('Actual projected paper mesh must be pickable');
};
try {
  await page.goto(`${INTEGRATION_BASE_URL}/space-fusion/euler/worlds/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__orderedSpace?.snapshot().humanTrace?.pages === 3);
  const moving = await snap(); await page.waitForTimeout(400); assert.ok((await snap()).z < moving.z);
  await button('暂停旅程').click(); await button('定格空间').click(); await still(); await aim(-.60, .08); await save('euler-inner');
  const initial = await field(); assert.equal(initial.field.modules, 4); assert.equal(initial.field.inhabitedCells, 3); assert.equal(initial.mounts.exteriorFrames, 0); assert.equal(initial.mounts.sections['leonhard-euler'], 0);
  const eye = await snap(); checks.innerPaperClick = await pickPaper();
  assert.equal((await snap()).reading.selectedId, 'leonhard-euler'); await page.waitForFunction(() => Math.abs(window.__mathverse.snapshot().speed - .021) < 1e-6);
  const read = await snap(); assert.ok(Math.abs(read.observation.area - .801) < 1e-6); await page.waitForTimeout(400); assert.ok((await snap()).z < read.z);
  for (const [chapter, name] of ['无穷与圆', '城市与关系', '指数与旋转'].entries()) {
    await button('欧拉故事：' + name).click(); assert.equal((await snap()).euler.chapter, chapter); await page.waitForTimeout(250); await save('story-' + chapter);
  }
  await page.getByLabel('欧拉故事中的旋转角度', { exact: true }).fill('180'); await page.waitForTimeout(180);
  await page.waitForFunction(() => Math.abs(window.__mathverse.snapshot().worlds['unit-circle'].angle - Math.PI) < 1e-5, null, { timeout: 20000 });
  await button('继续阅读：欧拉恒等式').click(); await page.waitForFunction(() => window.__mathverse.snapshot().reading.selectedId === 'euler-identity');
  await button('继续阅读：单位圆').click(); await page.waitForFunction(() => window.__mathverse.snapshot().reading.selectedId === 'unit-circle');
  assert.ok(Math.abs((await snap()).reading.angle - Math.PI) < 1e-6); await close();
  assert.equal((await snap()).paused, true); assert.equal((await snap()).yaw, eye.yaw); assert.equal((await snap()).pitch, eye.pitch);
  await catalog('莱昂哈德·欧拉'); assert.equal((await snap()).euler.chapter, 2); assert.equal(await button('欧拉故事：指数与旋转').getAttribute('aria-current'), 'step'); await close();
  checks.storyAndSharedAngle = true; checks.readingArea = read.observation.area;
  const warm = await field(); for (let i = 0; i < 6; i++) { await catalog('莱昂哈德·欧拉'); await button('欧拉故事：' + ['无穷与圆', '城市与关系', '指数与旋转'][i % 3]).click(); await close(); }
  const repeated = await field(); assert.equal(repeated.geometries, warm.geometries); assert.equal(repeated.textures, warm.textures); checks.resourcesStable = [warm.geometries, warm.textures];
  await save('euler-inner'); const before = await field(), beforeEye = await snap(); await button('观看一次翻转').click();
  await page.waitForFunction(() => window.__orderedSpace.snapshot().rhythm.angle > 1.1, null, { timeout: 90000 }); await save('euler-unfolding');
  const middle = await field(); assert.equal(middle.humanTrace.angle, middle.rhythm.angle); assert.equal(middle.rhythm.movingUnits, 1);
  for (const id of [-1, 1, 2]) assert.deepEqual(middle.field.sections.find(s => s.section === id), before.field.sections.find(s => s.section === id));
  assert.notDeepEqual(middle.field.attachments.filter(b => b.unit === 0), before.field.attachments.filter(b => b.unit === 0));
  await button('定格空间').click(); await page.waitForTimeout(250); const frozen = await field(), pixels = await page.screenshot({ clip: { x: 200, y: 100, width: 1100, height: 620 } }); await page.waitForTimeout(400);
  assert.equal((await field()).rhythm.clock, frozen.rhythm.clock); assert.ok(pixels.equals(await page.screenshot({ clip: { x: 200, y: 100, width: 1100, height: 620 } }))); checks.freezePixels = true;
  await button('让空间继续流动').click(); await page.waitForFunction(() => window.__orderedSpace.snapshot().rhythm.phase === 'stable', null, { timeout: 90000 });
  await button('定格空间').click(); await save('euler-outer'); const after = await field(), afterEye = await snap(); assert.equal(after.humanTrace.angle, Math.PI);
  assert.equal(afterEye.z, beforeEye.z); assert.equal(afterEye.yaw, beforeEye.yaw); assert.equal(afterEye.pitch, beforeEye.pitch);
  checks.actualPaperRadiusRatio = after.humanTrace.localRadius / before.humanTrace.localRadius; assert.ok(Math.abs(checks.actualPaperRadiusRatio - 2.9 / .9) < 1e-5);
  checks.outerPaperClick = await pickPaper(); await save('story-outer'); await close(); assert.equal((await field()).geometries, warm.geometries); assert.equal((await field()).textures, warm.textures);
  for (const [width, height] of [[1280, 720], [1920, 1080]]) { await page.setViewportSize({ width, height }); await catalog('莱昂哈德·欧拉'); const rect = await page.getByTestId('reading-window').boundingBox(); assert.ok(Math.abs(rect.width * rect.height / (width * height) - .801) < .001); await save('reading-' + width); await close(); } checks.desktopReading = true;
  await page.goto(`${INTEGRATION_BASE_URL}/space-fusion/euler/`); await button('推门进入').click(); await page.waitForFunction(() => window.__mathverse.snapshot().phase === 'exploring'); checks.archEntrance = true;
  await page.goto(`${INTEGRATION_BASE_URL}/space-fusion/gaussian/worlds/`); await page.waitForFunction(() => window.__orderedSpace?.snapshot().volumes.length === 4); assert.equal((await field()).humanTrace, undefined); checks.previousSamplePreserved = true;
  const reduced = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 720 } }), p = await reduced.newPage();
  await p.goto(`${INTEGRATION_BASE_URL}/space-fusion/euler/worlds/`); await p.waitForFunction(() => window.__orderedSpace?.snapshot().humanTrace);
  assert.equal((await p.evaluate(() => window.__mathverse.snapshot())).paused, true);
  for (const id of [0, 1, 2, 0, 1, 2]) { await p.getByRole('button', { name: '切换一个单元', exact: true }).click(); const s = await p.evaluate(() => window.__orderedSpace.snapshot()); assert.equal(s.rhythm.section, id); assert.equal(s.rhythm.phase, 'stable'); assert.equal(s.humanTrace.angle, s.volumes.find(v => v.id === 'unit-circle').angle); }
  await reduced.close(); checks.reducedMotionSequence = true; assert.deepEqual(errors, []);
  await fs.writeFile(output + '/browser-verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), checks, initial, after, errors }, null, 2)); console.log(JSON.stringify({ checks, errors }, null, 2)); await context.close(); await video.saveAs(output + '/euler-fusion-demo.webm');
} catch (e) { await save('failure'); console.log(JSON.stringify({ errors, motion: await snap().catch(() => null), field: await field().catch(() => null) })); throw e; } finally { await browser.close(); }
