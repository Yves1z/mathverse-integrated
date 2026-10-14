import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const output = 'D:/Mathverse/artifacts/spaces/inversion/ordered-inversion'; await fs.mkdir(output + '/raw-video', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: output + '/raw-video', size: { width: 1600, height: 900 } } });
let page = await context.newPage(); const video = page.video(), errors = [], checks = {}, viewports = [];
const register = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); }; register(page);
const snap = () => page.evaluate(() => window.__mathverse.snapshot()), field = () => page.evaluate(() => window.__orderedSpace.snapshot());
const button = name => page.getByRole('button', { name, exact: true }), save = name => page.screenshot({ path: output + '/' + name + '.png' });
const still = () => page.waitForFunction(() => { const s = window.__mathverse.snapshot(); return s.speed === 0 && s.yawVelocity === 0 && s.pitchVelocity === 0; });
const read = async title => { await button('数学索引').click(); await button('打开' + title).click(); await page.waitForFunction(() => window.__mathverse.snapshot().reading.phase === 'reading'); };
const close = async () => { await page.keyboard.press('Escape'); await page.waitForFunction(() => window.__mathverse.snapshot().reading.phase === 'closed'); };
const aim = async (yaw, pitch = 0) => {
  const { width, height } = page.viewportSize();
  for (let i = 0; i < 8; i++) {
    const s = await snap(), dx = Math.max(-width * .3, Math.min(width * .3, (yaw - s.targetYaw) * width / Math.PI)), dy = Math.max(-height * .3, Math.min(height * .3, (pitch - s.targetPitch) * width / Math.PI));
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) break;
    await page.mouse.move(width / 2, height / 2); await page.mouse.down(); await page.mouse.move(width / 2 + dx, height / 2 - dy, { steps: 18 }); await page.mouse.up();
  }
  await page.mouse.move(0, 0); await page.waitForFunction(() => { const s = window.__mathverse.snapshot(); return s.yawVelocity === 0 && s.pitchVelocity === 0; });
};
try {
  await page.goto('http://127.0.0.1:5184/', { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__orderedSpace?.snapshot().readyWorlds === 6);
  await save('entrance'); await button('推门进入').click(); await page.waitForFunction(() => window.__mathverse.snapshot().phase === 'exploring'); checks.newHomepageDoorway = true;
  await save('forward'); const moving = await snap(); await page.waitForTimeout(500); assert.ok((await snap()).z < moving.z);
  await button('暂停旅程').click(); await button('定格空间').click(); await still(); await aim(-.58, .04); await save('first-world');
  let node = (await snap()).nodes.find(n => n.id === 'euler-identity'); assert.ok(node.onScreen && !node.occluded && node.alpha > .1, 'First mathematical window should be visible through its model');
  await page.mouse.click(...node.screen); await page.waitForFunction(() => window.__mathverse.snapshot().reading.phase === 'reading'); checks.actualMountedWindowPicking = true;
  await page.waitForFunction(() => Math.abs(window.__mathverse.snapshot().speed - .021) < 1e-6); const reading = await snap(); assert.ok(Math.abs(reading.observation.area - .801) < 1e-6);
  const rz = reading.z; await page.waitForTimeout(500); assert.ok((await snap()).z < rz); await save('reading-identity'); checks.reading80PercentAndNonzeroTravel = true;
  await close(); await still(); assert.equal((await snap()).paused, true);
  await read('莱昂哈德·欧拉'); await button('欧拉故事：城市与关系').click(); assert.equal((await snap()).euler.chapter, 1); await save('euler-story'); await close(); checks.eulerStoryPreserved = true;
  const resources = await field();
  for (const title of ['单位圆', '复数的旋转', '高斯积分', '莫比乌斯带', '欧拉恒等式', '莱昂哈德·欧拉']) { await read(title); await close(); }
  const afterRead = await field(); assert.equal(resources.geometries, afterRead.geometries); assert.equal(resources.textures, afterRead.textures); checks.sixWindowsResourcesStable = true;
  await still(); await aim(Math.PI, .1); await save('back'); await aim(.42, .03); await save('opposite-world'); await aim(-.58, .04);
  await button('观看一次翻转').click(); await page.waitForFunction(() => window.__orderedSpace.snapshot().rhythm.angle > .85, null, { timeout: 90000 });
  await save('unfolding'); const middle = await field(); assert.equal(middle.rhythm.movingUnits, 1);
  const changed = middle.field.sections.filter(s => Math.abs(s.angle) > 1e-6 && Math.abs(s.angle - Math.PI) > 1e-6); assert.equal(changed.length, 1);
  assert.notDeepEqual(middle.poses.find(n => n.id === 'euler-identity').position, resources.poses.find(n => n.id === 'euler-identity').position); checks.oneMovingUnitAndAttachedWindows = true;
  await button('定格空间').click(); await still(); await page.waitForTimeout(350); const frozen = await field();
  const clip = { x: 430, y: 130, width: 1100, height: 540 }, pixels = await page.screenshot({ clip }); await page.waitForTimeout(600);
  assert.equal((await field()).rhythm.clock, frozen.rhythm.clock); assert.ok(pixels.equals(await page.screenshot({ clip }))); checks.freezeStablePixels = true;
  const blur = await page.evaluate(() => { window.dispatchEvent(new Event('blur')); return window.__orderedSpace.snapshot(); }); await page.waitForTimeout(250); assert.equal((await field()).rhythm.clock, blur.rhythm.clock); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await button('让空间继续流动').click(); await page.waitForFunction(() => window.__orderedSpace.snapshot().rhythm.phase === 'stable', null, { timeout: 90000 }); await save('settled');
  const complete = await field(); assert.equal(complete.rhythm.angle, Math.PI); assert.equal(complete.field.bones, 202); checks.fullInversionInSpace = true;
  await button('定格空间').click();
  for (const [width, height] of [[1280, 720], [1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height }); const controls = await page.locator('.chrome button,.ordered-rhythm button').evaluateAll(items => items.map(e => e.getBoundingClientRect().toJSON()));
    assert.ok(controls.every(b => b.x >= 0 && b.right <= width && b.y >= 0 && b.bottom <= height)); await read('单位圆');
    const rect = await page.getByTestId('reading-window').boundingBox(); assert.ok(Math.abs(rect.width * rect.height / (width * height) - .801) < .001); await save('desktop-' + width); viewports.push({ width, height, area: .801 }); await close();
  }
  await context.close(); await video.saveAs(output + '/ordered-space-demo.webm');
  const reduced = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' }); page = await reduced.newPage(); register(page);
  await page.goto('http://127.0.0.1:5184/space-inversion/worlds/', { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__orderedSpace?.snapshot().readyWorlds === 6);
  const r0 = await snap(); assert.ok(r0.paused && r0.spaceFrozen); await button('切换一个单元').click(); assert.equal((await field()).rhythm.angle, Math.PI); await read('莱昂哈德·欧拉'); await close(); checks.reducedMotionManualAccess = true;
  await page.goto('http://127.0.0.1:5184/legacy/', { waitUntil: 'networkidle' }); await button('推门进入').waitFor();
  await page.goto('http://127.0.0.1:5184/space-inversion/', { waitUntil: 'networkidle' }); await button('看全貌').waitFor(); checks.originalModelAndLegacyPreserved = true;
  await reduced.close(); assert.deepEqual(errors, []);
  const report = { checkedAt: new Date().toISOString(), browser: browser.version(), checks, viewports, middle, complete, resources: { start: [resources.geometries, resources.textures], afterSixReadings: [afterRead.geometries, afterRead.textures] }, errors,
    scope: 'Actual homepage entry, picking, reading and complete model event. Resource checks cover six reading cycles; GPU performance and long-duration hardware acceptance remain separate.' };
  await fs.writeFile(output + '/browser-verification.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify({ checks, resources: report.resources, errors }, null, 2));
} catch (e) { if (!page.isClosed()) { await save('failure'); console.log(JSON.stringify({ errors, motion: await snap().catch(() => null), field: await field().catch(() => null) })); } throw e; }
finally { await browser.close(); }
