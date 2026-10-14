import { READING } from '../config/reading.ts';
import { MOTION,minimumJerk,type MotionState } from '../config/motion.ts';
import { resumeMotion } from '../motion/MotionKernel.ts';
export type ReadingPhase='closed'|'focusing'|'reading'|'closing';
export type ReadingState={phase:ReadingPhase;selectedId:string|null;elapsed:number;progress:number;closeStart:number;savedYaw:number;savedPitch:number;focusYaw:number;focusPitch:number;pausedBefore:boolean;hoveredId:string|null;hoverElapsed:number;angle:number;objectYaw:number};
export function createReading():ReadingState{return{phase:'closed',selectedId:null,elapsed:0,progress:0,closeStart:0,savedYaw:0,savedPitch:0,focusYaw:0,focusPitch:0,pausedBefore:false,hoveredId:null,hoverElapsed:0,angle:Math.PI/3,objectYaw:0};}
export function setHovered(reading:ReadingState,id:string|null):void{if(reading.hoveredId===id)return;reading.hoveredId=id;reading.hoverElapsed=0;}
export function openReading(motion:MotionState,reading:ReadingState,id:string,position:readonly number[]):boolean{
  if(motion.phase!=='exploring'||reading.phase!=='closed')return false;
  resumeMotion(motion);reading.savedYaw=motion.yaw;reading.savedPitch=motion.pitch;reading.pausedBefore=motion.paused;
  const dx=position[0],dy=position[1]-MOTION.eyeHeight,dz=position[2]-motion.z,yaw=Math.atan2(dx,-dz);
  reading.focusYaw=yaw+Math.round((motion.yaw-yaw)/(Math.PI*2))*Math.PI*2;
  reading.focusPitch=Math.max(-MOTION.pitchLimit,Math.min(MOTION.pitchLimit,Math.atan2(dy,Math.hypot(dx,dz))));
  reading.phase='focusing';reading.selectedId=id;reading.elapsed=0;reading.progress=0;reading.angle=Math.PI/3;reading.objectYaw=0;setHovered(reading,null);
  motion.paused=false;motion.dragging=false;motion.speedScale=READING.speedScale;motion.targetYaw=reading.focusYaw;motion.targetPitch=reading.focusPitch;return true;
}
export function switchReading(reading:ReadingState,id:string):boolean{if(reading.phase!=='reading'&&reading.phase!=='focusing')return false;reading.selectedId=id;reading.angle=Math.PI/3;reading.objectYaw=0;return true;}
export function closeReading(motion:MotionState,reading:ReadingState):boolean{if(reading.phase!=='reading'&&reading.phase!=='focusing')return false;reading.closeStart=reading.progress;reading.phase='closing';reading.elapsed=0;motion.targetYaw=reading.savedYaw;motion.targetPitch=reading.savedPitch;setHovered(reading,null);return true;}
export function advanceReading(motion:MotionState,reading:ReadingState,dt:number):void{
  if(dt<=0||motion.phase!=='exploring')return;
  if(reading.phase==='closed'){if(reading.hoveredId)reading.hoverElapsed+=dt;motion.speedScale=reading.hoveredId&&reading.hoverElapsed>=READING.hoverDelay?READING.hoverSpeedScale:1;return;}
  reading.elapsed+=dt;
  if(reading.phase==='closing'){
    reading.progress=Math.max(0,reading.closeStart*(1-minimumJerk(reading.elapsed/READING.fadeDuration)));
    motion.speedScale=READING.speedScale+(1-READING.speedScale)*minimumJerk(reading.elapsed/READING.restoreDuration);
    motion.targetYaw=reading.savedYaw;motion.targetPitch=reading.savedPitch;
    if(reading.elapsed>=READING.restoreDuration){reading.phase='closed';reading.selectedId=null;reading.progress=0;motion.speedScale=1;motion.paused=reading.pausedBefore;}
  }else{
    reading.progress=minimumJerk(reading.elapsed/READING.fadeDuration);motion.speedScale=READING.speedScale;motion.targetYaw=reading.focusYaw;motion.targetPitch=reading.focusPitch;
    if(reading.phase==='focusing'&&reading.elapsed>=READING.focusDuration)reading.phase='reading';
  }
}
