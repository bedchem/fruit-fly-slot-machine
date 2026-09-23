import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';

// These textures have fully opaque alpha channels despite being exported as
// BLEND. Sorting their room-wide meshes with the translucent fly lets distant
// walls paint over its head. Render them in the opaque depth-tested pass.
const OPAQUE_MATERIALS = new Set([
  'TextureMaterial', 'TextureMaterial_12', 'TextureMaterial_17',
  'TextureMaterial_21', 'TextureMaterial_49', 'TextureMaterial_5',
  'TextureMaterial_6', 'TextureMaterial_9',
]);
// Bottle silhouettes and hanging crisp packets have binary alpha, with only
// antialiased borders. Alpha testing keeps their holes out of the depth buffer.
const CUTOUT_MATERIALS = new Set(['TextureMaterial_31', 'TextureMaterial_48']);

/**
 * Old bar by katydid. Keep the authored textures and embedded attribution.
 * The source includes its own Y-up transform and an offset floor at Y=4.37.
 * Align the existing countertop to the fly's measured interaction plane, and
 * slide the room along it until the near upholstered stool stands where the
 * casino's stool does (seat centre 1.543, -0.009). Moving the fly instead
 * would take it off the casino, trading and doomscroll stools as well.
 */
export function OldBar() {
  const { scene } = useGLTF('/models/old-bar.glb');
  const room = useMemo(() => {
    const root = scene.clone(true);
    const materials = [];
    root.name = 'Old bar interior';
    root.traverse((object) => {
      if (!object.isMesh) return;
      const source = object.material;
      if (OPAQUE_MATERIALS.has(source.name) || CUTOUT_MATERIALS.has(source.name)) {
        const material = source.clone();
        material.transparent = false;
        material.depthWrite = true;
        if (CUTOUT_MATERIALS.has(source.name)) material.alphaTest = 0.5;
        object.material = material;
        materials.push(material);
      }
      // The export includes an entirely transparent duplicate back-face mesh.
      // It contributes no pixels, but would cast a solid shadow over the room.
      if (object.material.opacity === 0) object.visible = false;
      object.castShadow = object.visible && !object.material.transparent;
      object.receiveShadow = true;
    });
    return { root, materials };
  }, [scene]);
  useEffect(() => () => room.materials.forEach((material) => material.dispose()), [room]);
  return <primitive object={room.root} position={[1.9615, -5.2877, 3.6351]} rotation={[0, 1.6018, 0]} scale={1.21} dispose={null} />;
}

useGLTF.preload('/models/old-bar.glb');
