/**
 * tests/engine/input.test.js
 *
 * Pure-function and state-manager tests for src/engine/input.js.
 * Runnable with Node (no browser, no framework):
 *
 *   node tests/engine/input.test.js
 *
 * Uses only Node's built-in assert module and ES module imports.
 */

import assert from 'node:assert/strict';
import {
  ACTIONS,
  KEY_TO_ACTION,
  BTN_TO_ACTION,
  DEFAULT_HOLD_MS,
  classifyPress,
  createInputState,
} from '../../src/engine/input.js';

// ── Minimal test harness ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ── classifyPress ─────────────────────────────────────────────────────────────

console.log('\nsrc/engine/input.js — classifyPress\n');

test('press shorter than threshold → tap', () => {
  assert.equal(classifyPress(0, 249), 'tap');
});

test('press at exact threshold → hold', () => {
  assert.equal(classifyPress(0, DEFAULT_HOLD_MS), 'hold');
});

test('press longer than threshold → hold', () => {
  assert.equal(classifyPress(0, 500), 'hold');
});

test('zero-duration press → tap', () => {
  assert.equal(classifyPress(100, 100), 'tap');
});

test('custom holdMs respected — just under → tap', () => {
  assert.equal(classifyPress(0, 99, 100), 'tap');
});

test('custom holdMs respected — exact boundary → hold', () => {
  assert.equal(classifyPress(0, 100, 100), 'hold');
});

test('non-zero downMs offset works correctly', () => {
  // down=1000ms, up=1200ms → 200ms duration, threshold 250 → tap
  assert.equal(classifyPress(1000, 1200), 'tap');
  // down=1000ms, up=1300ms → 300ms duration, threshold 250 → hold
  assert.equal(classifyPress(1000, 1300), 'hold');
});

test('DEFAULT_HOLD_MS is 250', () => {
  assert.equal(DEFAULT_HOLD_MS, 250);
});

// ── KEY_TO_ACTION ─────────────────────────────────────────────────────────────

console.log('\nsrc/engine/input.js — KEY_TO_ACTION\n');

test('W → MOVE_UP', () => {
  assert.equal(KEY_TO_ACTION['w'], ACTIONS.MOVE_UP);
});

test('A → MOVE_LEFT', () => {
  assert.equal(KEY_TO_ACTION['a'], ACTIONS.MOVE_LEFT);
});

test('S → MOVE_DOWN', () => {
  assert.equal(KEY_TO_ACTION['s'], ACTIONS.MOVE_DOWN);
});

test('D → MOVE_RIGHT', () => {
  assert.equal(KEY_TO_ACTION['d'], ACTIONS.MOVE_RIGHT);
});

test('ArrowUp → MOVE_UP', () => {
  assert.equal(KEY_TO_ACTION['arrowup'], ACTIONS.MOVE_UP);
});

test('ArrowLeft → MOVE_LEFT', () => {
  assert.equal(KEY_TO_ACTION['arrowleft'], ACTIONS.MOVE_LEFT);
});

test('ArrowDown → MOVE_DOWN', () => {
  assert.equal(KEY_TO_ACTION['arrowdown'], ACTIONS.MOVE_DOWN);
});

test('ArrowRight → MOVE_RIGHT', () => {
  assert.equal(KEY_TO_ACTION['arrowright'], ACTIONS.MOVE_RIGHT);
});

test('Q → BACK', () => {
  assert.equal(KEY_TO_ACTION['q'], ACTIONS.BACK);
});

test('Shift → DASH', () => {
  assert.equal(KEY_TO_ACTION['shift'], ACTIONS.DASH);
});

test('E → INTERACT', () => {
  assert.equal(KEY_TO_ACTION['e'], ACTIONS.INTERACT);
});

test('Space → PING', () => {
  assert.equal(KEY_TO_ACTION[' '], ACTIONS.PING);
});

test('F → WINGMAN', () => {
  assert.equal(KEY_TO_ACTION['f'], ACTIONS.WINGMAN);
});

test('KEY_TO_ACTION is frozen (immutable)', () => {
  assert.ok(Object.isFrozen(KEY_TO_ACTION));
});

test('all values in KEY_TO_ACTION are valid ACTIONS members', () => {
  const valid = new Set(Object.values(ACTIONS));
  for (const [key, action] of Object.entries(KEY_TO_ACTION)) {
    assert.ok(valid.has(action), `KEY_TO_ACTION['${key}'] = '${action}' is not in ACTIONS`);
  }
});

// ── BTN_TO_ACTION ─────────────────────────────────────────────────────────────

console.log('\nsrc/engine/input.js — BTN_TO_ACTION\n');

test('LMB (button 0) → FIRE_PRIMARY', () => {
  assert.equal(BTN_TO_ACTION[0], ACTIONS.FIRE_PRIMARY);
});

test('RMB (button 2) → FIRE_SECONDARY', () => {
  assert.equal(BTN_TO_ACTION[2], ACTIONS.FIRE_SECONDARY);
});

test('BTN_TO_ACTION is frozen (immutable)', () => {
  assert.ok(Object.isFrozen(BTN_TO_ACTION));
});

// ── ACTIONS ───────────────────────────────────────────────────────────────────

console.log('\nsrc/engine/input.js — ACTIONS\n');

test('ACTIONS contains all expected keys', () => {
  const expected = [
    'MOVE_UP', 'MOVE_LEFT', 'MOVE_DOWN', 'MOVE_RIGHT',
    'FIRE_PRIMARY', 'FIRE_SECONDARY',
    'BACK', 'DASH', 'INTERACT', 'PING', 'WINGMAN',
  ];
  for (const key of expected) {
    assert.ok(key in ACTIONS, `ACTIONS.${key} is missing`);
  }
});

test('ACTIONS is frozen (immutable)', () => {
  assert.ok(Object.isFrozen(ACTIONS));
});

// ── createInputState — keyboard ───────────────────────────────────────────────

console.log('\nsrc/engine/input.js — createInputState (keyboard)\n');

/** Build a minimal fake KeyboardEvent sufficient for the state manager. */
function fakeKey(key, timeStamp) {
  return { key, timeStamp };
}

test('isPressed returns false before any input', () => {
  const state = createInputState();
  assert.equal(state.isPressed(ACTIONS.MOVE_UP), false);
});

test('isPressed true after keydown, false after keyup', () => {
  const state = createInputState();
  state.onKeyDown(fakeKey('w', 0));
  assert.equal(state.isPressed(ACTIONS.MOVE_UP), true);
  state.onKeyUp(fakeKey('w', 100));
  assert.equal(state.isPressed(ACTIONS.MOVE_UP), false);
});

test('key lookup is case-insensitive (capital W)', () => {
  const state = createInputState();
  state.onKeyDown(fakeKey('W', 0));
  assert.equal(state.isPressed(ACTIONS.MOVE_UP), true);
  state.onKeyUp(fakeKey('W', 100));
  assert.equal(state.isPressed(ACTIONS.MOVE_UP), false);
});

test('consume returns null before a press completes', () => {
  const state = createInputState();
  assert.equal(state.consume(ACTIONS.INTERACT), null);
});

test('consume returns tap for a short press', () => {
  const state = createInputState();
  state.onKeyDown(fakeKey('e', 0));
  state.onKeyUp(fakeKey('e', 100));            // 100ms < 250ms
  assert.equal(state.consume(ACTIONS.INTERACT), 'tap');
});

test('consume returns hold for a long press', () => {
  const state = createInputState();
  state.onKeyDown(fakeKey('e', 0));
  state.onKeyUp(fakeKey('e', 400));            // 400ms ≥ 250ms
  assert.equal(state.consume(ACTIONS.INTERACT), 'hold');
});

test('consume clears the pending entry (each press returned once)', () => {
  const state = createInputState();
  state.onKeyDown(fakeKey('e', 0));
  state.onKeyUp(fakeKey('e', 100));
  assert.equal(state.consume(ACTIONS.INTERACT), 'tap');
  assert.equal(state.consume(ACTIONS.INTERACT), null);  // gone
});

test('repeated keydown while held does not reset the start time', () => {
  const state = createInputState();
  state.onKeyDown(fakeKey('e', 0));
  state.onKeyDown(fakeKey('e', 200));   // browser auto-repeat — should be ignored
  state.onKeyUp(fakeKey('e', 400));     // 400ms from original down → hold
  assert.equal(state.consume(ACTIONS.INTERACT), 'hold');
});

test('unknown key is silently ignored', () => {
  const state = createInputState();
  // Should not throw
  state.onKeyDown(fakeKey('z', 0));
  state.onKeyUp(fakeKey('z', 100));
  assert.equal(state.consume(ACTIONS.MOVE_UP), null);
});

// ── createInputState — F tap/hold (wingman orders) ───────────────────────────

console.log('\nsrc/engine/input.js — createInputState (F tap/hold)\n');

test('F tap → consume returns tap (Follow order)', () => {
  const state = createInputState();
  state.onKeyDown(fakeKey('f', 0));
  state.onKeyUp(fakeKey('f', 100));            // < 250ms
  assert.equal(state.consume(ACTIONS.WINGMAN), 'tap');
});

test('F hold → consume returns hold (Hold/Capture order)', () => {
  const state = createInputState();
  state.onKeyDown(fakeKey('f', 0));
  state.onKeyUp(fakeKey('f', 250));            // exactly 250ms → hold
  assert.equal(state.consume(ACTIONS.WINGMAN), 'hold');
});

test('F hold well above threshold → hold', () => {
  const state = createInputState();
  state.onKeyDown(fakeKey('f', 1000));
  state.onKeyUp(fakeKey('f', 1600));           // 600ms
  assert.equal(state.consume(ACTIONS.WINGMAN), 'hold');
});

test('F maps to the WINGMAN action', () => {
  assert.equal(KEY_TO_ACTION['f'], ACTIONS.WINGMAN);
});

test('F tap is a Follow-class order (tap, strictly below threshold)', () => {
  const state = createInputState();
  state.onKeyDown(fakeKey('f', 0));
  state.onKeyUp(fakeKey('f', DEFAULT_HOLD_MS - 1));   // 249ms → Follow
  const order = state.consume(ACTIONS.WINGMAN);
  assert.equal(order, 'tap', 'tap classifies as the Follow order');
});

test('F hold is a Hold/Capture order (hold, at/above threshold)', () => {
  const state = createInputState();
  state.onKeyDown(fakeKey('f', 0));
  state.onKeyUp(fakeKey('f', DEFAULT_HOLD_MS));       // 250ms → Hold/Capture
  const order = state.consume(ACTIONS.WINGMAN);
  assert.equal(order, 'hold', 'hold classifies as the Hold/Capture order');
});

test('F consume clears the pending order (returned exactly once)', () => {
  const state = createInputState();
  state.onKeyDown(fakeKey('f', 0));
  state.onKeyUp(fakeKey('f', 100));                   // Follow
  assert.equal(state.consume(ACTIONS.WINGMAN), 'tap');
  assert.equal(state.consume(ACTIONS.WINGMAN), null); // cleared
});

test('F case-insensitive: capital F still emits a wingman order', () => {
  const state = createInputState();
  state.onKeyDown(fakeKey('F', 0));
  state.onKeyUp(fakeKey('F', 100));
  assert.equal(state.consume(ACTIONS.WINGMAN), 'tap');
});

test('consume returns null before an F press completes (while still held)', () => {
  const state = createInputState();
  state.onKeyDown(fakeKey('f', 0));
  // No keyup yet: nothing to consume, but the key reads as pressed.
  assert.equal(state.isPressed(ACTIONS.WINGMAN), true);
  assert.equal(state.consume(ACTIONS.WINGMAN), null);
});

// ── createInputState — mouse ──────────────────────────────────────────────────

console.log('\nsrc/engine/input.js — createInputState (mouse)\n');

/** Build a minimal fake MouseEvent sufficient for the state manager. */
function fakeBtn(button, timeStamp) {
  return { button, timeStamp };
}

function fakeMove(offsetX, offsetY) {
  return { offsetX, offsetY };
}

test('LMB down → isPressed FIRE_PRIMARY true', () => {
  const state = createInputState();
  state.onMouseDown(fakeBtn(0, 0));
  assert.equal(state.isPressed(ACTIONS.FIRE_PRIMARY), true);
});

test('LMB up → isPressed FIRE_PRIMARY false, consume returns tap', () => {
  const state = createInputState();
  state.onMouseDown(fakeBtn(0, 0));
  state.onMouseUp(fakeBtn(0, 50));
  assert.equal(state.isPressed(ACTIONS.FIRE_PRIMARY), false);
  assert.equal(state.consume(ACTIONS.FIRE_PRIMARY), 'tap');
});

test('RMB tap → consume returns tap', () => {
  const state = createInputState();
  state.onMouseDown(fakeBtn(2, 0));
  state.onMouseUp(fakeBtn(2, 100));
  assert.equal(state.consume(ACTIONS.FIRE_SECONDARY), 'tap');
});

test('MMB (button 1) is silently ignored', () => {
  const state = createInputState();
  state.onMouseDown(fakeBtn(1, 0));
  state.onMouseUp(fakeBtn(1, 100));
  // Nothing to consume for any action
  assert.equal(state.consume(ACTIONS.FIRE_PRIMARY), null);
  assert.equal(state.consume(ACTIONS.FIRE_SECONDARY), null);
});

test('aimX / aimY start at 0', () => {
  const state = createInputState();
  assert.equal(state.aimX, 0);
  assert.equal(state.aimY, 0);
});

test('onMouseMove updates aimX and aimY', () => {
  const state = createInputState();
  state.onMouseMove(fakeMove(320, 240));
  assert.equal(state.aimX, 320);
  assert.equal(state.aimY, 240);
});

test('multiple mousemove events — last one wins', () => {
  const state = createInputState();
  state.onMouseMove(fakeMove(10, 20));
  state.onMouseMove(fakeMove(99, 77));
  assert.equal(state.aimX, 99);
  assert.equal(state.aimY, 77);
});

// ── No-disable guarantee ──────────────────────────────────────────────────────

console.log('\nsrc/engine/input.js — no-disable guarantee\n');

test('state manager has no enable/disable flag to be set', () => {
  const state = createInputState();
  // The public interface must not expose any property that silences input.
  assert.equal('enabled' in state, false);
  assert.equal('disabled' in state, false);
  assert.equal('blocked' in state, false);
});

test('input is recorded even when called many times in sequence', () => {
  const state = createInputState();
  // Simulate rapid input: press and consume several actions one after another.
  state.onKeyDown(fakeKey('w', 0));   state.onKeyUp(fakeKey('w', 50));
  state.onKeyDown(fakeKey('e', 60));  state.onKeyUp(fakeKey('e', 110));
  state.onKeyDown(fakeKey('f', 120)); state.onKeyUp(fakeKey('f', 370));   // hold

  assert.equal(state.consume(ACTIONS.MOVE_UP), 'tap');
  assert.equal(state.consume(ACTIONS.INTERACT), 'tap');
  assert.equal(state.consume(ACTIONS.WINGMAN), 'hold');
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
