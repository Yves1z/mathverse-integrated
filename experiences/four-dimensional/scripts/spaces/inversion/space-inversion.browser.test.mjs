import { mathverseBrowserOptions } from '../../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const output = `${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/inversion/space-inversion`; await fs.mkdir(output + '/raw-video', { recursive: true });
const errors = [], checks = {}, sizes = [];
const browser = await chromium.launch({ ...mathverseBrowserOptions(), headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: output + '/raw-video', size: { width: 1600, height: 900 } } });
let page = await context.newPage(); const video = page.video();
const register = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); }; register(page);
const snap = () => page.evaluate(() => window.__inversionStudy.snapshot());
const button = name => page.getByRole('button', { name, exact: true });
const save = name => page.screenshot({ path: output + '/' + name + '.png' });
const waitStill = () => page.waitForFunction(() => { const s = window.__inversionStudy.snapshot(); return s.motion.speed === 0 && s.motion.yawVelocity === 0 && s.motion.pitchVelocity === 0; });
const preset = async (name, angle) => { await button(name).click(); await page.waitForFunction(a => { const s = window.__inversionStudy.snapshot(); return s.model.angle === a && s.structure?.model.angle === a; }, angle); };
const aim = async (yaw, pitch = 0) => {
  const { width, height } = page.viewportSize();
  for (let i = 0; i < 8; i++) {
    const s = await snap(), dx = Math.max(-width * .3, Math.min(width * .3, (yaw - s.motion.targetYaw) * width / Math.PI)), dy = Math.max(-height * .3, Math.min(height * .3, (pitch - s.motion.targetPitch) * width / Math.PI));
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) break;
    await page.mouse.move(width / 2, height / 2); await page.mouse.down(); await page.mouse.move(width / 2 + dx, height / 2 - dy, { steps: 20 }); await page.mouse.up();
  }
  await page.mouse.move(0, 0); await page.waitForFunction(() => { const m = window.__inversionStudy.snapshot().motion; return m.yawVelocity === 0 && m.pitchVelocity === 0; });
};
try {
  const response = await page.goto(`${INTEGRATION_BASE_URL}/space-inversion/`, { waitUntil: 'networkidle' }); assert.equal(response.status(), 200);
  await page.waitForFunction(() => window.__inversionStudy?.snapshot().structure?.edges === 32);
  await button('定格结构').click(); await preset('初始', 0); await save('inside-initial');
  const start = await snap(); await page.waitForTimeout(600); assert.ok((await snap()).motion.z < start.motion.z); checks.continuousForwardMotion = true;
  await button('暂停前进').click(); await waitStill();
  await button('看全貌').click(); await page.waitForFunction(() => { const v = window.__inversionStudy.snapshot().view; return v.blend === 1 && v.fade === 0; }); await waitStill();
  const overview = [];
  for (const [name, angle, image] of [['初始', 0, 'overview-initial'], ['展开', Math.PI * .28, 'overview-middle'], ['外侧', Math.PI, 'overview-outside']]) {
    await preset(name, angle); const s = await snap(); assert.ok(s.projected.every(p => Math.abs(p[0]) < .97 && Math.abs(p[1]) < .97 && p[2] > -1 && p[2] < 1), 'Overview must frame every source vertex');
    overview.push({ angle, projected: s.projected }); await save(image);
  }
  checks.overviewFramesAllThreePoses = true;
  const resources = await snap();
  for (let i = 0; i < 20; i++) await preset(i % 2 ? '外侧' : '初始', i % 2 ? Math.PI : 0);
  const afterCycles = await snap(); assert.equal(resources.geometries, afterCycles.geometries); assert.equal(resources.textures, afterCycles.textures); checks.twentyPoseChangesResourcesStable = true;
  await preset('展开', Math.PI * .28); await button('回到空间').click(); await page.waitForFunction(() => { const v = window.__inversionStudy.snapshot().view; return v.blend === 0 && v.fade === 0; }); await waitStill(); await save('inside-middle');
  const modelAngle = (await snap()).model.angle; await aim(.58, .25); assert.equal((await snap()).model.angle, modelAngle); await save('inside-side');
  await aim(Math.PI, .06); await save('inside-back'); checks.dragOnlyTurnsHeadAndBackView = true;
  await button('看向前方').click(); await waitStill();
  const blur = await page.evaluate(() => { window.dispatchEvent(new Event('blur')); return window.__inversionStudy.snapshot(); }); await page.waitForTimeout(300);
  assert.equal((await snap()).model.clock, blur.model.clock); await page.evaluate(() => window.dispatchEvent(new Event('focus'))); checks.blurSuspendsClock = true;
  await preset('初始', 0); await button('看全貌').click(); await page.waitForFunction(() => { const v = window.__inversionStudy.snapshot().view; return v.blend === 1 && v.fade === 0; }); await waitStill();
  await button('继续前进').click(); await button('观看完整翻转').click();
  await page.waitForFunction(() => window.__inversionStudy.snapshot().model.progress > .26, null, { timeout: 90000 }); await save('unfolding-quarter');
  await page.waitForFunction(() => window.__inversionStudy.snapshot().model.progress > .5, null, { timeout: 90000 });
  await button('定格结构').click(); const middle = await snap(); await save('unfolding-middle');
  const mid0 = await snap(); await page.waitForTimeout(500); const mid1 = await snap(); assert.equal(mid0.model.angle, mid1.model.angle); assert.ok(mid1.motion.z < mid0.motion.z); checks.structureFreezeKeepsCameraMoving = true;
  await button('暂停前进').click(); await waitStill(); await page.waitForTimeout(350);
  const frozen = await snap(), region = { x: 440, y: 110, width: 1060, height: 560 }, pixels = await page.screenshot({ clip: region });
  await page.waitForTimeout(600); assert.ok(pixels.equals(await page.screenshot({ clip: region }))); assert.equal((await snap()).model.clock, frozen.model.clock); checks.freezeStablePixels = true;
  await button('继续前进').click(); await button('继续结构').click();
  await page.waitForFunction(() => { const s = window.__inversionStudy.snapshot(); return s.model.phase === 'stable' && s.model.angle === Math.PI; }, null, { timeout: 90000 }); await save('unfolding-complete');
  const complete = await snap(); assert.deepEqual(complete.structure.trackedIds, start.structure.trackedIds); assert.equal(complete.structure.markedVertex, start.structure.markedVertex);
  assert.equal(complete.structure.particles, 0); assert.equal(complete.structure.bloom, false); checks.fullConnectedInversion = true;
  await button('定格结构').click(); await button('暂停前进').click(); await waitStill();
  for (const [width, height] of [[1280, 720], [1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    const bounds = await page.locator('button,a').evaluateAll(items => items.map(e => e.getBoundingClientRect().toJSON()));
    assert.ok(bounds.every(b => b.x >= 0 && b.right <= width && b.y >= 0 && b.bottom <= height));
    sizes.push({ width, height }); await save('desktop-' + width);
  }
  await context.close(); await video.saveAs(output + '/inversion-demo.webm');
  const reduced = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' }); page = await reduced.newPage(); register(page);
  await page.goto(`${INTEGRATION_BASE_URL}/space-inversion/`, { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__inversionStudy?.snapshot().structure);
  const r0 = await snap(); assert.ok(r0.motion.paused && r0.motion.spaceFrozen); await page.waitForTimeout(350); assert.equal((await snap()).model.clock, r0.model.clock);
  await preset('外侧', Math.PI); await button('看全貌').click(); await page.waitForFunction(() => window.__inversionStudy.snapshot().view.blend === 1); await button('切换内外').click(); assert.equal((await snap()).model.angle, 0); checks.reducedMotionExplicitChangesOnly = true;
  await save('reduced-motion');
  await page.goto(`${INTEGRATION_BASE_URL}/space-a/worlds/`, { waitUntil: 'networkidle' }); await page.getByRole('button', { name: '数学索引', exact: true }).waitFor();
  await page.goto(`${INTEGRATION_BASE_URL}/`, { waitUntil: 'networkidle' }); await page.getByRole('button', { name: '推门进入', exact: true }).waitFor(); checks.previousRoutesPreserved = true;
  await reduced.close(); assert.deepEqual(errors, []);
  const report = { checkedAt: new Date().toISOString(), browser: browser.version(), checks, sizes, start, middle, complete, overview,
    resources: { start: [resources.geometries, resources.textures], afterTwentyChanges: [afterCycles.geometries, afterCycles.textures] }, errors,
    scope: 'Actual UI interactions and recorded WebGL rendering. Software/headless browser timings do not establish target-hardware frame rate or long-duration resource behavior.' };
  await fs.writeFile(output + '/browser-verification.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify({ checks, resources: report.resources, errors }, null, 2));
} catch (e) { if (!page.isClosed()) { await save('failure'); console.log(JSON.stringify({ errors, snapshot: await snap().catch(() => null) })); } throw e; }
finally { await browser.close(); }
