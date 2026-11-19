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

/** Phosphor green — player-spoken lines. */
export const TAUNT_COLOR_PLAYER = '#39FF88';
/** Blood red — HOUND-spoken lines. */
export const TAUNT_COLOR_HOUND = '#FF4D5E';

/**
 * Who says this kind of line. Current bank is all HOUND; player is reserved
 * for future ally / victory quips.
 * @param {string} kind
 * @returns {'hound'|'player'}
 */
export function tauntSpeaker(kind) {
  if (kind === 'playerQuip') return 'player';
  return 'hound';
}

/** Fill colour for a speaker. */
export function tauntColor(speaker) {
  return speaker === 'player' ? TAUNT_COLOR_PLAYER : TAUNT_COLOR_HOUND;
}

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

  function start(text, nowMs, speaker = 'hound') {
    line = { text, startMs: nowMs, speaker: speaker === 'player' ? 'player' : 'hound' };
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
    start(pickTaunt(kind, rng), nowMs, tauntSpeaker(kind));
  }

  function onEnemyDeath(nowMs) {
    start(demo ? DEMO_DEATH : pickTaunt('enemyDeath', rng), nowMs, tauntSpeaker('enemyDeath'));
  }

  return {
    reset() { line = null; lastWindup = -Infinity; lowHpFired = false; now = 0; },
    onSpawn(nowMs) { start(demo ? DEMO_SPAWN : pickTaunt('spawn', rng), nowMs, tauntSpeaker('spawn')); },
    onWindup(nowMs) { rateLimited('windup', nowMs); },
    onHit(nowMs) { rateLimited('hit', nowMs); },
    onLowHp(nowMs) {
      if (lowHpFired) return;
      lowHpFired = true;
      start(pickTaunt('lowHp', rng), nowMs, tauntSpeaker('lowHp'));
    },
    onEnemyDeath,
    onDeath: onEnemyDeath,
    onPlayerDeath(nowMs, specLine) {
      const text = typeof specLine === 'string' && specLine.length > 0
        ? specLine
        : pickTaunt('playerDeath', rng);
      start(text, nowMs, tauntSpeaker('playerDeath'));
    },
    tick(nowMs) { now = nowMs; },
    /** @returns {null | {text:string, typed:string, alpha:number, speaker:'hound'|'player', color:string}} */
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
      const speaker = line.speaker === 'player' ? 'player' : 'hound';
      return { text: line.text, typed: line.text.slice(0, n), alpha, speaker, color: tauntColor(speaker) };
    },
  };
}

/** Top of the enemy's HOUND/HP label above its centre, in world units: bar
 * offset 32 + bar 12 + 2 px gap + 12 px text (combatRenderer drawHPBar). */
export const ENEMY_LABEL_TOP_WU = 58;

/**
 * Legacy baseline y (screen px) above the enemy's old over-mech HP label.
 * Kept for unit tests and end-card fallback; in-fight draw uses
 * {@link tauntUnderLineY} (layout C: under the green HUD / arena line).
 *
 * @param {{enemyY:number, zoom:number, scale?:number, vpH:number, insetTop?:number}} o
 * @returns {number}
 */
export function tauntBaselineY({ enemyY, zoom, scale = 1, vpH, insetTop = 0, labelTopWu = ENEMY_LABEL_TOP_WU }) {
  const s = scale > 0 ? scale : 1;
  const px = Math.max(14, Math.round(14 * s));
  const gap = 8 * s;
  const minTop = (8 + insetTop) * s + px + gap;
  const above = enemyY - labelTopWu * zoom - gap;
  const bottomLimit = vpH - 140 * s;
  if (above >= minTop) return Math.min(above, bottomLimit);
  const below = enemyY + 36 * zoom + px;
  return Math.min(Math.max(below, minTop), bottomLimit);
}

/**
 * Baseline y (screen px) for layout-C in-fight trash talk: just under the
 * green line (phone HUD bottom, or desktop arena top border), centered draw
 * happens at x = vpW/2. Leaves a small gap so glyphs clear the line and the
 * corner meters.
 *
 * @param {{lineBottom:number, scale?:number, gap?:number}} o
 *   `lineBottom` = screen y of the green line's bottom edge.
 * @returns {number} alphabetic baseline
 */
export function tauntUnderLineY({ lineBottom, scale = 1, gap = 6 }) {
  const s = scale > 0 ? scale : 1;
  const px = Math.max(14, Math.round(14 * s));
  const g = (Number.isFinite(gap) ? gap : 6) * s;
  const y0 = Number.isFinite(lineBottom) ? lineBottom : 0;
  return y0 + g + px;
}

/**
 * Screen-space draw. The line is laid out from its FULL width so typing never
 * jitters, and clamped inside the canvas so it fits a 390-wide view.
 * Colour matches the speaking tank (green player / red HOUND). On phone the
 * side margins leave room for the corner meters (~56 CSS px each side).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{text:string,typed:string,alpha:number,speaker?:string,color?:string}|null} line
 * @param {{x:number,y:number,scale?:number,sidePad?:number}} pos  anchor (text centre / baseline)
 */
export function drawPossessedTaunt(ctx, line, pos) {
  if (!line || !line.typed) return;
  const scale = pos.scale > 0 ? pos.scale : 1;
  const px = Math.max(14, Math.round(14 * scale));
  ctx.save();
  ctx.font = `${px}px ${TAUNT_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const hasMeasure = typeof ctx.measureText === 'function';
  let drawPx = px;
  const measure = (t) => (hasMeasure
    ? (ctx.measureText(t)?.width ?? t.length * drawPx * 0.6)
    : t.length * drawPx * 0.6);
  const fullW = measure(line.text);
  const viewW = ctx.canvas?.width ?? Infinity;
  const side = Number.isFinite(pos.sidePad) ? pos.sidePad : 56 * scale;
  const margin = Math.max(8 * scale, side);
  const usable = Number.isFinite(viewW) ? viewW - 2 * margin : Infinity;
  // Too wide: shrink once (floor = 14 CSS px), then wrap if it still will not fit.
  if (fullW > usable && usable > 0) {
    drawPx = Math.max(px, Math.floor(px * usable / fullW));
    ctx.font = `${drawPx}px ${TAUNT_FONT}`;
  }
  const lines = (usable > 0 && hasMeasure && measure(line.text) > usable)
    ? wrapLines(line.text, usable, measure, 3)
    : [{ start: 0, text: line.text }];
  const lineH = Math.round(drawPx * 1.25);
  const y0 = Math.max(drawPx + 8 * scale, pos.y);
  const fill = line.color || tauntColor(line.speaker);
  ctx.globalAlpha = Math.max(0, Math.min(1, line.alpha));
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0A0D0B';
  ctx.fillStyle = fill;
  lines.forEach((ln, i) => {
    const shown = line.typed.slice(ln.start, ln.start + ln.text.length);
    if (!shown) return;
    const w = lines.length === 1 ? fullW : measure(ln.text);
    let x = pos.x - w / 2;
    if (Number.isFinite(viewW)) x = Math.min(x, viewW - margin - w);
    x = Math.max(margin, x);
    const y = y0 + i * lineH;
    ctx.strokeText(shown, x, y);
    ctx.fillText(shown, x, y);
  });
  ctx.restore();
}

/** Canvas font stack for taunts (Orbitron, self-hosted OFL). */
export const TAUNT_FONT = 'Orbitron, "Share Tech Mono", monospace';

/** Greedy word wrap of `text` into at most `maxLines`; returns [{start,text}]. */
function wrapLines(text, maxW, measure, maxLines) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  let curStart = 0;
  let pos = 0;
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && measure(next) > maxW && lines.length < maxLines - 1) {
      lines.push({ start: curStart, text: cur });
      cur = w;
      curStart = pos;
    } else {
      cur = next;
    }
    pos += w.length + 1;
  }
  lines.push({ start: curStart, text: cur });
  return lines;
}
