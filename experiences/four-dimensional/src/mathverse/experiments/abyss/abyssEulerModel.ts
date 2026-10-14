import {abyssExchangePoint} from './abyssExchangeModel.ts';
import {orderedLayout,type SpaceProjection} from '../inversion/orderedModel.ts';
import {MEGA_EULER_IDS} from '../megastructure/megaEulerModel.ts';
import type {V4} from '../inversion/inversionModel.ts';
// Fixed source arrangement: a horizontal mathematical world inside the same
// W=-1 plate library. No animated secondary scale or camera-facing transform.
export function abyssEulerSource(p:V4):V4{return[p[0]*.52,p[2]*.22-.73,-p[1]*.72,p[3]];}
export const abyssEulerPoint:SpaceProjection=(_section,p,angle,out)=>abyssExchangePoint(abyssEulerSource(p),angle,out);
export const abyssEulerTracePoint:SpaceProjection=(_section,p,angle,out)=>{const q=abyssEulerSource(p);q[1]-=.2;return abyssExchangePoint(q,angle,out);};
export const abyssEulerLayout=()=>orderedLayout(abyssEulerPoint).filter(p=>(MEGA_EULER_IDS as readonly string[]).includes(p.id));
