import { Sphere,Vector2,Vector3,type Group,type Object3D } from 'three';
import { NODE_LAYOUT,nodePosition,type NodePlacement } from './layout.ts';
import { READING } from '../config/reading.ts';
import { NODE_BY_ID } from './nodes.ts';
export type NodeRuntime={placement:NodePlacement;position:Vector3;sphere:Sphere;group:Group|null;label:HTMLButtonElement|null;discovered:boolean;onScreen:boolean;emphasized:boolean;alpha:number;screen:Vector2;visualScreen:Vector2;occluded:boolean};
export type ContentRuntime={nodes:Map<string,NodeRuntime>;occluders:Object3D[];pickCount:number;openCount:number;blockedCount:number;observation:Record<string,unknown>|null};
export function createContentRuntime():ContentRuntime{return{nodes:new Map(NODE_LAYOUT.map(placement=>{
  const position=new Vector3(...nodePosition(placement));
  const extents={identity:2.05,gaussian:2.9,circle:1.6,mobius:1.5,person:2,rotation:2.6};
  const radius=Math.max(READING.pickRadius,extents[NODE_BY_ID.get(placement.id)!.rendererKey]);
  return[placement.id,{placement,position,sphere:new Sphere(position,radius*placement.scale),group:null,label:null,discovered:false,onScreen:false,emphasized:false,alpha:0,screen:new Vector2(),visualScreen:new Vector2(),occluded:false}];
})),occluders:[],pickCount:0,openCount:0,blockedCount:0,observation:null};}
