import { mathverseBrowserOptions } from '../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const output=path.resolve(import.meta.dirname,'../../artifacts/worlds/stage-c');await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({...mathverseBrowserOptions(),headless:true});
const page=await browser.newPage({viewport:{width:1600,height:900}});const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',event=>{if(event.type()==='error')errors.push(event.text());});
try{
  await page.goto(`${INTEGRATION_BASE_URL}/legacy/`,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'推门进入',exact:true}).click();await page.waitForFunction(()=>window.__mathverse?.snapshot().phase==='exploring');
  await page.waitForTimeout(600);await page.screenshot({path:path.join(output,'discovery.png')});console.log(JSON.stringify(await page.evaluate(()=>window.__mathverse.snapshot())));
  await page.getByRole('button',{name:'数学索引',exact:false}).click();await page.screenshot({path:path.join(output,'catalog.png')});
  await page.getByRole('button',{name:'打开欧拉恒等式',exact:true}).click();await page.waitForTimeout(1500);await page.screenshot({path:path.join(output,'reading-identity.png')});
  await page.getByRole('button',{name:'继续阅读：单位圆',exact:true}).click();await page.waitForTimeout(300);await page.screenshot({path:path.join(output,'reading-circle.png')});
  await page.locator('.reading-scroll').evaluate(element=>{element.scrollTop=element.scrollHeight;});
  await page.getByRole('button',{name:'继续阅读：复数的旋转',exact:true}).click();await page.waitForTimeout(100);
  assert.equal(await page.locator('.reading-scroll').evaluate(element=>element.scrollTop),0);
  assert.ok(await page.getByRole('heading',{name:'复数的旋转',exact:true}).isVisible());
  assert.ok(await page.getByRole('heading',{name:'复数的旋转',exact:true}).evaluate(element=>document.activeElement===element));
  await page.screenshot({path:path.join(output,'reading-relation.png')});
  for(const[title,file]of [['高斯积分','reading-gaussian.png'],['莫比乌斯带','reading-mobius.png'],['莱昂哈德·欧拉','reading-person.png']]){
    await page.getByRole('button',{name:'退出阅读',exact:true}).click();await page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='closed');
    await page.getByRole('button',{name:'数学索引',exact:false}).click();await page.getByRole('button',{name:`打开${title}`,exact:true}).click();await page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='reading');
    await page.waitForTimeout(200);await page.screenshot({path:path.join(output,file)});
  }
  await fs.writeFile(path.join(output,'reading-ui-verification.json'),JSON.stringify({checkedAt:new Date().toISOString(),checks:{relatedReaderResetsScroll:true,relatedReaderFocusesHeading:true,allSixReaders:true},errors},null,2));
  console.log(JSON.stringify({snapshot:await page.evaluate(()=>window.__mathverse.snapshot()),errors}));
}finally{await browser.close();}
