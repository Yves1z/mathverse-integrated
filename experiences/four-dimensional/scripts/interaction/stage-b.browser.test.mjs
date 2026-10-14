import { mathverseBrowserOptions } from '../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root=path.resolve(import.meta.dirname,'../..'),output=path.join(root,'artifacts','stage-b');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({...mathverseBrowserOptions(),headless:true});
const errors=[],checks={};
const observe=page=>{
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',event=>{if(event.type()==='error')errors.push(event.text());});
};
const snapshot=page=>page.evaluate(()=>window.__mathverse.snapshot());
const drag=async(page,x1,y1,x2,y2,seconds=0.7)=>{
  await page.mouse.move(x1,y1);await page.mouse.down();
  for(let i=1;i<=24;i++) {
    await page.mouse.move(x1+(x2-x1)*i/24,y1+(y2-y1)*i/24);
    await page.waitForTimeout(seconds*1000/24);
  }
  await page.mouse.up();
};
let context;
try {
  context=await browser.newContext({viewport:{width:1920,height:1080}});
  const page=await context.newPage();observe(page);
  await page.goto(`${INTEGRATION_BASE_URL}/`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__mathverse?.snapshot().phase==='idle');
  await page.screenshot({path:path.join(output,'entrance.png')});
  await page.evaluate(()=>{
    window.__bFrames=[];
    const sample=()=>{
      const s=window.__mathverse?.snapshot();
      if(s&&window.__bFrames.length<9000)window.__bFrames.push({phase:s.phase,z:s.z,yaw:s.yaw,pitch:s.pitch,speed:s.speed,frameDt:s.frameDt,doorAngle:s.doorAngle,clearance:s.doorPanelClearance,quaternion:s.quaternion});
      window.__bFrameId=requestAnimationFrame(sample);
    };window.__bFrameId=requestAnimationFrame(sample);
    window.dispatchEvent(new Event('blur'));
  });
  await page.getByRole('button',{name:'推门进入',exact:true}).click();
  await page.waitForFunction(()=>window.__mathverse.snapshot().elapsed>=1.8);
  assert.ok((await snapshot(page)).doorAngle>1);
  await page.screenshot({path:path.join(output,'door-opening.png')});
  await page.waitForFunction(()=>window.__mathverse.snapshot().phase==='exploring',null,{timeout:25000});
  const arrived=await snapshot(page);
  assert.ok(Math.abs(arrived.speed-0.35)<0.00001);
  assert.ok(Math.abs(arrived.pitch)<0.00001);
  checks.entrySpeedContinuity=true;
  await page.waitForTimeout(400);const before=await snapshot(page);
  await page.waitForTimeout(650);const after=await snapshot(page);
  assert.ok(after.distance>before.distance+0.10);checks.continuousTravel=true;

  await page.getByRole('button',{name:'暂停旅程',exact:true}).click();
  const braking=await snapshot(page);
  assert.ok(braking.speed>0&&braking.speed<=0.35);
  await page.waitForFunction(()=>window.__mathverse.snapshot().speed===0,null,{timeout:5000});
  const parked=await snapshot(page);await page.waitForTimeout(250);
  const still=await snapshot(page);assert.equal(still.distance,parked.distance);
  assert.ok(still.spaceTime>parked.spaceTime);checks.smoothPauseAndIndependentWorld=true;
  await page.screenshot({path:path.join(output,'interior-forward.png')});

  // Use empty canvas: a short gesture over a math node now intentionally opens reading.
  await page.mouse.move(700,120);await page.mouse.down();await page.mouse.move(704,122);
  assert.equal((await snapshot(page)).dragging,false);await page.mouse.up();
  assert.equal((await snapshot(page)).targetYaw,parked.targetYaw);checks.sixPixelGestureThreshold=true;
  await drag(page,450,500,1250,500,0.65);await page.waitForTimeout(450);
  const side=await snapshot(page);assert.ok(side.yaw>1);assert.equal(side.distance,parked.distance);
  await page.screenshot({path:path.join(output,'interior-side.png')});
  await page.waitForTimeout(350);assert.ok(Math.abs((await snapshot(page)).yaw-side.yaw)<0.004);checks.noAutoCenter=true;

  for(let i=0;i<3;i++)await drag(page,800,650,800,50,0.18);
  await page.waitForTimeout(450);const top=await snapshot(page);
  assert.ok(top.pitch<=Math.PI*55/180+0.000001&&top.targetPitch<=Math.PI*55/180);
  await drag(page,800,150,800,230,0.2);const reversed=await snapshot(page);
  assert.ok(reversed.targetPitch<top.targetPitch-0.10);checks.softPitchBoundaryAndReverse=true;
  await page.getByRole('button',{name:'看向前方',exact:true}).click();
  await page.waitForFunction(()=>Math.abs(window.__mathverse.snapshot().pitch)<0.001&&window.__mathverse.snapshot().direction[2]<-0.999);

  for(let i=0;i<3;i++)await drag(page,450,500,1250,500,0.40);
  await page.waitForTimeout(500);const back=await snapshot(page);
  assert.ok(back.yaw>Math.PI&&back.direction[2]>0.5);checks.continuous180DegreeCrossing=true;
  await page.screenshot({path:path.join(output,'interior-back.png')});
  await page.getByRole('button',{name:'看向前方',exact:true}).click();
  const returning=await snapshot(page);assert.ok(Math.abs(returning.targetYaw-back.yaw)<=Math.PI+0.05);
  await page.waitForFunction(()=>window.__mathverse.snapshot().direction[2]<-0.999,null,{timeout:5000});checks.shortestForwardReturn=true;

  await page.mouse.move(500,500);await page.mouse.down();await page.mouse.move(900,500,{steps:2});
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  const suspended=await snapshot(page);assert.equal(suspended.dragging,false);assert.equal(suspended.suspended,true);
  await page.waitForTimeout(650);const held=await snapshot(page);
  assert.equal(held.distance,suspended.distance);assert.equal(held.yaw,suspended.yaw);assert.equal(held.spaceTime,suspended.spaceTime);
  await page.mouse.up();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(100);const recovered=await snapshot(page);
  assert.ok(Math.abs(recovered.yaw-held.yaw)<0.00001);checks.blurCancelsDragAndResumesWithoutJump=true;

  await page.getByRole('button',{name:'继续旅程',exact:true}).click();
  await page.waitForTimeout(200);const accelerating=await snapshot(page);
  assert.ok(accelerating.speed>0&&accelerating.speed<0.35);
  await page.waitForFunction(()=>window.__mathverse.snapshot().speed===0.35,null,{timeout:5000});checks.smoothResume=true;
  await page.getByRole('button',{name:'定格空间',exact:true}).click();
  await page.waitForTimeout(100);const frozen=await snapshot(page);await page.waitForTimeout(250);
  assert.equal((await snapshot(page)).spaceTime,frozen.spaceTime);checks.freezeWorld=true;

  const frames=await page.evaluate(()=>{cancelAnimationFrame(window.__bFrameId);return window.__bFrames;});
  const minimumDoorClearance=Math.min(...frames.map(f=>f.clearance));assert.ok(minimumDoorClearance>0.1);
  const crossing=frames.filter(f=>Math.abs(f.z)<0.25);assert.ok(crossing.length>0);
  assert.ok(crossing.every(f=>f.doorAngle>Math.PI*85/180));
  const maximumPitch=Math.max(...frames.map(f=>Math.abs(f.pitch)));assert.ok(maximumPitch<=Math.PI*55/180+0.000001);
  const maximumRollError=Math.max(...frames.map(f=>Math.abs(2*(f.quaternion[0]*f.quaternion[1]+f.quaternion[3]*f.quaternion[2]))));
  assert.ok(maximumRollError<1e-8);checks.noCameraRoll=true;
  checks.doorClearance={minimum:minimumDoorClearance,crossingSamples:crossing.length};
  checks.maximumPitchDegrees=maximumPitch*180/Math.PI;
  await page.setViewportSize({width:1280,height:720});
  assert.ok(await page.getByRole('button',{name:'暂停旅程',exact:true}).isVisible());
  await page.screenshot({path:path.join(output,'desktop-1280.png')});checks.desktopSizes=true;
  await context.close();context=null;

  context=await browser.newContext({viewport:{width:1600,height:900},recordVideo:{dir:path.join(output,'recording'),size:{width:1600,height:900}}});
  const film=await context.newPage();observe(film);const video=film.video(),started=Date.now();
  await film.goto(`${INTEGRATION_BASE_URL}/`,{waitUntil:'networkidle'});
  await film.waitForTimeout(1100);
  await film.getByRole('button',{name:'推门进入',exact:true}).click();
  await film.waitForFunction(()=>window.__mathverse.snapshot().phase==='exploring',null,{timeout:25000});
  await film.waitForTimeout(700);
  await drag(film,1050,470,600,470,0.9);await film.waitForTimeout(750);
  await drag(film,500,470,1500,470,0.9);
  await drag(film,500,470,1500,470,0.9);await film.waitForTimeout(1100);
  await film.getByRole('button',{name:'看向前方',exact:true}).click();await film.waitForTimeout(1100);
  await drag(film,800,600,800,250,0.75);await film.waitForTimeout(750);
  await film.getByRole('button',{name:'看向前方',exact:true}).click();await film.waitForTimeout(1000);
  await film.getByRole('button',{name:'暂停旅程',exact:true}).click();await film.waitForTimeout(1400);
  await film.getByRole('button',{name:'定格空间',exact:true}).click();await film.waitForTimeout(850);
  await film.getByRole('button',{name:'让空间继续流动',exact:true}).click();
  await film.getByRole('button',{name:'继续旅程',exact:true}).click();
  await film.waitForTimeout(Math.max(0,26000-(Date.now()-started)));
  const videoWallSeconds=(Date.now()-started)/1000;
  await context.close();context=null;
  await video.saveAs(path.join(output,'stage-b-demo.webm'));
  assert.deepEqual(errors,[]);
  const report={checkedAt:new Date().toISOString(),browser:browser.version(),viewports:['1920×1080','1280×720'],checks,errors,video:'stage-b-demo.webm',videoViewport:'1600×900',videoWallSeconds,scope:'Browser motion/interaction checks and continuous demonstration; not a full GPU benchmark'};
  await fs.writeFile(path.join(output,'browser-verification.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {if(context)await context.close();await browser.close();}
