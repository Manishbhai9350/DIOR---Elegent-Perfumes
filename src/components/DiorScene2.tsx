/**
 * DiorSceneNoir.tsx
 *
 * Warm noir corridor — charcoal env, cream emissives, floating torus hero.
 *
 * Setup required in your Canvas parent:
 *   npm i tweakpane @react-three/postprocessing postprocessing
 *
 * Your Canvas needs:
 *   <Canvas gl={{ antialias: true }} toneMapping={THREE.ACESFilmicToneMapping} toneMappingExposure={1}>
 *     <DiorSceneNoir />
 *   </Canvas>
 *
 * When you have the real bottle GLB, swap the <TorusStandIn> with:
 *   const { scene } = useGLTF('/models/perfume.glb')
 *   return <primitive object={scene} />
 */

import * as THREE from "three";
import { useRef, useEffect, useState, useMemo } from "react";
import { useGLTF, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { Pane } from "tweakpane";
import { type GLTF } from "three-stdlib";
import type { JSX } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type GLTFResult = GLTF & {
  nodes: Record<string, THREE.Mesh>;
};

// ─── Tweakpane state (module-level so it survives re-renders) ─────────────────

const params = {
  // emissive colours
  ceilingColor:    "#f5e6c8",
  pillarColor:     "#ffc343",
  backColor:       "#c2c2c2",
  // per-group emissive intensities
  ceilingEmInt:    3.0,
  pillarEmInt:     3.5,
  backEmInt:       2.5,
  // bloom
  bloomInt:        1.1,
  bloomThreshold:  0.65,
  bloomSmoothing:  0.08,
  bloomRadius:     0.4,        // mipmapBlur radius
  // spot
  spotIntensity:   60,
  spotAngle:       0.28,
  spotPenumbra:    0.7,
  spotColor:       "#f5e0b0",
  // vignette
  vignetteOffset:  0.22,
  vignetteDark:    0.85,
  // ambient
  ambientInt:      0.04,
};

// ─── Tweakpane panel ──────────────────────────────────────────────────────────

interface PaneCallbacks {
  onUpdate: (p: typeof params) => void;
}

function TweakpanePanel({ onUpdate }: PaneCallbacks) {
  useEffect(() => {
    const pane = new Pane({ title: "NOIR CONTROLS", expanded: true });
    const el = pane.element as HTMLElement;
    el.style.cssText = `
      position:fixed; top:12px; right:12px; z-index:9999;
      font-family: 'Courier New', monospace;
    `;

    // ── Emissive colours + per-group intensity ──
    const emissive = pane.addFolder({ title: "Emissive", expanded: true });
    emissive.addBinding(params, "ceilingColor",  { label: "Ceiling Color" });
    emissive.addBinding(params, "ceilingEmInt",  { label: "Ceiling Intensity", min: 0, max: 10, step: 0.1 });
    emissive.addBinding(params, "pillarColor",   { label: "Pillar Color" });
    emissive.addBinding(params, "pillarEmInt",   { label: "Pillar Intensity",  min: 0, max: 10, step: 0.1 });
    emissive.addBinding(params, "backColor",     { label: "Back Color" });
    emissive.addBinding(params, "backEmInt",     { label: "Back Intensity",    min: 0, max: 10, step: 0.1 });

    // ── Bloom ──
    const bloom = pane.addFolder({ title: "Bloom", expanded: true });
    bloom.addBinding(params, "bloomInt",       { label: "Intensity",  min: 0,    max: 5,   step: 0.05 });
    bloom.addBinding(params, "bloomThreshold", { label: "Threshold",  min: 0,    max: 1,   step: 0.01 });
    bloom.addBinding(params, "bloomSmoothing", { label: "Smoothing",  min: 0,    max: 1,   step: 0.01 });
    bloom.addBinding(params, "bloomRadius",    { label: "Radius",     min: 0,    max: 1,   step: 0.01 });

    // ── Spot light ──
    const spot = pane.addFolder({ title: "Spot Light", expanded: false });
    spot.addBinding(params, "spotIntensity", { label: "Intensity", min: 0,   max: 300, step: 1    });
    spot.addBinding(params, "spotAngle",     { label: "Angle",     min: 0.01,max: 1,   step: 0.01 });
    spot.addBinding(params, "spotPenumbra",  { label: "Penumbra",  min: 0,   max: 1,   step: 0.01 });
    spot.addBinding(params, "spotColor",     { label: "Color" });

    // ── Vignette + Ambient ──
    const env = pane.addFolder({ title: "Environment", expanded: false });
    env.addBinding(params, "vignetteOffset", { label: "Vignette Offset", min: 0, max: 1, step: 0.01 });
    env.addBinding(params, "vignetteDark",   { label: "Vignette Dark",   min: 0, max: 1, step: 0.01 });
    env.addBinding(params, "ambientInt",     { label: "Ambient Light",   min: 0, max: 0.5, step: 0.005 });

    const id = setInterval(() => onUpdate({ ...params }), 50);
    return () => { clearInterval(id); pane.dispose(); };
  }, [onUpdate]);

  return null;
}

// ─── Emissive mesh wrapper ─────────────────────────────────────────────────────

interface EmissiveMeshProps {
  mesh: THREE.Mesh;
  color: string;
  intensity: number;
}

function EmissiveMesh({ mesh, color, intensity }: EmissiveMeshProps) {
  return (
    <mesh
      geometry={mesh.geometry}
      position={mesh.position}
      rotation={mesh.rotation}
      scale={mesh.scale}
      name={mesh.name}
    >
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={intensity}
        roughness={0.4}
        metalness={0.0}
        toneMapped={false}   // lets it punch past 1.0 in HDR → triggers bloom
      />
    </mesh>
  );
}

// ─── Material config for non-emissive meshes ──────────────────────────────────

// Warm charcoal palette — dark but with subtle warm undertone
const MESH_MATERIALS: Record<string, { color: string; roughness: number; metalness: number }> = {
  "walls-n-ceiling": { color: "#1a1714", roughness: 0.92, metalness: 0.00 },
  "side-pillars":    { color: "#211e1b", roughness: 0.85, metalness: 0.02 },
  "ceiling-boxes":   { color: "#1e1b18", roughness: 0.88, metalness: 0.01 },
  "base":            { color: "#2a2520", roughness: 0.70, metalness: 0.05 },
  "floor":           { color: "#141210", roughness: 0.35, metalness: 0.55 }, // polished dark floor — reflects emissives
  "Text":            { color: "#e8dcc8", roughness: 0.20, metalness: 0.70 }, // metallic gold-ish text
};

function getMeshMat(name: string) {
  const base = name.replace(/\d+$/, "");
  return (
    MESH_MATERIALS[base] ??
    MESH_MATERIALS[name] ??
    { color: "#1c1916", roughness: 0.80, metalness: 0.03 }
  );
}

// ─── Textured mesh — used for ceiling, floor, base ───────────────────────────

interface TexturedMeshProps {
  mesh: THREE.Mesh;
  color: string;
  roughness?: number;
  metalness?: number;
  normalScale?: number;
  aoIntensity?: number;
  displacementScale?: number;
  repeat?: [number, number];
  isFloor?: boolean; // use MeshPhysicalMaterial with clearcoat
}

function TexturedMesh({
  mesh,
  color,
  roughness = 0.75,
  metalness = 0.1,
  normalScale = 0.5,
  aoIntensity = 1.0,
  displacementScale = 0.0,
  repeat = [4, 4],
  isFloor = false,
}: TexturedMeshProps) {
  const [aoMap, heightMap, roughnessMap, normalMap] = useTexture([
    "/cube-ao.png",
    "/cube-height.png",
    "/cube-roughness.png",
    "/normal-map.jpg",
  ]);

  // Apply repeat + wrapping to all maps
  [aoMap, heightMap, roughnessMap, normalMap].forEach((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);

    t.needsUpdate = true;
  });

  const sharedProps = {
    color,
    aoMap,
    aoMapIntensity: aoIntensity,
    displacementMap: heightMap,
    displacementScale,
    displacementBias: -displacementScale * 0.5, // keep surface centred
    roughnessMap,
    roughness,
    normalMap,
    normalScale: new THREE.Vector2(normalScale, normalScale),
    metalness,
  };

  return (
    <mesh
      geometry={mesh.geometry}
      position={mesh.position}
      rotation={mesh.rotation}
      scale={mesh.scale}
      name={mesh.name}
    >
      {isFloor ? (
        <meshPhysicalMaterial
          {...sharedProps}
          clearcoat={0.8}
          clearcoatRoughness={0.15}
          reflectivity={0.9}
        />
      ) : (
        <meshStandardMaterial {...sharedProps} />
      )}
    </mesh>
  );
}

// ─── Torus stand-in (swap for GLB later) — positioned above the front base ───
// base mesh is at world position x=28.281 (scale 1.648), so torus sits at x=28

function TorusStandIn({ ringColor, spotCol }: { ringColor: string; spotCol: string }) {
  const groupRef  = useRef<THREE.Group>(null!);
  const torusRef  = useRef<THREE.Mesh>(null!);
  const ringRef   = useRef<THREE.Mesh>(null!);
  const t         = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    groupRef.current.position.y = 8 + Math.sin(t.current * 0.8) * 0.18;
    torusRef.current.rotation.y += delta * 0.4;
    torusRef.current.rotation.z += delta * 0.15;
    ringRef.current.rotation.y -= delta * 0.2;
  });

  return (
    // x=28 → above the front base (base is at 28.281 in world space)
    <group ref={groupRef} position={[28, 8, 0]}>
      {/* Main torus — dark metallic */}
      <mesh ref={torusRef}>
        <torusGeometry args={[1.1, 0.38, 64, 128]} />
        <meshStandardMaterial
          color="#2a2218"
          roughness={0.08}
          metalness={0.95}
          envMapIntensity={2}
        />
      </mesh>

      {/* Thin emissive halo ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.55, 0.022, 16, 128]} />
        <meshStandardMaterial
          color={ringColor}
          emissive={ringColor}
          emissiveIntensity={4}
          toneMapped={false}
          roughness={0.1}
          metalness={0.5}
        />
      </mesh>

      {/* Pedestal — three-part */}
      <mesh position={[0, -2.2, 0]}>
        <cylinderGeometry args={[0.55, 0.7, 0.12, 64]} />
        <meshStandardMaterial color="#1a1714" roughness={0.25} metalness={0.6} />
      </mesh>
      <mesh position={[0, -2.8, 0]}>
        <cylinderGeometry args={[0.18, 0.55, 1.15, 32]} />
        <meshStandardMaterial color="#141210" roughness={0.20} metalness={0.65} />
      </mesh>
      <mesh position={[0, -3.44, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 0.08, 64]} />
        <meshStandardMaterial color="#1a1714" roughness={0.25} metalness={0.6} />
      </mesh>
    </group>
  );
}

// ─── Spot light aimed at the torus ────────────────────────────────────────────

function HeroSpot({
  intensity, angle, penumbra, color,
}: {
  intensity: number; angle: number; penumbra: number; color: string;
}) {
  const spotRef = useRef<THREE.SpotLight>(null!);

  useEffect(() => {
    // Target = front base position
    spotRef.current.target.position.set(28, 8, 0);
    spotRef.current.target.updateMatrixWorld();
  }, []);

  return (
    <spotLight
      ref={spotRef}
      position={[28, 14, 3]}
      angle={angle}
      penumbra={penumbra}
      intensity={intensity}
      color={color}
      distance={28}
      decay={2}
      castShadow={false}
    />
  );
}

// ─── Main scene ───────────────────────────────────────────────────────────────

export function DiorScene2(props: JSX.IntrinsicElements["group"]) {
  const { nodes } = useGLTF("/models/dior-scene.glb") as unknown as GLTFResult;

  const [p, setP] = useState({ ...params });

  const { emissiveMeshes, regularMeshes } = useMemo(() => {
    const emissiveMeshes: THREE.Mesh[] = [];
    const regularMeshes: THREE.Mesh[]  = [];
    for (const node of Object.values(nodes)) {
      if (!(node instanceof THREE.Mesh)) continue;
      node.name.includes("emmisive")
        ? emissiveMeshes.push(node)
        : regularMeshes.push(node);
    }
    return { emissiveMeshes, regularMeshes };
  }, [nodes]);

  function colorFor(name: string): string {
    if (name.startsWith("pillar-emmisive"))  return p.pillarColor;
    if (name.startsWith("ceiling-emmisive")) return p.ceilingColor;
    if (name.startsWith("emmisive-back"))    return p.backColor;
    return p.ceilingColor;
  }

  function intensityFor(name: string): number {
    if (name.startsWith("pillar-emmisive"))  return p.pillarEmInt;
    if (name.startsWith("ceiling-emmisive")) return p.ceilingEmInt;
    if (name.startsWith("emmisive-back"))    return p.backEmInt;
    return p.ceilingEmInt;
  }

  return (
    <>
      <TweakpanePanel onUpdate={setP} />

      <ambientLight intensity={p.ambientInt} color="#2a2010" />

      <HeroSpot
        intensity={p.spotIntensity}
        angle={p.spotAngle}
        penumbra={p.spotPenumbra}
        color={p.spotColor}
      />

      {/* <EffectComposer>
        <Bloom
          luminanceThreshold={p.bloomThreshold}
          luminanceSmoothing={p.bloomSmoothing}
          intensity={p.bloomInt}
          mipmapBlur
          blendFunction={BlendFunction.ADD}
        />
        <Vignette
          offset={p.vignetteOffset}
          darkness={p.vignetteDark}
          blendFunction={BlendFunction.NORMAL}
        />
      </EffectComposer> */}

      <group {...props} dispose={null}>
        {regularMeshes.map((mesh) => {
          const mat = getMeshMat(mesh.name);
          const baseName = mesh.name.replace(/\d+$/, "");

          // walls-n-ceiling — concrete texture, subtle displacement
          if (baseName === "walls-n-ceiling") {
            return (
              <TexturedMesh
                key={mesh.name}
                mesh={mesh}
                color="#12100e"
                roughness={0.82}
                metalness={0.08}
                normalScale={0.45}
                aoIntensity={1.2}
                displacementScale={0.012}
                repeat={[6, 6]}
              />
            );
          }

          // floor — clearcoat, near-mirror, tight repeat so tiles read large
          if (baseName === "floor") {
            return (
              <TexturedMesh
                key={mesh.name}
                mesh={mesh}
                color="#1a1410"
                roughness={0.12}
                metalness={0.0}
                normalScale={0.25}
                aoIntensity={0.8}
                displacementScale={0.0}
                repeat={[3, 3]}
                isFloor
              />
            );
          }

          // base — polished dark stone, moderate repeat
          if (baseName === "base") {
            return (
              <TexturedMesh
                key={mesh.name}
                mesh={mesh}
                color="#1e1a16"
                roughness={0.35}
                metalness={0.55}
                normalScale={0.6}
                aoIntensity={1.0}
                displacementScale={0.008}
                repeat={[2, 2]}
              />
            );
          }

          // everything else — plain MeshStandardMaterial
          return (
            <mesh
              key={mesh.name}
              name={mesh.name}
              geometry={mesh.geometry}
              position={mesh.position}
              rotation={mesh.rotation}
              scale={mesh.scale}
            >
              <meshStandardMaterial
                color={mat.color}
                roughness={mat.roughness}
                metalness={mat.metalness}
              />
            </mesh>
          );
        })}

        {emissiveMeshes.map((mesh) => (
          <EmissiveMesh
            key={mesh.name}
            mesh={mesh}
            color={colorFor(mesh.name)}
            intensity={intensityFor(mesh.name)}
          />
        ))}

        {/* Torus above front base — ring color tracks pillar emissive */}
        <TorusStandIn ringColor={p.pillarColor} spotCol={p.spotColor} />
      </group>
    </>
  );
}

useGLTF.preload("/models/dior-scene.glb");