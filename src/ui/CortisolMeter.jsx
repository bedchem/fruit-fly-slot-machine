import { useEffect, useRef, useState } from 'react';

const CENTER = { x: 180, y: 172 };
const OUTER_RADIUS = 142;
const INNER_RADIUS = 90;
const SEGMENT_COUNT = 6;
const SEGMENT_GAP = 1.5;
const COLORS = ['#5bc044', '#b6cc22', '#f5e438', '#ff9635', '#ff503a', '#ef1d43'];

const clamp01 = (value) => Math.max(0, Math.min(1, value));

function point(radius, degrees) {
  const radians = degrees * Math.PI / 180;
  return {
    x: CENTER.x + radius * Math.cos(radians),
    y: CENTER.y - radius * Math.sin(radians),
  };
}

function segmentPath(index) {
  const span = 180 / SEGMENT_COUNT;
  const start = 180 - index * span - SEGMENT_GAP / 2;
  const end = 180 - (index + 1) * span + SEGMENT_GAP / 2;
  const outerStart = point(OUTER_RADIUS, start);
  const outerEnd = point(OUTER_RADIUS, end);
  const innerEnd = point(INNER_RADIUS, end);
  const innerStart = point(INNER_RADIUS, start);
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 0 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${INNER_RADIUS} ${INNER_RADIUS} 0 0 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

/**
 * A deliberately graphic stress gauge. Flies do not produce cortisol, so the
 * label is treated as a familiar human shorthand; the needle is driven by the
 * app's actual defensive/arousal model rather than presented as a measurement.
 */
export function CortisolMeter({ machineRef }) {
  // The panel stays calm by default; the one-line live summary remains useful
  // until a visitor explicitly opens the full gauge.
  const [open, setOpen] = useState(false);
  const needleRef = useRef(null);
  const valueRef = useRef(null);
  const levelRef = useRef(null);
  const summaryRef = useRef(null);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const machine = machineRef.current;
      if (machine) {
        const streak = clamp01(machine.lossStreak / 6);
        const level = clamp01(
          0.08
          + machine.fear * 0.46
          + machine.octopamine * 0.31
          + streak * 0.15
          + (machine.brokeStage ? 0.22 : 0),
        );
        // Left is low; the arrow sweeps clockwise into the red high range.
        const degrees = 180 - level * 180;
        // SVG's positive rotation points down in screen coordinates. The scale
        // lives above the hub, so invert the angle: low = left, medium = up,
        // high = right.
        needleRef.current?.setAttribute('transform', `rotate(${-degrees} ${CENTER.x} ${CENTER.y})`);
        if (valueRef.current) valueRef.current.textContent = `${Math.round(level * 100)}%`;
        const label = level < 0.34 ? 'Low' : level < 0.68 ? 'Medium' : 'High';
        if (levelRef.current) levelRef.current.textContent = label;
        if (summaryRef.current) summaryRef.current.textContent = `${label} · ${Math.round(level * 100)}%`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [machineRef]);

  return (
    <section className={`cortisol-meter ${open ? 'is-open' : 'is-collapsed'}`} aria-labelledby="cortisol-title">
      <button
        className="cortisol-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="cortisol-graphic"
        onClick={() => setOpen((value) => !value)}
      >
        <span id="cortisol-title">Cortisol meter</span>
        <b ref={summaryRef}>Low · 8%</b>
        <i aria-hidden="true" />
      </button>
      <div id="cortisol-graphic" className="cortisol-graphic" hidden={!open}>
        <svg viewBox="0 0 360 250" role="img" aria-labelledby="cortisol-graphic-title cortisol-description">
          <title id="cortisol-graphic-title">Cortisol level</title>
          <desc id="cortisol-description">A live low-to-high stress meter driven by the fly's defensive and arousal state.</desc>
          <g className="cortisol-arc" aria-hidden="true">
            {COLORS.map((color, index) => <path key={color} d={segmentPath(index)} fill={color} />)}
          </g>
          <text className="cortisol-level cortisol-low" x="23" y="147" transform="rotate(-78 23 147)">LOW</text>
          <text className="cortisol-level cortisol-medium" x="180" y="26">MEDIUM</text>
          <text className="cortisol-level cortisol-high" x="336" y="147" transform="rotate(78 336 147)">HIGH</text>
          <g ref={needleRef} className="cortisol-needle" aria-hidden="true">
            <line x1={CENTER.x} y1={CENTER.y} x2="316" y2={CENTER.y} />
            <circle cx={CENTER.x} cy={CENTER.y} r="15" />
          </g>
          <text className="cortisol-name" x="180" y="237">CORTISOL</text>
        </svg>
        <p className="cortisol-readout" aria-live="polite">
          <span ref={levelRef}>Low</span><b ref={valueRef}>8%</b>
        </p>
        <p className="cortisol-note">Stress proxy — flies do not produce cortisol.</p>
      </div>
    </section>
  );
}
