import { mathverseBrowserOptions } from '../../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const out=`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/megastructure/megastructure-reference`;await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({...mathverseBrowserOptions(),headless:true});
const page=await browser.newPage({viewport:{width:1600,height:900}}), errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
try{
 const response=await page.goto(`${INTEGRATION_BASE_URL}/space-a/reference/?study=first`,{waitUntil:'networkidle'});assert.equal(response.status(),200);
 await page.waitForFunction(()=>window.__referenceStudy?.snapshot().structure);await page.waitForTimeout(1600);
 await page.screenshot({path:out+'/first-view.png'});const first=await page.evaluate(()=>window.__referenceStudy.snapshot());
 const a=await page.screenshot({clip:{x:220,y:120,width:1150,height:550}});await page.waitForTimeout(400);assert.ok(a.equals(await page.screenshot({clip:{x:220,y:120,width:1150,height:550}})));
 await page.mouse.move(800,450);await page.mouse.down();await page.mouse.move(970,370,{steps:16});await page.mouse.up();await page.waitForTimeout(1000);
 const look=await page.evaluate(()=>window.__referenceStudy.snapshot());assert.ok(look.motion.yaw>first.motion.yaw);assert.ok(look.motion.pitch>first.motion.pitch);assert.deepEqual(look.position,first.position);
 await page.mouse.move(0,0);await page.screenshot({path:out+'/look.png'});
 await page.getByRole('button',{name:'回到初始视角 ↗'}).click();await page.waitForTimeout(500);
 assert.ok(Math.abs((await page.evaluate(()=>window.__referenceStudy.snapshot())).motion.yaw-first.motion.yaw)<1e-6);
 for(const [width,height]of [[1280,720],[1920,1080]]){await page.setViewportSize({width,height});await page.waitForTimeout(500);const rect=await page.locator('.reference-footer').boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width);await page.screenshot({path:out+`/desktop-${width}.png`});}
 const galleryResponse=await page.goto(`${INTEGRATION_BASE_URL}/artifacts/spaces/megastructure/megastructure-reference/index.html`,{waitUntil:'networkidle'});assert.equal(galleryResponse.status(),200);
 await page.waitForFunction(()=>document.querySelector('.reference img').complete&&document.getElementById('current').naturalWidth===1600);
 await page.getByRole('button',{name:'环顾视角',exact:true}).click();await page.waitForFunction(()=>document.getElementById('current').complete&&document.getElementById('current').src.endsWith('/look.png'));
 await page.getByRole('button',{name:'初始视角',exact:true}).click();await page.waitForFunction(()=>document.getElementById('current').complete&&document.getElementById('current').src.endsWith('/first-view.png'));
 await page.screenshot({path:out+'/gallery.png'});
 assert.deepEqual(errors,[]);await fs.writeFile(out+'/verification.json',JSON.stringify({first,look,staticPixels:true,reset:true,desktop:true,gallery:true,errors},null,2));console.log(JSON.stringify({first,errors}));
}finally{await browser.close();}
