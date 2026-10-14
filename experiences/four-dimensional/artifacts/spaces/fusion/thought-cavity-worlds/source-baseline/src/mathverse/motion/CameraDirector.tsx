import { useEffect,useMemo,useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Raycaster, Vector2, Vector3 } from 'three';
import { MOTION, type MotionState, type Phase } from '../config/motion';
import { addLookInput, advanceMotion, resumeMotion, suspendMotion } from './MotionKernel';
import { advanceReading,setHovered,type ReadingPhase,type ReadingState } from '../reading/ReadingKernel';
import type { ContentRuntime } from '../content/runtime';
import { pickNode } from '../content/picking';

export function CameraDirector({ motion,onPhase,reading,runtime,onOpen,onHover,onReadingPhase,priority=0 }: { motion:MotionState;onPhase:(phase:Phase)=>void;reading:ReadingState;runtime:ContentRuntime;onOpen:(id:string)=>void;onHover:(id:string|null)=>void;onReadingPhase:(phase:ReadingPhase)=>void;priority?:number }) {
  const { camera, gl, scene } = useThree();
  const euler = useMemo(() => new Euler(0, 0, 0, 'YXZ'), []);
  const direction = useMemo(() => new Vector3(), []);
  const localPoint = useMemo(() => new Vector3(), []);
  const refreshHover=useRef<(()=>void)|null>(null),hoverClock=useRef(0);

  useEffect(() => {
    const canvas = gl.domElement;
    let pointerId: number | null = null;
    let originX = 0, originY = 0, previousX = 0, previousY = 0;
    let maximumDistance=0;
    const raycaster=new Raycaster(),pointer=new Vector2();
    const mouse={x:NaN,y:NaN};
    const candidate=(event:Pick<PointerEvent,'clientX'|'clientY'>)=>{
      const rect=canvas.getBoundingClientRect();
      pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
      camera.updateMatrixWorld();raycaster.setFromCamera(pointer,camera);return pickNode(raycaster,runtime);
    };
    const hover=(id:string|null)=>{if(reading.hoveredId===id)return;setHovered(reading,id);onHover(id);canvas.classList.toggle('over-math',!!id);};
    const end = () => {
      const captured = pointerId;
      pointerId = null;
      motion.dragging = false;
      canvas.classList.remove('is-dragging');
      if (captured !== null && canvas.hasPointerCapture(captured)) canvas.releasePointerCapture(captured);
    };
    const down = (event: PointerEvent) => {
      if (motion.phase !== 'exploring' || reading.phase!=='closed' || document.hidden || event.button !== 0 || !event.isPrimary || pointerId !== null) return;
      resumeMotion(motion);
      pointerId = event.pointerId;
      originX = previousX = event.clientX;
      originY = previousY = event.clientY;
      maximumDistance=0;
      canvas.setPointerCapture(pointerId);
    };
    const move = (event: PointerEvent) => {
      mouse.x=event.clientX;mouse.y=event.clientY;
      if(motion.phase!=='exploring'||reading.phase!=='closed')return;
      if(pointerId===null){hover(candidate(event));return;}
      if(pointerId!==event.pointerId)return;
      if ((event.buttons & 1) === 0) { end(); return; }
      maximumDistance=Math.max(maximumDistance,Math.hypot(event.clientX-originX,event.clientY-originY));
      if (!motion.dragging) {
        if (maximumDistance < MOTION.dragThreshold) return;
        motion.dragging = true;
        hover(null);
        canvas.classList.add('is-dragging');
      }
      const sensitivity = Math.PI / Math.max(1, canvas.clientWidth);
      const dx = Math.max(-MOTION.maxPointerAngle, Math.min(MOTION.maxPointerAngle, (event.clientX - previousX) * sensitivity));
      const dy = Math.max(-MOTION.maxPointerAngle, Math.min(MOTION.maxPointerAngle, (previousY - event.clientY) * sensitivity));
      addLookInput(motion, dx, dy);
      previousX = event.clientX;
      previousY = event.clientY;
      event.preventDefault();
    };
    const up=(event:PointerEvent)=>{
      if(pointerId!==event.pointerId)return;
      maximumDistance=Math.max(maximumDistance,Math.hypot(event.clientX-originX,event.clientY-originY));
      const click=!motion.dragging&&maximumDistance<MOTION.dragThreshold&&reading.phase==='closed';
      const id=click?candidate(event):null;end();
      if(id){mouse.x=mouse.y=NaN;hover(null);runtime.openCount++;onOpen(id);}
    };
    const leave=()=>{mouse.x=mouse.y=NaN;if(pointerId===null)hover(null);};
    refreshHover.current=()=>{
      if(reading.phase!=='closed'||motion.phase!=='exploring'||motion.dragging||!Number.isFinite(mouse.x))return;
      if(document.elementFromPoint(mouse.x,mouse.y)!==canvas)return;
      hover(candidate({clientX:mouse.x,clientY:mouse.y}));
    };
    const trackMouse=(event:PointerEvent)=>{mouse.x=event.clientX;mouse.y=event.clientY;};
    const blur = () => { mouse.x=mouse.y=NaN;end();hover(null);suspendMotion(motion); };
    const focus = () => { if (!document.hidden) resumeMotion(motion); };
    const visibility = () => { if (document.hidden) blur(); else focus(); };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('lostpointercapture', end);
    window.addEventListener('blur', blur);
    window.addEventListener('pointermove',trackMouse);
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      refreshHover.current=null;
      end();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('pointercancel', end);
      canvas.removeEventListener('lostpointercapture', end);
      window.removeEventListener('blur', blur);
      window.removeEventListener('pointermove',trackMouse);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [gl,camera,motion,reading,runtime,onOpen,onHover]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__mathverse = {
      snapshot: () => {
        camera.getWorldDirection(direction);
        const hinge = scene.getObjectByName('door-hinge');
        const panel = scene.getObjectByName('door-panel');
        let panelClearance = Infinity;
        if (panel) {
          panel.worldToLocal(localPoint.copy(camera.position));
          panelClearance = Math.hypot(Math.max(0, Math.abs(localPoint.x) - 0.647), Math.max(0, -0.004 - localPoint.z, localPoint.z - 0.074));
        }
        return {
          ...motion,
          position: camera.position.toArray(), direction: direction.toArray(), quaternion: camera.quaternion.toArray(),
          doorAngle: hinge?.rotation.y, doorPanelClearance: panelClearance,
          drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles,
          geometries: gl.info.memory.geometries, textures: gl.info.memory.textures,
          structure: scene.getObjectByName('structure-field')?.userData,
          reading:{...reading},observation:runtime.observation,
          connections:scene.getObjectByName('window-connections')?.userData,
          relation:runtime.relation,
          worlds:runtime.worldStates,euler:runtime.euler,
          atmosphere:scene.getObjectByName('mathematical-atmosphere')?.userData,
          lighting:scene.getObjectByName('cinematic-lighting')?.userData,
          cinematic:scene.userData.cinematic,
          nodes:[...runtime.nodes].map(([id,node])=>({id,discovered:node.discovered,onScreen:node.onScreen,occluded:node.occluded,emphasized:node.emphasized,alpha:node.alpha,screen:node.visualScreen.toArray(),labelScreen:node.screen.toArray(),position:node.position.toArray()})),
          picking:{attempts:runtime.pickCount,opened:runtime.openCount,blocked:runtime.blockedCount},
        };
      },
    };
    return () => { delete window.__mathverse; };
  }, [camera,gl,scene,motion,direction,localPoint,reading,runtime]);

  useFrame((_, rawDt) => {
    const previousPhase = motion.phase;
    const previousReading=reading.phase;
    advanceMotion(motion, rawDt);
    advanceReading(motion,reading,motion.frameDt);
    if (motion.phase !== previousPhase) onPhase(motion.phase);
    if(reading.phase!==previousReading)onReadingPhase(reading.phase);
    camera.position.set(0, MOTION.eyeHeight, motion.z);
    camera.quaternion.setFromEuler(euler.set(motion.pitch, -motion.yaw, 0, 'YXZ'));
    hoverClock.current+=motion.frameDt;
    if(hoverClock.current>0.12){hoverClock.current=0;refreshHover.current?.();}
  },priority);
  return null;
}

declare global {
  interface Window {
    __mathverse?: { snapshot: () => Record<string, unknown> };
  }
}
