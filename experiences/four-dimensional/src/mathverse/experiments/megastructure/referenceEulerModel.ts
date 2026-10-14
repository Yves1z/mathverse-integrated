import { exchangePoint } from '../../shared/projection/referenceExchangeModel.ts';
import { orderedLayout, type SpaceProjection } from '../inversion/orderedModel.ts';
import { MEGA_EULER_IDS } from './megaEulerModel.ts';
// A fixed arrangement within the source volume leaves the mathematical body
// slightly forward of its center. The placement is applied before 4D rotation.
export const REFERENCE_EULER_SOURCE_Z=.28;
export const referenceEulerPoint:SpaceProjection=(_section,point,angle,out)=>exchangePoint([point[0],point[1],point[2]+REFERENCE_EULER_SOURCE_Z,point[3]],angle,out);
export const referenceEulerLayout=()=>orderedLayout(referenceEulerPoint).filter(p=>(MEGA_EULER_IDS as readonly string[]).includes(p.id));
