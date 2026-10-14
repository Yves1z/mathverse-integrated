import {BufferGeometry,Color,Float32BufferAttribute,HalfFloatType,PerspectiveCamera,PlaneGeometry,Scene,WebGLRenderTarget} from 'three';
import {MATH_NODES} from '../content/nodes';
import {WINDOW} from './windowMotion';
export function createWindowAssets(){
  const worlds=new Map(MATH_NODES.map(node=>{
    const scene=new Scene();scene.background=new Color('#060a0d');
    const camera=new PerspectiveCamera(44,WINDOW.width/WINDOW.height,0.05,90);camera.position.set(0,0,7);
    const target=new WebGLRenderTarget(WINDOW.textureWidth,WINDOW.textureHeight,{type:HalfFloatType,depthBuffer:true});target.texture.name=`world-${node.id}`;
    return[node.id,{scene,camera,target,initialized:false,lastRendered:-1}];
  }));
  const helix=new BufferGeometry();const hp:number[]=[];
  for(let i=0;i<=480;i++){const theta=-4*Math.PI+i*8*Math.PI/480;hp.push(1.8*Math.cos(theta),1.8*Math.sin(theta),-theta*0.58);}
  helix.setAttribute('position',new Float32BufferAttribute(hp,3));
  const surface=new BufferGeometry(),p:number[]=[],indices:number[]=[],n=64;
  for(let i=0;i<=n;i++)for(let j=0;j<=n;j++){const x=-3+6*i/n,z=-3+6*j/n;p.push(x,2.8*Math.exp(-(x*x+z*z))-1,z);}
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){const a=i*(n+1)+j,b=a+n+1;indices.push(a,a+1,b,b,a+1,b+1);}
  surface.setAttribute('position',new Float32BufferAttribute(p,3));surface.setIndex(indices);surface.computeVertexNormals();
  const gridPoints:number[]=[];
  for(let line=0;line<=20;line++)for(let segment=0;segment<64;segment++)for(const axis of [0,1])for(const end of [segment,segment+1]){
    const fixed=-3+line*.3,along=-3+end*6/64,x=axis===0?fixed:along,z=axis===0?along:fixed;
    gridPoints.push(x,2.8*Math.exp(-(x*x+z*z))-.976,z);
  }
  const surfaceGrid=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(gridPoints,3));
  const jamb=new BufferGeometry(),jp:number[]=[],corners=[[-WINDOW.width/2,-WINDOW.height/2],[WINDOW.width/2,-WINDOW.height/2],[WINDOW.width/2,WINDOW.height/2],[-WINDOW.width/2,WINDOW.height/2]];
  for(let i=0;i<4;i++){
    const a=corners[i],b=corners[(i+1)%4],back=(v:number[])=>[v[0]-Math.sign(v[0])*0.15,v[1]-Math.sign(v[1])*0.15,-0.7];
    jp.push(...[...a,0.12],...[...b,0.12],...back(b),...[...a,0.12],...back(b),...back(a));
  }
  jamb.setAttribute('position',new Float32BufferAttribute(jp,3));jamb.computeVertexNormals();
  return{worlds,helix,surface,surfaceGrid,jamb,opening:new PlaneGeometry(WINDOW.width-0.3,WINDOW.height-0.3)};
}
export type WindowAssets=ReturnType<typeof createWindowAssets>;
export function disposeWindowAssets(assets:WindowAssets):void{assets.worlds.forEach(world=>world.target.dispose());assets.helix.dispose();assets.surface.dispose();assets.surfaceGrid.dispose();assets.jamb.dispose();assets.opening.dispose();}
