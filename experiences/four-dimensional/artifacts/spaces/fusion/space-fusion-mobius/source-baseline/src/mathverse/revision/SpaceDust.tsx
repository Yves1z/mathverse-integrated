import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial } from 'three';
import type { MotionState } from '../config/motion';
import { SPACE_A, type FoldController } from './spaceModel';

const perSection = 36, count = perSection * SPACE_A.bayCount;
function random(seed: number) { const v = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }
export function SpaceDust({ motion, fold }: { motion: MotionState; fold: FoldController }) {
  const points = useRef<Points>(null);
  const geometry = useMemo(() => {
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('weight', new Float32BufferAttribute(Array.from({ length: count }, (_, i) => .25 + random(i + 70) * .55), 1)); return g;
  }, []);
  const material = useMemo(() => new ShaderMaterial({ transparent: true, depthTest: true, depthWrite: false, uniforms: {},
    vertexShader: `attribute float weight; varying float vAlpha; void main(){vec4 p=modelViewMatrix*vec4(position,1.);float d=-p.z;vAlpha=weight*smoothstep(1.,8.,d)*(1.-smoothstep(32.,100.,d));gl_PointSize=clamp(20./max(1.,d),.6,1.7);gl_Position=projectionMatrix*p;}`,
    fragmentShader: `varying float vAlpha; void main(){float r=length(gl_PointCoord-.5);float a=(1.-smoothstep(.05,.5,r))*vAlpha*.45;gl_FragColor=vec4(.88,.86,.81,a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}` }), []);
  const previous = useRef(-1), first = useRef(Infinity);
  useFrame(() => {
    const start = Math.floor(-motion.z / SPACE_A.bayLength) - SPACE_A.baysBehind;
    if (previous.current === fold.clock && first.current === start) return;
    previous.current = fold.clock; first.current = start;
    const attribute = geometry.getAttribute('position'); let index = 0;
    for (let section = start; section < start + SPACE_A.bayCount; section++) for (let j = 0; j < perSection; j++) {
      const seed = section * 113 + j * 7;
      // Sparse pockets near the side apertures; the central travel corridor stays quiet.
      const side = j % 4 === 0 ? 1 : -1;
      const x = side < 0 ? -28 + random(seed) * 10 : 18 + random(seed) * 6;
      const y = 1 + random(seed + 1) * 17 + Math.sin(fold.clock * .045 + seed) * .22;
      const z = -24 - section * SPACE_A.bayLength + (random(seed + 2) - .5) * 30 + Math.cos(fold.clock * .025 + seed) * .18;
      attribute.setXYZ(index++, x, y, z);
    }
    attribute.needsUpdate = true;
    if (points.current) points.current.userData = { particles: count, clock: fold.clock, localized: true, firstSection: start };
  }, -.3);
  return <points ref={points} name="space-microdust" geometry={geometry} material={material} frustumCulled={false}/>;
}
