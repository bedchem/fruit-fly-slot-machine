// Development-only screenshot fixture. Loaded by .cache/bar-check/index.html,
// never by an application entry or the production build.
import { PHASES } from '../src/game/bar.js';

const mode = new URLSearchParams(location.search).get('pose') ?? 'idle';
function pose() {
  const bar = window.__bar;
  if (!bar) { requestAnimationFrame(pose); return; }
  bar.updateAutonomy = () => {};
  if (mode === 'sip') {
    bar.plan = { kind: 'beer', sips: 3, why: 'a slow, steady drink' };
    bar.startSipping();
    for (let i = 0; i < 78; i++) bar.update(1 / 60);
  } else if (mode === 'pouch') {
    bar.plan = { kind: 'pouch', mg: 6, why: 'curious about the tin' };
    bar.startPouch();
    for (let i = 0; i < 85; i++) bar.update(1 / 60);
  } else if (mode === 'sleep') {
    bar.phase = PHASES.ASLEEP;
    bar.collapse = 1;
  } else if (mode === 'refill') {
    bar.refilling = 0.5;
    bar.fill = 0.5;
    bar.beers = 2;
  }
  bar.update = () => bar;
  document.documentElement.dataset.visualPose = mode;
}
requestAnimationFrame(pose);
