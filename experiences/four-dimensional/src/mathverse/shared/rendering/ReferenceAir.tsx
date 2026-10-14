import {useEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {BufferGeometry,Float32BufferAttribute,Group,ShaderMaterial} from 'three';
import {airData,REFERENCE_AIR} from './referenceAirModel';
export function ReferenceAir({clock,first}:{clock:{clock:number};first:number}){
  const {gl}=useThree(),root=useRef<Group>(null);
  const data=useMemo(()=>{const source=airData(first),geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(source.positions,3));geometry.setAttribute('airPhase',new Float32BufferAttribute(source.phases,2));
    const material=new ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,uniforms:{time:{value:0},pixelRatio:{value:gl.getPixelRatio()}},
      vertexShader:`attribute vec2 airPhase;uniform float time;uniform float pixelRatio;varying float vAlpha;
      void main(){float phase=airPhase.x;float t=fract(phase+time/720.0);float extent=airPhase.y<.5?205.0:190.0;vec3 direction=airPhase.y<.5?vec3(.08,.14,1.0):vec3(-.14,-.05,1.0);vec2 origin=airPhase.y<.5?vec2(-24.0,12.0):vec2(65.0,72.0);vec2 radial=position.xy-origin-direction.xy*phase*extent;vec3 p=position+direction*(t-phase)*extent;p.xy+=radial*((.28+.7*t)/(.28+.7*phase)-1.0);
        vec4 eye=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*eye;gl_PointSize=clamp(170.0/max(25.0,-eye.z),.65,1.8)*pixelRatio;
        vAlpha=.28*smoothstep(0.0,.14,t)*(1.0-smoothstep(.78,1.0,t));}`,
      fragmentShader:`varying float vAlpha;void main(){float r=length(gl_PointCoord-.5);float alpha=exp(-r*r*16.0)*vAlpha; if(alpha<.008)discard;gl_FragColor=vec4(vec3(.66,.64,.56),alpha);}`});return{geometry,material};},[first,gl]);
  useEffect(()=>()=>{data.geometry.dispose();data.material.dispose();},[data]);
  useFrame(()=>{data.material.uniforms.time.value=clock.clock;data.material.uniforms.pixelRatio.value=gl.getPixelRatio();if(root.current)root.current.userData={clock:clock.clock,particles:REFERENCE_AIR.particlesPerCell*4,shafts:8,worldAnchored:true,localToLight:true,deterministic:true,sharedEventClock:true,firstCell:first};},-.25);
  return <group ref={root} name="reference-air"><points geometry={data.geometry} material={data.material} frustumCulled={false} dispose={null}/></group>;
}
