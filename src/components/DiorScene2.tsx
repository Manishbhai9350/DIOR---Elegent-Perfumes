/*
 * DiorSceneLit.tsx
 *
 * Drop-in replacement for DiorScene2.tsx.
 *
 * What this does
 * ──────────────
 * • Every mesh whose name contains "emmisive" gets:
 *   - MeshStandardMaterial with emissive=color, emissiveIntensity=2
 *   - A matched RectAreaLight (same world position + OBB size + facing normal)
 * • Non-emissive meshes get MeshStandardMaterial with varied roughness/metalness
 * • Tweakpane panel with three colour pickers:
 *     - Ceiling emissive  (ceiling-emmisive-1*, ceiling-emmisive-2*)
 *     - Pillar emissive   (pillar-emmisive*)
 *     - Back plane        (emmisive-back-plane)
 *
 * Dependencies (already in a typical R3F + drei project):
 *   three, @react-three/fiber, @react-three/drei, tweakpane
 *
 * Install tweakpane if needed:
 *   npm i tweakpane
 */

import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useEffect, useRef, useState, useMemo } from "react";
import { Pane } from "tweakpane";
import { RectAreaLightUniformsLib, type GLTF } from "three-stdlib";
import type { JSX } from "react";
import { MultiplyColor } from "../utils";
RectAreaLightUniformsLib.init(); // call once at module level or in useEffect

// ─── helpers ────────────────────────────────────────────────────────────────

/** Return world-space OBB centre, half-extents, and quaternion for a mesh. */
function getMeshOBB(mesh: THREE.Mesh) {
  // Ensure matrices are up to date
  mesh.updateWorldMatrix(true, false);

  const box = new THREE.Box3().setFromObject(mesh);
  const center = new THREE.Vector3();
  box.getCenter(center);

  const size = new THREE.Vector3();
  box.getSize(size);

  // World quaternion
  const quat = new THREE.Quaternion();
  mesh.getWorldQuaternion(quat);

  return { center, size, quat };
}

/**
 * Determine the dominant face axis of the mesh so the RectAreaLight
 * faces outward in the correct direction.
 *
 * Strategy:
 *   - pillar-emmisive  → faces +X  (toward the corridor axis)
 *   - ceiling-emmisive → faces -Y  (downward)
 *   - emmisive-back    → faces +X  (toward camera)
 */
function getLightDirection(name: string): THREE.Vector3 {
  if (name.startsWith("pillar-emmisive")) return new THREE.Vector3(1, 0, 0);
  if (name.startsWith("ceiling-emmisive")) return new THREE.Vector3(0, -1, 0);
  if (name.startsWith("emmisive-back-plane")) return new THREE.Vector3(1, 0, 0);
  return new THREE.Vector3(0, -1, 0);
}

// ─── GLTF type ───────────────────────────────────────────────────────────────

type GLTFResult = GLTF & {
  nodes: Record<string, THREE.Mesh>;
  materials: Record<string, THREE.Material>;
};

// ─── Tweakpane colours (mutable, shared) ────────────────────────────────────

const tweakColors = {
  ceiling: { r: 255, g: 240, b: 200 }, // warm white
  pillar: { r: 200, g: 220, b: 255 }, // cool blue-white
  back: { r: 255, g: 200, b: 180 }, // warm amber
};

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

// ─── Tweakpane panel component ───────────────────────────────────────────────

interface TweakpaneProps {
  onCeilingChange: (hex: string) => void;
  onPillarChange: (hex: string) => void;
  onBackChange: (hex: string) => void;
}

function TweakpanePanel({
  onCeilingChange,
  onPillarChange,
  onBackChange,
}: TweakpaneProps) {
  useEffect(() => {
    const pane = new Pane({ title: "Emissive Lights", expanded: true });
    (pane.element as HTMLElement).style.position = "fixed";
    (pane.element as HTMLElement).style.top = "12px";
    (pane.element as HTMLElement).style.right = "12px";
    (pane.element as HTMLElement).style.zIndex = "9999";

    const ceiling = pane.addFolder({ title: "Ceiling Emissive" });
    ceiling
      .addBinding(tweakColors, "ceiling", { color: { type: "float" } })
      .on("change", ({ value }) => {
        onCeilingChange(rgbToHex(MultiplyColor(value,255)));
      });

    const pillar = pane.addFolder({ title: "Pillar Emissive" });
    pillar
      .addBinding(tweakColors, "pillar", { color: { type: "float" } })
      .on("change", ({ value }) => {
        onPillarChange(rgbToHex(MultiplyColor(value,255)));
      });

    const back = pane.addFolder({ title: "Back Plane Emissive" });
    back
      .addBinding(tweakColors, "back", { color: { type: "float" } })
      .on("change", ({ value }) => {
        onBackChange(rgbToHex(MultiplyColor(value,255)));
      });

    return () => pane.dispose();
  }, [onCeilingChange, onPillarChange, onBackChange]);

  return null;
}

// ─── Per-mesh emissive light ─────────────────────────────────────────────────

interface EmissiveMeshProps {
  mesh: THREE.Mesh;
  emissiveColor: string;
  lightIntensity?: number;
}

function EmissiveMesh({
  mesh,
  emissiveColor,
  lightIntensity = 6,
}: EmissiveMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.RectAreaLight>(null!);

  const { center, size, quat } = useMemo(() => getMeshOBB(mesh), [mesh]);
  const dir = useMemo(() => getLightDirection(mesh.name), [mesh.name]);

  // The RectAreaLight position is offset from the mesh center along the light dir
  // by half the depth in that axis so it sits flush on the surface face.
  const lightPos = useMemo(() => {
    const offset = dir
      .clone()
      .multiplyScalar(
        Math.abs(dir.x) > 0.5
          ? size.x * 0.5
          : Math.abs(dir.y) > 0.5
            ? size.y * 0.5
            : size.z * 0.5,
      );
    return center.clone().add(offset);
  }, [center, size, dir]);

  // Width/height of the rect light = the two axes perpendicular to dir
  const { width, height } = useMemo(() => {
    if (Math.abs(dir.y) > 0.5) return { width: size.x, height: size.z }; // horizontal face
    if (Math.abs(dir.x) > 0.5) return { width: size.z, height: size.y }; // vertical face (X normal)
    return { width: size.x, height: size.y }; // vertical face (Z normal)
  }, [size, dir]);

  // Rotation to face in dir direction
  const lightRotation = useMemo(() => {
    const euler = new THREE.Euler();
    if (dir.y < -0.5)
      euler.set(-Math.PI / 2, 0, 0); // facing down
    else if (dir.y > 0.5)
      euler.set(Math.PI / 2, 0, 0); // facing up
    else if (dir.x > 0.5)
      euler.set(0, Math.PI / 2, 0); // facing +X
    else if (dir.x < -0.5) euler.set(0, -Math.PI / 2, 0);
    else if (dir.z > 0.5) euler.set(0, 0, 0);
    else euler.set(0, Math.PI, 0);
    return euler;
  }, [dir]);

  const color = new THREE.Color(emissiveColor);

  return (
    <group>
      {/* Re-render the mesh with an emissive material */}
      <mesh
        ref={meshRef}
        geometry={mesh.geometry}
        position={mesh.position}
        rotation={mesh.rotation}
        scale={mesh.scale}
      >
        <meshStandardMaterial
          color={emissiveColor}
          emissive={emissiveColor}
          emissiveIntensity={2}
          roughness={0.5}
          metalness={0.0}
          toneMapped={false}
        />
      </mesh>

      {/* Matched RectAreaLight */}
      {/* <rectAreaLight
        ref={lightRef}
        position={lightPos}
        rotation={lightRotation}
        width={Math.max(width, 0.1)}
        height={Math.max(height, 0.1)}
        intensity={lightIntensity}
        color={color}
      /> */}
    </group>
  );
}

// ─── Non-emissive mesh materials ──────────────────────────────────────────────

const MATERIAL_OVERRIDES: Record<
  string,
  Partial<{
    color: string;
    roughness: number;
    metalness: number;
  }>
> = {
  "walls-n-ceiling": { color: "#e8e0d4", roughness: 0.85, metalness: 0.0 },
  "side-pillars": { color: "#d4cfc8", roughness: 0.75, metalness: 0.05 },
  "ceiling-boxes": { color: "#c8c4be", roughness: 0.7, metalness: 0.1 },
  base: { color: "#b0a89e", roughness: 0.6, metalness: 0.15 },
  floor: { color: "#8a8480", roughness: 0.4, metalness: 0.3 },
  Text: { color: "#f0ece6", roughness: 0.3, metalness: 0.5 },
};

function defaultMaterial(name: string) {
  // Strip numeric suffix (e.g. "ceiling-boxes001" → "ceiling-boxes")
  const base = name.replace(/\d+$/, "");
  const override = MATERIAL_OVERRIDES[base] ?? MATERIAL_OVERRIDES[name];
  return override ?? { color: "#d0cbc4", roughness: 0.72, metalness: 0.08 };
}

// ─── Main model ───────────────────────────────────────────────────────────────

export function DiorScene2(props: JSX.IntrinsicElements["group"]) {
  const { nodes } = useGLTF("/models/dior-scene.glb") as unknown as GLTFResult;

  const [ceilingColor, setCeilingColor] = useState(
    rgbToHex(tweakColors.ceiling),
  );
  const [pillarColor, setPillarColor] = useState(rgbToHex(tweakColors.pillar));
  const [backColor, setBackColor] = useState(rgbToHex(tweakColors.back));

  // Partition nodes
  const { emissiveMeshes, regularMeshes } = useMemo(() => {
    const emissiveMeshes: THREE.Mesh[] = [];
    const regularMeshes: THREE.Mesh[] = [];

    for (const mesh of Object.values(nodes)) {
      if (!(mesh instanceof THREE.Mesh)) continue;
      if (mesh.name.includes("emmisive")) {
        emissiveMeshes.push(mesh);
      } else {
        regularMeshes.push(mesh);
      }
    }
    return { emissiveMeshes, regularMeshes };
  }, [nodes]);

  function colorForMesh(name: string): string {
    if (name.startsWith("pillar-emmisive")) return pillarColor;
    if (name.startsWith("ceiling-emmisive")) return ceilingColor;
    if (name.startsWith("emmisive-back")) return backColor;
    return ceilingColor;
  }

  return (
    <>
      {/* Tweakpane lives outside the R3F canvas — mounted into DOM */}
      <TweakpanePanel
        onCeilingChange={setCeilingColor}
        onPillarChange={setPillarColor}
        onBackChange={setBackColor}
      />

      <group {...props} dispose={null}>
        {/* ── Regular meshes with differentiated MeshStandardMaterial ── */}
        {regularMeshes.map((mesh) => {
          const mat = defaultMaterial(mesh.name);
          return (
            <mesh
              key={mesh.name}
              name={mesh.name}
              geometry={mesh.geometry}
              position={mesh.position.sub(new THREE.Vector3(mesh.name.includes('base') ? 1 : 0,0,0))}
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

        {/* ── Emissive meshes + matched RectAreaLights ── */}
        {emissiveMeshes.map((mesh) => (
          <EmissiveMesh
            key={mesh.name}
            mesh={mesh}
            emissiveColor={colorForMesh(mesh.name)}
            lightIntensity={8}
          />
        ))}
      </group>
    </>
  );
}

useGLTF.preload("/models/dior-scene.glb");
