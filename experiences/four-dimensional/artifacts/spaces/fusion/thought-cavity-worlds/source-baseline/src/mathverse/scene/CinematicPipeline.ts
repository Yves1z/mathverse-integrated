import {HalfFloatType,ShaderMaterial,Vector2,WebGLRenderTarget,type WebGLRenderer} from 'three';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
import {ATMOSPHERE,lightPassage} from '../config/atmosphere';

export class CinematicPipeline {
  readonly target=new WebGLRenderTarget(1,1,{type:HalfFloatType,depthBuffer:true,samples:2});
  readonly output=new WebGLRenderTarget(1,1,{depthBuffer:false});
  readonly bloom=new UnrealBloomPass(new Vector2(1,1),ATMOSPHERE.bloomStrength,ATMOSPHERE.bloomRadius,ATMOSPHERE.bloomThreshold);
  readonly material=new ShaderMaterial({
    depthTest:false,depthWrite:false,toneMapped:false,
    uniforms:{image:{value:this.target.texture},uInterior:{value:0},uGrain:{value:ATMOSPHERE.grain},toneMappingExposure:{value:ATMOSPHERE.exposure}},
    vertexShader:`varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
    fragmentShader:`uniform sampler2D image;uniform float uInterior,uGrain;varying vec2 v;
      #include <tonemapping_pars_fragment>
      void main(){
        vec3 c=texture2D(image,v).rgb;vec3 original=c;
        // The white stage retains its original exposure; the interior gains a filmic shoulder.
        gl_FragColor=vec4(mix(clamp(original,0.0,1.0),ACESFilmicToneMapping(c),uInterior),1.0);
        float edge=smoothstep(0.20,0.82,length((v-.5)*vec2(1.12,1.0)));
        gl_FragColor.rgb*=1.0-edge*0.075*uInterior;
        gl_FragColor=sRGBTransferOETF(gl_FragColor);
        float noise=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-0.5;
        gl_FragColor.rgb+=noise*uGrain*uInterior;
      }`,
  });
  readonly quad=new FullScreenQuad(this.material);
  readonly antialias=new ShaderMaterial({
    uniforms:{tDiffuse:{value:this.output.texture},resolution:{value:new Vector2(1,1)}},
    vertexShader:FXAAShader.vertexShader,fragmentShader:FXAAShader.fragmentShader,depthTest:false,depthWrite:false,toneMapped:false,
  });
  readonly antialiasQuad=new FullScreenQuad(this.antialias);
  width=1;height=1;
  enabled=true;
  constructor(){this.target.texture.name='Mathverse.cinematic-HDR';this.output.texture.name='Mathverse.cinematic-output';this.bloom.renderToScreen=false;}
  resize(width:number,height:number):void {
    width=Math.max(2,Math.round(width));height=Math.max(2,Math.round(height));
    if(width===this.width&&height===this.height)return;
    this.width=width;this.height=height;this.target.setSize(width,height);
    this.output.setSize(width,height);this.antialias.uniforms.resolution.value.set(1/width,1/height);
    this.bloom.setSize(Math.round(width*ATMOSPHERE.bloomResolution),Math.round(height*ATMOSPHERE.bloomResolution));
  }
  present(gl:WebGLRenderer,z:number):void {
    const interior=lightPassage(z);this.material.uniforms.uInterior.value=interior;
    gl.setScissorTest(false);gl.autoClear=false;
    // The white stage stays free of Bloom; only HDR lights cross the threshold inside.
    if(this.enabled&&interior>0.001){this.bloom.strength=ATMOSPHERE.bloomStrength*interior;this.bloom.render(gl,this.target,this.target,0,false);}
    gl.setRenderTarget(this.output);
    this.quad.render(gl);
    gl.setRenderTarget(null);gl.setViewport(0,0,this.width/gl.getPixelRatio(),this.height/gl.getPixelRatio());
    this.antialiasQuad.render(gl);
  }
  dispose():void {this.target.dispose();this.output.dispose();this.bloom.dispose();this.material.dispose();this.antialias.dispose();this.quad.dispose();this.antialiasQuad.dispose();}
}
