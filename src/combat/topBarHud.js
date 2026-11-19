/**
 * src/combat/topBarHud.js — full-width fight strip ABOVE the arena's green line.
 *
 * Cells, left to right: player HP (phosphor green), EN, POWER, READY (weapon
 * cooldown ring), centred fight TIMER (MM:SS counting up), HOUND HP (red),
 * HAUNT LV. 1v1 has no radar, so there is no radar cell. The DOM pause button
 * (.hh-pause-btn) sits in the top-right corner of the strip on touch devices;
 * `pauseReserve` keeps the cells clear of it.
 *
 * Layout and text are pure (Node-testable); drawTopBarHud only paints.
 * Font: Orbitron (self-hosted, SIL OFL). Frames are dotted phosphor.
 */
import {
  formatHudStat, powerStateLabel, isPowerStutter, cooldownReadyFraction,
  powerPulseAlpha, stutterRingFraction,
} from './hud.js';
import { FIRE_COOLDOWN_MS } from './config.js';
import { formatHauntLabel } from '../ui/hauntLevel.js';

export const TOP_BAR_FONT = 'Orbitron, "Share Tech Mono", monospace';
/** Player HP numbers: phosphor green. HOUND HP numbers: blood red. */
export const TOP_BAR_HP_PLAYER_COLOR = '#39FF88';
export const TOP_BAR_HP_HOUND_COLOR = '#FF4D5E';
export const TOP_BAR_FRAME = '#1F9E57';   // phosphor-dim dotted cell frames
/** Cell order, left to right. */
export const TOP_BAR_ORDER = Object.freeze(['hp', 'en', 'power', 'ready', 'timer', 'hound', 'lv']);

const C = { void: '#0A0D0B', bone: '#E8E2D0', ash: '#8F9A92', ember: '#FF8A3D',
  ghost: '#9FD8FF', phosphor: '#39FF88', phosphorDim: '#1F9E57' };

/** CSS-px metrics (multiplied by `scale`). */
export const TOP_BAR = Object.freeze({
  rowH: 36,          // desktop single row
  narrowRow0H: 40,   // phone row 1 (pause button lives here)
  narrowRow1H: 34,
  narrowBelowW: 720, // CSS px width under which the strip uses two rows
  padX: 12,
  narrowPadX: 8,
  gap: 6,
  fontPx: 14,        // accessibility rule 8: text >= 14px
  timerPx: 18,
  timerW: 104,
  narrowTimerW: 84,
  pauseReserve: 48,  // CSS px kept clear for the DOM pause button
});

/**
 * MM:SS count-up clock for the fight timer. Whole seconds, zero-padded,
 * minutes keep counting past 99. Bad input reads 00:00.
 * @param {number} ms
 * @returns {string}
 */
export function formatFightClock(ms) {
  const n = Number(ms);
  const total = Number.isFinite(n) && n > 0 ? Math.floor(n / 1000) : 0;
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/** True when the strip should use the two-row phone layout. */
export function isNarrowTopBar(vpW, scale = 1) {
  const s = scale > 0 ? scale : 1;
  return vpW / s < TOP_BAR.narrowBelowW;
}

/**
 * Text and colour for every cell, in TOP_BAR_ORDER (pure).
 * @param {{player?:object, enemy?:object, elapsedMs?:number}} state
 * @param {{hauntLv?:number, narrow?:boolean}} [opts]
 */
export function topBarCells(state, opts = {}) {
  const narrow = opts.narrow === true;
  const p = state?.player ?? {};
  const e = state?.enemy ?? {};
  const balance = p.powerBalance ?? 0;
  const stutter = isPowerStutter(balance);
  const ready = cooldownReadyFraction(p.fireCooldown ?? 0, FIRE_COOLDOWN_MS) >= 1;
  const hp = formatHudStat(Math.ceil(p.hp ?? 0), p.maxHp ?? 0);
  const ehp = formatHudStat(Math.ceil(e.hp ?? 0), e.maxHp ?? 0);
  const lv = formatHauntLabel(opts.hauntLv ?? 1);
  return [
    { id: 'hp', text: narrow ? hp : `HP ${hp}`, color: TOP_BAR_HP_PLAYER_COLOR },
    { id: 'en', text: `EN ${formatHudStat(p.energy ?? 0, p.maxEnergy ?? 0)}`, color: C.ghost },
    { id: 'power', text: narrow && stutter ? powerStateLabel(balance) : `POWER ${powerStateLabel(balance)}`,
      color: stutter ? C.ember : C.bone, stutter },
    { id: 'ready', text: ready ? 'READY' : 'RELOAD', color: ready ? C.phosphor : C.ember, ready },
    { id: 'timer', text: formatFightClock(state?.elapsedMs ?? 0), color: C.bone },
    { id: 'hound', text: narrow ? ehp : `HOUND ${ehp}`, color: TOP_BAR_HP_HOUND_COLOR },
    { id: 'lv', text: narrow ? lv.replace('HAUNT ', '') : lv, color: C.ash },
  ];
}

const WEIGHT = { hp: 1.1, en: 1.25, power: 1.25, ready: 1.05, hound: 1.3, lv: 1.2 };

function zone(ids, x0, x1, gap, y, h, row, out) {
  const total = ids.reduce((a, id) => a + WEIGHT[id], 0);
  const usable = Math.max(0, x1 - x0 - gap * (ids.length - 1));
  let x = x0;
  for (const id of ids) {
    const w = usable * WEIGHT[id] / total;
    out.push({ id, row, x, y, w, h });
    x += w + gap;
  }
}

/**
 * Cell rectangles (canvas px). Desktop: one row. Phone: row 1 = HP, timer,
 * HOUND (clear of the pause button); row 2 = EN, POWER, READY, LV.
 * @param {number} vpW  canvas px
 * @param {number} [scale]  canvas px per CSS px
 * @param {{insetTop?:number, pauseReserve?:number, compact?:boolean}} [opts]  insetTop in CSS px;
 *   compact = landscape phone single row without EN/POWER
 * @returns {{h:number, narrow:boolean, rows:Array<{y:number,h:number}>, cells:Array<{id:string,row:number,x:number,y:number,w:number,h:number}>}}
 */
export function topBarLayout(vpW, scale = 1, opts = {}) {
  const s = scale > 0 ? scale : 1;
  const narrow = isNarrowTopBar(vpW, s);
  const inset = Math.max(0, opts.insetTop ?? 0) * s;
  const reserve = Math.max(0, opts.pauseReserve ?? 0) * s;
  const gap = TOP_BAR.gap * s;
  const cells = [];
  const mid = vpW / 2;

  if (opts.compact === true) {
    // Landscape phone: one short row. EN and POWER are dropped first; HP,
    // MM:SS and HOUND HP always stay (plus READY and LV when they fit).
    const pad = TOP_BAR.narrowPadX * s;
    const h = TOP_BAR.rowH * s;
    const y = inset;
    const tw = TOP_BAR.narrowTimerW * s;
    const edge = pad + reserve;   // symmetric so the timer stays centred
    cells.push({ id: 'timer', row: 0, x: mid - tw / 2, y, w: tw, h });
    zone(['hp', 'ready'], edge, mid - tw / 2 - gap, gap, y, h, 0, cells);
    zone(['hound', 'lv'], mid + tw / 2 + gap, vpW - edge, gap, y, h, 0, cells);
    return { h: inset + h, narrow, compact: true, rows: [{ y, h }], cells: order(cells) };
  }

  if (!narrow) {
    const pad = TOP_BAR.padX * s;
    const h = TOP_BAR.rowH * s;
    const y = inset;
    const tw = TOP_BAR.timerW * s;
    cells.push({ id: 'timer', row: 0, x: mid - tw / 2, y, w: tw, h });
    zone(['hp', 'en', 'power', 'ready'], pad, mid - tw / 2 - gap, gap, y, h, 0, cells);
    zone(['hound', 'lv'], mid + tw / 2 + gap, vpW - pad - reserve, gap, y, h, 0, cells);
    return { h: inset + h, narrow, rows: [{ y, h }], cells: order(cells) };
  }

  const pad = TOP_BAR.narrowPadX * s;
  const h0 = TOP_BAR.narrowRow0H * s;
  const h1 = TOP_BAR.narrowRow1H * s;
  const y0 = inset;
  const y1 = inset + h0;
  const tw = TOP_BAR.narrowTimerW * s;
  const edge = pad + reserve;   // symmetric so the timer stays centred
  cells.push({ id: 'timer', row: 0, x: mid - tw / 2, y: y0, w: tw, h: h0 });
  zone(['hp'], edge, mid - tw / 2 - gap, gap, y0, h0, 0, cells);
  zone(['hound'], mid + tw / 2 + gap, vpW - edge, gap, y0, h0, 0, cells);
  zone(['en', 'power'], pad, mid - gap / 2, gap, y1, h1, 1, cells);
  zone(['ready', 'lv'], mid + gap / 2, vpW - pad, gap, y1, h1, 1, cells);
  return { h: inset + h0 + h1, narrow, rows: [{ y: y0, h: h0 }, { y: y1, h: h1 }], cells: order(cells) };
}

function order(cells) {
  return TOP_BAR_ORDER.map(id => cells.find(c => c.id === id)).filter(Boolean);
}

/** Strip height in canvas px (phoneFrame topPx / camera band clearance). */
export function topBarHeight(vpW, scale = 1, opts = {}) {
  return topBarLayout(vpW, scale, opts).h;
}

function dotted(ctx, x, y, w, h) {
  ctx.save();
  ctx.strokeStyle = TOP_BAR_FRAME;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([2, 3]);
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.setLineDash([]);
  ctx.restore();
}

function ring(ctx, cx, cy, r, frac, ok, lw) {
  const start = -Math.PI / 2;
  ctx.save();
  ctx.lineWidth = lw;
  ctx.strokeStyle = C.phosphorDim;
  ctx.globalAlpha = 0.45;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = ok ? C.phosphor : C.ember;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy, r, start, start + Math.PI * 2 * frac); ctx.stroke();
  ctx.restore();
}

/**
 * Paint the strip. Everything is clipped to [0, min(layout.h, lineBottom)] so
 * it can never reach the green line.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} state  arena state
 * @param {number} vpW
 * @param {number} lineBottom  canvas px: the strip must end above this y
 * @param {{scale?:number, hauntLv?:number, insetTop?:number, pauseReserve?:number}} [opts]
 * @returns {ReturnType<typeof topBarLayout>}
 */
export function drawTopBarHud(ctx, state, vpW, lineBottom, opts = {}) {
  const s = opts.scale > 0 ? opts.scale : 1;
  const layout = topBarLayout(vpW, s, opts);
  // Compact (landscape) cells are tight: use the short text forms.
  const cells = topBarCells(state, { hauntLv: opts.hauntLv, narrow: layout.narrow || layout.compact === true });
  const bottom = Math.min(layout.h, Number.isFinite(lineBottom) ? lineBottom : layout.h);
  if (!(bottom > 0)) return layout;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, vpW, bottom);
  ctx.clip();
  ctx.fillStyle = C.void;       // solid void: numbers read >= 7:1 (green) on it
  ctx.globalAlpha = 0.94;
  ctx.fillRect(0, 0, vpW, layout.h);
  ctx.globalAlpha = 1;

  const px = TOP_BAR.fontPx * s;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const box of layout.cells) {
    const cell = cells.find(c => c.id === box.id);
    if (!cell) continue;
    const inset = 3 * s;
    const bx = box.x, by = box.y + inset, bw = box.w, bh = box.h - inset * 2;
    dotted(ctx, bx, by, bw, bh);
    const cy = by + bh / 2 + s;
    const isTimer = cell.id === 'timer';
    const size = (isTimer ? TOP_BAR.timerPx : TOP_BAR.fontPx) * s;
    ctx.font = `${isTimer || cell.id === 'hp' || cell.id === 'hound' ? 700 : 500} ${size}px ${TOP_BAR_FONT}`;
    ctx.textAlign = 'center';
    let tx = bx + bw / 2;
    let maxW = bw - 8 * s;
    if (cell.id === 'ready') {
      const r = 7 * s;
      const rx = bx + 6 * s + r;
      const fill = stutterRingFraction(
        cooldownReadyFraction(state?.player?.fireCooldown ?? 0, FIRE_COOLDOWN_MS),
        isPowerStutter(state?.player?.powerBalance ?? 0));
      ring(ctx, rx, by + bh / 2, r, fill, cell.ready, 3 * s);
      tx = rx + r + 4 * s + (bx + bw - (rx + r + 4 * s)) / 2;
      maxW = bx + bw - (rx + r + 4 * s) - 4 * s;
    }
    ctx.globalAlpha = 1;
    if (cell.stutter) ctx.globalAlpha = 0.7 + 0.3 * powerPulseAlpha(state?.elapsedMs ?? 0);
    ctx.lineWidth = 2 * s;
    ctx.strokeStyle = C.void;
    ctx.strokeText(cell.text, tx, cy, Math.max(1, maxW));
    ctx.fillStyle = cell.color;
    ctx.fillText(cell.text, tx, cy, Math.max(1, maxW));
    ctx.globalAlpha = 1;
  }
  void px;
  ctx.restore();
  return layout;
}
