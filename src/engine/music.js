/**
 * src/engine/music.js — music loops + stings on the music bus (M3).
 *
 * Original tracks by the crew's music bot (see assets/audio/README.md).
 *   - Loops play from an AudioBufferSourceNode with loop = true (sample-exact).
 *     OGG loops the whole buffer; the MP3 fallback (older iOS Safari, no
 *     Vorbis) sets loopStart/loopEnd to the musical length, skipping the
 *     measured leading padding, so the ~24 ms encoder tail never plays.
 *   - Garage ↔ duel crossfade over CROSSFADE_S; stings play once on top.
 *   - Lazy: nothing is fetched before the first gesture; each file is fetched
 *     + decoded once on demand (promise cached).
 *   - Everything routes into audio.js's music gain node, so the M2 music
 *     volume and mute apply.
 *
 * Pure helpers (format choice, loop points, leading silence, transitions) are
 * Node-testable; the runtime part no-ops without Web Audio.
 */

import { audioGraph } from './audio.js';

export const MUSIC_DIR = 'assets/audio/';
export const CROSSFADE_S = 0.3;

/**
 * Musical lengths (seconds) of the loops: whole bars, sample-exact at 48 kHz.
 * The OGGs decode to exactly this; the MP3s run ~24 ms longer.
 */
export const LOOP_LENGTH_S = Object.freeze({
  garage: 76.8,   // 32 bars @ 100 BPM = 3,686,400 samples
  duel:   75.0,   // 40 bars @ 128 BPM = 3,600,000 samples
});

/** Track id → file stem. Loops are in LOOP_LENGTH_S; the rest are stings. */
export const TRACKS = Object.freeze({
  garage:  'garage-loop',
  duel:    'duel-loop',
  title:   'title-sting',
  victory: 'victory-sting',
  defeat:  'defeat-sting',
});

/** Delay before the garage loop fades in under the title sting (hit at 0.8 s). */
export const TITLE_STING_LEAD_S = 1.4;

/**
 * Pick OGG when Vorbis is playable, else MP3.
 * @param {(type:string)=>string} canPlayType
 * @returns {'ogg'|'mp3'}
 */
export function chooseMusicFormat(canPlayType) {
  try {
    const r = typeof canPlayType === 'function' ? canPlayType('audio/ogg; codecs="vorbis"') : '';
    return r ? 'ogg' : 'mp3';
  } catch {
    return 'mp3';
  }
}

/** Relative URL for a track in a format. */
export function trackUrl(id, fmt) {
  return `${MUSIC_DIR}${TRACKS[id]}.${fmt}`;
}

/**
 * Seconds of leading near-silence (encoder padding) in decoded samples.
 * Scans at most `maxS`; anything louder than `threshold` ends the scan.
 */
export function leadingSilenceS(samples, sampleRate, { threshold = 1e-4, maxS = 0.1 } = {}) {
  if (!samples || !sampleRate) return 0;
  const max = Math.min(samples.length, Math.floor(maxS * sampleRate));
  for (let i = 0; i < max; i++) {
    if (Math.abs(samples[i]) > threshold) return i / sampleRate;
  }
  return max / sampleRate;
}

/**
 * Loop points for a decoded loop buffer.
 * OGG: whole buffer ({0, 0} = Web Audio's "loop the entire buffer").
 * MP3: [lead, lead + musical length], clamped inside the buffer.
 */
export function loopPoints(fmt, id, bufferDurationS, leadS = 0) {
  const len = LOOP_LENGTH_S[id];
  if (fmt !== 'mp3' || !len) return { loopStart: 0, loopEnd: 0 };
  const start = Math.max(0, leadS);
  const end = Math.min(bufferDurationS, start + len);
  return { loopStart: start, loopEnd: end };
}

/**
 * Scene → music. Pure transition: what to start / stop / sting.
 * Scenes: 'title' | 'title-go' | 'garage' | 'duel' | 'win' | 'lose'.
 * @returns {{loop:string|null, sting:string|null, delayS:number}}
 */
export function musicTransition(currentLoop, scene) {
  switch (scene) {
    case 'title':    return { loop: null, sting: null, delayS: 0 };
    case 'title-go': return { loop: 'garage', sting: 'title', delayS: TITLE_STING_LEAD_S };
    case 'garage':   return { loop: 'garage', sting: null, delayS: 0 };
    case 'duel':     return { loop: 'duel', sting: null, delayS: 0 };
    case 'win':      return { loop: null, sting: 'victory', delayS: 0 };
    case 'lose':     return { loop: null, sting: 'defeat', delayS: 0 };
    default:         return { loop: currentLoop, sting: null, delayS: 0 };
  }
}

// ── Runtime (browser only) ───────────────────────────────────────────────────

const cache = new Map();   // id → Promise<{buffer, lead}>
let format = null;
let current = null;        // { id, src, gain }
let wanted = null;         // loop id we want playing (null = silence)
let epoch = 0;             // bumps on every cue; stale async starts bail

function log(ev, name, extra = {}) {
  const l = globalThis.__HH_MUSIC_LOG__;
  if (Array.isArray(l)) l.push({ ev, name, fmt: format, t: Math.round(performance.now()), ...extra });
}

function fmt() {
  if (!format) {
    const a = typeof document !== 'undefined' ? document.createElement('audio') : null;
    format = chooseMusicFormat(a && a.canPlayType ? a.canPlayType.bind(a) : null);
  }
  return format;
}

function decode(ctx, data) {
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(data, resolve, reject);   // callback form for old Safari
    if (p && typeof p.then === 'function') p.then(resolve, reject);
  });
}

/** Fetch + decode a track once. */
export function loadTrack(id) {
  const { ctx } = audioGraph();
  if (!ctx || !TRACKS[id] || typeof fetch !== 'function') return Promise.resolve(null);
  if (!cache.has(id)) {
    const f = fmt();
    const url = trackUrl(id, f);
    const p = fetch(url)
      .then(r => { if (!r.ok) throw new Error(`${url} ${r.status}`); return r.arrayBuffer(); })
      .then(data => decode(ctx, data))
      .then(buffer => {
        const lead = f === 'mp3' && LOOP_LENGTH_S[id] ? leadingSilenceS(buffer.getChannelData(0), buffer.sampleRate) : 0;
        log('decoded', id, { dur: +buffer.duration.toFixed(3), lead: +lead.toFixed(4) });
        return { buffer, lead };
      })
      .catch(err => { cache.delete(id); log('error', id, { msg: String(err && err.message || err) }); return null; });
    cache.set(id, p);
  }
  return cache.get(id);
}

function fadeOutCurrent(ctx, t) {
  if (!current) return;
  const { src, gain, id } = current;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.linearRampToValueAtTime(0, t + CROSSFADE_S);
  try { src.stop(t + CROSSFADE_S + 0.05); } catch { /* already stopped */ }
  log('fadeout', id);
  current = null;
}

function startLoop(ctx, bus, id, track, delayS) {
  const t = ctx.currentTime + delayS;
  const src = ctx.createBufferSource();
  src.buffer = track.buffer;
  src.loop = true;
  const lp = loopPoints(format, id, track.buffer.duration, track.lead);
  src.loopStart = lp.loopStart;
  src.loopEnd = lp.loopEnd;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(1, t + CROSSFADE_S);
  src.connect(gain).connect(bus);
  src.start(t, lp.loopStart);
  current = { id, src, gain };
  log('loop', id, { loopStart: lp.loopStart, loopEnd: lp.loopEnd, delayS });
}

function playSting(ctx, bus, id) {
  loadTrack(id).then(track => {
    if (!track) return;
    const src = ctx.createBufferSource();
    src.buffer = track.buffer;
    src.connect(bus);
    src.start();
    log('sting', id);
  });
}

/**
 * Cue a scene ('title-go' | 'garage' | 'duel' | 'win' | 'lose'). Safe no-op
 * before audio is unlocked.
 */
export function cueMusic(scene) {
  const { ctx, music: bus } = audioGraph();
  if (!ctx || !bus) return false;
  const tr = musicTransition(wanted, scene);
  if (tr.sting) playSting(ctx, bus, tr.sting);
  if (tr.loop === wanted) return true;   // already playing or loading
  const my = ++epoch;
  wanted = tr.loop;
  if (!wanted) { fadeOutCurrent(ctx, ctx.currentTime); return true; }
  const id = wanted;
  loadTrack(id).then(track => {
    if (my !== epoch || wanted !== id) return;
    if (!track) { wanted = null; return; }   // failed: allow a retry on the next cue
    fadeOutCurrent(ctx, ctx.currentTime);
    startLoop(ctx, bus, id, track, tr.delayS);
    // Warm the rest in the background once the first loop is playing.
    for (const other of Object.keys(TRACKS)) loadTrack(other);
  });
  return true;
}

/** Debug / proof: what the music side thinks is playing. */
export function musicState() {
  return { format, wanted, playing: current ? current.id : null, cached: [...cache.keys()] };
}
