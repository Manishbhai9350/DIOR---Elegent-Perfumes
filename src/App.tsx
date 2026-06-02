import { Canvas } from "@react-three/fiber";
import Scene from "./components/Scene";
import { Environment, OrbitControls, Stats } from "@react-three/drei";
import { ACESFilmicToneMapping } from 'three';

const App = () => {
  
  return (
    <main>
      <Canvas
        gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure:.9  }}
      >
        <Stats />
        <Scene />
        <Environment preset="studio" />
        <OrbitControls makeDefault />
      </Canvas>
    </main>
  );
};

export default App;
