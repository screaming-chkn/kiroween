/**
 * tests/ui/creditIcon.test.js — the gold $ coin is one original vector.
 * Run: node tests/ui/creditIcon.test.js
 */
import assert from 'node:assert/strict';
import { drawCreditIcon, creditIconSvg, CREDIT_GOLD } from '../../src/ui/creditIcon.js';

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}

function fakeCtx() {
  const log = { arcs: 0, fills: [], strokes: [], paths: 0 };
  const target = {
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    beginPath() { log.paths++; },
    arc() { log.arcs++; },
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    fill() { log.fills.push(target.fillStyle); },
    stroke() { log.strokes.push(target.strokeStyle); },
  };
  const ctx = new Proxy(target, {
    get(t, p) { return p in t ? t[p] : () => {}; },
    set(t, p, v) { t[p] = v; return true; },
  });
  return { ctx, log };
}

test('drawCreditIcon paints a gold disc', () => {
  const { ctx, log } = fakeCtx();
  drawCreditIcon(ctx, 10, 10, 8);
  assert.ok(log.arcs >= 1);
  assert.ok(log.fills.includes(CREDIT_GOLD), `fills=${log.fills}`);
  assert.ok(log.strokes.length >= 1);
});

test('creditIconSvg is an inline gold coin with a $ stroke', () => {
  const svg = creditIconSvg(16);
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes(CREDIT_GOLD));
  assert.ok(svg.includes('viewBox="0 0 32 32"'));
  assert.ok(/path/i.test(svg));
  assert.equal((svg.match(/<svg/g) || []).length, 1);
});

test('drawCreditIcon is a no-op for non-positive radius', () => {
  const { ctx, log } = fakeCtx();
  drawCreditIcon(ctx, 0, 0, 0);
  assert.equal(log.arcs, 0);
});

if (failed) { console.error(`${failed} failed`); process.exit(1); }
console.log('creditIcon: all passed');
