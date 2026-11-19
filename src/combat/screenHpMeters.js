/**
 * src/combat/screenHpMeters.js — fixed screen-space HP meters (away from mechs).
 *
 * Layouts (pick one per build):
 *   'vertical' — player bar on the left edge, HOUND on the right edge
 *   'top'      — both horizontal bars along the top (player left, HOUND right)
 *
 * Drawn in OVERLAY / screen space. Clears the red-ring tell, DASH caption band,
 * and touch controls by staying on the frame edges / top strip.
 */
import { formatHudStat } from './hud.js';

export const SCREEN_HP_LAYOUT = 'vertical'; // branch A; branch B sets 'top'

const C = {
  void: '#0A0D0B',
  bone: '#E8E2D0',
  ash: '#8F9A92',
  phosphor: '#39FF88',
  ember: '#FF8A3D',
  blood: '#FF4D5E',
  track: '#1A1A1A',
  border: '#333333',
};

function fillFor(pct, base) {
  if (pct < 0.25) return C.blood;
  if (pct < 0.5) return C.ember;
  return base;
}

function pctOf(ent) {
  const max = ent?.maxHp > 0 ? ent.maxHp : 0;
  if (!max) return 0;
  return Math.max(0, Math.min(1, (ent.hp ?? 0) / max));
}

/** CSS-px reserved under the top edge for the 'top' layout strip (caption sits below). */
export function screenHpTopReserve(layout = SCREEN_HP_LAYOUT) {
  return layout === 'top' ? 36 : 0;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ player?: object, enemy?: object }} state
 * @param {number} vpW
 * @param {number} vpH
 * @param {{ layout?: string, topInset?: number, bottomInset?: number, leftInset?: number, rightInset?: number }} [opts]
 */
export function drawScreenHpMeters(ctx, state, vpW, vpH, opts = {}) {
  const layout = opts.layout ?? SCREEN_HP_LAYOUT;
  if (layout === 'top') drawTop(ctx, state, vpW, vpH, opts);
  else drawVertical(ctx, state, vpW, vpH, opts);
}

function drawVertical(ctx, state, vpW, vpH, opts) {
  const top = Math.max(72, opts.topInset ?? 72);
  const bottom = Math.max(top + 80, vpH - Math.max(150, opts.bottomInset ?? 150));
  const thick = Math.max(10, Math.min(16, Math.round(vpW * 0.012)));
  const gap = 10;
  const leftX = Math.max(8, opts.leftInset ?? 10);
  const rightX = vpW - Math.max(8, opts.rightInset ?? 10) - thick;
  const h = bottom - top;

  drawVBar(ctx, leftX, top, thick, h, pctOf(state.player), C.phosphor,
    `HP ${formatHudStat(state.player?.hp ?? 0, state.player?.maxHp ?? 0)}`, 'right');
  drawVBar(ctx, rightX, top, thick, h, pctOf(state.enemy), C.ember,
    `HOUND ${formatHudStat(state.enemy?.hp ?? 0, state.enemy?.maxHp ?? 0)}`, 'left');
  void gap;
}

function drawVBar(ctx, x, y, w, h, pct, base, label, labelSide) {
  ctx.fillStyle = C.track;
  ctx.fillRect(x, y, w, h);
  const fillH = h * pct;
  const fillY = y + h - fillH;
  ctx.fillStyle = fillFor(pct, base);
  ctx.fillRect(x, fillY, w, fillH);
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  const fontPx = Math.max(12, Math.min(16, Math.round(h * 0.04 + 10)));
  ctx.font = `bold ${fontPx}px "Share Tech Mono", monospace`;
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.void;
  ctx.fillStyle = C.bone;
  if (labelSide === 'right') {
    ctx.textAlign = 'left';
    const tx = x + w + 8;
    const ty = y + 4;
    ctx.strokeText(label, tx, ty);
    ctx.fillText(label, tx, ty);
  } else {
    ctx.textAlign = 'right';
    const tx = x - 8;
    const ty = y + 4;
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

  drawHBar(ctx, leftX, y, barW, barH, pctOf(state.player), C.phosphor,
    `HP ${formatHudStat(state.player?.hp ?? 0, state.player?.maxHp ?? 0)}`);
  drawHBar(ctx, rightX, y, barW, barH, pctOf(state.enemy), C.ember,
    `HOUND ${formatHudStat(state.enemy?.hp ?? 0, state.enemy?.maxHp ?? 0)}`);
  void vpH;
}

function drawHBar(ctx, x, y, w, h, pct, base, label) {
  ctx.fillStyle = C.track;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fillFor(pct, base);
  ctx.fillRect(x, y, w * pct, h);
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  // Label under the bar so a top strip clears the phone HUD / HAUNT LV row.
  const fontPx = Math.max(12, Math.min(14, Math.round(h + 2)));
  ctx.font = `bold ${fontPx}px "Share Tech Mono", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.void;
  ctx.fillStyle = C.bone;
  const tx = x + 2;
  const ty = y + h + 3;
  ctx.strokeText(label, tx, ty);
  ctx.fillText(label, tx, ty);
}
