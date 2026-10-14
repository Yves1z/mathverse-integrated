import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Vector3 } from 'three';
import { MOTION, entryZ, type MotionState, type Phase } from '../config/motion';

export function CameraDirector({ motion, onPhase }: {
  motion: MotionState;
  onPhase: (phase: Phase) => void;
}) {
  const { camera, gl, scene } = useThree();
  const euler = useMemo(() => new Euler(0, 0, 0, 'YXZ'), []);
  const direction = useMemo(() => new Vector3(), []);

  useEffect(() => {
    const canvas = gl.domElement;
    let pointerId: number | null = null;
    let previousX = 0, previousY = 0;
    const end = () => {
      if (pointerId !== null && canvas.hasPointerCapture(pointerId)) {
        canvas.releasePointerCapture(pointerId);
      }
      pointerId = null;
      motion.dragging = false;
      canvas.classList.remove('is-dragging');
    };
    const down = (event: PointerEvent) => {
      if (motion.phase !== 'exploring' || document.hidden || event.button !== 0) return;
      motion.suspended = false;
      pointerId = event.pointerId;
      previousX = event.clientX;
      previousY = event.clientY;
      canvas.setPointerCapture(pointerId);
      motion.dragging = true;
      canvas.classList.add('is-dragging');
    };
    const move = (event: PointerEvent) => {
      if (pointerId !== event.pointerId || motion.phase !== 'exploring') return;
      const sensitivity = Math.PI / Math.max(1, canvas.clientWidth);
      const dx = Math.max(-MOTION.maxPointerAngle, Math.min(MOTION.maxPointerAngle, (event.clientX - previousX) * sensitivity));
      const dy = Math.max(-MOTION.maxPointerAngle, Math.min(MOTION.maxPointerAngle, (previousY - event.clientY) * sensitivity));
      motion.targetYaw += dx;
      motion.targetPitch = Math.max(-MOTION.pitchLimit, Math.min(MOTION.pitchLimit, motion.targetPitch + dy));
      previousX = event.clientX;
      previousY = event.clientY;
    };
    const visibility = () => { motion.suspended = document.hidden; if (document.hidden) end(); };
    const blur = () => { motion.suspended = true; end(); };
    const focus = () => { motion.suspended = document.hidden; };
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
        return {
          ...motion,
          position: camera.position.toArray(),
          direction: direction.toArray(),
          quaternion: camera.quaternion.toArray(),
          drawCalls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          geometries: gl.info.memory.geometries,
          textures: gl.info.memory.textures,
          structure: scene.getObjectByName("structure-field")?.userData,
        };
      },
    };
    return () => { delete window.__mathverse; };
  }, [camera, gl, scene, motion, direction]);

  useFrame((_, rawDt) => {
    const dt = motion.suspended ? 0 : Math.min(rawDt, MOTION.maxDt);
    if (motion.phase === 'idle') {
      motion.z = MOTION.initialZ;
      motion.pitch = MOTION.initialPitch;
    } else if (motion.phase === 'entering') {
      motion.elapsed += dt;
      const t = (motion.elapsed - MOTION.entryDelay) / MOTION.entryDuration;
      motion.z = entryZ(t);
      const u = Math.max(0, Math.min(1, t));
      motion.pitch = MOTION.initialPitch * (1 - u * u * (3 - 2 * u));
      if (t >= 1) {
        motion.phase = 'exploring';
        motion.pitch = motion.targetPitch;
        onPhase('exploring');
      }
    } else {
      if (!motion.paused) motion.distance += MOTION.explorationSpeed * dt;
      motion.z = MOTION.entryEndZ - motion.distance;
      const blend = 1 - Math.exp(-MOTION.lookDamping * dt);
      motion.yaw += (motion.targetYaw - motion.yaw) * blend;
      motion.pitch += (motion.targetPitch - motion.pitch) * blend;
    }
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

