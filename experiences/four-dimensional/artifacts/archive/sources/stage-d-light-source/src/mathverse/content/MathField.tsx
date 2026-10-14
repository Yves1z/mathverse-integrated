import { useEffect,useRef } from 'react';
import { useFrame,useThree } from '@react-three/fiber';
import { Raycaster,Vector3 } from 'three';
import { NODE_BY_ID } from './nodes';
import type { MathAssets } from './assets';
import type { ContentRuntime } from './runtime';
import { PortalWindow } from '../windows/PortalWindow';
import { WindowWorld } from '../windows/WindowWorld';
import type { WindowAssets } from '../windows/WindowAssets';
import {WINDOW} from '../windows/windowMotion';
import { blockingDistance } from './picking';
import { READING } from '../config/reading';
import type { ReadingState } from '../reading/ReadingKernel';
import type { MotionState } from '../config/motion';

export function MathField({motion,reading,runtime,assets,windows}:{motion:MotionState;reading:ReadingState;runtime:ContentRuntime;assets:MathAssets;windows:WindowAssets}){
  const {camera,scene,size}=useThree();
  const projected=useRef(new Vector3()),labelPoint=useRef(new Vector3()),direction=useRef(new Vector3()),raycaster=useRef(new Raycaster());
  const occlusionClock=useRef(1);
  const corner=useRef(new Vector3());
  useEffect(()=>{runtime.occluders=[];scene.traverse(object=>{if(object.userData.mathOccluder)runtime.occluders.push(object);});},[scene,runtime]);
  useFrame(()=>{
    occlusionClock.current+=motion.frameDt;
    const checkOcclusion=occlusionClock.current>0.12;
    if(checkOcclusion){occlusionClock.current=0;runtime.occluders=[];scene.traverse(object=>{if(object.userData.mathOccluder)runtime.occluders.push(object);});}
    scene.updateMatrixWorld();
    const ranked:Array<{id:string;distance:number}>=[];
    for(const[id,node]of runtime.nodes){
      if(node.group){const [pitch,yaw,roll]=node.placement.orientation;
        node.group.rotation.set(pitch+0.025*Math.sin(motion.spaceTime*0.029),yaw+0.055*Math.sin(motion.spaceTime*0.035+node.placement.anchor.chunkId*0.24),roll);
        node.group.updateMatrixWorld(true);
      }
      const distance=camera.position.distanceTo(node.position);
      if(node.discovered){if(distance>node.placement.discoveryRange+READING.discoveryHysteresis)node.discovered=false;}
      else if(distance<node.placement.discoveryRange)node.discovered=true;
      projected.current.copy(node.position).project(camera);
      node.visualScreen.set((projected.current.x+1)*size.width/2,(1-projected.current.y)*size.height/2);
      const xLimit=node.onScreen?1.03:0.94,yLimit=node.onScreen?0.98:0.90;
      node.onScreen=projected.current.z>-1&&projected.current.z<1&&Math.abs(projected.current.x)<xLimit&&Math.abs(projected.current.y)<yLimit;
      if(checkOcclusion && node.onScreen){
        direction.current.copy(node.position).sub(camera.position).normalize();raycaster.current.set(camera.position,direction.current);
        node.occluded=blockingDistance(raycaster.current,runtime.occluders)<distance-0.1;
      }
      if(node.discovered&&node.onScreen&&!node.occluded)ranked.push({id,distance});
      const selected=reading.selectedId===id;
      const visible=motion.phase!=='idle'&&distance<node.placement.discoveryRange+12;
      node.alpha=visible?(node.discovered?1:0.36)*(selected?1-reading.progress:1):0;
      if(node.group)node.group.visible=visible&&node.alpha>0.001;
      if(node.group&&node.onScreen){
        let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
        for(const x of [-WINDOW.width/2,WINDOW.width/2])for(const y of [-WINDOW.height/2,WINDOW.height/2]){
          corner.current.set(x,y,0).applyMatrix4(node.group.matrixWorld).project(camera);
          const px=(corner.current.x+1)*size.width/2,py=(1-corner.current.y)*size.height/2;minX=Math.min(minX,px);minY=Math.min(minY,py);maxX=Math.max(maxX,px);maxY=Math.max(maxY,py);
        }
        node.bounds={x:minX,y:minY,width:maxX-minX,height:maxY-minY};
      }else node.bounds=null;
    }
    const emphasized=new Set(ranked.sort((a,b)=>(a.id===reading.hoveredId?-1000:a.distance)-(b.id===reading.hoveredId?-1000:b.distance)).slice(0,READING.maxEmphasis).map(node=>node.id));
    for(const[id,node]of runtime.nodes){
      node.emphasized=emphasized.has(id);
      if(!node.emphasized)node.alpha*=0.65;
      if(!node.label)continue;
      labelPoint.current.set(0,-WINDOW.height/2-0.72,0);if(node.group)labelPoint.current.applyMatrix4(node.group.matrixWorld);else labelPoint.current.copy(node.position);labelPoint.current.project(camera);
      node.screen.set((labelPoint.current.x+1)*size.width/2,(1-labelPoint.current.y)*size.height/2);
      const shown=node.emphasized&&reading.phase==='closed'&&motion.phase==='exploring'&&node.screen.y<size.height-70;
      node.label.style.transform=`translate(${node.screen.x}px,${node.screen.y}px) translate(-50%,0)`;
      node.label.style.opacity=shown?'1':'0';node.label.style.visibility=shown?'visible':'hidden';node.label.style.pointerEvents=shown?'auto':'none';
      node.label.tabIndex=shown?0:-1;node.label.setAttribute('aria-hidden',shown?'false':'true');
    }
  });
  return <group name="math-nodes">{[...runtime.nodes].map(([id,node])=><group key={id} name={`math-node-${id}`} ref={group=>{node.group=group;}} position={node.position} rotation={node.placement.orientation} scale={node.placement.scale}>
    <PortalWindow id={id} kind={NODE_BY_ID.get(id)!.rendererKey} assets={assets} windows={windows} opacity={()=>node.alpha}/>
    <WindowWorld node={NODE_BY_ID.get(id)!} assets={assets} windows={windows} runtime={runtime} reading={reading}/>
  </group>)}</group>;
}
