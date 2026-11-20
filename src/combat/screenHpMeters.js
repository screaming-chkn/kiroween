/**
 * src/combat/screenHpMeters.js — fixed screen-space HP meters (C4 side-out).
 *
 * Layout 'side-out': vertical bars + labels sit JUST OUTSIDE the arena green
 * border (player left of left edge, enemy right of right edge). Never overlap
 * the playable field. Labels use mech names (P1 · RUSTBIT / CHOPPER) plus
 * cur/max via formatHudStat. Fill is orange; turns red at ≤25%.
 *
 * Legacy corner-v-inside helpers remain for older tests; live fight uses side-out.
 */
import { formatHudStat } from './hud.js';
import { worldToScreen } from '../engine/camera.js';
import { playerHudLabel, enemyHudLabel } from './mechNames.js';

export const SCREEN_HP_LAYOUT = 'side-out';

export const METER_ORANGE = '#FF8A3D';
export const METER_RED = '#FF4D5E';
export const METER_RED_PCT = 0.25;
export const METER_FRAME = '#39FF88';
export const METER_FONT = '"Press Start 2P", Orbitron, "Share Tech Mono", monospace';
export const METER_LINE_GAP = 8; // C8 = HUD_SPACE
/** Minimum CSS px between a meter group and the arena green border outer edge. */
/** CSS px between meter group and arena border (C8 = HUD_SPACE). */
export const METER_FIELD_GAP = 8;
/** CSS px between meter bar and HP/name text (C9e). */
export const METER_LABEL_GAP = 10;
/** CSS px clear space between taunt and each HP block (C9e). */
export const TAUNT_HP_GAP = 16;
export const ARENA_BORDER_WU = 2;

const C = {
  void: '#0A0D0B',
  bone: '#E8E2D0',
  track: '#0F1A14',
  player: '#39FF88',
  enemy: '#FF4D5E',
};

export function meterFillColor(pct) {
  return pct <= METER_RED_PCT ? METER_RED : METER_ORANGE;
}

function pctOf(ent) {
  const max = ent?.maxHp > 0 ? ent.maxHp : 0;
  if (!max) return 0;
  return Math.max(0, Math.min(1, (ent.hp ?? 0) / max));
}

export function screenHpTopReserve(layout = SCREEN_HP_LAYOUT) {
  if (layout === 'top') return 36;
  if (layout === 'corner-v') return 28;
  if (layout === 'side-out') return 8;
  return 0;
}

/** Bottom edge (canvas px) of the arena's green top border. */
export function arenaTopLineSy(camera, vpW, vpH, shakeX = 0, shakeY = 0, arenaCx = 0) {
  if (!camera || !Number.isFinite(camera.x) || !Number.isFinite(camera.y) || !Number.isFinite(camera.zoom)) {
    return 0;
  }
  const { sy } = worldToScreen(arenaCx, 0, camera, vpW, vpH, shakeX, shakeY);
  const bottom = sy + ARENA_BORDER_WU * camera.zoom;
  return Number.isFinite(bottom) ? bottom : 0;
}

/** Top edge (canvas px) of the arena's green top border. */
export function arenaTopLineTopSy(camera, vpW, vpH, shakeX = 0, shakeY = 0, arenaCx = 0) {
  if (!camera || !Number.isFinite(camera.x) || !Number.isFinite(camera.y) || !Number.isFinite(camera.zoom)) {
    return 0;
  }
  const { sy } = worldToScreen(arenaCx, 0, camera, vpW, vpH, shakeX, shakeY);
  return Number.isFinite(sy) ? sy : 0;
}

/** Bottom edge (canvas px) of the arena floor (world y = arenaH). */
export function arenaBottomLineSy(camera, vpW, vpH, arenaH, shakeX = 0, shakeY = 0, arenaCx = 0) {
  if (!camera || !Number.isFinite(camera.x) || !Number.isFinite(camera.y) || !Number.isFinite(camera.zoom)) {
    return Number.isFinite(vpH) ? vpH : 0;
  }
  const h = Number.isFinite(arenaH) ? arenaH : 0;
  const { sy } = worldToScreen(arenaCx, h, camera, vpW, vpH, shakeX, shakeY);
  return Number.isFinite(sy) ? sy : (Number.isFinite(vpH) ? vpH : 0);
}

/**
 * Outer canvas-px x of the arena's green left/right borders.
 * @returns {{ left: number, right: number }}
 */
export function arenaSideEdges(camera, vpW, vpH, arenaW, o = {}) {
  const l = worldToScreen(0, 0, camera, vpW, vpH, o.shakeX ?? 0, o.shakeY ?? 0).sx;
  const r = worldToScreen(arenaW, 0, camera, vpW, vpH, o.shakeX ?? 0, o.shakeY ?? 0).sx;
  const half = (ARENA_BORDER_WU * (camera?.zoom ?? 1)) / 2;
  return {
    left: Number.isFinite(l) ? l - half : 0,
    right: Number.isFinite(r) ? r + half : vpW,
  };
}

/** Legacy: insets that put meters inside the arena corners (C3). */
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

export function meterTopInset(lineBottom, scale = 1) {
  const s = scale > 0 ? scale : 1;
  return (Number.isFinite(lineBottom) ? lineBottom : 0) + METER_LINE_GAP * s;
}

export function meterFieldGapCss() {
  return METER_FIELD_GAP;
}

/**
 * Legacy corner-v geometry (inside field). Kept for older tests / helpers.
 */
export function cornerVGeometry(vpW, vpH, opts = {}) {
  const s = opts.scale > 0 ? opts.scale : 1;
  const top = Math.max(8, opts.topInset ?? 12);
  const thick = Math.max(12, Math.min(18, Math.round((vpW / s) * 0.014))) * s;
  const h = (opts.compact ? 56 : Math.max(72, Math.min(120, Math.round((vpH / s) * 0.14)))) * s;
  const leftX = Math.max(8 * s, opts.leftInset ?? 10);
  const rightEdge = vpW - Math.max(8 * s, opts.rightInset ?? 10);
  const fontPx = 16 * s;
  const gap = 4 * s;
  const labelH = fontPx * 1.2;
  const pw = Math.max(thick, 2 * fontPx);
  const ew = Math.max(thick, 5 * fontPx);
  const gh = h + gap + labelH;
  return {
    top, thick, h, fontPx, gap, scale: s,
    player: { x: leftX, y: top, w: pw, h: gh, barX: leftX },
    enemy: { x: rightEdge - ew, y: top, w: ew, h: gh, barX: rightEdge - thick },
  };
}

/**
 * C4 side-out geometry: groups entirely outside the arena left/right edges.
 * @param {number} vpW
 * @param {number} vpH
 * @param {{arenaLeft?:number, arenaRight?:number, topInset?:number, scale?:number, compact?:boolean, gapCss?:number}} [opts]
 */
export function sideOutGeometry(vpW, vpH, opts = {}) {
  const s = opts.scale > 0 ? opts.scale : 1;
  const gap = (opts.gapCss ?? METER_FIELD_GAP) * s;
  const top = Math.max(8 * s, opts.topInset ?? 12);
  // Compact (landscape C5b): thicker bar + larger HP digits; stay above stick yFrac 0.25.
  const thick = (opts.compact
    ? Math.max(14, Math.min(18, Math.round((vpW / s) * 0.016)))
    : Math.max(10, Math.min(14, Math.round((vpW / s) * 0.012)))) * s;
  const h = (opts.compact ? 48 : Math.max(72, Math.min(130, Math.round((vpH / s) * 0.15)))) * s;
  // C9e: Press Start ~1em/glyph — reserve full "P1 · RUSTBIT" / "440/440".
  const fontPx = (opts.compact ? 13 : 12) * s;       // mech name (C9j: phone-readable)
  const hpFontPx = (opts.compact ? 15 : 12) * s;     // cur/max
  const gapX = METER_LABEL_GAP * s; // ≥8 CSS px between bar and HP text
  // Labels sit BESIDE the bar (outward), so group height ≈ bar height.
  const labelW = Math.max(13 * fontPx, 8 * hpFontPx); // "P1 · RUSTBIT" / "440/440"
  const groupW = thick + gapX + labelW;
  const gh = h;
  const arenaLeft = Number.isFinite(opts.arenaLeft) ? opts.arenaLeft : vpW * 0.2;
  const arenaRight = Number.isFinite(opts.arenaRight) ? opts.arenaRight : vpW * 0.8;
  const edgePad = 2 * s;

  // Player: bar nearest the field; labels RIGHT-ALIGNED to bar−gap (grow outward).
  // Guarantees meter↔HP text ≥ METER_LABEL_GAP even when the gutter is tight.
  const pRight = arenaLeft - gap;
  const pBarX = pRight - thick;
  const pLabelAnchor = pBarX - gapX; // right edge of label column
  let pX = Math.min(pLabelAnchor - labelW, pBarX - gapX - labelW);
  if (pX < edgePad) pX = edgePad;
  const player = {
    x: pX, y: top, w: pRight - pX, h: gh,
    barX: pBarX, labelX: pLabelAnchor, labelAlign: 'right',
  };

  // Enemy: bar nearest the field; labels LEFT-ALIGNED to bar+thick+gap (grow outward).
  const eLeft = arenaRight + gap;
  const eBarX = eLeft;
  const eLabelAnchor = eBarX + thick + gapX; // left edge of label column
  let eRight = Math.max(eLabelAnchor + labelW, eLabelAnchor + labelW);
  if (eRight > vpW - edgePad) eRight = vpW - edgePad;
  const enemy = {
    x: eLeft, y: top, w: eRight - eLeft, h: gh,
    barX: eBarX, labelX: eLabelAnchor, labelAlign: 'left',
  };

  return {
    top, thick, h, fontPx, hpFontPx, gap: gapX, scale: s, layout: 'side-out',
    fieldGap: gap, arenaLeft, arenaRight,
    player, enemy,
  };
}

/** Horizontal reserve so centred taunt clears side meters. */
export function meterSideReserve(vpW, vpH, opts = {}) {
  const layout = opts.layout ?? SCREEN_HP_LAYOUT;
  const g = layout === 'side-out'
    ? sideOutGeometry(vpW, vpH, opts)
    : cornerVGeometry(vpW, vpH, opts);
  const s = g.scale;
  // C9e: taunt must clear each HP block by ≥ TAUNT_HP_GAP (16 CSS px).
  const clear = TAUNT_HP_GAP * s;
  return Math.max(g.player.x + g.player.w, vpW - g.enemy.x) + clear;
}

export function drawScreenHpMeters(ctx, state, vpW, vpH, opts = {}) {
  const layout = opts.layout ?? SCREEN_HP_LAYOUT;
  if (layout === 'side-out') drawSideOut(ctx, state, vpW, vpH, opts);
  else if (layout === 'corner-v') drawCornerV(ctx, state, vpW, vpH, opts);
  else if (layout === 'top') drawTop(ctx, state, vpW, vpH, opts);
  else drawVertical(ctx, state, vpW, vpH, opts);
}

function drawSideOut(ctx, state, vpW, vpH, opts) {
  const g = sideOutGeometry(vpW, vpH, opts);
  const pHp = formatHudStat(Math.ceil(state.player?.hp ?? 0), state.player?.maxHp ?? 0);
  const eHp = formatHudStat(Math.ceil(state.enemy?.hp ?? 0), state.enemy?.maxHp ?? 0);
  drawSideOutGroup(ctx, g, g.player, pctOf(state.player), playerHudLabel(), pHp, C.player);
  drawSideOutGroup(ctx, g, g.enemy, pctOf(state.enemy), enemyHudLabel(), eHp, C.enemy);
}

/** Name + HP beside the bar (outward). Bar top = box.y (aligned to arena top border). */
function drawSideOutGroup(ctx, g, box, pct, name, hpText, nameColor) {
  fillBar(ctx, box.barX, box.y, g.thick, g.h, pct);
  const lx = box.labelX;
  const align = box.labelAlign || 'left';
  let namePx = g.fontPx;
  let hpPx = g.hpFontPx || g.fontPx;
  // Fit labels into the outward gutter without crossing the bar (gap already in labelX).
  const gutter = align === 'right'
    ? Math.max(0, lx - (box.x ?? 0))
    : Math.max(0, (box.x + box.w) - lx);
  if (gutter > 0) {
    // Press Start 2P ≈ square glyphs; don't trust unloaded-font measureText alone.
    const fit = (text, px) => {
      ctx.font = `${px}px ${METER_FONT}`;
      const measured = (typeof ctx.measureText === 'function')
        ? (ctx.measureText(text)?.width ?? 0)
        : 0;
      const w = Math.max(measured, text.length * px * 0.98);
      if (w <= gutter) return px;
      return Math.max(8 * (g.scale || 1), Math.floor(px * gutter / w));
    };
    namePx = fit(name, namePx);
    hpPx = fit(hpText, hpPx);
  }
  // textBaseline top — glyphs sit at/below bar top, never above the neon line.
  drawColoredLabel(ctx, name, lx, box.y, align, namePx, nameColor);
  drawColoredLabel(ctx, hpText, lx, box.y + namePx * 1.25, align, hpPx, C.bone);
}

function drawCornerV(ctx, state, vpW, vpH, opts) {
  const g = cornerVGeometry(vpW, vpH, opts);
  drawVBar(ctx, g, g.player.barX, pctOf(state.player), playerHudLabel(), 'left');
  drawVBar(ctx, g, g.enemy.barX, pctOf(state.enemy), enemyHudLabel(), 'right');
}

function drawVertical(ctx, state, vpW, vpH, opts) {
  const top = Math.max(72, opts.topInset ?? 72);
  const bottom = Math.max(top + 80, vpH - Math.max(150, opts.bottomInset ?? 150));
  const thick = Math.max(10, Math.min(16, Math.round(vpW * 0.012)));
  const leftX = Math.max(8, opts.leftInset ?? 10);
  const rightX = vpW - Math.max(8, opts.rightInset ?? 10) - thick;
  const h = bottom - top;
  drawSideBar(ctx, leftX, top, thick, h, pctOf(state.player),
    `${playerHudLabel()} ${formatHudStat(state.player?.hp ?? 0, state.player?.maxHp ?? 0)}`, 'right');
  drawSideBar(ctx, rightX, top, thick, h, pctOf(state.enemy),
    `${enemyHudLabel()} ${formatHudStat(state.enemy?.hp ?? 0, state.enemy?.maxHp ?? 0)}`, 'left');
}

function strokeDottedRect(ctx, x, y, w, h) {
  // C7: crisp solid chamfered plate (no dash mush / no blur)
  ctx.save();
  ctx.strokeStyle = METER_FRAME;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'miter';
  ctx.setLineDash([]);
  const r = 2; // sharp chamfer radius
  const x0 = x + 0.5, y0 = y + 0.5, ww = w - 1, hh = h - 1;
  ctx.beginPath();
  ctx.moveTo(x0 + r, y0);
  ctx.lineTo(x0 + ww - r, y0);
  ctx.lineTo(x0 + ww, y0 + r);
  ctx.lineTo(x0 + ww, y0 + hh - r);
  ctx.lineTo(x0 + ww - r, y0 + hh);
  ctx.lineTo(x0 + r, y0 + hh);
  ctx.lineTo(x0, y0 + hh - r);
  ctx.lineTo(x0, y0 + r);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function fillBar(ctx, x, y, w, h, pct) {
  ctx.fillStyle = C.track;
  ctx.fillRect(x, y, w, h);
  const inset = w >= 14 ? 2 : 1;
  const fillH = h * pct;
  const fillY = y + h - fillH;
  ctx.fillStyle = meterFillColor(pct);
  ctx.fillRect(x + inset, fillY + 1, Math.max(0, w - inset * 2), Math.max(0, fillH - 2));
  strokeDottedRect(ctx, x, y, w, h);
}

function drawLabel(ctx, text, x, y, align, fontPx) {
  drawColoredLabel(ctx, text, x, y, align, fontPx, METER_FRAME);
}

function drawColoredLabel(ctx, text, x, y, align, fontPx, color) {
  ctx.font = `${fontPx}px ${METER_FONT}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = align;
  ctx.lineJoin = 'miter';
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.void;
  ctx.fillStyle = color;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

function drawVBar(ctx, g, x, pct, label, side) {
  fillBar(ctx, x, g.top, g.thick, g.h, pct);
  const ty = g.top + g.h + g.gap;
  if (side === 'left') drawLabel(ctx, label, x, ty, 'left', g.fontPx);
  else drawLabel(ctx, label, x + g.thick, ty, 'right', g.fontPx);
}

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
    `${playerHudLabel()} ${formatHudStat(state.player?.hp ?? 0, state.player?.maxHp ?? 0)}`);
  drawHBar(ctx, rightX, y, barW, barH, pctOf(state.enemy),
    `${enemyHudLabel()} ${formatHudStat(state.enemy?.hp ?? 0, state.enemy?.maxHp ?? 0)}`);
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
