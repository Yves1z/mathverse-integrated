import { mathverseBrowserOptions } from '../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {RELATION_PITCH} from '../../src/mathverse/windows/relationship.ts';
const output=`${INTEGRATION_PROJECT_ROOT}/artifacts/worlds/stage-d-alignment`;await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({...mathverseBrowserOptions(),headless:true}),page=await browser.newPage({viewport:{width:1600,height:900}});
page.on('pageerror',error=>console.log('ERROR',error.message));
try{
await page.goto(`${INTEGRATION_BASE_URL}/legacy/`,{waitUntil:'networkidle'});await page.getByRole('button',{name:'推门进入',exact:true}).click();await page.waitForFunction(()=>window.__mathverse.snapshot().phase==='exploring');
await page.mouse.move(350,750);await page.mouse.down();await page.mouse.move(350,750-RELATION_PITCH*1600/Math.PI,{steps:22});await page.mouse.up();await page.mouse.move(0,0);
await page.waitForFunction(()=>window.__mathverse.snapshot().z<-9.94,{},{timeout:90000});await page.getByRole('button',{name:'暂停旅程',exact:true}).click();await page.waitForTimeout(1600);
console.log(JSON.stringify(await page.evaluate(()=>window.__mathverse.snapshot()),null,2));await page.screenshot({path:output+'/alignment-probe.png'});
await page.mouse.move(350,750);await page.mouse.down();await page.mouse.move(350+160,750,{steps:20});await page.mouse.up();await page.waitForTimeout(700);await page.screenshot({path:output+'/alignment-turn-probe.png'});
console.log('Turn',JSON.stringify((await page.evaluate(()=>window.__mathverse.snapshot())).relation));
}finally{await browser.close();}
