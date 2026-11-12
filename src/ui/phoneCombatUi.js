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

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Screen rect (HUD-layer transform, no shake) of the player's HP bar. */
export function playerHpBarScreenRect(player, camera, vpW, vpH, compact) {
  const w = compact ? 56 : 160;
  const h = compact ? 5 : 12;
  const top = player.y + (compact ? 30 : 36);
  const extra = compact ? 0 : 16;
  const wx = player.x - w / 2;
  const z = camera.zoom;
  const x = vpW / 2 + (wx - camera.x) * z;
  const y = vpH / 2 + (top - extra - camera.y) * z;
  return { x, y, w: w * z, h: (h + extra) * z };
}

export function playerOnlyState(st) {
  return { ...st, enemy: { ...st.enemy, x: -1e6, y: -1e6 } };
}

/** Proxy ctx whose text draws are counter-scaled horizontally by kx. */
export function unsquashTextCtx(ctx, kx) {
  const wrap = (name) => (text, x, y, maxWidth) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(kx, 1);
    if (maxWidth !== undefined) ctx[name](text, 0, 0, maxWidth);
    else ctx[name](text, 0, 0);
    ctx.restore();
  };
  const fill = wrap('fillText');
  const stroke = wrap('strokeText');
  return new Proxy(ctx, {
    get(target, p) {
      if (p === 'fillText') return fill;
      if (p === 'strokeText') return stroke;
      const v = target[p];
      return typeof v === 'function' ? v.bind(target) : v;
    },
    set(target, p, v) {
      target[p] = v;
      return true;
    },
  });
}

export function drawEnemyShotGlow(ctx, projectiles) {
  if (!projectiles) return;
  for (const p of projectiles) {
    if (p.owner !== 'enemy') continue;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#FF4D5E';
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(p.x - (p.vx ?? 0) * 0.09, p.y - (p.vy ?? 0) * 0.09);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.fillStyle = '#FF4D5E';
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function pushAfterimage(buf, player, max = 3) {
  if (player && player.dashRemainingMs > 0) {
    buf.push({ x: player.x, y: player.y, angle: player.aimAngle ?? player.angle ?? 0 });
    while (buf.length > max) buf.shift();
  } else if (buf.length) {
    buf.shift();
  }
}

export function drawDashAfterimages(ctx, buf) {
  buf.forEach((a, i) => {
    ctx.save();
    ctx.strokeStyle = '#39FF88';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.12 * (i + 1);
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const ang = a.angle + (k * Math.PI) / 3;
      const px = a.x + Math.cos(ang) * 20;
      const py = a.y + Math.sin(ang) * 20;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  });
}

export function windupGlowStyle(remainingMs, windupMs, cssPerWu = 1) {
  if (!(remainingMs > 0) || !(windupMs > 0)) return null;
  const p = Math.max(0, Math.min(1, 1 - remainingMs / windupMs));
  const radius = 20 * (1.1 + 0.8 * p);
  const ringWidth = 3.5 / cssPerWu;
  const coreWidth = 1.5 / cssPerWu;
  return {
    progress: p,
    radius,
    ringWidth,
    coreWidth,
    coreRadius: radius - ringWidth / 2 - coreWidth / 2,
    alpha: 0.6 + 0.4 * p,
    coreAlpha: 0.4 + 0.6 * p,
    haloWidth: 10 / cssPerWu,
    haloAlpha: 0.12 + 0.28 * p,
  };
}

export function drawWindupGlow(ctx, enemy, windupMs, cssPerWu = 1) {
  const s = windupGlowStyle(enemy?.windupRemainingMs, windupMs, cssPerWu);
  if (!s) return;
  ctx.save();
  ctx.strokeStyle = '#FF4D5E';
  ctx.globalAlpha = s.haloAlpha;
  ctx.lineWidth = s.haloWidth;
  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y, s.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = s.alpha;
  ctx.lineWidth = s.ringWidth;
  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y, s.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#FFFFFF';
  ctx.globalAlpha = s.coreAlpha;
  ctx.lineWidth = s.coreWidth;
  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y, s.coreRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function compactHpLayout(kind) {
  return kind === 'player'
    ? { w: 56, h: 5, offsetY: 30, showText: false }
    : { w: 72, h: 5, offsetY: 30, showText: true, fontPx: 11 };
}

function drawBar(ctx, kind, ent, view) {
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
    let tx = ent.x;
    let ty = top - 2;
    if (view) {
      tx = Math.max(view.left + 24, Math.min(view.right - 24, tx));
      ty = Math.max(view.top + 14, ty);
    }
    ctx.strokeText(txt, tx, ty);
    ctx.fillStyle = '#E8E2D0';
    ctx.fillText(txt, tx, ty);
  }
}

export function drawCompactHp(ctx, state, view = null) {
  ctx.save();
  drawBar(ctx, 'player', state?.player, view);
  drawBar(ctx, 'enemy', state?.enemy, view);
  ctx.restore();
}
