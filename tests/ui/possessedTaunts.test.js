/**
 * tests/ui/possessedTaunts.test.js
 * Run: node tests/ui/possessedTaunts.test.js
 */
import assert from 'node:assert/strict';
import {
  TAUNTS, WINDUP_COOLDOWN_MS, DEMO_SPAWN, DEMO_DEATH, isDemoTaunts, pickTaunt,
  createTauntMachine, drawPossessedTaunt,
} from '../../src/ui/possessedTaunts.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.error(`FAIL: ${name}\n  ${e.message}`); }
}

const SPAWN = [
  'Nice build. Did a toddler pick it?',
  'I\'ve haunted toasters scarier than you.',
  'Oh good. Spare parts delivered.',
  'Your loadout is a cry for help.',
];
const WINDUP = [
  'Hold still. This won\'t hurt me.',
  'Smile for the afterlife.',
  'Dodge this, scrap metal.',
  'Counting down your warranty...',
];
const DEATH = [
  'I\'ll haunt your save file.',
  'Lucky. I was lagging.',
  'Tell the garage... I was robbed.',
  'This isn\'t over. I\'m literally a ghost.',
];

test('all 12 lines exact and <= 39 chars', () => {
  assert.deepEqual([...TAUNTS.spawn], SPAWN);
  assert.deepEqual([...TAUNTS.windup], WINDUP);
  assert.deepEqual([...TAUNTS.death], DEATH);
  for (const l of [...SPAWN, ...WINDUP, ...DEATH]) assert.ok(l.length <= 39, `${l} (${l.length})`);
  assert.equal(SPAWN.length + WINDUP.length + DEATH.length, 12);
});

test('isDemoTaunts flags', () => {
  assert.equal(isDemoTaunts('?demo=1'), true);
  assert.equal(isDemoTaunts('?x=2&taunts=demo'), true);
  assert.equal(isDemoTaunts('seed=demo'), true);
  assert.equal(isDemoTaunts('?demo=0'), false);
  assert.equal(isDemoTaunts(''), false);
  assert.equal(isDemoTaunts(undefined), false);
});

test('pickTaunt is rng-indexed and in range', () => {
  assert.equal(pickTaunt('spawn', () => 0), SPAWN[0]);
  assert.equal(pickTaunt('spawn', () => 0.999), SPAWN[3]);
  assert.equal(pickTaunt('death', () => 1), DEATH[3]);
});

test('demo forces spawn and death lines', () => {
  const m = createTauntMachine({ demo: true, rng: () => 0.9 });
  m.onSpawn(0); m.tick(0);
  assert.equal(m.current().text, DEMO_SPAWN);
  m.onDeath(10000); m.tick(10000);
  assert.equal(m.current().text, DEMO_DEATH);
  m.onWindup(20000); m.tick(20000);
  assert.ok(WINDUP.includes(m.current().text));
});

test('non-demo uses rng', () => {
  const m = createTauntMachine({ demo: false, rng: () => 0.9 });
  m.onSpawn(0); m.tick(0);
  assert.equal(m.current().text, SPAWN[3]);
});

test('windup suppressed at +1000, allowed at +8000', () => {
  let n = 0;
  const m = createTauntMachine({ rng: () => (n++ % 2 === 0 ? 0 : 0.99) });
  m.onWindup(1000); m.tick(1000);
  const first = m.current().text;
  assert.equal(first, WINDUP[0]);
  m.onWindup(2000); m.tick(2000);
  assert.equal(m.current().text, first, 'suppressed at +1000');
  m.onWindup(1000 + WINDUP_COOLDOWN_MS); m.tick(1000 + WINDUP_COOLDOWN_MS);
  assert.notEqual(m.current().text, first, 'allowed at +8000');
});

test('typewriter 32ms/char, hold, fade, then null', () => {
  const m = createTauntMachine({ demo: true });
  m.onSpawn(0);
  m.tick(0);
  assert.equal(m.current().typed.length, 1);
  m.tick(320);
  assert.equal(m.current().typed.length, 11);
  const len = DEMO_SPAWN.length;
  m.tick(len * 32 + 1000);
  const c = m.current();
  assert.equal(c.typed, DEMO_SPAWN);
  assert.equal(c.alpha, 1);
  m.tick(len * 32 + 2000 + 150);
  assert.ok(m.current().alpha > 0 && m.current().alpha < 1);
  m.tick(len * 32 + 2000 + 300);
  assert.equal(m.current(), null);
});

test('reset clears line and windup cooldown', () => {
  const m = createTauntMachine({ demo: true });
  m.onWindup(0); m.reset();
  assert.equal(m.current(), null);
  m.onWindup(100); m.tick(100);
  assert.ok(m.current());
});

test('drawPossessedTaunt: balanced, >=14px font, clamps on 390 wide', () => {
  const log = { saves: 0, restores: 0, x: [], font: '' };
  const target = {
    canvas: { width: 390 },
    save() { log.saves++; }, restore() { log.restores++; },
    measureText: (t) => ({ width: t.length * 9 }),
    fillText(t, x) { log.x.push(x); }, strokeText() {},
  };
  const ctx = new Proxy(target, { set(t, p, v) { t[p] = v; if (p === 'font') log.font = v; return true; } });
  const text = DEATH[3];
  drawPossessedTaunt(ctx, { text, typed: text, alpha: 1 }, { x: 380, y: 100 });
  assert.equal(log.saves, log.restores);
  assert.ok(parseInt(log.font, 10) >= 14);
  assert.ok(log.x[0] >= 0 && log.x[0] + text.length * 9 <= 390, `x ${log.x[0]}`);
  drawPossessedTaunt(ctx, null, { x: 0, y: 0 });
  assert.equal(log.saves, 1);
});

console.log(`possessedTaunts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
