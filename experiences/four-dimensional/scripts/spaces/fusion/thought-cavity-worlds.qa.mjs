import { mathverseBrowserOptions } from '../../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const output=`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/fusion/thought-cavity-worlds`,browser=await chromium.launch({...mathverseBrowserOptions(),headless:true}),page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${INTEGRATION_BASE_URL}/artifacts/spaces/fusion/thought-cavity-worlds/index.html`,{waitUntil:'networkidle'});
 for(const name of ['欧拉 · 内侧','欧拉 · 翻转','欧拉 · 外侧','莫比乌斯 · 内侧','莫比乌斯 · 翻转','莫比乌斯 · 外侧','高斯 · 内侧','高斯 · 翻转','高斯 · 外侧','回望巨构']){const button=page.getByRole('button',{name,exact:true});await button.click();await page.waitForFunction(()=>{const i=document.querySelector('#study-image');return i.complete&&i.naturalWidth===1600;});assert.equal(await button.getAttribute('aria-pressed'),'true');assert.equal(await page.locator('button[aria-pressed=true]').count(),1);}
 await page.getByRole('button',{name:'莫比乌斯 · 外侧',exact:true}).click();await page.waitForFunction(()=>Array.from(document.images).every(i=>i.complete&&i.naturalWidth===1600));await page.waitForFunction(()=>Number.isFinite(document.querySelector('video').duration));
 const duration=await page.locator('video').evaluate(v=>v.duration);assert.ok(duration>130);await page.locator('video').evaluate(v=>v.play());await page.waitForTimeout(600);const playback=await page.locator('video').evaluate(v=>({time:v.currentTime,paused:v.paused,error:v.error?.code??null}));assert.ok(playback.time>0);assert.equal(playback.paused,false);assert.equal(playback.error,null);await page.locator('video').evaluate(v=>{v.pause();v.load();});await page.waitForFunction(()=>document.querySelector('video').readyState>=1);await page.screenshot({path:output+'/gallery.png',fullPage:true});assert.deepEqual(errors,[]);
 await fs.writeFile(output+'/gallery-verification.json',JSON.stringify({checkedAt:new Date().toISOString(),states:10,duration,playback,errors},null,2));console.log(JSON.stringify({states:10,duration,playback,errors},null,2));
}finally{await browser.close();}
