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
 *     stopMusicBed / unlockAudio / installAudioGestures / playSfx. SFX are synthesised with Web
 *     Audio (no sample files). Persistence lives in engine/settings.js.
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
  if (bus === BUSES.SFX) {
    if (sfxGain) sfxGain.gain.value = vol;
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

// ── Public: SFX (Web Audio synth) ──────────────────────────────────────────────

/**
 * Logical SFX ids. Every sound is synthesised on the fly with Web Audio
 * (oscillators + a shared noise buffer + gain envelopes), so there are no
 * audio files to load.
 */
export const SFX = Object.freeze({
  PLAYER_SHOT: 'playerShot',
  ENEMY_SHOT:  'enemyShot',
  HIT_ENEMY:   'hitEnemy',
  HIT_PLAYER:  'hitPlayer',
  DASH:        'dash',
  WINDUP:      'windup',
  EXPLODE:     'explode',
  UI_CLICK:    'uiClick',
});

/**
 * Minimum gap (ms) between two plays of the same SFX. Keeps rapid repeats
 * (300 ms player fire, multi-hit ticks) from stacking into noise.
 */
export const SFX_THROTTLE_MS = Object.freeze({
  playerShot: 90,
  enemyShot:  90,
  hitEnemy:   70,
  hitPlayer:  120,
  dash:       150,
  windup:     300,
  explode:    600,
  uiClick:    60,
});

/**
 * Pure throttle gate. Returns true (and stamps `last[name]`) when `name` may
 * play at `nowMs`; false when it played less than its throttle window ago.
 *
 * @param {Object<string, number>} last  mutable map name → last play ms
 * @param {string} name
 * @param {number} nowMs
 * @returns {boolean}
 */
export function sfxThrottleGate(last, name, nowMs) {
  const gap = SFX_THROTTLE_MS[name] ?? 60;
  const prev = last[name];
  if (prev !== undefined && nowMs - prev < gap) return false;
  last[name] = nowMs;
  return true;
}

/**
 * Rough voice length (s) per SFX, used only by the voice cap below.
 */
export const SFX_DURATION_S = Object.freeze({
  playerShot: 0.11,
  enemyShot:  0.16,
  hitEnemy:   0.09,
  hitPlayer:  0.20,
  dash:       0.21,
  windup:     0.43,
  explode:    0.79,
  uiClick:    0.06,
});

/** Max SFX sounding at once. Keeps phones from choking on node graphs. */
export const MAX_SFX_VOICES = 6;

/**
 * Pure voice-cap gate. `ends` is a mutable array of end times (s) for voices
 * still sounding. Prunes finished ones; returns true (and records the new
 * voice) when under `cap`, false when full.
 *
 * @param {number[]} ends
 * @param {number} nowS
 * @param {number} durS
 * @param {number} [cap]
 * @returns {boolean}
 */
export function voiceCapGate(ends, nowS, durS, cap = MAX_SFX_VOICES) {
  for (let i = ends.length - 1; i >= 0; i--) if (ends[i] <= nowS) ends.splice(i, 1);
  if (ends.length >= cap) return false;
  ends.push(nowS + durS);
  return true;
}

const sfxLast = {};
const voiceEnds = [];
let actx = null;      // AudioContext, created on the first user gesture
let sfxGain = null;   // SFX bus gain node
let noiseBuf = null;  // 1 s of white noise, shared by noisy voices

function audioCtxCtor() {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

/**
 * Create / resume the AudioContext. Call from a user gesture (Deploy, first
 * key or tap). Safe no-op without Web Audio.
 *
 * @returns {boolean} true when a context exists.
 */
export function unlockAudio() {
  const Ctor = audioCtxCtor();
  if (!Ctor) return false;
  try {
    if (!actx) {
      actx = new Ctor();
      sfxGain = actx.createGain();
      sfxGain.gain.value = busVolume[BUSES.SFX];
      sfxGain.connect(actx.destination);
      const len = Math.floor(actx.sampleRate);
      noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    // iOS: playing a 1-sample silent buffer inside the gesture unlocks output.
    try {
      const b = actx.createBufferSource();
      b.buffer = actx.createBuffer(1, 1, actx.sampleRate);
      b.connect(actx.destination);
      b.start(0);
    } catch { /* ignore */ }
    if (actx.state === 'suspended' && typeof actx.resume === 'function') {
      const p = actx.resume();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
    return true;
  } catch {
    actx = null;
    return false;
  }
}

// ── Voice helpers ──
function env(g, t, peak, attack, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(t, { type = 'square', f0, f1, peak, attack = 0.004, decay, lp = 0 }) {
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + attack + decay);
  env(g, t, peak, attack, decay);
  let node = o;
  if (lp) {
    const f = actx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lp;
    o.connect(f);
    node = f;
  }
  node.connect(g).connect(sfxGain);
  o.start(t);
  o.stop(t + attack + decay + 0.03);
  return o;
}

function noise(t, { type = 'bandpass', f0, f1, q = 1, peak, attack = 0.003, decay }) {
  const s = actx.createBufferSource();
  s.buffer = noiseBuf;
  const f = actx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + attack + decay);
  const g = actx.createGain();
  env(g, t, peak, attack, decay);
  s.connect(f).connect(g).connect(sfxGain);
  s.start(t);
  s.stop(t + attack + decay + 0.03);
}

/** Recipes: short, punchy, low-passed "haunted CRT" voices. */
const RECIPES = {
  // Clipped phosphor zap, falling pitch.
  playerShot(t) {
    tone(t, { type: 'square', f0: 900, f1: 260, peak: 0.12, decay: 0.07, lp: 2600 });
  },
  // Lower, buzzier, darker bolt so it reads as "theirs".
  enemyShot(t) {
    tone(t, { type: 'sawtooth', f0: 320, f1: 90, peak: 0.13, decay: 0.12, lp: 1400 });
  },
  // Bright tick + crunch: you landed one.
  hitEnemy(t) {
    noise(t, { f0: 2400, q: 1.2, peak: 0.16, decay: 0.045 });
    tone(t, { type: 'triangle', f0: 1400, f1: 700, peak: 0.08, decay: 0.05 });
  },
  // Heavy low thud: you got hit.
  hitPlayer(t) {
    tone(t, { type: 'sine', f0: 150, f1: 45, peak: 0.35, decay: 0.16 });
    noise(t, { type: 'lowpass', f0: 900, f1: 200, peak: 0.18, decay: 0.12 });
  },
  // Rising airy whoosh.
  dash(t) {
    noise(t, { f0: 450, f1: 2600, q: 2, peak: 0.14, attack: 0.02, decay: 0.16 });
  },
  // Enemy windup TELL: a warbling two-tone siren that climbs over ~0.4 s and
  // ends right as the shot leaves (ENEMY_SHOT_WINDUP_MS = 450). The rising
  // pitch is the cue: dash when it peaks.
  windup(t) {
    const dur = 0.4;
    const o = actx.createOscillator();
    const lfo = actx.createOscillator();
    const lfoGain = actx.createGain();
    const g = actx.createGain();
    const f = actx.createBiquadFilter();
    o.type = 'square';
    o.frequency.setValueAtTime(330, t);
    o.frequency.exponentialRampToValueAtTime(990, t + dur);
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(14, t);
    lfo.frequency.linearRampToValueAtTime(26, t + dur);
    lfoGain.gain.value = 60;            // ±60 Hz two-tone warble
    lfo.connect(lfoGain).connect(o.frequency);
    f.type = 'lowpass';
    f.frequency.value = 2200;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.03);
    g.gain.linearRampToValueAtTime(0.13, t + dur - 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(sfxGain);
    o.start(t); lfo.start(t);
    o.stop(t + dur + 0.03); lfo.stop(t + dur + 0.03);
  },
  // Kill / death: falling filtered noise boom + sub drop.
  explode(t) {
    noise(t, { type: 'lowpass', f0: 2400, f1: 120, q: 0.8, peak: 0.35, attack: 0.005, decay: 0.75 });
    tone(t, { type: 'sine', f0: 110, f1: 30, peak: 0.35, decay: 0.6 });
  },
  // Tiny CRT click for garage buttons.
  uiClick(t) {
    tone(t, { type: 'triangle', f0: 1500, f1: 1100, peak: 0.06, attack: 0.002, decay: 0.03 });
  },
};

/**
 * Wire the first user gesture (tap, click or key) on `target` to
 * unlockAudio(), and give every DOM button / option a UI click. Call once at
 * boot. No-op without addEventListener.
 *
 * @param {EventTarget} target  usually document
 */
export function installAudioGestures(target) {
  if (!target || typeof target.addEventListener !== 'function') return;
  const unlock = () => {
    if (unlockAudio() && actx.state === 'running') {
      for (const ev of ['pointerdown', 'touchend', 'keydown']) {
        target.removeEventListener(ev, unlock, true);
      }
    }
  };
  for (const ev of ['pointerdown', 'touchend', 'keydown']) {
    target.addEventListener(ev, unlock, true);
  }
  target.addEventListener('click', (e) => {
    const el = e.target;
    if (el && typeof el.closest === 'function' &&
        el.closest('button, [role="button"], [role="option"]')) {
      playSfx(SFX.UI_CLICK);
    }
  });
}

/** Debug hook: when `globalThis.__HH_SFX_LOG__` is an array, each call is pushed. */
function debugLog(name, played) {
  const log = globalThis.__HH_SFX_LOG__;
  if (Array.isArray(log)) log.push({ name, played, t: Date.now() });
}

/**
 * Play a one-shot sound effect on the SFX bus.
 *
 * Throttled per name (SFX_THROTTLE_MS). Safe no-op (returns false) when Web
 * Audio is unavailable, the context has not been unlocked by a gesture yet,
 * the SFX bus is muted, the name is unknown, or it is throttled.
 *
 * @param {string} name  one of SFX.*
 * @returns {boolean} true if the sound was scheduled.
 */
export function playSfx(name) {
  let played = false;
  // Only once the context is actually running: while it is still suspended
  // (iOS, first frames after the unlock) currentTime is frozen, which used to
  // stamp the throttle + fill the voice cap and drop the first shots.
  if (actx && sfxGain && actx.state === 'running' && RECIPES[name] && busVolume[BUSES.SFX] > 0 &&
      sfxThrottleGate(sfxLast, name, actx.currentTime * 1000) &&
      voiceCapGate(voiceEnds, actx.currentTime, SFX_DURATION_S[name])) {
    try {
      RECIPES[name](actx.currentTime + 0.005);
      played = true;
    } catch { played = false; }
  }
  debugLog(name, played);
  return played;
}
