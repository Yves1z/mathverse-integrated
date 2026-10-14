import { minimumJerk } from '../../config/motion.ts';
import { rotateXW, type V3, type V4 } from '../../experiments/inversion/inversionModel.ts';

export const REFERENCE_EXCHANGE={center:[45,62,-24] as V3,scale:14,lens:1.9,firstHold:24,hold:80,anticipation:6,rotation:30,settle:8,lastVisibleZ:-160} as const;
export type ExchangeSolid={center:V4,size:V3,kind:'primary'|'layer'|'joint',id:string};
export function exchangePoint(source:V4,angle:number,out:V3=[0,0,0]):V3{
  const p=rotateXW(source,angle),s=REFERENCE_EXCHANGE.scale*REFERENCE_EXCHANGE.lens/(REFERENCE_EXCHANGE.lens-p[3]);
  for(let i=0;i<3;i++)out[i]=REFERENCE_EXCHANGE.center[i]+p[i]*s;
  return out;
}

// Two depth libraries are opposite W faces of the same source volume. Each
// physical corner of every solid goes through the same 4D perspective map.
export function createExchangeSolids():ExchangeSolid[]{
  const solids:ExchangeSolid[]=[];
  for(const w of [-1,1]){
    const box=(x:number,y:number,z:number,size:V3,kind:ExchangeSolid['kind'])=>solids.push({center:[x,y,z,w],size,kind,id:`${w}/${solids.length}`});
    const layers=w===-1?10:6;
    for(let i=0;i<layers;i++){
      const z=1-i*2/(layers-1),primary=i===0||i===layers-1,t=primary?.15:.085,depth=primary?.19:.075,kind=primary?'primary':'layer';
      box(-1,0,z,[t,2+t,depth],kind);box(1,0,z,[t,2+t,depth],kind);
      box(0,1,z,[2-t,t,depth],kind);box(0,-1,z,[2-t,t,depth],kind);
    }
    for(const x of [-1,1])for(const y of [-1,1])box(x,y,0,[.10,.10,2.12],'joint');
  }
  return solids;
}
export const EXCHANGE_CORNERS:V3[]=Array.from({length:8},(_,i)=>[i&1?1:-1,i&2?1:-1,i&4?1:-1] as V3);
export const EXCHANGE_SOCKETS:V3[]=[[67,104,8],[67,26,8],[67,120,8],[67,-20,8]];
export const EXCHANGE_ATTACHMENTS:V4[]=[[1,1,1,-1],[1,-1,1,-1],[1,1,-1,1],[1,-1,-1,1]];
export function exchangeConnections(angle:number){
  return [...EXCHANGE_CORNERS.map(p=>({a:exchangePoint([...p,-1],angle),b:exchangePoint([...p,1],angle),width:1.25})),
    ...EXCHANGE_SOCKETS.map((a,i)=>({a,b:exchangePoint(EXCHANGE_ATTACHMENTS[i],angle),width:1.6}))];
}
export function solidCorners(s:ExchangeSolid):V4[]{return EXCHANGE_CORNERS.map(p=>[s.center[0]+p[0]*s.size[0]/2,s.center[1]+p[1]*s.size[1]/2,s.center[2]+p[2]*s.size[2]/2,s.center[3]]);}

export class ReferenceExchangeController{
  readonly timing:{firstHold:number;hold:number;anticipation:number;rotation:number;settle:number;lastVisibleZ:number};
  constructor(timing:ReferenceExchangeController['timing']=REFERENCE_EXCHANGE){this.timing=timing;}
  angle=0;clock=0;elapsed=0;hold=0;events=0;from=0;to=Math.PI;phase:'stable'|'anticipation'|'folding'|'settling'='stable';manual=false;
  reset(){this.angle=this.clock=this.elapsed=this.hold=this.events=this.from=0;this.to=Math.PI;this.phase='stable';this.manual=false;}
  review(angle:number){this.angle=Math.max(0,Math.min(Math.PI,angle));this.manual=true;}
  begin(reduced=false){if(this.phase!=='stable')return false;this.from=this.angle;this.to=this.angle>Math.PI/2?0:Math.PI;this.elapsed=this.hold=0;this.events++;if(reduced){this.angle=this.to;}else this.phase='anticipation';return true;}
  advance(dt:number,cameraZ:number,frozen:boolean,reduced:boolean){
    if(frozen||reduced||this.manual||!Number.isFinite(dt)||dt<=0)return;
    this.clock+=dt;
    if(this.phase==='stable'){this.hold+=dt;if(cameraZ>this.timing.lastVisibleZ&&this.hold>=(this.events?this.timing.hold:this.timing.firstHold))this.begin();return;}
    this.elapsed+=dt;const pre=this.timing.anticipation,end=pre+this.timing.rotation;
    let t=1;
    if(this.elapsed<pre){this.phase='anticipation';t=.035*minimumJerk(this.elapsed/pre);}
    else if(this.elapsed<end){this.phase='folding';t=.035+.965*minimumJerk((this.elapsed-pre)/this.timing.rotation);}
    else this.phase='settling';
    this.angle=this.from+(this.to-this.from)*t;
    if(this.elapsed>=end+this.timing.settle){this.phase='stable';this.hold=0;}
  }
  snapshot(){return{angle:this.angle,phase:this.phase,events:this.events,clock:this.clock,elapsed:this.elapsed,hold:this.hold,manual:this.manual,maximumMovingUnits:1,trackedPosition:this.angle<.001?'inside':this.angle>Math.PI-.001?'outside':'unfolding'};}
}
