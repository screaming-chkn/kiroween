/**
 * src/ui/endCardView.js — polished end card (render/text only).
 *
 * Drop-in replacement for combatRenderer.drawOverlay (which stays untouched):
 * same signature plus an `opts` bag, same return shape. Copy helpers still
 * come from combat/endcard.js. Button id 'retry' is kept for main.js wiring;
 * its visible label is REDEPLOY.
 *
 * Pure ES module: no DOM at load, only the ctx passed in.
 */

import { formatTimeSurvived, titleText, subtitleText, causeText } from '../combat/endcard.js';
import { levelUpText } from './hauntLevel.js';

export const COUNT_UP_MS = 600;
export const STAMP_WIN = 'EXORCISED';
export const STAMP_LOSS = 'POSSESSED';
export const STAMP_MAX = 'LAID TO REST';
export const BTN_W = 200;
export const BTN_H = 52;

const C = {
  void:    '#0A0D0B',
  panel:   '#121A15',
  bone:    '#E8E2D0',
  ash:     '#8F9A92',
  ember:   '#FF8A3D',
  win:     '#39FF88',
  loss:    '#FF4D5E',
};

/**
 * Big stamp text for a phase. Pass { level, maxLevel } (the LV fought at) to
 * get LAID TO REST on a max-level win.
 */
export function stampText(phase, opts) {
  return titleText(phase, opts);
}

/**
 * Level-up line for a win below max, else ''. `level` is the LV fought at.
 */
export function levelUpLine(phase, opts) {
  const { level, maxLevel } = opts ?? {};
  if (phase !== 'win' || !Number.isFinite(level) || !Number.isFinite(maxLevel)) return '';
  if (level >= maxLevel) return '';
  return levelUpText(level + 1);
}

/**
 * Elapsed ms to display while counting up (linear 0 → real over COUNT_UP_MS).
 * Returns the final value when the clock inputs are missing.
 *
 * @param {number} elapsedMs
 * @param {number} [shownAtMs]
 * @param {number} [nowMs]
 */
export function countUpMs(elapsedMs, shownAtMs, nowMs) {
  const real = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  if (!Number.isFinite(shownAtMs) || !Number.isFinite(nowMs)) return real;
  const t = Math.max(0, Math.min(1, (nowMs - shownAtMs) / COUNT_UP_MS));
  return real * t;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ phase: string, elapsedMs?: number }} state
 * @param {*} _camera  unused (screen space)
 * @param {number} vpW
 * @param {number} vpH
 * @param {boolean} [restartReady]
 * @param {number} [focusIndex]  0 = REDEPLOY, 1 = GARAGE
 * @param {{shownAtMs?:number, nowMs?:number, specStamp?:string|null, level?:number, maxLevel?:number}} [opts]
 *        level = HAUNT LV the duel was fought at; maxLevel = the cap.
 * @returns {{ buttons: Array<{id:string,label:string,x:number,y:number,w:number,h:number}> } | null}
 */
export function drawEndCardView(ctx, state, _camera, vpW, vpH, restartReady = false, focusIndex = 0, opts = {}) {
  if (!state || (state.phase !== 'win' && state.phase !== 'lose')) return null;
  const o = opts ?? {};
  const isWin = state.phase === 'win';
  const accent = isWin ? C.win : C.loss;

  const shown = countUpMs(state.elapsedMs ?? 0, o.shownAtMs, o.nowMs);
  const timeLine = `Time survived  ${formatTimeSurvived(shown)}`;

  ctx.save();

  // Dim veil.
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = C.void;
  ctx.fillRect(0, 0, vpW, vpH);
  ctx.globalAlpha = 1;

  // Solid panel.
  const cardW = 520;
  const cardH = 380;
  const cardX = Math.round(vpW / 2 - cardW / 2);
  const cardY = Math.round(vpH / 2 - cardH / 2);
  const cx = cardX + cardW / 2;
  ctx.fillStyle = C.panel;
  ctx.fillRect(cardX, cardY, cardW, cardH);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(cardX + 1, cardY + 1, cardW - 2, cardH - 2);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Big stamp.
  const stamp = stampText(state.phase, o);
  ctx.font = '90px "VT323", monospace';
  ctx.lineWidth = 1;
  ctx.strokeStyle = C.void;
  ctx.strokeText(stamp, cx, cardY + 96, cardW - 40);
  ctx.fillStyle = accent;
  ctx.fillText(stamp, cx, cardY + 96, cardW - 40);

  // Subtitle + cause.
  ctx.fillStyle = C.bone;
  ctx.font = '20px "VT323", monospace';
  ctx.fillText(subtitleText(state.phase, o), cx, cardY + 130);
  ctx.fillStyle = C.ash;
  ctx.font = '15px "Share Tech Mono", monospace';
  ctx.fillText(causeText(state.phase, o), cx, cardY + 164);

  // Time (counting up), level-up line (win below max), dim spec line.
  ctx.fillStyle = C.bone;
  ctx.font = '16px "Share Tech Mono", monospace';
  ctx.fillText(timeLine, cx, cardY + 194);
  const rise = levelUpLine(state.phase, o);
  if (rise) {
    ctx.fillStyle = C.ember;
    ctx.font = '15px "Share Tech Mono", monospace';
    ctx.fillText(rise, cx, cardY + 222, cardW - 24);
  }
  if (typeof o.specStamp === 'string' && o.specStamp.length > 0) {
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = C.ash;
    ctx.font = '13px "Share Tech Mono", monospace';
    ctx.fillText(o.specStamp, cx, cardY + 250, cardW - 24);
    ctx.globalAlpha = 1;
  }

  // Buttons.
  const gap = 24;
  const btnY = cardY + cardH - 44 - BTN_H;
  const buttons = [
    { id: 'retry',  label: 'REDEPLOY', x: Math.round(cx - gap / 2 - BTN_W), y: btnY, w: BTN_W, h: BTN_H },
    { id: 'garage', label: 'GARAGE',   x: Math.round(cx + gap / 2),         y: btnY, w: BTN_W, h: BTN_H },
  ];

  if (!restartReady) {
    ctx.fillStyle = C.ash;
    ctx.globalAlpha = 0.6;
    ctx.font = '16px "Share Tech Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText('Stand by\u2026', cx, btnY + BTN_H / 2);
    ctx.restore();
    return null;
  }

  buttons.forEach((b, i) => {
    const primary = b.id === 'retry';
    ctx.fillStyle = primary ? C.win : C.void;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    if (!primary) {
      ctx.strokeStyle = C.bone;
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    }
    if (i === focusIndex) {
      ctx.strokeStyle = C.ember;
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
    }
    ctx.fillStyle = primary ? C.void : C.bone;
    ctx.font = '24px "VT323", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
  });

  ctx.restore();
  return { buttons };
}
