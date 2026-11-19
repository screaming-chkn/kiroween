/**
 * src/combat/screenHpMeters.js — fixed screen-space HP meters (away from mechs).
 *
 * Layout C ('corner-v'): short vertical bars at the top-left (player) and
 * top-right (HOUND) of the arena view. Every part of a meter group (bar, dotted
 * frame, fill, label) sits strictly BELOW the arena's green top border: the
 * group's top edge is at least METER_LINE_GAP px under the line's bottom edge.
 * The label is drawn under the bar, never above it. The HP numbers live in the
 * top strip (topBarHud.js); the meters carry the name plus the fill height.
 *
 * Fill is orange; turns red at ≤25% of that bar's max.
 * Labels use Orbitron (self-hosted, SIL OFL). Frames are dotted phosphor to
 * match the wireframe blueprint UI.
 */
import { formatHudStat } from './hud.js';
import { worldToScreen } from '../engine/camera.js';

export const SCREEN_HP_LAYOUT = 'corner-v';

/** Fill is orange until ≤25%, then red. */
export const METER_ORANGE = '#FF8A3D';
export const METER_RED = '#FF4D5E';
export const METER_RED_PCT = 0.25;
export const METER_FRAME = '#39FF88'; // phosphor — matches wireframe neon
export const METER_FONT = 'Orbitron, "Share Tech Mono", monospace';

/** Minimum CSS px between the green line's bottom edge and any meter pixel. */
export const METER_LINE_GAP = 6;
/** Arena border stroke width in world units (combatRenderer.drawWorld). */
export const ARENA_BORDER_WU = 2;

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
 * Bottom edge (canvas px) of the arena's green top border: the border is a 2 wu
 * stroke whose top is world y = 0. x does not matter (the edge is horizontal).
 * Returns 0 when the camera yields a non-finite value.
 *
 * @param {{x:number,y:number,zoom:number}} camera
 * @param {number} vpW
 * @param {number} vpH
 * @param {number} [shakeX]
 * @param {number} [shakeY]
 * @param {number} [arenaCx]  world x of the arena centre (any x works)
 * @returns {number}
 */
export function arenaTopLineSy(camera, vpW, vpH, shakeX = 0, shakeY = 0, arenaCx = 0) {
  if (!camera || !Number.isFinite(camera.x) || !Number.isFinite(camera.y) || !Number.isFinite(camera.zoom)) {
    return 0;
  }
  const { sy } = worldToScreen(arenaCx, 0, camera, vpW, vpH, shakeX, shakeY);
  const bottom = sy + ARENA_BORDER_WU * camera.zoom;
  return Number.isFinite(bottom) ? bottom : 0;
}

/**
 * Landscape: left/right insets (canvas px) that put the meters in the ARENA's
 * top corners (inside the border) instead of the screen corners, so they stay
 * out of the control gutters.
 * @param {{x:number,y:number,zoom:number}} camera
 * @param {number} vpW
 * @param {number} vpH
 * @param {number} arenaW  world width
 * @param {{shakeX?:number, shakeY?:number, scale?:number, pad?:number}} [o]
 * @returns {{left:number, right:number}}
 */
export function arenaSideInsets(camera, vpW, vpH, arenaW, o = {}) {
  const s = o.scale > 0 ? o.scale : 1;
  const pad = (o.pad ?? 8) * s;
  const l = worldToScreen(0, 0, camera, vpW, vpH, o.shakeX ?? 0, o.shakeY ?? 0).sx;
  const r = worldToScreen(arenaW, 0, camera, vpW, vpH, o.shakeX ?? 0, o.shakeY ?? 0).sx;
  return {
    left: Math.max(10 * s, l + pad),
    right: Math.max(10 * s, vpW - r + pad),
  };
}

/**
 * topInset for the meter groups: line bottom plus METER_LINE_GAP, scaled the
 * same way the overlay scales its CSS px (hudScale / dpr).
 *
 * @param {number} lineBottom  canvas px (from arenaTopLineSy, or the top strip bottom if lower)
 * @param {number} [scale]
 */
export function meterTopInset(lineBottom, scale = 1) {
  const s = scale > 0 ? scale : 1;
  return (Number.isFinite(lineBottom) ? lineBottom : 0) + METER_LINE_GAP * s;
}

/**
 * Corner-v geometry (pure). Each group box covers bar + label.
 * @param {number} vpW
 * @param {number} vpH
 * @param {{topInset?:number, leftInset?:number, rightInset?:number, scale?:number}} [opts]
 */
export function cornerVGeometry(vpW, vpH, opts = {}) {
  const s = opts.scale > 0 ? opts.scale : 1;
  const top = Math.max(8, opts.topInset ?? 12);
  const thick = Math.max(12, Math.min(18, Math.round((vpW / s) * 0.014))) * s;
  // compact (landscape phone): shorter bar so group + label stay small.
  const h = (opts.compact ? 56 : Math.max(72, Math.min(120, Math.round((vpH / s) * 0.14)))) * s;
  const leftX = Math.max(8 * s, opts.leftInset ?? 10);
  const rightEdge = vpW - Math.max(8 * s, opts.rightInset ?? 10);
  const fontPx = 16 * s;
  const gap = 4 * s;
  const labelH = fontPx * 1.2;
  const pw = Math.max(thick, 'HP'.length * fontPx * 0.9);
  const ew = Math.max(thick, 'HOUND'.length * fontPx * 0.9);
  const gh = h + gap + labelH;
  return {
    top, thick, h, fontPx, gap, scale: s,
    player: { x: leftX, y: top, w: pw, h: gh, barX: leftX },
    enemy: { x: rightEdge - ew, y: top, w: ew, h: gh, barX: rightEdge - thick },
  };
}

/**
 * Horizontal space (canvas px) each side is taken by a meter group, so the
 * centred taunt can keep clear of it.
 */
export function meterSideReserve(vpW, vpH, opts = {}) {
  const g = cornerVGeometry(vpW, vpH, opts);
  const s = g.scale;
  return Math.max(g.player.x + g.player.w, vpW - g.enemy.x) + 8 * s;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ player?: object, enemy?: object }} state
 * @param {number} vpW
 * @param {number} vpH
 * @param {{ layout?: string, topInset?: number, bottomInset?: number, leftInset?: number, rightInset?: number, sidePad?: number, scale?: number }} [opts]
 */
export function drawScreenHpMeters(ctx, state, vpW, vpH, opts = {}) {
  const layout = opts.layout ?? SCREEN_HP_LAYOUT;
  if (layout === 'corner-v') drawCornerV(ctx, state, vpW, vpH, opts);
  else if (layout === 'top') drawTop(ctx, state, vpW, vpH, opts);
  else drawVertical(ctx, state, vpW, vpH, opts);
}

/** Layout C: short vertical bars under the green line, label under each bar. */
function drawCornerV(ctx, state, vpW, vpH, opts) {
  const g = cornerVGeometry(vpW, vpH, opts);
  drawVBar(ctx, g, g.player.barX, pctOf(state.player), 'HP', 'left');
  drawVBar(ctx, g, g.enemy.barX, pctOf(state.enemy), 'HOUND', 'right');
}

function drawVertical(ctx, state, vpW, vpH, opts) {
  const top = Math.max(72, opts.topInset ?? 72);
  const bottom = Math.max(top + 80, vpH - Math.max(150, opts.bottomInset ?? 150));
  const thick = Math.max(10, Math.min(16, Math.round(vpW * 0.012)));
  const leftX = Math.max(8, opts.leftInset ?? 10);
  const rightX = vpW - Math.max(8, opts.rightInset ?? 10) - thick;
  const h = bottom - top;

  drawSideBar(ctx, leftX, top, thick, h, pctOf(state.player),
    `HP ${formatHudStat(state.player?.hp ?? 0, state.player?.maxHp ?? 0)}`, 'right');
  drawSideBar(ctx, rightX, top, thick, h, pctOf(state.enemy),
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

function fillBar(ctx, x, y, w, h, pct) {
  ctx.fillStyle = C.track;
  ctx.fillRect(x, y, w, h);
  const fillH = h * pct;
  const fillY = y + h - fillH;
  ctx.fillStyle = meterFillColor(pct);
  ctx.fillRect(x + 2, fillY + 1, w - 4, Math.max(0, fillH - 2));
  strokeDottedRect(ctx, x, y, w, h);
}

function drawLabel(ctx, text, x, y, align, fontPx) {
  ctx.font = `${fontPx}px ${METER_FONT}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = align;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.void;
  ctx.fillStyle = METER_FRAME;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

/** corner-v bar: label BELOW the bar, hugging the screen edge side. */
function drawVBar(ctx, g, x, pct, label, side) {
  fillBar(ctx, x, g.top, g.thick, g.h, pct);
  const ty = g.top + g.h + g.gap;
  if (side === 'left') drawLabel(ctx, label, x, ty, 'left', g.fontPx);
  else drawLabel(ctx, label, x + g.thick, ty, 'right', g.fontPx);
}

/** Legacy 'vertical' A/B layout: label beside the bar, top-aligned with it. */
function drawSideBar(ctx, x, y, w, h, pct, label, labelSide) {
  fillBar(ctx, x, y, w, h, pct);
  const fontPx = Math.max(16, Math.min(22, Math.round(h * 0.14 + 12)));
  if (labelSide === 'right') drawLabel(ctx, label, x + w + 6, y, 'left', fontPx);
  else drawLabel(ctx, label, x - 6, y, 'right', fontPx);
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
  drawLabel(ctx, label, x + 2, y + h + 2, 'left', fontPx);
}
