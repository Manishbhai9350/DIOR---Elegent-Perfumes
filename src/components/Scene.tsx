import React from "react";
import { DiroScene } from "./DiorScene";
import { DiorScene2 } from "./DiorScene2";
import { PerspectiveCamera } from "@react-three/drei";

const Scene = () => {
  return (
    <group>
      {/* <DiroScene /> */}
      <DiorScene2 position={[1,0,0]} />
      <PerspectiveCamera
        name="main-cam"
        makeDefault={true}
        far={1000}
        near={0.1}
        fov={50}
        position={[32, 10, 0]}
        rotation={[-1.378, 1.35, 1.375]}
      />

      <ambientLight color={0xffffff} intensity={1} />
    </group>
  );
};

export default Scene;
