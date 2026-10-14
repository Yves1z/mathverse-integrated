import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { DataTexture, DirectionalLight, EquirectangularReflectionMapping, FloatType, Group, LinearFilter, LinearSRGBColorSpace, PMREMGenerator, RGBAFormat, Vector3 } from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import type { MotionState } from '../config/motion';
import { SPACE_A } from './spaceModel';

RectAreaLightUniformsLib.init();

function studioReflection() {
  const width = 256, height = 128, data = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = (x + .5) / width, v = (y + .5) / height;
    const aperture = (cx: number, cy: number, sx: number, sy: number) => {
      const dx = Math.min(Math.abs(u - cx), 1 - Math.abs(u - cx));
      return Math.exp(-((dx / sx) ** 4 + ((v - cy) / sy) ** 4));
    };
    const key = aperture(.22, .31, .09, .18) * 4.2;
    const rim = aperture(.74, .43, .035, .25) * 1.5;
    const crown = aperture(.5, .09, .3, .09) * .9;
    const i = (y * width + x) * 4;
    data[i] = .008 + key + rim * .92 + crown;
    data[i + 1] = .008 + key * .98 + rim * .96 + crown;
    data[i + 2] = .009 + key * .94 + rim + crown * .99;
    data[i + 3] = 1;
  }
  const texture = new DataTexture(data, width, height, RGBAFormat, FloatType);
  texture.mapping = EquirectangularReflectionMapping; texture.colorSpace = LinearSRGBColorSpace;
  texture.magFilter = texture.minFilter = LinearFilter; texture.needsUpdate = true;
  return texture;
}

export function ReflectionEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const previous = scene.environment, source = studioReflection(), generator = new PMREMGenerator(gl);
    const target = generator.fromEquirectangular(source);
    scene.environment = target.texture;
    source.dispose(); generator.dispose();
    return () => { scene.environment = previous; target.dispose(); };
  }, [gl, scene]);
  return null;
}

export function StudyLighting({ motion }: { motion: MotionState }) {
  const root = useRef<Group>(null), key = useRef<DirectionalLight>(null), rim = useRef<DirectionalLight>(null);
  const [first, setFirst] = useState(-1);
  const sections = useMemo(() => Array.from({ length: 3 }, (_, i) => first + i), [first]);
  // Snap the shadow coverage in the light's own basis, rather than rounding Z.
  // Illumination has a constant world direction; only its coverage travels.
  const basis = useMemo(() => {
    const direction = new Vector3(-32, 44, 22).normalize();
    const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize();
    const up = new Vector3().crossVectors(direction, right);
    return { direction, right, up, center: new Vector3(), snapped: new Vector3() };
  }, []);
  useFrame(() => {
    const next = Math.floor(motion.distance / SPACE_A.bayLength) - 1;
    if (next !== first) setFirst(next);
    const { direction, right, up, center, snapped } = basis;
    center.set(0, 2, motion.z - 18);
    const tx = 112 / 2048, ty = 96 / 2048;
    snapped.copy(right).multiplyScalar(Math.round(center.dot(right) / tx) * tx)
      .addScaledVector(up, Math.round(center.dot(up) / ty) * ty)
      .addScaledVector(direction, center.dot(direction));
    if (key.current) {
      key.current.position.copy(snapped).addScaledVector(direction, 80);
      key.current.target.position.copy(snapped); key.current.target.updateMatrixWorld();
    }
    if (rim.current) {
      rim.current.position.set(35, 18, -25); rim.current.target.position.set(0, 3, 0); rim.current.target.updateMatrixWorld();
    }
    if (root.current) root.current.userData = { shadowMaps: 1, shadowRadius: 3.2, texelSnapped: true,
      environment: 'procedural-soft-apertures', lightSections: sections, areaLights: sections.length, animatedIntensity: false };
  }, -.5);
  return <group ref={root} name="study-lighting">
    <ReflectionEnvironment/>
    <ambientLight intensity={.035} color="#d9dadb"/>
    <hemisphereLight intensity={.14} color="#e0dfdc" groundColor="#131415"/>
    <directionalLight ref={key} color="#f3f0ea" intensity={1.9} castShadow
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-56} shadow-camera-right={56}
      shadow-camera-top={48} shadow-camera-bottom={-48} shadow-camera-near={1} shadow-camera-far={200}
      shadow-bias={-.00006} shadow-normalBias={.028} shadow-radius={3.2} shadow-intensity={.85}/>
    <directionalLight ref={rim} color="#e2e3e3" intensity={.65}/>
    {sections.map(section => <group key={section}>
      <rectAreaLight position={[-42, 18, -8 - section * SPACE_A.bayLength]} rotation={[-.25, -1.05, 0]}
        width={18} height={18} color="#f0eee8" intensity={6.8}/>
      <pointLight position={[-27, 5.55, -30 - section * SPACE_A.bayLength]}
        color="#eee4d1" intensity={180} distance={34} decay={2}/>
      {section % 2 === 0 && <pointLight position={[22.24, 16.05, -35.3 - section * SPACE_A.bayLength]}
        color="#eee2ca" intensity={100} distance={22} decay={2}/>}
    </group>)}
  </group>;
}
