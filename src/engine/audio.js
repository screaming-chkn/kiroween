/**
 * src/engine/audio.js — HAUNT//HOUND audio buses (R4).
 *
 * Three independent channels ("buses"): music, SFX and static. Each carries a
 * volume in [0, 1]. Nothing plays until a user gesture (no autoplay): the
 * loopable music bed is started from the first Deploy / user gesture via
 * playMusicBed().
 *
 * Design goals:
 *   - Minimal surface: setBusVolume / getBusVolume / playMusicBed /
 *     stopMusicBed / playSfx.
 *   - Node-safe: the volume math (clampVolume) and bus identity (BUSES,
 *     isBus) are pure and importable under Node for tests. No browser globals
 *     are touched at import time.
 *   - Graceful degradation: if neither Web Audio nor HTMLAudioElement is
 *     available (e.g. under Node), playback calls become safe no-ops and the
 *     bus volumes still update so settings UI keeps working.
 *
 * Music bed asset is referenced by a RELATIVE path only (never an absolute
 * machine path) so it resolves correctly on Cloudflare Pages.
 *
 * ES modules only; no external dependencies.
 */

// ── Bus identity (pure, Node-safe) ───────────────────────────────────────────

/** Canonical bus names. */
export const BUSES = Object.freeze({
  MUSIC:  'music',
  SFX:    'sfx',
  STATIC: 'static',
});

/** All valid bus ids as a plain array. */
export const BUS_IDS = Object.freeze([BUSES.MUSIC, BUSES.SFX, BUSES.STATIC]);

/** True when `bus` is a recognised bus id. */
export function isBus(bus) {
  return BUS_IDS.indexOf(bus) !== -1;
}

// ── Volume math (pure, Node-safe) ─────────────────────────────────────────────

/**
 * Clamp an arbitrary value to a valid bus volume in [0, 1].
 * Non-finite / non-numeric input falls back to 0 (mute-safe).
 *
 * @param {number} v
 * @returns {number} volume in [0, 1]
 */
export function clampVolume(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

// ── Music bed asset (relative path only) ─────────────────────────────────────

/** Loopable music bed. Relative so it resolves on the deployed site. */
export const MUSIC_BED_SRC = 'assets/audio/haunt-hound-loop.wav';

// ── Bus state ─────────────────────────────────────────────────────────────────

/** Per-bus volumes. Default music/sfx audible, static subtle. */
const busVolume = {
  [BUSES.MUSIC]:  0.6,
  [BUSES.SFX]:    0.8,
  [BUSES.STATIC]: 0.3,
};

/** Lazily-created HTMLAudioElement for the looping music bed, or null. */
let musicEl = null;

/** Whether a user gesture has started the music bed. */
let musicStarted = false;

// ── Environment probe ─────────────────────────────────────────────────────────

/** True when an HTMLAudioElement can be constructed (browser only). */
function audioAvailable() {
  return typeof document !== 'undefined' &&
    typeof document.createElement === 'function';
}

// ── Public: volume controls ───────────────────────────────────────────────────

/**
 * Set a bus volume. Clamps to [0, 1]; unknown buses are ignored.
 * Applies live to the music bed element if it exists.
 *
 * @param {string} bus  one of BUSES.*
 * @param {number} v    target volume
 * @returns {number} the applied (clamped) volume, or current music volume if
 *                   the bus is unknown.
 */
export function setBusVolume(bus, v) {
  if (!isBus(bus)) return getBusVolume(BUSES.MUSIC);
  const vol = clampVolume(v);
  busVolume[bus] = vol;
  if (bus === BUSES.MUSIC && musicEl) {
    musicEl.volume = vol;
  }
  return vol;
}

/**
 * Get a bus volume. Unknown buses report 0.
 *
 * @param {string} bus  one of BUSES.*
 * @returns {number} volume in [0, 1]
 */
export function getBusVolume(bus) {
  if (!isBus(bus)) return 0;
  return busVolume[bus];
}

// ── Public: music bed ──────────────────────────────────────────────────────────

/**
 * Start the looping music bed. Safe to call from a user gesture (Deploy).
 * No-op when audio is unavailable (e.g. Node) or already started.
 *
 * @returns {boolean} true if playback was (re)started, false otherwise.
 */
export function playMusicBed() {
  if (!audioAvailable()) return false;

  if (!musicEl) {
    musicEl = document.createElement('audio');
    musicEl.src    = MUSIC_BED_SRC;
    musicEl.loop   = true;
    musicEl.volume = busVolume[BUSES.MUSIC];
    musicEl.preload = 'auto';
  }

  // Resume from wherever it is; play() is a gesture-safe promise in browsers.
  const p = musicEl.play();
  if (p && typeof p.catch === 'function') {
    // Swallow autoplay-policy rejections so callers never see an error.
    p.catch(() => {});
  }
  musicStarted = true;
  return true;
}

/**
 * Stop the music bed and rewind to the start. No-op if never started.
 */
export function stopMusicBed() {
  if (!musicEl) return;
  if (typeof musicEl.pause === 'function') musicEl.pause();
  try {
    musicEl.currentTime = 0;
  } catch {
    // Some engines throw if media isn't seekable yet — ignore.
  }
  musicStarted = false;
}

/** True once the music bed has been started by a user gesture. */
export function isMusicStarted() {
  return musicStarted;
}

// ── Public: SFX (stub) ─────────────────────────────────────────────────────────

/**
 * Play a one-shot sound effect on the SFX bus.
 *
 * Stub: no sample bank wired yet. Returns whether playback could occur so
 * callers can branch, but does no work beyond honoring the SFX bus volume /
 * availability. Expand with a real sample map later (no ducking / playlists).
 *
 * @param {string} name  logical SFX id
 * @returns {boolean} true if audio could play, false if muted/unavailable.
 */
export function playSfx(name) {
  if (!audioAvailable()) return false;
  if (busVolume[BUSES.SFX] <= 0) return false;
  // Intentional stub: no sample bank yet. `name` reserved for future map.
  void name;
  return true;
}
