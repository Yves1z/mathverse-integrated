import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, DynamicDrawUsage, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { MotionState } from '../../config/motion';
import { createStructureDepthMaterial, createStructureGeometry, createStructureMaterial } from '../rendering/structureSurface';
import { createExchangeSolids, exchangeConnections, exchangePoint, ReferenceExchangeController, type ExchangeSolid } from './referenceExchangeModel';
import type { V3, V4 } from '../../experiments/inversion/inversionModel';
import { createBeamBounds, SpaceOccluder } from '../rendering/SpaceOccluder';

type ExchangeRender={name:string;project:typeof exchangePoint;solids:typeof createExchangeSolids;connections:typeof exchangeConnections;seam?:()=>ExchangeSolid[];projection:string};
const DEFAULT_RENDER:ExchangeRender={name:'reference-exchange',project:exchangePoint,solids:createExchangeSolids,connections:exchangeConnections,projection:'shared-XW-perspective'};
export function ReferenceExchange({motion,controller,reduced,polished=false,model=DEFAULT_RENDER}:{motion:MotionState;controller:ReferenceExchangeController;reduced:boolean;polished?:boolean;model?:ExchangeRender}){
  const group=useRef<Group>(null),lastAngle=useRef<number>(NaN);
  const data=useMemo(()=>{
    const solids=model.solids();
    const surfaces=(['primary','layer','joint',...(model.seam?['seam'] as const:[])] as const).map(kind=>{
      const sources:number[]=[];
      (kind==='seam'?model.seam!():solids.filter(s=>s.kind===kind)).forEach((s:ExchangeSolid)=>{
        const box=new RoundedBoxGeometry(...s.size,1,kind==='seam'?.002:.014),p=box.getAttribute('position');
        for(let i=0;i<p.count;i++)sources.push(p.getX(i)+s.center[0],p.getY(i)+s.center[1],p.getZ(i)+s.center[2],s.center[3]);
        box.dispose();
      });
      const source=new Float32Array(sources),geometry=new BufferGeometry();
      geometry.setAttribute('position',new Float32BufferAttribute(new Float32Array(source.length/4*3),3).setUsage(DynamicDrawUsage));
      geometry.setAttribute('sourcePoint',new Float32BufferAttribute(source,4));
      const material=new MeshStandardMaterial({color:kind==='primary'?'#50524c':kind==='layer'?'#555650':'#454640',roughness:.88,metalness:.025,envMapIntensity:.08,dithering:true});
      material.onBeforeCompile=shader=>{
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 sourcePoint;varying vec3 vSource;varying float vSourceW;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSource=sourcePoint.xyz+vec3(sourcePoint.w*7.1);vSourceW=sourcePoint.w;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vSource;varying float vSourceW;').replace('#include <color_fragment>','#include <color_fragment>\nfloat grain=sin(vSource.x*31.0)*sin(vSource.y*37.0)*sin(vSource.z*23.0);diffuseColor.rgb*= (1.0+grain*.025)*(vSourceW<0.0?vec3(1.16,1.13,1.08):vec3(1.0));');
      };
      material.customProgramCacheKey=()=>`reference-exchange-${kind}-v1`;
      if(polished){material.color.set(kind==='primary'?'#505455':kind==='layer'?'#565a59':'#414646');const compile=material.onBeforeCompile;material.onBeforeCompile=(shader,renderer)=>{compile(shader,renderer);shader.fragmentShader=shader.fragmentShader.replace('sin(vSource.x*31.0)*sin(vSource.y*37.0)*sin(vSource.z*23.0)','sin(vSource.x*1.3)*sin(vSource.y*1.7)*sin(vSource.z*1.1)');};material.customProgramCacheKey=()=>`reference-exchange-${kind}-v2`;}
      if(kind==='seam'){material.color.set('#e8ddbc');material.emissive.set('#ffe7be');material.emissiveIntensity=1.8;material.onBeforeCompile=()=>{};material.customProgramCacheKey=()=> 'exchange-identity-seam-v1';}
      const mesh=new Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=kind!=='seam';mesh.frustumCulled=false;
      mesh.userData.mathOccluder=true;
      return{source,geometry,material,mesh};
    });
    const jointsGeometry=createStructureGeometry('joint',12),jointsMaterial=createStructureMaterial('joint') as MeshStandardMaterial;
    jointsMaterial.color.set('#454640');jointsMaterial.roughness=.88;jointsMaterial.metalness=.025;jointsMaterial.envMapIntensity=.08;
    const joints=new InstancedMesh(jointsGeometry,jointsMaterial,12);joints.customDepthMaterial=createStructureDepthMaterial();joints.castShadow=joints.receiveShadow=true;joints.frustumCulled=false;joints.instanceMatrix.setUsage(DynamicDrawUsage);
    for(let i=0;i<12;i++)(jointsGeometry.getAttribute('beamSeed') as InstancedBufferAttribute).setX(i,i*.618);
    const occluder=new SpaceOccluder();occluder.records=Array.from({length:12},createBeamBounds);
    return{surfaces,joints,occluder,dummy:new Object3D(),a:new Vector3(),b:new Vector3(),mid:new Vector3(),direction:new Vector3(),up:new Vector3(0,1,0),point:[0,0,0] as V3,sourcePoint:[0,0,0,0] as V4};
  },[polished,model]);
  useEffect(()=>()=>{data.surfaces.forEach(s=>{s.geometry.dispose();s.material.dispose();});data.joints.geometry.dispose();(data.joints.material as MeshStandardMaterial).dispose();data.joints.customDepthMaterial?.dispose();data.joints.dispose();},[data]);
  useFrame(({camera})=>{
    controller.advance(motion.frameDt*Math.max(.18,motion.speedScale),camera.position.z,motion.spaceFrozen||motion.suspended,reduced);
    if(lastAngle.current!==controller.angle){
      lastAngle.current=controller.angle;
      for(const s of data.surfaces){
        const position=s.geometry.getAttribute('position');
        for(let i=0;i<position.count;i++){
          for(let axis=0;axis<4;axis++)data.sourcePoint[axis]=s.source[i*4+axis];
          model.project(data.sourcePoint,controller.angle,data.point);position.setXYZ(i,...data.point);
        }
        position.needsUpdate=true;s.geometry.computeVertexNormals();s.geometry.computeBoundingSphere();
      }
      const connections=model.connections(controller.angle),sizes=data.joints.geometry.getAttribute('beamSize') as InstancedBufferAttribute;
      connections.forEach((edge,i)=>{
        data.a.set(...edge.a);data.b.set(...edge.b);data.direction.subVectors(data.b,data.a);const length=data.direction.length();
        data.dummy.position.copy(data.a).add(data.b).multiplyScalar(.5);data.dummy.quaternion.setFromUnitVectors(data.up,data.direction.normalize());data.dummy.updateMatrix();data.joints.setMatrixAt(i,data.dummy.matrix);sizes.setXYZ(i,edge.width,length+edge.width*.5,edge.width);
        const record=data.occluder.records[i];data.dummy.scale.set(edge.width,length+edge.width*.5,edge.width);data.dummy.updateMatrix();record.matrix.copy(data.dummy.matrix);record.inverse.copy(record.matrix).invert();record.box.min.copy(data.a).min(data.b).addScalar(-edge.width);record.box.max.copy(data.a).max(data.b).addScalar(edge.width);data.dummy.scale.set(1,1,1);
      });
      sizes.needsUpdate=true;data.joints.instanceMatrix.needsUpdate=true;
    }
    if(group.current)group.current.userData={...controller.snapshot(),solids:72,connections:12,projection:model.projection,shadowMatchesGeometry:true,frozen:motion.spaceFrozen,identitySeam:!!model.seam};
  },-1.5);
  return <group ref={group} name={model.name}>{data.surfaces.map((s,i)=><primitive key={i} object={s.mesh} dispose={null}/>)}<primitive object={data.joints} dispose={null}/><primitive object={data.occluder}/></group>;
}
