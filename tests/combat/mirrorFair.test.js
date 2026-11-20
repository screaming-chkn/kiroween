/**
 * Mirror-fair maps/spawns: every wall sits on mid-X (or has an L/R mirror),
 * and player/enemy spawn X are symmetric about arena mid-X.
 */
import assert from 'node:assert/strict';
import { createArena } from '../../src/combat/arena.js';
import { wallsForLevel } from '../../src/combat/obstacle.js';
import {
  ARENA_WIDTH, ARENA_HEIGHT, SEVER_WALL_X, SEVER_WALL_Y,
  PLAYER_START_X, PLAYER_START_Y, ENEMY_START_X, ENEMY_START_Y,
} from '../../src/combat/config.js';

const MID_X = ARENA_WIDTH / 2;
const EPS = 1e-9;

function segmentOnMidline(w) {
  // Vertical segment whose x1===x2===mid, or horizontal spanning equally.
  if (Math.abs(w.x1 - MID_X) < EPS && Math.abs(w.x2 - MID_X) < EPS) return true;
  const cx = (w.x1 + w.x2) / 2;
  return Math.abs(cx - MID_X) < EPS && Math.abs(w.x1 - (2 * MID_X - w.x2)) < EPS;
}

function sameSeg(a, b) {
  const thick = Math.abs((a.thickness ?? 0) - (b.thickness ?? 0)) < EPS;
  const fwd = Math.abs(a.x1 - b.x1) < EPS && Math.abs(a.x2 - b.x2) < EPS
    && Math.abs(a.y1 - b.y1) < EPS && Math.abs(a.y2 - b.y2) < EPS;
  const rev = Math.abs(a.x1 - b.x2) < EPS && Math.abs(a.x2 - b.x1) < EPS
    && Math.abs(a.y1 - b.y2) < EPS && Math.abs(a.y2 - b.y1) < EPS;
  return thick && (fwd || rev);
}

function hasMirror(seg, all) {
  if (segmentOnMidline(seg)) return true;
  const mirrored = {
    x1: 2 * MID_X - seg.x1, y1: seg.y1,
    x2: 2 * MID_X - seg.x2, y2: seg.y2,
    thickness: seg.thickness,
  };
  return all.some(o => sameSeg(o, mirrored));
}

assert.equal(SEVER_WALL_X, MID_X, 'Sever Wall centre X is mid-line');
assert.equal(SEVER_WALL_Y, ARENA_HEIGHT / 2);

for (const lv of [1, 2, 3, 4, 5]) {
  const walls = wallsForLevel(lv);
  for (const w of walls) {
    assert.ok(hasMirror(w, walls), `lv${lv} wall must be mid-line or mirrored`);
  }
  const arena = createArena({}, { hauntLv: lv }).arena;
  const list = arena.walls ?? (arena.wall ? [arena.wall] : []);
  for (const w of list) {
    assert.ok(hasMirror(w, list), `createArena lv${lv} wall mirror-fair`);
  }
}

assert.ok(Math.abs(PLAYER_START_X + ENEMY_START_X - ARENA_WIDTH) < EPS,
  `spawn X not mirror-fair: ${PLAYER_START_X} vs ${ENEMY_START_X}`);
assert.equal(PLAYER_START_Y, ENEMY_START_Y);

const a = createArena({});
assert.ok(Math.abs(a.player.x + a.enemy.x - ARENA_WIDTH) < EPS, 'live spawn X mirror-fair');
assert.equal(a.player.y, a.enemy.y);

console.log('mirrorFair tests passed');
