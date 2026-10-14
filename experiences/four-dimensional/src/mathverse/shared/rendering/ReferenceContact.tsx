import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferGeometry, DepthTexture, Float32BufferAttribute, HalfFloatType, LinearFilter, Matrix4, Mesh, OrthographicCamera, Scene, ShaderMaterial, Vector2, WebGLRenderTarget } from 'three';

// Depth is produced by the same deformed, solid meshes as the color pass.
// Reconstructing it avoids an override normal material losing their sections.
export function ReferenceContact({polished=false,first=0,localAir=polished}:{polished?:boolean;first?:number;localAir?:boolean}) {
  const { gl, scene, camera, size } = useThree();
  const data = useMemo(() => {
    const target = new WebGLRenderTarget(1,1,{type:HalfFloatType,minFilter:LinearFilter,magFilter:LinearFilter,samples:4});
    target.depthTexture = new DepthTexture(1,1);
    const geometry = new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
    const material = new ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{colorBuffer:{value:target.texture},depthBuffer:{value:target.depthTexture},inverseProjection:{value:new Matrix4()},inverseView:{value:new Matrix4()},resolution:{value:new Vector2()},finish:{value:polished?1:0},airPass:{value:localAir?1:0},firstCell:{value:first}},
      vertexShader:'varying vec2 vUv; void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position,1.0);}',
      fragmentShader:`uniform sampler2D colorBuffer; uniform sampler2D depthBuffer; uniform mat4 inverseProjection; uniform mat4 inverseView;uniform float finish;uniform float airPass;uniform float firstCell;uniform vec2 resolution; varying vec2 vUv;
      vec3 positionAt(vec2 uv){float z=texture2D(depthBuffer,uv).r;vec4 p=inverseProjection*vec4(uv*2.0-1.0,z*2.0-1.0,1.0);return p.xyz/p.w;}
      float shaft(vec3 p,vec3 origin,vec3 direction,float extent,float radius){vec3 d=p-origin;float t=d.z/extent;if(t<0.0||t>1.0)return 0.0;vec2 offset=d.xy-direction.xy*d.z;float width=radius*(.28+.7*t);return exp(-dot(offset,offset)/(width*width))*smoothstep(0.0,.09,t)*(1.0-smoothstep(.78,1.0,t));}
      void main(){vec3 rgb=texture2D(colorBuffer,vUv).rgb;float depth=texture2D(depthBuffer,vUv).r;
        if(depth<.99999){vec3 p=positionAt(vUv);vec3 normal=normalize(cross(dFdx(p),dFdy(p)));if(normal.z<0.0)normal=-normal;float shadow=0.0;
          for(int i=0;i<16;i++){float angle=float(i)*2.399963;float radius=sqrt((float(i)+.5)/16.0)*22.0;vec2 uv=vUv+vec2(cos(angle),sin(angle))*radius/resolution;
            vec3 delta=positionAt(clamp(uv,vec2(.001),vec2(.999)))-p;float len=length(delta);float facing=max(0.0,dot(normal,delta/max(len,.001))-.16);shadow+=facing*(1.0-smoothstep(1.0,16.0,len));}
          if(finish>.5){for(int i=0;i<8;i++){float a=float(i)*2.399963;vec2 uv=vUv+vec2(cos(a),sin(a))*sqrt((float(i)+.5)/8.0)*7.0/resolution;vec3 d=positionAt(clamp(uv,vec2(.001),vec2(.999)))-p;float len=length(d);shadow+=max(0.0,dot(normal,d/max(len,.001))-.12)*(1.0-smoothstep(.3,6.0,len))*.55;}}
          rgb*=1.0-min(finish>.5?.58:.52,shadow/16.0*(finish>.5?1.9:1.7));}
        if(finish>.5&&airPass>.5){vec3 eye=(inverseView*vec4(0,0,0,1)).xyz;vec3 viewPoint=positionAt(vUv);float limit=min(length(viewPoint),470.0);vec3 ray=normalize((inverseView*vec4(normalize(viewPoint),0.0)).xyz);float jitter=fract(sin(dot(floor(vUv*resolution),vec2(12.9898,78.233)))*43758.5453);float air=0.0;
          for(int i=0;i<24;i++){vec3 p=eye+ray*(float(i)+jitter)*limit/24.0;float cell=floor((-p.z-110.0)/600.0+.5);cell=clamp(cell,firstCell-1.0,firstCell+2.0);float shift=cell*600.0;air+=shaft(p,vec3(-24.0,12.0,-326.0-shift),vec3(.08,.14,1.0),205.0,10.0)*.0013+shaft(p,vec3(65.0,72.0,-310.0-shift),vec3(-.14,-.05,1.0),190.0,16.0)*.00065;}
          air=min(.16,air*limit/24.0);rgb=rgb*exp(-air*.6)+vec3(.70,.65,.51)*air;}
        gl_FragColor=vec4(rgb,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
    const screen = new Scene();screen.add(new Mesh(geometry,material));
    return {target,geometry,material,screen,screenCamera:new OrthographicCamera(-1,1,1,-1,0,1)};
  },[polished,localAir]);
  useEffect(()=>{const dpr=gl.getPixelRatio();data.target.setSize(Math.round(size.width*dpr),Math.round(size.height*dpr));data.material.uniforms.resolution.value.set(size.width*dpr,size.height*dpr);},[gl,size,data]);
  useEffect(()=>()=>{data.target.dispose();data.geometry.dispose();data.material.dispose();},[data]);
  useFrame(()=>{
    const previous=gl.getRenderTarget(),auto=gl.info.autoReset;gl.info.autoReset=false;gl.info.reset();
    data.material.uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    data.material.uniforms.inverseView.value.copy(camera.matrixWorld);data.material.uniforms.firstCell.value=first;
    gl.setRenderTarget(data.target);gl.render(scene,camera);gl.setRenderTarget(previous);gl.render(data.screen,data.screenCamera);gl.info.autoReset=auto;
    scene.userData.contactShadows={depthMatchesGeometry:true,deterministic:true,samples:polished?24:16,localAirSteps:polished&&localAir?24:0,eyeDepthOcclusion:true};
  },1);
  return null;
}
