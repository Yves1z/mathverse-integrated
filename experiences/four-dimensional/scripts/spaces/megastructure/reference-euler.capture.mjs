import { mathverseBrowserOptions } from '../../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const out=`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/megastructure/megastructure-reference-euler`;await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({...mathverseBrowserOptions(),headless:true}),page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[],views={};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});const snap=()=>page.evaluate(()=>window.__referenceStudy.snapshot());
try{
 for(const [name,t]of [['inside',0],['midpoint',.5],['outside',1]]){await page.goto(`${INTEGRATION_BASE_URL}/space-a/reference/?finish=previous&review=fold-${t}`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__referenceStudy?.snapshot().world);await page.waitForTimeout(700);await page.screenshot({path:out+'/'+name+'.png'});views[name]=await snap();}
 await page.getByRole('button',{name:'欧拉的故事 ↗',exact:true}).click();await page.waitForFunction(()=>window.__referenceStudy.snapshot().reading.phase==='reading');await page.waitForTimeout(700);
 for(const [name,title]of [['series','无穷与圆'],['bridges','城市与关系'],['rotation','指数与旋转']]){await page.getByRole('button',{name:'欧拉故事：'+title,exact:true}).click();await page.waitForTimeout(700);await page.screenshot({path:out+'/'+name+'.png'});views[name]=await snap();}
 assert.deepEqual(errors,[]);await fs.writeFile(out+'/composition.json',JSON.stringify({views,errors},null,2));console.log(JSON.stringify({errors,views:Object.fromEntries(Object.entries(views).map(([k,v])=>[k,{position:v.position,reading:v.reading.phase,area:v.observation?.area,nodes:v.nodes}]))}));
}finally{await browser.close();}
