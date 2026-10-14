import { mathverseBrowserOptions } from '../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const output=path.resolve(import.meta.dirname,'../../artifacts/worlds/stage-d-euler'),browser=await chromium.launch({...mathverseBrowserOptions(),headless:true}),errors=[];
const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>errors.push(e.message));
const data=()=>page.evaluate(()=>{const r=document.querySelector('[data-testid="reading-window"]').getBoundingClientRect(),m=document.querySelector('main').getBoundingClientRect();return{scrollX:window.scrollX,scrollY:window.scrollY,rect:{x:r.x,y:r.y,width:r.width,height:r.height},main:{x:m.x,y:m.y,width:m.width,height:m.height},viewport:{width:innerWidth,height:innerHeight},geometries:window.__mathverse.snapshot().geometries,textures:window.__mathverse.snapshot().textures};});
const open=async()=>{await page.getByRole('button',{name:/数学索引/}).click();await page.getByRole('button',{name:'打开莱昂哈德·欧拉',exact:true}).click();await page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='reading');};
const close=async()=>{await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='closed');};
try{
 await page.goto(`${INTEGRATION_BASE_URL}/legacy/`,{waitUntil:'networkidle'});await page.getByRole('button',{name:'推门进入',exact:true}).click();await page.waitForFunction(()=>window.__mathverse.snapshot().phase==='exploring');
 await open();
 for(const[name,index]of[['城市与关系',1],['指数与旋转',2],['无穷与圆',0],['城市与关系',1]]){
  await page.getByRole('button',{name:`欧拉故事：${name}`,exact:true}).click();await page.waitForFunction(c=>window.__mathverse.snapshot().euler.weights[c]>.985,index);
 }
 const original=await data();console.log(JSON.stringify({original}));
 for(let i=0;i<20;i++){
  await page.getByRole('button',{name:`欧拉故事：${['无穷与圆','城市与关系','指数与旋转'][i%3]}`,exact:true}).click();
  const s=await data();assert.equal(s.scrollX,0);assert.equal(s.scrollY,0);
  await close();await open();
 }
 const layouts=[];
 for(const[width,height]of[[1280,720],[1440,900],[1920,1080]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(500);await page.getByRole('button',{name:'欧拉故事：城市与关系',exact:true}).click();await page.waitForTimeout(1100);
  const s=await data();assert.equal(s.scrollX,0);assert.equal(s.scrollY,0);assert.equal(s.main.x,0);assert.equal(s.main.width,width);assert.ok(Math.abs(s.rect.x-width*.05)<.1);assert.ok(Math.abs(s.rect.y-height*.055)<.1);
  await page.screenshot({path:path.join(output,`euler-desktop-${width}.png`)});layouts.push(s);
 }
 await page.locator('.reading-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);assert.ok(await page.locator('.reading-scroll').evaluate(e=>e.scrollTop>0));const last=await data();assert.equal(last.scrollX,0);assert.equal(last.scrollY,0);
 assert.deepEqual(errors,[]);const report={checkedAt:new Date().toISOString(),twentyCyclesWithoutDocumentScroll:true,innerReadingScroll:true,layouts,errors};await fs.writeFile(path.join(output,'euler-viewport-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
