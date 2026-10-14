import { BufferGeometry,CanvasTexture,CatmullRomCurve3,Float32BufferAttribute,PlaneGeometry,SphereGeometry,SRGBColorSpace,TubeGeometry,Vector3 } from 'three';
import type { RendererKey } from './nodes';

function textTexture(key:RendererKey):CanvasTexture{
  const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=400;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#ede5d5';ctx.textBaseline='alphabetic';
  if(key==='identity'){
    const parts=[{text:'e',font:'italic 184px Georgia',dy:0},{text:'iπ',font:'italic 106px Georgia',dy:-92},{text:' + 1 = 0',font:'184px Georgia',dy:0}];
    const widths=parts.map(p=>{ctx.font=p.font;return ctx.measureText(p.text).width;});let x=(canvas.width-widths.reduce((a,b)=>a+b,0))/2;
    parts.forEach((p,i)=>{ctx.font=p.font;ctx.fillText(p.text,x,270+p.dy);x+=widths[i];});
  }else if(key==='gaussian'){
    ctx.font='190px Georgia';ctx.fillText('∫',165,280);ctx.font='58px Georgia';ctx.fillText('∞',206,104);ctx.fillText('−∞',160,346);
    ctx.font='italic 178px Georgia';ctx.fillText('e',335,267);ctx.font='italic 92px Georgia';ctx.fillText('−x²',420,170);
    ctx.font='165px Georgia';ctx.fillText('dx = √π',605,267);
  }else if(key==='rotation'){
    ctx.font='italic 144px Georgia';ctx.fillText('e',190,260);ctx.font='italic 80px Georgia';ctx.fillText('iθ',265,176);
    ctx.font='124px Georgia';ctx.fillText('= cos θ + i sin θ',415,260);
  }else if(key==='person'){
    ctx.textAlign='center';ctx.font='180px Georgia';ctx.fillText('EULER',768,220);ctx.font='43px Georgia';ctx.fillText('1707 — 1783',768,326);
  }
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.anisotropy=4;return texture;
}
const lineGeometry=(points:Vector3[])=>new BufferGeometry().setFromPoints(points);
export function mobiusPoint(u:number,v:number):Vector3{return new Vector3((1+v*Math.cos(u/2))*Math.cos(u),v*Math.sin(u/2),(1+v*Math.cos(u/2))*Math.sin(u));}
export function createMathAssets(){
  const circlePoints=Array.from({length:129},(_,i)=>new Vector3(Math.cos(i*Math.PI/64),Math.sin(i*Math.PI/64),0));
  const positions:number[]=[],indices:number[]=[],nu=128,nv=16;
  for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++)positions.push(...mobiusPoint(i*2*Math.PI/nu,-0.34+0.68*j/nv).toArray());
  for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=i*(nv+1)+j,b=a+nv+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const mobius=new BufferGeometry();mobius.setAttribute('position',new Float32BufferAttribute(positions,3));mobius.setIndex(indices);mobius.computeVertexNormals();
  const rim=Array.from({length:257},(_,i)=>mobiusPoint(i*Math.PI/64,0.34));
  const grid:Vector3[]=[];
  for(let i=0;i<=32;i++){const u=i*Math.PI/16;grid.push(mobiusPoint(u,-0.34),mobiusPoint(u,0.34));}
  const assets={
    plane:new PlaneGeometry(3.8,0.99),
    circle:new TubeGeometry(new CatmullRomCurve3(circlePoints),128,0.009,6,false),
    axes:lineGeometry([new Vector3(-1.45,0,0),new Vector3(1.45,0,0),new Vector3(0,-1.45,0),new Vector3(0,1.45,0)]),
    radial:lineGeometry([new Vector3(),new Vector3(1,0,0)]),
    point:new SphereGeometry(0.045,16,12),
    gaussian:lineGeometry(Array.from({length:161},(_,i)=>{const x=-2.5+i/32;return new Vector3(x,Math.exp(-x*x)*1.35-0.65,0);})),
    gaussianAxis:lineGeometry([new Vector3(-2.6,-0.65,0),new Vector3(2.6,-0.65,0)]),
    mobius,rim:new TubeGeometry(new CatmullRomCurve3(rim),256,0.008,6,false),mobiusGrid:lineGeometry(grid),
    textures:new Map<RendererKey,CanvasTexture>(['identity','gaussian','rotation','person'].map(key=>[key as RendererKey,textTexture(key as RendererKey)])),
  };
  return assets;
}
export type MathAssets=ReturnType<typeof createMathAssets>;
export function disposeMathAssets(assets:MathAssets):void{Object.values(assets).forEach(asset=>{if(asset instanceof BufferGeometry)asset.dispose();});assets.textures.forEach(texture=>texture.dispose());}
