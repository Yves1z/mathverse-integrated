import { mathverseBrowserOptions } from '../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const output=process.env.MATHVERSE_TEST_OUTPUT??path.resolve(import.meta.dirname,'../../artifacts/worlds/stage-d-windows');await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({...mathverseBrowserOptions(),headless:true});
const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
const snapshot=()=>page.evaluate(()=>window.__mathverse.snapshot());
const waitRead=()=>page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='reading');
const close=async()=>{await page.getByRole('button',{name:'退出阅读',exact:true}).click();await page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='closed');};
const open=async title=>{await page.getByRole('button',{name:'数学索引',exact:false}).click();await page.getByRole('button',{name:`打开${title}`,exact:true}).click();await waitRead();};
try{
  await page.goto(`${INTEGRATION_BASE_URL}/legacy/`,{waitUntil:'networkidle'});await page.screenshot({path:path.join(output,'entrance.png')});
  await page.getByRole('button',{name:'推门进入',exact:true}).click();await page.waitForFunction(()=>window.__mathverse?.snapshot().phase==='exploring');
  await page.waitForTimeout(400);await page.screenshot({path:path.join(output,'connected-worlds.png')});
  console.log(JSON.stringify({discovery:await snapshot(),errors}));
  await open('欧拉恒等式');await page.waitForTimeout(700);await page.screenshot({path:path.join(output,'reading-identity.png')});
  const bounds=await page.getByTestId('reading-window').boundingBox();assert.ok(Math.abs(bounds.width*bounds.height/(1600*900)-.801)<.001);
  const slider=page.getByRole('slider',{name:/改变角度/});await slider.press('Home');for(let i=0;i<180;i++)await slider.press('ArrowRight');
  await page.waitForTimeout(700);const half=await snapshot();assert.ok(Math.abs(half.connections.angle-Math.PI)<.01);
  await page.getByRole('button',{name:'继续阅读：单位圆',exact:true}).click();await page.waitForTimeout(500);assert.equal((await snapshot()).reading.angle,Math.PI);await page.screenshot({path:path.join(output,'reading-circle.png')});
  await page.getByRole('button',{name:'继续阅读：复数的旋转',exact:true}).click();await page.waitForTimeout(500);assert.equal((await snapshot()).reading.angle,Math.PI);await page.screenshot({path:path.join(output,'reading-rotation.png')});
  await close();
  for(const [title,file] of [['高斯积分','reading-gaussian.png'],['莫比乌斯带','reading-mobius.png'],['莱昂哈德·欧拉','reading-person.png']]){await open(title);await page.waitForTimeout(450);await page.screenshot({path:path.join(output,file)});await close();}
  assert.deepEqual(errors,[]);const report={checkedAt:new Date().toISOString(),browser:browser.version(),checks:{allSixWorlds:true,readingArea:.801,sharedAngleAndRelatedContinuity:true},snapshot:await snapshot(),errors};
  await fs.writeFile(path.join(output,'smoke-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){await page.screenshot({path:path.join(output,'failure.png')});console.log(JSON.stringify({snapshot:await snapshot(),errors}));throw error;}finally{await browser.close();}
