import {useMemo,useRef,useEffect} from 'react';
import {useFrame} from '@react-three/fiber';
import {AdditiveBlending,BufferGeometry,CatmullRomCurve3,Float32BufferAttribute,Group,Mesh,Vector3} from 'three';
import type {MotionState} from '../config/motion';
import type {ContentRuntime} from '../content/runtime';
import type {ReadingState} from '../reading/ReadingKernel';
import {advanceConnection,projectFourthTo,type Point4} from './windowMotion';
import './WorldLine';
import {ATMOSPHERE,particleFragment} from '../config/atmosphere';

export function WindowConnections({motion,reading,runtime}:{motion:MotionState;reading:ReadingState;runtime:ContentRuntime}){
  const root=useRef<Group>(null),pulse=useRef<Mesh>(null);
  const resources=useMemo(()=>{
    const ids=['euler-identity','complex-rotation','unit-circle'];
    const anchors=ids.map(id=>runtime.nodes.get(id)!.position.clone());
    const path=new CatmullRomCurve3([anchors[0].clone().add(new Vector3(0,2.3,0)),new Vector3(-5,9,-21),anchors[1].clone().add(new Vector3(0,2.3,0)),new Vector3(5,9,-23),anchors[2].clone().add(new Vector3(0,2.3,0))]);
    const ribs:Point4[][]=[];
    for(let i=0;i<19;i++)ribs.push([[-1.6,-0.6,0,-0.8],[1.6,-0.6,0,-0.8],[1.6,0.6,0,0.8],[-1.6,0.6,0,0.8]].map(v=>[v[0],v[1],v[2],v[3]] as Point4));
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(new Float32Array((19*8+18*8)*3),3));
    const guide=new BufferGeometry().setFromPoints(path.getSpacedPoints(160));guide.setAttribute('color',new Float32BufferAttribute(new Float32Array(161*3),3));
    const particles=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(new Float32Array(ATMOSPHERE.connectionParticles*3),3));
    particles.setAttribute('aSeed',new Float32BufferAttribute(Array.from({length:ATMOSPHERE.connectionParticles},(_,i)=>(i*0.61803398875)%1),1));
    return{path,ribs,geometry,guide,particles,centers:Array.from({length:19},()=>Array.from({length:4},()=>new Vector3())),a:new Vector3(),b:new Vector3(),center:new Vector3()};
  },[runtime]);
  useEffect(()=>()=>{resources.geometry.dispose();resources.guide.dispose();resources.particles.dispose();},[resources]);
  useFrame(()=>{
    const controlled=reading.phase==='reading'||reading.phase==='focusing'?reading.angle:null;
    const active=!motion.suspended&&!document.hidden&&(!motion.spaceFrozen||controlled!==null)&&motion.phase!=='idle';
    advanceConnection(runtime.connection,motion.spaceTime,active?motion.frameDt:0,controlled);
    const {path,ribs,geometry,a,b,center}=resources,positions=geometry.getAttribute('position');let index=0;
    for(let i=0;i<ribs.length;i++){
      path.getPoint(i/(ribs.length-1),center);
      const frame={center:[center.x,center.y,center.z],yaw:0.12*Math.sin(i*0.3),roll:(i-9)*0.035,phase:i*0.23};
      for(let j=0;j<4;j++){
        projectFourthTo(ribs[i][j],frame,motion.spaceTime,a);projectFourthTo(ribs[i][(j+1)%4],frame,motion.spaceTime,b);
        resources.centers[i][j].copy(a);
        positions.setXYZ(index++,a.x,a.y,a.z);positions.setXYZ(index++,b.x,b.y,b.z);
      }
    }
    for(let i=0;i<ribs.length-1;i++)for(let j=0;j<4;j++){
      a.copy(resources.centers[i][j]);b.copy(resources.centers[i+1][j]);positions.setXYZ(index++,a.x,a.y,a.z);positions.setXYZ(index++,b.x,b.y,b.z);
    }
    positions.needsUpdate=true;geometry.computeBoundingSphere();
    const u=0.5-0.5*Math.cos(motion.spaceTime*Math.PI*2/68);
    if(pulse.current)path.getPointAt(u,pulse.current.position);
    const motes=resources.particles.getAttribute('position');
    for(let i=0;i<ATMOSPHERE.connectionParticles;i++){
      const phase=motion.spaceTime*Math.PI*2/68+i*Math.PI*2/ATMOSPHERE.connectionParticles;
      path.getPointAt(.5-.5*Math.cos(phase),a);
      a.x+=.30*Math.sin(i*2.399+motion.spaceTime*.022);a.y+=.20*Math.cos(i*2.399+motion.spaceTime*.022);
      motes.setXYZ(i,a.x,a.y,a.z);
    }
    motes.needsUpdate=true;
    const colors=resources.guide.getAttribute('color');
    for(let i=0;i<161;i++){const intensity=0.22+0.68*Math.exp(-Math.pow((i/160-u)/0.045,2));colors.setXYZ(i,intensity,intensity*0.91,intensity*0.70);}
    colors.needsUpdate=true;
    if(root.current){root.current.visible=motion.phase!=='idle';root.current.userData={...runtime.connection,ribCount:ribs.length,sharedWorlds:3,particles:ATMOSPHERE.connectionParticles};}
  },0.1);
  return <group ref={root} name="window-connections">
    <lineSegments geometry={resources.geometry}><lineBasicMaterial color="#7f8e87" transparent opacity={0.28}/></lineSegments>
    <worldLine geometry={resources.guide}><lineBasicMaterial vertexColors transparent opacity={0.7}/></worldLine>
    <points geometry={resources.particles} frustumCulled={false}>
      <shaderMaterial transparent blending={AdditiveBlending} depthWrite={false} depthTest
        vertexShader={`attribute float aSeed;varying float vAlpha;varying vec3 vTint;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(55.0/max(2.0,-mv.z),1.5,4.5);vAlpha=.22+aSeed*.35;vTint=vec3(3.0,2.55,1.6);}`}
        fragmentShader={particleFragment}/>
    </points>
    <mesh ref={pulse}><sphereGeometry args={[0.055,12,8]}/><meshBasicMaterial color={[4.2,3.55,2.0]} toneMapped={false}/></mesh>
  </group>;
}
