import {Vector3} from 'three';
import {MOTION} from '../config/motion.ts';

// A circle on a reference plane, lifted along the same viewing rays onto three
// separate planes. Camera orientation alone cannot separate coincident rays:
// the additional XW/ZW rotation explicitly changes the observation in 4D.
export const RELATION={eyeZ:-10,planeZ:-26,centerY:6.3,radius:3.15,cut:1.05,planeOffset:.14,fourthDistance:18} as const;
export const RELATION_IDS=['euler-identity','unit-circle','complex-rotation'] as const;
export const RELATION_PITCH=Math.atan((RELATION.centerY-MOTION.eyeHeight)/(RELATION.eyeZ-RELATION.planeZ));
export const RELATION_PLANES=[-20,-26,-35] as const;
export type RelationState={xw:number;zw:number;seamPixels:number;coherence:number;available:boolean;positions:number[][]};
export function createRelationState():RelationState{return{xw:0,zw:0,seamPixels:Infinity,coherence:0,available:false,positions:[]};}
export function relationIndex(id:string):number{return RELATION_IDS.indexOf(id as typeof RELATION_IDS[number]);}
export function relationPose(index:number){
  const scale=(RELATION.eyeZ-RELATION_PLANES[index])/(RELATION.eyeZ-RELATION.planeZ+RELATION.planeOffset);
  return{position:[(index-1)*2.1*scale,MOTION.eyeHeight+(RELATION.centerY-MOTION.eyeHeight)*scale,RELATION_PLANES[index]] as [number,number,number],scale:[2.1/6.2*scale,6.8/4*scale,scale] as [number,number,number]};
}
export function circleOwner(angle:number){const x=RELATION.radius*Math.cos(angle);return x<-RELATION.cut?0:x>RELATION.cut?2:1;}
export function relationLocalPoint(index:number,angle:number,target:Vector3){
  target.set((RELATION.radius*Math.cos(angle)-(index-1)*2.1)/(2.1/6.2),RELATION.radius*Math.sin(angle)/(6.8/4),RELATION.planeOffset);return target;
}
export function relationSeams(){const a=Math.acos(RELATION.cut/RELATION.radius),b=Math.acos(-RELATION.cut/RELATION.radius);return[{angle:a,ids:[1,2]},{angle:b,ids:[0,1]},{angle:Math.PI*2-b,ids:[0,1]},{angle:Math.PI*2-a,ids:[1,2]}];}
export function relationArcSegments(index:number){
  const breaks=[0,...relationSeams().map(s=>s.angle),Math.PI*2].sort((a,b)=>a-b),values:number[]=[];
  const a=new Vector3(),b=new Vector3();
  for(let j=0;j<breaks.length-1;j++){
    const start=breaks[j],end=breaks[j+1];if(circleOwner((start+end)/2)!==index)continue;
    const steps=Math.ceil((end-start)*96);
    for(let i=0;i<steps;i++){relationLocalPoint(index,start+(end-start)*i/steps,a);relationLocalPoint(index,start+(end-start)*(i+1)/steps,b);values.push(...a.toArray(),...b.toArray());}
  }return values;
}
export function rotateRelation4(point:readonly number[],xw:number,zw:number):[number,number,number,number]{
  const[x,y,z,w]=point,c=Math.cos(xw),s=Math.sin(xw),a=x*c-w*s,d=x*s+w*c;
  return[a,y,z*Math.cos(zw)-d*Math.sin(zw),z*Math.sin(zw)+d*Math.cos(zw)];
}
export function foldedRelationPose(index:number,xw:number,zw:number,target:Vector3){
  const base=relationPose(index),w=(index-1)*3.4,unproject=1-w/RELATION.fourthDistance;
  const p=rotateRelation4([base.position[0]*unproject,(base.position[1]-RELATION.centerY)*unproject,(base.position[2]-RELATION.planeZ)*unproject,w],xw,zw);
  const factor=RELATION.fourthDistance/(RELATION.fourthDistance-p[3]);
  target.set(p[0]*factor,p[1]*factor+RELATION.centerY,p[2]*factor+RELATION.planeZ);
  return factor*unproject;
}
export function relationVoidAt(point:{x:number;y:number;z:number}){
  if(point.z> -17||point.z< -37)return 1;
  const depth=RELATION.eyeZ-point.z,ratio=16/depth;
  const radius=Math.hypot(point.x*ratio,MOTION.eyeHeight+(point.y-MOTION.eyeHeight)*ratio-RELATION.centerY);
  const t=Math.max(0,Math.min(1,(radius-3.7)/.8));return t*t*(3-2*t);
}
export function relationEdgeVoid(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number}){
  const dz=b.z-a.z;let low=0,high=1;
  if(Math.abs(dz)<1e-8){if(a.z> -17||a.z< -37)return 1;}
  else{const u=(-37-a.z)/dz,v=(-17-a.z)/dz;low=Math.max(0,Math.min(u,v));high=Math.min(1,Math.max(u,v));if(low>high)return 1;}
  const ax=a.x+(b.x-a.x)*low,ay=a.y+(b.y-a.y)*low,az=a.z+dz*low;
  const bx=a.x+(b.x-a.x)*high,by=a.y+(b.y-a.y)*high,bz=a.z+dz*high;
  const x=ax*16/(RELATION.eyeZ-az),y=(ay-MOTION.eyeHeight)*16/(RELATION.eyeZ-az)+MOTION.eyeHeight-RELATION.centerY;
  const dx=bx*16/(RELATION.eyeZ-bz)-x,dy=(by-MOTION.eyeHeight)*16/(RELATION.eyeZ-bz)+MOTION.eyeHeight-RELATION.centerY-y;
  const t=Math.max(0,Math.min(1,-(x*dx+y*dy)/Math.max(1e-8,dx*dx+dy*dy)));
  const radius=Math.hypot(x+dx*t,y+dy*t),fade=Math.max(0,Math.min(1,(radius-3.7)/.8));return fade*fade*(3-2*fade);
}
