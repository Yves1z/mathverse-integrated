export function Lighting() {
  return <>
    <ambientLight intensity={0.62} color="#d7d3c8" />
    <directionalLight position={[3, 7, 6]} intensity={2.2} color="#fff8ea" castShadow
      shadow-mapSize={[1024, 1024]} shadow-camera-left={-3} shadow-camera-right={3}
      shadow-camera-top={4} shadow-camera-bottom={-2} shadow-camera-near={0.1}
      shadow-camera-far={18} shadow-bias={-0.0002} shadow-normalBias={0.015} />
    <directionalLight position={[-7, 4, -12]} intensity={1.3} color="#c7c4ba" />
    <directionalLight position={[5, -3, -8]} intensity={0.48} color="#e2c79c" />
  </>;
}
