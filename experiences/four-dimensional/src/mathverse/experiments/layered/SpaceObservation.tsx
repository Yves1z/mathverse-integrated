import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import type { ContentRuntime } from '../../content/runtime';
import type { MotionState } from '../../config/motion';
import type { ReadingState } from '../../reading/ReadingKernel';
import type { WindowAssets } from '../../windows/WindowAssets';
import { mixRect, readingRect } from '../../windows/windowMotion';

// One compositor owns both the exterior and the growing reading viewport.
export function SpaceObservation({ motion, reading, windows, runtime }: { motion: MotionState; reading: ReadingState; windows: WindowAssets; runtime: ContentRuntime }) {
  const { gl, scene, camera, size } = useThree();
  const view = useMemo(() => new PerspectiveCamera(44, 1, .05, 90), []);
  const eye = useMemo(() => new Vector3(), []), subject = useMemo(() => new Vector3(), []);
  const finalEye = useMemo(() => new Vector3(2.8, .28, 8), []), forward = useMemo(() => new Quaternion(), []);
  const counter = useRef(0), turn = useRef(0);
  useFrame(() => {
    const autoClear = gl.autoClear, autoReset = gl.info.autoReset, target = gl.getRenderTarget();
    gl.info.autoReset = false; gl.info.reset(); gl.autoClear = true; gl.toneMappingExposure = 1;
    const candidates = [...windows.worlds].filter(([id, world]) => !world.initialized || (runtime.nodes.get(id)?.onScreen && !runtime.nodes.get(id)?.occluded && runtime.nodes.get(id)!.alpha > .1));
    const chosen = candidates.length ? candidates[turn.current++ % candidates.length]?.[0] : null;
    const active = motion.frameDt > 0 && !motion.suspended && !document.hidden && (!motion.spaceFrozen || reading.phase !== 'closed');
    for (const [id, world] of windows.worlds) {
      if (world.initialized && !(active && id === chosen)) continue;
      const node = runtime.nodes.get(id)!;
      if (node.group) {
        node.group.worldToLocal(eye.copy(camera.position)); const depth = Math.max(3, Math.abs(eye.z));
        world.camera.aspect = 5.9 * node.group.scale.x / (3.7 * node.group.scale.y);
        world.camera.position.set(Math.max(-1.6, Math.min(1.6, eye.x / depth * 1.25)), Math.max(-1, Math.min(1, eye.y / depth * 1.25)), 7);
        world.camera.lookAt(0, 0, -4); world.camera.updateProjectionMatrix(); world.camera.updateMatrixWorld();
      }
      gl.setRenderTarget(world.target); gl.setScissorTest(false); gl.render(world.scene, world.camera);
      world.initialized = true; world.lastRendered = counter.current;
    }
    gl.setRenderTarget(null); gl.setViewport(0, 0, size.width, size.height); gl.setScissorTest(false); gl.render(scene, camera);
    const world = reading.selectedId ? windows.worlds.get(reading.selectedId) : undefined;
    if (world && reading.progress > .0001) {
      const final = readingRect(size.width, size.height);
      const rect = mixRect(runtime.readingOrigin ?? { x: size.width * .36, y: size.height * .35, width: size.width * .28, height: size.height * .3 }, final, reading.progress);
      rect.width = Math.max(2, rect.width); rect.height = Math.max(2, rect.height);
      view.copy(world.camera); view.aspect = rect.width / rect.height; view.position.lerp(finalEye, reading.progress); view.quaternion.slerp(forward, reading.progress);
      view.updateProjectionMatrix(); view.updateMatrixWorld();
      gl.setViewport(rect.x, size.height - rect.y - rect.height, rect.width, rect.height);
      gl.setScissor(rect.x, size.height - rect.y - rect.height, rect.width, rect.height); gl.setScissorTest(true);
      gl.render(world.scene, view);
      const element = runtime.windowElement;
      if (element) {
        element.style.left = `${rect.x}px`; element.style.top = `${rect.y}px`; element.style.width = `${rect.width}px`; element.style.height = `${rect.height}px`;
        element.style.setProperty('--reading-content', `${Math.max(0, (reading.progress - .5) * 2)}`);
      }
      subject.set(0, 0, -4).project(view);
      runtime.observation = { selectedId: reading.selectedId, screen: [rect.x + (subject.x + 1) * rect.width / 2, rect.y + (1 - subject.y) * rect.height / 2], rect, area: rect.width * rect.height / (size.width * size.height), outsideVisible: true, depthTest: true, camera: view.position.toArray(), angle: runtime.connection.angle };
    } else runtime.observation = null;
    gl.setRenderTarget(target); gl.setScissorTest(false); gl.setViewport(0, 0, size.width, size.height); gl.autoClear = autoClear; gl.info.autoReset = autoReset;
    scene.userData.cinematic = { bloom: false, exposure: 1, windowResolution: [640, 410], reading: 'direct-screen', worldParticles: 960 };
    counter.current++;
  }, 1);
  return null;
}
