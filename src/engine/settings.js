/**
 * src/engine/settings.js — player audio settings (SFX / music volume, mute),
 * persisted to localStorage. Pure helpers take an injectable storage so they
 * run under Node.
 */

import { clampVolume } from './audio.js';

export const SETTINGS_KEY = 'hh.settings';
export const DEFAULT_SETTINGS = Object.freeze({ sfx: 0.8, music: 0.6, muted: false });

/** Coerce anything into a valid settings object. */
export function normalizeSettings(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    sfx:   r.sfx   === undefined ? DEFAULT_SETTINGS.sfx   : clampVolume(r.sfx),
    music: r.music === undefined ? DEFAULT_SETTINGS.music : clampVolume(r.music),
    muted: r.muted === true,
  };
}

function defaultStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** Read settings; defaults on missing / corrupt / blocked storage. */
export function loadSettings(storage = defaultStorage()) {
  try {
    const raw = storage?.getItem(SETTINGS_KEY);
    return normalizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeSettings(null);
  }
}

/** Write settings (normalized). Returns what was saved. */
export function saveSettings(settings, storage = defaultStorage()) {
  const s = normalizeSettings(settings);
  try { storage?.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
  return s;
}

/** Effective bus levels (mute zeroes both). */
export function busLevels(settings) {
  const s = normalizeSettings(settings);
  return { sfx: s.muted ? 0 : s.sfx, music: s.muted ? 0 : s.music };
}
