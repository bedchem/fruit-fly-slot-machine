import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BAR_CAMERA } from './barLayout.js';
import { barCameraFov, constrainBarView, dampBarView, dragBarView, sampleBarCamera, zoomBarView } from './barCamera.js';

/** Bounded orbit and subtle depth around the existing bar composition. */
export function BarCamera({ bar }) {
  const { camera, gl, size } = useThree();
  const state = useRef({
    view: { yaw: 0, pitch: 0, zoom: 1 },
    desired: { yaw: 0, pitch: 0, zoom: 1 },
    hover: { x: 0, y: 0 },
    hoverAt: { x: 0, y: 0 },
    reducedMotion: false,
    pose: { position: [0, 0, 0], roll: 0 },
  });

  useEffect(() => {
    const canvas = gl.domElement;
    const live = state.current;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const previous = {
      cursor: canvas.style.cursor,
      touchAction: canvas.style.touchAction,
      tabIndex: canvas.getAttribute('tabindex'),
      label: canvas.getAttribute('aria-label'),
    };
    let pointer = null;
    canvas.style.cursor = 'grab';
    canvas.style.touchAction = 'pan-y pinch-zoom';
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Bar view. Drag to look around. Arrow keys rotate, plus and minus zoom, Home resets the view.');
    canvas.classList.add('bar-camera-interactive');

    const reduced = () => {
      live.reducedMotion = media.matches;
      if (media.matches) {
        live.hover.x = live.hover.y = 0;
        live.hoverAt.x = live.hoverAt.y = 0;
      }
    };
    reduced();
    media.addEventListener('change', reduced);

    const end = () => {
      const id = pointer?.id;
      pointer = null;
      if (id !== undefined && canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture(id);
      canvas.style.cursor = 'grab';
      canvas.classList.remove('bar-camera-dragging');
    };
    const reset = () => {
      end();
      Object.assign(live.desired, { yaw: 0, pitch: 0, zoom: 1 });
      live.hover.x = live.hover.y = 0;
    };
    const down = (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, touch: event.pointerType === 'touch', active: false };
      if (!pointer.touch) canvas.focus({ preventScroll: true });
      live.hover.x = live.hover.y = 0;
    };
    const move = (event) => {
      const rect = canvas.getBoundingClientRect();
      if (!pointer) {
        if (event.pointerType !== 'touch') {
          live.hover.x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width) * 2 - 1));
          live.hover.y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height) * 2 - 1));
        }
        return;
      }
      if (event.pointerId !== pointer.id) return;
      if (!pointer.active) {
        const dx = event.clientX - pointer.startX;
        const dy = event.clientY - pointer.startY;
        const threshold = pointer.touch ? 9 : 3;
        if (Math.hypot(dx, dy) < threshold) return;
        // A vertical swipe belongs to page scrolling. Only an intentional
        // horizontal gesture captures touch; native browser pinch stays free.
        if (pointer.touch && Math.abs(dy) >= Math.abs(dx) * 0.85) { end(); return; }
        pointer.active = true;
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = 'grabbing';
        canvas.classList.add('bar-camera-dragging');
      }
      dragBarView(live.desired, event.clientX - pointer.x, event.clientY - pointer.y, rect.width, rect.height);
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (event.cancelable) event.preventDefault();
    };
    const up = (event) => { if (pointer?.id === event.pointerId) end(); };
    const leave = () => {
      live.hover.x = live.hover.y = 0;
      if (pointer && !pointer.active) end();
    };
    const wheel = (event) => {
      if (event.ctrlKey || event.metaKey) return; // retain browser/trackpad pinch zoom
      if (event.cancelable) event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
      zoomBarView(live.desired, event.deltaY * unit);
    };
    const key = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      switch (event.key) {
        case 'ArrowLeft': live.desired.yaw -= 0.065; break;
        case 'ArrowRight': live.desired.yaw += 0.065; break;
        case 'ArrowUp': live.desired.pitch += 0.04; break;
        case 'ArrowDown': live.desired.pitch -= 0.04; break;
        case '+': case '=': zoomBarView(live.desired, -65); break;
        case '-': case '_': zoomBarView(live.desired, 65); break;
        case 'Home': case '0': reset(); break;
        default: return;
      }
      constrainBarView(live.desired);
      event.preventDefault();
    };
    const listeners = [
      ['pointerdown', down], ['pointermove', move], ['pointerup', up],
      ['pointercancel', up], ['lostpointercapture', up], ['pointerleave', leave],
      ['dblclick', reset], ['bar-camera-reset', reset], ['keydown', key],
    ];
    for (const [name, listener] of listeners) canvas.addEventListener(name, listener);
    canvas.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('blur', end);
    // A click released outside the canvas must not leave a pending gesture.
    window.addEventListener('pointerup', up);
    return () => {
      for (const [name, listener] of listeners) canvas.removeEventListener(name, listener);
      canvas.removeEventListener('wheel', wheel);
      window.removeEventListener('blur', end);
      window.removeEventListener('pointerup', up);
      media.removeEventListener('change', reduced);
      end();
      canvas.classList.remove('bar-camera-interactive', 'bar-camera-dragging');
      canvas.style.cursor = previous.cursor;
      canvas.style.touchAction = previous.touchAction;
      if (previous.tabIndex === null) canvas.removeAttribute('tabindex');
      else canvas.setAttribute('tabindex', previous.tabIndex);
      if (previous.label === null) canvas.removeAttribute('aria-label');
      else canvas.setAttribute('aria-label', previous.label);
    };
  }, [gl]);

  useFrame(({ clock }, dt) => {
    const live = state.current;
    dampBarView(live.view, live.desired, dt);
    const blend = 1 - Math.exp(-Math.max(0, dt) * 6);
    live.hoverAt.x += (live.hover.x - live.hoverAt.x) * blend;
    live.hoverAt.y += (live.hover.y - live.hoverAt.y) * blend;
    const pose = sampleBarCamera(live.view, {
      time: clock.elapsedTime, sway: bar.sway, shake: bar.shake,
      hoverX: live.hoverAt.x, hoverY: live.hoverAt.y, reducedMotion: live.reducedMotion,
    }, live.pose);
    camera.position.set(...pose.position);
    camera.lookAt(...BAR_CAMERA.target);
    camera.rotateZ(pose.roll);
    const fov = barCameraFov(size.width, size.height);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
