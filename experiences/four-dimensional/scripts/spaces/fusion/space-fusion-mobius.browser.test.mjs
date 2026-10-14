import { mathverseBrowserOptions } from '../../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { PerspectiveCamera, Vector3 } from 'three';
import { fusionPoint } from '../../../src/mathverse/experiments/fusion/fusionModel.ts';
import { mobiusPoint } from '../../../src/mathverse/shared/math/cellFigureModel.ts';
const output = `${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/fusion/space-fusion-mobius`;
await fs.mkdir(output + '/raw-video', { recursive: true });
const browser = await chromium.launch({ ...mathverseBrowserOptions(), headless: true }), context = await browser.newContext({ viewport: {width: 1600, height: 900}, recordVideo: {dir: output + '/raw-video', size: {width: 1600, height: 900}} });
const page = await context.newPage(), video = page.video(), errors = [], checks = {};
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const snap = () => page.evaluate(() => window.__mathverse.snapshot()), field = () => page.evaluate(() => window.__orderedSpace.snapshot());
const button = name => page.getByRole('button', {name, exact: true}), save = name => page.screenshot({path: output + '/' + name + '.png'});
const still = () => page.waitForFunction(() => { const s = window.__mathverse.snapshot(); return s.speed === 0 && s.yawVelocity === 0 && s.pitchVelocity === 0; });
const aim = async (yaw, pitch) => {
  for (let i = 0; i < 9; i++) {
    const s = await snap(), dx = Math.max(-480, Math.min(480, (yaw - s.targetYaw) * 1600 / Math.PI)), dy = Math.max(-270, Math.min(270, (pitch - s.targetPitch) * 1600 / Math.PI));
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) break;
    await page.mouse.move(800, 450); await page.mouse.down(); await page.mouse.move(800 + dx, 450 - dy, {steps: 18}); await page.mouse.up();
  }
  await page.mouse.move(0, 0); await still();
};
try {
  await page.goto(`${INTEGRATION_BASE_URL}/space-fusion/mobius/worlds/`, {waitUntil: 'networkidle'});
  await page.waitForFunction(() => window.__orderedSpace?.snapshot().volumes.length === 3);
  const travel = await snap(); await page.waitForTimeout(500); assert.ok((await snap()).z < travel.z);
  await button('暂停旅程').click(); await button('定格空间').click(); await still(); await aim(-.60, .08); await save('euler-inner');
  const initial = await field(); assert.equal(initial.field.inhabitedCells, 2); assert.equal(initial.field.modules, 3); assert.equal(initial.mounts.exteriorFrames, 0);
  await button('观看一次翻转').click(); await page.waitForFunction(() => window.__orderedSpace.snapshot().rhythm.angle > 1.2, null, {timeout: 90000}); await save('euler-unfolding');
  assert.deepEqual((await field()).field.sections.find(s => s.section === 1), initial.field.sections.find(s => s.section === 1));
  await page.waitForFunction(() => window.__orderedSpace.snapshot().rhythm.phase === 'stable', null, {timeout: 90000}); await page.waitForTimeout(250); await save('euler-outer'); await button('定格空间').click();
  await aim(.13, .36); await save('mobius-inner'); const before = await field(), eye = await snap();
  const camera = new PerspectiveCamera(55, 1600 / 900, .05, 620); camera.position.fromArray(eye.position); camera.quaternion.fromArray(eye.quaternion); camera.updateMatrixWorld();
  let click = null;
  for (let i = 0; i < 24; i++) {
    const p = new Vector3(...fusionPoint(1, [...mobiusPoint(i * Math.PI / 12, .07), -1], 0)).project(camera), pixel = [(p.x + 1) * 800, (1 - p.y) * 450];
    await page.mouse.move(...pixel); await page.waitForTimeout(150);
    if ((await snap()).reading.hoveredId === 'mobius-strip') { click = pixel; break; }
  }
  assert.ok(click, 'Actual Möbius surface must be pickable'); await page.mouse.click(...click);
  await page.waitForFunction(() => window.__mathverse.snapshot().reading.phase === 'reading');
  assert.equal((await snap()).reading.selectedId, 'mobius-strip'); await page.waitForFunction(() => Math.abs(window.__mathverse.snapshot().speed - .021) < 1e-6);
  const reading = await snap(); assert.ok(Math.abs(reading.observation.area - .801) < 1e-6); await page.waitForTimeout(400); assert.ok((await snap()).z < reading.z);
  await save('mobius-reading'); const slider = page.getByRole('slider'); await slider.focus(); await slider.press('ArrowRight'); await slider.press('ArrowRight'); await save('mobius-reading-angle');
  await page.keyboard.press('Escape'); await page.waitForFunction(() => window.__mathverse.snapshot().reading.phase === 'closed'); await still(); assert.equal((await snap()).paused, true);
  assert.equal((await snap()).yaw, eye.yaw); assert.equal((await snap()).pitch, eye.pitch); checks.realMobiusPickingReadingAndReturn = true;
  const resources = await field();
  const beforeFold = await field(), beforeEye = await snap(); await save('mobius-inner'); await button('观看一次翻转').click();
  await page.waitForFunction(() => window.__orderedSpace.snapshot().rhythm.angle > 1.1, null, {timeout: 90000}); await save('mobius-unfolding');
  const middle = await field(); assert.equal(middle.rhythm.section, 1); assert.equal(middle.rhythm.movingUnits, 1);
  for (const id of [-1, 0]) assert.deepEqual(middle.field.sections.find(s => s.section === id), beforeFold.field.sections.find(s => s.section === id));
  assert.notDeepEqual(middle.field.attachments.filter(b => b.unit === 1), beforeFold.field.attachments.filter(b => b.unit === 1));
  await button('定格空间').click(); await page.waitForTimeout(250); const frozen = await field(), pixels = await page.screenshot({clip: {x: 200, y: 100, width: 1100, height: 620}});
  await page.waitForTimeout(400); assert.equal((await field()).rhythm.clock, frozen.rhythm.clock); assert.ok(pixels.equals(await page.screenshot({clip: {x: 200, y: 100, width: 1100, height: 620}})));
  await button('让空间继续流动').click(); await page.waitForFunction(() => window.__orderedSpace.snapshot().rhythm.angle > 2.08, null, {timeout: 90000}); await save('mobius-slice');
  await page.waitForFunction(() => window.__orderedSpace.snapshot().rhythm.phase === 'stable', null, {timeout: 90000}); await page.waitForTimeout(250); await save('mobius-outer');
  const complete = await field(), afterEye = await snap(); assert.equal(complete.rhythm.angle, Math.PI); assert.equal(afterEye.z, beforeEye.z); assert.equal(afterEye.yaw, beforeEye.yaw); assert.equal(afterEye.pitch, beforeEye.pitch);
  const a = beforeFold.volumes.find(v => v.id === 'mobius-strip'), b = complete.volumes.find(v => v.id === 'mobius-strip'); assert.ok(b.singleBoundary); assert.ok(Math.abs(b.localBounds / a.localBounds - 2.9 / .9) < 1e-4);
  assert.equal(resources.geometries, complete.geometries); assert.equal(resources.textures, complete.textures);
  checks.twoActualFolds = [0, 1]; checks.fixedEyeMobiusRadiusRatio = b.localBounds / a.localBounds; checks.quietReferenceAndFollowingConnections = true; checks.freezePixels = true; checks.resourcesStable = [complete.geometries, complete.textures];
  await button('定格空间').click(); await aim(-.60, .08); await save('two-worlds-euler-view'); await aim(.13, .36); await save('two-worlds-mobius-view');
  await page.goto(`${INTEGRATION_BASE_URL}/space-fusion/mobius/`, {waitUntil: 'networkidle'}); await button('推门进入').click(); await page.waitForFunction(() => window.__mathverse.snapshot().phase === 'exploring'); checks.archEntrance = true;
  await page.goto(`${INTEGRATION_BASE_URL}/space-fusion/worlds/`, {waitUntil: 'networkidle'}); await page.waitForFunction(() => window.__orderedSpace?.snapshot().volumes.length === 2); checks.firstFusionPreserved = true;
  const reduced = await browser.newContext({reducedMotion: 'reduce', viewport: {width: 1280, height: 720}}), reducedPage = await reduced.newPage();
  await reducedPage.goto(`${INTEGRATION_BASE_URL}/space-fusion/mobius/worlds/`); await reducedPage.waitForFunction(() => window.__orderedSpace?.snapshot().volumes.length === 3);
  assert.equal((await reducedPage.evaluate(() => window.__mathverse.snapshot())).paused, true);
  for (const section of [0, 1, 0, 1]) { await reducedPage.getByRole('button', {name: '切换一个单元', exact: true}).click(); const s = await reducedPage.evaluate(() => window.__orderedSpace.snapshot()); assert.equal(s.rhythm.section, section); assert.equal(s.rhythm.phase, 'stable'); }
  await reduced.close(); checks.reducedMotionSequence = true; assert.deepEqual(errors, []);
  await fs.writeFile(output + '/browser-verification.json', JSON.stringify({checkedAt: new Date().toISOString(), checks, initial, beforeFold, middle, complete, errors}, null, 2)); console.log(JSON.stringify({checks, errors}, null, 2));
  await context.close(); await video.saveAs(output + '/two-worlds-demo.webm');
} catch (e) { await save('failure'); console.log(JSON.stringify({errors, motion: await snap().catch(() => null), field: await field().catch(() => null)})); throw e; }
finally { await browser.close(); }
