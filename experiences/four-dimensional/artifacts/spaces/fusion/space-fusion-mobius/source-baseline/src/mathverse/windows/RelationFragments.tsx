import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {BufferGeometry,Color,Float32BufferAttribute,Mesh,MeshBasicMaterial,LineBasicMaterial,Vector3} from 'three';
import type {ContentRuntime} from '../content/runtime';
import type {MathAssets} from '../content/assets';
import type {ReadingState} from '../reading/ReadingKernel';
import {circleOwner,relationArcSegments,relationLocalPoint} from './relationship';

export function RelationFragments({index,id,runtime,assets,reading}:{index:number;id:string;runtime:ContentRuntime;assets:MathAssets;reading:ReadingState}){
  const marker=useRef<Mesh>(null);
  const resources=useMemo(()=>{
    const arc=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(relationArcSegments(index),3));
    const trail=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(new Float32Array(90*3),3));
    const material=new LineBasicMaterial({color:'#d4c9ac',transparent:true,depthWrite:false});
    const light=new LineBasicMaterial({color:new Color(3.5,2.8,1.65),transparent:true,toneMapped:false,depthWrite:false});
    const point=new MeshBasicMaterial({color:new Color(5,4,2.4),transparent:true,toneMapped:false,depthWrite:false});
    return{arc,trail,material,light,point,vector:new Vector3()};
  },[index]);
  useEffect(()=>()=>{resources.arc.dispose();resources.trail.dispose();resources.material.dispose();resources.light.dispose();resources.point.dispose();},[resources]);
  useFrame(()=>{
    const alpha=runtime.nodes.get(id)!.alpha*(1-reading.progress),angle=runtime.connection.angle;
    resources.material.opacity=alpha*.9;resources.light.opacity=alpha*.85;resources.point.opacity=alpha;
    if(marker.current){marker.current.visible=circleOwner(angle)===index;relationLocalPoint(index,angle,marker.current.position);}
    const positions=resources.trail.getAttribute('position');let n=0;
    for(let i=0;i<45;i++){
      const a=angle-.23+i*.23/45,b=angle-.23+(i+1)*.23/45;
      if(circleOwner((a+b)/2)!==index)continue;
      relationLocalPoint(index,a,resources.vector);positions.setXYZ(n++,resources.vector.x,resources.vector.y,resources.vector.z+.005);
      relationLocalPoint(index,b,resources.vector);positions.setXYZ(n++,resources.vector.x,resources.vector.y,resources.vector.z+.005);
    }resources.trail.setDrawRange(0,n);positions.needsUpdate=true;
  },.3);
  return <group name={`relation-fragment-${index}`} dispose={null}>
    <lineSegments geometry={resources.arc} material={resources.material} raycast={()=>null}/>
    <lineSegments geometry={resources.trail} material={resources.light} frustumCulled={false} raycast={()=>null}/>
    <mesh ref={marker} geometry={assets.point} material={resources.point} scale={[6.2/2.1*1.7,4/6.8*1.7,1.7]} raycast={()=>null}/>
  </group>;
}
