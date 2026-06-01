import { Canvas } from "@react-three/fiber";
import Scene from "./components/Scene";
import { OrbitControls } from "@react-three/drei";

const App = () => {
  return (
    <main>
      <Canvas>
        <Scene />
        <OrbitControls makeDefault />
      </Canvas>
    </main>
  );
};

export default App;
