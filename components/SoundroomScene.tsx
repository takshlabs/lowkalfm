"use client";

import { Html, OrbitControls, useTexture } from "@react-three/drei";
import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import { Suspense, useRef, useState } from "react";
import * as THREE from "three";
import { SoundRecord } from "@/lib/content";

type SceneProps = {
  records: SoundRecord[];
  selectedSlug: string;
  onSelect: (slug: string) => void;
};

const positions: Array<[number, number, number]> = [
  [-3.1, 1.15, 0.15],
  [0.05, -0.7, 0.95],
  [3.05, 1.0, -0.2],
  [-0.4, 1.55, -1.4],
  [-3.25, -1.4, -1.1],
  [3.25, -1.35, -0.6]
];

function RecordMesh({ record, index, selected, onSelect }: { record: SoundRecord; index: number; selected: boolean; onSelect: (slug: string) => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const texture = useTexture(record.artwork);
  const position = positions[index % positions.length];

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const targetScale = selected ? 1.16 : hovered ? 1.08 : 1;
    const nextScale = THREE.MathUtils.lerp(meshRef.current.scale.x, targetScale, Math.min(1, delta * 7));
    meshRef.current.scale.setScalar(nextScale);
    meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.35 + index) * 0.025 + (index % 2 ? 0.045 : -0.035);
  });

  const handlePointer = (event: ThreeEvent<PointerEvent>, isHovered: boolean) => {
    event.stopPropagation();
    setHovered(isHovered);
    document.body.style.cursor = isHovered ? "pointer" : "";
  };

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(event) => { event.stopPropagation(); onSelect(record.slug); }}
        onPointerOver={(event) => handlePointer(event, true)}
        onPointerOut={(event) => handlePointer(event, false)}
      >
        <boxGeometry args={[2.22, 2.22, 0.12]} />
        <meshStandardMaterial map={texture} roughness={0.62} metalness={0.08} emissive={selected ? "#283800" : "#000000"} emissiveIntensity={selected ? 0.35 : 0} />
      </mesh>
      <Html position={[0, -1.33, 0.1]} center transform distanceFactor={6.6}>
        <div className={`scene-record-label${selected ? " is-selected" : ""}`}>
          <span>{record.series}</span>
          <strong>{record.artist}</strong>
        </div>
      </Html>
    </group>
  );
}

function RecordField({ records, selectedSlug, onSelect }: SceneProps) {
  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[3, 5, 7]} intensity={2.1} color="#f1ece1" />
      <pointLight position={[-5, -2, 3]} intensity={12} distance={11} color="#c8ff24" />
      <pointLight position={[5, 2, 1]} intensity={8} distance={10} color="#e14b40" />
      {records.map((record, index) => (
        <RecordMesh key={record.slug} record={record} index={index} selected={selectedSlug === record.slug} onSelect={onSelect} />
      ))}
      <OrbitControls enablePan={false} enableZoom minDistance={6.8} maxDistance={10.5} maxPolarAngle={Math.PI * 0.62} minPolarAngle={Math.PI * 0.38} />
    </>
  );
}

export function SoundroomScene(props: SceneProps) {
  return (
    <div className="soundroom-canvas" aria-hidden="true">
      <Canvas camera={{ position: [0, 0.25, 8.4], fov: 48 }} dpr={[1, 1.5]} fallback={<div className="soundroom-canvas-fallback">Use the record list below to browse.</div>}>
        <color attach="background" args={["#11110f"]} />
        <fog attach="fog" args={["#11110f", 8, 14]} />
        <Suspense fallback={null}>
          <RecordField {...props} />
        </Suspense>
      </Canvas>
      <div className="scene-instruction">Drag to look around · Select a record</div>
    </div>
  );
}
