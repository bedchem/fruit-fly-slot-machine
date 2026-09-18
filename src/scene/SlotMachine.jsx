/**
 * The cabinet, the lever and the three live reels.
 *
 * The source model is a Sketchfab pillar with four machines welded into one
 * mesh per material, so tools/build-slot.mjs splits the front machine's lever
 * out as its own node (origin on the pivot) and deletes its printed reel strips.
 * The drums below are built to the exact radius, width and centres the build
 * script measured — parts.json — so they drop into the window the strips left.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { PARTS, LEVER_PULLED, STOOL } from './layout.js';
import { reelTexture } from './reelTexture.js';
import { SYMBOLS } from '../game/machine.js';

/**
 * The cabinet keeps the materials and baked textures it shipped with. The only
 * thing touched is `envMapIntensity`, so the chrome picks up the room probe —
 * no recolouring, because the downloaded look is the look.
 */
function useSourceMaterial(material) {
  material.envMapIntensity = 0.85;
  return material;
}

/**
 * One drum. The group turns the cylinder's axis to lie along +Z; the mesh
 * inside spins about that axis, so `rotation.y` is unambiguously the reel
 * angle no matter what Euler order three uses.
 */
function Reel({ spec, index, reelRef }) {
  const meshRef = useRef();
  const texture = useMemo(() => {
    const t = reelTexture().clone();
    t.needsUpdate = true;
    return t;
  }, []);

  useEffect(() => {
    reelRef.current = meshRef.current;
  }, [reelRef]);

  return (
    <group position={spec.center} rotation={[Math.PI / 2, 0, 0]}>
      <mesh ref={meshRef} castShadow receiveShadow>
        <cylinderGeometry args={[spec.radius, spec.radius, spec.width, 64, 1, false]} />
        {/* side, then the two caps */}
        <meshStandardMaterial attach="material-0" map={texture} roughness={0.52} metalness={0.05} />
        <meshStandardMaterial attach="material-1" color="#6d675e" roughness={0.4} metalness={0.6} />
        <meshStandardMaterial attach="material-2" color="#6d675e" roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  );
}

export function SlotMachine({ machine, leverRef, reelRefs, winGlowRef }) {
  const { scene } = useGLTF('/models/slot-machine.glb');
  const leverGroup = useRef();
  const glowRef = useRef();

  const model = useMemo(() => {
    const root = scene.clone(true);
    let lever = null;
    let stool = null;
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (Array.isArray(o.material)) o.material.forEach(useSourceMaterial);
        else useSourceMaterial(o.material);
      }
      if (o.name === 'Lever') lever = o;
      if (o.name === 'Stool') stool = o;
    });
    if (stool) {
      // pull the seat up to the machine so the fly can actually reach
      stool.position.x += STOOL.offset[0];
      stool.position.y += STOOL.offset[1];
      stool.position.z += STOOL.offset[2];
    }
    if ((!lever || !stool) && import.meta.env.DEV) {
      console.warn('[slot] missing Lever/Stool node — did tools/build-slot.mjs run?', { lever: !!lever, stool: !!stool });
    }
    return { root, lever, stool };
  }, [scene]);

  // reparent the lever under a group we control, keeping its measured pivot
  useEffect(() => {
    const lever = model.lever;
    const holder = leverGroup.current;
    if (!lever || !holder) return;
    holder.position.set(...PARTS.lever.pivot);
    lever.position.set(0, 0, 0);
    holder.add(lever);
    leverRef.current = holder;
    return () => { model.root.add(lever); };
  }, [model, leverRef]);

  useFrame(() => {
    if (leverGroup.current) leverGroup.current.rotation.z = machine.leverAngle;
    if (glowRef.current) {
      const d = winGlowRef?.current ?? 0;
      glowRef.current.intensity = d * 5.5;
      glowRef.current.visible = d > 0.004;
    }
  });

  return (
    <group>
      <primitive object={model.root} />

      {/* The lever swings under machine control only — the fly plays itself. */}
      <group ref={leverGroup} />

      {PARTS.reels.map((spec, i) => (
        <Reel key={i} spec={spec} index={i} reelRef={reelRefs[i]} />
      ))}

      {/* the reward lamp inside the cabinet: the only saturated light in the scene */}
      <pointLight
        ref={glowRef}
        position={[PARTS.reels[1].center[0] + 0.28, PARTS.reels[1].center[1] + 0.12, PARTS.reels[1].center[2]]}
        color="#ffb347"
        distance={2.6}
        decay={2}
        intensity={0}
      />
    </group>
  );
}

SlotMachine.LEVER_PULLED = LEVER_PULLED;
SlotMachine.SYMBOL_COUNT = SYMBOLS.length;

useGLTF.preload('/models/slot-machine.glb');
