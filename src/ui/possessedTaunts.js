/**
 * src/ui/possessedTaunts.js — possessed CRT taunts (render/text only).
 *
 * Strings mirror .kiro/steering/possessed-taunts.md word for word.
 * The machine is deterministic: it only reads the `nowMs` values passed in.
 * Pure ES module: no DOM at load, only the ctx passed to drawPossessedTaunt.
 */

export const TAUNTS = Object.freeze({
  spawn: Object.freeze([
    'Nice build. Did a toddler pick it?',
    'I\'ve haunted toasters scarier than you.',
    'Oh good. Spare parts delivered.',
    'Your loadout is a cry for help.',
  ]),
  windup: Object.freeze([
    'Hold still. This won\'t hurt me.',
    'Smile for the afterlife.',
    'Dodge this, scrap metal.',
    'Counting down your warranty...',
  ]),
  death: Object.freeze([
    'I\'ll haunt your save file.',
    'Lucky. I was lagging.',
    'Tell the garage... I was robbed.',
    'This isn\'t over. I\'m literally a ghost.',
  ]),
});

export const WINDUP_COOLDOWN_MS = 8000;
export const TYPE_MS_PER_CHAR = 32;
export const HOLD_MS = 2000;
export const FADE_MS = 300;
export const DEMO_SPAWN = TAUNTS.spawn[0];
export const DEMO_DEATH = TAUNTS.death[0];

/** True when the URL search string asks for the deterministic demo lines. */
export function isDemoTaunts(search) {
  const s = typeof search === 'string' ? search : '';
  const p = new URLSearchParams(s.startsWith('?') ? s.slice(1) : s);
  return p.get('demo') === '1' || p.get('taunts') === 'demo' || p.get('seed') === 'demo';
}

/** @param {'spawn'|'windup'|'death'} kind */
export function pickTaunt(kind, rng = Math.random) {
  const list = TAUNTS[kind];
  if (!list || list.length === 0) return '';
  const r = Number(rng());
  const i = Math.min(list.length - 1, Math.max(0, Math.floor((Number.isFinite(r) ? r : 0) * list.length)));
  return list[i];
}

/**
 * @param {{demo?:boolean, rng?:()=>number}} [o]
 */
export function createTauntMachine({ demo = false, rng = Math.random } = {}) {
  let line = null;          // { text, startMs }
  let lastWindup = -Infinity;
  let now = 0;

  function start(text, nowMs) {
    line = { text, startMs: nowMs };
    now = nowMs;
  }

  return {
    reset() { line = null; lastWindup = -Infinity; now = 0; },
    onSpawn(nowMs) { start(demo ? DEMO_SPAWN : pickTaunt('spawn', rng), nowMs); },
    onWindup(nowMs) {
      if (nowMs - lastWindup < WINDUP_COOLDOWN_MS) return;
      lastWindup = nowMs;
      start(pickTaunt('windup', rng), nowMs);
    },
    onDeath(nowMs) { start(demo ? DEMO_DEATH : pickTaunt('death', rng), nowMs); },
    tick(nowMs) { now = nowMs; },
    /** @returns {null | {text:string, typed:string, alpha:number}} */
    current() {
      if (!line) return null;
      const e = now - line.startMs;
      if (e < 0) return null;
      const typeMs = line.text.length * TYPE_MS_PER_CHAR;
      const total = typeMs + HOLD_MS + FADE_MS;
      if (e >= total) return null;
      const n = Math.min(line.text.length, Math.floor(e / TYPE_MS_PER_CHAR) + 1);
      const fadeT = e - typeMs - HOLD_MS;
      const alpha = fadeT > 0 ? Math.max(0, 1 - fadeT / FADE_MS) : 1;
      return { text: line.text, typed: line.text.slice(0, n), alpha };
    },
  };
}

/**
 * Screen-space draw. The line is laid out from its FULL width so typing never
 * jitters, and clamped inside the canvas so it fits a 390-wide view.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{text:string,typed:string,alpha:number}|null} line
 * @param {{x:number,y:number,scale?:number}} pos  anchor (text centre / baseline)
 */
export function drawPossessedTaunt(ctx, line, pos) {
  if (!line || !line.typed) return;
  const scale = pos.scale > 0 ? pos.scale : 1;
  const px = Math.max(14, Math.round(14 * scale));
  ctx.save();
  ctx.font = `${px}px "Share Tech Mono", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const fullW = typeof ctx.measureText === 'function'
    ? (ctx.measureText(line.text)?.width ?? line.text.length * px * 0.6)
    : line.text.length * px * 0.6;
  const viewW = ctx.canvas?.width ?? Infinity;
  const margin = 8 * scale;
  let x = pos.x - fullW / 2;
  if (Number.isFinite(viewW)) x = Math.min(x, viewW - margin - fullW);
  x = Math.max(margin, x);
  const y = Math.max(px + margin, pos.y);
  ctx.globalAlpha = Math.max(0, Math.min(1, line.alpha));
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0A0D0B';
  ctx.strokeText(line.typed, x, y);
  ctx.fillStyle = '#9FD8FF';
  ctx.fillText(line.typed, x, y);
  ctx.restore();
}
