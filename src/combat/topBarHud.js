/**
 * src/combat/topBarHud.js — slim fight strip ABOVE the arena's green line (C4).
 *
 * Cells: centred fight TIMER (MM:SS) and optional HAUNT LV. HP / EN / POWER /
 * READY / HOUND left the strip — HP lives on the side meters. The DOM pause
 * button (.hh-pause-btn) sits in the top-right on touch; `pauseReserve` clears it.
 *
 * Layout and text are pure (Node-testable); drawTopBarHud only paints.
 * Font: Orbitron (self-hosted, SIL OFL). Frames are dotted phosphor.
 */
import { formatHauntLabel } from '../ui/hauntLevel.js';

export const TOP_BAR_FONT = '"Press Start 2P", Orbitron, "Share Tech Mono", monospace';
/** Kept for meters / legacy colour tokens (phosphor green / blood red). */
export const TOP_BAR_HP_PLAYER_COLOR = '#39FF88';
export const TOP_BAR_HP_HOUND_COLOR = '#FF4D5E';
export const TOP_BAR_FRAME = '#1F9E57';
/** Cell order, left to right (C4: timer-centric; LV only when it fits). */
export const TOP_BAR_ORDER = Object.freeze(['timer', 'lv']);

const C = { void: '#0A0D0B', bone: '#E8E2D0', ash: '#8F9A92', phosphorDim: '#1F9E57' };

/**
 * CSS-px metrics (multiplied by `scale`).
 * C4 nudge: ~20% shorter row than C3 (36 → 29) so the field can grow.
 */
export const TOP_BAR = Object.freeze({
  rowH: 29,
  narrowRow0H: 29,
  narrowRow1H: 0,
  narrowBelowW: 720,
  padX: 12,
  narrowPadX: 8,
  gap: 6,
  fontPx: 14,
  timerPx: 18,
  timerW: 104,
  narrowTimerW: 84,
  pauseReserve: 48,
});

/**
 * MM:SS count-up clock for the fight timer.
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

/** True when the strip should use the narrow phone metrics. */
export function isNarrowTopBar(vpW, scale = 1) {
  const s = scale > 0 ? scale : 1;
  return vpW / s < TOP_BAR.narrowBelowW;
}

/**
 * Text and colour for every cell in TOP_BAR_ORDER (pure).
 * @param {{player?:object, enemy?:object, elapsedMs?:number}} state
 * @param {{hauntLv?:number, narrow?:boolean}} [opts]
 */
export function topBarCells(state, opts = {}) {
  const narrow = opts.narrow === true;
  const lv = formatHauntLabel(opts.hauntLv ?? 1);
  return [
    { id: 'timer', text: formatFightClock(state?.elapsedMs ?? 0), color: C.bone },
    { id: 'lv', text: narrow ? lv.replace('HAUNT ', '') : lv, color: C.ash },
  ];
}

/**
 * Cell rectangles (canvas px). C4: one short row everywhere — timer centred,
 * LV to the right when space allows; pauseReserve clears the DOM pause button.
 * @param {number} vpW
 * @param {number} [scale]
 * @param {{insetTop?:number, pauseReserve?:number, compact?:boolean}} [opts]
 */
export function topBarLayout(vpW, scale = 1, opts = {}) {
  const s = scale > 0 ? scale : 1;
  const narrow = isNarrowTopBar(vpW, s) || opts.compact === true;
  const inset = Math.max(0, opts.insetTop ?? 0) * s;
  const reserve = Math.max(0, opts.pauseReserve ?? 0) * s;
  const pad = (narrow ? TOP_BAR.narrowPadX : TOP_BAR.padX) * s;
  const h = TOP_BAR.rowH * s;
  const y = inset;
  const mid = vpW / 2;
  const tw = (narrow ? TOP_BAR.narrowTimerW : TOP_BAR.timerW) * s;
  const cells = [{ id: 'timer', row: 0, x: mid - tw / 2, y, w: tw, h }];

  // LV sits to the right of the timer when there is room clear of pause.
  const lvW = Math.max(48 * s, (narrow ? 56 : 110) * s);
  const lvX = mid + tw / 2 + TOP_BAR.gap * s;
  const rightLimit = vpW - pad - reserve;
  if (lvX + lvW <= rightLimit + 1e-6) {
    cells.push({ id: 'lv', row: 0, x: lvX, y, w: Math.min(lvW, rightLimit - lvX), h });
  }

  return {
    h: inset + h,
    narrow,
    compact: opts.compact === true,
    rows: [{ y, h }],
    cells: order(cells),
  };
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
  ctx.setLineDash([]);
  ctx.lineJoin = 'miter';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * Paint the slim strip. Clipped to [0, min(layout.h, lineBottom)].
 */
export function drawTopBarHud(ctx, state, vpW, lineBottom, opts = {}) {
  const s = opts.scale > 0 ? opts.scale : 1;
  const layout = topBarLayout(vpW, s, opts);
  const cells = topBarCells(state, { hauntLv: opts.hauntLv, narrow: layout.narrow || layout.compact === true });
  const bottom = Math.min(layout.h, Number.isFinite(lineBottom) ? lineBottom : layout.h);
  if (!(bottom > 0)) return layout;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, vpW, bottom);
  ctx.clip();
  ctx.fillStyle = C.void;
  ctx.globalAlpha = 0.94;
  ctx.fillRect(0, 0, vpW, layout.h);
  ctx.globalAlpha = 1;

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
    ctx.font = `${isTimer ? 700 : 500} ${size}px ${TOP_BAR_FONT}`;
    ctx.textAlign = 'center';
    const tx = bx + bw / 2;
    const maxW = bw - 8 * s;
    ctx.lineWidth = 2 * s;
    ctx.strokeStyle = C.void;
    ctx.strokeText(cell.text, tx, cy, Math.max(1, maxW));
    ctx.fillStyle = cell.color;
    ctx.fillText(cell.text, tx, cy, Math.max(1, maxW));
  }
  ctx.restore();
  return layout;
}
