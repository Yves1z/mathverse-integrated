import {useEffect,useMemo,useRef,useState} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {AdditiveBlending,BufferGeometry,DoubleSide,Float32BufferAttribute,Group,ShaderMaterial} from 'three';
import type {MotionState} from '../config/motion';
import {ATMOSPHERE,dustSection,particleFragment,randomForSection} from '../config/atmosphere';
import {fourthAngles} from '../windows/windowMotion';

export function Atmosphere({motion}:{motion:MotionState}){
  const {size,gl}=useThree(),root=useRef<Group>(null);
  const [first,setFirst]=useState(dustSection(0));
  const geometry=useMemo(()=>{
    const p:number[]=[],seeds:number[]=[],w:number[]=[];
    for(let section=first;section<first+ATMOSPHERE.sections;section++){
      const random=randomForSection(section);
      for(let i=0;i<ATMOSPHERE.dustPerSection;i++){
        const theta=random()*Math.PI*2,r=4.2+random()*13.8;
        p.push(Math.cos(theta)*r,1.55+Math.sin(theta)*r,-16-section*22+(random()-.5)*21.5);
        seeds.push(random(),random(),random());w.push((random()-.5)*2.2);
      }
    }
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('aSeed',new Float32BufferAttribute(seeds,3));g.setAttribute('aFourth',new Float32BufferAttribute(w,1));return g;
  },[first]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const uniforms=useMemo(()=>({uTime:{value:0},uAngle:{value:0},uHeight:{value:900},uPixelRatio:{value:1}}),[]);
  const curtains=useRef<Array<ShaderMaterial|null>>([]);
  useFrame(()=>{
    const next=dustSection(motion.distance);if(next!==first)setFirst(next);
    uniforms.uTime.value=motion.spaceTime;uniforms.uAngle.value=fourthAngles(motion.spaceTime)[0];
    uniforms.uHeight.value=size.height*gl.getPixelRatio();uniforms.uPixelRatio.value=gl.getPixelRatio();
    for(const curtain of curtains.current)if(curtain)curtain.uniforms.uTime.value=motion.spaceTime;
    if(root.current){root.current.visible=motion.phase!=='idle';root.current.userData={dustCount:ATMOSPHERE.dustPerSection*ATMOSPHERE.sections,curtains:ATMOSPHERE.sections,time:motion.spaceTime,firstSection:first,depthTest:true};}
  },0.3);
  return <group ref={root} name="mathematical-atmosphere" visible={false}>
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial uniforms={uniforms} transparent blending={AdditiveBlending} depthWrite={false} depthTest
        vertexShader={`
          attribute vec3 aSeed;attribute float aFourth;
          uniform float uTime,uAngle,uHeight,uPixelRatio;varying float vAlpha;varying vec3 vTint;
          void main(){
            vec3 p=position;float w=aFourth;
            float x=p.x*cos(uAngle)-w*sin(uAngle);w=p.x*sin(uAngle)+w*cos(uAngle);
            p.x=x;float scale=10.0/(10.0-w*0.20);p.xy*=scale;
            p+=vec3(sin(uTime*0.035+aSeed.x*6.28),cos(uTime*0.025+aSeed.y*6.28),sin(uTime*0.021+aSeed.z*6.28))*0.28;
            vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;
            gl_PointSize=clamp((0.035+aSeed.z*0.06)*uHeight/max(2.0,-mv.z),1.2*uPixelRatio,6.0*uPixelRatio);
            float depth=length(cameraPosition-p);
            float nearFade=smoothstep(1.8,5.0,depth),farFade=1.0-smoothstep(36.0,76.0,depth);
            float beam=exp(-pow((p.x-6.0*sin(p.z*0.035+uTime*0.011))/3.5,2.0));
            float breath=0.88+0.12*sin(uTime*0.06+aSeed.x*6.28);
            vAlpha=(0.10+beam*0.48)*(0.45+aSeed.y*0.55)*nearFade*farFade*breath*(1.0-smoothstep(-3.5,-2.8,p.z));
            vTint=mix(vec3(0.46,0.52,0.51),vec3(1.70,1.48,1.02),beam*0.70);
          }`}
        fragmentShader={particleFragment}/>
    </points>
    <group>
      {Array.from({length:ATMOSPHERE.sections},(_,i)=>{const section=first+i,side=section%2?-1:1;return <mesh key={section} position={[-side*8,side<0?8:6,-19-section*22]} rotation={[0.12,side*0.36,side*0.42]}>
        <planeGeometry args={[17,26]}/>
        <shaderMaterial ref={material=>{curtains.current[i]=material;}} uniforms={{uTime:{value:0},uPhase:{value:section*1.4}}} transparent side={DoubleSide} forceSinglePass depthWrite={false} blending={AdditiveBlending}
          vertexShader={`varying vec2 v;varying vec3 p;void main(){v=uv;p=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);}`}
          fragmentShader={`uniform float uTime,uPhase;varying vec2 v;varying vec3 p;
            void main(){
              float drift=0.06*sin(uTime*0.023+uPhase);float stripe=exp(-pow((v.x-0.5-drift)/0.085,2.0));
              float edge=pow(sin(v.y*3.14159265),2.0)*(1.0-smoothstep(0.38,0.50,abs(v.x-.5)));
              float d=length(cameraPosition-p),fade=exp(-d*0.045)*smoothstep(2.5,8.0,d)*(1.0-smoothstep(44.0,72.0,d));
              fade*=1.0-smoothstep(-3.5,-2.8,p.z);
              float phase=v.x*260.0+uPhase;
              float ribs=0.96+0.04*cos(phase)*(1.0-smoothstep(0.3,1.3,fwidth(phase)));
              gl_FragColor=vec4(vec3(0.86,0.78,0.60),stripe*edge*fade*ribs*0.085);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }`}/>
      </mesh>;})}
    </group>
  </group>;
}
