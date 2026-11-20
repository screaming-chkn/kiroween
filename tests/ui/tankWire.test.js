/**
 * tests/ui/tankWire.test.js — pure tests for the wireframe tank module.
 * Run: node tests/ui/tankWire.test.js
 */

import assert from 'node:assert/strict';
import {
  TILT, project, BOX_EDGES, boxCorners, TANK_SPECS, tankGeometry,
  updateHullHeading, drawTank, drawTankGhost, EDGE_STYLE, setEdgeStyle, TANK_PALETTE, setTankPalette,
  TANK_STYLE, TANK_STYLE_NAMES, setTankStyle, visualSpecs, TANK_DRAW_SCALE,
} from '../../src/ui/tankWire.js';

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

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

function fakeCtx() {
  const c = { saves: 0, restores: 0, segs: 0, fills: 0, strokes: 0 };
  const noop = () => {};
  return Object.assign(c, {
    save() { c.saves++; }, restore() { c.restores++; },
    moveTo() { c.segs++; }, lineTo() { c.segs++; },
    fill() { c.fills++; }, stroke() { c.strokes++; },
    beginPath: noop, closePath: noop, ellipse: noop, arc: noop,
    translate: noop, scale: noop, setLineDash: noop,
  });
}

console.log('\nsrc/ui/tankWire.js\n');

test('default TANK_STYLE is wheeled; hitbox footprint uses TANK_SPECS not visual', () => {
  assert.equal(TANK_STYLE, 'wheeled');
  assert.ok(TANK_STYLE_NAMES.includes('wheeled'));
  assert.equal(TANK_DRAW_SCALE, 1.5);
  const { footprint } = tankGeometry('player', 50, 60, 0.7, 0);
  const col = TANK_SPECS.player.hull;
  // Footprint half-diagonal of collision hull (not the taller visual 8x8)
  const maxR = Math.hypot(col.L / 2, col.W / 2) * 1.15;
  for (const p of footprint) assert.ok(Math.hypot(p.x - 50, p.y - 60) <= maxR);
});


test('project() applies the 3/4 tilt', () => {
  assert.deepEqual(TILT, { x: 0.35, y: 0.7 });
  const p = project(10, 20, 10);
  near(p.x, 13.5); near(p.y, 13);
  assert.deepEqual(project(5, 6, 0), { x: 5, y: 6 });
});

test('boxCorners returns 8 points; top shifted by (H*0.35, -H*0.7)', () => {
  const pts = boxCorners(100, 100, 0, 30, 20, 10, 0.4);
  assert.equal(pts.length, 8);
  for (let i = 0; i < 4; i++) {
    near(pts[i + 4].x - pts[i].x, 3.5);
    near(pts[i + 4].y - pts[i].y, -7);
  }
  const lifted = boxCorners(100, 100, 10, 30, 20, 10, 0.4);
  near(lifted[0].x - pts[0].x, 3.5);
  near(lifted[0].y - pts[0].y, -7);
});

test('BOX_EDGES: 12 unique pairs, each corner appears 3 times', () => {
  assert.equal(BOX_EDGES.length, 12);
  assert.equal(new Set(BOX_EDGES.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`)).size, 12);
  const count = new Array(8).fill(0);
  for (const [a, b] of BOX_EDGES) { count[a]++; count[b]++; }
  assert.deepEqual(count, new Array(8).fill(3));
});

test('player footprint stays near the 20-unit hitbox', () => {
  const { footprint } = tankGeometry('player', 50, 60, 0.7, 0);
  assert.equal(footprint.length, 4);
  for (const p of footprint) assert.ok(Math.hypot(p.x - 50, p.y - 60) <= 1.1 * 20);
});

test('enemy hull is bigger than player in L, W and H', () => {
  const p = TANK_SPECS.player.hull, e = TANK_SPECS.enemy.hull;
  assert.ok(e.L > p.L && e.W > p.W && e.H > p.H);
});

test('turret front direction matches turretAngle', () => {
  const prev = TANK_STYLE;
  try {
    setTankStyle('mech');
    for (const ang of [0, Math.PI / 2, Math.PI]) {
      const g = tankGeometry('player', 100, 100, 0.3, ang);
      const mid = { x: (g.turret[0].x + g.turret[1].x) / 2, y: (g.turret[0].y + g.turret[1].y) / 2 };
      const c = project(100, 100, TANK_SPECS.player.hull.H);
      near(Math.atan2(mid.y - c.y, mid.x - c.x), Math.atan2(Math.sin(ang), Math.cos(ang)), 1e-6);
    }
  } finally { setTankStyle(prev); }
});

test('wheeled C9g: player and enemy both single barrel (target family)', () => {
  // Collision TANK_SPECS.enemy.twin stays true; visual wheeled style is single.
  assert.equal(tankGeometry('enemy', 0, 0, 0, 0).barrels.length, 1);
  assert.equal(tankGeometry('player', 0, 0, 0, 0).barrels.length, 1);
  assert.equal(visualSpecs('enemy').twin, false);
  assert.equal(visualSpecs('player').twin, false);
});

test('updateHullHeading: move right -> 0', () => {
  near(updateHullHeading(1, { x: 0, y: 0 }, { x: 5, y: 0 }, 9), 0);
});
test('updateHullHeading: standing still keeps prev', () => {
  assert.equal(updateHullHeading(1.2, { x: 0, y: 0 }, { x: 0.1, y: 0 }, 9), 1.2);
});
test('updateHullHeading: null prev -> fallback', () => {
  assert.equal(updateHullHeading(null, null, { x: 0, y: 0 }, 3), 3);
});
test('updateHullHeading: jump >= 200 -> fallback', () => {
  assert.equal(updateHullHeading(1, { x: 0, y: 0 }, { x: 300, y: 0 }, 3), 3);
});

test('drawTank smoke: balanced save/restore, edges + barrels drawn', () => {
  for (const kind of ['player', 'enemy']) {
    const c = fakeCtx();
    drawTank(c, kind, 100, 100, 0.5, 1.0, 0);
    assert.equal(c.saves, c.restores);
    assert.ok(c.segs >= 24 + 1, `segs ${c.segs}`);
  }
});

test('drawTank flash adds a fill', () => {
  const a = fakeCtx(), b = fakeCtx();
  drawTank(a, 'player', 0, 0, 0, 0, 0);
  drawTank(b, 'player', 0, 0, 0, 0, 0.6);
  assert.ok(b.fills > a.fills);
});

test('drawTankGhost draws 24 chamfered hull edges, balanced', () => {
  const c = fakeCtx();
  drawTankGhost(c, 'player', 0, 0, 0, 0.3);
  assert.equal(c.saves, c.restores);
  assert.equal(c.segs, 48);
});

function dashCtx() {
  const c = fakeCtx();
  c.dashes = [];
  c.setLineDash = p => c.dashes.push(p.slice());
  return c;
}

test('EDGE_STYLE defaults to dashed-tech; TANK_PALETTE defaults to mono-green', () => {
  assert.equal(EDGE_STYLE, 'dashed-tech');
  assert.equal(TANK_PALETTE, 'mono-green');
});

test('default style draws balanced and resets lineDash to []', () => {
  const c = dashCtx();
  drawTank(c, 'player', 100, 100, 0.5, 1.0, 0);
  assert.equal(c.saves, c.restores);
  assert.ok(c.dashes.length > 0);
  assert.deepEqual(c.dashes[c.dashes.length - 1], []);
});

test('dashed/tech/dashed-tech draws balanced; dashed styles reset lineDash', () => {
  try {
    for (const style of ['dashed', 'tech', 'dashed-tech']) {
      setEdgeStyle(style);
      const c = dashCtx();
      drawTank(c, 'enemy', 100, 100, 0.5, 1.0, 0);
      assert.equal(c.saves, c.restores, style);
      if (style !== 'tech') {
        const L = visualSpecs('enemy').hull.L;
        const classic = [Math.max(4, 0.16 * L), Math.max(2, 0.06 * L)];
        assert.ok(c.dashes.length > 0, style);
        // C8 wheeled may emit dotted detail dashes before the classic edge dash.
        assert.ok(c.dashes.some(d => d.length === 2 && (
          (Math.abs(d[0] - classic[0]) < 1e-9 && Math.abs(d[1] - classic[1]) < 1e-9)
          || d[0] > 0
        )), style + ' missing dash pattern');
        assert.deepEqual(c.dashes[c.dashes.length - 1], [], style);
      }
    }
  } finally { setEdgeStyle('dashed-tech'); }
});

test('tech draws more segments than solid; solid never dashes', () => {
  const prev = TANK_STYLE;
  try {
    setTankStyle('mech');
    setEdgeStyle('solid');
    const a = dashCtx(); drawTank(a, 'player', 0, 0, 0, 0, 0);
    assert.equal(a.dashes.length, 0);
    setEdgeStyle('tech');
    const b = dashCtx(); drawTank(b, 'player', 0, 0, 0, 0, 0);
    assert.ok(b.segs > a.segs, `${b.segs} > ${a.segs}`);
  } finally { setEdgeStyle('dashed-tech'); setTankStyle(prev); }
});

function colorCtx() {
  const c = dashCtx();
  c.styles = new Set();
  let cur;
  Object.defineProperty(c, 'strokeStyle', {
    get: () => cur, set: v => { cur = v; c.styles.add(v); },
  });
  return c;
}

function drawColors(kind, flash = 0) {
  const c = colorCtx();
  c.fireFlash = flash;
  drawTank(c, kind, 0, 0, 0, 0, 0);
  return c.styles;
}

test('default draw: player #47FF9A, enemy #FF3B5C, no old colours/orange/gold', () => {
  // C9e wheeled: no glow underlay on hull/turret strokes (smoother). Line colours only.
  const p = drawColors('player');
  assert.ok(p.has('#47FF9A'));
  assert.ok(!p.has('#5CE1FF'));
  const e = drawColors('enemy');
  assert.ok(e.has('#FF3B5C'));
  for (const s of [p, e]) {
    assert.ok(!s.has('#39FF88'));
    assert.ok(!s.has('#FF4A4A'));
    assert.ok(!s.has('#5CE1FF'));
    assert.ok(!s.has('#FF8A3D'));
    assert.ok(!s.has('#FFBF3D'));
  }
});

test("setTankPalette('mono-blue'): player #3EF6FF, enemy still #FF3B5C", () => {
  try {
    setTankPalette('mono-blue');
    const p = drawColors('player');
    assert.ok(p.has('#3EF6FF'));
    assert.ok(!p.has('#47FF9A'));
    const e = drawColors('enemy');
    assert.ok(e.has('#FF3B5C'));
    for (const s of [p, e]) {
      assert.ok(!s.has('#FF8A3D'));
      assert.ok(!s.has('#FFBF3D'));
    }
  } finally { setTankPalette('mono-green'); setEdgeStyle('dashed-tech'); }
});


console.log(`\ntankWire: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
