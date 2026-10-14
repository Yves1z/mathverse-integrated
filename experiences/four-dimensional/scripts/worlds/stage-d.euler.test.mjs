import { mathverseBrowserOptions } from '../environment/browser-options.mjs';
const INTEGRATION_BASE_URL = process.env.MATHVERSE_BASE_URL || 'http://127.0.0.1:5184';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {advanceEulerStory,bridgeDegrees,BRIDGE_EDGES,BRIDGE_NODES,bridgePoint,createEulerStory,partialBasel,seriesSquare} from '../../src/mathverse/content/eulerStory.ts';

assert.deepEqual(bridgeDegrees(),[5,3,3,3]);assert.equal(BRIDGE_EDGES.length,7);
for(let edge=0;edge<7;edge++){
  assert.deepEqual(bridgePoint(edge,0,[0,0,0]),BRIDGE_NODES[BRIDGE_EDGES[edge][0]]);
  assert.deepEqual(bridgePoint(edge,1,[0,0,0]),BRIDGE_NODES[BRIDGE_EDGES[edge][1]]);
}
for(let n=1;n<=48;n++)assert.ok(Math.abs((seriesSquare(n).side/2.7)**2-1/(n*n))<1e-12);
for(let n=4;n<=48;n++)assert.ok(partialBasel(n)<Math.PI**2/6&&partialBasel(n+1)>partialBasel(n));
const interrupted=createEulerStory();advanceEulerStory(interrupted,0);interrupted.chapter=2;
for(let i=1;i<20;i++)advanceEulerStory(interrupted,i/60);
const weights=[...interrupted.weights];interrupted.chapter=1;advanceEulerStory(interrupted,19/60);
assert.deepEqual(interrupted.weights,weights);advanceEulerStory(interrupted,20/60);
assert.ok(interrupted.weights.every((value,i)=>Math.abs(value-weights[i])<.08));
assert.ok(Math.abs(interrupted.weights.reduce((a,b)=>a+b,0)-1)<1e-12);
console.log('Euler mathematics and interruption continuity passed.');

const output=process.env.MATHVERSE_TEST_OUTPUT??path.resolve(import.meta.dirname,'../../artifacts/worlds/stage-d-euler');await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({...mathverseBrowserOptions(),headless:true});const errors=[],checks={math:true};let page;
const register=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});};
const snapshot=()=>page.evaluate(()=>window.__mathverse.snapshot());
const save=name=>page.screenshot({path:path.join(output,name)});
const enter=async()=>{await page.getByRole('button',{name:'推门进入',exact:true}).click();await page.waitForFunction(()=>window.__mathverse.snapshot().phase==='exploring');};
const open=async()=>{await page.getByRole('button',{name:/数学索引/}).click();await page.getByRole('button',{name:'打开莱昂哈德·欧拉',exact:true}).click();await page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='reading');};
const settle=async chapter=>{await page.waitForFunction(c=>window.__mathverse.snapshot().euler.weights[c]>.985,chapter);};
const close=async()=>{await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__mathverse.snapshot().reading.phase==='closed');};
const chapter=async(name,index)=>{await page.getByRole('button',{name:`欧拉故事：${name}`,exact:true}).click();await settle(index);};
try{
  const film=await browser.newContext({viewport:{width:1600,height:900},recordVideo:{dir:path.join(output,'recording'),size:{width:1600,height:900}}});
  page=await film.newPage();register(page);const video=page.video();
  await page.goto(`${INTEGRATION_BASE_URL}/legacy/`,{waitUntil:'networkidle'});await enter();await open();
  await page.waitForTimeout(1200);await save('euler-series.png');
  const original=await snapshot();assert.equal(original.euler.terms,24);assert.equal(original.euler.chapter,0);
  await page.getByRole('slider',{name:'展开级数项数',exact:true}).focus();await page.keyboard.press('End');
  assert.equal((await snapshot()).euler.terms,48);await page.waitForTimeout(750);await save('euler-series-48.png');
  await page.getByRole('button',{name:'欧拉故事：城市与关系',exact:true}).click();await page.waitForTimeout(200);await save('thought-transition.png');await settle(1);await save('euler-bridges.png');
  await page.getByRole('button',{name:'剥离地形',exact:true}).click();await page.waitForFunction(()=>window.__mathverse.snapshot().euler.abstraction>.985);await save('euler-connections.png');
  assert.equal(await page.getByRole('button',{name:'剥离地形'}).getAttribute('aria-pressed'),'true');checks.sevenBridgesAndLandRemoval=true;
  await chapter('指数与旋转',2);
  const slider=page.getByRole('slider',{name:'欧拉故事中的旋转角度',exact:true});await slider.focus();await page.keyboard.press('Home');
  for(let i=0;i<180;i++)await page.keyboard.press('ArrowRight');await page.waitForTimeout(750);await save('euler-rotation.png');
  await page.waitForFunction(()=>Math.abs(window.__mathverse.snapshot().connections.angle-Math.PI)<.0001);
  const angle=(await snapshot()).reading.angle;assert.equal(angle,Math.PI);
  await page.getByRole('button',{name:'继续阅读：欧拉恒等式',exact:true}).click();await page.waitForTimeout(600);await save('euler-identity-connection.png');
  assert.equal((await snapshot()).reading.angle,angle);assert.ok(Math.abs((await snapshot()).connections.angle-angle)<.0001);
  await page.getByRole('button',{name:'继续阅读：莱昂哈德·欧拉',exact:true}).click();await page.waitForTimeout(600);
  assert.equal((await snapshot()).euler.chapter,2);assert.equal((await snapshot()).reading.angle,angle);checks.sharedAngleAndReturnToChapter=true;
  await page.getByRole('button',{name:'欧拉故事：无穷与圆',exact:true}).click();await page.waitForTimeout(130);
  await page.getByRole('button',{name:'欧拉故事：城市与关系',exact:true}).click();await page.waitForTimeout(130);
  await page.getByRole('button',{name:'欧拉故事：指数与旋转',exact:true}).click();await settle(2);checks.rapidReversibleChapters=true;
  await page.locator('.reading-scroll').evaluate(element=>element.scrollTop=element.scrollHeight);await save('euler-human-trace.png');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('[data-testid="reading-dialog"]')),true);
  checks.keyboardNavigation=true;
  const before=await snapshot(),start=Date.now();await page.waitForTimeout(30000);const after=await snapshot();
  assert.deepEqual(after.observation.rect,before.observation.rect);assert.deepEqual(after.observation.camera,before.observation.camera);
  assert.equal(after.euler.chapter,2);assert.ok(after.distance>before.distance);assert.equal(after.speedScale,.06);
  checks.stableEulerReading={wallSeconds:(Date.now()-start)/1000,distance:after.distance-before.distance,area:after.observation.area};
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const frozen=await snapshot();await page.waitForTimeout(450);assert.deepEqual((await snapshot()).euler.weights,frozen.euler.weights);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));checks.blurClock=true;
  await close();await save('return-to-world.png');await film.close();await video.saveAs(path.join(output,'stage-d-euler-demo.webm'));
  console.log('Euler film, all chapters and stable reading passed. Checking repeated opens and desktop layout.');
  const audit=await browser.newContext({viewport:{width:1280,height:720}});page=await audit.newPage();register(page);
  await page.goto(`${INTEGRATION_BASE_URL}/legacy/`,{waitUntil:'networkidle'});await enter();await open();
  // Warm every scene before measuring growth: Three uploads the helix on its first visible render.
  await chapter('城市与关系',1);await chapter('指数与旋转',2);await chapter('无穷与圆',0);await chapter('城市与关系',1);
  const baseline=await snapshot();await close();
  for(let i=0;i<20;i++){
    await open();await page.getByRole('button',{name:`欧拉故事：${['无穷与圆','城市与关系','指数与旋转'][i%3]}`,exact:true}).click();await close();
  }
  await open();await chapter('城市与关系',1);const repeated=await snapshot();
  assert.equal(repeated.textures,baseline.textures);assert.equal(repeated.geometries,baseline.geometries);
  checks.twentyOpens={before:{geometries:baseline.geometries,textures:baseline.textures},after:{geometries:repeated.geometries,textures:repeated.textures}};
  const layouts=[];
  for(const[width,height]of[[1280,720],[1440,900],[1920,1080]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(400);
    await page.getByRole('button',{name:'欧拉故事：城市与关系',exact:true}).click();
    const rect=await page.getByTestId('reading-window').boundingBox();assert.ok(Math.abs(rect.width*rect.height/(width*height)-.801)<.001);
    assert.equal(await page.evaluate(()=>document.querySelector('.reading-scroll').scrollWidth<=document.querySelector('.reading-scroll').clientWidth+1),true);
    const button=await page.getByRole('button',{name:'退出阅读',exact:true}).boundingBox();assert.ok(button.x+button.width<=width&&button.y>=0);
    await save(`euler-desktop-${width}.png`);layouts.push({width,height,area:.801});
  }
  checks.desktops=layouts;await audit.close();
  const reduced=await browser.newContext({viewport:{width:1280,height:720},reducedMotion:'reduce'});page=await reduced.newPage();register(page);
  await page.goto(`${INTEGRATION_BASE_URL}/legacy/`,{waitUntil:'networkidle'});await enter();await open();await chapter('指数与旋转',2);
  assert.deepEqual((await snapshot()).euler.weights,[0,0,1]);await save('euler-reduced-motion.png');checks.reducedMotionChapterChange=true;await reduced.close();
  assert.deepEqual(errors,[]);const report={checkedAt:new Date().toISOString(),browser:browser.version(),checks,errors,scope:'Euler mathematics, three live scenes, controls, reversible chapter transitions, preserved angle and chapter, 30-second reading, blur, 20 opens, three desktop sizes, reduced motion and production build. This is not Stage E ten-minute/GPU acceptance.'};
  await fs.writeFile(path.join(output,'euler-browser-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){if(page&&!page.isClosed())await save('euler-failure.png');throw error;}finally{await browser.close();}
