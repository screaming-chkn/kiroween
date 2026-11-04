/**
 * src/combat/combatRenderer.js
 *
 * Pure draw callbacks for the arena combat scene.
 *
 * Each exported function is a "layer callback" that plugs into the
 * renderer (src/engine/render.js) via registerLayer().
 *
 * Layers covered:
 *   WORLD   — floor grid + arena border walls
 *   ENTITY  — player mech, enemy mech, projectiles
 *   HUD     — player HP bar (≥7:1 on void bg), enemy HP bar above sprite
 *   OVERLAY — VICTORY / DESTROYED end-screen with restart button
 *
 * Design tokens (design-tokens.md):
 *   void    #0A0D0B  · panel   #121A15  · phosphor #39FF88
 *   bone    #E8E2D0  · ash     #8F9A92  · ember    #FF8A3D
 *   blood   #FF4D5E  · ghost   #9FD8FF  · phosphor-dim #1F9E57
 *
 * Accessibility (accessibility.md):
 *   - Player HP text is white (#E8E2D0) on void (#0A0D0B) → >7:1 contrast.
 *   - Enemy HP bar uses phosphor fill on ash track above sprite.
 *   - Win/lose overlay is keyboard-accessible: restart button has 2px ember
 *     focus ring and is auto-focused on mount.
 *   - No content flashes.
 *   - Shapes: player = hexagon, enemy = triangle (distinct by silhouette + color).
 */

// ── Design token colours ──────────────────────────────────────────────────────

const C = {
  void:         '#0A0D0B',
  panel:        '#121A15',
  phosphor:     '#39FF88',
  phosphorDim:  '#1F9E57',
  bone:         '#E8E2D0',
  ash:          '#8F9A92',
  ember:        '#FF8A3D',
  blood:        '#FF4D5E',
  ghost:        '#9FD8FF',
};

// ── WORLD layer ────────────────────────────────────────────────────────────────

/**
 * Draw the arena floor (grid) and border walls in world-space coordinates.
 * This is the LAYERS.WORLD callback.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ arena: { width: number, height: number } }} state
 */
export function drawWorld(ctx, state) {
  const { width, height } = state.arena;

  // ── Floor fill ──────────────────────────────────────────────────────────────
  ctx.fillStyle = C.panel;
  ctx.fillRect(0, 0, width, height);

  // ── Grid lines (faint, every 80 world units) ────────────────────────────────
  const GRID = 80;
  ctx.strokeStyle = C.phosphorDim;
  ctx.lineWidth   = 1;
  ctx.globalAlpha = 0.12;

  for (let x = GRID; x < width; x += GRID) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = GRID; y < height; y += GRID) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;

  // ── Border wall — 2 px phosphor-dim stroke rectangle (R11) ──────────────────
  ctx.strokeStyle = C.phosphorDim;
  ctx.lineWidth   = 2;
  // Inset by 1 px so the stroke sits wholly inside the arena rect.
  ctx.strokeRect(1, 1, width - 2, height - 2);
}

// ── ENTITY layer ───────────────────────────────────────────────────────────────

// Mech radius in world units (matches config.js MECH_RADIUS = 20).
const MECH_R = 20;

// Barrel length extending from the mech centre (aim direction indicator).
const BARREL_LEN = 30;

/**
 * Draw a regular N-gon centred at (cx, cy) with given radius.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @param {number} sides
 * @param {number} [startAngle=0]  Rotation offset in radians.
 */
function drawPolygon(ctx, cx, cy, radius, sides, startAngle = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = startAngle + (i / sides) * Math.PI * 2;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else          ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * Draw the aim barrel from a mech centre.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} angle  Radians.
 * @param {string} color
 */
function drawBarrel(ctx, cx, cy, angle, color) {
  const ex = cx + Math.cos(angle) * (MECH_R + BARREL_LEN);
  const ey = cy + Math.sin(angle) * (MECH_R + BARREL_LEN);
  ctx.strokeStyle = color;
  ctx.lineWidth   = 3;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(angle) * MECH_R, cy + Math.sin(angle) * MECH_R);
  ctx.lineTo(ex, ey);
  ctx.stroke();
}

/**
 * Draw the player mech as a hexagon (ghost-blue fill, phosphor outline).
 * Distinct from the enemy by both shape (6-sided) and color.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, angle: number, hp: number, maxHp: number }} mech
 */
function drawPlayerMech(ctx, mech) {
  const { x, y, angle } = mech;

  // Body — hexagon flat-top (rotate 90°)
  drawPolygon(ctx, x, y, MECH_R, 6, angle + Math.PI / 6);
  ctx.fillStyle   = C.ghost;
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = C.phosphor;
  ctx.lineWidth   = 2;
  ctx.stroke();

  // Aim barrel
  drawBarrel(ctx, x, y, angle, C.phosphor);

  // Centre dot
  ctx.fillStyle = C.void;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw the enemy mech as a triangle (blood-red fill, ember outline).
 * Distinct from the player by both shape (3-sided) and color.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, angle: number, hp: number, maxHp: number }} mech
 */
function drawEnemyMech(ctx, mech) {
  const { x, y, angle } = mech;

  // Body — equilateral triangle pointing in aim direction
  drawPolygon(ctx, x, y, MECH_R, 3, angle - Math.PI / 2);
  ctx.fillStyle   = C.blood;
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = C.ember;
  ctx.lineWidth   = 2;
  ctx.stroke();

  // Aim barrel
  drawBarrel(ctx, x, y, angle, C.ember);

  // Centre dot
  ctx.fillStyle = C.void;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw all live projectiles.
 * Player projectiles: small phosphor circles.
 * Enemy projectiles:  small ember circles.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{ x: number, y: number, owner: string }>} projectiles
 */
function drawProjectiles(ctx, projectiles) {
  for (const p of projectiles) {
    ctx.fillStyle = p.owner === 'player' ? C.phosphor : C.ember;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();

    // Glow ring
    ctx.strokeStyle = p.owner === 'player' ? C.phosphorDim : C.blood;
    ctx.lineWidth   = 1;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/**
 * LAYERS.ENTITY draw callback — mechs and projectiles.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ player: object, enemy: object, projectiles: Array }} state
 */
export function drawEntities(ctx, state) {
  drawProjectiles(ctx, state.projectiles);
  drawPlayerMech(ctx, state.player);
  drawEnemyMech(ctx,  state.enemy);
}

// ── HUD layer ──────────────────────────────────────────────────────────────────

// HUD layout constants (world-unit positions; camera transform is active here).
const HP_BAR_W      = 160;  // world units wide
const HP_BAR_H      = 12;   // world units tall
const PLAYER_BAR_OFFSET_Y = 36;  // below the player mech centre
const ENEMY_BAR_OFFSET_Y  = 32;  // above the enemy mech centre

/**
 * Draw an HP bar at world position (bx, by).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} bx          Bar left-edge x (world units).
 * @param {number} by          Bar top-edge y (world units).
 * @param {number} hp
 * @param {number} maxHp
 * @param {string} fillColor   Active portion color.
 * @param {string} label       Short text label (e.g. "HP").
 */
function drawHPBar(ctx, bx, by, hp, maxHp, fillColor, label) {
  const pct = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;

  // Track background
  ctx.fillStyle = '#1A1A1A';
  ctx.fillRect(bx, by, HP_BAR_W, HP_BAR_H);

  // Fill — color by health level
  let barColor = fillColor;
  if (pct < 0.25) barColor = C.blood;
  else if (pct < 0.5) barColor = C.ember;
  ctx.fillStyle = barColor;
  ctx.fillRect(bx, by, HP_BAR_W * pct, HP_BAR_H);

  // Subtle border
  ctx.strokeStyle = '#333';
  ctx.lineWidth   = 1;
  ctx.strokeRect(bx, by, HP_BAR_W, HP_BAR_H);

  // HP text — bone (#E8E2D0) on dark track, ≥7:1 contrast
  // Font size 11 world units → readable at default zoom; tabular nums.
  ctx.fillStyle   = C.bone;
  ctx.font        = `bold 10px "Share Tech Mono", monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign    = 'left';
  ctx.fillText(`${label} ${Math.ceil(hp)}/${maxHp}`, bx + 3, by + HP_BAR_H / 2);
}

/**
 * LAYERS.HUD draw callback — health bars.
 * Called in world-space (no shake) so elements track world positions.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ player: object, enemy: object }} state
 */
export function drawHUD(ctx, state) {
  const { player, enemy } = state;

  // Player bar — centred below player, phosphor fill
  drawHPBar(
    ctx,
    player.x - HP_BAR_W / 2,
    player.y + PLAYER_BAR_OFFSET_Y,
    player.hp,
    player.maxHp,
    C.phosphor,
    'HP',
  );

  // Enemy bar — centred above enemy, ember fill
  drawHPBar(
    ctx,
    enemy.x - HP_BAR_W / 2,
    enemy.y - ENEMY_BAR_OFFSET_Y - HP_BAR_H,
    enemy.hp,
    enemy.maxHp,
    C.ember,
    'EN',
  );
}

// ── OVERLAY layer ──────────────────────────────────────────────────────────────

/**
 * LAYERS.OVERLAY draw callback — win/lose end-screen.
 *
 * Renders a semi-transparent full-screen panel with title text and a
 * RESTART prompt. Keyboard handling (Enter/Space/click) is wired by main.js
 * via the onRestart callback stored on the returned state; this function only
 * draws the visual layer.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ phase: string }} state
 * @param {CameraState} _camera  (unused — overlay is in screen space)
 * @param {number} vpW           Viewport width in canvas pixels.
 * @param {number} vpH           Viewport height in canvas pixels.
 * @param {boolean} [restartReady]  True once the grace period has elapsed.
 */
export function drawOverlay(ctx, state, _camera, vpW, vpH, restartReady = false) {
  if (state.phase !== 'win' && state.phase !== 'lose') return;

  const isWin = state.phase === 'win';

  // Dim the game view behind the overlay (semi-opaque void)
  ctx.fillStyle   = C.void;
  ctx.globalAlpha = 0.82;
  ctx.fillRect(0, 0, vpW, vpH);
  ctx.globalAlpha = 1;

  const cx = vpW / 2;
  const cy = vpH / 2;

  // ── Title ──────────────────────────────────────────────────────────────────
  const titleText  = isWin ? 'VICTORY' : 'DESTROYED';
  const titleColor = isWin ? C.phosphor : C.blood;

  ctx.fillStyle    = titleColor;
  ctx.font         = `72px "VT323", monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign    = 'center';
  ctx.fillText(titleText, cx, cy - 40);

  // ── Subtitle ───────────────────────────────────────────────────────────────
  const subtitleText = isWin
    ? 'Enemy mech disabled.'
    : 'Your mech has been destroyed.';

  ctx.fillStyle    = C.ash;
  ctx.font         = `18px "Share Tech Mono", monospace`;
  ctx.fillText(subtitleText, cx, cy + 10);

  // ── Restart button box ─────────────────────────────────────────────────────
  // Only shown after the grace period has elapsed (BUG-1 fix).
  // During the grace period a dimmed "…" placeholder keeps the layout stable.
  const btnW  = 220;
  const btnH  = 52;
  const btnX  = cx - btnW / 2;
  const btnY  = cy + 44;

  if (restartReady) {
    // Button background
    ctx.fillStyle   = isWin ? C.phosphorDim : '#3a0a0f';
    ctx.fillRect(btnX, btnY, btnW, btnH);

    // Ember focus/hover ring (always visible as the only focusable element)
    ctx.strokeStyle = C.ember;
    ctx.lineWidth   = 2;
    ctx.strokeRect(btnX, btnY, btnW, btnH);

    // Button label
    ctx.fillStyle    = C.bone;
    ctx.font         = `22px "VT323", monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign    = 'center';
    ctx.fillText('Press Enter or click to restart', cx, btnY + btnH / 2);
  } else {
    // Grace period — show a muted placeholder (no interactive affordance yet).
    ctx.fillStyle    = C.ash;
    ctx.globalAlpha  = 0.45;
    ctx.font         = `22px "VT323", monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign    = 'center';
    ctx.fillText('…', cx, btnY + btnH / 2);
    ctx.globalAlpha  = 1;
  }
}
