/**
 * src/combat/feel.js — M2 game-feel helpers (pure, Node-safe).
 *
 *   - gateTick / addHitStop: pause + hit-stop gating for the fixed-step sim.
 *   - traumaForImpact: camera trauma scaled by impact, capped, cut to almost
 *     nothing under reduced motion.
 *   - impactsForTick: where a hit landed (for sparks), from a state diff.
 *   - spark pool: fixed-size, allocation-free after creation (phone-cheap).
 *
 * The kill itself keeps its longer hit-stop in ui/killMoment.js (200 ms).
 */

/** Hit-stop on a player hit landing on the enemy (ms). */
export const HITSTOP_HIT_MS  = 60;
/** Hit-stop when the player gets hurt (ms). */
export const HITSTOP_HURT_MS = 40;
/** Hit-stops never stack past this (ms). */
export const HITSTOP_MAX_MS  = 80;

/**
 * Decide whether the sim steps this tick.
 * Paused: nothing moves (hit-stop timer frozen too). Hit-stop: sim frozen,
 * timer counts down (camera/sparks keep animating).
 *
 * @param {{paused:boolean, hitStopMs:number}} g
 * @param {number} dtMs
 * @returns {{step:boolean, paused:boolean, hitStopMs:number}}
 */
export function gateTick({ paused = false, hitStopMs = 0 } = {}, dtMs = 0) {
  if (paused) return { step: false, paused: true, hitStopMs };
  if (hitStopMs > 0) return { step: false, paused: false, hitStopMs: Math.max(0, hitStopMs - dtMs) };
  return { step: true, paused: false, hitStopMs: 0 };
}

/** Extend the current hit-stop to at least `ms`, capped at HITSTOP_MAX_MS. */
export function addHitStop(currentMs, ms) {
  return Math.min(HITSTOP_MAX_MS, Math.max(currentMs || 0, ms || 0));
}

/** Trauma caps per impact kind. */
export const TRAUMA = Object.freeze({
  hit:  { base: 0.10, perDmg: 1 / 400, cap: 0.25 },
  hurt: { base: 0.30, perDmg: 1 / 150, cap: 0.55 },
  kill: { base: 0.70, perDmg: 0,       cap: 0.70 },
});
/** Reduced motion keeps a whisper of shake (trauma² makes this ~0 px). */
export const REDUCED_TRAUMA_SCALE = 0.2;

/**
 * Camera trauma to add for one impact.
 * @param {'hit'|'hurt'|'kill'} kind
 * @param {number} damage
 * @param {boolean} reducedMotion
 */
export function traumaForImpact(kind, damage = 0, reducedMotion = false) {
  const t = TRAUMA[kind];
  if (!t) return 0;
  const v = Math.min(t.cap, t.base + Math.max(0, damage) * t.perDmg);
  return reducedMotion ? v * REDUCED_TRAUMA_SCALE : v;
}

/**
 * Hits that landed this tick, with an impact point and outward direction.
 * @returns {Array<{target:'enemy'|'player', damage:number, x:number, y:number, angle:number}>}
 */
export function impactsForTick(prev, next) {
  const out = [];
  if (!prev || !next) return out;
  const live = new Set((next.projectiles ?? []).map(p => p.id));
  const gone = (prev.projectiles ?? []).filter(p => !live.has(p.id));
  for (const [target, owner] of [['enemy', 'player'], ['player', 'enemy']]) {
    const a = prev[target];
    const b = next[target];
    if (!a || !b || !(b.hp < a.hp)) continue;
    let best = null;
    let bestD = Infinity;
    for (const p of gone) {
      if (p.owner !== owner) continue;
      const d = (p.x - b.x) ** 2 + (p.y - b.y) ** 2;
      if (d < bestD) { bestD = d; best = p; }
    }
    const x = best ? best.x : b.x;
    const y = best ? best.y : b.y;
    // Sparks fly back along the shot (or outward from the hull centre).
    const angle = best && (best.vx || best.vy)
      ? Math.atan2(-best.vy, -best.vx)
      : Math.atan2(y - b.y, x - b.x);
    out.push({ target, damage: a.hp - b.hp, x, y, angle });
  }
  return out;
}

// ── Spark pool ────────────────────────────────────────────────────────────────

export const SPARK_POOL_SIZE = 48;
export const SPARK_LIFE_MS   = 260;

/** Fixed-size pool. life <= 0 means free. */
export function createSparks(size = SPARK_POOL_SIZE) {
  const pool = [];
  for (let i = 0; i < size; i++) pool.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, hot: false });
  return pool;
}

/**
 * Emit `count` sparks in a cone around `angle`. Reuses the oldest slots when
 * full. `rand` is injectable for tests.
 */
export function spawnSparks(pool, { x, y, angle = 0, count = 8, spread = 1.1, speed = 260, hot = false }, rand = Math.random) {
  for (let n = 0; n < count; n++) {
    let slot = pool[0];
    for (const s of pool) {
      if (s.life <= 0) { slot = s; break; }
      if (s.life < slot.life) slot = s;
    }
    const a = angle + (rand() - 0.5) * spread * 2;
    const v = speed * (0.45 + rand() * 0.75);
    slot.x = x; slot.y = y;
    slot.vx = Math.cos(a) * v; slot.vy = Math.sin(a) * v;
    slot.max = SPARK_LIFE_MS * (0.6 + rand() * 0.6);
    slot.life = slot.max;
    slot.hot = hot;
  }
}

/** Advance sparks (seconds). Drag keeps them short. */
export function stepSparks(pool, dt) {
  const drag = Math.max(0, 1 - dt * 7);
  for (const s of pool) {
    if (s.life <= 0) continue;
    s.life -= dt * 1000;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vx *= drag;
    s.vy *= drag;
  }
}

/** Number of live sparks. */
export function liveSparks(pool) {
  let n = 0;
  for (const s of pool) if (s.life > 0) n++;
  return n;
}

/** Draw live sparks as short streaks (world space). One path per colour. */
export function drawSparks(ctx, pool) {
  for (const hot of [false, true]) {
    ctx.save();
    ctx.strokeStyle = hot ? '#FF3B5C' : '#FFE9B0';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    let any = false;
    for (const s of pool) {
      if (s.life <= 0 || s.hot !== hot) continue;
      const k = 0.022;
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * k, s.y - s.vy * k);
      any = true;
    }
    if (any) ctx.stroke();
    ctx.restore();
  }
}
