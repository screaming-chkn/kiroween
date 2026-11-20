/**
 * src/ui/creditIcon.js — original gold $ coin mark.
 *
 * One vector, used everywhere credits appear: arena pickups, fight HUD,
 * garage balance, and the end-card payout line. No external assets.
 */

export const CREDIT_GOLD = '#E6C35C';
export const CREDIT_GOLD_HI = '#FFE9A0';
export const CREDIT_GOLD_DEEP = '#8A5A12';
export const CREDIT_GOLD_MARK = '#6B3E0A';

/**
 * Draw the coin at (x, y) with outer radius r, in the current canvas space.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} r
 * @param {{ spin?: number, alpha?: number }} [opts]
 */
export function drawCreditIcon(ctx, x, y, r, opts = {}) {
  if (!(r > 0)) return;
  const spin = opts.spin ?? 0;
  const alpha = opts.alpha ?? 1;
  ctx.save();
  ctx.translate(x, y);
  if (spin) ctx.rotate(spin);
  ctx.globalAlpha *= alpha;

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = CREDIT_GOLD;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.strokeStyle = CREDIT_GOLD_DEEP;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(0.8, r * 0.08);
  ctx.strokeStyle = CREDIT_GOLD_HI;
  ctx.stroke();

  // $ mark — two vertical ticks + an S curve, readable at 8–20 px.
  const w = r * 0.08;
  ctx.strokeStyle = CREDIT_GOLD_MARK;
  ctx.lineWidth = Math.max(1.2, r * 0.18);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.52);
  ctx.lineTo(0, r * 0.52);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.28, -r * 0.22);
  ctx.quadraticCurveTo(-r * 0.28, -r * 0.42, 0, -r * 0.42);
  ctx.quadraticCurveTo(r * 0.32, -r * 0.42, r * 0.32, -r * 0.22);
  ctx.quadraticCurveTo(r * 0.32, -r * 0.04, 0, 0.02 * r);
  ctx.quadraticCurveTo(-r * 0.32, 0.08 * r, -r * 0.32, r * 0.24);
  ctx.quadraticCurveTo(-r * 0.32, r * 0.44, 0, r * 0.44);
  ctx.quadraticCurveTo(r * 0.28, r * 0.44, r * 0.28, r * 0.24);
  ctx.stroke();
  void w;

  ctx.restore();
}

/** Inline SVG markup for DOM (garage). Square viewBox, current size. */
export function creditIconSvg(size = 16) {
  const s = Number(size) > 0 ? Number(size) : 16;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 32 32" aria-hidden="true" class="hh-credit-icon">` +
    `<circle cx="16" cy="16" r="14" fill="${CREDIT_GOLD}" stroke="${CREDIT_GOLD_DEEP}" stroke-width="2"/>` +
    `<circle cx="16" cy="16" r="11" fill="none" stroke="${CREDIT_GOLD_HI}" stroke-width="1.4"/>` +
    `<path d="M16 7.5 v17" fill="none" stroke="${CREDIT_GOLD_MARK}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<path d="M11.5 12.2 q0-3.2 4.5-3.2 q4.5 0 4.5 3.2 q0 2.2-4.5 3.6 q-4.5 1.6-4.5 3.6 q0 3.2 4.5 3.2 q4.5 0 4.5-3.2" fill="none" stroke="${CREDIT_GOLD_MARK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`
  );
}

/** Append the coin SVG + a text node into a parent element. */
export function mountCreditIcon(el, size = 16) {
  if (!el) return null;
  const wrap = document.createElement('span');
  wrap.className = 'hh-credit-icon-wrap';
  wrap.style.display = 'inline-flex';
  wrap.style.alignItems = 'center';
  wrap.style.verticalAlign = 'middle';
  wrap.innerHTML = creditIconSvg(size);
  el.append(wrap);
  return wrap;
}
