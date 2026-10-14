import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DoubleSide, ExtrudeGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { archFrameShape } from '../../src/mathverse/scene/archGeometry.ts';
import { MOTION, createMotion, entrySpeed, entryZ, minimumJerk } from '../../src/mathverse/config/motion.ts';
import { addLookInput, advanceMotion, beginEntrance, lookForward, resumeMotion, suspendMotion } from '../../src/mathverse/motion/MotionKernel.ts';

const output=path.resolve(import.meta.dirname,'../../artifacts/interaction/stage-b');
await fs.mkdir(output,{recursive:true});
const approx=(a,b,tolerance,message)=>assert.ok(Math.abs(a-b)<=tolerance,`${message}: ${a} versus ${b}`);
const explore=()=>{const m=createMotion();m.phase='exploring';m.z=MOTION.entryEndZ;m.pitch=0;m.speed=MOTION.explorationSpeed;return m;};
const tick=(m,seconds,hz=120)=>{for(let i=0;i<Math.round(seconds*hz);i++)advanceMotion(m,1/hz);};
const frameRates=[30,60,120];
const frameGeometry=new ExtrudeGeometry(archFrameShape(),{depth:0.14,bevelEnabled:true,bevelSize:0.007,bevelThickness:0.007,bevelSegments:3,curveSegments:64});
const doorFrame=new Mesh(frameGeometry,new MeshBasicMaterial({side:DoubleSide}));
doorFrame.position.z=-0.07;doorFrame.updateMatrixWorld(true);
for(const x of [-0.4,0,0.4]) {
  const hits=new Raycaster(new Vector3(x,MOTION.eyeHeight,MOTION.initialZ),new Vector3(0,0,-1)).intersectObject(doorFrame);
  assert.equal(hits.length,0,'door frame must leave the actual eye-height aperture unobstructed');
}
assert.ok(new Raycaster(new Vector3(0.71,MOTION.eyeHeight,MOTION.initialZ),new Vector3(0,0,-1)).intersectObject(doorFrame).length>0,'frame side must remain solid');
frameGeometry.dispose();doorFrame.material.dispose();
const runs=frameRates.map(hz=>{
  const m=createMotion();assert.ok(beginEntrance(m));
  let transitionSpeed=null,maximumTilt=0,maximumAngularSpeed=0,minimumPanelGap=Infinity,settle=null;
  for(let i=0;i<20*hz;i++) {
    if(i===8*hz)addLookInput(m,0.8,0.2);
    if(i===11*hz)addLookInput(m,2.7,-0.4);
    if(i===12*hz)m.paused=true;
    if(i===14*hz)m.paused=false;
    if(i===15*hz)lookForward(m);
    const phase=m.phase;advanceMotion(m,1/hz);
    if(phase==='entering'&&m.phase==='exploring')transitionSpeed=m.speed;
    maximumTilt=Math.max(maximumTilt,Math.abs(m.pitch));
    maximumAngularSpeed=Math.max(maximumAngularSpeed,Math.abs(m.yawVelocity),Math.abs(m.pitchVelocity));
    // Camera eye height lies below the arch spring line; this conservative rectangle contains the door panel.
    const angle=MOTION.doorAngle*minimumJerk(m.elapsed/MOTION.doorDuration),s=Math.sin(angle),c=Math.cos(angle);
    const dx=0.645,dz=m.z-0.012;
    const localX=dx*c-dz*s-0.645,localZ=dx*s+dz*c;
    const gap=Math.hypot(Math.max(0,Math.abs(localX)-0.647),Math.max(0,-0.004-localZ,localZ-0.074));
    minimumPanelGap=Math.min(minimumPanelGap,gap);
    assert.ok(Number.isFinite(m.yaw)&&Number.isFinite(m.pitch)&&Number.isFinite(m.speed));
    if(settle===null&&i>=8*hz&&Math.abs(m.yaw-0.8)<0.008)settle=(i+1)/hz-8;
  }
  approx(transitionSpeed,MOTION.explorationSpeed,1e-8,'entry speed continuity');
  assert.ok(maximumTilt<=MOTION.pitchLimit+1e-10);
  assert.ok(maximumAngularSpeed<=MOTION.maxAngularVelocity+1e-10);
  assert.ok(minimumPanelGap>0.10,'camera must not intersect animated door panel');
  assert.ok(settle>=0.2&&settle<=0.4,'normal head turn should settle within 0.2–0.4 seconds');
  return {hz,distance:m.distance,z:m.z,yaw:m.yaw,pitch:m.pitch,transitionSpeed,maximumTilt,maximumAngularSpeed,minimumPanelGap,settleSeconds:settle};
});
for(const run of runs) {
  approx(run.distance,runs[0].distance,0.00002,'distance across frame rates');
  approx(run.yaw,runs[0].yaw,0.00002,'yaw across frame rates');
  approx(run.pitch,runs[0].pitch,0.00002,'pitch across frame rates');
}

for(let i=0;i<=1000;i++) {
  const t=i/1000;
  assert.ok(entrySpeed(t)>=-1e-8,'entry must move monotonically inward');
  if(i>0)assert.ok(entryZ(t)<=entryZ((i-1)/1000)+1e-10);
}
approx(entryZ(0),MOTION.initialZ,1e-10,'entry starts at initial camera');
approx(entryZ(1),MOTION.entryEndZ,1e-10,'entry joins travel path');
approx(entrySpeed(0),0,1e-10,'entry starts stationary');
approx(entrySpeed(1),MOTION.explorationSpeed,1e-10,'entry ends at exploration speed');
approx(entrySpeed(0.00001),0,0.000001,'entry begins with zero acceleration');
approx(entrySpeed(0.99999),MOTION.explorationSpeed,0.000001,'entry ends with zero acceleration');

const boundary=explore();
for(let i=0;i<30;i++)addLookInput(boundary,0,0.15);
const upper=boundary.targetPitch;assert.ok(upper<=MOTION.pitchLimit);
addLookInput(boundary,0,-0.02);approx(boundary.targetPitch,upper-0.02,1e-10,'reversing exits soft boundary immediately');
for(let i=0;i<60;i++)addLookInput(boundary,0,-0.15);
assert.ok(boundary.targetPitch>=-MOTION.pitchLimit);
tick(boundary,2);assert.ok(Math.abs(boundary.pitch)<=MOTION.pitchLimit);

const held=explore();addLookInput(held,1.3,0.3);tick(held,2);
const heading=held.yaw;tick(held,2);approx(held.yaw,heading,1e-6,'head direction must not auto-center');
held.yaw=3.4;held.targetYaw=12;lookForward(held);
assert.ok(Math.abs(held.targetYaw-held.yaw)<=Math.PI,'forward button must take shortest angular route');

const pause=explore();pause.paused=true;const pauseStart=pause.distance;advanceMotion(pause,1/60);
assert.ok(pause.speed>0&&pause.speed<MOTION.explorationSpeed);assert.ok(pause.distance>pauseStart);
tick(pause,2);approx(pause.speed,0,1e-12,'pause reaches rest');
const parked=pause.distance;tick(pause,0.5);approx(pause.distance,parked,1e-12,'paused position remains fixed');
pause.paused=false;advanceMotion(pause,1/60);assert.ok(pause.speed>0&&pause.speed<MOTION.explorationSpeed);

const resumed=explore();addLookInput(resumed,0.9,0.2);tick(resumed,0.1);
suspendMotion(resumed);const frozen={z:resumed.z,yaw:resumed.yaw,pitch:resumed.pitch};
advanceMotion(resumed,180);approx(resumed.z,frozen.z,1e-12,'hidden interval cannot advance position');
resumeMotion(resumed);advanceMotion(resumed,180);
approx(resumed.z,frozen.z,1e-12,'first resumed frame discards elapsed background time');
approx(resumed.yaw,frozen.yaw,1e-12,'resumed orientation cannot jump');
advanceMotion(resumed,1/60);assert.ok(resumed.z<frozen.z&&frozen.z-resumed.z<0.001);

const spike=explore();addLookInput(spike,40,40);advanceMotion(spike,1/30);
assert.ok(Math.abs(spike.yaw)<=MOTION.maxAngularVelocity/30+1e-10,'large input remains rate limited');
assert.ok(Math.abs(spike.pitch)<=MOTION.pitchLimit);
const interruptedEntry=createMotion();advanceMotion(interruptedEntry,1/60);suspendMotion(interruptedEntry);
beginEntrance(interruptedEntry);advanceMotion(interruptedEntry,180);tick(interruptedEntry,2);
suspendMotion(interruptedEntry);const entryHold={z:interruptedEntry.z,pitch:interruptedEntry.pitch};
resumeMotion(interruptedEntry);advanceMotion(interruptedEntry,180);
approx(interruptedEntry.z,entryHold.z,1e-12,'resuming entrance discards background displacement');
approx(interruptedEntry.pitch,entryHold.pitch,1e-12,'resuming entrance preserves camera direction');
tick(interruptedEntry,6);assert.equal(interruptedEntry.phase,'exploring');
approx(interruptedEntry.pitch,0,1e-12,'interrupted entrance joins exploration without a direction jump');
approx(interruptedEntry.targetPitch,0,1e-12,'entrance blur cannot replace the final look target');
const report={checkedAt:new Date().toISOString(),runs,checks:{entryContinuity:true,doorAperture:true,doorClearance:true,softBoundaryAndImmediateReverse:true,noAutoCenter:true,shortestForward:true,smoothSpeed:true,noResumeJump:true,interruptedEntranceContinuity:true,largeInputStable:true},scope:'30/60/120 Hz deterministic motion simulation, not GPU frame-rate measurement'};
await fs.writeFile(path.join(output,'motion-verification.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
