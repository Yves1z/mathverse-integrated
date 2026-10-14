import { Raycaster,Vector3,type Intersection,type Object3D,type Ray } from 'three';
import type { ContentRuntime } from './runtime.ts';
export function isSolidHit(hit:Intersection):boolean{
  if(!hit.object.userData.mathOccluder)return false;
  if(hit.object.userData.fadedFaces && hit.face){
    const geometry=(hit.object as Object3D&{geometry?:{getAttribute:(name:string)=>{getX:(index:number)=>number}|undefined}}).geometry;
    const color=geometry?.getAttribute('color');
    if(color && color.getX(hit.face.a)<0.085)return false;
  }
  return true;
}
export function blockingDistance(raycaster:Raycaster,occluders:Object3D[]):number{
  const hit=raycaster.intersectObjects(occluders,false).find(isSolidHit);return hit?.distance??Infinity;
}
export function pickNode(raycaster:Raycaster,runtime:ContentRuntime):string|null{
  raycaster.params.Line.threshold=0.04;
  const point=new Vector3();let nearest=Infinity,id:string|null=null;
  for(const[key,node]of runtime.nodes){
    if(!node.discovered||!node.onScreen||node.alpha<0.12)continue;
    if(!raycaster.ray.intersectSphere(node.sphere,point))continue;
    const actual=node.group?raycaster.intersectObject(node.group,true)[0]:undefined;
    const distance=actual?.distance??node.position.clone().sub(raycaster.ray.origin).dot(raycaster.ray.direction);
    if(distance<nearest){nearest=distance;id=key;}
  }
  if(!id)return null;
  runtime.pickCount++;
  if(blockingDistance(raycaster,runtime.occluders)<nearest-0.04){runtime.blockedCount++;return null;}
  return id;
}
export function hasLineOfSight(ray:Ray,point:Vector3,occluders:Object3D[],raycaster:Raycaster):boolean{
  raycaster.ray.copy(ray);return blockingDistance(raycaster,occluders)>=point.distanceTo(ray.origin)-0.08;
}
