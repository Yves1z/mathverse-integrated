import { mathverseBrowserOptions } from '../../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { PerspectiveCamera, Vector3 } from 'three';
import { fusionPoint } from '../../../src/mathverse/experiments/fusion/fusionModel.ts';
const output = `${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/fusion/space-fusion`, previewOnly = process.env.FUSION_PREVIEW === '1';
await fs.mkdir(output + '/raw-video', { recursive: true });
const browser = await chromium.launch({ ...mathverseBrowserOptions(), headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: output + '/raw-video', size: { width: 1600, height: 900 } } });
const page = await context.newPage(), video = page.video(), errors = [], checks = {};
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const snap = () => page.evaluate(() => window.__mathverse.snapshot()), field = () => page.evaluate(() => window.__orderedSpace.snapshot());
const button = name => page.getByRole('button', { name, exact: true }), save = name => page.screenshot({ path: output + '/' + name + '.png' });
const still = () => page.waitForFunction(() => { const s = window.__mathverse.snapshot(); return s.speed === 0 && s.yawVelocity === 0 && s.pitchVelocity === 0; });
const aim = async (yaw, pitch = 0) => {
  const { width, height } = page.viewportSize();
  for (let i = 0; i < 9; i++) {
    const s = await snap(), dx = Math.max(-width * .3, Math.min(width * .3, (yaw - s.targetYaw) * width / Math.PI)), dy = Math.max(-height * .3, Math.min(height * .3, (pitch - s.targetPitch) * width / Math.PI));
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) break;
    await page.mouse.move(width / 2, height / 2); await page.mouse.down(); await page.mouse.move(width / 2 + dx, height / 2 - dy, { steps: 18 }); await page.mouse.up();
  }
  await page.mouse.move(0, 0); await page.waitForFunction(() => { const s = window.__mathverse.snapshot(); return s.yawVelocity === 0 && s.pitchVelocity === 0; });
};
const close = async () => { await page.keyboard.press('Escape'); await page.waitForFunction(() => window.__mathverse.snapshot().reading.phase === 'closed'); };
const read = async title => { await button('数学索引').click(); await button('打开' + title).click(); await page.waitForFunction(() => window.__mathverse.snapshot().reading.phase === 'reading'); };
try {
  await page.goto(`${INTEGRATION_BASE_URL}/space-fusion/worlds/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__orderedSpace?.snapshot().readyWorlds === 6);
  await save('overview'); const travel = await snap(); await page.waitForTimeout(600); assert.ok((await snap()).z < travel.z); checks.continuousTravel = true;
  await button('暂停旅程').click(); await button('定格空间').click(); await still(); await aim(-.60, .08); await save('inner');
  const initial = await field(); assert.equal(initial.field.modules, 3); assert.equal(initial.field.bones, 184); assert.equal(initial.mounts.exteriorFrames, 0);
  await aim(Math.PI * .68, -.08); await save('behind'); await aim(.13, .36); await save('upper'); await aim(-.60, .08);
  if (previewOnly) { console.log(JSON.stringify({ errors, modules: initial.field.modules, bones: initial.field.bones }, null, 2)); }
  else {
    const eye = await snap(), view = new PerspectiveCamera(55, 1600 / 900, .05, 620); view.position.fromArray(eye.position); view.quaternion.fromArray(eye.quaternion); view.updateMatrixWorld();
    let clickPoint = null;
    for (const t of [1.5, 1, 0, .5, 1.25, .25, .75, 1.75].map(t => t * Math.PI)) {
      const p = new Vector3(...fusionPoint(0, [.7 * Math.cos(t), .7 * Math.sin(t), 0, -1], 0)).project(view), pixel = [(p.x + 1) * 800, (1 - p.y) * 450];
      await page.mouse.move(...pixel); await page.waitForTimeout(150);
      if ((await snap()).reading.hoveredId === 'unit-circle') { clickPoint = pixel; break; }
    }
    assert.ok(clickPoint, 'Circle must be pickable through its actual visible geometry');
    await page.mouse.click(...clickPoint); await page.waitForFunction(() => window.__mathverse.snapshot().reading.phase === 'reading');
    assert.equal((await snap()).reading.selectedId, 'unit-circle'); await page.waitForFunction(() => Math.abs(window.__mathverse.snapshot().speed - .021) < 1e-6);
    const r0 = await snap(); assert.ok(Math.abs(r0.observation.area - .801) < 1e-6); await page.waitForTimeout(500); assert.ok((await snap()).z < r0.z); await save('reading'); await close(); await still();
    assert.equal((await snap()).paused, true); checks.realFigurePickingAndReading = true;
    const resourceStart = await field();
    for (const title of ['单位圆', '复数的旋转', '莱昂哈德·欧拉', '高斯积分', '莫比乌斯带', '欧拉恒等式']) { await read(title); await close(); }
    const resourceEnd = await field(); assert.equal(resourceStart.geometries, resourceEnd.geometries); assert.equal(resourceStart.textures, resourceEnd.textures);
    checks.readingResourcesStable = [resourceEnd.geometries, resourceEnd.textures];
    await still(); await aim(-.60, .08); await save('inner'); const before = await field(), beforeEye = await snap();
    await button('观看一次翻转').click(); await page.waitForFunction(() => window.__orderedSpace.snapshot().rhythm.angle > .85, null, { timeout: 90000 }); await save('unfolding');
    const middle = await field(); assert.equal(middle.rhythm.movingUnits, 1);
    for (const id of [-1, 1]) assert.deepEqual(middle.field.sections.find(s => s.section === id), before.field.sections.find(s => s.section === id));
    assert.notDeepEqual(middle.field.attachments.filter(a => a.unit === 0), before.field.attachments.filter(a => a.unit === 0)); checks.quietReferencesAndFollowingConnections = true;
    await button('定格空间').click(); await page.waitForTimeout(300); const frozen = await field(), pixels = await page.screenshot({ clip: { x: 200, y: 100, width: 1100, height: 620 } });
    await page.waitForTimeout(500); assert.equal((await field()).rhythm.clock, frozen.rhythm.clock); assert.ok(pixels.equals(await page.screenshot({ clip: { x: 200, y: 100, width: 1100, height: 620 } }))); checks.freezeStablePixels = true;
    await button('让空间继续流动').click(); await page.waitForFunction(() => window.__orderedSpace.snapshot().rhythm.angle > 2.08, null, { timeout: 90000 }); await save('slice');
    await page.waitForFunction(() => window.__orderedSpace.snapshot().rhythm.phase === 'stable', null, { timeout: 90000 }); await save('outer');
    const complete = await field(), afterEye = await snap(); assert.equal(complete.rhythm.angle, Math.PI); assert.equal(afterEye.z, beforeEye.z); assert.equal(afterEye.yaw, beforeEye.yaw); assert.equal(afterEye.pitch, beforeEye.pitch);
    const beforeVolume = before.volumes[0], afterVolume = complete.volumes[0]; assert.ok(Math.abs(afterVolume.localBounds / beforeVolume.localBounds - 2.9 / .9) < 1e-4);
    const a = before.poses.find(n => n.id === 'unit-circle').bounds, b = complete.poses.find(n => n.id === 'unit-circle').bounds;
    assert.ok(b.width / a.width > 2.5 && b.height / a.height > 2.5); checks.fixedEyeEnlargement = { projectedRadius: afterVolume.localBounds / beforeVolume.localBounds, width: b.width / a.width, height: b.height / a.height };
    await button('定格空间').click();
    await aim(Math.PI * .68, -.08); await save('behind-settled'); await aim(.13, .36); await save('upper-settled'); await aim(-.60, .08);
    for (const [width, height] of [[1280, 720], [1920, 1080]]) {
      await page.setViewportSize({ width, height }); await read('单位圆'); const rect = await page.getByTestId('reading-window').boundingBox();
      assert.ok(Math.abs(rect.width * rect.height / (width * height) - .801) < .001); await save('desktop-' + width); await close();
    }
    checks.desktopReading = true;
    await page.goto(`${INTEGRATION_BASE_URL}/space-fusion/`, { waitUntil: 'networkidle' }); await button('推门进入').click(); await page.waitForFunction(() => window.__mathverse.snapshot().phase === 'exploring'); await save('entry'); checks.archEntrance = true;
    await page.goto(`${INTEGRATION_BASE_URL}/space-inversion/worlds/`, { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__orderedSpace?.snapshot().field?.modules === 6); checks.previousSpacePreserved = true;
    assert.deepEqual(errors, []);
    await fs.writeFile(output + '/browser-verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), browser: browser.version(), checks, before, middle, complete, errors,
      scope: 'Actual 44-second fold, fixed eye, geometry picking, reading, head turn, entrance and resource checks. Three fixed cells; long-run populated-world streaming and hardware GPU acceptance are later work.' }, null, 2));
    console.log(JSON.stringify({ checks, errors }, null, 2));
  }
  await context.close(); await video.saveAs(output + (previewOnly ? '/composition-preview.webm' : '/space-fusion-demo.webm'));
} catch (e) { if (!page.isClosed()) { await save('failure'); console.log(JSON.stringify({ errors, motion: await snap().catch(() => null), field: await field().catch(() => null) })); } throw e; }
finally { await browser.close(); }
