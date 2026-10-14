import { mathverseBrowserOptions } from '../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {PerspectiveCamera,Vector3} from 'three';
import {chromium} from 'playwright';
import {MOTION} from '../../src/mathverse/config/motion.ts';
import {RELATION,RELATION_IDS,RELATION_PITCH,relationPose,relationSeams,relationLocalPoint,relationArcSegments,circleOwner,rotateRelation4,foldedRelationPose,relationVoidAt,relationEdgeVoid} from '../../src/mathverse/windows/relationship.ts';

const camera=new PerspectiveCamera(55,1600/900,.05,180);camera.position.set(0,MOTION.eyeHeight,RELATION.eyeZ);camera.rotation.x=RELATION_PITCH;camera.updateMatrixWorld();
const project=(index,angle,xw=0,zw=0,cam=camera)=>{
  const pose=relationPose(index),center=new Vector3(),ratio=foldedRelationPose(index,xw,zw,center);
  return relationLocalPoint(index,angle,new Vector3()).multiply(new Vector3(...pose.scale).multiplyScalar(ratio)).add(center).project(cam);
};
const screenDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
let mathematicalError=0;
for(const seam of relationSeams())mathematicalError=Math.max(mathematicalError,screenDistance(project(seam.ids[0],seam.angle),project(seam.ids[1],seam.angle)));
assert.ok(mathematicalError<1e-12);
for(let i=0;i<100;i++){
  const point=[Math.sin(i)*8,Math.cos(i)*4,i/7-5,i/10-3],rotated=rotateRelation4(point,i/70,-i/90);
  assert.ok(Math.abs(point.reduce((s,v)=>s+v*v,0)-rotated.reduce((s,v)=>s+v*v,0))<1e-10);
  const angle=i*Math.PI*2/100,owner=circleOwner(angle);assert.ok(owner>=0&&owner<=2);
}
for(let i=0;i<3;i++){
  const positions=relationArcSegments(i);assert.ok(positions.length>0&&positions.every(Number.isFinite));
  for(let v=0;v<positions.length;v+=3){const x=positions[v]*(2.1/6.2)+(i-1)*2.1,y=positions[v+1]*(6.8/4);assert.ok(Math.abs(x*x+y*y-RELATION.radius**2)<1e-10);}
}
assert.equal(relationVoidAt({x:0,y:6.3,z:-26}),0);assert.equal(relationVoidAt({x:0,y:6.3,z:-42}),1);
assert.equal(relationEdgeVoid({x:-8,y:6.3,z:-26},{x:8,y:6.3,z:-26}),0);
const rotatedCamera=camera.clone();rotatedCamera.rotation.y=.25;rotatedCamera.updateMatrixWorld();
for(const seam of relationSeams())assert.ok(screenDistance(project(seam.ids[0],seam.angle,0,0,rotatedCamera),project(seam.ids[1],seam.angle,0,0,rotatedCamera))<1e-12);
assert.ok(screenDistance(project(0,relationSeams()[1].angle,.25,0),project(1,relationSeams()[1].angle,.25,0))>.05);
console.log('Ray correspondence, unit-circle fragments, 4D norm preservation and intentional view-driven separation passed.');

const output=path.resolve(import.meta.dirname,'../../artifacts/worlds/stage-d-alignment');await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({...mathverseBrowserOptions(),headless:true}),errors=[],checks={mathematicalError};
const context=await browser.newContext({viewport:{width:1600,height:900},recordVideo:{dir:path.join(output,'recording'),size:{width:1600,height:900}}});
const page=await context.newPage(),video=page.video();page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
const snap=()=>page.evaluate(()=>window.__mathverse.snapshot());
const save=name=>page.screenshot({path:path.join(output,name+'.png')});
const turn=async(dx,dy=0)=>{await page.mouse.move(350,750);await page.mouse.down();await page.mouse.move(350+dx,750-dy,{steps:22});await page.mouse.up();await page.mouse.move(0,0);await page.waitForTimeout(1400);};
const open=async title=>{await page.getByRole('button',{name:/数学索引/}).click();await page.getByRole('button',{name:'打开'+title,exact:true}).click();await page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='reading');};
const close=async()=>{await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='closed');};
try{
  await page.goto(`${INTEGRATION_BASE_URL}/legacy/`,{waitUntil:'networkidle'});await save('entrance');
  await page.getByRole('button',{name:'推门进入',exact:true}).click();await page.waitForFunction(()=>window.__mathverse.snapshot().phase==='exploring');await save('first-reveal');
  await turn(0,RELATION_PITCH*1600/Math.PI);
  await page.waitForFunction(()=>window.__mathverse.snapshot().z<-9.94,null,{timeout:90000});await page.getByRole('button',{name:'暂停旅程',exact:true}).click();await page.waitForTimeout(1700);
  const aligned=await snap();assert.ok(aligned.relation.seamPixels<1);assert.ok(aligned.relation.coherence>.98);assert.equal(aligned.relation.available,true);checks.realSeamPixels=aligned.relation.seamPixels;checks.alignedCamera=aligned.position;await save('aligned-worlds');
  for(const id of RELATION_IDS){const n=aligned.nodes.find(n=>n.id===id);assert.ok(n.emphasized&&!n.occluded);}
  await turn(160);const separated=await snap();assert.ok(separated.relation.seamPixels>40);assert.equal(separated.z,aligned.z);assert.equal(separated.position[0],0);assert.equal(separated.position[1],MOTION.eyeHeight);checks.separatedSeamPixels=separated.relation.seamPixels;await save('unfolded-worlds');
  await turn(-160);assert.ok((await snap()).relation.seamPixels<1);await save('rediscovered-circle');
  await page.getByRole('button',{name:'定格空间',exact:true}).click();const frozen=await snap();await turn(80);const frozenTurn=await snap();assert.deepEqual(frozenTurn.relation.positions,frozen.relation.positions);assert.equal(frozenTurn.spaceTime,frozen.spaceTime);checks.freezePreservesAnchors=true;
  await page.getByRole('button',{name:'让空间继续流动',exact:true}).click();await page.waitForTimeout(1200);await turn(-80);
  const viewportChecks=[];
  for(const[width,height]of[[1280,720],[1440,900],[1920,1080]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(300);const s=await snap();assert.ok(s.relation.seamPixels<1.3);assert.ok(s.relation.available);await save('alignment-'+width);viewportChecks.push({width,height,seamPixels:s.relation.seamPixels});
  }checks.viewports=viewportChecks;await page.setViewportSize({width:1600,height:900});
  const label=page.getByRole('button',{name:'观察单位圆',exact:true});await label.click();await page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='reading');await page.waitForTimeout(700);
  const reading=await snap();assert.equal(reading.reading.selectedId,'unit-circle');assert.ok(Math.abs(reading.observation.area-.801)<.001);await save('reading-circle');
  await page.getByRole('slider',{name:/改变角度/}).focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');await page.waitForTimeout(700);
  const parameter=await snap();for(const id of RELATION_IDS)assert.equal(parameter.worlds[id].angle,parameter.connections.angle);
  await page.getByRole('button',{name:'继续阅读：复数的旋转',exact:true}).click();await page.waitForTimeout(600);await save('reading-rotation');
  const stable=await snap();await page.waitForTimeout(1800);const later=await snap();assert.deepEqual(later.observation.camera,stable.observation.camera);assert.deepEqual(later.observation.rect,stable.observation.rect);assert.ok(later.distance>stable.distance);assert.equal(later.speedScale,.06);checks.readingContinuesAndRemainsStable=true;
  await close();assert.equal((await snap()).paused,true);await page.waitForTimeout(900);await save('return-to-relationship');
  // Warm all Euler chapters and the Möbius geometry before measuring repeated openings.
  await open('莱昂哈德·欧拉');await page.getByRole('button',{name:'欧拉故事：城市与关系',exact:true}).click();await page.waitForTimeout(1400);await page.getByRole('button',{name:'欧拉故事：指数与旋转',exact:true}).click();await page.waitForTimeout(1400);await close();
  await open('莫比乌斯带');await close();const baseline=await snap();
  for(let i=0;i<20;i++){await open(i%2?'单位圆':'欧拉恒等式');await close();}
  const final=await snap();assert.equal(final.geometries,baseline.geometries);assert.equal(final.textures,baseline.textures);checks.repeated20={before:{geometries:baseline.geometries,textures:baseline.textures},after:{geometries:final.geometries,textures:final.textures}};
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const blurred=await snap();await page.waitForTimeout(500);const held=await snap();assert.equal(held.z,blurred.z);assert.deepEqual(held.relation.positions,blurred.relation.positions);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));checks.blurFreezesRelation=true;
  assert.deepEqual(errors,[]);await context.close();await video.saveAs(path.join(output,'alignment-validation.webm'));
  const result={checkedAt:new Date().toISOString(),browser:browser.version(),checks,errors,scope:'Actual mouse discovery, 4D anchor projection, four seams, 3 desktop sizes, shared angle, stable 80% reading, freeze/blur and 20 resource cycles. GPU and ten-minute performance are not benchmarked.'};await fs.writeFile(path.join(output,'alignment-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){if(!page.isClosed())await save('alignment-failure');throw error;}finally{await browser.close();}
