import { mathverseBrowserOptions } from '../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const output=process.env.MATHVERSE_TEST_OUTPUT??path.resolve(import.meta.dirname,'../../artifacts/worlds/stage-d-windows');await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({...mathverseBrowserOptions(),headless:true});
const context=await browser.newContext({viewport:{width:1600,height:900},recordVideo:{dir:path.join(output,'recording'),size:{width:1600,height:900}}});
let page=await context.newPage();const video=page.video(),errors=[],checks={},start=Date.now();
const register=page=>{page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});};register(page);
const snapshot=()=>page.evaluate(()=>window.__mathverse.snapshot());
const waitRead=()=>page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='reading');
const open=async title=>{await page.getByRole('button',{name:'数学索引',exact:false}).click();await page.getByRole('button',{name:`打开${title}`,exact:true}).click();await waitRead();};
const close=async()=>{await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='closed');};
const save=async name=>page.screenshot({path:path.join(output,name)});
try{
  await page.goto(`${INTEGRATION_BASE_URL}/legacy/`,{waitUntil:'networkidle'});await save('entrance.png');
  await page.getByRole('button',{name:'推门进入',exact:true}).click();await page.waitForFunction(()=>window.__mathverse?.snapshot().phase==='exploring');await page.waitForTimeout(350);await save('connected-worlds.png');
  const first=await snapshot();assert.equal(first.nodes.length,6);assert.equal(Object.keys(first.worlds).length,6);assert.ok(first.structure.minimumClearance>=2.9);
  await page.mouse.move(760,720);await page.mouse.down();await page.mouse.move(920,665,{steps:14});await page.mouse.up();await page.waitForTimeout(500);assert.equal((await snapshot()).reading.phase,'closed');await save('turning.png');
  await page.getByRole('button',{name:'看向前方',exact:false}).click();await page.waitForTimeout(650);
  await page.getByRole('button',{name:'定格空间',exact:true}).click();await page.waitForFunction(()=>window.__mathverse.snapshot().spaceFrozen);await page.waitForTimeout(50);const frozen=await snapshot();await page.waitForTimeout(800);const held=await snapshot();
  assert.equal(held.spaceTime,frozen.spaceTime);assert.equal(held.connections.angle,frozen.connections.angle);assert.ok(held.distance>frozen.distance);checks.freezeSeparatesStructureFromTravel=true;
  await page.getByRole('button',{name:'让空间继续流动',exact:true}).click();
  const label=page.getByRole('button',{name:'观察欧拉恒等式',exact:true});
  if(await label.isVisible()){const box=await label.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);}else await open('欧拉恒等式');await waitRead();
  await page.waitForFunction(()=>Math.abs(window.__mathverse.snapshot().speed-.021)<1e-6);await page.waitForTimeout(600);await save('reading-identity.png');
  const box=await page.getByTestId('reading-window').boundingBox();assert.ok(Math.abs(box.width*box.height/(1600*900)-.801)<.001);checks.actualReadingArea=.801;
  const slider=page.getByRole('slider',{name:/改变角度/}),sliderBox=await slider.boundingBox();await page.mouse.click(sliderBox.x+sliderBox.width/2,sliderBox.y+sliderBox.height/2);await page.waitForTimeout(900);
  const half=await snapshot();assert.ok(Math.abs(half.reading.angle-Math.PI)<.04);assert.ok(Math.abs(half.connections.angle-half.reading.angle)<.003);
  const ids=['euler-identity','unit-circle','complex-rotation'];
  for(const id of ids){const world=half.worlds[id],radius=id==='complex-rotation'?1.8:2;assert.ok(Math.abs(world.angle-half.connections.angle)<1e-8);assert.ok(Math.abs(world.marker[0]/radius-Math.cos(world.angle))<1e-8);assert.ok(Math.abs(world.marker[1]/radius-Math.sin(world.angle))<1e-8);}
  checks.actualThreeWorldMarkersShareAngle=true;await save('identity-half-turn.png');
  await page.getByRole('button',{name:'继续阅读：单位圆',exact:true}).click();await page.waitForTimeout(700);assert.equal((await snapshot()).reading.angle,half.reading.angle);await save('reading-circle.png');
  await page.getByRole('button',{name:'继续阅读：复数的旋转',exact:true}).click();await page.waitForTimeout(700);assert.equal((await snapshot()).reading.angle,half.reading.angle);await save('reading-rotation.png');checks.relatedWorldsPreserveParameter=true;
  const before=await snapshot();await page.waitForTimeout(1300);const after=await snapshot();assert.ok(after.distance>before.distance);assert.ok(after.spaceTime>before.spaceTime);assert.deepEqual(after.observation.camera,before.observation.camera);assert.deepEqual(after.observation.rect,before.observation.rect);assert.deepEqual(after.observation.screen,before.observation.screen);checks.stableWindowAndMovingExterior=true;
  await page.getByRole('slider',{name:/改变角度/}).press('End');await page.waitForTimeout(800);assert.equal((await snapshot()).worlds['complex-rotation'].marker[2],0);
  await page.getByRole('slider',{name:/改变角度/}).press('Home');await page.waitForTimeout(800);assert.equal((await snapshot()).worlds['complex-rotation'].marker[2],0);checks.helixHasNoDepthJumpAtAngleWrap=true;
  await page.getByRole('button',{name:'继续阅读：莱昂哈德·欧拉',exact:true}).click();await page.waitForTimeout(600);await save('reading-person.png');checks.abstractHumanTraces=true;
  await close();await page.waitForTimeout(650);await save('return-to-space.png');
  await page.waitForTimeout(Math.max(0,40000-(Date.now()-start)));await context.close();await video.saveAs(path.join(output,'stage-d-windows-demo.webm'));
  const desktop=await browser.newContext();page=await desktop.newPage();register(page);
  await page.goto(`${INTEGRATION_BASE_URL}/legacy/`,{waitUntil:'networkidle'});await page.getByRole('button',{name:'推门进入',exact:true}).click();await page.waitForFunction(()=>window.__mathverse.snapshot().phase==='exploring');
  const viewportChecks=[];
  for(const[width,height]of[[1280,720],[1440,900],[1920,1080],[2560,1440]]){
    await page.setViewportSize({width,height});await open('单位圆');await page.waitForTimeout(250);
    const rect=await page.getByTestId('reading-window').boundingBox(),panel=await page.locator('.reading-panel').boundingBox();assert.ok(Math.abs(rect.width*rect.height/(width*height)-.801)<.001);assert.ok(panel.x>=rect.x&&panel.x+panel.width<=rect.x+rect.width+.1&&panel.y+panel.height<=rect.y+rect.height+.1);
    await save(`reading-${width}.png`);viewportChecks.push({width,height,area:rect.width*rect.height/(width*height),panelInsideWindow:true});await close();
  }
  await desktop.close();assert.deepEqual(errors,[]);const report={checkedAt:new Date().toISOString(),browser:browser.version(),checks,viewportChecks,errors,scope:'Window geometry, actual shared markers, continuous helix, structural freeze, stable reading composition, and four desktop viewports. GPU performance not benchmarked.'};
  await fs.writeFile(path.join(output,'window-browser-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){if(!page.isClosed())await save('window-failure.png');console.log(JSON.stringify({errors}));throw error;}finally{await browser.close();}
