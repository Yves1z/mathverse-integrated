import { mathverseBrowserOptions } from '../../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const output = `${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/megastructure/megastructure-expanse`;
await fs.mkdir(output + '/recording', { recursive: true });
const errors = [], browser = await chromium.launch({ ...mathverseBrowserOptions(), headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: output + '/recording', size: { width: 1600, height: 900 } } });
const page = await context.newPage(), video = page.video();
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const snap = () => page.evaluate(() => window.__megaEuler.snapshot());
const report = {};
try {
  const response = await page.goto(`${INTEGRATION_BASE_URL}/space-a/euler/`, { waitUntil: 'networkidle' }); assert.equal(response.status(), 200);
  await page.waitForFunction(() => window.__megaEuler?.snapshot().world);
  await page.waitForTimeout(1600); const start = await snap(); await page.waitForTimeout(1200); const travel = await snap();
  assert.ok(travel.motion.z < start.motion.z); report.travel = [start.motion.z, travel.motion.z];
  await page.getByRole('button', { name: '暂停前进', exact: true }).click(); await page.waitForFunction(() => window.__megaEuler.snapshot().motion.speed === 0);
  const beforeLook = await snap();
  await page.mouse.move(1100, 490); await page.mouse.down(); await page.mouse.move(1175, 470, { steps: 12 }); await page.mouse.up(); await page.mouse.move(0, 0); await page.waitForTimeout(900);
  const afterLook = await snap(); assert.ok(afterLook.motion.yaw > beforeLook.motion.yaw); assert.equal(afterLook.motion.z, beforeLook.motion.z);
  // Return using a real drag, preserving the natural camera constraint.
  await page.mouse.move(1100, 490); await page.mouse.down(); await page.mouse.move(1025, 510, { steps: 12 }); await page.mouse.up(); await page.mouse.move(0, 0); await page.waitForTimeout(1100);
  report.elasticLook = true;
  await page.getByRole('button', { name: /展开这一片空间/ }).click();
  await page.waitForFunction(() => window.__megaEuler.snapshot().fold.angle > 1.2, null, { timeout: 180000 });
  await page.getByRole('button', { name: '定格结构', exact: true }).click(); await page.waitForTimeout(900);
  const held = await snap(); const clip = { x: 280, y: 110, width: 1120, height: 530 };
  const pixels = await page.screenshot({ clip }); await page.waitForTimeout(700); const heldLater = await snap();
  assert.equal(held.fold.angle, heldLater.fold.angle); assert.equal(held.fold.clock, heldLater.fold.clock); assert.ok(pixels.equals(await page.screenshot({ clip })));
  report.frozenStable = true;
  await page.getByRole('button', { name: '继续结构', exact: true }).click();
  await page.waitForFunction(() => { const s = window.__megaEuler.snapshot(); return s.fold.phase === 'stable' && s.fold.angle > 3.14; }, null, { timeout: 180000 });
  const complete = await snap(); assert.equal(complete.fold.events, 1); assert.ok(complete.structure.minimumClearance > 3.2);
  assert.equal(complete.figures[0].sourceUnchanged, true); assert.equal(complete.world.sharedProjection, true);
  await page.screenshot({ path: output + '/live-outer.png' }); report.complete = complete;
  const paper = complete.nodes.find(n => n.id === 'leonhard-euler');
  await page.mouse.click(paper.screen[0], paper.screen[1]);
  await page.waitForFunction(() => window.__mathverse.snapshot().reading.phase === 'reading');
  assert.equal(await page.evaluate(() => window.__mathverse.snapshot().reading.selectedId), 'leonhard-euler'); report.actualPaperPick = true;
  const r0 = await snap(); await page.waitForTimeout(1600); const r1 = await snap();
  assert.ok(r1.motion.z < r0.motion.z); assert.ok(Math.abs(r1.motion.speed - .021) < .001); assert.ok(Math.abs(r1.observation.area - .801) < .002);
  const chapters = page.getByRole('button', { name: /^欧拉故事：/ }); assert.equal(await chapters.count(), 3);
  for (let i = 0; i < 3; i++) { await chapters.nth(i).click(); await page.waitForTimeout(700); await page.screenshot({ path: output + `/story-${i}.png` }); }
  report.reading = { area: r1.observation.area, speed: r1.motion.speed, chapters: 3 };
  await page.getByRole('button', { name: '退出阅读', exact: true }).click(); await page.waitForFunction(() => window.__mathverse.snapshot().reading.phase === 'closed');
  assert.equal((await snap()).motion.paused, true);
  for (const [width, height] of [[1280, 720], [1920, 1080]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(500);
    const bounds = await page.locator('.mega-navigation,.study-controls').evaluateAll(es => es.map(e => e.getBoundingClientRect().toJSON()));
    assert.ok(bounds.every(b => b.x >= 0 && b.y >= 0 && b.right <= width && b.bottom <= height));
    await page.screenshot({ path: output + `/desktop-${width}.png` });
  }
  await context.close(); await video.saveAs(output + '/expanse-demo.webm');
  const reducedContext = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 720 } }); const reduced = await reducedContext.newPage();
  reduced.on('pageerror', e => errors.push(e.message)); await reduced.goto(`${INTEGRATION_BASE_URL}/space-a/euler/`);
  await reduced.waitForFunction(() => window.__megaEuler?.snapshot().world);
  const a = await reduced.evaluate(() => window.__megaEuler.snapshot()); await reduced.waitForTimeout(700); const b = await reduced.evaluate(() => window.__megaEuler.snapshot());
  assert.equal(a.motion.z, b.motion.z); assert.equal(a.fold.clock, b.fold.clock);
  await reduced.getByRole('button', { name: /切换结构状态/ }).click(); assert.equal((await reduced.evaluate(() => window.__megaEuler.snapshot())).fold.angle, Math.PI);
  await reducedContext.close(); report.reducedMotion = true;
  const qa = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); qa.on('pageerror', e => errors.push(e.message));
  await qa.goto(`${INTEGRATION_BASE_URL}/artifacts/spaces/megastructure/megastructure-expanse/index.html`, { waitUntil: 'networkidle' });
  for (const pose of ['inner', 'middle', 'outer', 'compare']) { await qa.locator(`[data-pose="${pose}"]`).click(); await qa.waitForFunction(() => document.getElementById('current').complete && document.getElementById('current').naturalWidth === 1600); }
  await qa.locator('#split').fill('35'); await qa.locator('#split').dispatchEvent('input');
  assert.equal(await qa.locator('#divider').evaluate(e => e.style.left), '35%');
  await qa.waitForFunction(() => document.querySelector('video').readyState >= 1);
  const duration = await qa.locator('video').evaluate(e => e.duration); assert.ok(duration > 44); report.videoDuration = duration;
  await qa.locator('[data-pose="outer"]').click(); await qa.screenshot({ path: output + '/gallery.png' }); await qa.close();
  assert.deepEqual(errors, []); report.errors = errors;
  await fs.writeFile(output + '/browser-verification.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ completeEvent: true, reading: report.reading, reducedMotion: true, videoDuration: duration, errors }));
} finally { await browser.close(); }

