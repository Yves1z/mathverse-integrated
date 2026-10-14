import { mathverseBrowserOptions } from '../../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { CAVITY_WORLDS } from '../../../src/mathverse/experiments/fusion/cavityWorldModel.ts';
const output=`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/fusion/thought-cavity-worlds`,browser=await chromium.launch({...mathverseBrowserOptions(),headless:true}),page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const snap=()=>page.evaluate(()=>window.__mathverse.snapshot());
try{
await page.goto(`${INTEGRATION_BASE_URL}/thought-cavity/three/worlds/`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__orderedSpace?.snapshot().field?.modules===3);await page.getByRole('button',{name:'定格空间',exact:true}).click();
// Keep the source cells inside while real camera travel reveals the lower cavity through parallax.
await page.waitForFunction(()=>window.__mathverse.snapshot().z<-25,null,{timeout:100000});await page.getByRole('button',{name:'暂停旅程',exact:true}).click();await page.waitForFunction(()=>window.__mathverse.snapshot().speed===0);
for(const section of [1,2]){const cell=CAVITY_WORLDS[section],s=await snap(),yaw=Math.atan2(cell.center[0]-s.position[0],s.position[2]-cell.center[2]),pitch=Math.atan2(cell.center[1]-s.position[1],Math.hypot(cell.center[0]-s.position[0],cell.center[2]-s.position[2]));
for(let i=0;i<14;i++){const pose=await snap(),dx=Math.max(-480,Math.min(480,(yaw-pose.targetYaw)*1600/Math.PI)),dy=Math.max(-270,Math.min(270,(pitch-pose.targetPitch)*1600/Math.PI));if(Math.abs(dx)<1&&Math.abs(dy)<1)break;await page.mouse.move(800,450);await page.mouse.down();await page.mouse.move(800+dx,450-dy,{steps:16});await page.mouse.up();}await page.mouse.move(0,0);await page.waitForFunction(()=>{const s=window.__mathverse.snapshot();return s.yawVelocity===0&&s.pitchVelocity===0;});
await page.screenshot({path:output+'/'+cell.id+'-discovered.png'});}
const field=await page.evaluate(()=>window.__orderedSpace.snapshot());assert.ok(field.field.sections.every(s=>s.angle===0));assert.deepEqual(errors,[]);const report={checkedAt:new Date().toISOString(),position:(await snap()).position,angles:field.field.sections.map(s=>s.angle),realForwardParallax:true,errors};await fs.writeFile(output+'/discovery-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
