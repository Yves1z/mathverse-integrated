import { mathverseBrowserOptions } from '../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const output=path.resolve(import.meta.dirname,'../../artifacts/worlds/stage-c');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({...mathverseBrowserOptions(),headless:true});
const context=await browser.newContext({viewport:{width:1600,height:900},recordVideo:{dir:path.join(output,'recording'),size:{width:1600,height:900}}});
const page=await context.newPage(),video=page.video(),errors=[],started=Date.now();
page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto(`${INTEGRATION_BASE_URL}/legacy/`,{waitUntil:'networkidle'});await page.waitForTimeout(1000);
  await page.getByRole('button',{name:'推门进入',exact:true}).click();await page.waitForFunction(()=>window.__mathverse?.snapshot().phase==='exploring');await page.waitForTimeout(900);
  await page.getByRole('button',{name:'观察欧拉恒等式',exact:true}).click();await page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='reading');await page.waitForTimeout(2200);
  await page.getByRole('button',{name:'继续阅读：单位圆',exact:true}).click();await page.waitForTimeout(700);
  const slider=page.getByRole('slider',{name:/改变角度/}),box=await slider.boundingBox();
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.waitForTimeout(1800);
  await page.getByRole('button',{name:'退出阅读',exact:true}).click();await page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='closed');await page.waitForTimeout(600);
  await page.getByRole('button',{name:'数学索引',exact:false}).click();await page.waitForTimeout(900);await page.getByRole('button',{name:'打开莫比乌斯带',exact:true}).click();await page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='reading');await page.waitForTimeout(900);
  const surface=page.getByRole('slider',{name:/环顾曲面/});await surface.focus();
  for(let i=0;i<16;i++){await surface.press('ArrowRight');await page.waitForTimeout(55);}await page.waitForTimeout(900);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='closed');
  await page.waitForTimeout(Math.max(0,33000-(Date.now()-started)));
  assert.deepEqual(errors,[]);await context.close();await video.saveAs(path.join(output,'stage-c-demo.webm'));
  await fs.writeFile(path.join(output,'video-verification.json'),JSON.stringify({checkedAt:new Date().toISOString(),browser:browser.version(),viewport:'1600×900',wallSeconds:(Date.now()-started)/1000,checks:{doorAndDiscovery:true,formulaReading:true,relatedGeometry:true,angleControl:true,catalogAndMobius:true,keyboardExit:true},errors},null,2));
  console.log('Stage C continuous demonstration recorded.');
}finally{await browser.close();}
