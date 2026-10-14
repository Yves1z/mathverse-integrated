import { VISUAL } from '../config/visual.ts';
export type NodePlacement={id:string;anchor:{chunkId:number;localPosition:[number,number,number]};orientation:[number,number,number];scale:number;discoveryRange:number};
export const NODE_LAYOUT:readonly NodePlacement[]=[
  {id:'euler-identity',anchor:{chunkId:0,localPosition:[-6.3,3.9,-17]},orientation:[0,0.24,0.02],scale:1,discoveryRange:31},
  {id:'unit-circle',anchor:{chunkId:0,localPosition:[6.3,2.9,-19]},orientation:[0,-0.27,-0.03],scale:1,discoveryRange:31},
  {id:'gaussian-integral',anchor:{chunkId:1,localPosition:[6.8,4,-19]},orientation:[0,-0.32,0.03],scale:1.05,discoveryRange:35},
  {id:'mobius-strip',anchor:{chunkId:1,localPosition:[-6.7,3.5,-21]},orientation:[0,0.26,-0.03],scale:1.05,discoveryRange:35},
  {id:'leonhard-euler',anchor:{chunkId:1,localPosition:[-7.4,7.5,-10]},orientation:[0.18,0.28,0.06],scale:0.95,discoveryRange:33},
  {id:'complex-rotation',anchor:{chunkId:1,localPosition:[0.4,8.4,-6]},orientation:[0.22,0,-0.03],scale:1,discoveryRange:34},
];
export function nodePosition(placement:NodePlacement):[number,number,number]{const[x,y,z]=placement.anchor.localPosition;return[x,y,z-placement.anchor.chunkId*VISUAL.cellSize];}
