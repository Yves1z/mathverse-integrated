import { mathverseBrowserOptions } from '../../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const out=`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/megastructure/megastructure-journey`;await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({...mathverseBrowserOptions(),headless:true});const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[],views={};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const snap=()=>page.evaluate(()=>window.__referenceStudy.snapshot());
const drag=async(dx,dy=0)=>{await page.mouse.move(800,450);await page.mouse.down();await page.mouse.move(800+dx,450+dy,{steps:16});await page.mouse.up();await page.mouse.move(0,0);await page.waitForTimeout(900);};
try{
 await page.goto(`${INTEGRATION_BASE_URL}/space-a/reference/?study=journey&review=views`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__referenceStudy?.snapshot().structure);await page.waitForTimeout(1000);
 for(const name of ['forward','side','up','back']){
  await page.getByRole('button',{name:'回到初始视角 ↗'}).click();await page.waitForTimeout(900);
  if(name==='side')await drag(-450,-20);
  if(name==='up')await drag(10,-240);
  if(name==='back'){for(let i=0;i<4;i++)await drag(400,0);}
  await page.screenshot({path:out+'/'+name+'.png'});views[name]=await snap();
 }
 await page.goto(`${INTEGRATION_BASE_URL}/space-a/reference/?study=journey&review=advanced`);await page.waitForFunction(()=>window.__referenceStudy?.snapshot().structure);await page.waitForTimeout(1000);await page.screenshot({path:out+'/advanced.png'});views.advanced=await snap();
 await fs.writeFile(out+'/composition.json',JSON.stringify({views,errors},null,2));console.log(JSON.stringify({errors,views:Object.fromEntries(Object.entries(views).map(([k,v])=>[k,{position:v.position,yaw:v.motion.yaw,pitch:v.motion.pitch,clearance:v.structure.minimumClearance}]))}));
}finally{await browser.close();}
