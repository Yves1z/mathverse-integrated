import { mathverseBrowserOptions } from '../../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const out=`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/megastructure/megastructure-exchange`;await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({...mathverseBrowserOptions(),headless:true}),page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[],views={};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 for(const [name,t] of [['inside',0],['opening',.25],['midpoint',.5],['emerging',.75],['outside',1]]){
  await page.goto(`${INTEGRATION_BASE_URL}/space-a/reference/?study=exchange&review=fold-${t}`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__referenceStudy?.snapshot().fold);await page.waitForTimeout(800);
  views[name]=await page.evaluate(()=>window.__referenceStudy.snapshot());await page.screenshot({path:`${out}/${name}.png`});
 }
 assert.deepEqual(errors,[]);await fs.writeFile(out+'/composition.json',JSON.stringify({views,errors},null,2));console.log(JSON.stringify({errors,views:Object.fromEntries(Object.entries(views).map(([k,v])=>[k,{angle:v.fold.angle,position:v.position,resources:[v.geometries,v.textures]}]))}));
}finally{await browser.close();}
