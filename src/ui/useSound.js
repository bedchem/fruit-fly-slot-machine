import { useCallback, useEffect, useRef, useState } from 'react';
import { sound } from '../audio/audio.js';

const SOUND_STORAGE_KEY = 'fly-lab-sound';

function readSoundPreference() {
  try {
    const value = window.localStorage.getItem(SOUND_STORAGE_KEY);
    if (value === 'on') return true;
    if (value === 'off') return false;
    return null;
  } catch {
    return null;
  }
}

function saveSoundOn(enabled) {
  try {
    window.localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Private browsing and blocked storage should not stop the experiment.
  }
}

/**
 * One sound preference for every experiment page.
 *
 * The first interaction still unlocks the Web Audio context, but the visitor's
 * choice is kept between pages and visits in localStorage.
 */
export function useSound() {
  const [savedPreference] = useState(readSoundPreference);
  const [soundOn, setSoundOn] = useState(() => savedPreference === true);
  const soundOnRef = useRef(soundOn);
  const soundTouched = useRef(false);

  const setEnabled = useCallback((enabled) => {
    soundTouched.current = true;
    soundOnRef.current = enabled;
    if (enabled) sound.resume();
    sound.setMuted(!enabled);
    saveSoundOn(enabled);
    setSoundOn(enabled);
  }, []);

  const toggleSound = useCallback(() => {
    setEnabled(!soundOnRef.current);
  }, [setEnabled]);

  // Apply a saved preference before the first interaction on this page.
  useEffect(() => {
    soundOnRef.current = soundOn;
    sound.setMuted(!soundOn);
  }, [soundOn]);

  // As before, any first interaction unlocks audio. It now also persists that
  // implicit choice, while the sound pill and the M shortcut remain explicit.
  useEffect(() => {
    const events = ['pointerdown', 'keydown', 'touchstart'];
    const first = (event) => {
      if (soundTouched.current) return;
      if (event.target?.closest?.('.pill.sound') || event.key === 'm' || event.key === 'M') return;
      // A saved "off" choice is intentional and must survive page changes.
      if (savedPreference === false) {
        soundTouched.current = true;
        return;
      }
      setEnabled(true);
    };
    events.forEach((event) => window.addEventListener(event, first, { passive: true }));
    return () => events.forEach((event) => window.removeEventListener(event, first));
  }, [savedPreference, setEnabled]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'm' || event.key === 'M') toggleSound();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleSound]);

  return { muted: !soundOn, soundOn, toggleSound };
}
