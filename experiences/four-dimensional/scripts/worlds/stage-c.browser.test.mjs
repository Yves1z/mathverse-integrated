import { mathverseBrowserOptions } from '../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const output=process.env.MATHVERSE_TEST_OUTPUT??path.resolve(import.meta.dirname,'../../artifacts/worlds/stage-c');await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({...mathverseBrowserOptions(),headless:true});
const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[],checks={};
page.on('pageerror',error=>errors.push(error.message));page.on('console',event=>{if(event.type()==='error')errors.push(event.text());});
const snapshot=()=>page.evaluate(()=>window.__mathverse.snapshot());
const waitClosed=()=>page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='closed',null,{timeout:6000});
const waitReading=()=>page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='reading',null,{timeout:6000});
const close=async()=>{await page.getByRole('button',{name:'退出阅读',exact:true}).click();await waitClosed();};
const open=async(title)=>{await page.getByRole('button',{name:'数学索引',exact:false}).click();await page.getByRole('button',{name:`打开${title}`,exact:true}).click();await waitReading();};
const save=async(name)=>page.screenshot({path:path.join(output,name)});
try{
  await page.goto(`${INTEGRATION_BASE_URL}/legacy/`,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'推门进入',exact:true}).click();await page.waitForFunction(()=>window.__mathverse?.snapshot().phase==='exploring');
  await page.waitForTimeout(250);await save('discovery.png');
  assert.equal((await snapshot()).nodes.length,6);assert.ok((await snapshot()).nodes.filter(node=>node.emphasized).length<=3);checks.sixNodesAndEmphasisLimit=true;
  await page.getByRole('button',{name:'暂停旅程',exact:true}).click();await page.waitForFunction(()=>window.__mathverse.snapshot().speed===0);
  const first=(await snapshot()).nodes.find(node=>node.id==='euler-identity');const[x,y]=first.screen;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+45,y,{steps:8});await page.mouse.move(x,y,{steps:8});await page.mouse.up();
  assert.equal((await snapshot()).reading.phase,'closed');assert.equal((await snapshot()).picking.opened,0);checks.dragReturningToOriginDoesNotClick=true;
  await page.waitForTimeout(600);
  const clickNode=(await snapshot()).nodes.find(node=>node.id==='euler-identity');const[cx,cy]=clickNode.screen;
  const original=await snapshot();await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+3,cy+1);await page.mouse.up();await waitReading();
  assert.equal((await snapshot()).reading.selectedId,'euler-identity');assert.equal((await snapshot()).picking.opened,1);checks.nativeGeometryPickAndSmallGesture=true;
  await page.waitForFunction(()=>Math.abs(window.__mathverse.snapshot().speed-0.021)<0.000001);await save('reading-identity.png');
  const focused=await snapshot();assert.ok(focused.speed>0);assert.equal(focused.observation.depthTest,true);checks.nonzeroSixPercentSpeed=true;
  await page.mouse.move(300,420);await page.mouse.down();await page.mouse.move(700,250,{steps:12});await page.mouse.up();await page.waitForTimeout(250);
  assert.ok(Math.abs((await snapshot()).yaw-focused.yaw)<0.00001);checks.backgroundDragDisabledInReading=true;
  await page.locator('.reading-prose p').first().dblclick();assert.ok(await page.evaluate(()=>window.getSelection().toString().length>0));checks.textSelectable=true;
  await page.mouse.move(1330,590);await page.mouse.wheel(0,750);await page.waitForTimeout(150);assert.ok(await page.locator('.reading-scroll').evaluate(element=>element.scrollTop)>0);checks.panelScrollIndependent=true;
  await page.getByRole('button',{name:'继续阅读：单位圆',exact:true}).click();await page.waitForTimeout(250);
  const slider=page.getByRole('slider',{name:/改变角度/}),box=await slider.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.waitForTimeout(150);
  assert.ok(Math.abs((await snapshot()).reading.angle-Math.PI)<.04);assert.ok(Math.abs((await snapshot()).yaw-focused.yaw)<.00001);await save('reading-circle.png');checks.realGeometryAngleControl=true;
  await page.getByRole('button',{name:'继续阅读：复数的旋转',exact:true}).click();await page.waitForTimeout(150);assert.equal((await snapshot()).reading.selectedId,'complex-rotation');assert.ok(Math.abs((await snapshot()).reading.savedYaw-original.yaw)<.00002);await save('reading-relation.png');checks.relatedFormulaGeometryLoop=true;
  const exitZ=(await snapshot()).z;await page.keyboard.press('Escape');await waitClosed();await page.waitForFunction(()=>window.__mathverse.snapshot().speed===0);
  const returned=await snapshot();assert.ok(returned.z<exitZ);assert.ok(Math.abs(returned.yaw-original.yaw)<.00002);assert.ok(Math.abs(returned.pitch-original.pitch)<.00002);assert.equal(returned.paused,true);checks.escapeRestoreDirectionPositionAndPause=true;
  assert.ok(await page.getByRole('button',{name:'数学索引',exact:false}).evaluate(element=>document.activeElement===element));checks.focusReturnsToEntry=true;
  await page.getByRole('button',{name:'继续旅程',exact:true}).click();await page.waitForFunction(()=>window.__mathverse.snapshot().speed===0.35);
  await page.getByRole('button',{name:'数学索引',exact:false}).focus();await page.keyboard.press('Enter');
  assert.equal(await page.getByRole('dialog').getByRole('button',{name:/^打开/}).count(),6);await save('catalog.png');
  await page.keyboard.press('Shift+Tab');assert.ok(await page.getByRole('dialog').evaluate(element=>element.contains(document.activeElement)));await page.keyboard.press('Escape');checks.keyboardCatalogAndFocusTrap=true;
  const titles=['欧拉恒等式','高斯积分','单位圆','莫比乌斯带','莱昂哈德·欧拉','复数的旋转'];
  for(const title of titles){await open(title);await page.waitForTimeout(200);if(title==='高斯积分')await save('reading-gaussian.png');if(title==='莫比乌斯带')await save('reading-mobius.png');if(title==='莱昂哈德·欧拉')await save('reading-person.png');await close();}
  const warm=await snapshot();console.log('All six readers verified; beginning repeated open/close checks.');
  for(let i=0;i<20;i++){
    await page.getByRole('button',{name:'数学索引',exact:false}).click();await page.getByRole('button',{name:`打开${titles[i%6]}`,exact:true}).click();
    if(i%2===0)await page.waitForTimeout(90);else await waitReading();
    await close();
    assert.equal((await snapshot()).reading.selectedId,null);
  }
  const repeated=await snapshot();assert.ok(repeated.geometries<=warm.geometries+1);assert.equal(repeated.textures,warm.textures);checks.twentyCyclesAndSharedResources={before:{geometries:warm.geometries,textures:warm.textures},after:{geometries:repeated.geometries,textures:repeated.textures}};
  console.log('20 reading cycles passed. Beginning real 3-minute reading check.');
  await open('莫比乌斯带');await page.waitForFunction(()=>Math.abs(window.__mathverse.snapshot().speed-.021)<.000001);
  const surface=page.getByRole('slider',{name:/环顾曲面/});await surface.press('End');assert.ok(Math.abs((await snapshot()).reading.objectYaw-Math.PI)<.000001);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const hidden=await snapshot();await page.waitForTimeout(650);const held=await snapshot();assert.equal(held.distance,hidden.distance);assert.equal(held.spaceTime,hidden.spaceTime);assert.equal(held.reading.elapsed,hidden.reading.elapsed);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(500);assert.ok(Math.abs((await snapshot()).yaw-hidden.yaw)<.00001);checks.readingBlurResume=true;
  const start=await snapshot(),wallStart=Date.now();
  for(let i=0;i<6;i++){
    await page.waitForTimeout(30000);const sample=await snapshot();
    assert.equal(sample.reading.selectedId,'mobius-strip');assert.equal(sample.reading.phase,'reading');assert.ok(sample.speed>0);
    assert.ok(Math.abs(sample.observation.screen[0]-start.observation.screen[0])<.00001);assert.ok(Math.abs(sample.observation.screen[1]-start.observation.screen[1])<.00001);
    console.log(`Reading stability: ${(i+1)*30} seconds; distance advanced ${(sample.distance-start.distance).toFixed(3)}.`);
  }
  const end=await snapshot(),wallSeconds=(Date.now()-wallStart)/1000;assert.ok(end.distance>start.distance+2.5&&end.distance<start.distance+4.5);assert.equal(end.textures,start.textures);assert.ok(end.geometries<=start.geometries+1);await save('reading-mobius-long.png');
  checks.realThreeMinuteReading={wallSeconds,effectiveSeconds:end.reading.elapsed-start.reading.elapsed,distance:end.distance-start.distance,speed:end.speed,screenAnchor:end.observation.screen,geometries:end.geometries,textures:end.textures};
  const beforeExit=end.z;await close();assert.ok((await snapshot()).z<beforeExit);await page.waitForFunction(()=>window.__mathverse.snapshot().speed===0.35);checks.postLongReadResume=true;
  await page.setViewportSize({width:1280,height:720});await open('高斯积分');await save('reading-1280.png');const bounds=await page.locator('.reading-panel').boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=1280&&bounds.y+bounds.height<=720);await close();checks.desktop1280=true;
  assert.deepEqual(errors,[]);
  const report={checkedAt:new Date().toISOString(),browser:browser.version(),viewports:['1600×900','1280×720'],checks,errors,scope:'Real browser interaction, 20 repeated cycles, and a continuous 3-minute reading session; not a GPU frame-rate benchmark'};
  await fs.writeFile(path.join(output,'browser-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){await save('failure.png');console.log(JSON.stringify({errors,snapshot:await snapshot()}));throw error;}finally{await browser.close();}
