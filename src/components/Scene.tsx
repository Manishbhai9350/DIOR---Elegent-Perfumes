import { PerspectiveCamera, useHelper } from "@react-three/drei";
import { Dior2 } from "./Dior2";
import { useRef } from "react";
import * as THREE from "three";
import { RectAreaLightHelper } from "three/examples/jsm/Addons.js";

const Scene = () => {
  const point1Ref = useRef<THREE.PointLight>(null);
  const point2Ref = useRef<THREE.PointLight>(null);
  const point3Ref = useRef<THREE.PointLight>(null);
  const point4Ref = useRef<THREE.PointLight>(null);
  const rect1Ref = useRef<THREE.RectAreaLight>(null);
  const rect2Ref = useRef<THREE.RectAreaLight>(null);

  // useHelper(point1Ref, THREE.PointLightHelper, 0.5)
  // useHelper(point2Ref, THREE.PointLightHelper, 0.5)
  // useHelper(point3Ref, THREE.PointLightHelper, 0.5)
  // useHelper(point4Ref, THREE.PointLightHelper, 0.5)
  // useHelper(rect1Ref, RectAreaLightHelper)
  // useHelper(rect2Ref, RectAreaLightHelper)

  return (
    <group>
      {/* <DiroScene /> */}
      {/* <DiorScene2 position={[1,0,0]} /> */}
      <Dior2 />
      {/* <PerspectiveCamera
        name="main-cam"
        makeDefault
        far={1000}
        near={0.1}
        fov={50}
        position={[32, 10, 0]}
        rotation={[-1.378, 1.35, 1.375]}
      /> */}

      {/* <pointLight ref={point1Ref} position={[0, 3, 0]} color={'brown'} intensity={900} />
      <pointLight ref={point2Ref} position={[-2, 3, 0]} color={'white'} intensity={900} />
      <pointLight ref={point3Ref} position={[2, 3, 0]} color={'white'} intensity={900} />
      <pointLight ref={point4Ref} position={[0, 3, 2]} color={'white'} intensity={900} /> */}

      <rectAreaLight
        ref={rect1Ref}
        position={[0, 1 / 2, 3.2]}
        width={8}
        height={1}
        intensity={1000}
        color={"#ffb3b3"}
      />
      <rectAreaLight
        ref={rect2Ref}
        position={[0, 1 / 2,-3.2]}
        width={8}
        height={1}
        intensity={1000}
        color={"#ffb3b3"}
        rotation={[0, Math.PI, 0]}
      />
      <rectAreaLight
        // ref={rect1Ref}
        position={[0, 0 * 4.5, 3.2]}
        width={8}
        height={1}
        intensity={700}
        color={"#ffb3b3"}
      />
      <rectAreaLight
        // ref={rect2Ref}
        position={[0, 0 * 4.5, -3.2]}
        width={8}
        height={1}
        intensity={700}
        color={"#ffb3b3"}
        rotation={[0, Math.PI, 0]}
      />

      <ambientLight color={0xffffff} intensity={0.1} />
    </group>
  );
};

export default Scene;
