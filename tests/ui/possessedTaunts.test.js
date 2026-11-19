/**
 * tests/ui/possessedTaunts.test.js
 * Run: node tests/ui/possessedTaunts.test.js
 */
import assert from 'node:assert/strict';
import {
  TAUNTS, WINDUP_COOLDOWN_MS, tauntBaselineY, ENEMY_LABEL_TOP_WU, specTauntLine as specLineForFix, DEMO_SPAWN, DEMO_DEATH, isDemoTaunts, pickTaunt,
  createTauntMachine, drawPossessedTaunt, specTauntLine,
  tauntUnderLineY, tauntAboveLineY, TAUNT_ABOVE_GAP, tauntSpeaker, tauntColor, TAUNT_COLOR_HOUND, TAUNT_COLOR_PLAYER,
} from '../../src/ui/possessedTaunts.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.error(`FAIL: ${name}\n  ${e.message}`); }
}

const SPAWN = [
  'You built that? I\'ll wear it next.',
  'Fresh metal. I can smell the warranty.',
  'Back again? The haunt missed you.',
  'I was spec\'d to beat you. Task done.',
];
const WINDUP = [
  'Feel that chill? That\'s the ring.',
  'Hold still. I\'m aiming for your soul.',
  'Dash late. I dare you.',
  'One tell. Then the toll.',
];
const HIT = [
  'That one\'s going in the séance log.',
  'Rattling your bolts yet?',
];
const LOW = [
  'Your HP is a ghost story now.',
  'So close to joining me.',
];
const ENEMY_DEATH = [
  'You can\'t kill what\'s already dead.',
  'Fine. I\'ll haunt your garage.',
];
const PLAYER_DEATH = [
  'Welcome to the haunt. Pull up a chain.',
  'Another mech for my collection.',
];

/** Count rng that always returns the same value. */
const fixed = (v) => () => v;
/** rng that returns the queued values in order. */
const seq = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };

test('all 16 lines exact and <= 39 chars', () => {
  assert.deepEqual([...TAUNTS.spawn], SPAWN);
  assert.deepEqual([...TAUNTS.windup], WINDUP);
  assert.deepEqual([...TAUNTS.hit], HIT);
  assert.deepEqual([...TAUNTS.lowHp], LOW);
  assert.deepEqual([...TAUNTS.enemyDeath], ENEMY_DEATH);
  assert.deepEqual([...TAUNTS.playerDeath], PLAYER_DEATH);
  const all = Object.values(TAUNTS).flat();
  assert.equal(all.length, 16);
  for (const l of all) assert.ok(l.length <= 39, `${l} (${l.length})`);
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
  assert.equal(pickTaunt('enemyDeath', () => 1), ENEMY_DEATH[1]);
  assert.equal(pickTaunt('playerDeath', () => 0.9), PLAYER_DEATH[1]);
  assert.equal(pickTaunt('nope', () => 0), '');
});

test('demo lines are spawn[0] and enemyDeath[0]', () => {
  assert.equal(DEMO_SPAWN, SPAWN[0]);
  assert.equal(DEMO_DEATH, ENEMY_DEATH[0]);
  const m = createTauntMachine({ demo: true, rng: fixed(0.9) });
  m.onSpawn(0); m.tick(0);
  assert.equal(m.current().text, DEMO_SPAWN);
  m.onEnemyDeath(10000); m.tick(10000);
  assert.equal(m.current().text, DEMO_DEATH);
  m.onWindup(20000); m.tick(20000);
  assert.ok(WINDUP.includes(m.current().text));
});

test('onDeath is an alias of onEnemyDeath', () => {
  const m = createTauntMachine({ rng: fixed(0.9) });
  m.onDeath(0); m.tick(0);
  assert.equal(m.current().text, ENEMY_DEATH[1]);
  const d = createTauntMachine({ demo: true });
  const { onDeath } = d;
  onDeath(0); d.tick(0);
  assert.equal(d.current().text, DEMO_DEATH);
});

test('non-demo uses rng', () => {
  const m = createTauntMachine({ demo: false, rng: fixed(0.9) });
  m.onSpawn(0); m.tick(0);
  assert.equal(m.current().text, SPAWN[3]);
});

test('windup suppressed inside cooldown, allowed at +8000', () => {
  const m = createTauntMachine({ rng: seq(0, 0.99) });
  m.onWindup(1000); m.tick(1000);
  const first = m.current().text;
  assert.equal(first, WINDUP[0]);
  m.onWindup(2000); m.tick(2000);
  assert.equal(m.current().text, first, 'suppressed at +1000');
  m.onWindup(1000 + WINDUP_COOLDOWN_MS); m.tick(1000 + WINDUP_COOLDOWN_MS);
  assert.equal(m.current().text, WINDUP[3], 'allowed at +8000');
});

test('windup and hit share one cooldown', () => {
  const m = createTauntMachine({ rng: fixed(0) });
  m.onWindup(0); m.tick(0);
  assert.equal(m.current().text, WINDUP[0]);
  // The first line has faded (>2.3 s + typing) but the cooldown still holds.
  m.tick(5000);
  assert.equal(m.current(), null);
  m.onHit(5000); m.tick(5000);
  assert.equal(m.current(), null, 'hit blocked by windup cooldown');
  m.onHit(WINDUP_COOLDOWN_MS); m.tick(WINDUP_COOLDOWN_MS);
  assert.equal(m.current().text, HIT[0]);
  m.tick(WINDUP_COOLDOWN_MS + 5000);
  m.onWindup(WINDUP_COOLDOWN_MS + 5000);
  m.tick(WINDUP_COOLDOWN_MS + 5000);
  assert.equal(m.current(), null, 'windup blocked by hit cooldown');
});

test('windup and hit never cut off a showing line', () => {
  const m = createTauntMachine({ demo: true, rng: fixed(0.5) });
  m.onSpawn(0); m.tick(0);
  m.tick(500);
  m.onWindup(500);
  m.onHit(600);
  m.tick(600);
  assert.equal(m.current().text, DEMO_SPAWN);
  // Blocked calls must not burn the cooldown: it is free once the line is gone.
  m.tick(10000);
  m.onHit(10000); m.tick(10000);
  assert.equal(m.current().text, pickTaunt('hit', () => 0.5));
});

test('low HP fires once per match, reset clears the latch', () => {
  const m = createTauntMachine({ rng: fixed(0) });
  m.onLowHp(0); m.tick(0);
  assert.equal(m.current().text, LOW[0]);
  m.tick(60000);
  m.onLowHp(60000); m.tick(60000);
  assert.equal(m.current(), null, 'second call ignored');
  m.reset();
  m.onLowHp(70000); m.tick(70000);
  assert.equal(m.current().text, LOW[0]);
});

test('low HP, spawn and deaths start even while a line shows', () => {
  const m = createTauntMachine({ rng: fixed(0) });
  m.onSpawn(0); m.tick(0);
  m.onLowHp(100); m.tick(100);
  assert.equal(m.current().text, LOW[0]);
  m.onPlayerDeath(200); m.tick(200);
  assert.equal(m.current().text, PLAYER_DEATH[0]);
  m.onEnemyDeath(300); m.tick(300);
  assert.equal(m.current().text, ENEMY_DEATH[0]);
});

test('onPlayerDeath uses a non-empty specLine, else the table', () => {
  const m = createTauntMachine({ rng: fixed(0.9) });
  m.onPlayerDeath(0, 'Task 10.32 done. So are you.'); m.tick(0);
  assert.equal(m.current().text, 'Task 10.32 done. So are you.');
  m.onPlayerDeath(0, ''); m.tick(0);
  assert.equal(m.current().text, PLAYER_DEATH[1]);
  m.onPlayerDeath(0, null); m.tick(0);
  assert.equal(m.current().text, PLAYER_DEATH[1]);
  m.onPlayerDeath(0, 42); m.tick(0);
  assert.equal(m.current().text, PLAYER_DEATH[1]);
});

const TASKS = [
  { spec: '10-polish', id: 32, title: 'x', done: true },
  { spec: '10-polish', id: 33, title: 'y', done: false },
  { spec: 'haunted-spec', id: 7, title: 'z', done: true },
];

test('specTauntLine format: numbered spec and plain id', () => {
  assert.equal(specTauntLine(TASKS, seq(0, 0)), 'Task 10.32 done. So are you.');
  assert.equal(specTauntLine(TASKS, seq(0, 0.99)), 'Task 7 done. So are you.');
});

test('specTauntLine fires about one time in three', () => {
  assert.equal(specTauntLine(TASKS, seq(0.34, 0)), null);
  assert.equal(specTauntLine(TASKS, seq(0.99, 0)), null);
  assert.ok(specTauntLine(TASKS, seq(0.33, 0)));
});

test('specTauntLine uses real done ids only', () => {
  for (let i = 0; i < 20; i++) {
    const line = specTauntLine(TASKS, seq(0, i / 20));
    assert.ok(line === 'Task 10.32 done. So are you.' || line === 'Task 7 done. So are you.', line);
  }
  const undone = [{ spec: '10-polish', id: 33, done: false }];
  assert.equal(specTauntLine(undone, seq(0, 0)), null);
});

test('specTauntLine: no data returns null', () => {
  assert.equal(specTauntLine(null, fixed(0)), null);
  assert.equal(specTauntLine(undefined, fixed(0)), null);
  assert.equal(specTauntLine({}, fixed(0)), null);
  assert.equal(specTauntLine([], fixed(0)), null);
});

test('specTauntLine: over 39 chars falls back to null', () => {
  const long = [{ spec: '10-polish', id: 'M4.5-32-extra-long', done: true }];
  assert.equal(specTauntLine(long, seq(0, 0)), null);
  const fits = [{ spec: '10-polish', id: 'M4.5-3', done: true }];
  const line = specTauntLine(fits, seq(0, 0));
  assert.ok(line === null || line.length <= 39);
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
    fillText(t, x) { log.x.push(x); }, strokeText() {}, fillRect() {},
  };
  const ctx = new Proxy(target, { set(t, p, v) { t[p] = v; if (p === 'font') log.font = v; return true; } });
  const text = PLAYER_DEATH[0];
  drawPossessedTaunt(ctx, { text, typed: text, alpha: 1 }, { x: 380, y: 100, sidePad: 8 });
  assert.equal(log.saves, log.restores);
  assert.ok(parseInt(log.font, 10) >= 14);
  assert.ok(log.x[0] >= 0 && log.x[0] + text.length * 9 <= 390, `x ${log.x[0]}`);
  drawPossessedTaunt(ctx, null, { x: 0, y: 0 });
  assert.equal(log.saves, 1);
});


test('specTauntLine drops the leading zero of a spec number (03-arena-combat -> 3.x)', () => {
  const r = [0, 0];
  const line = specLineForFix([{ spec: '03-arena-combat', id: 5, done: true }], () => r.shift() ?? 0);
  assert.equal(line, 'Task 3.5 done. So are you.');
});

test('bug 2: in-fight taunt baseline sits above the enemy HP label with a gap', () => {
  for (const [zoom, scale] of [[1, 1], [1.5, 1], [2, 2], [0.8, 2]]) {
    const enemyY = 600;
    const y = tauntBaselineY({ enemyY, zoom, scale, vpH: 1600 });
    const labelTop = enemyY - ENEMY_LABEL_TOP_WU * zoom;
    assert.ok(y <= labelTop - 4 * scale, `zoom ${zoom} scale ${scale}: baseline ${y} vs label top ${labelTop}`);
  }
});

test('bug 2: near the top edge the taunt moves below the enemy, not onto the label', () => {
  const zoom = 1; const scale = 1; const enemyY = 70;
  const y = tauntBaselineY({ enemyY, zoom, scale, vpH: 800 });
  const px = 14;
  assert.ok(y - px > enemyY, `glyph top ${y - px} below enemy centre ${enemyY}`);
  assert.ok(y - px >= enemyY + 20 * zoom, 'clear of the hull');
});

test('bug 2: baseline never enters the bottom HUD band', () => {
  const y = tauntBaselineY({ enemyY: 790, zoom: 1, scale: 1, vpH: 800 });
  assert.ok(y <= 800 - 140);
});

test('tauntBaselineY: a higher label (portrait compact bar) lifts the line above it', () => {
  const base = tauntBaselineY({ enemyY: 600, zoom: 0.5, scale: 2, vpH: 1688 });
  const lifted = tauntBaselineY({ enemyY: 600, zoom: 0.5, scale: 2, vpH: 1688, labelTopWu: 92.2 });
  assert.ok(lifted < base);
  assert.ok(lifted <= 600 - 92.2 * 0.5 - 8);
});


test('tauntSpeaker: current bank is HOUND; playerQuip is player', () => {
  assert.equal(tauntSpeaker('spawn'), 'hound');
  assert.equal(tauntSpeaker('windup'), 'hound');
  assert.equal(tauntSpeaker('playerDeath'), 'hound');
  assert.equal(tauntSpeaker('playerQuip'), 'player');
  assert.equal(tauntColor('hound'), TAUNT_COLOR_HOUND);
  assert.equal(tauntColor('player'), TAUNT_COLOR_PLAYER);
});

test('current() exposes speaker + color (HOUND red)', () => {
  const m = createTauntMachine({ demo: true });
  m.onSpawn(0); m.tick(0);
  const c = m.current();
  assert.equal(c.speaker, 'hound');
  assert.equal(c.color, TAUNT_COLOR_HOUND);
});

test('tauntUnderLineY sits just under the green line', () => {
  const y = tauntUnderLineY({ lineBottom: 100, scale: 1, gap: 4 });
  assert.equal(y, 100 + 4 + 14);
  const y2 = tauntUnderLineY({ lineBottom: 200, scale: 2, gap: 6 });
  assert.equal(y2, 200 + 12 + 28);
});

test('tauntAboveLineY sits just above the green field top', () => {
  const y = tauntAboveLineY({ lineTop: 100, scale: 1, gap: 6 });
  assert.equal(y, 94);
  const y2 = tauntAboveLineY({ lineTop: 200, scale: 2, gap: 6 });
  assert.equal(y2, 200 - 12);
  assert.equal(TAUNT_ABOVE_GAP, 8);
  assert.equal(tauntAboveLineY({ lineTop: 100, scale: 1 }), 92);
});


test('drawPossessedTaunt uses HOUND red fill', () => {
  const fills = [];
  const target = {
    canvas: { width: 390 },
    save() {}, restore() {},
    measureText: (t) => ({ width: t.length * 9 }),
    fillText() {}, strokeText() {}, fillRect() {},
  };
  const ctx = new Proxy(target, { set(t, p, v) { t[p] = v; if (p === 'fillStyle') fills.push(v); return true; } });
  drawPossessedTaunt(ctx, { text: 'x', typed: 'x', alpha: 1, speaker: 'hound', color: TAUNT_COLOR_HOUND }, { x: 195, y: 80 });
  assert.ok(fills.includes(TAUNT_COLOR_HOUND), fills);
  fills.length = 0;
  drawPossessedTaunt(ctx, { text: 'x', typed: 'x', alpha: 1, speaker: 'player' }, { x: 195, y: 80 });
  assert.ok(fills.includes(TAUNT_COLOR_PLAYER), fills);
});

console.log(`possessedTaunts: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
