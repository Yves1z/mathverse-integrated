import { REFERENCE_JOURNEY, journeyCells } from '../../experiments/megastructure/referenceModel.ts';
export const REFERENCE_AIR={particlesPerCell:128,shaftsPerCell:2,steps:24,driftPeriod:720} as const;
export const AIR_SHAFTS=[{origin:[-24,12,-326],direction:[.08,.14,1],length:205,radius:10},{origin:[65,72,-310],direction:[-.14,-.05,1],length:190,radius:16}] as const;
const seed=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
export function airPoint(index:number,cell:number,time=0):[number,number,number]{
  const shaft=AIR_SHAFTS[index%2],n=cell*193+index,phase=seed(n+13),t=(phase+time/REFERENCE_AIR.driftPeriod)%1;
  const r=shaft.radius*(.28+.7*t)*Math.sqrt(seed(n+31)),angle=seed(n+57)*Math.PI*2;
  return [shaft.origin[0]+shaft.direction[0]*t*shaft.length+Math.cos(angle)*r,shaft.origin[1]+shaft.direction[1]*t*shaft.length+Math.sin(angle)*r,shaft.origin[2]-cell*REFERENCE_JOURNEY.pitch+t*shaft.length];
}
export function airData(first:number){const positions:number[]=[],phases:number[]=[];for(const cell of journeyCells(first))for(let i=0;i<REFERENCE_AIR.particlesPerCell;i++){positions.push(...airPoint(i,cell));phases.push(seed(cell*193+i+13),i%2);}return{positions:new Float32Array(positions),phases:new Float32Array(phases)};}
