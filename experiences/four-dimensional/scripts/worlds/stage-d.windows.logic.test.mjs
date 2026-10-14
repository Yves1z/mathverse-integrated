import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {rotateFourth,projectFourthTo,fourthAngles,readingRect,alignmentAt,createConnectionMotion,advanceConnection} from '../../src/mathverse/windows/windowMotion.ts';
const points=[[5.3,7.3,4.3,1.8],[7.8,3.4,5.2,1.4],[5.4,8.8,3.7,2]].flatMap(size=>Array.from({length:16},(_,i)=>size.map((s,axis)=>s*((i>>axis)&1?1:-1))));
let minimumDenominator=Infinity,maximumStep=0;
for(let t=0;t<=224;t+=.1)for(const p of points){
  const[a,b]=fourthAngles(t,1.4),r=rotateFourth(p,a,b);
  assert.ok(Math.abs(Math.hypot(...p)-Math.hypot(...r))<1e-10,'rotation preserves the 4D norm');minimumDenominator=Math.min(minimumDenominator,10-r[3]);
  const f={center:[0,0,0],yaw:.2,roll:.1,phase:1.4};const q=projectFourthTo(p,f,t,{x:0,y:0,z:0}),next=projectFourthTo(p,f,t+1/120,{x:0,y:0,z:0});
  assert.ok(Object.values(q).every(Number.isFinite));maximumStep=Math.max(maximumStep,Math.hypot(q.x-next.x,q.y-next.y,q.z-next.z));
}
assert.ok(minimumDenominator>2);assert.ok(maximumStep<.02,'continuous projection has no sudden frame displacement');
for(const[w,h]of[[1280,720],[1600,900],[1920,1080],[2560,1440]]){const r=readingRect(w,h);assert.ok(Math.abs(r.width*r.height/(w*h)-.801)<1e-12);assert.ok(r.x>0&&r.y>0&&r.x+r.width<w&&r.y+r.height<h);}
const runs=[30,60,120].map(hz=>{const s=createConnectionMotion();for(let i=0;i<12*hz;i++)advanceConnection(s,(i+1)/hz,1/hz,null);for(let i=0;i<2*hz;i++)advanceConnection(s,12+(i+1)/hz,1/hz,Math.PI);assert.ok(Math.abs(s.angle-Math.PI)<1e-6);return{hz,angle:s.angle};});
const suspended=createConnectionMotion(),held={...suspended};advanceConnection(suspended,1000,0,Math.PI);assert.deepEqual(suspended,held);
assert.equal(alignmentAt(0),1);assert.ok(alignmentAt(56)<1e-10);assert.ok(Math.abs(alignmentAt(112)-1)<1e-10);
const report={checkedAt:new Date().toISOString(),checks:{normPreserving4DRotation:true,finiteProjection:true,smoothProjection:true,desktop80Percent:true,sharedAngleAcrossFrameRates:true,pausedConnectionClock:true,alignmentCycle:true},minimumDenominator,maximumStep,runs,scope:'Mathematical and timing invariants, not GPU performance measurements'};
await fs.writeFile(path.resolve(import.meta.dirname,'../../artifacts/worlds/stage-d-windows/window-logic-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
