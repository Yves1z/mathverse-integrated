import { mathverseBrowserOptions } from '../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {RELATION_PITCH} from '../../src/mathverse/windows/relationship.ts';
const output=`${INTEGRATION_PROJECT_ROOT}/artifacts/worlds/stage-d-alignment`,errors=[];
const browser=await chromium.launch({...mathverseBrowserOptions(),headless:true}),context=await browser.newContext({viewport:{width:1600,height:900},recordVideo:{dir:output+'/demo-recording',size:{width:1600,height:900}}}),page=await context.newPage(),video=page.video();
page.on('pageerror',e=>errors.push(e.message));
const snap=()=>page.evaluate(()=>window.__mathverse.snapshot());
const turn=async(dx,dy=0)=>{await page.mouse.move(350,750);await page.mouse.down();await page.mouse.move(350+dx,750-dy,{steps:20});await page.mouse.up();await page.mouse.move(0,0);await page.waitForTimeout(1100);};
try{
  await page.goto(`${INTEGRATION_BASE_URL}/legacy/`,{waitUntil:'networkidle'});await page.waitForTimeout(700);await page.getByRole('button',{name:'推门进入',exact:true}).click();await page.waitForFunction(()=>window.__mathverse.snapshot().phase==='exploring');
  await turn(0,RELATION_PITCH*1600/Math.PI);await page.waitForFunction(()=>window.__mathverse.snapshot().z<-9.94,null,{timeout:90000});await page.getByRole('button',{name:'暂停旅程',exact:true}).click();await page.waitForTimeout(1500);
  await turn(160);await turn(-160);await page.waitForTimeout(900);
  const opening=await snap(),circle=opening.nodes.find(n=>n.id==='unit-circle');await page.mouse.click(...circle.screen);await page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='reading');assert.equal((await snap()).reading.selectedId,'unit-circle');assert.ok((await snap()).picking.opened>opening.picking.opened);await page.waitForTimeout(1400);
  const slider=page.getByRole('slider',{name:/改变角度/}),box=await slider.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.waitForTimeout(1300);
  await page.getByRole('button',{name:'继续阅读：复数的旋转',exact:true}).click();await page.waitForTimeout(1500);await page.getByRole('button',{name:'继续阅读：莱昂哈德·欧拉',exact:true}).click();await page.waitForTimeout(600);await page.getByRole('button',{name:'欧拉故事：指数与旋转',exact:true}).click();await page.waitForTimeout(1600);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='closed');await page.waitForTimeout(700);await page.getByRole('button',{name:'继续旅程',exact:true}).click();await page.waitForTimeout(1700);
  await context.close();await video.saveAs(output+'/stage-d-alignment-demo.webm');
  const proof={canvasPicking:true,focusViewports:[],reducedMotion:true,errors};
  const extra=await browser.newContext({reducedMotion:'reduce',viewport:{width:1280,height:720}}),p=await extra.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(`${INTEGRATION_BASE_URL}/legacy/`,{waitUntil:'networkidle'});await p.getByRole('button',{name:'推门进入',exact:true}).click();await p.waitForFunction(()=>window.__mathverse.snapshot().phase==='exploring');assert.equal((await p.evaluate(()=>window.__mathverse.snapshot())).paused,true);
  await p.mouse.move(350,650);await p.mouse.down();await p.mouse.move(430,590,{steps:16});await p.mouse.up();await p.waitForTimeout(700);const reduced=await p.evaluate(()=>window.__mathverse.snapshot());assert.ok(reduced.relation.xw>.1);assert.ok(reduced.relation.positions.flat().every(Number.isFinite));
  for(const[width,height]of[[1280,720],[1440,900],[1920,1080]]){
    await p.setViewportSize({width,height});await p.getByRole('button',{name:/数学索引/}).click();await p.getByRole('button',{name:'打开单位圆',exact:true}).click();await p.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='reading');
    const bounds=await p.evaluate(()=>({x:scrollX,y:scrollY,main:document.querySelector('main').getBoundingClientRect().x,window:document.querySelector('[data-testid="reading-window"]').getBoundingClientRect().toJSON()}));assert.equal(bounds.x,0);assert.equal(bounds.y,0);assert.equal(bounds.main,0);assert.ok(Math.abs(bounds.window.x-width*.05)<.05);assert.ok(Math.abs(bounds.window.width*bounds.window.height/(width*height)-.801)<.001);proof.focusViewports.push({width,height,...bounds});
    await p.screenshot({path:output+'/reading-desktop-'+width+'.png'});await p.keyboard.press('Escape');await p.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='closed');
  }await extra.close();assert.deepEqual(errors,[]);await fs.writeFile(output+'/alignment-extra-verification.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
}finally{await browser.close();}
