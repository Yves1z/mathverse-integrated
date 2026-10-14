import { useEffect, useMemo } from 'react';
import { InstancedBufferAttribute, InstancedMesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { createBeamBounds, SpaceOccluder } from './SpaceOccluder';
import { createJourneyBeams, createReferenceBeams, referenceRouteClearance,type ReferenceBeam } from '../../experiments/megastructure/referenceModel';
import { createStructureDepthMaterial, createStructureGeometry, createStructureMaterial } from './structureSurface';

export function ReferenceStructure({ first = 0, extended = false, exchanging = false, content=false,polished=false,source,clearance=referenceRouteClearance }: { first?: number; extended?: boolean; exchanging?: boolean; content?:boolean;polished?:boolean;source?:ReferenceBeam[];clearance?:(b:ReferenceBeam)=>number }) {
  const data = useMemo(() => {
    const beams = source??(extended ? createJourneyBeams(first,exchanging) : createReferenceBeams()), dummy = new Object3D(),occluder=new SpaceOccluder();
    if(content)occluder.records=beams.map(b=>{const record=createBeamBounds();record.matrix.makeScale(...b.size).setPosition(...b.center);record.inverse.copy(record.matrix).invert();record.box.setFromCenterAndSize(new Vector3(...b.center),new Vector3(...b.size));return record;});
    const meshes = (['primary','layer','joint'] as const).map(kind => {
      const selected = beams.filter(b => b.kind === kind), geometry = createStructureGeometry(kind,selected.length);
      const material = createStructureMaterial(kind) as MeshStandardMaterial;
      material.color.set(polished?(kind==='primary'?'#505455':kind==='layer'?'#565a59':'#414646'):(kind === 'primary' ? '#50524c' : kind === 'layer' ? '#555650' : '#454640'));
      material.roughness = .88; material.metalness = .025; material.envMapIntensity = .08;
      const compile = material.onBeforeCompile.bind(material);
      material.onBeforeCompile = (shader, renderer) => { compile(shader,renderer);
        shader.fragmentShader = shader.fragmentShader.replace('satin * 0.075 + grain * 0.025',polished?'satin * 0.11 + grain * 0.012':'satin * 0.16 + grain * 0.018');if(polished)shader.fragmentShader=shader.fragmentShader.replace('0.25, 0.85','0.72, 0.96'); };
      material.customProgramCacheKey = () => polished?'reference-mineral-v2':'reference-mineral-v1';
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
        (geometry.getAttribute('beamSeed') as InstancedBufferAttribute).setX(i,beam.seed??i*.618);
      });
      mesh.instanceMatrix.needsUpdate = true; return mesh;
    });
    return { meshes, occluder, count: beams.length, minimumClearance: Math.min(...beams.map(clearance)) };
  }, [first,extended,exchanging,content,polished,source,clearance]);
  useEffect(() => () => data.meshes.forEach(m => { m.geometry.dispose(); (m.material as MeshStandardMaterial).dispose(); m.customDepthMaterial?.dispose(); m.dispose(); }), [data]);
  return <group name="reference-structure" userData={{ beams: data.count, firstCell:first, minimumClearance:data.minimumClearance, hierarchy: ['primary','layer','joint'], static: true, lamellaDepth: true, extended }}>
    {content&&<primitive object={data.occluder}/>}
    {data.meshes.map((m,i) => <primitive key={i} object={m} dispose={null}/>)}
  </group>;
}
