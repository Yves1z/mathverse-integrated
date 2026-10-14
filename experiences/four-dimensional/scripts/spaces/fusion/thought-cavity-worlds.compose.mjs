import { mathverseBrowserOptions } from '../../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { CAVITY_WORLDS } from '../../../src/mathverse/experiments/fusion/cavityWorldModel.ts';
const output=`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/fusion/thought-cavity-worlds`;await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({...mathverseBrowserOptions(),headless:true}),page=await browser.newPage({viewport:{width:1600,height:900},reducedMotion:'reduce'});
const still=()=>page.waitForFunction(()=>{const s=window.__mathverse.snapshot();return s.yawVelocity===0&&s.pitchVelocity===0;});
const aim=async(yaw,pitch)=>{for(let i=0;i<14;i++){const s=await page.evaluate(()=>window.__mathverse.snapshot()),dx=Math.max(-480,Math.min(480,(yaw-s.targetYaw)*1600/Math.PI)),dy=Math.max(-270,Math.min(270,(pitch-s.targetPitch)*1600/Math.PI));if(Math.abs(dx)<1&&Math.abs(dy)<1)break;await page.mouse.move(800,450);await page.mouse.down();await page.mouse.move(800+dx,450-dy,{steps:16});await page.mouse.up();}await page.mouse.move(0,0);await still();};
try{
await page.goto(`${INTEGRATION_BASE_URL}/thought-cavity/three/worlds/`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__orderedSpace?.snapshot().field?.modules===3);
await page.screenshot({path:output+'/compose-first-view.png'});
for(const state of ['inner','outer'])for(const [section,cell]of CAVITY_WORLDS.entries()){if(state==='outer')await page.getByRole('button',{name:'切换一个单元',exact:true}).click();const s=await page.evaluate(()=>window.__mathverse.snapshot()),dx=cell.center[0]-s.position[0],dy=cell.center[1]-s.position[1],dz=cell.center[2]-s.position[2];await aim(Math.atan2(dx,-dz),Math.atan2(dy,Math.hypot(dx,dz)));await page.screenshot({path:output+'/compose-'+cell.id+'-'+state+'.png'});}
console.log(JSON.stringify(await page.evaluate(()=>({modules:window.__orderedSpace.snapshot().field.modules,counts:window.__orderedSpace.snapshot().field.counts})),null,2));
}finally{await browser.close();}
