export const ATMOSPHERE = {
  dustPerSection: 144,
  sectionLength: 22,
  sections: 10,
  sectionsBehind: 3,
  connectionParticles: 96,
  worldParticles: 160,
  bloomStrength: 0.30,
  bloomRadius: 0.48,
  bloomThreshold: 1.12,
  bloomResolution: 0.70,
  exposure: 0.96,
  grain: 0.0025,
} as const;

// Stable section seeds: advancing or looking back never rerolls the same dust.
export function randomForSection(section:number):()=>number {
  let state=(Math.imul(section+104729,747796405)^0x9e3779b9)>>>0;
  return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
}
export function lightPassage(z:number):number {
  const t=Math.max(0,Math.min(1,(1.0-z)/4.0));return t*t*(3-2*t);
}
export function dustSection(distance:number):number {return Math.floor(Math.max(0,distance)/ATMOSPHERE.sectionLength)-ATMOSPHERE.sectionsBehind;}

export const particleFragment = `
  varying float vAlpha;varying vec3 vTint;
  void main(){
    vec2 p=gl_PointCoord*2.0-1.0;float r=dot(p,p);
    if(r>1.0)discard;
    float halo=exp(-r*4.8)*(1.0-smoothstep(0.62,1.0,r));
    float core=exp(-r*24.0);
    gl_FragColor=vec4(vTint*(0.65+core*0.65),vAlpha*(halo*0.70+core*0.30));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
