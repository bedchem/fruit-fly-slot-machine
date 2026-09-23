import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { BAR_CAMERA, BAR_FLY, GLASS, MOUTH, TIN } from '../src/scene/barLayout.js';
import { BAR_CAMERA_LIMITS, barCameraFov, constrainBarView, dampBarView, dragBarView, sampleBarCamera, zoomBarView } from '../src/scene/barCamera.js';

test('neutral view preserves the authored bar camera exactly', () => {
  const pose = sampleBarCamera({ yaw: 0, pitch: 0, zoom: 1 });
  pose.position.forEach((value, i) => assert.ok(Math.abs(value - BAR_CAMERA.position[i]) < 1e-12));
  assert.equal(pose.roll, 0);
});

test('long drags and repeated zooms stay within the safe camera limits', () => {
  const view = { yaw: 0, pitch: 0, zoom: 1 };
  dragBarView(view, 100000, -100000, 1000, 600);
  assert.equal(view.yaw, -BAR_CAMERA_LIMITS.yaw);
  assert.equal(view.pitch, -BAR_CAMERA_LIMITS.pitch);
  dragBarView(view, -100000, 100000, 1000, 600);
  assert.equal(view.yaw, BAR_CAMERA_LIMITS.yaw);
  assert.equal(view.pitch, BAR_CAMERA_LIMITS.pitch);
  for (let i = 0; i < 100; i += 1) zoomBarView(view, -500);
  assert.equal(view.zoom, BAR_CAMERA_LIMITS.zoomMin);
  for (let i = 0; i < 100; i += 1) zoomBarView(view, 500);
  assert.equal(view.zoom, BAR_CAMERA_LIMITS.zoomMax);
  assert.deepEqual(constrainBarView({ yaw: NaN, pitch: Infinity, zoom: undefined }), { yaw: 0, pitch: 0, zoom: 1 });
});

test('damping converges independently of refresh rate and reset returns home', () => {
  const results = [20, 60, 120].map((fps) => {
    const view = { yaw: 0, pitch: 0, zoom: 1 };
    const desired = { yaw: 0.4, pitch: -0.13, zoom: 0.9 };
    for (let i = 0; i < fps; i += 1) dampBarView(view, desired, 1 / fps);
    return view;
  });
  for (const view of results) {
    for (const key of ['yaw', 'pitch', 'zoom']) assert.ok(Math.abs(view[key] - results[0][key]) < 0.002);
  }
  for (const view of results) {
    for (let i = 0; i < 120; i += 1) dampBarView(view, { yaw: 0, pitch: 0, zoom: 1 }, 1 / 60);
    assert.ok(Math.abs(view.yaw) < 1e-8);
    assert.ok(Math.abs(view.pitch) < 1e-8);
    assert.ok(Math.abs(view.zoom - 1) < 1e-8);
  }
});

test('reduced motion removes parallax, floating and shake while retaining user orbit', () => {
  const view = { yaw: 0.35, pitch: 0.12, zoom: 0.9 };
  const reference = sampleBarCamera(view, { reducedMotion: true });
  for (const time of [0, 0.5, 10, 100]) {
    const pose = sampleBarCamera(view, { reducedMotion: true, time, hoverX: 1, hoverY: -1, sway: 1, shake: 1 });
    assert.deepEqual(pose, reference);
  }
  assert.ok(Math.hypot(...reference.position.map((value, i) => value - BAR_CAMERA.position[i])) > 0.2);
});

test('fly, mouth and interactive props stay in frame at orbit extremes on desktop and mobile', () => {
  const points = [BAR_FLY.position, MOUTH, GLASS.base, TIN.center];
  for (const [width, height] of [[1440, 900], [800, 700], [390, 650], [320, 576]]) {
    const camera = new PerspectiveCamera(barCameraFov(width, height), width / height, 0.05, 60);
    for (const yaw of [-BAR_CAMERA_LIMITS.yaw, 0, BAR_CAMERA_LIMITS.yaw]) {
      for (const pitch of [-BAR_CAMERA_LIMITS.pitch, BAR_CAMERA_LIMITS.pitch]) {
        for (const zoom of [BAR_CAMERA_LIMITS.zoomMin, BAR_CAMERA_LIMITS.zoomMax]) {
          const pose = sampleBarCamera({ yaw, pitch, zoom }, { reducedMotion: true });
          camera.position.set(...pose.position);
          camera.lookAt(...BAR_CAMERA.target);
          camera.updateMatrixWorld();
          for (const point of points) {
            const projected = new Vector3(...point).project(camera);
            assert.ok(Math.abs(projected.x) < 0.9 && Math.abs(projected.y) < 0.8,
              `important prop left safe frame at ${width}×${height}, yaw ${yaw}, pitch ${pitch}, zoom ${zoom}`);
            assert.ok(projected.z > -1 && projected.z < 1);
          }
        }
      }
    }
  }
});
