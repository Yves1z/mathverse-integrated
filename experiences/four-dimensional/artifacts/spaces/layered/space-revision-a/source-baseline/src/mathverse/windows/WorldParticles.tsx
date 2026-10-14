import {useEffect,useMemo} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {AdditiveBlending,BufferGeometry,Float32BufferAttribute} from 'three';
import type {ContentRuntime} from '../content/runtime';
import {ATMOSPHERE,particleFragment,randomForSection} from '../config/atmosphere';

type Kind='circle'|'rotation'|'gaussian'|'mobius'|'person';
export function WorldParticles({kind,runtime}:{kind:Kind;runtime:ContentRuntime}){
  const {size,gl}=useThree();
  const geometry=useMemo(()=>{
    const random=randomForSection(37),data:number[]=[];
    for(let i=0;i<ATMOSPHERE.worldParticles;i++)data.push(i/ATMOSPHERE.worldParticles,random(),random());
    const g=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(new Float32Array(ATMOSPHERE.worldParticles*3),3));
    g.setAttribute('aSeed',new Float32BufferAttribute(data,3));return g;
  },[]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const uniforms=useMemo(()=>({uTime:{value:0},uAngle:{value:0},uHeight:{value:900},uKind:{value:['circle','rotation','gaussian','mobius','person'].indexOf(kind)}}),[kind]);
  useFrame(()=>{uniforms.uTime.value=runtime.connection.time;uniforms.uAngle.value=runtime.connection.angle;uniforms.uHeight.value=size.height*gl.getPixelRatio();},0.3);
  return <points geometry={geometry} frustumCulled={false}>
    <shaderMaterial uniforms={uniforms} transparent blending={AdditiveBlending} depthTest depthWrite={false}
      vertexShader={`
        attribute vec3 aSeed;uniform float uTime,uAngle,uHeight,uKind;varying float vAlpha;varying vec3 vTint;
        void main(){
          float tau=6.28318530718;vec3 p=vec3(0.0);float alpha=0.35;
          if(uKind<0.5){
            float trail=aSeed.x*tau;float a=uAngle-trail;
            p=vec3(2.0*cos(a),2.0*sin(a),0.015);alpha=0.08+0.65*exp(-trail*1.6);
          }else if(uKind<1.5){
            float f=fract(aSeed.x+uTime*0.008),u=-2.0*tau+4.0*tau*f;
            p=vec3(1.8*cos(uAngle+u),1.8*sin(uAngle+u),-u*.58);
            alpha=0.48*pow(sin(f*3.14159265),2.0);
          }else if(uKind<2.5){
            float r=.15+2.8*sqrt(aSeed.x),a=aSeed.y*tau+uTime*.022;
            p=vec3(r*cos(a),2.8*exp(-r*r)-.985,r*sin(a));alpha=.23+.35*exp(-r*r*.35);
          }else if(uKind<3.5){
            // A single continuous boundary needs 4π to return to its starting point.
            float u=aSeed.x*tau*2.0+uTime*.12,v=.342;
            p=vec3((1.0+v*cos(u*.5))*cos(u),v*sin(u*.5),(1.0+v*cos(u*.5))*sin(u));alpha=.43;
          }else{
            p=vec3((aSeed.x-.5)*5.0,(aSeed.y-.5)*4.7,-aSeed.z*4.5);
            p.x+=.08*sin(uTime*.035+aSeed.y*tau);alpha=.10;
          }
          vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;
          gl_PointSize=clamp((.032+aSeed.z*.019)*uHeight/max(2.0,-mv.z),1.5,6.0);
          vAlpha=alpha;vTint=vec3(2.55,2.15,1.30);
        }`}
      fragmentShader={particleFragment}/>
  </points>;
}
