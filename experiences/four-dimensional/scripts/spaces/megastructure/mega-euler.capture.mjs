import { mathverseBrowserOptions } from '../../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const output = `${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/megastructure/megastructure-euler`;
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ ...mathverseBrowserOptions(), headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const report = {};
try {
  for (const pose of ['baseline', 'inner', 'middle', 'outer']) {
    await page.goto(`${INTEGRATION_BASE_URL}/space-a/euler/?space=previous&review=${pose}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__megaEuler?.snapshot().structure);
    await page.waitForTimeout(1300);
    await page.screenshot({ path: `${output}/${pose}.png` });
    report[pose] = await page.evaluate(() => window.__megaEuler.snapshot());
  }
  await fs.writeFile(`${output}/composition.json`, JSON.stringify({ report, errors }, null, 2));
  console.log(JSON.stringify({ errors, clearances: Object.fromEntries(Object.entries(report).map(([k, v]) => [k, v.structure.minimumClearance])) }));
} finally { await browser.close(); }

