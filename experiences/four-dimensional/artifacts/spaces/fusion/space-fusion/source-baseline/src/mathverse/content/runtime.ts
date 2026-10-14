import { Sphere,Vector2,Vector3,type Group,type Object3D } from 'three';
import { NODE_LAYOUT,nodePosition,type NodePlacement } from './layout.ts';
import { READING } from '../config/reading.ts';
import { NODE_BY_ID } from './nodes.ts';
import {createConnectionMotion,type ConnectionMotion,type ScreenRect} from '../windows/windowMotion.ts';
import {createEulerStory,type EulerStoryState} from './eulerStory.ts';
import {createRelationState,type RelationState} from '../windows/relationship.ts';
export type NodeRuntime={placement:NodePlacement;position:Vector3;sphere:Sphere;group:Group|null;label:HTMLButtonElement|null;discovered:boolean;onScreen:boolean;emphasized:boolean;alpha:number;screen:Vector2;visualScreen:Vector2;occluded:boolean;bounds:ScreenRect|null};
export type ContentRuntime={nodes:Map<string,NodeRuntime>;occluders:Object3D[];pickCount:number;openCount:number;blockedCount:number;observation:Record<string,unknown>|null;connection:ConnectionMotion;relation:RelationState;relationLabel:HTMLDivElement|null;readingOrigin:ScreenRect|null;windowElement:HTMLDivElement|null;euler:EulerStoryState;worldStates:Record<string,{angle:number;marker:number[]|null}>};
export function createContentRuntime(layout:readonly NodePlacement[]=NODE_LAYOUT):ContentRuntime{return{nodes:new Map(layout.map(placement=>{
  const position=new Vector3(...nodePosition(placement));
  const extents={identity:3.8,gaussian:3.8,circle:3.8,mobius:3.8,person:3.8,rotation:3.8};
  const radius=Math.max(READING.pickRadius,extents[NODE_BY_ID.get(placement.id)!.rendererKey]);
  return[placement.id,{placement,position,sphere:new Sphere(position,radius*placement.scale),group:null,label:null,discovered:false,onScreen:false,emphasized:false,alpha:0,screen:new Vector2(),visualScreen:new Vector2(),occluded:false,bounds:null}];
})),occluders:[],pickCount:0,openCount:0,blockedCount:0,observation:null,connection:createConnectionMotion(),relation:createRelationState(),relationLabel:null,readingOrigin:null,windowElement:null,euler:createEulerStory(),worldStates:{}};}
