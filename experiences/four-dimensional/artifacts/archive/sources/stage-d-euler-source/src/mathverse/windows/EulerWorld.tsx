import {useEffect,useLayoutEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {AdditiveBlending,BufferGeometry,CanvasTexture,DoubleSide,Float32BufferAttribute,Group,InstancedMesh,Material,Mesh,Object3D,PlaneGeometry,SRGBColorSpace} from 'three';
import type {MathAssets} from '../content/assets';
import type {ContentRuntime} from '../content/runtime';
import {advanceEulerStory,BRIDGE_EDGES,BRIDGE_NODES,bridgePoint,EULER_CHAPTERS,seriesSquare,type Point3} from '../content/eulerStory';
import {ATMOSPHERE,particleFragment} from '../config/atmosphere';
import './WorldLine';

function coverTexture(index:number):CanvasTexture{
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=960;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#adad9b';ctx.fillRect(0,0,768,960);
  // A contemporary, typographic study of a work. This is not a historical facsimile.
  for(let i=0;i<1600;i++){ctx.fillStyle=i%2?'#ffffff06':'#282a2206';ctx.fillRect((i*173)%768,(i*337)%960,1,1);}
  ctx.strokeStyle='#535a4270';ctx.lineWidth=1;ctx.strokeRect(55,55,658,850);
  ctx.fillStyle='#333c32';ctx.textAlign='center';ctx.font='23px Georgia';ctx.fillText('LEONHARD EULER',384,140);
  const titles=[['DE SUMMIS','SERIERUM','RECIPROCARUM'],['GEOMETRIAM','SITUS','PERTINENTIS'],['INTRODUCTIO','IN ANALYSIN','INFINITORUM']];
  ctx.font='42px Georgia';titles[index].forEach((line,i)=>ctx.fillText(line,384,310+i*67));
  ctx.font='25px Georgia';ctx.fillText(EULER_CHAPTERS[index].year,384,625);
  ctx.font='18px Georgia';ctx.fillText(['E041','E053','E101'][index],384,794);
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.anisotropy=4;return texture;
}
function numberTexture(label:string):CanvasTexture{
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#e1d6bb';ctx.textAlign='center';ctx.font='43px Georgia';ctx.fillText(label,128,80);
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;return texture;
}
function fade(group:Group|null,opacity:number):void{
  if(!group)return;group.visible=opacity>.002;
  group.traverse(object=>{
    const material=(object as Mesh).material;if(!material)return;
    const update=(m:Material)=>{
      if(m.userData.baseOpacity===undefined)m.userData.baseOpacity=m.opacity;
      m.opacity=m.userData.baseOpacity*opacity;
    };
    if(Array.isArray(material))material.forEach(update);else update(material);
  });
}
export function EulerWorld({assets,runtime}:{assets:MathAssets;runtime:ContentRuntime}){
  const series=useRef<Group>(null),graph=useRef<Group>(null),rotation=useRef<Group>(null),land=useRef<Group>(null),papers=useRef<Group>(null);
  const squares=useRef<InstancedMesh>(null),arm=useRef<Group>(null),marker=useRef<Mesh>(null);
  const reduced=useMemo(()=>matchMedia('(prefers-reduced-motion: reduce)').matches,[]);
  const resource=useMemo(()=>{
    const frames:number[]=[],centers=Array.from({length:48},(_,i)=>seriesSquare(i+1));
    for(const{center:[x,y,z],side}of centers){const s=side/2;frames.push(x-s,y-s,z,x+s,y-s,z,x+s,y-s,z,x+s,y+s,z,x+s,y+s,z,x-s,y+s,z,x-s,y+s,z,x-s,y-s,z);}
    const bridges:number[]=[],p:Point3=[0,0,0];
    for(let edge=0;edge<BRIDGE_EDGES.length;edge++)for(let i=0;i<48;i++)for(const t of[i/48,(i+1)/48])bridges.push(...bridgePoint(edge,t,p));
    const line=(values:number[])=>new BufferGeometry().setAttribute('position',new Float32BufferAttribute(values,3));
    const seeds=Array.from({length:ATMOSPHERE.worldParticles},(_,i)=>(i*.61803398875)%1);
    const particles=line(new Array(ATMOSPHERE.worldParticles*3).fill(0));particles.setAttribute('aSeed',new Float32BufferAttribute(seeds,1));
    return{centers,frames:line(frames),bridges:line(bridges),helix:line(new Array(481*3).fill(0)),particles,
      sheet:new PlaneGeometry(1.32,1.65),label:new PlaneGeometry(.55,.275),square:new PlaneGeometry(1,1),covers:[0,1,2].map(coverTexture),digits:['A · 5','B · 3','C · 3','D · 3'].map(numberTexture),p,seeds};
  },[]);
  useEffect(()=>()=>{
    resource.frames.dispose();resource.bridges.dispose();resource.helix.dispose();resource.particles.dispose();resource.sheet.dispose();resource.label.dispose();resource.square.dispose();
    resource.covers.forEach(t=>t.dispose());resource.digits.forEach(t=>t.dispose());
  },[resource]);
  useLayoutEffect(()=>{
    const object=new Object3D();
    resource.centers.forEach(({center,side},i)=>{object.position.set(...center);object.scale.set(side,side,1);object.updateMatrix();squares.current?.setMatrixAt(i,object.matrix);});
    if(squares.current)squares.current.instanceMatrix.needsUpdate=true;
  },[resource]);
  useFrame(()=>{
    const state=runtime.euler,time=runtime.connection.time,angle=runtime.connection.angle;
    advanceEulerStory(state,time,reduced);
    const [s,g,r]=state.weights;
    fade(series.current,s);fade(graph.current,g);fade(rotation.current,r);fade(land.current,g*(1-state.abstraction));
    if(papers.current)papers.current.rotation.y=-.18+.025*Math.sin(time*.06);
    resource.frames.setDrawRange(0,state.terms*8);if(squares.current)squares.current.count=state.terms;
    if(arm.current)arm.current.rotation.z=angle;
    if(marker.current)marker.current.position.set(2*Math.cos(angle),2*Math.sin(angle),.015);
    const helix=resource.helix.getAttribute('position');
    for(let i=0;i<=480;i++){const u=-4*Math.PI+i*8*Math.PI/480;helix.setXYZ(i,2*Math.cos(angle+u),2*Math.sin(angle+u),-u*.58);}
    helix.needsUpdate=true;
    const positions=resource.particles.getAttribute('position');
    for(let i=0;i<ATMOSPHERE.worldParticles;i++){
      const seed=resource.seeds[i],f=(seed+time*.016)%1,n=i%state.terms;
      const{center,side}=resource.centers[n],edge=f*4,segment=Math.floor(edge),t=edge-segment;
      const x=segment===0?-1+2*t:segment===1?1:segment===2?1-2*t:-1;
      const y=segment===0?-1:segment===1?-1+2*t:segment===2?1:1-2*t;
      const p=bridgePoint(i%7,f,resource.p),u=-4*Math.PI+8*Math.PI*seed;
      positions.setXYZ(i,s*(center[0]+x*side/2)+g*p[0]+r*2*Math.cos(angle+u),s*(center[1]+y*side/2)+g*p[1]+r*2*Math.sin(angle+u),s*(center[2]+.012)+g*p[2]+r*(-u*.58));
    }
    positions.needsUpdate=true;
  },.28);
  return <group name="euler-thought-world">
    <group ref={series}>
      <instancedMesh ref={squares} args={[resource.square,undefined,48]} frustumCulled={false}>
        <meshStandardMaterial color="#66746b" metalness={.45} roughness={.7} transparent opacity={.12} depthWrite={false} side={DoubleSide}/>
      </instancedMesh>
      <lineSegments geometry={resource.frames} frustumCulled={false}><lineBasicMaterial color="#d4c7a3" transparent opacity={.80} depthWrite={false}/></lineSegments>
      <mesh geometry={assets.circle} scale={2.5} position={[0,0,-6]} rotation={[.3,.13,0]}><meshBasicMaterial color="#9aa899" transparent opacity={.35} depthWrite={false}/></mesh>
    </group>
    <group ref={graph}>
      <lineSegments geometry={resource.bridges}><lineBasicMaterial color="#cabf9d" transparent opacity={.83} depthWrite={false}/></lineSegments>
      {BRIDGE_NODES.map((p,i)=><group key={i} position={p}>
        <mesh geometry={assets.point} scale={1.9}><meshBasicMaterial color={[2.8,2.4,1.6]} transparent opacity={.9} depthWrite={false} toneMapped={false}/></mesh>
        <mesh geometry={resource.label} position={[.26,-.30,.015]}><meshBasicMaterial map={resource.digits[i]} transparent depthWrite={false}/></mesh>
      </group>)}
      <group ref={land}>
        {BRIDGE_NODES.map((p,i)=><group key={i} position={[p[0],p[1],p[2]-.10]} scale={[i===0?.85:1.03,i===0?1.18:.63,1]}>
          <mesh><circleGeometry args={[1,64]}/><meshStandardMaterial color="#829184" metalness={.35} roughness={.8} transparent opacity={.13} depthWrite={false} side={DoubleSide}/></mesh>
          <mesh geometry={assets.circle}><meshBasicMaterial color="#627a75" transparent opacity={.45} depthWrite={false}/></mesh>
          <mesh geometry={assets.circle} scale={1.16} position={[0,0,-.06]}><meshBasicMaterial color="#627a75" transparent opacity={.16} depthWrite={false}/></mesh>
        </group>)}
      </group>
    </group>
    <group ref={rotation}>
      <group>
        <worldLine geometry={resource.helix}><lineBasicMaterial color="#b3bdaf" transparent opacity={.42} depthWrite={false}/></worldLine>
      </group>
      <mesh geometry={assets.circle} scale={2}><meshBasicMaterial color="#e0d4b4" transparent opacity={.90} depthWrite={false}/></mesh>
      <lineSegments geometry={assets.axes} scale={1.6}><lineBasicMaterial color="#698080" transparent opacity={.4} depthWrite={false}/></lineSegments>
      <group ref={arm}><lineSegments geometry={assets.radial} scale={2}><lineBasicMaterial color="#ad9d7b" transparent opacity={.7} depthWrite={false}/></lineSegments></group>
      <mesh ref={marker} geometry={assets.point} scale={2.6}><meshBasicMaterial color={[4.6,3.8,2.2]} transparent opacity={.95} depthWrite={false} toneMapped={false}/></mesh>
    </group>
    <points geometry={resource.particles} frustumCulled={false}>
      <shaderMaterial transparent blending={AdditiveBlending} depthTest depthWrite={false}
        vertexShader={`attribute float aSeed;varying float vAlpha;varying vec3 vTint;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(40.0/max(2.0,-mv.z),1.4,4.0);vAlpha=.18+aSeed*.3;vTint=vec3(2.7,2.3,1.4);}`}
        fragmentShader={particleFragment}/>
    </points>
    <group ref={papers} position={[-2.8,-1.72,1.3]} rotation={[.08,-.18,-.06]}>
      {[0,1,2].map(index=><EulerPaper key={index} index={index} resource={resource} runtime={runtime}/>)}
    </group>
  </group>;
}
function EulerPaper({index,resource,runtime}:{index:number;resource:{sheet:PlaneGeometry;covers:CanvasTexture[]};runtime:ContentRuntime}){
  const root=useRef<Group>(null);
  useFrame(()=>{fade(root.current,.025+.73*runtime.euler.weights[index]);},.29);
  return <group ref={root} position={[index*.07,index*.06,-index*.09]}>
    <mesh geometry={resource.sheet}><meshStandardMaterial map={resource.covers[index]} color="#aba991" roughness={.96} metalness={.02} transparent depthWrite={false} side={DoubleSide}/></mesh>
  </group>;
}
