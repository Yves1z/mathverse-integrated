import { useMemo,useRef } from 'react';
import { createPortal,useFrame,useThree } from '@react-three/fiber';
import { Group,MeshBasicMaterial,PerspectiveCamera,Scene,Vector3 } from 'three';
import { NODE_BY_ID } from '../content/nodes';
import { NodeVisual } from '../content/NodeVisual';
import type { MathAssets } from '../content/assets';
import type { ContentRuntime } from '../content/runtime';
import type { ReadingState } from './ReadingKernel';

export function ObservationLayer({reading,selectedId,assets,runtime}:{reading:ReadingState;selectedId:string|null;assets:MathAssets;runtime:ContentRuntime}){
  const {gl,scene,camera,size}=useThree();
  const layer=useMemo(()=>new Scene(),[]),view=useMemo(()=>{const camera=new PerspectiveCamera(55,1,0.05,60);camera.position.z=8;return camera;},[]);
  const subject=useRef<Group>(null),veil=useRef<MeshBasicMaterial>(null),point=useMemo(()=>new Vector3(),[]);
  const node=selectedId?NODE_BY_ID.get(selectedId):undefined;
  useFrame(()=>{
    view.aspect=size.width/size.height;view.updateProjectionMatrix();
    const height=2*Math.tan(55*Math.PI/360)*8,width=height*view.aspect;
    const panel=Math.max(340,Math.min(480,size.width*0.31)),right=size.width*0.045,gap=64;
    const available=Math.max(260,size.width-panel-right-gap);
    if(subject.current&&node){
      const extent=node.rendererKey==='gaussian'?5.2:node.rendererKey==='mobius'?2.8:node.rendererKey==='circle'?2.9:3.8;
      const scale=Math.min(2.3,(available/size.width*width-0.8)/extent,height*0.56/2.9);
      subject.current.position.set(-width*(panel+right+gap)/(2*size.width),0.25,0);
      subject.current.scale.setScalar(Math.max(0.6,scale));subject.current.updateMatrixWorld(true);
      point.copy(subject.current.position).project(view);
      runtime.observation={selectedId,screen:[(point.x+1)*size.width/2,(1-point.y)*size.height/2],scale:subject.current.scale.x,position:subject.current.position.toArray(),camera:view.position.toArray(),depthTest:true};
    }else runtime.observation=null;
    if(veil.current)veil.current.opacity=reading.progress*0.72;
    // One compositor owns final rendering; the observation scene keeps its own depth buffer.
    const autoClear=gl.autoClear,autoReset=gl.info.autoReset;
    gl.info.autoReset=false;gl.info.reset();gl.autoClear=true;gl.render(scene,camera);
    if(node&&reading.progress>0.0001){gl.autoClear=false;gl.clearDepth();gl.render(layer,view);}
    gl.autoClear=autoClear;gl.info.autoReset=autoReset;
  },1);
  return createPortal(<>
    <ambientLight intensity={1.1}/><directionalLight position={[3,5,8]} intensity={2.8}/><directionalLight position={[-4,-2,3]} intensity={1.2} color="#d7d6c5"/>
    <mesh position={[0,0,-5]}><planeGeometry args={[100,100]}/><meshBasicMaterial ref={veil} color="#050708" transparent depthWrite={false}/></mesh>
    {node&&<group ref={subject} name="observation-subject"><NodeVisual key={node.id} kind={node.rendererKey} assets={assets} opacity={()=>reading.progress} reading={reading}/></group>}
  </>,layer,{camera:view});
}
