import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, Group, InstancedMesh, Object3D, Vector3 } from 'three';
import type { ContentRuntime } from '../content/runtime';
import type { ReadingState } from '../reading/ReadingKernel';
import { WINDOW } from '../windows/windowMotion';

export function SpaceRelations({ runtime, reading }: { runtime: ContentRuntime; reading: ReadingState }) {
  const root = useRef<Group>(null), markers = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new BufferGeometry().setAttribute('position', new Float32BufferAttribute(new Float32Array(6 * 3), 3)), []);
  const scratch = useMemo(() => ({ a: new Vector3(), b: new Vector3(), dummy: new Object3D() }), []);
  useFrame(() => {
    const ids = ['euler-identity', 'complex-rotation', 'unit-circle']; const attribute = geometry.getAttribute('position');
    for (let i = 0; i < 3; i++) {
      const first = runtime.nodes.get(ids[i])!;
      if (!first.group) continue;
      // A short trace on each aperture's own frame replaces diagonal lines across the void.
      const g = first.group;
      scratch.a.set(-WINDOW.width / 2, WINDOW.height / 2 + .1, .16).applyMatrix4(g.matrixWorld);
      scratch.b.set(WINDOW.width / 2, WINDOW.height / 2 + .1, .16).applyMatrix4(g.matrixWorld);
      attribute.setXYZ(i * 2, ...scratch.a.toArray()); attribute.setXYZ(i * 2 + 1, ...scratch.b.toArray());
      const t = (Math.cos(runtime.connection.angle) + 1) / 2;
      scratch.dummy.position.copy(scratch.a).lerp(scratch.b, t); scratch.dummy.scale.setScalar(.065); scratch.dummy.updateMatrix();
      markers.current?.setMatrixAt(i, scratch.dummy.matrix);
    }
    attribute.needsUpdate = true; if (markers.current) markers.current.instanceMatrix.needsUpdate = true;
    if (root.current) { root.current.visible = reading.phase === 'closed'; root.current.userData = { sharedAngle: runtime.connection.angle, relatedIds: ids, traces: 3, particles: 3 }; }
  }, -.2);
  return <group ref={root} name="space-euler-relation">
    <lineSegments geometry={geometry}><lineBasicMaterial color="#d1c6ae" transparent opacity={.2} depthWrite={false}/></lineSegments>
    <instancedMesh ref={markers} args={[undefined, undefined, 3]} frustumCulled={false}><sphereGeometry args={[1, 8, 6]}/><meshBasicMaterial color="#ddd3bd"/></instancedMesh>
  </group>;
}
