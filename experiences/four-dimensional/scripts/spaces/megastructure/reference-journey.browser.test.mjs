import { mathverseBrowserOptions } from '../../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const out=`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/megastructure/megastructure-journey`;await fs.mkdir(out+'/recording',{recursive:true});
const browser=await chromium.launch({...mathverseBrowserOptions(),headless:true}),errors=[],report={};
const context=await browser.newContext({viewport:{width:1600,height:900},recordVideo:{dir:out+'/recording',size:{width:1600,height:900}}});
const page=await context.newPage(),video=page.video();
const track=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});};track(page);
const snap=()=>page.evaluate(()=>window.__referenceStudy.snapshot());
const drag=async(dx,dy)=>{await page.mouse.move(800,450);await page.mouse.down();await page.mouse.move(800+dx,450+dy,{steps:16});await page.mouse.up();await page.mouse.move(0,0);};
try{
 const response=await page.goto(`${INTEGRATION_BASE_URL}/space-a/reference/?study=journey`,{waitUntil:'networkidle'});assert.equal(response.status(),200);
 await page.waitForFunction(()=>window.__referenceStudy?.snapshot().structure);const a=await snap();await page.waitForTimeout(10000);const b=await snap();
 assert.ok(b.position[2]<a.position[2]-1);assert.ok(Math.abs(b.motion.speed-.35)<.001);assert.equal(a.motion.yaw,b.motion.yaw);report.slowTravel={from:a.position,to:b.position,speed:b.motion.speed};
 await drag(-310,-65);const during=await snap();await page.waitForTimeout(1000);const turned=await snap();
 assert.ok(turned.motion.yaw<a.motion.yaw-.5);assert.ok(turned.position[2]<b.position[2]);assert.ok(Math.abs(during.motion.targetYaw-during.motion.yaw)>1e-5);report.elasticLookWhileTravel=true;
 await page.waitForTimeout(4500);await page.getByRole('button',{name:'回到初始视角 ↗'}).click();await page.waitForTimeout(1200);
 const restored=await snap();assert.ok(restored.motion.distance>turned.motion.distance);assert.ok(Math.abs(restored.motion.yaw-.1)<1e-6);report.recenterPreservesPosition=true;
 await page.waitForTimeout(10000);await page.getByRole('button',{name:'暂停前进',exact:true}).click();await page.waitForFunction(()=>window.__referenceStudy.snapshot().motion.speed===0);
 const held=await snap(),pixels=await page.screenshot({clip:{x:220,y:120,width:1150,height:550}});await page.waitForTimeout(650);assert.deepEqual((await snap()).position,held.position);assert.ok(pixels.equals(await page.screenshot({clip:{x:220,y:120,width:1150,height:550}})));report.pausePixelsStable=true;
 for(const [width,height]of [[1280,720],[1920,1080]]){await page.setViewportSize({width,height});await page.waitForTimeout(500);const bounds=await page.locator('.reference-footer,.reference-nav').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));assert.ok(bounds.every(b=>b.x>=0&&b.right<=width&&b.y>=0&&b.bottom<=height));await page.screenshot({path:out+`/desktop-${width}.png`});}
 await context.close();await video.saveAs(out+'/journey-demo.webm');
 const review=await browser.newPage({viewport:{width:1600,height:900}});track(review);
 await review.goto(`${INTEGRATION_BASE_URL}/space-a/reference/?study=journey&review=cell-end`);await review.waitForFunction(()=>window.__referenceStudy?.snapshot().structure);
 const before=await review.evaluate(()=>window.__referenceStudy.snapshot());assert.equal(before.structure.firstCell,0);
 await review.getByRole('button',{name:'继续前进',exact:true}).click();await review.waitForFunction(()=>window.__referenceStudy.snapshot().structure.firstCell===1);
 const crossed=await review.evaluate(()=>window.__referenceStudy.snapshot());assert.ok(crossed.motion.distance>=600&&crossed.motion.distance<601);assert.equal(crossed.geometries,before.geometries);assert.equal(crossed.textures,before.textures);assert.equal(crossed.structure.beams,before.structure.beams);assert.ok(crossed.structure.minimumClearance>=3.2);
 await review.waitForTimeout(1500);await review.screenshot({path:out+'/cell-transition.png'});report.realCellTransition={before:before.motion.distance,after:crossed.motion.distance,resources:[crossed.geometries,crossed.textures]};
 await review.getByRole('button',{name:'暂停前进',exact:true}).click();await review.waitForFunction(()=>window.__referenceStudy.snapshot().motion.speed===0);await review.getByRole('button',{name:'重新进入',exact:true}).click();await review.waitForTimeout(200);assert.equal((await review.evaluate(()=>window.__referenceStudy.snapshot())).motion.distance,0);report.restart=true;
 await review.goto(`${INTEGRATION_BASE_URL}/space-a/reference/?study=first`);await review.waitForFunction(()=>window.__referenceStudy?.snapshot().structure);const first=await review.evaluate(()=>window.__referenceStudy.snapshot());assert.equal(first.structure.beams,631);assert.equal(first.extended,false);report.originalFirstFrame=true;
 const reducedContext=await browser.newContext({reducedMotion:'reduce',viewport:{width:1280,height:720}}),reduced=await reducedContext.newPage();track(reduced);await reduced.goto(`${INTEGRATION_BASE_URL}/space-a/reference/?study=journey`);await reduced.waitForFunction(()=>window.__referenceStudy?.snapshot().structure);const r0=await reduced.evaluate(()=>window.__referenceStudy.snapshot());await reduced.waitForTimeout(700);assert.deepEqual((await reduced.evaluate(()=>window.__referenceStudy.snapshot())).position,r0.position);await reducedContext.close();report.reducedMotion=true;
 await review.goto(`${INTEGRATION_BASE_URL}/artifacts/spaces/megastructure/megastructure-journey/index.html`,{waitUntil:'networkidle'});
 for(const name of ['forward','side','up','back','advanced']){await review.locator(`[data-view="${name}"]`).click();await review.waitForFunction(()=>document.getElementById('current').complete&&document.getElementById('current').naturalWidth===1600);}
 await review.waitForFunction(()=>document.querySelector('video').readyState>=1);const duration=await review.locator('video').evaluate(v=>v.duration);assert.ok(duration>25);report.videoDuration=duration;
 await review.locator('[data-view="back"]').click();await review.screenshot({path:out+'/gallery.png'});
 assert.deepEqual(errors,[]);report.errors=errors;await fs.writeFile(out+'/browser-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
