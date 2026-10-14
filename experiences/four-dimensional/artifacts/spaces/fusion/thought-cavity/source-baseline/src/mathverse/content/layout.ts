import { VISUAL } from '../config/visual.ts';
import {relationPose} from '../windows/relationship.ts';
export type NodePlacement={id:string;anchor:{chunkId:number;localPosition:[number,number,number]};orientation:[number,number,number];scale:number;discoveryRange:number};
export const NODE_LAYOUT:readonly NodePlacement[]=[
  {id:'euler-identity',anchor:{chunkId:0,localPosition:relationPose(0).position},orientation:[0,0,0],scale:1,discoveryRange:40},
  {id:'unit-circle',anchor:{chunkId:0,localPosition:relationPose(1).position},orientation:[0,0,0],scale:1,discoveryRange:40},
  {id:'gaussian-integral',anchor:{chunkId:1,localPosition:[6.8,4,-19]},orientation:[0,-0.32,0.03],scale:1.05,discoveryRange:35},
  {id:'mobius-strip',anchor:{chunkId:1,localPosition:[-6.7,3.5,-21]},orientation:[0,0.26,-0.03],scale:1.05,discoveryRange:35},
  {id:'leonhard-euler',anchor:{chunkId:1,localPosition:[-7.4,7.5,-10]},orientation:[0.18,0.28,0.06],scale:0.95,discoveryRange:33},
  {id:'complex-rotation',anchor:{chunkId:0,localPosition:relationPose(2).position},orientation:[0,0,0],scale:1,discoveryRange:45},
];
export function nodePosition(placement:NodePlacement):[number,number,number]{const[x,y,z]=placement.anchor.localPosition;return[x,y,z-placement.anchor.chunkId*VISUAL.cellSize];}
