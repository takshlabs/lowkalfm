"use client";

import { Html, useTexture } from "@react-three/drei";
import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { SoundRecord } from "@/lib/content";

export type ArchiveGroupId = "scene-broadcast" | "volumes-residents" | "volumes-guests";

type SceneProps = {
  records: SoundRecord[];
  selectedSlug: string;
  activeGroup: ArchiveGroupId;
  onSelect: (slug: string) => void;
};

type ShelfDefinition = {
  id: ArchiveGroupId;
  label: string;
  position: [number, number, number];
  rotation: [number, number, number];
  width: number;
};

const shelves: ShelfDefinition[] = [
  { id: "scene-broadcast", label: "LOWKAL SCENE BROADCAST", position: [-3.9, 1.35, -1.8], rotation: [0, 0, 0], width: 3.5 },
  { id: "volumes-residents", label: "FM VOLUMES · RESIDENTS", position: [0, 1.35, -2.45], rotation: [0, 0, 0], width: 3.5 },
  { id: "volumes-guests", label: "FM VOLUMES · GUESTS", position: [3.9, 1.35, -1.8], rotation: [0, 0, 0], width: 3.5 }
];

const cameraWaypoints: Record<ArchiveGroupId, { position: THREE.Vector3; target: THREE.Vector3 }> = {
  "scene-broadcast": { position: new THREE.Vector3(-3.4, 2.8, 6.8), target: new THREE.Vector3(-3.7, 1.25, -1.6) },
  "volumes-residents": { position: new THREE.Vector3(0, 2.7, 6.6), target: new THREE.Vector3(0, 1.25, -2.25) },
  "volumes-guests": { position: new THREE.Vector3(3.4, 2.8, 6.8), target: new THREE.Vector3(3.7, 1.25, -1.6) }
};

function groupForRecord(record: SoundRecord): ArchiveGroupId {
  if (record.format === "live-set") return "scene-broadcast";
  return record.artist.toLowerCase() === "takezo" ? "volumes-residents" : "volumes-guests";
}

function CameraRig({ activeGroup }: { activeGroup: ArchiveGroupId }) {
  const lookAt = useRef(new THREE.Vector3(0, 1.2, -1.8));

  useFrame((state, delta) => {
    const waypoint = cameraWaypoints[activeGroup];
    const drift = new THREE.Vector3(state.pointer.x * 0.22, state.pointer.y * 0.1, 0);
    const desiredPosition = waypoint.position.clone().add(drift);
    const amount = 1 - Math.exp(-delta * 3.2);
    state.camera.position.lerp(desiredPosition, amount);
    lookAt.current.lerp(waypoint.target, amount);
    state.camera.lookAt(lookAt.current);
  });

  return null;
}

function RoomShell() {
  const tiles = useMemo(() => {
    const result: Array<{ key: string; position: [number, number, number]; dark: boolean }> = [];
    for (let x = -7; x <= 7; x += 1) {
      for (let z = -4; z <= 5; z += 1) {
        result.push({ key: `${x}:${z}`, position: [x, -0.08, z], dark: Math.abs(x + z) % 2 === 0 });
      }
    }
    return result;
  }, []);

  return (
    <group>
      {tiles.map((tile) => (
        <mesh key={tile.key} position={tile.position} receiveShadow>
          <boxGeometry args={[0.98, 0.12, 0.98]} />
          <meshStandardMaterial color={tile.dark ? "#343a36" : "#59605a"} roughness={0.94} />
        </mesh>
      ))}
      <mesh position={[0, 2.6, -4.45]} receiveShadow>
        <boxGeometry args={[15, 5.4, 0.22]} />
        <meshStandardMaterial color="#512c39" roughness={0.88} />
      </mesh>
      <mesh position={[-7.35, 2.5, 0.2]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[9.4, 5.2, 0.2]} />
        <meshStandardMaterial color="#242b2a" roughness={0.9} />
      </mesh>
      <mesh position={[7.35, 2.5, 0.2]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[9.4, 5.2, 0.2]} />
        <meshStandardMaterial color="#242b2a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.015, 0.75]} receiveShadow>
        <boxGeometry args={[3.8, 0.05, 2.3]} />
        <meshStandardMaterial color="#7b3840" roughness={0.95} />
      </mesh>
    </group>
  );
}

function RecordSleeve({ record, index, selected, onSelect }: { record: SoundRecord; index: number; selected: boolean; onSelect: (slug: string) => void }) {
  const texture = useTexture(record.artwork);
  const sleeve = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const x = -1.12 + index * 0.76;

  useFrame((_, delta) => {
    if (!sleeve.current) return;
    const targetZ = selected ? 0.52 : hovered ? 0.2 : 0.02;
    const targetY = selected ? 0.12 : 0;
    const amount = 1 - Math.exp(-delta * 8);
    sleeve.current.position.z = THREE.MathUtils.lerp(sleeve.current.position.z, targetZ, amount);
    sleeve.current.position.y = THREE.MathUtils.lerp(sleeve.current.position.y, targetY, amount);
  });

  const hover = (event: ThreeEvent<PointerEvent>, value: boolean) => {
    event.stopPropagation();
    setHovered(value);
    document.body.style.cursor = value ? "pointer" : "";
  };

  return (
    <group position={[x, 0.72, 0.24]} rotation={[-0.06, 0, index % 2 ? -0.018 : 0.018]}>
      <mesh
        ref={sleeve}
        castShadow
        onClick={(event) => { event.stopPropagation(); onSelect(record.slug); }}
        onPointerOver={(event) => hover(event, true)}
        onPointerOut={(event) => hover(event, false)}
      >
        <boxGeometry args={[0.68, 0.68, 0.055]} />
        <meshStandardMaterial map={texture} roughness={0.72} emissive={selected ? "#718f12" : "#000000"} emissiveIntensity={selected ? 0.38 : 0} />
      </mesh>
      {(hovered || selected) && (
        <Html position={[0, 0.44, 0.62]} center distanceFactor={7.5}>
          <button className="archive-record-marker" type="button" onClick={() => onSelect(record.slug)}>
            <strong>{record.artist}</strong>
            <span>{record.title}</span>
          </button>
        </Html>
      )}
    </group>
  );
}

function RecordShelf({ definition, records, selectedSlug, active, onSelect }: { definition: ShelfDefinition; records: SoundRecord[]; selectedSlug: string; active: boolean; onSelect: (slug: string) => void }) {
  return (
    <group position={definition.position} rotation={definition.rotation}>
      <mesh position={[0, 0.45, -0.13]} receiveShadow castShadow>
        <boxGeometry args={[definition.width, 1.75, 0.32]} />
        <meshStandardMaterial color="#202523" roughness={0.82} />
      </mesh>
      <mesh position={[0, -0.44, 0.2]} castShadow>
        <boxGeometry args={[definition.width + 0.18, 0.14, 0.74]} />
        <meshStandardMaterial color="#8a5138" roughness={0.76} />
      </mesh>
      <mesh position={[-definition.width / 2, 0.46, 0.05]} castShadow>
        <boxGeometry args={[0.12, 1.95, 0.56]} />
        <meshStandardMaterial color="#a7aaa0" metalness={0.42} roughness={0.58} />
      </mesh>
      <mesh position={[definition.width / 2, 0.46, 0.05]} castShadow>
        <boxGeometry args={[0.12, 1.95, 0.56]} />
        <meshStandardMaterial color="#a7aaa0" metalness={0.42} roughness={0.58} />
      </mesh>
      <mesh position={[0, 1.48, -0.02]}>
        <boxGeometry args={[definition.width, 0.08, 0.09]} />
        <meshStandardMaterial color={active ? "#c8ff24" : "#758078"} emissive={active ? "#89ad16" : "#000000"} emissiveIntensity={active ? 1.1 : 0} />
      </mesh>
      <Html position={[0, 1.74, 0]} center distanceFactor={8}>
        <div className={`archive-shelf-label${active ? " is-active" : ""}`}>{definition.label}</div>
      </Html>
      {records.slice(0, 4).map((record, index) => (
        <RecordSleeve key={record.slug} record={record} index={index} selected={selectedSlug === record.slug} onSelect={onSelect} />
      ))}
      {records.length === 0 && [0, 1, 2, 3].map((index) => (
        <mesh key={index} position={[-1.12 + index * 0.76, 0.72, 0.26]} rotation={[-0.06, 0, index % 2 ? -0.02 : 0.02]}>
          <boxGeometry args={[0.68, 0.68, 0.05]} />
          <meshStandardMaterial color={index % 2 ? "#343b37" : "#422c34"} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function Counter() {
  return (
    <group position={[0, 0, -0.28]}>
      <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.8, 0.18, 1.05]} />
        <meshStandardMaterial color="#9b5f3f" roughness={0.68} />
      </mesh>
      {[-1.55, 1.55].map((x) => (
        <mesh key={x} position={[x, 0.27, 0]} castShadow>
          <boxGeometry args={[0.18, 0.78, 0.86]} />
          <meshStandardMaterial color="#5d382e" roughness={0.82} />
        </mesh>
      ))}
      <mesh position={[0.85, 0.91, -0.02]} castShadow>
        <boxGeometry args={[0.72, 0.34, 0.46]} />
        <meshStandardMaterial color="#d8d4c4" roughness={0.66} />
      </mesh>
      <mesh position={[-0.82, 0.88, -0.08]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.1, 36]} />
        <meshStandardMaterial color="#11110f" roughness={0.4} metalness={0.25} />
      </mesh>
    </group>
  );
}

function ArchiveRoom(props: SceneProps) {
  const grouped = useMemo(() => {
    const map: Record<ArchiveGroupId, SoundRecord[]> = {
      "scene-broadcast": [],
      "volumes-residents": [],
      "volumes-guests": []
    };
    props.records.forEach((record) => map[groupForRecord(record)].push(record));
    return map;
  }, [props.records]);

  return (
    <>
      <color attach="background" args={["#100b16"]} />
      <fog attach="fog" args={["#100b16", 9, 19]} />
      <ambientLight intensity={0.72} color="#ddd5c8" />
      <directionalLight position={[-4, 7, 6]} intensity={2.4} color="#f4d8ad" castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-5.8, 2.8, 1]} intensity={18} distance={8} color="#c8ff24" />
      <pointLight position={[5.8, 2.8, 1]} intensity={15} distance={8} color="#b62f62" />
      <RoomShell />
      <Counter />
      {shelves.map((shelf) => (
        <RecordShelf
          key={shelf.id}
          definition={shelf}
          records={grouped[shelf.id]}
          selectedSlug={props.selectedSlug}
          active={props.activeGroup === shelf.id}
          onSelect={props.onSelect}
        />
      ))}
      <CameraRig activeGroup={props.activeGroup} />
    </>
  );
}

export function SoundroomScene(props: SceneProps) {
  return (
    <div className="soundroom-canvas" role="img" aria-label="A three-dimensional Lowkal record archive with three catalogue shelves">
      <Canvas camera={{ position: [0, 2.7, 7], fov: 45 }} dpr={[1, 1.5]} shadows gl={{ antialias: true, powerPreference: "high-performance" }} fallback={<div className="soundroom-canvas-fallback">Use the catalogue below to browse.</div>}>
        <Suspense fallback={null}>
          <ArchiveRoom {...props} />
        </Suspense>
      </Canvas>
      <div className="scene-instruction">Move to look · Choose a shelf · Pick a record</div>
    </div>
  );
}
