/**
 * src/ui/phoneCombatUi.js — render/layout helpers for phone combat UI.
 * Pure ES module: no top-level DOM access; only the `ctx` passed in is used.
 */

export const END_CARD_W = 520;
export const END_CARD_BTN_H = 52;
export const TOUCH_MIN_PX = 44;
export const HUD_MARGIN = 20;
export const HUD_PANEL_W = 240;
export const HUD_PANEL_H = 128;
export const HUD_UNDER_ALPHA = 0.35;
export const PHONE_HUD_SCALE = 0.8;
export const PHONE_HUD_TOP = 15;

/** Non-uniform scale so the end card fits width and buttons stay >= 44 CSS px. */
export function endCardScale({ touchUi, dpr = 1, cssW }) {
  if (!touchUi) return { sx: 1, sy: 1 };
  const sx = Math.min(dpr, ((cssW - 16) / END_CARD_W) * dpr);
  const sy = Math.min(dpr, Math.max(sx, (TOUCH_MIN_PX / END_CARD_BTN_H) * dpr));
  return { sx, sy };
}

export function scaleRects(rects, sx, sy) {
  if (!rects) return null;
  return rects.map(r => ({ ...r, x: r.x * sx, y: r.y * sy, w: r.w * sx, h: r.h * sy }));
}

export function phoneHudScale(dpr) {
  return PHONE_HUD_SCALE * dpr;
}

export function phoneHudViewportH(top = PHONE_HUD_TOP) {
  return top + HUD_MARGIN + HUD_PANEL_H;
}

/** Canvas-px rect of the scaled phone HUD panel. */
export function phoneHudRect(s, top = PHONE_HUD_TOP) {
  return { x: HUD_MARGIN * s, y: top * s, w: HUD_PANEL_W * s, h: HUD_PANEL_H * s };
}

export function hudPanelRect(vpH) {
  return { x: HUD_MARGIN, y: vpH - HUD_MARGIN - HUD_PANEL_H, w: HUD_PANEL_W, h: HUD_PANEL_H };
}

export function circleOverlapsRect(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

export function windupGlowStyle(remainingMs, windupMs) {
  if (!(remainingMs > 0) || !(windupMs > 0)) return null;
  const p = Math.max(0, Math.min(1, 1 - remainingMs / windupMs));
  return {
    progress: p,
    radius: 20 * (1.1 + 0.8 * p),
    lineWidth: 4 + 2 * p,
    alpha: 0.6 + 0.4 * p,
    haloWidth: 12,
    haloAlpha: 0.12 + 0.28 * p,
  };
}

export function drawWindupGlow(ctx, enemy, windupMs) {
  const s = windupGlowStyle(enemy?.windupRemainingMs, windupMs);
  if (!s) return;
  ctx.save();
  ctx.strokeStyle = '#FF4D5E';
  ctx.globalAlpha = s.haloAlpha;
  ctx.lineWidth = s.haloWidth;
  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y, s.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = s.alpha;
  ctx.lineWidth = s.lineWidth;
  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y, s.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function compactHpLayout(kind) {
  return kind === 'player'
    ? { w: 56, h: 5, offsetY: 30, showText: false }
    : { w: 72, h: 5, offsetY: 30, showText: true, fontPx: 11 };
}

function drawBar(ctx, kind, ent) {
  if (!ent) return;
  const L = compactHpLayout(kind);
  const max = ent.maxHp > 0 ? ent.maxHp : 1;
  const pct = Math.max(0, Math.min(1, (ent.hp ?? 0) / max));
  const left = ent.x - L.w / 2;
  const top = kind === 'player' ? ent.y + L.offsetY : ent.y - L.offsetY - L.h;
  ctx.fillStyle = '#1A1A1A';
  ctx.fillRect(left, top, L.w, L.h);
  ctx.fillStyle = pct < 0.25 ? '#FF4D5E' : pct < 0.5 ? '#FF8A3D'
    : kind === 'player' ? '#39FF88' : '#FF8A3D';
  ctx.fillRect(left, top, L.w * pct, L.h);
  if (L.showText) {
    const txt = `${Math.ceil(ent.hp ?? 0)}`;
    ctx.font = `bold ${L.fontPx}px "Share Tech Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0A0D0B';
    ctx.strokeText(txt, ent.x, top - 2);
    ctx.fillStyle = '#E8E2D0';
    ctx.fillText(txt, ent.x, top - 2);
  }
}

export function drawCompactHp(ctx, state) {
  ctx.save();
  drawBar(ctx, 'player', state?.player);
  drawBar(ctx, 'enemy', state?.enemy);
  ctx.restore();
}
