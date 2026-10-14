import { mathverseBrowserOptions } from '../../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({...mathverseBrowserOptions(),headless:true}),page=await browser.newPage({viewport:{width:1600,height:1250}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(`${INTEGRATION_BASE_URL}/artifacts/spaces/fusion/space-fusion-gaussian/index.html`,{waitUntil:'networkidle'});
  for(const [i,name] of ['内部','翻转','展开'].entries()){const button=page.getByRole('button',{name:`0${i+1} · ${name}`,exact:true});await button.click();await page.waitForFunction(()=>{const i=document.querySelector('#study-image');return i.complete&&i.naturalWidth===1600;});assert.equal(await button.getAttribute('aria-pressed'),'true');}
  await page.waitForFunction(()=>Number.isFinite(document.querySelector('video').duration)&&document.querySelector('video').readyState>=2);
  const media=await page.locator('video').evaluate(v=>({duration:v.duration,error:v.error?.message??null}));assert.ok(media.duration>132);assert.equal(media.error,null);
  await page.locator('video').focus();await page.keyboard.press('Space');await page.waitForTimeout(800);const playing=await page.locator('video').evaluate(v=>({time:v.currentTime,paused:v.paused}));assert.ok(playing.time>0&&!playing.paused);await page.keyboard.press('Space');
  await page.screenshot({path:`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/fusion/space-fusion-gaussian/gallery.png`,fullPage:true});assert.deepEqual(errors,[]);const result={steps:3,media,playing,errors};await fs.writeFile(`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/fusion/space-fusion-gaussian/gallery-verification.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
