import { mathverseBrowserOptions } from '../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const output=path.resolve(import.meta.dirname,'../../artifacts/worlds/stage-d-light');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({...mathverseBrowserOptions(),headless:true});
const errors=[],checks={};let page;
const register=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});};
const snapshot=()=>page.evaluate(()=>window.__mathverse.snapshot());
const save=name=>page.screenshot({path:path.join(output,name)});
const enter=async()=>{
  await page.getByRole('button',{name:'推门进入',exact:true}).click();
  await page.waitForFunction(()=>window.__mathverse.snapshot().phase==='exploring');
};
const open=async title=>{
  await page.getByRole('button',{name:'数学索引',exact:false}).click();
  await page.getByRole('button',{name:`打开${title}`,exact:true}).click();
  await page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='reading');
};
const close=async()=>{await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='closed');};
try{
  const film=await browser.newContext({viewport:{width:1600,height:900},recordVideo:{dir:path.join(output,'recording'),size:{width:1600,height:900}}});
  page=await film.newPage();register(page);const video=page.video(),filmStart=Date.now();
  await page.goto(`${INTEGRATION_BASE_URL}/legacy/`,{waitUntil:'networkidle'});await save('entrance.png');
  assert.equal((await snapshot()).lighting.interior,0);
  await page.getByRole('button',{name:'推门进入',exact:true}).click();
  await page.waitForFunction(()=>window.__mathverse.snapshot().elapsed>1.5);await save('door-light.png');
  await page.waitForFunction(()=>window.__mathverse.snapshot().phase==='exploring');await page.waitForTimeout(500);await save('connected-worlds.png');
  const first=await snapshot();assert.equal(first.cinematic.HDR,true);assert.equal(first.cinematic.FXAA,true);
  assert.equal(first.atmosphere.dustCount,1440);assert.equal(first.connections.particles,96);assert.equal(first.cinematic.worldParticles,960);
  checks.fixedParticleBudget=2496;checks.HDRAndAntialias=true;
  await page.mouse.move(800,690);await page.mouse.down();await page.mouse.move(1030,625,{steps:18});await page.mouse.up();await page.waitForTimeout(600);await save('grazing-light.png');
  await page.getByRole('button',{name:'看向前方',exact:false}).click();await page.waitForTimeout(800);
  await page.getByRole('button',{name:'定格空间',exact:true}).click();await page.waitForTimeout(100);
  const frozen=await snapshot();await page.waitForTimeout(900);const held=await snapshot();
  assert.equal(held.atmosphere.time,frozen.atmosphere.time);assert.equal(held.lighting.time,frozen.lighting.time);assert.equal(held.connections.time,frozen.connections.time);assert.ok(held.distance>frozen.distance);
  checks.lightAndParticleClockFreezeWithStructure=true;
  await page.getByRole('button',{name:'让空间继续流动',exact:true}).click();
  await open('欧拉恒等式');
  const slider=page.getByRole('slider',{name:/改变角度/}),box=await slider.boundingBox();
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.waitForTimeout(950);await save('identity-half-turn.png');
  const reading=await snapshot();assert.ok(Math.abs(reading.connections.angle-Math.PI)<.035);
  await page.waitForTimeout(1200);const later=await snapshot();assert.deepEqual(later.observation.rect,reading.observation.rect);assert.deepEqual(later.observation.camera,reading.observation.camera);assert.ok(later.distance>reading.distance);checks.stableReadingWithAnimatedExterior=true;
  await page.getByRole('button',{name:'继续阅读：单位圆',exact:true}).click();await page.waitForTimeout(700);await save('reading-circle.png');
  await page.getByRole('button',{name:'继续阅读：复数的旋转',exact:true}).click();await page.waitForTimeout(700);await save('reading-rotation.png');await close();
  for(const[title,file]of[['高斯积分','reading-gaussian.png'],['莫比乌斯带','reading-mobius.png'],['莱昂哈德·欧拉','reading-person.png']]){
    await open(title);await page.waitForTimeout(900);await save(file);await close();
  }
  await page.waitForTimeout(1000);await save('return-to-space.png');
  await page.waitForTimeout(Math.max(0,44000-(Date.now()-filmStart)));
  checks.filmWallSeconds=(Date.now()-filmStart)/1000;
  await film.close();await video.saveAs(path.join(output,'stage-d-light-demo.webm'));
  console.log('Light film and all six worlds passed. Checking Bloom-free and high-density rendering.');

  const plain=await browser.newContext({viewport:{width:1600,height:900}});page=await plain.newPage();register(page);
  await page.goto(`${INTEGRATION_BASE_URL}/?bloom=off`,{waitUntil:'networkidle'});await enter();await page.waitForTimeout(600);
  assert.equal((await snapshot()).cinematic.enabled,false);await save('without-bloom.png');checks.bloomFreeSceneRendered=true;await plain.close();

  const desktop=await browser.newContext({deviceScaleFactor:2});page=await desktop.newPage();register(page);
  await page.goto(`${INTEGRATION_BASE_URL}/legacy/`,{waitUntil:'networkidle'});await enter();const viewports=[];
  for(const[width,height]of[[1280,720],[1440,900],[1920,1080]]){
    await page.setViewportSize({width,height});await open('单位圆');await page.waitForTimeout(600);
    const rect=await page.getByTestId('reading-window').boundingBox(),s=await snapshot();
    assert.ok(Math.abs(rect.width*rect.height/(width*height)-.801)<.001);
    assert.equal(s.cinematic.width,Math.round(width*1.5));assert.equal(s.cinematic.height,Math.round(height*1.5));
    await save(`reading-density-${width}.png`);viewports.push({width,height,deviceScaleFactor:2,renderRatio:1.5,area:s.observation.area});await close();
  }
  checks.highDensityViewports=viewports;await desktop.close();

  const walk=await browser.newContext({viewport:{width:1280,height:720}});page=await walk.newPage();register(page);
  await page.goto(`${INTEGRATION_BASE_URL}/legacy/`,{waitUntil:'networkidle'});await enter();await page.waitForTimeout(1000);
  const before=await snapshot(),walkStart=Date.now();
  while((await snapshot()).atmosphere.firstSection===before.atmosphere.firstSection){
    await page.waitForTimeout(15000);console.log(`Particle-section continuity: ${((Date.now()-walkStart)/1000).toFixed(1)} seconds.`);
    assert.ok(Date.now()-walkStart<105000,'normal-speed travel reaches the next particle section');
  }
  await page.waitForTimeout(600);const after=await snapshot();await save('next-particle-section.png');
  assert.equal(after.atmosphere.dustCount,before.atmosphere.dustCount);assert.equal(after.atmosphere.curtains,before.atmosphere.curtains);
  assert.equal(after.textures,before.textures);assert.ok(after.geometries<=before.geometries+3);
  checks.realParticleSectionAdvance={wallSeconds:(Date.now()-walkStart)/1000,distance:after.distance,startSection:before.atmosphere.firstSection,endSection:after.atmosphere.firstSection,before:{geometries:before.geometries,textures:before.textures},after:{geometries:after.geometries,textures:after.textures}};
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const suspended=await snapshot();await page.waitForTimeout(650);const suspendedLater=await snapshot();
  assert.equal(suspendedLater.atmosphere.time,suspended.atmosphere.time);assert.equal(suspendedLater.distance,suspended.distance);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(650);assert.ok((await snapshot()).atmosphere.time>suspended.atmosphere.time);checks.lightClockSuspendAndResume=true;
  await walk.close();assert.deepEqual(errors,[]);
  const report={checkedAt:new Date().toISOString(),browser:browser.version(),checks,errors,scope:'Real browser rendering, HDR/FXAA, six worlds, structural freeze, stable reading, Bloom-free render, high-density desktops, one live particle-section transition, and blur recovery. Not a hardware GPU benchmark or ten-minute delivery audit.'};
  await fs.writeFile(path.join(output,'light-browser-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){if(page&&!page.isClosed())await save('light-failure.png');console.log(JSON.stringify({errors}));throw error;}finally{await browser.close();}
