import { mathverseBrowserOptions } from '../../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const output = `${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/fusion/space-fusion`, browser = await chromium.launch({ ...mathverseBrowserOptions(), headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1250 }, reducedMotion: 'reduce' });
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(`${INTEGRATION_BASE_URL}/artifacts/spaces/fusion/space-fusion/index.html`, { waitUntil: 'networkidle' });
  const media = await page.locator('video').evaluate(v => ({ duration: v.duration, error: v.error?.message ?? null, ready: v.readyState }));
  assert.ok(media.duration > 90 && !media.error);
  for (const [name, source] of [['01 · 内部', 'inner.png'], ['02 · 翻转', 'unfolding.png'], ['03 · 展开', 'outer.png']]) {
    await page.getByRole('button', { name, exact: true }).click(); assert.equal(await page.locator('#study-image').getAttribute('src'), source);
    await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth));
  }
  await page.screenshot({ path: output + '/gallery.png' });
  await page.getByRole('link', { name: '进入融合空间 ↗', exact: true }).click();
  await page.waitForFunction(() => window.__orderedSpace?.snapshot().readyWorlds === 6);
  const first = await page.evaluate(() => window.__mathverse.snapshot()); assert.ok(first.paused && first.spaceFrozen);
  await page.waitForTimeout(400); assert.equal((await page.evaluate(() => window.__mathverse.snapshot())).z, first.z);
  await page.getByRole('button', { name: '切换一个单元', exact: true }).click();
  await page.waitForFunction(() => window.__orderedSpace.snapshot().field.sections.find(s => s.section === 0).angle === Math.PI);
  await page.getByRole('button', { name: '数学索引', exact: true }).click(); await page.getByRole('button', { name: '打开单位圆', exact: true }).click();
  await page.waitForFunction(() => window.__mathverse.snapshot().reading.phase === 'reading');
  assert.ok(Math.abs((await page.evaluate(() => window.__mathverse.snapshot())).observation.area - .801) < 1e-6);
  await page.keyboard.press('Escape'); await page.waitForFunction(() => window.__mathverse.snapshot().reading.phase === 'closed');
  assert.deepEqual(errors, []);
  const report = { checkedAt: new Date().toISOString(), galleryImagesAndButtons: true, media, reducedMotionDefaultStill: true, reducedMotionManualExchange: true, reducedMotionReading: true, errors };
  await fs.writeFile(output + '/gallery-and-reduced-motion.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally { await context.close(); await browser.close(); }
