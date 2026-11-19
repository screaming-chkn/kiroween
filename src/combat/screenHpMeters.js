/**
 * src/combat/screenHpMeters.js — fixed screen-space HP meters (away from mechs).
 *
 * Layout C ('corner-v'): short vertical bars at top-left (player) and
 * top-right (HOUND), sitting inside the arena view just below the phone HUD /
 * green header strip — not at the very top of the screen.
 *
 * Fill is orange; turns red at ≤25% of that bar's max.
 * Labels use VT323 (self-hosted OFL CRT font) for an old-school digital look.
 * Frames are dotted phosphor to match the wireframe blueprint UI.
 */
import { formatHudStat } from './hud.js';

export const SCREEN_HP_LAYOUT = 'corner-v';

/** Fill is orange until ≤25%, then red. */
export const METER_ORANGE = '#FF8A3D';
export const METER_RED = '#FF4D5E';
export const METER_RED_PCT = 0.25;
export const METER_FRAME = '#39FF88'; // phosphor — matches wireframe neon
export const METER_FONT = 'VT323, "Share Tech Mono", monospace';

const C = {
  void: '#0A0D0B',
  bone: '#E8E2D0',
  track: '#0F1A14',
};

/** Orange above 25%; red at ≤25%. */
export function meterFillColor(pct) {
  return pct <= METER_RED_PCT ? METER_RED : METER_ORANGE;
}

function pctOf(ent) {
  const max = ent?.maxHp > 0 ? ent.maxHp : 0;
  if (!max) return 0;
  return Math.max(0, Math.min(1, (ent.hp ?? 0) / max));
}

/** CSS-px reserved under the top edge so the tell caption clears the meters. */
export function screenHpTopReserve(layout = SCREEN_HP_LAYOUT) {
  if (layout === 'top') return 36;
  if (layout === 'corner-v') return 28;
  return 0;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ player?: object, enemy?: object }} state
 * @param {number} vpW
 * @param {number} vpH
 * @param {{ layout?: string, topInset?: number, bottomInset?: number, leftInset?: number, rightInset?: number, sidePad?: number }} [opts]
 */
export function drawScreenHpMeters(ctx, state, vpW, vpH, opts = {}) {
  const layout = opts.layout ?? SCREEN_HP_LAYOUT;
  if (layout === 'corner-v') drawCornerV(ctx, state, vpW, vpH, opts);
  else if (layout === 'top') drawTop(ctx, state, vpW, vpH, opts);
  else drawVertical(ctx, state, vpW, vpH, opts);
}

/** Layout C: short vertical bars tucked under the green HUD line. */
function drawCornerV(ctx, state, vpW, vpH, opts) {
  const top = Math.max(8, opts.topInset ?? 12);
  const thick = Math.max(12, Math.min(18, Math.round(vpW * 0.014)));
  const h = Math.max(72, Math.min(120, Math.round(vpH * 0.14)));
  const leftX = Math.max(8, opts.leftInset ?? 10);
  const rightX = vpW - Math.max(8, opts.rightInset ?? 10) - thick;

  drawVBar(ctx, leftX, top, thick, h, pctOf(state.player),
    `HP ${formatHudStat(state.player?.hp ?? 0, state.player?.maxHp ?? 0)}`, 'right');
  drawVBar(ctx, rightX, top, thick, h, pctOf(state.enemy),
    `HOUND ${formatHudStat(state.enemy?.hp ?? 0, state.enemy?.maxHp ?? 0)}`, 'left');
  void vpH;
}

function drawVertical(ctx, state, vpW, vpH, opts) {
  const top = Math.max(72, opts.topInset ?? 72);
  const bottom = Math.max(top + 80, vpH - Math.max(150, opts.bottomInset ?? 150));
  const thick = Math.max(10, Math.min(16, Math.round(vpW * 0.012)));
  const leftX = Math.max(8, opts.leftInset ?? 10);
  const rightX = vpW - Math.max(8, opts.rightInset ?? 10) - thick;
  const h = bottom - top;

  drawVBar(ctx, leftX, top, thick, h, pctOf(state.player),
    `HP ${formatHudStat(state.player?.hp ?? 0, state.player?.maxHp ?? 0)}`, 'right');
  drawVBar(ctx, rightX, top, thick, h, pctOf(state.enemy),
    `HOUND ${formatHudStat(state.enemy?.hp ?? 0, state.enemy?.maxHp ?? 0)}`, 'left');
}

/** Dotted phosphor frame — blueprint / wireframe look. */
function strokeDottedRect(ctx, x, y, w, h) {
  ctx.save();
  ctx.strokeStyle = METER_FRAME;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([2, 3]);
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.setLineDash([]);
  ctx.restore();
}

function drawVBar(ctx, x, y, w, h, pct, label, labelSide) {
  ctx.fillStyle = C.track;
  ctx.fillRect(x, y, w, h);
  const fillH = h * pct;
  const fillY = y + h - fillH;
  ctx.fillStyle = meterFillColor(pct);
  ctx.fillRect(x + 2, fillY + 1, w - 4, Math.max(0, fillH - 2));
  strokeDottedRect(ctx, x, y, w, h);

  // Old-school digital readout (VT323 CRT font, already self-hosted OFL).
  const fontPx = Math.max(16, Math.min(22, Math.round(h * 0.14 + 12)));
  ctx.font = `${fontPx}px ${METER_FONT}`;
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.void;
  ctx.fillStyle = METER_FRAME;
  if (labelSide === 'right') {
    ctx.textAlign = 'left';
    const tx = x + w + 6;
    const ty = y + 2;
    ctx.strokeText(label, tx, ty);
    ctx.fillText(label, tx, ty);
  } else {
    ctx.textAlign = 'right';
    const tx = x - 6;
    const ty = y + 2;
    ctx.strokeText(label, tx, ty);
    ctx.fillText(label, tx, ty);
  }
}

function drawTop(ctx, state, vpW, vpH, opts) {
  const top = Math.max(10, opts.topInset ?? 12);
  const barH = 12;
  const sidePad = Math.max(12, opts.sidePad ?? 16);
  const midGap = 16;
  const usable = vpW - sidePad * 2 - midGap;
  const barW = Math.max(120, usable / 2);
  const y = top;
  const leftX = sidePad;
  const rightX = vpW - sidePad - barW;

  drawHBar(ctx, leftX, y, barW, barH, pctOf(state.player),
    `HP ${formatHudStat(state.player?.hp ?? 0, state.player?.maxHp ?? 0)}`);
  drawHBar(ctx, rightX, y, barW, barH, pctOf(state.enemy),
    `HOUND ${formatHudStat(state.enemy?.hp ?? 0, state.enemy?.maxHp ?? 0)}`);
  void vpH;
}

function drawHBar(ctx, x, y, w, h, pct, label) {
  ctx.fillStyle = C.track;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = meterFillColor(pct);
  ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * pct), h - 4);
  strokeDottedRect(ctx, x, y, w, h);

  const fontPx = Math.max(16, Math.min(20, Math.round(h + 6)));
  ctx.font = `${fontPx}px ${METER_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.void;
  ctx.fillStyle = METER_FRAME;
  const tx = x + 2;
  const ty = y + h + 2;
  ctx.strokeText(label, tx, ty);
  ctx.fillText(label, tx, ty);
}
