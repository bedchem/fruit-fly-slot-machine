/**
 * Feeds the page's one loading screen (#boot, in each experiment's
 * index.html) and lets it fade out once everything is in. The bar covers the
 * 3D models and textures, which drei's loading manager reports, then the
 * connectome, which reports only ready or not. Renders nothing itself.
 */
import { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';

/** Share of the bar the models fill; the connectome finishes the rest. */
const MODELS_SHARE = 90;

export function Loader({ ready = true }) {
  const { active, progress, total } = useProgress();
  // a scene with nothing to load never starts the manager: don't wait on it forever
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 800);
    return () => clearTimeout(t);
  }, []);
  const modelsIn = !active && (progress >= 100 || (settled && total === 0));

  useEffect(() => {
    const boot = window.__boot;
    if (!boot) return;
    boot.progress((modelsIn ? MODELS_SHARE : (progress * MODELS_SHARE) / 100) + (ready ? 100 - MODELS_SHARE : 0));
    if (modelsIn && ready) boot.done();
  }, [progress, modelsIn, ready]);

  return null;
}
