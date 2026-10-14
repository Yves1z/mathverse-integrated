import { VISUAL } from '../config/visual.ts';
export type NodePlacement={id:string;anchor:{chunkId:number;localPosition:[number,number,number]};orientation:[number,number,number];scale:number;discoveryRange:number};
export const NODE_LAYOUT:readonly NodePlacement[]=[
  {id:'euler-identity',anchor:{chunkId:0,localPosition:[1.45,3.1,-12]},orientation:[0,-0.13,0.04],scale:1,discoveryRange:26},
  {id:'unit-circle',anchor:{chunkId:0,localPosition:[-4.9,1.9,-12.5]},orientation:[0,0.55,-0.08],scale:1.1,discoveryRange:24},
  {id:'gaussian-integral',anchor:{chunkId:1,localPosition:[5,2.6,-2]},orientation:[0,-0.35,0],scale:1.1,discoveryRange:32},
  {id:'mobius-strip',anchor:{chunkId:1,localPosition:[-5.5,4,-7]},orientation:[0.45,0.18,-0.2],scale:1.3,discoveryRange:38},
  {id:'leonhard-euler',anchor:{chunkId:1,localPosition:[7.2,4.2,-20]},orientation:[0,-0.3,0],scale:1.1,discoveryRange:34},
  {id:'complex-rotation',anchor:{chunkId:2,localPosition:[0.4,5.9,-4]},orientation:[0.16,0,0],scale:1.15,discoveryRange:35},
];
export function nodePosition(placement:NodePlacement):[number,number,number]{const[x,y,z]=placement.anchor.localPosition;return[x,y,z-placement.anchor.chunkId*VISUAL.cellSize];}
