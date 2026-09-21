/**
 * What shows while the 3D scene is still arriving. The CT-scanned fly alone
 * is several megabytes; until it and the rest of the scene are in, the stage
 * would otherwise be an empty colour. drei's loading manager reports how far
 * along it is.
 */
import { useProgress } from '@react-three/drei';

export function Loader({ label = 'Loading the fly' }) {
  const { active, progress } = useProgress();
  if (!active && progress >= 100) return null;
  const pct = Math.round(progress);
  return (
    <div className="scene-loader" role="status" aria-live="polite">
      <span>{label}…</span>
      <div className="scene-loader-track" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
      <b>{pct}%</b>
    </div>
  );
}
