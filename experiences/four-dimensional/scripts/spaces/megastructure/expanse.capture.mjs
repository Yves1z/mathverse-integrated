import { mathverseBrowserOptions } from '../../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const out = `${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/megastructure/megastructure-expanse`;
const browser = await chromium.launch({ ...mathverseBrowserOptions(), headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [], report = {};
page.on('pageerror', e => errors.push(e.message));
try {
  for (const [name, query] of [['before','space=previous&review=inner'], ['inner','review=inner'], ['middle','review=middle'], ['outer','review=outer']]) {
    const response = await page.goto(`${INTEGRATION_BASE_URL}/space-a/euler/?${query}`, { waitUntil: 'networkidle' });
    if (response.status() !== 200) throw new Error('Preview unavailable');
    await page.waitForFunction(() => window.__megaEuler?.snapshot().world);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${out}/${name}.png` });
    report[name] = await page.evaluate(() => window.__megaEuler.snapshot());
  }
  // Real keyboard look input: no synthetic camera pose in the application.
  await page.goto(`${INTEGRATION_BASE_URL}/space-a/euler/?review=inner`);
  await page.waitForFunction(() => window.__megaEuler?.snapshot().world);
  for (let i=0;i<3;i++) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1100); await page.screenshot({ path: `${out}/forward.png` });
  for (let i=0;i<4;i++) await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(1100); await page.screenshot({ path: `${out}/up.png` });
  await fs.writeFile(`${out}/composition.json`, JSON.stringify({ report, errors }, null, 2));
  console.log(JSON.stringify({ errors, clearances: Object.fromEntries(Object.entries(report).map(([k,v]) => [k,v.structure.minimumClearance])) }));
} finally { await browser.close(); }
