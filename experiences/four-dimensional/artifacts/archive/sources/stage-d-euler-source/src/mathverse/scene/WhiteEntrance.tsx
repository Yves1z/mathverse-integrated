import { useMemo } from 'react';
import { BackSide, FrontSide, Shape, ShapeGeometry } from 'three';
import { ARCH, archShape } from './archGeometry';

const vertex = `varying vec3 worldPoint;
void main(){ vec4 world=modelMatrix*vec4(position,1.0); worldPoint=world.xyz; gl_Position=projectionMatrix*viewMatrix*world; }`;
const whiteFragment = `varying vec3 worldPoint;
void main(){
  float pool=exp(-dot(worldPoint.xz-vec2(-3.0,3.0),worldPoint.xz-vec2(-3.0,3.0))/170.0);
  float fall=exp(-abs(worldPoint.y)*0.12);
  vec3 white=vec3(0.987,0.990,0.992)+vec3(0.012,0.009,0.005)*pool*fall;
  gl_FragColor=vec4(white,1.0);
}`;

export function WhiteEntrance() {
  const wall = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(-150,-100); shape.lineTo(150,-100); shape.lineTo(150,150); shape.lineTo(-150,150); shape.closePath();
    shape.holes.push(archShape(ARCH.radius, ARCH.height, -0.02));
    return new ShapeGeometry(shape,64);
  }, []);
  return <group>
    <mesh geometry={wall} position={[0,0,-0.12]} userData={{mathOccluder:true}}>
      <shaderMaterial vertexShader={vertex} fragmentShader={whiteFragment} side={FrontSide} fog={false} toneMapped={false} />
    </mesh>
    <mesh geometry={wall} position={[0,0,-0.121]} userData={{mathOccluder:true}}>
      <meshBasicMaterial color="#0c1012" side={BackSide} />
    </mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.015,25]}>
      <planeGeometry args={[300,50]} />
      <shaderMaterial vertexShader={vertex} fragmentShader={whiteFragment} fog={false} toneMapped={false} />
    </mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.009,0.8]} receiveShadow>
      <planeGeometry args={[8,8]} /><shadowMaterial transparent opacity={0.10} />
    </mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.007,0.06]}>
      <planeGeometry args={[2.6,1.15]} />
      <shaderMaterial transparent depthWrite={false} toneMapped={false}
        vertexShader={`varying vec2 v; void main(){v=uv*2.0-1.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`}
        fragmentShader={`varying vec2 v; void main(){float a=exp(-dot(v*vec2(1.7,2.7),v*vec2(1.7,2.7)))*0.07; gl_FragColor=vec4(vec3(0.30),a);}`} />
    </mesh>
    <mesh position={[0,30,40]} rotation={[0,Math.PI,0]}>
      <planeGeometry args={[300,300]} />
      <meshBasicMaterial color="#ffffff" fog={false} toneMapped={false} />
    </mesh>
  </group>;
}
