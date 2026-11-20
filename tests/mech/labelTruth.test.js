/**
 * LABEL-TRUTH: every notch label equals the measured combat-sim effect.
 * Also: fresh localStorage → 0 credits, empty bars.
 */
import assert from 'node:assert/strict';
import {
  FIRE_COOLDOWN_MS, PLAYER_MAX_HP, dashCooldownForLoad,
} from '../../src/combat/config.js';
import { createArena } from '../../src/combat/arena.js';
import {
  SLOT_ORDER, MAX_NOTCH, defaultUpgradeState, notchLabel,
  deployTotalsFromUpgrades, loadUpgradeState, UPGRADES_LS_KEY,
  normalizeUpgradeState,
} from '../../src/mech/tankUpgrades.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}

const baseDash = dashCooldownForLoad((69 / 90) * 100);

function measure(slot, state) {
  const arena = createArena(deployTotalsFromUpgrades(state));
  const p = arena.player;
  switch (slot) {
    case 'tracks': {
      const pct = Math.round((p.moveSpeedMult - 1) * 100);
      return pct === 0 ? 'Speed +0%' : `Speed +${pct}%`;
    }
    case 'turret': {
      const label = `Dmg ${p.shotDamage}`;
      return p.breaksWalls ? `${label} · Breaks walls` : label;
    }
    case 'loader': {
      const ms = Math.round(FIRE_COOLDOWN_MS * p.fireCooldownMult);
      return `Reload ${(ms / 1000).toFixed(2)}s`;
    }
    case 'armor':
      return `HP ${p.maxHp}`;
    case 'dash': {
      const pct = Math.round((1 - p.dashCooldownBaseMs / baseDash) * 100);
      return pct === 0 ? 'Dash CD −0%' : `Dash CD −${pct}%`;
    }
    default:
      return '';
  }
}

console.log('\nLABEL-TRUTH + fresh save\n');

const truthRows = [];

test('isolated: every slot × every notch label === measured', () => {
  for (const slot of SLOT_ORDER) {
    for (let n = 0; n <= MAX_NOTCH; n++) {
      const state = { ...defaultUpgradeState(), [slot]: n };
      const label = notchLabel(slot, n, state);
      const measured = measure(slot, state);
      truthRows.push({ context: 'isolated', slot, n, label, measured, ok: label === measured });
      assert.equal(label, measured, `${slot}@${n}: label="${label}" measured="${measured}"`);
    }
  }
});

test('combined all-max: every bar label === measured', () => {
  const state = { ...defaultUpgradeState() };
  for (const k of SLOT_ORDER) state[k] = MAX_NOTCH;
  for (const slot of SLOT_ORDER) {
    const label = notchLabel(slot, state[slot], state);
    const measured = measure(slot, state);
    truthRows.push({ context: 'all-max', slot, n: state[slot], label, measured, ok: label === measured });
    assert.equal(label, measured, `all-max ${slot}: label="${label}" measured="${measured}"`);
  }
});

test('cross: loader notches with max turret stay truthful', () => {
  for (let n = 0; n <= MAX_NOTCH; n++) {
    const state = { ...defaultUpgradeState(), turret: MAX_NOTCH, loader: n };
    const label = notchLabel('loader', n, state);
    const measured = measure('loader', state);
    truthRows.push({ context: 'loader@max-turret', slot: 'loader', n, label, measured, ok: label === measured });
    assert.equal(label, measured, `loader@${n} w/ max turret`);
  }
});

test('fresh localStorage → 0 credits, empty bars, tier 1', () => {
  const store = {
    _d: {},
    getItem(k) { return this._d[k] ?? null; },
    setItem(k, v) { this._d[k] = String(v); },
  };
  const s = loadUpgradeState(store);
  assert.equal(s.credits, 0);
  assert.equal(s.wins, 0);
  assert.equal(s.tier, 1);
  for (const k of SLOT_ORDER) assert.equal(s[k], 0, k);
  assert.equal(store.getItem(UPGRADES_LS_KEY), null);
});

test('corrupt / missing save normalizes to empty zero-credit start', () => {
  const s = normalizeUpgradeState(null);
  assert.equal(s.credits, 0);
  for (const k of SLOT_ORDER) assert.equal(s[k], 0);
});

console.log(`\n${passed} passed, ${failed} failed`);

// Write LABEL-TRUTH.md for the pack
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const tip = execSync('git rev-parse --short HEAD').toString().trim();
let md = `# LABEL-TRUTH — tank upgrade bars\n\n`;
md += `**Tip:** \`${tip}\` · **When:** ${new Date().toISOString()} (America/Los_Angeles)\n\n`;
md += `Rule: garage label is computed from \`combatModsFromUpgrades\` (same path as \`createArena\`), then checked against the live player fields after deploy.\n\n`;
md += `## Fresh save\n\nCleared / missing \`localStorage[${UPGRADES_LS_KEY}]\` → **0 credits**, all bars **0**, tier **1**. First match starts with nothing to spend.\n\n`;
md += `## Isolated notches (others at 0)\n\n| Slot | Notch | Label | Measured | OK |\n|---|---:|---|---|:--:|\n`;
for (const r of truthRows.filter((x) => x.context === 'isolated')) {
  md += `| ${r.slot} | ${r.n} | ${r.label} | ${r.measured} | ${r.ok ? 'YES' : 'NO'} |\n`;
}
md += `\n## all-max + loader×max-turret\n\n| Context | Slot | Notch | Label | Measured | OK |\n|---|---|---:|---|---|:--:|\n`;
for (const r of truthRows.filter((x) => x.context !== 'isolated')) {
  md += `| ${r.context} | ${r.slot} | ${r.n} | ${r.label} | ${r.measured} | ${r.ok ? 'YES' : 'NO'} |\n`;
}
md += `\n**Result:** ${failed ? 'FAIL' : 'PASS'} (${passed} tests)\n`;
writeFileSync('team-archive/tank-upgrades/LABEL-TRUTH.md', md);
writeFileSync('team-archive/tank-upgrades/LABEL-TRUTH.json', JSON.stringify({ tip, rows: truthRows, failed }, null, 2));

if (failed) process.exit(1);
