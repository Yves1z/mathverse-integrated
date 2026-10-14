import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Vector3 } from 'three';
import { MOTION, type MotionState, type Phase } from '../config/motion';
import { addLookInput, advanceMotion, resumeMotion, suspendMotion } from './MotionKernel';

export function CameraDirector({ motion, onPhase }: { motion: MotionState; onPhase: (phase: Phase) => void }) {
  const { camera, gl, scene } = useThree();
  const euler = useMemo(() => new Euler(0, 0, 0, 'YXZ'), []);
  const direction = useMemo(() => new Vector3(), []);
  const localPoint = useMemo(() => new Vector3(), []);

  useEffect(() => {
    const canvas = gl.domElement;
    let pointerId: number | null = null;
    let originX = 0, originY = 0, previousX = 0, previousY = 0;
    const end = () => {
      const captured = pointerId;
      pointerId = null;
      motion.dragging = false;
      canvas.classList.remove('is-dragging');
      if (captured !== null && canvas.hasPointerCapture(captured)) canvas.releasePointerCapture(captured);
    };
    const down = (event: PointerEvent) => {
      if (motion.phase !== 'exploring' || document.hidden || event.button !== 0 || !event.isPrimary || pointerId !== null) return;
      resumeMotion(motion);
      pointerId = event.pointerId;
      originX = previousX = event.clientX;
      originY = previousY = event.clientY;
      canvas.setPointerCapture(pointerId);
    };
    const move = (event: PointerEvent) => {
      if (pointerId !== event.pointerId || motion.phase !== 'exploring') return;
      if ((event.buttons & 1) === 0) { end(); return; }
      if (!motion.dragging) {
        if (Math.hypot(event.clientX - originX, event.clientY - originY) < MOTION.dragThreshold) return;
        motion.dragging = true;
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
    const blur = () => { end(); suspendMotion(motion); };
    const focus = () => { if (!document.hidden) resumeMotion(motion); };
    const visibility = () => { if (document.hidden) blur(); else focus(); };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('lostpointercapture', end);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      end();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', end);
      canvas.removeEventListener('pointercancel', end);
      canvas.removeEventListener('lostpointercapture', end);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [gl, motion]);

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
        };
      },
    };
    return () => { delete window.__mathverse; };
  }, [camera, gl, scene, motion, direction, localPoint]);

  useFrame((_, rawDt) => {
    const previousPhase = motion.phase;
    advanceMotion(motion, rawDt);
    if (motion.phase !== previousPhase) onPhase(motion.phase);
    camera.position.set(0, MOTION.eyeHeight, motion.z);
    camera.quaternion.setFromEuler(euler.set(motion.pitch, -motion.yaw, 0, 'YXZ'));
  });
  return null;
}

declare global {
  interface Window {
    __mathverse?: { snapshot: () => Record<string, unknown> };
  }
}
