import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, DynamicDrawUsage, Group, InstancedMesh, Object3D, Vector3 } from 'three';
import { MOTION, type MotionState } from '../config/motion';
import { VISUAL } from '../config/visual';
import { archRing } from './archGeometry';

type P4 = [number, number, number, number];
type Edge = { a: P4; b: P4; kind: 'body' | 'fine' | 'light' };
type Cell = { center: [number, number, number]; size: P4; yaw: number; roll: number; phase: number; edges: Edge[]; faces: P4[][] };

function makeCell(center: Cell['center'], size: P4, yaw: number, roll: number, phase: number): Cell {
  const edges: Edge[] = [], faces: P4[][] = [];
  for (const inset of [1,0.62]) {
    const vertices = Array.from({length:16},(_,i) => size.map((s,axis) => (((i>>axis)&1) ? s : -s)*inset) as P4);
    for(let i=0;i<16;i++) for(let axis=0;axis<4;axis++) {
      const j=i^(1<<axis);
      if(i<j) edges.push({a:vertices[i],b:vertices[j],kind:inset===1 && axis===3 && i%4===0 ? 'light' : 'body'});
    }
  }
  // Lamellae belong to different fourth-axis layers; their planes shear as w rotates.
  for(let layer=0;layer<9;layer++) {
    const w=-size[3]+2*size[3]*layer/8;
    for(const z of [-size[2]*0.88,size[2]*0.88]) {
      const v: P4[]=[[-size[0],-size[1],z,w],[size[0],-size[1],z,w],[size[0],size[1],z,w],[-size[0],size[1],z,w]];
      for(let k=0;k<4;k++) edges.push({a:v[k],b:v[(k+1)%4],kind:'fine'});
    }
    for(let rib=0;rib<7;rib++) {
      const x=-size[0]+size[0]*rib/3;
      edges.push({a:[x,size[1],-size[2],w],b:[x,size[1],size[2],w],kind:'fine'});
    }
  }
  for(const w of [-size[3],size[3]]) {
    faces.push([[-size[0],size[1],-size[2],w],[size[0],size[1],-size[2],w],[size[0],size[1],size[2],w],[-size[0],size[1],size[2],w]]);
    faces.push([[-size[0],-size[1],-size[2],w],[-size[0],size[1],-size[2],w],[-size[0],size[1],size[2],w],[-size[0],-size[1],size[2],w]]);
  }
  return {center,size,yaw,roll,phase,edges,faces};
}

function cellsFor(first: number): Cell[] {
  const result: Cell[]=[];
  if(first===0) {
    result.push(makeCell([-18.5,MOTION.eyeHeight+1.8,-10], [4.0,6.2,3.0,1.0], 1.20,-0.18,0.35));
    result.push(makeCell([18.0,MOTION.eyeHeight-1.2,-11], [5.0,7.0,3.5,1.3], -1.30,0.28,1.2));
  }
  for(let section=first;section<first+VISUAL.sectionCount;section++) {
    const z=-18-section*VISUAL.cellSize;
    const phase=section*1.27;
    const flip=section%2===0 ? 1 : -1;
    result.push(makeCell([-7.8*flip, MOTION.eyeHeight+1.4, z], [5.3,7.3,4.3,1.8], flip*0.37,flip*0.25,phase));
    result.push(makeCell([10.5*flip,MOTION.eyeHeight-3.0,z-9], [5.4,8.8,3.7,2.0], -flip*0.48,-flip*0.42,phase+1.4));
    result.push(makeCell([1.2*flip,MOTION.eyeHeight+12.2,z-6], [7.8,3.4,5.2,1.4], 0.2,flip*0.16,phase+0.7));
  }
  return result;
}

function project(point: P4, cell: Cell, cycle: number, out: Vector3): Vector3 {
  let [x,y,z,w]=point;
  const a=0.27+0.43*Math.sin(cycle+cell.phase*0.18), b=0.22+0.29*Math.cos(cycle*0.83+cell.phase*0.22);
  let c=Math.cos(a),s=Math.sin(a),old=x;
  x=x*c-w*s; w=old*s+w*c;
  c=Math.cos(b);s=Math.sin(b);old=z;
  z=z*c-w*s;w=old*s+w*c;
  const scale=8/(8-w);
  x*=scale;y*=scale;z*=scale;
  c=Math.cos(cell.yaw);s=Math.sin(cell.yaw);old=x;
  x=x*c+z*s;z=-old*s+z*c;
  c=Math.cos(cell.roll);s=Math.sin(cell.roll);old=x;
  x=x*c-y*s;y=old*s+y*c;
  return out.set(x+cell.center[0],y+cell.center[1],z+cell.center[2]);
}

function clearance(a: Vector3,b: Vector3): number {
  const x=b.x-a.x,y=b.y-a.y,den=x*x+y*y;
  const t=den>0 ? Math.max(0,Math.min(1,-(a.x*x+(a.y-MOTION.eyeHeight)*y)/den)) : 0;
  return Math.hypot(a.x+x*t,a.y-MOTION.eyeHeight+y*t);
}

export function FoldedField({motion}: {motion:MotionState}) {
  const [first,setFirst]=useState(0);
  const cells=useMemo(()=>cellsFor(first),[first]);
  const counts=useMemo(()=>{
    const c={body:0,fine:0,light:0,faces:0};
    cells.forEach(cell=>{cell.edges.forEach(edge=>c[edge.kind]++);c.faces+=cell.faces.length;});
    return c;
  },[cells]);
  const body=useRef<InstancedMesh>(null),fine=useRef<InstancedMesh>(null),light=useRef<InstancedMesh>(null),halo=useRef<InstancedMesh>(null);
  const group=useRef<Group>(null);
  const resources=useMemo(()=>{
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new BufferAttribute(new Float32Array(counts.faces*18),3).setUsage(DynamicDrawUsage));
    geometry.setAttribute('color',new BufferAttribute(new Float32Array(counts.faces*18),3).setUsage(DynamicDrawUsage));
    const uv=new Float32Array(counts.faces*12);
    for(let i=0;i<counts.faces;i++) uv.set([0,0,1,0,1,1,0,0,1,1,0,1],i*12);
    geometry.setAttribute('uv',new BufferAttribute(uv,2));
    return {a:new Vector3(),b:new Vector3(),delta:new Vector3(),up:new Vector3(0,1,0),object:new Object3D(),quad:[new Vector3(),new Vector3(),new Vector3(),new Vector3()],geometry};
  },[counts.faces]);
  const reduced=useMemo(()=>matchMedia('(prefers-reduced-motion: reduce)').matches,[]);
  useFrame((_,rawDt)=>{
    if(!body.current || !fine.current || !light.current || !halo.current) return;
    const next=Math.max(0,Math.floor(motion.distance/VISUAL.cellSize)-VISUAL.sectionsBehind);
    if(next!==first)setFirst(next);
    if(motion.phase!=='idle' && !motion.suspended && !document.hidden && !motion.spaceFrozen && !reduced) motion.spaceTime+=Math.min(rawDt,MOTION.maxDt);
    const cycle=motion.spaceTime*Math.PI*2/VISUAL.foldPeriod;
    const indices={body:0,fine:0,light:0};
    const refs={body:body.current,fine:fine.current,light:light.current};
    const {a,b,delta,up,object,quad,geometry}=resources;
    let minimum=Infinity,visible=0,faceIndex=0;
    const positions=geometry.getAttribute('position') as BufferAttribute,colors=geometry.getAttribute('color') as BufferAttribute;
    for(const cell of cells) {
      for(const edge of cell.edges) {
        project(edge.a,cell,cycle,a);project(edge.b,cell,cycle,b);
        const gap=clearance(a,b);
        const fade=Math.max(0,Math.min(1,(gap-2.90)/0.65));
        const thickness=(edge.kind==='body'?0.075:edge.kind==='fine'?0.012:0.024)*fade;
        if(fade>0){minimum=Math.min(minimum,gap-thickness/2);visible++;}
        object.position.copy(a).add(b).multiplyScalar(0.5);
        delta.copy(b).sub(a);const length=delta.length();
        object.quaternion.setFromUnitVectors(up,delta.multiplyScalar(1/Math.max(length,0.0001)));
        object.scale.set(thickness,length,thickness);object.updateMatrix();
        const index=indices[edge.kind]++;
        refs[edge.kind].setMatrixAt(index,object.matrix);
        if(edge.kind==='light') {object.scale.set(thickness*6,length,thickness*6);object.updateMatrix();halo.current.setMatrixAt(index,object.matrix);}
      }
      for(const face of cell.faces) {
        face.forEach((p,k)=>project(p,cell,cycle,quad[k]));
        let nearest=Infinity,positive=false,negative=false;
        for(let k=0;k<4;k++) {
          const q=quad[k],r=quad[(k+1)%4];nearest=Math.min(nearest,clearance(q,r));
          const cross=(r.x-q.x)*(MOTION.eyeHeight-q.y)-(r.y-q.y)*(-q.x);
          if(cross>0)positive=true;else negative=true;
        }
        const fade=positive&&negative ? Math.max(0,Math.min(1,(nearest-2.9)/0.65)) : 0;
        for(const k of [0,1,2,0,2,3]) {
          positions.setXYZ(faceIndex,quad[k].x,quad[k].y,quad[k].z);
          colors.setXYZ(faceIndex,fade*0.17,fade*0.22,fade*0.24);faceIndex++;
        }
      }
    }
    Object.values(refs).forEach(ref=>{ref.instanceMatrix.needsUpdate=true;});halo.current.instanceMatrix.needsUpdate=true;
    positions.needsUpdate=true;colors.needsUpdate=true;
    if(group.current)group.current.userData={minimumClearance:minimum,firstSection:first,primaryCount:counts.body,fineCount:counts.fine,visibleEdges:visible,foldCycle:cycle,spaceTime:motion.spaceTime};
  });
  return <group ref={group} name="structure-field">
    <instancedMesh ref={body} args={[undefined,undefined,counts.body]} frustumCulled={false}>
      <boxGeometry /><meshStandardMaterial color={VISUAL.primaryStructure} roughness={0.48} metalness={0.28} emissive="#33464c" emissiveIntensity={0.18} />
    </instancedMesh>
    <instancedMesh ref={fine} args={[undefined,undefined,counts.fine]} frustumCulled={false}>
      <boxGeometry /><meshStandardMaterial color="#718689" roughness={0.5} metalness={0.2} emissive="#455d66" emissiveIntensity={0.11} />
    </instancedMesh>
    <instancedMesh ref={light} args={[undefined,undefined,counts.light]} frustumCulled={false}>
      <boxGeometry /><meshBasicMaterial color={VISUAL.light} toneMapped={false} />
    </instancedMesh>
    <instancedMesh ref={halo} args={[undefined,undefined,counts.light]} frustumCulled={false}>
      <boxGeometry /><meshBasicMaterial color="#badce1" transparent opacity={0.10} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
    </instancedMesh>
    <mesh geometry={resources.geometry} frustumCulled={false}>
      <shaderMaterial vertexColors transparent side={DoubleSide} depthWrite={false}
        vertexShader={`varying vec3 p; varying vec3 tint; varying vec2 v;
          void main(){vec4 w=modelMatrix*vec4(position,1.0);p=w.xyz;tint=color;v=uv;gl_Position=projectionMatrix*viewMatrix*w;}`}
        fragmentShader={`varying vec3 p; varying vec3 tint; varying vec2 v;
          void main(){
            vec3 n=normalize(cross(dFdx(p),dFdy(p)));
            float fresnel=pow(1.0-abs(dot(n,normalize(cameraPosition-p))),3.0);
            float edge=smoothstep(0.975,1.0,max(abs(v.x*2.0-1.0),abs(v.y*2.0-1.0)));
            vec3 metal=mix(vec3(0.07,0.085,0.09),vec3(0.18,0.20,0.21),v.y)*0.8;
            metal+=vec3(0.13,0.15,0.15)*fresnel+vec3(0.10)*edge;
            float distanceFade=exp(-length(cameraPosition-p)*0.017);
            gl_FragColor=vec4(metal*distanceFade,clamp(tint.r/0.17,0.0,1.0)*0.84);
          }`} />
    </mesh>
    <mesh position={[9.0,0.5,-36]} rotation={[0,-0.45,0.12]} scale={[2.3,2.3,2.3]}>
      <shapeGeometry args={[archRing(0.65,2.76,0.006),64]} />
      <meshBasicMaterial color="#d7cec0" side={DoubleSide} />
    </mesh>
  </group>;
}
