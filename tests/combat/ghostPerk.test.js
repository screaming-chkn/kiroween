import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGhostPerk, maybeSpawnGhost, tryGrabGhost, ghostHealAmount,
  ghostSpawnPoint, drawGhostPerk, GHOST_SPAWN_MS, GHOST_HEAL_FRAC, GHOST_RADIUS,
} from '../../src/combat/ghostPerk.js';
import { createArena, updateArena } from '../../src/combat/arena.js';

test('ghostHealAmount is 10% of maxHp floored', () => {
  assert.equal(GHOST_HEAL_FRAC, 0.10);
  assert.equal(ghostHealAmount(140), 14);
  assert.equal(ghostHealAmount(440), 44);
  assert.equal(ghostHealAmount(0), 0);
});

test('maybeSpawnGhost stays inert before spawn gate', () => {
  const p = createGhostPerk();
  const next = maybeSpawnGhost(p, GHOST_SPAWN_MS - 1, { x: 200, y: 450 }, { x: 1000, y: 450 }, { width: 1200, height: 900 });
  assert.equal(next.active, false);
  assert.equal(next.spawned, false);
});

test('maybeSpawnGhost appears once between mechs after gate', () => {
  const p = createGhostPerk();
  const player = { x: 200, y: 450 };
  const enemy = { x: 1000, y: 450 };
  const arena = { width: 1200, height: 900 };
  const next = maybeSpawnGhost(p, GHOST_SPAWN_MS, player, enemy, arena);
  assert.equal(next.active, true);
  assert.equal(next.spawned, true);
  const mid = ghostSpawnPoint(player, enemy, arena);
  assert.equal(next.x, mid.x);
  assert.equal(next.y, mid.y);
  // Idempotent — already spawned
  const again = maybeSpawnGhost(next, GHOST_SPAWN_MS + 5000, player, enemy, arena);
  assert.equal(again.active, true);
  assert.equal(again.x, next.x);
});

test('tryGrabGhost: player-only heal clamps to maxHp', () => {
  const perk = { active: true, spawned: true, grabbed: false, x: 100, y: 100 };
  const player = { x: 100, y: 100, hp: 50, maxHp: 140 };
  const { perk: after, player: healed } = tryGrabGhost(perk, player);
  assert.equal(after.grabbed, true);
  assert.equal(after.active, false);
  assert.equal(healed.hp, 50 + 14);
});

test('tryGrabGhost: no grab when out of range', () => {
  const perk = { active: true, spawned: true, grabbed: false, x: 0, y: 0 };
  const player = { x: 500, y: 500, hp: 50, maxHp: 140 };
  const { perk: after, player: same } = tryGrabGhost(perk, player);
  assert.equal(after.active, true);
  assert.equal(same.hp, 50);
});

test('tryGrabGhost: clamps at maxHp', () => {
  const perk = { active: true, spawned: true, grabbed: false, x: 0, y: 0 };
  const player = { x: 0, y: 0, hp: 135, maxHp: 140 };
  const { player: healed } = tryGrabGhost(perk, player);
  assert.equal(healed.hp, 140);
});

test('drawGhostPerk paints when active', () => {
  const calls = [];
  const ctx = new Proxy({}, {
    get(_t, p) {
      if (p === 'calls') return calls;
      return (...args) => { calls.push([p, ...args]); };
    },
    set(_t, p, v) { calls.push(['set', p, v]); return true; },
  });
  drawGhostPerk(ctx, { active: true, grabbed: false, x: 600, y: 450 }, 1000);
  assert.ok(calls.some(c => c[0] === 'arc' || c[0] === 'ellipse'), calls.slice(0, 8));
});

test('arena integrates ghost spawn + grab over time', () => {
  let st = createArena({}, { enableGhostPerk: true });
  assert.ok(st.ghostPerk);
  assert.equal(st.ghostPerk.active, false);
  // Advance just past spawn gate with player sitting on spawn midpoint
  const steps = Math.ceil((GHOST_SPAWN_MS + 100) / (1000 / 60));
  for (let i = 0; i < steps; i++) {
    st = updateArena(st, { move: { dx: 0, dy: 0 } }, 1 / 60);
  }
  assert.equal(st.ghostPerk.spawned, true);
  // Move player onto the ghost
  st = {
    ...st,
    player: { ...st.player, x: st.ghostPerk.x, y: st.ghostPerk.y, hp: 40 },
  };
  const before = st.player.hp;
  st = updateArena(st, {}, 1 / 60);
  assert.equal(st.ghostPerk.grabbed, true);
  assert.ok(st.player.hp > before);
  assert.ok(st.player.hp <= st.player.maxHp);
  void GHOST_RADIUS;
});
