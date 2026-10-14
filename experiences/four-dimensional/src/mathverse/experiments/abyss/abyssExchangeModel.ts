import {createAbyssBeams} from './abyssModel.ts';
import {createExchangeSolids,EXCHANGE_CORNERS,ReferenceExchangeController,type ExchangeSolid} from '../../shared/projection/referenceExchangeModel.ts';
import type {V3,V4} from '../inversion/inversionModel.ts';

export const ABYSS_EXCHANGE={center:[-20,-240,-245] as V3,scale:[70,42,32] as V3,lens:1.9,firstHold:32,hold:80,anticipation:6,rotation:30,settle:8,lastVisibleZ:-160};
// Floor apertures, rather than a floating upright frame: all source vertices
// share one YW rotation and one perspective division, including the seam.
export function abyssExchangePoint(p:V4,angle:number,out:V3=[0,0,0]):V3{
 const c=Math.cos(angle),s=Math.sin(angle),y=p[1]*c-p[3]*s,w=p[1]*s+p[3]*c,k=ABYSS_EXCHANGE.lens/(ABYSS_EXCHANGE.lens-w);
 out[0]=ABYSS_EXCHANGE.center[0]+p[0]*ABYSS_EXCHANGE.scale[0]*k;
 out[1]=ABYSS_EXCHANGE.center[1]+y*ABYSS_EXCHANGE.scale[1]*k;
 out[2]=ABYSS_EXCHANGE.center[2]+p[2]*ABYSS_EXCHANGE.scale[2]*k;return out;
}
export function createAbyssExchangeSolids():ExchangeSolid[]{return createExchangeSolids().map(s=>({...s,center:[s.center[0],s.center[2],s.center[1],s.center[3]],size:[s.size[0],s.size[2],s.size[1]]}));}
export const ABYSS_SOCKETS:V3[]=[[-168,-95,-245],[168,-95,-245],[-168,-405,-245],[168,-405,-245]];
export const ABYSS_ATTACHMENTS:V4[]=[[-1,1,-1,-1],[1,1,-1,-1],[-1,-1,-1,1],[1,-1,-1,1]];
export function abyssExchangeConnections(angle:number){return [...EXCHANGE_CORNERS.map(p=>({a:abyssExchangePoint([...p,-1],angle),b:abyssExchangePoint([...p,1],angle),width:2.1})),...ABYSS_SOCKETS.map((a,i)=>({a,b:abyssExchangePoint(ABYSS_ATTACHMENTS[i],angle),width:2.8}))];}
export function createAbyssSeam():ExchangeSolid[]{return [
 {center:[0,1,1.098,-1],size:[2,.014,.014],kind:'joint',id:'seam/upper'},
 {center:[-1.052,0,1.098,-1],size:[.014,2,.014],kind:'joint',id:'seam/side'},
 {center:[0,-1,1.098,-1],size:[2,.014,.014],kind:'joint',id:'seam/lower'},
 ];}
export function createAbyssExchangeBeams(){return createAbyssBeams().filter(b=>!(b.assembly==='deep-well'&&b.center[2]===-245&&b.center[0]===0&&b.center[1]<=-260&&b.center[1]>=-282)&&!(b.assembly==='horizontal-libraries'&&b.center[2]===-360));}
export function createAbyssExchangeController(){return new ReferenceExchangeController(ABYSS_EXCHANGE);}
export const ABYSS_EXCHANGE_RENDER={name:'abyss-exchange',project:abyssExchangePoint,solids:createAbyssExchangeSolids,connections:abyssExchangeConnections,seam:createAbyssSeam,projection:'shared-YW-perspective'};
