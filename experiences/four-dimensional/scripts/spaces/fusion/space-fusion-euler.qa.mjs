import { mathverseBrowserOptions } from '../../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const output = `${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/fusion/space-fusion-euler`, browser = await chromium.launch({ ...mathverseBrowserOptions(), headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }), errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', response => { if (response.status() >= 400) console.log(JSON.stringify({ failedResource: response.url(), status: response.status() })); });
try {
  await page.goto(`${INTEGRATION_BASE_URL}/artifacts/spaces/fusion/space-fusion-euler/index.html`, { waitUntil: 'networkidle' });
  for (const name of ['01 · 内部', '02 · 翻转', '03 · 展开', '无穷与圆', '城市与关系', '指数与旋转']) {
    const button = page.getByRole('button', { name, exact: true }); await button.click();
    await page.waitForFunction(() => { const image = document.querySelector('#study-image'); return image.complete && image.naturalWidth === 1600; });
    assert.equal(await button.getAttribute('aria-pressed'), 'true'); assert.equal(await page.locator('button[aria-pressed=true]').count(), 1);
  }
  await page.getByRole('button', { name: '03 · 展开', exact: true }).click();
  await page.waitForFunction(() => Array.from(document.images).every(i => i.complete && i.naturalWidth === 1600));
  await page.waitForFunction(() => Number.isFinite(document.querySelector('video').duration));
  const duration = await page.locator('video').evaluate(v => v.duration); assert.ok(duration > 60);
  await page.locator('video').evaluate(v => v.play()); await page.waitForTimeout(600);
  const playback = await page.locator('video').evaluate(v => ({ time: v.currentTime, paused: v.paused, error: v.error?.code ?? null })); assert.ok(playback.time > 0); assert.equal(playback.paused, false); assert.equal(playback.error, null);
  await page.locator('video').evaluate(v => v.pause()); await page.screenshot({ path: output + '/gallery.png', fullPage: true }); assert.deepEqual(errors, []);
  await fs.writeFile(output + '/gallery-verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), states: 6, duration, playback, errors }, null, 2)); console.log(JSON.stringify({ duration, playback, errors }, null, 2));
} finally { await browser.close(); }
