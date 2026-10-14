import {useMemo,useRef,useEffect} from 'react';
import {useFrame} from '@react-three/fiber';
import {Color,DoubleSide,MeshBasicMaterial,MeshStandardMaterial,ShaderMaterial} from 'three';
import type {MathAssets} from '../content/assets';
import type {RendererKey} from '../content/nodes';
import type {WindowAssets} from './WindowAssets';
import {WINDOW} from './windowMotion';

export function PortalWindow({id,kind,assets,windows,opacity,inset=false}:{id:string;kind:RendererKey;assets:MathAssets;windows:WindowAssets;opacity:()=>number;inset?:boolean}){
  const material=useRef<ShaderMaterial>(null);
  const rim=useMemo(()=>new MeshBasicMaterial({color:new Color(2.2,1.9,1.25),transparent:true,toneMapped:false}),[]);
  const frame=useMemo(()=>new MeshStandardMaterial({color:inset?'#44474a':'#303a37',metalness:inset?.3:.62,roughness:inset?.53:.48,transparent:true,side:DoubleSide,forceSinglePass:true}),[inset]);
  const inscription=useMemo(()=>new MeshBasicMaterial({map:assets.textures.get(kind)??null,color:'#e3d6bd',transparent:true,depthWrite:false,side:DoubleSide}),[assets,kind]);
  useEffect(()=>()=>{rim.dispose();frame.dispose();inscription.dispose();},[rim,frame,inscription]);
  const uniforms=useMemo(()=>({world:{value:windows.worlds.get(id)!.target.texture},alpha:{value:0}}),[windows,id]);
  useFrame(()=>{const a=opacity();rim.opacity=a*(inset?.15:.45);frame.opacity=Math.min(1,a*1.15);inscription.opacity=a*0.75;if(material.current)material.current.uniforms.alpha.value=a;});
  const w=WINDOW.width,h=WINDOW.height,t=WINDOW.frame;
  return <group dispose={null}>
    <mesh geometry={windows.opening} position={[0,0,-0.71]}>
      <shaderMaterial ref={material} uniforms={uniforms} transparent side={DoubleSide} depthWrite
        vertexShader={`varying vec2 v; void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`}
        fragmentShader={`uniform sampler2D world;uniform float alpha;varying vec2 v;void main(){
          vec3 c=texture2D(world,v).rgb;float edge=smoothstep(0.72,1.0,max(abs(v.x*2.0-1.0),abs(v.y*2.0-1.0)));c*=1.0-edge*0.22;
          gl_FragColor=vec4(c,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`}/>
    </mesh>
    <mesh geometry={windows.jamb} material={frame}/>
    {[-1,1].map(sign=><group key={sign}>
      <mesh position={[sign*(w/2+t/2),0,0]} material={frame}><boxGeometry args={[t,h+2*t,WINDOW.depth]}/></mesh>
      <mesh position={[0,sign*(h/2+t/2),0]} material={frame}><boxGeometry args={[w,t,WINDOW.depth]}/></mesh>
      <mesh position={[sign*w/2,0,0.13]} material={rim}><boxGeometry args={[0.008,h,0.007]}/></mesh>
      <mesh position={[0,sign*h/2,0.13]} material={rim}><boxGeometry args={[w,0.008,0.007]}/></mesh>
      <mesh position={[sign*(w/2+0.32),1.1,-0.8]} material={frame}><boxGeometry args={[0.04,h+2.2,0.04]}/></mesh>
    </group>)}
    {!inset&&assets.textures.has(kind)&&<mesh geometry={assets.plane} material={inscription} position={[0,-h/2-0.34,0]} scale={0.42}/>}
  </group>;
}
