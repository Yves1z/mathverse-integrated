import { mathverseBrowserOptions } from '../../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { PerspectiveCamera, Vector3 } from 'three';
import { cavityPoint } from '../../../src/mathverse/experiments/fusion/cavityModel.ts';
import { tracePoint } from '../../../src/mathverse/shared/math/eulerTraceModel.ts';
import { figureMarkerSource } from '../../../src/mathverse/shared/math/cellFigureModel.ts';
const output = `${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/fusion/thought-cavity`; await fs.mkdir(output + '/raw-video', { recursive: true });
const browser = await chromium.launch({ ...mathverseBrowserOptions(), headless: true }), context = await browser.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: output + '/raw-video', size: { width: 1600, height: 900 } } });
const page = await context.newPage(), video = page.video(), errors = [], checks = {};
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const snap = () => page.evaluate(() => window.__mathverse.snapshot()), field = () => page.evaluate(() => window.__orderedSpace.snapshot());
const button = name => page.getByRole('button', { name, exact: true }), save = name => page.screenshot({ path: output + '/' + name + '.png' });
const still = () => page.waitForFunction(() => { const s = window.__mathverse.snapshot(); return s.speed === 0 && s.yawVelocity === 0 && s.pitchVelocity === 0; });
const aim = async (yaw, pitch) => { for (let i = 0; i < 14; i++) { const s = await snap(), dx = Math.max(-480, Math.min(480, (yaw - s.targetYaw) * 1600 / Math.PI)), dy = Math.max(-270, Math.min(270, (pitch - s.targetPitch) * 1600 / Math.PI)); if (Math.abs(dx) < 1 && Math.abs(dy) < 1) break; await page.mouse.move(800, 450); await page.mouse.down(); await page.mouse.move(800 + dx, 450 - dy, { steps: 16 }); await page.mouse.up(); } await page.mouse.move(0, 0); await still(); };
const close = async () => { await page.keyboard.press('Escape'); await page.waitForFunction(() => window.__mathverse.snapshot().reading.phase === 'closed'); await still(); };
const catalog = async () => { await button('数学索引').click(); await button('打开莱昂哈德·欧拉').click(); await page.waitForFunction(() => window.__mathverse.snapshot().reading.phase === 'reading'); };
const paperClick = async () => {
  const s = await snap(), f = await field(), camera = new PerspectiveCamera(55, 1600 / 900, .05, 620); camera.position.fromArray(s.position); camera.quaternion.fromArray(s.quaternion); camera.updateMatrixWorld();
  for (const pageIndex of [0, 1, 2]) for (const u of [0, -.4, .4, -.2, .2]) for (const v of [0, -.4, .4, -.2, .2]) {
    const p = new Vector3(...cavityPoint(0, [...tracePoint(pageIndex, u, v), -1], f.rhythm.angle)).project(camera); if (Math.abs(p.x) > .9 || Math.abs(p.y) > .8) continue;
    const pixel = [(p.x + 1) * 800, (1 - p.y) * 450]; await page.mouse.move(...pixel); await page.waitForTimeout(90);
    if ((await snap()).reading.hoveredId === 'leonhard-euler') { await page.mouse.click(...pixel); await page.waitForFunction(() => window.__mathverse.snapshot().reading.phase === 'reading'); return pixel; }
  }
  throw Error('An actual visible paper surface must open Euler');
};
try {
  await page.goto(`${INTEGRATION_BASE_URL}/thought-cavity/worlds/`, { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__orderedSpace?.snapshot().field?.sourceRibs === 7);
  await save('first-view'); const initial = await field(), firstMotion = await snap(); assert.equal(initial.field.modules, 1); assert.equal(initial.field.movingBeams, 65); assert.equal(initial.field.staticBeams, 521); assert.ok(initial.field.minimumClearance > 3.2);
  assert.equal(initial.mounts.volumeFigures, 2); assert.equal(initial.mounts.humanTraces, 1);
  // Let the original continuous journey and 20-second initial hold reveal the cavity through real parallax.
  await page.waitForFunction(() => window.__orderedSpace.snapshot().rhythm.phase === 'anticipation', null, { timeout: 90000 }); await save('anticipation');
  assert.ok((await snap()).z < firstMotion.z - 4); checks.continuousDiscovery = true;
  await page.waitForFunction(() => window.__orderedSpace.snapshot().rhythm.angle > 1.1, null, { timeout: 90000 }); await save('unfolding');
  const middle = await field(); assert.equal(middle.rhythm.movingUnits, 1); assert.equal(middle.humanTrace.angle, middle.rhythm.angle);
  assert.notDeepEqual(middle.field.attachments, initial.field.attachments);
  for (const attachment of middle.field.attachments) assert.deepEqual(attachment.a, middle.field.sections[0].points[attachment.vertex]);
  await button('暂停旅程').click(); await button('定格空间').click(); await still(); const frozen = await field(), pixels = await page.screenshot({ clip: { x: 200, y: 100, width: 1100, height: 620 } }); await page.waitForTimeout(500);
  assert.equal((await field()).rhythm.clock, frozen.rhythm.clock); assert.ok(pixels.equals(await page.screenshot({ clip: { x: 200, y: 100, width: 1100, height: 620 } }))); checks.freezePixels = true;
  await button('让空间继续流动').click(); await button('继续旅程').click();
  await page.waitForFunction(() => window.__orderedSpace.snapshot().rhythm.phase === 'stable', null, { timeout: 90000 });
  await button('暂停旅程').click(); await button('定格空间').click(); await still(); await save('outer-first-view'); const after = await field();
  assert.equal(after.rhythm.angle, Math.PI); assert.ok(after.field.minimumClearance > 3.2); checks.actualRadiusRatio = after.volumes.find(v => v.id === 'unit-circle').localBounds / initial.volumes.find(v => v.id === 'unit-circle').localBounds; assert.ok(Math.abs(checks.actualRadiusRatio - 2.9 / .9) < 1e-5);
  await aim(-.80, .08); await save('outer'); checks.paperClick = await paperClick();
  await page.waitForFunction(() => Math.abs(window.__mathverse.snapshot().speed - .021) < 1e-6); const reading = await snap(); assert.ok(Math.abs(reading.observation.area - .801) < 1e-6); await page.waitForTimeout(400); assert.ok((await snap()).z < reading.z);
  for (const [chapter, name] of ['无穷与圆', '城市与关系', '指数与旋转'].entries()) { await button('欧拉故事：' + name).click(); await page.waitForTimeout(250); assert.equal((await snap()).euler.chapter, chapter); await save('story-' + chapter); }
  await page.getByLabel('欧拉故事中的旋转角度', { exact: true }).fill('180'); await page.waitForFunction(() => { const a = window.__mathverse.snapshot().worlds['unit-circle'].angle; return Math.abs(Math.sin(a)) < 1e-5 && Math.cos(a) < -.999999; }, null, { timeout: 20000 });
  await button('继续阅读：欧拉恒等式').click(); await button('继续阅读：单位圆').click(); await page.waitForFunction(() => window.__mathverse.snapshot().reading.selectedId === 'unit-circle'); assert.ok(Math.abs((await snap()).reading.angle - Math.PI) < 1e-6); await close();
  const warm = await field(); for (let i = 0; i < 6; i++) { await catalog(); await button('欧拉故事：' + ['无穷与圆', '城市与关系', '指数与旋转'][i % 3]).click(); await close(); }
  const repeated = await field(); assert.equal(repeated.geometries, warm.geometries); assert.equal(repeated.textures, warm.textures); checks.resourcesStable = [warm.geometries, warm.textures]; checks.readingAndSharedAngle = true;
  // Physical occlusion must block an actual circle point behind the nearer upright.
  const s = await snap(), f = await field(), camera = new PerspectiveCamera(55, 1600 / 900, .05, 620); camera.position.fromArray(s.position); camera.quaternion.fromArray(s.quaternion); camera.updateMatrixWorld(); let blocked = false;
  const previousBlocked = s.picking.blocked;
  for (let i = 0; i < 72; i++) { const p = new Vector3(...cavityPoint(0, [...figureMarkerSource('unit-circle', i * Math.PI / 36), -1], f.rhythm.angle)).project(camera); if (Math.abs(p.x) > .9 || Math.abs(p.y) > .8) continue; await page.mouse.move((p.x + 1) * 800, (1 - p.y) * 450); await page.waitForTimeout(50); if ((await snap()).picking.blocked > previousBlocked) { blocked = true; break; } }
  checks.physicalOcclusionObserved = blocked;
  await page.mouse.move(0, 0); await save('outer');
  for (const [name, yaw, pitch] of [['front', 0, .06], ['up', -.35, .70], ['back', Math.PI, .04]]) { await aim(yaw, pitch); await save(name); } checks.multipleViews = true;
  for (const [width, height] of [[1280, 720], [1920, 1080]]) { await page.setViewportSize({ width, height }); await catalog(); const rect = await page.getByTestId('reading-window').boundingBox(); assert.ok(Math.abs(rect.width * rect.height / (width * height) - .801) < .001); await save('reading-' + width); await close(); } checks.desktopReading = true;
  await page.goto(`${INTEGRATION_BASE_URL}/thought-cavity/`); await button('推门进入').click(); await page.waitForFunction(() => window.__mathverse.snapshot().phase === 'exploring'); checks.archEntrance = true;
  await page.goto(`${INTEGRATION_BASE_URL}/space-fusion/euler/worlds/`); await page.waitForFunction(() => window.__orderedSpace?.snapshot().field?.modules === 4); assert.equal((await field()).volumes.length, 4); checks.previousSamplePreserved = true;
  const reduced = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 720 } }), p = await reduced.newPage(); await p.goto(`${INTEGRATION_BASE_URL}/thought-cavity/worlds/`); await p.waitForFunction(() => window.__orderedSpace?.snapshot().field?.sourceRibs === 7); assert.equal((await p.evaluate(() => window.__mathverse.snapshot())).paused, true);
  for (const angle of [Math.PI, 0, Math.PI, 0]) { await p.getByRole('button', { name: '切换一个单元', exact: true }).click(); await p.waitForFunction(a => window.__orderedSpace.snapshot().humanTrace.angle === a, angle); const f = await p.evaluate(() => window.__orderedSpace.snapshot()); assert.equal(f.rhythm.phase, 'stable'); assert.equal(f.rhythm.section, 0); assert.ok(f.field.minimumClearance > 3.2); } await reduced.close(); checks.reducedMotion = true; assert.deepEqual(errors, []);
  await fs.writeFile(output + '/browser-verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), checks, initial, after, errors }, null, 2)); console.log(JSON.stringify({ checks, errors }, null, 2)); await context.close(); await video.saveAs(output + '/thought-cavity-demo.webm');
} catch (e) { await save('failure'); console.log(JSON.stringify({ errors, motion: await snap().catch(() => null), field: await field().catch(() => null) })); throw e; } finally { await browser.close(); }
