import { useEffect, useMemo } from 'react';
import { InstancedBufferAttribute, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import { createReferenceBeams } from './referenceModel';
import { createStructureDepthMaterial, createStructureGeometry, createStructureMaterial } from './structureSurface';

export function ReferenceStructure() {
  const data = useMemo(() => {
    const beams = createReferenceBeams(), dummy = new Object3D();
    const meshes = (['primary','layer','joint'] as const).map(kind => {
      const selected = beams.filter(b => b.kind === kind), geometry = createStructureGeometry(kind,selected.length);
      const material = createStructureMaterial(kind) as MeshStandardMaterial;
      material.color.set(kind === 'primary' ? '#50524c' : kind === 'layer' ? '#555650' : '#454640');
      material.roughness = .88; material.metalness = .025; material.envMapIntensity = .08;
      const compile = material.onBeforeCompile.bind(material);
      material.onBeforeCompile = (shader, renderer) => { compile(shader,renderer);
        shader.fragmentShader = shader.fragmentShader.replace('satin * 0.075 + grain * 0.025','satin * 0.16 + grain * 0.018'); };
      material.customProgramCacheKey = () => 'reference-mineral-v1';
      const mesh = new InstancedMesh(geometry, material, selected.length);
      mesh.customDepthMaterial = createStructureDepthMaterial(); mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
      selected.forEach((beam,i) => {
        // The shape shader is Y-oriented; rotate each physical section rather
        // than nonuniformly scaling normals or bevels.
        const [x,y,z] = beam.size;
        const axis = x > y && x > z ? 'x' : z > y && z > x ? 'z' : 'y';
        dummy.position.set(...beam.center); dummy.rotation.set(axis === 'z' ? Math.PI/2 : 0,0,axis === 'x' ? Math.PI/2 : 0);
        dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix);
        (geometry.getAttribute('beamSize') as InstancedBufferAttribute).setXYZ(i,axis==='x'?y:x,axis==='x'?x:axis==='z'?z:y,axis==='z'?y:z);
        (geometry.getAttribute('beamSeed') as InstancedBufferAttribute).setX(i,i*.618);
      });
      mesh.instanceMatrix.needsUpdate = true; return mesh;
    });
    return { meshes, count: beams.length };
  }, []);
  useEffect(() => () => data.meshes.forEach(m => { m.geometry.dispose(); (m.material as MeshStandardMaterial).dispose(); m.customDepthMaterial?.dispose(); m.dispose(); }), [data]);
  return <group name="reference-structure" userData={{ beams: data.count, hierarchy: ['primary','layer','joint'], static: true, lamellaDepth: true }}>
    {data.meshes.map((m,i) => <primitive key={i} object={m} dispose={null}/>)}
  </group>;
}
