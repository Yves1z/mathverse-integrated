import { mathverseBrowserOptions } from '../../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const output = process.env.SPACE_A_OUTPUT || `${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/layered/space-revision-a`;
await fs.mkdir(output, { recursive: true });
const errors = [], consoleErrors = [], browser = await chromium.launch({ ...mathverseBrowserOptions(), headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: process.env.SPACE_A_CAPTURE_ONLY ? undefined : { dir: output + '/recording', size: { width: 1600, height: 900 } } });
const page = await context.newPage(), video = page.video();
page.on('pageerror', e => errors.push(e.message));
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
const snap = () => page.evaluate(() => window.__spaceStudy.snapshot());
const aim = async (yaw, pitch = 0) => {
  for (let i = 0; i < 8; i++) {
    const { motion } = await snap();
    const dx = Math.max(-550, Math.min(550, (yaw - motion.targetYaw) * 1600 / Math.PI));
    const dy = Math.max(-330, Math.min(330, (pitch - motion.targetPitch) * 1600 / Math.PI));
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) break;
    await page.mouse.move(800, 450); await page.mouse.down();
    await page.mouse.move(800 + dx, 450 - dy, { steps: 20 }); await page.mouse.up();
  }
  await page.mouse.move(0, 0); await page.waitForTimeout(850);
};
try {
  const response = await page.goto(`${INTEGRATION_BASE_URL}/space-a/`, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => window.__spaceStudy?.snapshot().structure);
  await page.waitForTimeout(900);
  await page.screenshot({ path: output + '/first-view.png' });
  const travelStart = await snap(); await page.waitForTimeout(1200); const travelEnd = await snap();
  assert.ok(travelEnd.motion.z < travelStart.motion.z);
  assert.equal(travelEnd.fold.angle, 0);
  await page.getByRole('button', { name: '暂停前进', exact: true }).click();
  await page.waitForFunction(() => window.__spaceStudy.snapshot().motion.speed === 0);
  const pausedStart = await snap();
  await aim(0, 0); await page.screenshot({ path: output + '/front.png' });
  await aim(-.84, .13); await page.screenshot({ path: output + '/left.png' });
  await aim(.85, .12); await page.screenshot({ path: output + '/right.png' });
  await aim(-.25, .72); await page.screenshot({ path: output + '/up.png' });
  await aim(Math.PI, .04); await page.screenshot({ path: output + '/back.png' });
  await aim(-.35, .09);
  const initial = await snap();
  assert.ok(initial.structure.minimumClearance > 3.2);
  assert.equal(initial.structure.particles, 0); assert.equal(initial.structure.bloom, false);
  assert.ok(initial.motion.pitch <= Math.PI * 55 / 180);
  assert.equal(initial.motion.z, pausedStart.motion.z);
  const report = { travel: { start: travelStart.motion.z, end: travelEnd.motion.z }, initial, errors, consoleErrors, viewports: [] };
  if (!process.env.SPACE_A_CAPTURE_ONLY) {
    await page.screenshot({ path: output + '/before-fold.png' });
    await page.getByRole('button', { name: '观看一次折叠', exact: true }).click();
    await page.waitForFunction(() => window.__spaceStudy.snapshot().fold.phase === 'folding');
    const begun = await snap(); assert.equal(begun.fold.section, 0);
    await page.waitForFunction(() => { const angle = window.__spaceStudy.snapshot().fold.angle; return angle > .25 && angle < .5; }, null, { timeout: 90000 });
    await page.screenshot({ path: output + '/fold-middle.png' });
    const middle = await snap(); assert.ok(middle.fold.angle > .1 && middle.fold.angle < .52);
    await page.getByRole('button', { name: '定格结构', exact: true }).click();
    await page.waitForFunction(() => { const motion = window.__spaceStudy.snapshot().motion; return motion.yawVelocity === 0 && motion.pitchVelocity === 0; });
    await page.waitForTimeout(500);
    // Compare the scene itself, excluding the HUD progress bar's final CSS transition.
    const frozenRegion = { x: 420, y: 120, width: 1000, height: 520 };
    const frozenPixels = await page.screenshot({ clip: frozenRegion });
    await page.screenshot({ path: output + '/frozen-view.png' });
    const frozen = await snap(); await page.waitForTimeout(1100); const frozenLater = await snap();
    assert.equal(frozen.fold.angle, frozenLater.fold.angle); assert.equal(frozen.fold.clock, frozenLater.fold.clock);
    const laterPixels = await page.screenshot({ clip: frozenRegion });
    await fs.writeFile(output + '/frozen-region-before.png', frozenPixels);
    await fs.writeFile(output + '/frozen-region-after.png', laterPixels);
    assert.ok(frozenPixels.equals(laterPixels), 'A paused camera and frozen structure must produce a stable lit image');
    await page.getByRole('button', { name: '继续结构', exact: true }).click();
    await page.waitForFunction(() => window.__spaceStudy.snapshot().fold.phase === 'stable', null, { timeout: 120000 });
    await page.screenshot({ path: output + '/fold-complete.png' }); const complete = await snap();
    assert.ok(Math.abs(complete.fold.angle - .52) < 1e-8);
    assert.equal(initial.geometries, complete.geometries); assert.equal(initial.textures, complete.textures);
    const beforeBlur = await page.evaluate(() => { window.dispatchEvent(new Event('blur')); return window.__spaceStudy.snapshot(); });
    await page.waitForTimeout(600); const blurred = await snap();
    assert.equal(blurred.motion.z, beforeBlur.motion.z); assert.equal(blurred.fold.clock, beforeBlur.fold.clock);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.getByRole('button', { name: '继续前进', exact: true }).click(); await page.waitForTimeout(900);
    assert.ok((await snap()).motion.z < blurred.motion.z);
    report.fold = { begun, middle, complete, frozen: frozen.fold, frozenPixelsIdentical: true, frozenRegion, blurStable: true };
    for (const [width, height] of [[1280, 720], [1440, 900], [1920, 1080]]) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(400);
      const bounds = await page.evaluate(() => [...document.querySelectorAll('.study-controls button,.study-intro')].map(e => e.getBoundingClientRect().toJSON()));
      assert.ok(bounds.every(b => b.x >= 0 && b.y >= 0 && b.right <= width && b.bottom <= height));
      await page.screenshot({ path: output + `/desktop-${width}.png` }); report.viewports.push({ width, height, bounds });
    }
    const reduced = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 720 } }), p = await reduced.newPage();
    p.on('pageerror', e => errors.push(e.message));
    await p.goto(`${INTEGRATION_BASE_URL}/space-a/`, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => window.__spaceStudy?.snapshot().structure);
    const r0 = await p.evaluate(() => window.__spaceStudy.snapshot()); await p.waitForTimeout(900);
    const r1 = await p.evaluate(() => window.__spaceStudy.snapshot());
    assert.equal(r0.motion.z, r1.motion.z); assert.equal(r0.fold.clock, r1.fold.clock);
    await p.getByRole('button', { name: '切换结构状态', exact: true }).click();
    assert.equal((await p.evaluate(() => window.__spaceStudy.snapshot())).fold.angle, .52);
    await reduced.close(); report.reducedMotion = true;
    const original = await browser.newContext({ viewport: { width: 1280, height: 720 } }), home = await original.newPage();
    home.on('pageerror', e => errors.push(e.message));
    await home.goto(`${INTEGRATION_BASE_URL}/`, { waitUntil: 'networkidle' });
    await home.getByRole('button', { name: '推门进入', exact: true }).click();
    await home.waitForFunction(() => window.__mathverse?.snapshot().phase === 'exploring');
    assert.equal(await home.getByRole('button', { name: /数学索引/ }).count(), 1);
    await original.close(); report.originalHomepage = true;
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors, []);
  await fs.writeFile(output + (process.env.SPACE_A_CAPTURE_ONLY ? '/initial-verification.json' : '/verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ views: 5, minimumClearance: initial.structure.minimumClearance, errors, complete: !process.env.SPACE_A_CAPTURE_ONLY }));
  await context.close(); if (video) await video.saveAs(output + '/space-a-demo.webm');
} finally { await browser.close(); }
