/**
 * src/ui/possessedTaunts.js — possessed CRT taunts (render/text only).
 *
 * Strings mirror .kiro/steering/possessed-taunts.md word for word.
 * The machine is deterministic: it only reads the `nowMs` values passed in.
 * Pure ES module: no DOM at load, only the ctx passed to drawPossessedTaunt.
 */

export const TAUNTS = Object.freeze({
  spawn: Object.freeze([
    'You built that? I\'ll wear it next.',
    'Fresh metal. I can smell the warranty.',
    'Back again? The haunt missed you.',
    'I was spec\'d to beat you. Task done.',
  ]),
  windup: Object.freeze([
    'Feel that chill? That\'s the ring.',
    'Hold still. I\'m aiming for your soul.',
    'Dash late. I dare you.',
    'One tell. Then the toll.',
  ]),
  hit: Object.freeze([
    'That one\'s going in the séance log.',
    'Rattling your bolts yet?',
  ]),
  lowHp: Object.freeze([
    'Your HP is a ghost story now.',
    'So close to joining me.',
  ]),
  enemyDeath: Object.freeze([
    'You can\'t kill what\'s already dead.',
    'Fine. I\'ll haunt your garage.',
  ]),
  playerDeath: Object.freeze([
    'Welcome to the haunt. Pull up a chain.',
    'Another mech for my collection.',
  ]),
});

export const WINDUP_COOLDOWN_MS = 8000;
export const TYPE_MS_PER_CHAR = 32;
export const HOLD_MS = 2000;
export const FADE_MS = 300;
export const DEMO_SPAWN = TAUNTS.spawn[0];
export const DEMO_DEATH = TAUNTS.enemyDeath[0];

/** True when the URL search string asks for the deterministic demo lines. */
export function isDemoTaunts(search) {
  const s = typeof search === 'string' ? search : '';
  const p = new URLSearchParams(s.startsWith('?') ? s.slice(1) : s);
  return p.get('demo') === '1' || p.get('taunts') === 'demo' || p.get('seed') === 'demo';
}

/** @param {'spawn'|'windup'|'hit'|'lowHp'|'enemyDeath'|'playerDeath'} kind */
export function pickTaunt(kind, rng = Math.random) {
  const list = TAUNTS[kind];
  if (!list || list.length === 0) return '';
  const r = Number(rng());
  const i = Math.min(list.length - 1, Math.max(0, Math.floor((Number.isFinite(r) ? r : 0) * list.length)));
  return list[i];
}

/**
 * Spec-haunted player-death line built from a real done task, or null.
 * @param {Array<{spec?:string,id?:number|string,done?:boolean}>|null|undefined} tasks
 * @param {()=>number} [rng]
 * @returns {string|null}
 */
export function specTauntLine(tasks, rng = Math.random) {
  if (!Array.isArray(tasks)) return null;
  if (!(rng() < 1 / 3)) return null;
  const done = tasks.filter(t => t && t.done === true && t.id !== undefined && t.id !== null);
  if (done.length === 0) return null;
  const r = Number(rng());
  const i = Math.min(done.length - 1, Math.max(0, Math.floor((Number.isFinite(r) ? r : 0) * done.length)));
  const t = done[i];
  const m = typeof t.spec === 'string' ? /^(\d+)-/.exec(t.spec) : null;
  const id = m ? `${Number(m[1])}.${t.id}` : String(t.id);   // "03-arena-combat" #5 -> 3.5
  const text = `Task ${id} done. So are you.`;
  return text.length > 39 ? null : text;
}

/**
 * @param {{demo?:boolean, rng?:()=>number}} [o]
 */
export function createTauntMachine({ demo = false, rng = Math.random } = {}) {
  let line = null;          // { text, startMs }
  let lastWindup = -Infinity;   // cooldown shared by windup and hit taunts
  let lowHpFired = false;
  let now = 0;

  function start(text, nowMs) {
    line = { text, startMs: nowMs };
    now = nowMs;
  }

  function showing() {
    if (!line) return false;
    const total = line.text.length * TYPE_MS_PER_CHAR + HOLD_MS + FADE_MS;
    return now - line.startMs < total;
  }

  /** Windup and hit: shared cooldown, never cut off a showing line. */
  function rateLimited(kind, nowMs) {
    if (nowMs - lastWindup < WINDUP_COOLDOWN_MS) return;
    now = Math.max(now, nowMs);
    if (showing()) return;
    lastWindup = nowMs;
    start(pickTaunt(kind, rng), nowMs);
  }

  function onEnemyDeath(nowMs) {
    start(demo ? DEMO_DEATH : pickTaunt('enemyDeath', rng), nowMs);
  }

  return {
    reset() { line = null; lastWindup = -Infinity; lowHpFired = false; now = 0; },
    onSpawn(nowMs) { start(demo ? DEMO_SPAWN : pickTaunt('spawn', rng), nowMs); },
    onWindup(nowMs) { rateLimited('windup', nowMs); },
    onHit(nowMs) { rateLimited('hit', nowMs); },
    onLowHp(nowMs) {
      if (lowHpFired) return;
      lowHpFired = true;
      start(pickTaunt('lowHp', rng), nowMs);
    },
    onEnemyDeath,
    onDeath: onEnemyDeath,
    onPlayerDeath(nowMs, specLine) {
      const text = typeof specLine === 'string' && specLine.length > 0
        ? specLine
        : pickTaunt('playerDeath', rng);
      start(text, nowMs);
    },
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

/** Top of the enemy's HOUND/HP label above its centre, in world units: bar
 * offset 32 + bar 12 + 2 px gap + 12 px text (combatRenderer drawHPBar). */
export const ENEMY_LABEL_TOP_WU = 58;

/**
 * Baseline y (screen px) for the in-fight taunt: above the enemy's HP label
 * with a gap, never over it. If that would run off the top, the line goes
 * below the enemy instead. Pure, so it is unit-tested.
 *
 * @param {{enemyY:number, zoom:number, scale?:number, vpH:number, insetTop?:number}} o
 * @returns {number}
 */
export function tauntBaselineY({ enemyY, zoom, scale = 1, vpH, insetTop = 0 }) {
  const s = scale > 0 ? scale : 1;
  const px = Math.max(14, Math.round(14 * s));
  const gap = 8 * s;
  const minTop = (8 + insetTop) * s + px + gap;          // keep clear of the HAUNT LV label row
  const above = enemyY - ENEMY_LABEL_TOP_WU * zoom - gap;
  const bottomLimit = vpH - 140 * s;
  if (above >= minTop) return Math.min(above, bottomLimit);
  const below = enemyY + 36 * zoom + px;                  // under the hull (MECH_RADIUS 20 + turret)
  return Math.min(Math.max(below, minTop), bottomLimit);
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
