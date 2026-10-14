import { mathverseBrowserOptions } from '../../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import { fileURLToPath as integrationFileURLToPath } from 'node:url';
const INTEGRATION_PROJECT_ROOT = integrationFileURLToPath(new URL('../../../', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { PerspectiveCamera, Vector3 } from 'three';
import { CAVITY_WORLDS, cavityWorldPoint } from '../../../src/mathverse/experiments/fusion/cavityWorldModel.ts';
import { tracePoint } from '../../../src/mathverse/shared/math/eulerTraceModel.ts';
import { mobiusPoint, MOBIUS } from '../../../src/mathverse/shared/math/cellFigureModel.ts';
import { gaussianPoint } from '../../../src/mathverse/shared/math/gaussianFigureModel.ts';
const output=`${INTEGRATION_PROJECT_ROOT}/artifacts/spaces/fusion/thought-cavity-worlds`;await fs.mkdir(output+'/raw-video',{recursive:true});
const browser=await chromium.launch({...mathverseBrowserOptions(),headless:true}),context=await browser.newContext({viewport:{width:1600,height:900},recordVideo:{dir:output+'/raw-video',size:{width:1600,height:900}}}),page=await context.newPage(),video=page.video(),errors=[],checks={};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const snap=()=>page.evaluate(()=>window.__mathverse.snapshot()),field=()=>page.evaluate(()=>window.__orderedSpace.snapshot()),button=name=>page.getByRole('button',{name,exact:true}),save=name=>page.screenshot({path:output+'/'+name+'.png'});
const still=()=>page.waitForFunction(()=>{const s=window.__mathverse.snapshot();return s.yawVelocity===0&&s.pitchVelocity===0;});
const aim=async(yaw,pitch)=>{for(let i=0;i<14;i++){const s=await snap(),dx=Math.max(-480,Math.min(480,(yaw-s.targetYaw)*1600/Math.PI)),dy=Math.max(-270,Math.min(270,(pitch-s.targetPitch)*1600/Math.PI));if(Math.abs(dx)<1&&Math.abs(dy)<1)break;await page.mouse.move(800,450);await page.mouse.down();await page.mouse.move(800+dx,450-dy,{steps:16});await page.mouse.up();}await page.mouse.move(0,0);await still();};
const lookAt=async(section)=>{const s=await snap(),p=CAVITY_WORLDS[section].center,dx=p[0]-s.position[0],dy=p[1]-s.position[1],dz=p[2]-s.position[2];await aim(Math.atan2(dx,-dz),Math.atan2(dy,Math.hypot(dx,dz)));};
const close=async()=>{await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='closed');await still();};
const catalog=async(name)=>{await button('数学索引').click();await button('打开'+name).click();await page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='reading');};
const actualClick=async(id,section)=>{
  const s=await snap(),f=await field(),camera=new PerspectiveCamera(55,1600/900,.05,620);camera.position.fromArray(s.position);camera.quaternion.fromArray(s.quaternion);camera.updateMatrixWorld();
  const sources=id==='leonhard-euler'?[0,1,2].flatMap(p=>[0,-.4,.4,-.2,.2].flatMap(u=>[0,-.4,.4,-.2,.2].map(v=>tracePoint(p,u,v)))):id==='mobius-strip'?Array.from({length:96},(_,i)=>[-.8,0,.8].map(v=>mobiusPoint(i*Math.PI/48,v*MOBIUS.halfWidth))).flat():[0,.10,.20,.30,.40,.50,.60].flatMap(r=>Array.from({length:48},(_,i)=>gaussianPoint(r,i*Math.PI/24)));
  let occluded=0;
  for(const source of sources){const p=new Vector3(...cavityWorldPoint(section,[...source,-1],f.field.sections[section].angle)).project(camera);if(Math.abs(p.x)>.88||Math.abs(p.y)>.76||p.z>1)continue;
    const pixel=[(p.x+1)*800,(1-p.y)*450],before=(await snap()).picking.blocked;await page.mouse.move(...pixel);await page.waitForTimeout(55);const hovered=await snap();if(hovered.picking.blocked>before)occluded++;
    if(hovered.reading.hoveredId===id){await page.mouse.click(...pixel);await page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='reading');return {pixel,occluded};}
  }
  throw Error('Actual visible surface must open '+id);
};
try{
 await page.goto(`${INTEGRATION_BASE_URL}/thought-cavity/three/worlds/`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__orderedSpace?.snapshot().field?.modules===3);
 const initial=await field(),start=await snap();assert.equal(initial.volumes.length,4);assert.equal(initial.field.sourceRibs,21);assert.equal(initial.field.connectiveBridges,12);assert.equal(initial.field.staticBeams,601);assert.equal(initial.field.movingBeams,195);
 await save('first-view');await button('暂停旅程').click();await button('定格空间').click();
 for(const [section,name]of[[0,'euler-inner'],[1,'mobius-inner'],[2,'gaussian-inner']]){await lookAt(section);await save(name);}
 await lookAt(0);await button('让空间继续流动').click();await button('继续旅程').click();
 checks.events=[];checks.radiusRatios={};checks.realClicks={};
 for(let section=0;section<3;section++){
   if(section===0)await page.waitForFunction(()=>window.__orderedSpace.snapshot().rhythm.phase==='anticipation',null,{timeout:90000});
   else{await button('让空间继续流动').click();await button('继续旅程').click();await button('观看一次翻转').click();}
   await lookAt(section);await page.waitForFunction(id=>window.__orderedSpace.snapshot().field.sections[id].angle>1.1,section,{timeout:90000});await save(CAVITY_WORLDS[section].id+'-unfolding');
   const middle=await field();assert.equal(middle.rhythm.section,section);assert.equal(middle.rhythm.movingUnits,1);for(let id=0;id<3;id++)if(id!==section)assert.equal(middle.field.sections[id].angle,id<section?Math.PI:0);
   for(const a of middle.field.attachments)assert.deepEqual(a.a,middle.field.sections[a.section].points[a.vertex]);
   if(section===1){await button('暂停旅程').click();await button('定格空间').click();await page.waitForFunction(()=>window.__mathverse.snapshot().speed===0);await still();const frozen=await field(),pixels=await page.screenshot({clip:{x:220,y:120,width:1080,height:580}});await page.waitForTimeout(500);assert.equal((await field()).rhythm.clock,frozen.rhythm.clock);assert.ok(pixels.equals(await page.screenshot({clip:{x:220,y:120,width:1080,height:580}})));checks.freezePixels=true;await button('让空间继续流动').click();await button('继续旅程').click();}
   await page.waitForFunction(()=>window.__orderedSpace.snapshot().rhythm.phase==='stable',null,{timeout:90000});await button('暂停旅程').click();await button('定格空间').click();await page.waitForFunction(()=>window.__mathverse.snapshot().speed===0);await lookAt(section);await save(CAVITY_WORLDS[section].id+'-outer');
   const after=await field(),id=['unit-circle','mobius-strip','gaussian-integral'][section];assert.equal(after.field.sections[section].angle,Math.PI);assert.ok(after.field.minimumClearance>3.2);
   const ratio=after.volumes.find(v=>v.id===id).localBounds/initial.volumes.find(v=>v.id===id).localBounds;assert.ok(Math.abs(ratio-2.9/.9)<1e-5);checks.radiusRatios[id]=ratio;checks.events.push({section,angle:after.field.sections[section].angle,z:(await snap()).z});
   checks.realClicks[id]=await actualClick(section===0?'leonhard-euler':id,section);const read=await snap();assert.equal(read.reading.selectedId,section===0?'leonhard-euler':id);assert.ok(Math.abs(read.observation.area-.801)<1e-6);await page.waitForFunction(()=>Math.abs(window.__mathverse.snapshot().speed-.021)<1e-6);const slow=await snap();await page.waitForTimeout(250);assert.ok((await snap()).z<slow.z);await save(CAVITY_WORLDS[section].id+'-reading');
   if(section===0){for(const name of ['无穷与圆','城市与关系','指数与旋转']){await button('欧拉故事：'+name).click();await page.waitForTimeout(200);}await save('euler-story');}
   await close();assert.equal((await snap()).paused,true);
 }
 checks.continuousTravel=(await snap()).z<start.z-35;assert.equal(checks.continuousTravel,true);checks.staticReference=true;checks.sourceProjectionAndSharedAttachments=true;
 const names=['莱昂哈德·欧拉','莫比乌斯带','高斯积分'];for(const name of names){await catalog(name);await close();}const warm=await field();
 for(let i=0;i<6;i++){await catalog(names[i%3]);await close();}const repeated=await field();assert.equal(repeated.geometries,warm.geometries);assert.equal(repeated.textures,warm.textures);checks.resourcesStable=[warm.geometries,warm.textures];
 for(const [width,height]of[[1280,720],[1920,1080]]){await page.setViewportSize({width,height});await catalog('高斯积分');const rect=await page.getByTestId('reading-window').boundingBox();assert.ok(Math.abs(rect.width*rect.height/(width*height)-.801)<.001);await save('reading-'+width);await close();}checks.desktopReading=true;
 await page.setViewportSize({width:1600,height:900});await aim(Math.PI,.04);await save('back');
 await page.goto(`${INTEGRATION_BASE_URL}/thought-cavity/three/`);await button('推门进入').click();await page.waitForFunction(()=>window.__mathverse.snapshot().phase==='exploring');checks.archEntrance=true;
 await page.goto(`${INTEGRATION_BASE_URL}/thought-cavity/worlds/`);await page.waitForFunction(()=>window.__orderedSpace?.snapshot().field?.modules===1);assert.equal((await field()).field.sourceRibs,7);assert.equal((await field()).volumes.length,2);checks.previousEulerPreserved=true;
 const reduced=await browser.newContext({reducedMotion:'reduce',viewport:{width:1280,height:720}}),p=await reduced.newPage();await p.goto(`${INTEGRATION_BASE_URL}/thought-cavity/three/worlds/`);await p.waitForFunction(()=>window.__orderedSpace?.snapshot().field?.modules===3);assert.equal((await p.evaluate(()=>window.__mathverse.snapshot())).paused,true);
 for(let event=0;event<6;event++){await p.getByRole('button',{name:'切换一个单元',exact:true}).click();await p.waitForFunction(n=>window.__orderedSpace.snapshot().field.sections[n%3].angle===(n<3?Math.PI:0),event);const f=await p.evaluate(()=>window.__orderedSpace.snapshot());assert.equal(f.rhythm.phase,'stable');assert.equal(f.rhythm.section,event%3);for(const v of f.volumes)assert.equal(v.angle,f.field.sections[v.section].angle);assert.ok(f.field.minimumClearance>3.2);}await reduced.close();checks.reducedSixEventSequence=true;
 assert.deepEqual(errors,[]);await fs.writeFile(output+'/browser-verification.json',JSON.stringify({checkedAt:new Date().toISOString(),checks,initialCounts:initial.field.counts,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));await context.close();await video.saveAs(output+'/three-cavities-demo.webm');
}catch(e){await save('failure');console.log(JSON.stringify({errors,motion:await snap().catch(()=>null),field:await field().catch(()=>null)}));throw e;}finally{await browser.close();}
