import { mathverseBrowserOptions } from '../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname,'../..');
const output = path.join(root, 'artifacts', 'stage-a-refined');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ ...mathverseBrowserOptions(), headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
const snapshot = () => page.evaluate(() => window.__mathverse.snapshot());
const checks = {};
try {
  await page.goto(`${INTEGRATION_BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__mathverse && window.__mathverse.snapshot().phase === 'idle');
  await page.screenshot({ path: path.join(output, 'entrance.png') });
  const entrance = await snapshot();
  assert.equal(entrance.phase, 'idle');
  assert.ok(entrance.structure.minimumClearance > 2.55, 'structure must stay clear of the travel path');
  checks.structureClearance = entrance.structure.minimumClearance;

  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  assert.equal((await snapshot()).suspended, true);

  await page.getByRole('button', { name: '推门进入', exact: true }).click();
  await page.waitForFunction(() => window.__mathverse.snapshot().phase === 'exploring', null, { timeout: 25000 });
  checks.entryRecoversFromBlur = true;
  await page.waitForTimeout(500);
  const before = await snapshot();
  await page.waitForTimeout(850);
  const after = await snapshot();
  assert.ok(after.distance > before.distance + 0.10, 'travel must continue automatically');
  assert.equal(after.position[0], 0);
  assert.equal(after.position[1], 1.55);
  checks.forwardTravel = { before: before.distance, after: after.distance };

  await page.getByRole('button', { name: '暂停旅程', exact: true }).click();
  await page.getByRole('button', { name: '继续旅程', exact: true }).waitFor();
  await page.waitForFunction(() => window.__mathverse.snapshot().speed === 0, null, { timeout: 5000 });
  await page.screenshot({ path: path.join(output, 'interior-forward.png') });
  const pausedBefore = await snapshot();
  await page.waitForTimeout(450);
  const pausedAfter = await snapshot();
  assert.equal(pausedAfter.distance, pausedBefore.distance);
  checks.pause = true;
  assert.ok(pausedAfter.spaceTime > pausedBefore.spaceTime, 'the fourth-axis structure must keep changing when camera travel is paused');
  checks.independentSpaceTime = true;
  await page.getByRole('button', { name: '定格空间', exact: true }).click();
  await page.waitForTimeout(150);
  const frozenBefore = await snapshot();
  await page.waitForTimeout(300);
  const frozenAfter = await snapshot();
  assert.equal(frozenAfter.spaceTime, frozenBefore.spaceTime);
  checks.freezeSpace = true;
  await page.getByRole('button', { name: '让空间继续流动', exact: true }).click();

  await page.mouse.move(450, 500);
  await page.mouse.down();
  await page.mouse.move(1250, 500, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(650);
  const side = await snapshot();
  assert.ok(side.yaw > 1, 'drag must turn the camera right');
  assert.equal(side.distance, pausedAfter.distance);
  assert.equal(side.position[0], 0);
  await page.screenshot({ path: path.join(output, 'interior-side.png') });
  checks.independentLook = { yaw: side.yaw, position: side.position };

  await page.mouse.move(450, 500);
  await page.mouse.down();
  await page.mouse.move(1250, 500, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(650);
  const back = await snapshot();
  assert.ok(back.direction[2] > 0.5, 'looking backwards should face the space already traversed');
  await page.screenshot({ path: path.join(output, 'interior-back.png') });
  checks.backwardsLook = back.direction;

  await page.getByRole('button', { name: '看向前方', exact: true }).click();
  await page.waitForTimeout(650);
  const forward = await snapshot();
  assert.ok(forward.direction[2] < -0.99);
  assert.equal(forward.position[0], 0);
  checks.lookForward = true;
  await page.getByRole('button', { name: '继续旅程', exact: true }).click();
  await page.waitForTimeout(600);
  const resumed = await snapshot();
  assert.ok(resumed.distance > forward.distance);
  checks.resume = true;

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(350);
  assert.ok(await page.getByRole('button', { name: '暂停旅程', exact: true }).isVisible());
  await page.screenshot({ path: path.join(output, 'interior-1280.png') });
  checks.desktop1280 = true;
  assert.deepEqual(errors, []);
  const report = { checkedAt: new Date().toISOString(), browser: browser.version(), viewport: '1920x1080 and 1280x720', checks, errors, scene: resumed, scope: 'Refined Stage A functional checks; not a full GPU performance benchmark' };
  await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await context.close();
  await browser.close();
}
