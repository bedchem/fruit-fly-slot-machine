/**
 * The bar: the same fly, on the same stool, at a counter instead of a slot
 * machine.
 *
 * Everything here is built from primitives at load time — the counter, the
 * stool, the glass, the straw, the tin — so the bar costs no download beyond
 * the fly itself. As in the casino, one `useFrame` advances the state machine
 * and pushes its numbers onto the objects; React does not re-render per frame.
 */
import { Suspense, forwardRef, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, advance } from '@react-three/fiber';
import { ContactShadows, AdaptiveDpr, PerspectiveCamera } from '@react-three/drei';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as THREE from 'three';
import { Fly } from './Fly.jsx';
import { STOOL, flyToWorld } from './layout.js';
import { HAND } from './flyRig.js';
import {
  BAR_CAMERA, COUNTER, GLASS, TIN, STRAW_TIP, MOUTH_LOCAL, MOUTH,
} from './barLayout.js';
import { PHASES } from '../game/bar.js';
import { sound } from '../audio/audio.js';

// render a frame by hand from the console while developing: a hidden tab gets
// no animation frames, so this is the only way to look at it there
if (import.meta.env.DEV) window.__advance = advance;

const REST_HAND_WORLD = flyToWorld(HAND);
const BG_AWAKE = new THREE.Color('#3b2d22');
const BG_ASLEEP = new THREE.Color('#15110e');
/** How many finished glasses and spent pouches stay on the counter. */
const MAX_EMPTIES = 9;
const MAX_SPENT = 12;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// ------------------------------------------------------------------ the rig

function Rig({ bar, gripTargetRef, dopamineRef, lookRef, onTick }) {
  const { camera, scene } = useThree();
  const base = useMemo(() => new THREE.Vector3(...BAR_CAMERA.position), []);
  const look = useMemo(() => new THREE.Vector3(...BAR_CAMERA.target), []);
  const uiClock = useRef(0);

  useFrame((state, dt) => {
    bar.update(dt);
    gripTargetRef.current = bar.grip > 0.001 ? bar.handTarget : REST_HAND_WORLD;
    dopamineRef.current = bar.dopamine;

    // where the head goes: the straw while drinking, the pouch while carrying
    // it, otherwise a slow wander between the glass and the room
    const t = state.clock.elapsedTime;
    if (bar.lean > 0.05 && bar.phase === PHASES.SIPPING) lookRef.current = STRAW_TIP;
    else if (bar.grip > 0.3) lookRef.current = bar.handTarget;
    else {
      const w = Math.sin(t * 0.13) * 0.5 + 0.5;
      lookRef.current = [
        GLASS.base[0] - 0.6 * w, GLASS.base[1] + 0.12 + 0.35 * w, GLASS.base[2] + (Math.sin(t * 0.21) * 0.6),
      ];
    }

    sound.setArousal(bar.arousal, bar.collapse);

    // the camera drinks too: past a few mM the room starts to float
    const drunk = bar.sway;
    const shake = bar.shake;
    camera.position.set(
      base.x + Math.sin(t * 0.21) * 0.05 + drunk * Math.sin(t * 0.37) * 0.16 + Math.sin(t * 31.7) * shake * 0.04,
      base.y + Math.sin(t * 0.17) * 0.03 + drunk * Math.sin(t * 0.29) * 0.07 + Math.sin(t * 27.3) * shake * 0.035,
      base.z + Math.cos(t * 0.19) * 0.05 + drunk * Math.cos(t * 0.33) * 0.14 + Math.cos(t * 24.1) * shake * 0.04,
    );
    camera.lookAt(look);
    camera.rotateZ(drunk * Math.sin(t * 0.43) * 0.045);

    // the lights go down while it sleeps
    const night = bar.phase === PHASES.ASLEEP || bar.phase === PHASES.PASSED_OUT ? bar.collapse : 0;
    scene.background.copy(BG_AWAKE).lerp(BG_ASLEEP, night * 0.85);
    scene.fog.color.copy(scene.background);

    uiClock.current += dt;
    if (uiClock.current > 1 / 12) { uiClock.current = 0; onTick(); }
  });
  return null;
}

function Lights({ bar, dopamineRef }) {
  const key = useRef();
  const amb = useRef();
  const lamp = useRef();
  useFrame((state) => {
    const night = bar.phase === PHASES.ASLEEP || bar.phase === PHASES.PASSED_OUT ? bar.collapse : 0;
    const dim = 1 - night * 0.7;
    if (key.current) key.current.intensity = (1.9 + (dopamineRef.current ?? 0) * 0.6) * dim;
    if (amb.current) amb.current.intensity = 0.4 * dim;
    // the pendant over the counter breathes very slightly, like a real bulb
    if (lamp.current) lamp.current.intensity = (7 + Math.sin(state.clock.elapsedTime * 7.3) * 0.08) * dim;
  });
  return (
    <>
      <ambientLight ref={amb} intensity={0.4} color="#ffe2bd" />
      <hemisphereLight args={['#ffdcaa', '#3a2618', 0.55]} />
      <directionalLight
        ref={key}
        position={[4.5, 5.5, 1.2]}
        intensity={1.9}
        color="#ffe6c4"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-camera-far={18}
        shadow-bias={-0.0006}
      />
      <pointLight ref={lamp} position={[0.62, 2.35, -0.05]} intensity={7} distance={3.2} decay={2} color="#ffb867" />
      <pointLight position={[-0.9, 1.9, -1.2]} intensity={2.2} distance={4} decay={2} color="#ff7a3d" />
    </>
  );
}

function StudioProbe() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = env.texture;
    scene.environmentIntensity = 0.3;
    return () => { env.texture.dispose(); pmrem.dispose(); scene.environment = null; };
  }, [gl, scene]);
  return null;
}

// --------------------------------------------------------------- furniture

const WOOD = { color: '#5b3720', roughness: 0.55, metalness: 0 };
const WOOD_TOP = { color: '#6e4427', roughness: 0.28, metalness: 0.05 };
const BRASS = { color: '#c9954b', roughness: 0.3, metalness: 0.9 };

function Counter() {
  const { top, thickness, front, back, zMin, zMax } = COUNTER;
  const len = zMax - zMin;
  const zMid = (zMin + zMax) / 2;
  const depth = front - back;
  return (
    <group>
      {/* the top, overhanging the body on the fly's side */}
      <mesh position={[(front + back) / 2, top - thickness / 2, zMid]} castShadow receiveShadow>
        <boxGeometry args={[depth, thickness, len]} />
        <meshStandardMaterial {...WOOD_TOP} />
      </mesh>
      {/* the body, down to the floor */}
      <mesh position={[(front + back) / 2 - 0.06, (top - thickness) / 2, zMid]} castShadow receiveShadow>
        <boxGeometry args={[depth - 0.12, top - thickness, len]} />
        <meshStandardMaterial {...WOOD} />
      </mesh>
      {/* panels on the front face, so it reads as joinery and not a block */}
      {Array.from({ length: Math.floor(len / 0.6) }, (_, i) => (
        <mesh key={i} position={[front - 0.059, (top - thickness) / 2, zMin + 0.3 + i * 0.6]}>
          <boxGeometry args={[0.012, (top - thickness) * 0.72, 0.5]} />
          <meshStandardMaterial color="#4c2d19" roughness={0.6} />
        </mesh>
      ))}
      {/* the brass foot rail */}
      <mesh position={[front + 0.05, 0.22, zMid]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, len, 16]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
    </group>
  );
}

/** A plain bar stool under the fly, where the casino's stool stood. */
function Stool() {
  const [x, , z] = STOOL.origin;
  const seatY = STOOL.seatCenter[1];
  const r = STOOL.seatRadius;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, seatY - 0.035, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r * 0.96, 0.07, 40]} />
        <meshStandardMaterial color="#7a1f1c" roughness={0.5} />
      </mesh>
      <mesh position={[0, seatY - 0.09, 0]} castShadow>
        <cylinderGeometry args={[r * 0.55, r * 0.35, 0.05, 32]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[0, (seatY - 0.1) / 2, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, seatY - 0.1, 16]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[r * 0.8, 0.012, 10, 40]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[0, 0.012, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[r * 1.05, r * 1.15, 0.024, 40]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
    </group>
  );
}

/** The back bar: shelves of bottles in front of a dim mirror. */
function BackBar() {
  const bottles = useMemo(() => {
    const hues = ['#2f5d34', '#6b3a17', '#8c6a2a', '#274566', '#5e1f24', '#9aa08a', '#3f2a17'];
    const out = [];
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (const y of [1.46, 1.92, 2.38]) {
      for (let z = -2.4; z < 2.0; z += 0.17 + rnd() * 0.08) {
        out.push({ y, z, h: 0.22 + rnd() * 0.14, r: 0.033 + rnd() * 0.015, c: hues[Math.floor(rnd() * hues.length)] });
      }
    }
    return out;
  }, []);
  const x = -0.72;
  return (
    <group>
      <mesh position={[x - 0.2, 1.8, -0.2]} receiveShadow>
        <boxGeometry args={[0.05, 3.6, 5.2]} />
        <meshStandardMaterial color="#2d2019" roughness={0.9} />
      </mesh>
      <mesh position={[x - 0.17, 1.95, -0.2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[4.6, 1.3]} />
        <meshStandardMaterial color="#6f625a" roughness={0.12} metalness={0.8} side={THREE.DoubleSide} />
      </mesh>
      {[1.44, 1.9, 2.36].map((y) => (
        <mesh key={y} position={[x, y - 0.015, -0.2]} castShadow receiveShadow>
          <boxGeometry args={[0.3, 0.03, 4.6]} />
          <meshStandardMaterial {...WOOD_TOP} />
        </mesh>
      ))}
      {bottles.map((b, i) => (
        <group key={i} position={[x + 0.02, b.y, b.z]}>
          <mesh position={[0, b.h / 2, 0]} castShadow>
            <cylinderGeometry args={[b.r, b.r, b.h, 14]} />
            <meshPhysicalMaterial color={b.c} roughness={0.15} transmission={0.35} thickness={0.05} />
          </mesh>
          <mesh position={[0, b.h + 0.045, 0]}>
            <cylinderGeometry args={[b.r * 0.3, b.r * 0.9, 0.09, 10]} />
            <meshPhysicalMaterial color={b.c} roughness={0.15} transmission={0.35} thickness={0.05} />
          </mesh>
        </group>
      ))}
      {/* the pendant over the fly's end of the counter */}
      <mesh position={[0.62, 2.45, -0.05]}>
        <coneGeometry args={[0.13, 0.12, 24, 1, true]} />
        <meshStandardMaterial color="#1e1a16" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.62, 2.38, -0.05]}>
        <sphereGeometry args={[0.04, 16, 12]} />
        <meshStandardMaterial color="#ffd9a0" emissive="#ffb35c" emissiveIntensity={2.4} />
      </mesh>
      <mesh position={[0.62, 3.0, -0.05]}>
        <cylinderGeometry args={[0.004, 0.004, 1.1, 6]} />
        <meshStandardMaterial color="#111" />
      </mesh>
    </group>
  );
}

/** The tap, further down the counter. */
function Tap() {
  return (
    <group position={[0.4, COUNTER.top, 1.1]}>
      <mesh position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 0.32, 20]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[0.06, 0.28, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.014, 0.014, 0.12, 12]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.03, 0.18, 0.05]} />
        <meshStandardMaterial color="#1b1b1b" roughness={0.4} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------- the drink

/** A pint-ish glass profile, for the lathe. */
function glassProfile(h, rb, rt) {
  return [
    new THREE.Vector2(0, 0), new THREE.Vector2(rb, 0), new THREE.Vector2(rb + 0.002, 0.01),
    new THREE.Vector2(rt * 0.93, h * 0.72), new THREE.Vector2(rt, h * 0.9), new THREE.Vector2(rt * 0.985, h),
    new THREE.Vector2(rt * 0.95, h), new THREE.Vector2(rt * 0.94, h * 0.9), new THREE.Vector2(rt * 0.89, h * 0.72),
    new THREE.Vector2(rb - 0.004, 0.012), new THREE.Vector2(0, 0.012),
  ];
}

const GLASS_MAT = {
  color: '#ffffff', roughness: 0.04, metalness: 0, transmission: 1, thickness: 0.01, ior: 1.5,
  transparent: true, opacity: 0.35,
};

function Glass({ bar }) {
  const { base, height, radiusTop, radiusBottom } = GLASS;
  const liquid = useRef();
  const foam = useRef();
  const bubbles = useRef();
  const geo = useMemo(() => new THREE.LatheGeometry(glassProfile(height, radiusBottom, radiusTop), 40), [height, radiusBottom, radiusTop]);
  const inner = radiusBottom - 0.005;
  const innerTop = radiusTop * 0.9;
  const fullH = height * 0.86;
  const straw = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(base[0] + 0.008, base[1] + 0.02, base[2] - 0.004),
      new THREE.Vector3(base[0] + 0.012, base[1] + height + 0.05, base[2] - 0.01),
      new THREE.Vector3(base[0] + 0.05, base[1] + height + 0.13, base[2] - 0.05),
      new THREE.Vector3(STRAW_TIP[0] - 0.09, STRAW_TIP[1] + 0.02, STRAW_TIP[2] + 0.02),
      new THREE.Vector3(...STRAW_TIP),
    ], false, 'catmullrom', 0.3);
    return new THREE.TubeGeometry(curve, 64, 0.0055, 10, false);
  }, [base, height]);
  const bubbleSeeds = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    a: (i * 2.39996) % (Math.PI * 2), r: 0.3 + ((i * 37) % 10) / 16, s: 0.6 + ((i * 13) % 7) / 10, o: i / 14,
  })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    const f = clamp01(bar.fill);
    const h = Math.max(0.0005, fullH * f);
    if (liquid.current) {
      liquid.current.scale.set(1, h / fullH, 1);
      liquid.current.position.y = base[1] + 0.012 + h / 2;
      liquid.current.visible = f > 0.01;
    }
    if (foam.current) {
      const r = inner + (innerTop - inner) * (h / fullH);
      foam.current.scale.set(r / innerTop, 1, r / innerTop);
      foam.current.position.y = base[1] + 0.012 + h + 0.006;
      foam.current.visible = f > 0.01;
    }
    if (bubbles.current) {
      const t = state.clock.elapsedTime;
      bubbleSeeds.forEach((b, i) => {
        const k = (t * 0.25 * b.s + b.o) % 1;
        const y = base[1] + 0.02 + k * h * 0.95;
        const rr = inner * b.r * 0.8;
        dummy.position.set(base[0] + Math.cos(b.a) * rr, y, base[2] + Math.sin(b.a) * rr);
        dummy.scale.setScalar(f > 0.02 ? 1 : 0);
        dummy.updateMatrix();
        bubbles.current.setMatrixAt(i, dummy.matrix);
      });
      bubbles.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <mesh geometry={geo} position={base} castShadow renderOrder={2}>
        <meshPhysicalMaterial {...GLASS_MAT} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={liquid} position={[base[0], base[1] + fullH / 2, base[2]]}>
        <cylinderGeometry args={[innerTop, inner, fullH, 32]} />
        <meshPhysicalMaterial color="#e39a2a" roughness={0.15} transmission={0.45} thickness={0.05}
          emissive="#8a4b08" emissiveIntensity={0.35} />
      </mesh>
      <mesh ref={foam} position={[base[0], base[1] + fullH, base[2]]}>
        <cylinderGeometry args={[innerTop, innerTop, 0.014, 32]} />
        <meshStandardMaterial color="#fbf3e4" roughness={0.9} />
      </mesh>
      <instancedMesh ref={bubbles} args={[null, null, bubbleSeeds.length]}>
        <sphereGeometry args={[0.0016, 6, 5]} />
        <meshStandardMaterial color="#fff3cf" roughness={0.2} />
      </instancedMesh>
      <mesh geometry={straw} castShadow>
        <meshStandardMaterial color="#d8342b" roughness={0.45} />
      </mesh>
      <mesh position={[base[0], base[1] - 0.003, base[2]]} receiveShadow>
        <cylinderGeometry args={[0.058, 0.058, 0.006, 32]} />
        <meshStandardMaterial color="#e8dcc4" roughness={0.95} />
      </mesh>
    </group>
  );
}

/** Finished glasses, lined up down the counter: the tab, made visible. */
function Empties({ bar }) {
  const refs = useRef([]);
  const geo = useMemo(() => new THREE.LatheGeometry(glassProfile(GLASS.height, GLASS.radiusBottom, GLASS.radiusTop), 28), []);
  useFrame(() => {
    const n = Math.min(MAX_EMPTIES, bar.beers);
    refs.current.forEach((m, i) => { if (m) m.visible = i < n; });
  });
  return (
    <group>
      {Array.from({ length: MAX_EMPTIES }, (_, i) => {
        const row = Math.floor(i / 5);
        const z = GLASS.base[2] + 0.2 + (i % 5) * 0.11 + row * 0.05;
        const x = GLASS.base[0] - 0.1 - row * 0.11;
        return (
          <group key={i} ref={(el) => { refs.current[i] = el; }} position={[x, COUNTER.top, z]} visible={false}>
            <mesh geometry={geo} renderOrder={2}>
              <meshPhysicalMaterial {...GLASS_MAT} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
            {/* the lacing a finished beer leaves */}
            <mesh position={[0, 0.012, 0]}>
              <cylinderGeometry args={[GLASS.radiusBottom - 0.006, GLASS.radiusBottom - 0.006, 0.004, 20]} />
              <meshStandardMaterial color="#d8a348" roughness={0.3} transparent opacity={0.7} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ------------------------------------------------------------ the pouches

const POUCH_SIZE = [0.03, 0.007, 0.016];

const PouchMesh = forwardRef(function PouchMesh({ color = '#f4f1ea', ...props }, ref) {
  return (
    <mesh ref={ref} castShadow {...props}>
      <boxGeometry args={POUCH_SIZE} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
});

function Tin({ bar }) {
  const [x, y, z] = TIN.center;
  const spent = useRef([]);
  const inHand = useRef();
  const tucked = useRef();
  useFrame((state) => {
    if (inHand.current) {
      inHand.current.visible = bar.pouchInHand;
      if (bar.pouchInHand) {
        inHand.current.position.set(...bar.handTarget);
        inHand.current.rotation.set(0.3, state.clock.elapsedTime * 0.2, 0.2);
      }
    }
    const n = Math.min(MAX_SPENT, bar.pouchCount - bar.pouches.length);
    spent.current.forEach((m, i) => { if (m) m.visible = i < n; });
    if (tucked.current) tucked.current.visible = bar.pouches.length > 0 && !bar.down;
  });
  return (
    <group>
      <group position={[x, y, z]}>
        {/* the can */}
        <mesh position={[0, TIN.height / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[TIN.radius, TIN.radius, TIN.height, 40]} />
          <meshStandardMaterial color="#1d3c63" roughness={0.35} metalness={0.4} />
        </mesh>
        <mesh position={[0, TIN.height + 0.0005, 0]}>
          <cylinderGeometry args={[TIN.radius * 0.93, TIN.radius * 0.93, 0.001, 40]} />
          <meshStandardMaterial color="#e8e3d6" roughness={0.9} />
        </mesh>
        {/* the lid, flipped open behind it */}
        <group position={[-TIN.radius, TIN.height, 0]} rotation={[0, 0, 1.9]}>
          <mesh position={[TIN.radius, 0.006, 0]} castShadow>
            <cylinderGeometry args={[TIN.radius * 1.02, TIN.radius * 1.02, 0.012, 40]} />
            <meshStandardMaterial color="#e2e8ef" roughness={0.3} metalness={0.5} />
          </mesh>
        </group>
        {/* fresh pouches, in a ring */}
        {Array.from({ length: 7 }, (_, i) => {
          const a = (i / 7) * Math.PI * 2;
          return (
            <PouchMesh key={i} position={[Math.cos(a) * 0.017, TIN.height + 0.004, Math.sin(a) * 0.017]}
              rotation={[0.25, -a, 0]} />
          );
        })}
      </group>
      {/* spent ones, on a napkin */}
      <mesh position={[x - 0.04, y + 0.001, z - 0.13]} receiveShadow>
        <boxGeometry args={[0.12, 0.002, 0.12]} />
        <meshStandardMaterial color="#efe6d4" roughness={1} />
      </mesh>
      {Array.from({ length: MAX_SPENT }, (_, i) => (
        <PouchMesh
          key={i}
          ref={(el) => { spent.current[i] = el; }}
          color="#bba27a"
          visible={false}
          position={[x - 0.075 + (i % 4) * 0.022, y + 0.006 + Math.floor(i / 8) * 0.006, z - 0.16 + Math.floor(i / 4) * 0.025]}
          rotation={[0, i * 0.9, 0]}
        />
      ))}
      <PouchMesh ref={inHand} visible={false} />
      {/* the one under its "lip" rides where the pouch was tucked */}
      <PouchMesh ref={tucked} visible={false} position={MOUTH} />
    </group>
  );
}

// ------------------------------------------------------------ the proboscis

/**
 * The proboscis. Flies drink by extending it; the motor neuron that does it
 * (MN9) is what Shiu et al. 2024 drove from sugar-sensing neurons through a
 * whole-brain connectome model. Here it grows from the mouthparts, wherever
 * the turned head has put them, to the end of the straw.
 */
function Proboscis({ bar, mouthRef }) {
  const stalk = useRef();
  const tip = useRef();
  const from = useMemo(() => new THREE.Vector3(), []);
  const to = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  useFrame(() => {
    const m = mouthRef.current;
    const e = bar.extend;
    const on = !!m && e > 0.02;
    if (stalk.current) stalk.current.visible = on;
    if (tip.current) tip.current.visible = on;
    if (!on) return;
    from.set(m[0], m[1], m[2]);
    to.set(...STRAW_TIP);
    dir.subVectors(to, from);
    const full = dir.length();
    const len = Math.max(0.001, full * e);
    dir.normalize();
    stalk.current.position.copy(from).addScaledVector(dir, len / 2);
    stalk.current.quaternion.setFromUnitVectors(up, dir);
    stalk.current.scale.set(1, len, 1);
    tip.current.position.copy(from).addScaledVector(dir, len);
  });
  return (
    <group>
      <mesh ref={stalk} visible={false}>
        <cylinderGeometry args={[0.011, 0.016, 1, 12]} />
        <meshPhysicalMaterial color="#b0621c" roughness={0.45} transmission={0.25} thickness={0.02} />
      </mesh>
      <mesh ref={tip} visible={false} scale={[1, 0.7, 1]}>
        <sphereGeometry args={[0.016, 16, 12]} />
        <meshPhysicalMaterial color="#c47327" roughness={0.5} transmission={0.2} thickness={0.02} />
      </mesh>
    </group>
  );
}

// ----------------------------------------------------------------- scene

function World({ bar, onTick }) {
  const gripTargetRef = useRef(REST_HAND_WORLD);
  const dopamineRef = useRef(0);
  const lookRef = useRef(null);
  const mouthRef = useRef(null);
  return (
    <>
      <Lights bar={bar} dopamineRef={dopamineRef} />
      <Rig bar={bar} gripTargetRef={gripTargetRef} dopamineRef={dopamineRef} lookRef={lookRef} onTick={onTick} />
      <Counter />
      <Stool />
      <BackBar />
      <Tap />
      <Glass bar={bar} />
      <Empties bar={bar} />
      <Tin bar={bar} />
      <Fly
        machine={bar}
        gripTargetRef={gripTargetRef}
        dopamineRef={dopamineRef}
        lookRef={lookRef}
        mouthRef={mouthRef}
        mouthLocal={MOUTH_LOCAL}
      />
      <Proboscis bar={bar} mouthRef={mouthRef} />
      <ContactShadows position={[0, 0.002, 0]} opacity={0.5} scale={12} blur={2.4} far={4} resolution={1024} color="#140c06" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[16, 64]} />
        <meshStandardMaterial color="#4a3526" roughness={0.85} />
      </mesh>
      <StudioProbe />
    </>
  );
}

export function BarScene({ bar, onTick }) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.85]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        scene.background = BG_AWAKE.clone();
        scene.fog = new THREE.Fog(BG_AWAKE.clone(), 6, 16);
      }}
    >
      <PerspectiveCamera makeDefault fov={BAR_CAMERA.fov} position={BAR_CAMERA.position} near={0.05} far={60} />
      <AdaptiveDpr pixelated />
      <Suspense fallback={null}>
        <World bar={bar} onTick={onTick} />
      </Suspense>
    </Canvas>
  );
}
