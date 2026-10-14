import {useRef} from 'react';
import {createPortal,useFrame} from '@react-three/fiber';
import {DoubleSide,Group,Mesh} from 'three';
import type {MathAssets} from '../content/assets';
import type {ContentRuntime} from '../content/runtime';
import type {ReadingState} from '../reading/ReadingKernel';
import type {MathNode} from '../content/nodes';
import {NodeVisual} from '../content/NodeVisual';
import type {WindowAssets} from './WindowAssets';
import './WorldLine';

export function WindowWorld({node,assets,windows,runtime,reading}:{node:MathNode;assets:MathAssets;windows:WindowAssets;runtime:ContentRuntime;reading:ReadingState}){
  const world=windows.worlds.get(node.id)!;
  const arm=useRef<Group>(null),point=useRef<Mesh>(null),inner=useRef<Group>(null),pages=useRef<Group>(null);
  const k=node.rendererKey,circular=k==='identity'||k==='circle'||k==='rotation';
  useFrame(()=>{
    const angle=runtime.connection.angle,time=runtime.connection.time;
    if(arm.current)arm.current.rotation.z=angle;
    if(point.current){const radius=k==='rotation'?1.8:2.0;point.current.position.set(Math.cos(angle)*radius,Math.sin(angle)*radius,k==='rotation'?0:-0.02);}
    if(k==='rotation'){
      const positions=windows.helix.getAttribute('position');
      for(let i=0;i<=480;i++){const u=-4*Math.PI+i*8*Math.PI/480;positions.setXYZ(i,1.8*Math.cos(angle+u),1.8*Math.sin(angle+u),-u*0.58);}
      positions.needsUpdate=true;
    }
    if(inner.current)inner.current.rotation.y=reading.selectedId===node.id?(k==='mobius'?reading.objectYaw:0):0.14*Math.sin(time*0.035);
    if(pages.current)pages.current.rotation.y=-0.14+0.045*Math.sin(time*0.05);
    const state=runtime.worldStates[node.id]??(runtime.worldStates[node.id]={angle,marker:null});state.angle=angle;
    if(point.current){const marker=state.marker??(state.marker=[0,0,0]);marker[0]=point.current.position.x;marker[1]=point.current.position.y;marker[2]=point.current.position.z;}
  },0.25);
  return createPortal(<>
    <ambientLight intensity={1.3}/><directionalLight position={[4,8,9]} intensity={3.0} color="#ece5d2"/><directionalLight position={[-5,-3,2]} intensity={0.8} color="#657675"/>
    <group position={[0,0,-4]}>
      {/* Repeated contours give the opening an interior depth without depicting a room. */}
      {[0,1,2,3,4].map(index=><group key={index} position={[0,0,-index*5-3]} rotation={[0.10+index*0.10,0.18*index,0.12*index]} scale={3.4+index*1.1}>
        <mesh geometry={assets.circle}><meshBasicMaterial color={index%2?'#516667':'#84938d'} transparent opacity={0.28-index*0.035} depthWrite={false}/></mesh>
      </group>)}
      {circular&&<>
        <group rotation={k==='rotation'?[0.36,-0.35,0]:[0,0,0]}>
          {k==='rotation'?<worldLine geometry={windows.helix}><lineBasicMaterial color="#ded5b5"/></worldLine>:<mesh geometry={assets.circle} scale={2}><meshBasicMaterial color="#dfd7bd"/></mesh>}
          <group ref={arm}><lineSegments geometry={assets.radial} scale={2}><lineBasicMaterial color="#968d72" transparent opacity={0.6}/></lineSegments></group>
          <mesh ref={point} geometry={assets.point} scale={2.1}><meshBasicMaterial color="#fff1c9" toneMapped={false}/></mesh>
          {k!=='rotation'&&<lineSegments geometry={assets.axes} scale={1.6}><lineBasicMaterial color="#586e70" transparent opacity={0.48}/></lineSegments>}
        </group>
        {k==='identity'&&<group position={[0,0.15,0.18]} scale={0.85}><NodeVisual kind="identity" assets={assets} opacity={()=>{
          const delta=Math.atan2(Math.sin(runtime.connection.angle-Math.PI),Math.cos(runtime.connection.angle-Math.PI));return Math.exp(-delta*delta/0.12);
        }}/></group>}
      </>}
      {k==='gaussian'&&<group ref={inner} rotation={[0.42,-0.3,0]}>
        <mesh geometry={windows.surface}><meshStandardMaterial color="#677f7d" metalness={0.55} roughness={0.42} side={DoubleSide}/></mesh>
        <mesh geometry={windows.surface} scale={1.004}><meshBasicMaterial wireframe color="#b9c6b2" transparent opacity={0.23}/></mesh>
      </group>}
      {k==='mobius'&&<group ref={inner} scale={2.1}><NodeVisual kind="mobius" assets={assets} opacity={()=>1}/></group>}
      {k==='person'&&<group ref={pages}>
        {[-1,0,1].map((index)=><group key={index} position={[index*0.85,index*0.35,-Math.abs(index)*1.9]} rotation={[index*0.11,index*0.25,index*0.07]}>
          <mesh><planeGeometry args={[2.2,3.1]}/><meshStandardMaterial color="#a6a48e" roughness={0.95} metalness={0.05} side={DoubleSide}/></mesh>
          <mesh geometry={assets.plane} position={[0,0.45,0.015]} scale={0.45}><meshBasicMaterial map={assets.textures.get(index===0?'person':'identity')} color="#30352f" transparent depthWrite={false}/></mesh>
          {[0,1,2,3,4].map(row=><mesh key={row} position={[-0.12+(row%2)*0.08,-0.2-row*0.16,0.02]}><planeGeometry args={[1.45-(row%3)*0.18,0.007]}/><meshBasicMaterial color="#525a4e"/></mesh>)}
        </group>)}
      </group>}
    </group>
  </>,world.scene,{camera:world.camera});
}
