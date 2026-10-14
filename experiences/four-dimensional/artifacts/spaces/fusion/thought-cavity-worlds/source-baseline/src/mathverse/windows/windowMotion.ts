export type Point4 = readonly [number,number,number,number];
export type FoldBasis={ca:number;sa:number;cb:number;sb:number;cy:number;sy:number;cr:number;sr:number};
export type FoldFrame = {center:readonly number[];yaw:number;roll:number;phase:number;angles?:readonly [number,number];basis?:FoldBasis};
export type ScreenRect = {x:number;y:number;width:number;height:number};
export const WINDOW = {width:6.2,height:4,depth:0.68,frame:0.075,period:112,textureWidth:1024,textureHeight:660} as const;
const TAU=Math.PI*2;
export function alignmentAt(time:number):number{return Math.pow((1+Math.cos(time*TAU/WINDOW.period))/2,6);}
export function fourthAngles(time:number,phase=0):[number,number]{
  const cycle=time*TAU/WINDOW.period,spread=1-alignmentAt(time)*0.8;
  return [0.27+0.40*Math.sin(cycle+phase*0.10*spread),0.18+0.28*Math.cos(cycle*0.5+phase*0.12*spread)];
}
export function rotateFourth(point:Point4,a:number,b:number):[number,number,number,number]{
  let [x,y,z,w]=point;const old=x;x=x*Math.cos(a)-w*Math.sin(a);w=old*Math.sin(a)+w*Math.cos(a);
  const oldZ=z;z=z*Math.cos(b)-w*Math.sin(b);w=oldZ*Math.sin(b)+w*Math.cos(b);return[x,y,z,w];
}
export function foldBasis(angles:readonly [number,number],yaw:number,roll:number):FoldBasis{return{ca:Math.cos(angles[0]),sa:Math.sin(angles[0]),cb:Math.cos(angles[1]),sb:Math.sin(angles[1]),cy:Math.cos(yaw),sy:Math.sin(yaw),cr:Math.cos(roll),sr:Math.sin(roll)};}
export function projectFourthTo<T extends {x:number;y:number;z:number}>(point:Point4,frame:FoldFrame,time:number,out:T):T{
  const{ca,sa,cb,sb,cy,sy,cr,sr}=frame.basis??foldBasis(frame.angles??fourthAngles(time,frame.phase),frame.yaw,frame.roll);
  let x=point[0],y=point[1],z=point[2],w=point[3],oldX=x;
  x=x*ca-w*sa;w=oldX*sa+w*ca;
  const oldZ=z;z=z*cb-w*sb;w=oldZ*sb+w*cb;
  const scale=10/(10-w);x*=scale;y*=scale;z*=scale;
  let old=x;x=x*cy+z*sy;z=-old*sy+z*cy;
  old=x;x=x*cr-y*sr;y=old*sr+y*cr;
  out.x=x+frame.center[0];out.y=y+frame.center[1];out.z=z+frame.center[2];return out;
}
export function readingRect(width:number,height:number):ScreenRect{return{x:width*0.05,y:height*0.055,width:width*0.90,height:height*0.89};}
export function mixRect(from:ScreenRect,to:ScreenRect,t:number):ScreenRect{return{x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,width:from.width+(to.width-from.width)*t,height:from.height+(to.height-from.height)*t};}
export type ConnectionMotion={angle:number;exploreAngle:number;alignment:number;time:number};
export function createConnectionMotion():ConnectionMotion{return{angle:Math.PI/3,exploreAngle:Math.PI/3,alignment:1,time:0};}
export function advanceConnection(state:ConnectionMotion,time:number,dt:number,readingAngle:number|null):void{
  if(dt<=0)return;state.time=time;state.alignment=alignmentAt(time);
  if(readingAngle===null)state.exploreAngle+=dt*0.095;
  const target=readingAngle??state.exploreAngle;
  const nearest=target+Math.round((state.angle-target)/TAU)*TAU;
  state.angle+=(nearest-state.angle)*(1-Math.exp(-dt*9));
  if(readingAngle!==null)state.exploreAngle=state.angle;
}
