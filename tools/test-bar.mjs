/** Run with `node --test tools/test-bar.mjs`. Exercises the real bar state machine. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { Bar, PHASES } from '../src/game/bar.js';

const makeBar = () => {
  const events = [];
  const bar = new Bar({ rng: () => 0.5, now: () => 0, onEvent: (type) => events.push(type) });
  bar.nextDecisionAfter = Infinity;
  return { bar, events };
};

function drink(bar, sips = 3) {
  bar.plan = { kind: 'beer', sips, why: 'motion regression' };
  bar.startSipping();
}

function pouch(bar) {
  bar.plan = { kind: 'pouch', mg: 6, why: 'motion regression' };
  bar.startPouch();
}

function runAction(bar, fps) {
  const stages = new Set();
  let frames = 0;
  while (bar.busy && frames < fps * 20) {
    stages.add(bar.pouchStage);
    bar.update(1 / fps);
    assert.ok(Number.isFinite(bar.lean));
    assert.ok(bar.handTarget.every(Number.isFinite));
    assert.ok(bar.proboscis >= 0 && bar.proboscis <= 1);
    assert.ok(bar.grip >= 0 && bar.grip <= 1);
    frames += 1;
  }
  assert.equal(bar.phase, PHASES.IDLE, 'action must return to idle');
  return { duration: frames / fps, stages };
}

test('the glass handoff stays continuous through pickup, drink and return', () => {
  const poseAt = (t) => {
    const { bar } = makeBar();
    drink(bar);
    bar.t = t;
    bar.updateSipping(0);
    return [bar.glassLift, bar.glassTilt, bar.grip];
  };
  for (const t of [0.55, 1.17, 1.79, 2.41, 2.91]) {
    const before = poseAt(t - 1e-6);
    const after = poseAt(t + 1e-6);
    after.forEach((value, i) => assert.ok(Math.abs(value - before[i]) < 0.0001,
      `pose component ${i} snapped at ${t}s`));
  }
  const [lift, tilt, grip] = poseAt(2.6);
  assert.ok(lift >= 0 && tilt >= 0 && grip >= 0);
});

test('sipping keeps the neural taste signal and commits each drink exactly once', () => {
  const { bar, events } = makeBar();
  drink(bar);
  bar.t = 0.55 + 0.38 + 0.62 / 4;
  bar.updateSipping(0);
  assert.equal(bar.extend, 1);
  // Restart from a fresh state for the full lifecycle.
  const full = makeBar();
  drink(full.bar);
  const { duration } = runAction(full.bar, 60);
  assert.ok(Math.abs(duration - 4.3) < 1 / 60);
  assert.equal(full.bar.sips, 3);
  assert.equal(full.bar.sipsTaken, 3);
  assert.ok(Math.abs(full.bar.fill - 0.85) < 1e-10);
  assert.equal(full.events.filter((event) => event === 'sip').length, 3);
  assert.equal(full.events.filter((event) => event === 'boutDone').length, 1);
  assert.equal(full.bar.history.length, 1);
  assert.equal(full.bar.proboscis, 0);
  assert.equal(full.bar.plan, null);
  assert.deepEqual(events, ['lean']);
});

test('some seeded drinks are a single complete gulp while ordinary drinks pace each sip', () => {
  const gulp = new Bar({ rng: () => 0, now: () => 0 });
  gulp.nextDecisionAfter = Infinity;
  gulp.plan = { kind: 'beer', sips: 5, why: 'gulp regression' };
  const events = [];
  gulp.onEvent = (type) => { if (type === 'sip') events.push(type); };
  gulp.startSipping();
  while (gulp.busy) gulp.update(1 / 60);
  assert.equal(gulp.drinkStyle, 'gulp');
  assert.equal(events.length, 5);
  assert.equal(gulp.sips, 5);
});

test('the blackout headline keeps the passout level while the body clears', () => {
  const bar = new Bar({ rng: () => 0.5, now: () => 0 });
  bar.bac = 40;
  bar.peakBac = 40;
  bar.fallAsleep(true);
  bar.bac = 0;
  assert.ok(bar.meterPermille > 1.8);
  assert.equal(bar.permille, 0);
  bar.wake();
  assert.equal(bar.meterPermille, 0);
});

test('nicotine appetite rises with dependence and co-use', () => {
  const calm = new Bar({ rng: () => 0.5 });
  const dependent = new Bar({ rng: () => 0.5 });
  dependent.dependence = 0.8;
  dependent.bac = 18;
  calm.bac = 18;
  assert.ok(dependent.appetite.pouch > calm.appetite.pouch);
});

test('pouch choreography keeps its five beats and timing across frame rates', () => {
  for (const fps of [20, 60, 120]) {
    const { bar, events } = makeBar();
    pouch(bar);
    const { duration, stages } = runAction(bar, fps);
    assert.deepEqual([...stages], ['reach', 'pinch', 'lift', 'tuck', 'release']);
    assert.ok(Math.abs(duration - 4.27) <= 1 / fps + 1e-9, `${fps} fps added pauses between beats`);
    assert.deepEqual(events, ['reach', 'tin', 'lid', 'tuck']);
    assert.equal(bar.pouchCount, 1);
    assert.equal(bar.nicotineMg, 6);
    assert.equal(bar.pouches.length, 1);
    assert.equal(bar.pouches[0].mg, 6);
    assert.equal(bar.pouchInHand, false);
    assert.equal(bar.grip, 0);
    assert.equal(bar.tinLid, 0);
    assert.equal(bar.plan, null);
  }
});

test('sleep and seizures clear interrupted gestures without committing a pouch', () => {
  for (const interrupt of ['fallAsleep', 'seize']) {
    const { bar, events } = makeBar();
    pouch(bar);
    for (let i = 0; i < 100; i += 1) bar.update(1 / 60);
    assert.equal(bar.pouchStage, 'lift');
    assert.equal(bar.pouchInHand, true);
    bar[interrupt]();
    for (let i = 0; i < 120; i += 1) bar.update(1 / 60);
    assert.equal(bar.pouchInHand, false);
    assert.equal(bar.pouchCount, 0);
    assert.equal(bar.pouches.length, 0);
    assert.equal(events.includes('tuck'), false);
    assert.equal(bar.tinLid, 0);
  }
  const { bar } = makeBar();
  drink(bar);
  for (let i = 0; i < 120; i += 1) bar.update(1 / 60);
  assert.ok(bar.glassLift > 0.9);
  bar.fallAsleep();
  for (let i = 0; i < 90; i += 1) {
    const before = bar.glassLift;
    bar.update(1 / 60);
    assert.ok(bar.glassLift <= before);
  }
  assert.ok(bar.glassLift < 0.001);
});

test('intoxicated, slower actions still finish with finite poses and one dose', () => {
  for (const kind of ['beer', 'pouch']) {
    const { bar, events } = makeBar();
    bar.bac = 25;
    if (kind === 'beer') drink(bar, 5);
    else pouch(bar);
    runAction(bar, 20);
    if (kind === 'beer') {
      assert.equal(bar.sips, 5);
      assert.equal(events.filter((event) => event === 'sip').length, 5);
    } else {
      assert.equal(bar.pouchCount, 1);
      assert.equal(events.filter((event) => event === 'tuck').length, 1);
    }
  }
});
