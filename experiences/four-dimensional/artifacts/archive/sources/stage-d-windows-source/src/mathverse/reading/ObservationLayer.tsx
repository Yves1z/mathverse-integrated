import {useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {PerspectiveCamera,Quaternion,Vector3} from 'three';
import type {ContentRuntime} from '../content/runtime';
import type {MotionState} from '../config/motion';
import type {ReadingState} from './ReadingKernel';
import type {WindowAssets} from '../windows/WindowAssets';
import {mixRect,readingRect,type ScreenRect} from '../windows/windowMotion';

export function ObservationLayer({motion,reading,selectedId,windows,runtime}:{motion:MotionState;reading:ReadingState;selectedId:string|null;windows:WindowAssets;runtime:ContentRuntime}){
  const {gl,scene,camera,size}=useThree();
  const view=useMemo(()=>new PerspectiveCamera(44,1,0.05,90),[]),eye=useMemo(()=>new Vector3(),[]);
  const finalEye=useMemo(()=>new Vector3(2.8,0.28,8),[]),forward=useMemo(()=>new Quaternion(),[]);
  const subjectPoint=useMemo(()=>new Vector3(),[]);
  const counter=useRef(0),turn=useRef(0);
  useFrame(()=>{
    const autoClear=gl.autoClear,autoReset=gl.info.autoReset,target=gl.getRenderTarget();
    gl.info.autoReset=false;gl.info.reset();gl.autoClear=true;
    const candidates=[...windows.worlds].filter(([id,world])=>!world.initialized||(runtime.nodes.get(id)?.onScreen&&runtime.nodes.get(id)!.alpha>0.1));
    const canAnimate=motion.frameDt>0&&!motion.suspended&&!document.hidden;
    const chosen=candidates.length?candidates[turn.current++%candidates.length]:undefined;
    for(const [id,world] of windows.worlds){
      if(world.initialized&&(!(canAnimate&&chosen?.[0]===id)))continue;
      const node=runtime.nodes.get(id)!;
      if(node.group){
        node.group.worldToLocal(eye.copy(camera.position));const depth=Math.max(3,Math.abs(eye.z));
        world.camera.position.set(Math.max(-1.6,Math.min(1.6,eye.x/depth*1.25)),Math.max(-1,Math.min(1,eye.y/depth*1.25)),7);
        world.camera.lookAt(0,0,-4);world.camera.updateMatrixWorld();
      }
      gl.setRenderTarget(world.target);gl.render(world.scene,world.camera);world.initialized=true;world.lastRendered=counter.current;
    }
    gl.setRenderTarget(target);gl.setViewport(0,0,size.width,size.height);gl.setScissorTest(false);gl.render(scene,camera);
    const world=selectedId?windows.worlds.get(selectedId):undefined;
    if(world&&reading.progress>0.0001){
      const final=readingRect(size.width,size.height);
      const fallback={x:size.width*0.36,y:size.height*0.35,width:size.width*0.28,height:size.height*0.30};
      const start=runtime.readingOrigin??fallback;
      const rect=mixRect(start,final,reading.progress);
      const safe:ScreenRect={...rect,width:Math.max(2,rect.width),height:Math.max(2,rect.height)};
      view.copy(world.camera);view.aspect=safe.width/safe.height;
      view.position.lerp(finalEye,reading.progress);view.quaternion.slerp(forward,reading.progress);
      view.updateProjectionMatrix();view.updateMatrixWorld();
      gl.autoClear=false;gl.setViewport(safe.x,size.height-safe.y-safe.height,safe.width,safe.height);
      gl.setScissor(safe.x,size.height-safe.y-safe.height,safe.width,safe.height);gl.setScissorTest(true);gl.clearDepth();
      // Clear only the interior; the unmasked world remains visible around it.
      gl.autoClear=true;gl.render(world.scene,view);gl.autoClear=false;
      const element=runtime.windowElement;
      if(element){element.style.left=`${safe.x}px`;element.style.top=`${safe.y}px`;element.style.width=`${safe.width}px`;element.style.height=`${safe.height}px`;element.style.setProperty('--reading-content',`${Math.max(0,(reading.progress-0.5)*2)}`);}
      subjectPoint.set(0,0,-4).project(view);
      runtime.observation={selectedId,screen:[safe.x+(subjectPoint.x+1)*safe.width/2,safe.y+(1-subjectPoint.y)*safe.height/2],rect:safe,area:safe.width*safe.height/(size.width*size.height),outsideVisible:true,depthTest:true,camera:view.position.toArray(),angle:runtime.connection.angle};
    }else runtime.observation=null;
    gl.setScissorTest(false);gl.setViewport(0,0,size.width,size.height);gl.autoClear=autoClear;gl.info.autoReset=autoReset;counter.current++;
  },1);
  return null;
}
