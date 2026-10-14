import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import type { ContentRuntime } from '../../content/runtime';
import type { ReadingState } from '../../reading/ReadingKernel';
import type { WindowAssets } from '../../windows/WindowAssets';
import { mixRect, readingRect } from '../../windows/windowMotion';

// Render the reading world after the exterior contact-shadow pass. This keeps
// the same exterior treatment throughout focusing, reading and returning.
export function ReferenceObservation({reading,runtime,windows}:{reading:ReadingState;runtime:ContentRuntime;windows:WindowAssets}){
  const {gl,size}=useThree(),view=useMemo(()=>new PerspectiveCamera(44,1,.05,90),[]),subject=useMemo(()=>new Vector3(),[]);
  useFrame(()=>{
    const world=reading.selectedId?windows.worlds.get(reading.selectedId):null;
    if(!world||reading.progress<.0001){runtime.observation=null;return;}
    const rect=mixRect(runtime.readingOrigin??{x:size.width*.36,y:size.height*.35,width:size.width*.28,height:size.height*.30},readingRect(size.width,size.height),reading.progress);
    rect.width=Math.max(2,rect.width);rect.height=Math.max(2,rect.height);
    view.aspect=rect.width/rect.height;view.position.set(2.8*reading.progress,.28*reading.progress,7+reading.progress);view.quaternion.identity();view.updateProjectionMatrix();view.updateMatrixWorld();
    const auto=gl.autoClear,reset=gl.info.autoReset,exposure=gl.toneMappingExposure,target=gl.getRenderTarget();gl.info.autoReset=false;gl.autoClear=true;gl.toneMappingExposure=1;
    gl.setRenderTarget(null);gl.setViewport(rect.x,size.height-rect.y-rect.height,rect.width,rect.height);gl.setScissor(rect.x,size.height-rect.y-rect.height,rect.width,rect.height);gl.setScissorTest(true);gl.render(world.scene,view);
    const element=runtime.windowElement;if(element){element.style.left=`${rect.x}px`;element.style.top=`${rect.y}px`;element.style.width=`${rect.width}px`;element.style.height=`${rect.height}px`;element.style.setProperty('--reading-content',String(Math.max(0,(reading.progress-.5)*2)));}
    subject.set(0,0,-4).project(view);runtime.observation={selectedId:reading.selectedId,rect,area:rect.width*rect.height/(size.width*size.height),outsideVisible:true,screen:[rect.x+(subject.x+1)*rect.width/2,rect.y+(1-subject.y)*rect.height/2],camera:view.position.toArray(),angle:runtime.connection.angle,exteriorContactPreserved:true};
    gl.setScissorTest(false);gl.setViewport(0,0,size.width,size.height);gl.setRenderTarget(target);gl.autoClear=auto;gl.info.autoReset=reset;gl.toneMappingExposure=exposure;
  },2);
  return null;
}
