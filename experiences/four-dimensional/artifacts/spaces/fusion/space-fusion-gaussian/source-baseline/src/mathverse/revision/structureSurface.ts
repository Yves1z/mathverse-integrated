import { BufferGeometry, DynamicDrawUsage, InstancedBufferAttribute, Material, MeshBasicMaterial, MeshDepthMaterial, MeshStandardMaterial, RGBADepthPacking } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { BeamKind } from './spaceModel';

type Shader = Parameters<Material['onBeforeCompile']>[0];

// Instance transforms contain rotation and translation only. Build the section in
// object space so a long beam has the same physical edge radius as a short one.
const beamVertex = /* glsl */`
  float edgeRadius = min(min(beamSize.x, beamSize.z) * 0.12, 0.11);
  vec3 transformed = sign(position) * (beamSize * 0.5 - edgeRadius) + normal * edgeRadius;
`;

function shapeShader(shader: Shader, surface: boolean) {
  shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
    attribute vec3 beamSize;
    ${surface ? 'attribute float beamSeed; varying vec3 vBeamLocal; varying float vBeamSeed;' : ''}`)
    .replace('#include <begin_vertex>', beamVertex + (surface ? 'vBeamLocal = transformed; vBeamSeed = beamSeed;' : ''));
}

const surfaceNoise = /* glsl */`
  varying vec3 vBeamLocal;
  varying float vBeamSeed;
  float surfaceHash(vec3 p) {
    p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float surfaceNoise(vec3 p) {
    vec3 cell = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(surfaceHash(cell), surfaceHash(cell+vec3(1,0,0)), f.x),
      mix(surfaceHash(cell+vec3(0,1,0)), surfaceHash(cell+vec3(1,1,0)), f.x), f.y),
      mix(mix(surfaceHash(cell+vec3(0,0,1)), surfaceHash(cell+vec3(1,0,1)), f.x),
      mix(surfaceHash(cell+vec3(0,1,1)), surfaceHash(cell+vec3(1,1,1)), f.x), f.y), f.z);
  }
`;

export function createStructureGeometry(kind: BeamKind, count: number): BufferGeometry {
  const geometry = new RoundedBoxGeometry(1, 1, 1, kind === 'primary' ? 2 : 1, .1);
  geometry.setAttribute('beamSize', new InstancedBufferAttribute(new Float32Array(count * 3), 3).setUsage(DynamicDrawUsage));
  geometry.setAttribute('beamSeed', new InstancedBufferAttribute(new Float32Array(count), 1));
  return geometry;
}

export function createStructureMaterial(kind: BeamKind): MeshStandardMaterial | MeshBasicMaterial {
  if (kind === 'light') {
    const material = new MeshBasicMaterial({ color: '#eee6d5', toneMapped: false });
    material.onBeforeCompile = shader => shapeShader(shader, false);
    material.customProgramCacheKey = () => 'physical-bevel-light-v1';
    return material;
  }
  const material = new MeshStandardMaterial({
    color: kind === 'primary' ? '#686b6e' : kind === 'joint' ? '#3d4043' : '#5c6063',
    roughness: kind === 'primary' ? .43 : kind === 'joint' ? .62 : .52,
    metalness: kind === 'joint' ? .19 : .28, envMapIntensity: .72, dithering: true,
  });
  material.onBeforeCompile = shader => {
    shapeShader(shader, true);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + surfaceNoise)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // A fine, nearly uniform ceramic graphite finish. Filtering suppresses
        // the grain in the distance; its coordinates stay attached to the beam.
        vec3 finishPoint = vBeamLocal + vec3(vBeamSeed * 31.7);
        float satin = surfaceNoise(finishPoint * 1.7) - 0.5;
        float grainFade = 1.0 - smoothstep(0.015, 0.07, length(fwidth(vBeamLocal)));
        float grain = (surfaceHash(floor(finishPoint * 55.0)) - 0.5) * grainFade;
        diffuseColor.rgb *= 1.0 + satin * 0.075 + grain * 0.025;
      `)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + satin * 0.035 + grain * 0.035, 0.25, 0.85);');
  };
  material.customProgramCacheKey = () => 'physical-bevel-satin-v1';
  return material;
}

export function createStructureDepthMaterial() {
  const material = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  // Use exactly the same vertex remapping in the shadow pass.
  material.onBeforeCompile = shader => shapeShader(shader, false);
  material.customProgramCacheKey = () => 'physical-bevel-depth-v1';
  return material;
}
