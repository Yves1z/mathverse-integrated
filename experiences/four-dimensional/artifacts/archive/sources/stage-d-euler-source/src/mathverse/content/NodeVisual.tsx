import { useEffect,useMemo,useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide,Group,LineBasicMaterial,MeshBasicMaterial,MeshStandardMaterial } from 'three';
import type { MathAssets } from './assets';
import type { RendererKey } from './nodes';
import type { ReadingState } from '../reading/ReadingKernel';

export function NodeVisual({kind,assets,opacity,reading}:{kind:RendererKey;assets:MathAssets;opacity:()=>number;reading?:ReadingState}){
  const radius=useRef<Group>(null),point=useRef<Group>(null),surface=useRef<Group>(null);
  const materials=useMemo(()=>({
    ink:new MeshBasicMaterial({color:'#e9dfcd',map:assets.textures.get(kind),transparent:true,depthWrite:false,side:DoubleSide,toneMapped:false}),
    curve:new MeshBasicMaterial({color:'#d9dacb',transparent:true,depthWrite:false,toneMapped:false}),
    axis:new LineBasicMaterial({color:'#8d9f9e',transparent:true,depthWrite:false}),
    accent:new LineBasicMaterial({color:'#d1c2a2',transparent:true,depthWrite:false}),
    metal:new MeshStandardMaterial({color:'#65716b',metalness:0.66,roughness:0.42,side:DoubleSide,transparent:true,emissive:'#253838',emissiveIntensity:0.035}),
  }),[assets,kind]);
  useEffect(()=>()=>Object.values(materials).forEach(material=>material.dispose()),[materials]);
  useFrame(()=>{
    const alpha=opacity();Object.values(materials).forEach(material=>{material.opacity=alpha*(material===materials.axis?0.45:1);});
    const angle=reading?.angle??Math.PI/3;
    if(radius.current)radius.current.rotation.z=angle;
    if(point.current)point.current.position.set(Math.cos(angle),Math.sin(angle),0.02);
    if(surface.current)surface.current.rotation.y=reading?.objectYaw??0;
  });
  const circle=<group><mesh geometry={assets.circle} material={materials.curve}/><lineSegments geometry={assets.axes} material={materials.axis}/><group ref={radius}><lineSegments geometry={assets.radial} material={materials.accent}/></group><group ref={point}><mesh geometry={assets.point} material={materials.curve}/></group></group>;
  return <group dispose={null}>
    {kind==='identity'&&<mesh geometry={assets.plane} material={materials.ink}/>}
    {kind==='gaussian'&&<><mesh position={[0,1.3,0]} geometry={assets.plane} material={materials.ink}/><lineSegments geometry={assets.gaussianAxis} material={materials.axis}/></>}
    {kind==='gaussian'&&<lineLoop geometry={assets.gaussian} material={materials.accent}/>}
    {kind==='circle'&&circle}
    {kind==='rotation'&&<><group scale={0.8} position={[0,-0.25,0]}>{circle}</group><mesh position={[0,1.6,0]} geometry={assets.plane} material={materials.ink}/></>}
    {kind==='mobius'&&<group ref={surface}><group rotation={[0.72,0.15,0.08]}><mesh geometry={assets.mobius} material={materials.metal}/><mesh geometry={assets.rim} material={materials.curve}/><lineSegments geometry={assets.mobiusGrid} material={materials.axis}/></group></group>}
    {kind==='person'&&<><mesh geometry={assets.plane} material={materials.ink}/><group scale={[1.6,1.6,1.6]} rotation={[0.3,0.1,0.3]}><mesh geometry={assets.circle} material={materials.curve}/></group></>}
  </group>;
}
