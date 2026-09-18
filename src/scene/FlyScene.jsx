/**
 * The 3D half of the app.
 *
 * One `useFrame` advances the state machine and pushes its numbers straight
 * onto the three.js objects. React never re-renders during a spin; the HUD
 * subscribes separately and at a much lower rate.
 */
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, AdaptiveDpr, PerspectiveCamera } from '@react-three/drei';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as THREE from 'three';
import { Fly } from './Fly.jsx';
import { SlotMachine } from './SlotMachine.jsx';
import { CAMERA, gripAt, flyToWorld } from './layout.js';
import { HAND } from './flyRig.js';
import { PHASES } from '../game/machine.js';
import { sound } from '../audio/audio.js';

const REST_HAND_WORLD = flyToWorld(HAND);

function Rig({ machine, gripTargetRef, dopamineRef, leverRef, reelRefs, winGlowRef, onTick }) {
  const { camera } = useThree();
  const base = useMemo(() => new THREE.Vector3(...CAMERA.position), []);
  const look = useMemo(() => new THREE.Vector3(...CAMERA.target), []);
  const ratchet = useRef({ last: 0 });
  const uiClock = useRef(0);

  useFrame((state, dt) => {
    machine.update(dt);

    // the point the fly's tarsus should be holding
    const grip = gripAt(machine.leverAngle);
    gripTargetRef.current = machine.grip > 0.001 ? grip : REST_HAND_WORLD;
    dopamineRef.current = machine.dopamine;
    winGlowRef.current = machine.dopamine;
    dopamineRef.current = machine.dopamine;

    // lever detents, one per few degrees of travel, in both directions
    const step = 0.075;
    const bucket = Math.round(machine.leverAngle / step);
    if (bucket !== ratchet.current.last && machine.grip > 0.4) {
      const moving = Math.abs(bucket - ratchet.current.last);
      ratchet.current.last = bucket;
      if (moving < 6) sound.ratchet(0.6 + 0.4 * Math.abs(machine.pullProgress));
    }

    // reels
    for (let i = 0; i < 3; i++) {
      const mesh = reelRefs[i].current;
      if (mesh) mesh.rotation.y = machine.reels[i].angle;
    }
    sound.updateReels(machine.reels.map((r) => r.speed), dt);
    sound.setArousal(machine.arousal);

    // camera: settles back to its mark, kicked by the latch and by a win
    const t = state.clock.elapsedTime;
    const shake = machine.shake;
    camera.position.set(
      base.x + Math.sin(t * 0.21) * 0.055 + (Math.sin(t * 31.7) * shake * 0.05),
      base.y + Math.sin(t * 0.17) * 0.035 + (Math.sin(t * 27.3) * shake * 0.045),
      base.z + Math.cos(t * 0.19) * 0.055 + (Math.cos(t * 24.1) * shake * 0.05),
    );
    camera.lookAt(look);

    uiClock.current += dt;
    if (uiClock.current > 1 / 12) { uiClock.current = 0; onTick(); }
  });
  return null;
}

function Lights({ dopamineRef }) {
  const key = useRef();
  useFrame(() => {
    if (key.current) key.current.intensity = 2.3 + (dopamineRef.current ?? 0) * 0.9;
  });
  return (
    <>
      <ambientLight intensity={0.55} color="#fff6e8" />
      <hemisphereLight args={['#fff4e2', '#8b7f6d', 0.7]} />
      <directionalLight
        ref={key}
        position={[5.5, 6.2, 1.8]}
        intensity={2.3}
        color="#fff1dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-far={22}
        shadow-bias={-0.0006}
      />
      <directionalLight position={[-4.5, 3, -5]} intensity={0.55} color="#d9e2ee" />
    </>
  );
}

/**
 * Environment lighting without a network round-trip.
 *
 * drei's `<Environment preset="...">` pulls an HDR off a CDN, which this scene
 * has no business depending on — it should run offline. A PMREM of three's
 * RoomEnvironment is generated locally instead, and gives the chrome and the
 * glass something to reflect.
 */
function StudioProbe() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = env.texture;
    scene.environmentIntensity = 0.42;
    return () => { env.texture.dispose(); pmrem.dispose(); scene.environment = null; };
  }, [gl, scene]);
  return null;
}

function World({ machine, onTick }) {
  const gripTargetRef = useRef(REST_HAND_WORLD);
  const dopamineRef = useRef(0);
  const winGlowRef = useRef(0);
  const leverRef = useRef();
  const reelRefs = [useRef(), useRef(), useRef()];

  return (
    <>
      <Lights dopamineRef={dopamineRef} />
      <Rig
        machine={machine}
        gripTargetRef={gripTargetRef}
        dopamineRef={dopamineRef}
        leverRef={leverRef}
        reelRefs={reelRefs}
        winGlowRef={winGlowRef}
        onTick={onTick}
      />
      <SlotMachine
        machine={machine}
        leverRef={leverRef}
        reelRefs={reelRefs}
        winGlowRef={winGlowRef}
      />
      <Fly machine={machine} gripTargetRef={gripTargetRef} dopamineRef={dopamineRef} />

      <ContactShadows position={[0, 0.002, 0]} opacity={0.42} scale={14} blur={2.4} far={4} resolution={1024} color="#4a4038" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[16, 64]} />
        <meshStandardMaterial color="#d9d0be" roughness={0.95} metalness={0} />
      </mesh>
      <StudioProbe />
    </>
  );
}

export function FlyScene({ machine, onTick }) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.85]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={(state) => {
        const { gl, scene } = state;
        if (import.meta.env.DEV) window.__scene = state;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.02;
        scene.background = new THREE.Color('#efe7d7');
        scene.fog = new THREE.Fog('#efe7d7', 11, 26);
      }}
    >
      <PerspectiveCamera makeDefault fov={CAMERA.fov} position={CAMERA.position} near={0.1} far={60} />
      <AdaptiveDpr pixelated />
      <Suspense fallback={null}>
        <World machine={machine} onTick={onTick} />
      </Suspense>
    </Canvas>
  );
}

export { PHASES };
