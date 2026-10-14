export function Lighting() {
  return <>
    <ambientLight intensity={0.7} color="#eef4f3" />
    <directionalLight position={[-4,8,9]} intensity={2.8} color="#fffdf7" castShadow
      shadow-mapSize={[1024,1024]} shadow-camera-left={-3} shadow-camera-right={3}
      shadow-camera-top={5} shadow-camera-bottom={-2} shadow-camera-near={0.1}
      shadow-camera-far={22} shadow-bias={-0.0002} shadow-normalBias={0.012} shadow-radius={5} />
    <directionalLight position={[-10,12,-18]} intensity={2.1} color="#d6edf0" />
    <directionalLight position={[12,-4,-24]} intensity={1.0} color="#e3dbc7" />
    <directionalLight position={[0,2,-60]} intensity={0.65} color="#a1b8c0" />
  </>;
}
