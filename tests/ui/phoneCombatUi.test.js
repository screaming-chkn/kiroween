/**
 * tests/ui/phoneCombatUi.test.js — pure tests for phone combat UI helpers.
 * Run: node tests/ui/phoneCombatUi.test.js
 */
import assert from 'node:assert/strict';
import {
  END_CARD_W, END_CARD_BTN_H, TOUCH_MIN_PX, HUD_PANEL_W, HUD_PANEL_H,
  PHONE_HUD_TOP, PHONE_HUD_SCALE,
  endCardScale, scaleRects, phoneHudScale, phoneHudViewportH, hudPanelRect, phoneHudRect,
  circleOverlapsRect, windupGlowStyle, drawWindupGlow, compactHpLayout, drawCompactHp, landscapeStripW, phoneHudRightCss,
  rectsOverlap, playerHpBarScreenRect, playerOnlyState, unsquashTextCtx,
  drawEnemyShotGlow, pushAfterimage, drawDashAfterimages,
  EDGE_ARROW, edgeArrowPlacement, drawEdgeArrow,
  hitFlash, shouldPulseHp, hpPulseAlpha, resetHpFx,
} from '../../src/ui/phoneCombatUi.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.error(`FAIL: ${name}\n  ${e.message}`); }
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !~ ${b}`);

test('endCardScale desktop is 1,1', () => {
  assert.deepEqual(endCardScale({ touchUi: false, dpr: 3, cssW: 390 }), { sx: 1, sy: 1 });
});
test('endCardScale 390 @ dpr3 fits and buttons >= 44', () => {
  const { sx, sy } = endCardScale({ touchUi: true, dpr: 3, cssW: 390 });
  assert.ok(END_CARD_W * sx / 3 <= 374 + 1e-9);
  assert.ok(END_CARD_BTN_H * sy / 3 >= TOUCH_MIN_PX - 1e-9);
});
test('endCardScale 390 @ dpr1 buttons >= 44', () => {
  const { sy } = endCardScale({ touchUi: true, dpr: 1, cssW: 390 });
  assert.ok(END_CARD_BTN_H * sy >= TOUCH_MIN_PX - 1e-9);
});
test('endCardScale wide touch is uniform dpr', () => {
  assert.deepEqual(endCardScale({ touchUi: true, dpr: 2, cssW: 1024 }), { sx: 2, sy: 2 });
});
test('scaleRects maths and null', () => {
  const out = scaleRects([{ id: 'a', x: 1, y: 2, w: 3, h: 4 }], 2, 3);
  assert.deepEqual(out, [{ id: 'a', x: 2, y: 6, w: 6, h: 12 }]);
  assert.equal(scaleRects(null, 2, 2), null);
  assert.equal(scaleRects(undefined, 2, 2), null);
});
test('phoneHudViewportH puts panel top at PHONE_HUD_TOP', () => {
  assert.equal(hudPanelRect(phoneHudViewportH()).y, PHONE_HUD_TOP);
});
test('phone HUD fits width and clears stick zone at dpr 3', () => {
  const s = phoneHudScale(3);
  near(s, PHONE_HUD_SCALE * 3);
  const r = hudPanelRect(phoneHudViewportH());
  assert.ok((r.x + r.w) * s / 3 <= 390);
  assert.ok((r.y + r.h) * s / 3 < 0.45 * 844);
});
test('hudPanelRect(800)', () => {
  assert.deepEqual(hudPanelRect(800), { x: 20, y: 800 - 20 - HUD_PANEL_H, w: HUD_PANEL_W, h: HUD_PANEL_H });
});
test('circleOverlapsRect', () => {
  const r = { x: 10, y: 10, w: 20, h: 20 };
  assert.ok(circleOverlapsRect(20, 20, 1, r));
  assert.ok(circleOverlapsRect(5, 20, 5, r));
  assert.ok(!circleOverlapsRect(0, 20, 5, r));
});
test('windupGlowStyle null cases', () => {
  assert.equal(windupGlowStyle(0, 450), null);
  assert.equal(windupGlowStyle(undefined, 450), null);
  assert.equal(windupGlowStyle(100, 0), null);
});
test('windupGlowStyle values', () => {
  const a = windupGlowStyle(450, 450);
  near(a.progress, 0); near(a.radius, 22); near(a.ringWidth, 3.5); near(a.alpha, 0.6); near(a.haloAlpha, 0.12);
  near(a.coreWidth, 1.5); near(a.coreAlpha, 0.4);
  near(a.coreRadius, 22 - 1.75 - 0.75);
  const z = windupGlowStyle(450, 450, 1.1);
  near(z.ringWidth * 1.1, 3.5);
  const b = windupGlowStyle(0.001, 450);
  assert.ok(b.progress > 0.999);
  near(Math.round(b.radius * 1000) / 1000, 38);
  for (let ms = 1; ms <= 450; ms += 7) {
    const s = windupGlowStyle(ms, 450);
    assert.ok(s.alpha >= 0.6 && s.ringWidth === 3.5);
  }
});
test('rectsOverlap / playerHpBarScreenRect / playerOnlyState', () => {
  assert.ok(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }));
  assert.ok(!rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 }));
  const r = playerHpBarScreenRect({ x: 100, y: 100 }, { x: 100, y: 100, zoom: 2 }, 400, 800, true);
  near(r.w, 112); near(r.h, 10); near(r.x, 200 - 56); near(r.y, 400 + 60);
  const d = playerHpBarScreenRect({ x: 100, y: 100 }, { x: 100, y: 100, zoom: 1 }, 400, 800, false);
  near(d.w, 160); near(d.y, 400 + 36 - 16); near(d.h, 28);
  const st = playerOnlyState({ player: { x: 1 }, enemy: { x: 5, y: 6, hp: 3 } });
  assert.equal(st.enemy.x, -1e6); assert.equal(st.enemy.hp, 3);
});
test('windup draws white core', () => {
  const styles = [];
  const ctx = new Proxy({}, {
    get(_, k) { return () => {}; },
    set(_, k, v) { if (k === 'strokeStyle') styles.push(v); return true; },
  });
  drawWindupGlow(ctx, { x: 0, y: 0, windupRemainingMs: 200 }, 450, 1.1);
  assert.ok(styles.includes('#FFFFFF'));
});
test('unsquashTextCtx translates + scales text, passes props', () => {
  const log = [];
  const real = {
    font: '',
    save() { log.push('save'); }, restore() { log.push('restore'); },
    translate(x, y) { log.push(['translate', x, y]); },
    scale(x, y) { log.push(['scale', x, y]); },
    fillText(...a) { log.push(['fillText', ...a]); },
    strokeText(...a) { log.push(['strokeText', ...a]); },
  };
  const c = unsquashTextCtx(real, 0.5);
  c.font = '12px x';
  assert.equal(real.font, '12px x');
  assert.equal(c.font, '12px x');
  c.fillText('hi', 10, 20);
  assert.deepEqual(log, ['save', ['translate', 10, 20], ['scale', 0.5, 1], ['fillText', 'hi', 0, 0], 'restore']);
  log.length = 0;
  c.strokeText('hi', 1, 2, 30);
  assert.deepEqual(log[3], ['strokeText', 'hi', 0, 0, 30]);
});
test('drawEnemyShotGlow only enemy shots', () => {
  const { ctx, calls } = fakeCtx();
  drawEnemyShotGlow(ctx, [{ owner: 'player', x: 0, y: 0, vx: 1, vy: 0 }]);
  assert.equal(calls.length, 0);
  drawEnemyShotGlow(ctx, [{ owner: 'enemy', x: 0, y: 0, vx: 100, vy: 0 }]);
  assert.equal(calls.filter(c => c === 'arc').length, 2);
  assert.equal(calls.filter(c => c === 'save').length, calls.filter(c => c === 'restore').length);
});
test('pushAfterimage keeps last 3, drains when not dashing', () => {
  const buf = [];
  for (let i = 0; i < 5; i++) pushAfterimage(buf, { x: i, y: 0, dashRemainingMs: 50, aimAngle: 1 });
  assert.equal(buf.length, 3); assert.equal(buf[0].x, 2);
  pushAfterimage(buf, { x: 9, y: 0, dashRemainingMs: 0 });
  assert.equal(buf.length, 2);
  const { ctx, calls } = fakeCtx();
  drawDashAfterimages(ctx, buf);
  assert.equal(calls.filter(c => c === 'stroke').length, 2);
});
test('drawCompactHp clamps enemy number inside view', () => {
  const pos = [];
  const ctx = new Proxy({}, {
    get(_, k) { return (...a) => { if (k === 'fillText') pos.push([a[1], a[2]]); }; },
    set() { return true; },
  });
  drawCompactHp(ctx, { player: { x: 0, y: 0, hp: 1, maxHp: 1 }, enemy: { x: -50, y: 0, hp: 5, maxHp: 10 } },
    { left: 0, right: 100, top: 0, bottom: 100 });
  assert.equal(pos[0][0], 44);   // wider clamp: the label now reads "HOUND n"
  assert.ok(pos[0][1] >= 14);
});
test('drawCompactHp: enemy label names the HOUND', () => {
  const txt = [];
  const ctx = new Proxy({}, {
    get(_, k) { return (...a) => { if (k === 'fillText') txt.push(a[0]); }; },
    set() { return true; },
  });
  drawCompactHp(ctx, { player: { x: 0, y: 0, hp: 1, maxHp: 1 }, enemy: { x: 0, y: 0, hp: 1200, maxHp: 1200 } });
  assert.equal(txt[0], 'HOUND 1200');
});
test('landscapeStripW: the arena clears the HUD panel at 844x390 DPR 2', () => {
  const vpW = 844 * 2;
  const w = landscapeStripW(vpW, 2, 0.22);
  const arenaLeftCss = (vpW - w * 0.95) / 2 / 2;   // fitZoom keeps a 0.95 margin
  assert.ok(arenaLeftCss >= phoneHudRightCss() + 8, `arena left ${arenaLeftCss} vs HUD ${phoneHudRightCss()}`);
  assert.ok(w <= vpW * (1 - 2 * 0.22));
  assert.ok(w > 0);
});
test('compactHpLayout', () => {
  const p = compactHpLayout('player');
  assert.equal(p.showText, false);
  assert.ok(p.w < 160);
  assert.equal(compactHpLayout('enemy').showText, true);
});

test('compactHpLayout offsets: enemy lifted by scaled hull radius, player unchanged', () => {
  near(compactHpLayout('enemy').offsetY, 30 + 1.3 * (40 / 2 + 28 / 2));
  assert.equal(compactHpLayout('player').offsetY, 30);
});
test('drawCompactHp enemy label uses a 1 px outline', () => {
  let lw = null;
  const ctx = new Proxy({}, {
    get(t, k) { return (...a) => { if (k === 'strokeText') lw = t.lineWidth; }; },
    set(t, k, v) { t[k] = v; return true; },
  });
  drawCompactHp(ctx, { player: { x: 0, y: 0, hp: 1, maxHp: 1 }, enemy: { x: 0, y: 0, hp: 5, maxHp: 10 } });
  assert.ok(lw > 0 && lw <= 1);
});

function fakeCtx() {
  const calls = [];
  const ctx = new Proxy({}, {
    get(_, k) { return (...a) => { calls.push(k); }; },
    set(_, k) { calls.push(`set:${String(k)}`); return true; },
  });
  return { ctx, calls };
}
test('drawWindupGlow smoke', () => {
  const { ctx, calls } = fakeCtx();
  drawWindupGlow(ctx, { x: 5, y: 5, windupRemainingMs: 200 }, 450);
  assert.equal(calls.filter(c => c === 'save').length, calls.filter(c => c === 'restore').length);
  assert.ok(calls.includes('arc'));
  const n = fakeCtx();
  drawWindupGlow(n.ctx, { x: 0, y: 0 }, 450);
  assert.equal(n.calls.length, 0);
});
test('drawCompactHp smoke', () => {
  const { ctx, calls } = fakeCtx();
  drawCompactHp(ctx, {
    player: { x: 1, y: 1, hp: 50, maxHp: 100 },
    enemy: { x: 9, y: 9, hp: 12.4, maxHp: 100 },
  });
  assert.equal(calls.filter(c => c === 'save').length, calls.filter(c => c === 'restore').length);
  assert.equal(calls.filter(c => c === 'fillText').length, 1);
});

test('phoneHudRect(3) is the scaled panel rect', () => {
  assert.deepEqual(phoneHudRect(3), { x: 60, y: 45, w: 720, h: 384 });
});
test('phoneHudRect overlap: inside overlaps, y = 0.6*2532 does not', () => {
  const r = phoneHudRect(3);
  assert.ok(circleOverlapsRect(100, 100, 30, r));
  assert.ok(!circleOverlapsRect(100, 0.6 * 2532, 30, r));
});
// ── Enemy edge arrow ─────────────────────────────────────────────────────────
const EA = { enabled: true, cssW: 390, cssH: 844, er: 0 };
const place = (ex, ey, extra = {}) => edgeArrowPlacement({ ...EA, ex, ey, ...extra });

test('edgeArrow disabled -> null', () => {
  assert.equal(place(-500, 400, { enabled: false }), null);
});
test('edgeArrow on-screen enemy -> null', () => {
  assert.equal(place(195, 422), null);
});
test('edgeArrow off-screen but radius overlaps edge -> null', () => {
  assert.equal(place(-10, 400, { er: 20 }), null);
  assert.notEqual(place(-30, 400, { er: 20 }), null);
});
test('edgeArrow far right', () => {
  const p = place(2000, 422);
  assert.equal(p.edge, 'right');
  near(p.x, 390 - EDGE_ARROW.margin);
  assert.ok(Math.abs(p.angle) < 1e-9);
});
test('edgeArrow far left', () => {
  const p = place(-2000, 422);
  assert.equal(p.edge, 'left');
  near(p.x, EDGE_ARROW.margin);
  assert.ok(Math.abs(Math.abs(p.angle) - Math.PI) < 1e-9);
});
test('edgeArrow far above honours insetTop', () => {
  const p = place(195, -2000, { insetTop: 47 });
  assert.equal(p.edge, 'top');
  near(p.y, 24 + 47);
  near(p.angle, -Math.PI / 2);
  near(place(195, -2000).y, 24);
});
test('edgeArrow far below stays above bottomLimit', () => {
  const p = place(195, 3000, { bottomLimit: 700 });
  assert.equal(p.edge, 'bottom');
  assert.ok(p.y <= 700);
  near(p.angle, Math.PI / 2);
});
test('edgeArrow corners point the right way and stay in bounds', () => {
  const corners = [[-500, -500, -1, -1], [900, -500, 1, -1], [-500, 1500, -1, 1], [900, 1500, 1, 1]];
  for (const [ex, ey, sx, sy] of corners) {
    const p = place(ex, ey, { bottomLimit: 700 });
    assert.equal(Math.sign(Math.cos(p.angle)), sx);
    assert.equal(Math.sign(Math.sin(p.angle)), sy);
    assert.ok(p.x >= 24 - 1e-9 && p.x <= 366 + 1e-9, `x ${p.x}`);
    assert.ok(p.y >= 24 - 1e-9 && p.y <= 700 + 1e-9, `y ${p.y}`);
  }
});
test('edgeArrow moves below the HUD when it would overlap', () => {
  const hud = { x: 16, y: 12, w: 192, h: 103 };
  const raw = place(-100, -1000);
  assert.ok(raw.y < 115);
  const p = place(-100, -1000, { hud });
  assert.ok(p.y >= 12 + 103 + 10);
  near(p.x, raw.x);
});
test('drawEdgeArrow smoke', () => {
  const { ctx, calls } = fakeCtx();
  drawEdgeArrow(ctx, { x: 10, y: 20, angle: 1, edge: 'left' }, 2);
  assert.equal(calls.filter(c => c === 'save').length, calls.filter(c => c === 'restore').length);
  assert.ok(calls.includes('fill') && calls.includes('stroke'));
  const n = fakeCtx();
  drawEdgeArrow(n.ctx, null);
  assert.equal(n.calls.length, 0);
});

test('hitFlash: active 150ms, red, 2px shake', () => {
  assert.equal(hitFlash(100, 100).active, true);
  assert.equal(hitFlash(100, 100).color, '#FF4D5E');
  assert.equal(Math.abs(hitFlash(100, 100).shakePx), 2);
  assert.equal(Math.abs(hitFlash(160, 100).shakePx), 2);
  assert.equal(hitFlash(100 + 149, 100).active, true);
  assert.equal(hitFlash(100 + 150, 100).active, false);
  assert.equal(hitFlash(100, 200).active, false);
  assert.equal(hitFlash(100, -Infinity).active, false);
  assert.equal(hitFlash(120, 100).shakePx, 2);
  assert.equal(hitFlash(160, 100).shakePx, -2);
});
test('shouldPulseHp under 25% only while alive', () => {
  assert.equal(shouldPulseHp(74, 300), true);
  assert.equal(shouldPulseHp(75, 300), false);
  assert.equal(shouldPulseHp(0, 300), false);
  assert.equal(shouldPulseHp(10, 0), false);
});
test('hpPulseAlpha stays in 0.65..1', () => {
  for (let t = 0; t < 1000; t += 17) {
    const a = hpPulseAlpha(t);
    assert.ok(a >= 0.65 - 1e-9 && a <= 1 + 1e-9, `${a}`);
  }
});
test('drawCompactHp flashes the number on an HP drop (balanced, no HP change)', () => {
  resetHpFx();
  const texts = [];
  let saves = 0, restores = 0;
  const target = { save() { saves++; }, restore() { restores++; }, fillText(t) { texts.push(t); } };
  const ctx = new Proxy(target, {
    get(t, k) { return k in t ? t[k] : () => {}; },
    set(t, k, v) { t[k] = v; return true; },
  });
  const st = (hp) => ({ player: { x: 0, y: 0, hp, maxHp: 300 }, enemy: { x: 0, y: -200, hp: 5, maxHp: 10 } });
  drawCompactHp(ctx, st(300), null, { nowMs: 1000 });
  assert.ok(!texts.includes('280'));
  const s2 = st(280);
  drawCompactHp(ctx, s2, null, { nowMs: 1010 });
  assert.ok(texts.includes('280'));
  assert.equal(s2.player.hp, 280);
  texts.length = 0;
  drawCompactHp(ctx, st(280), null, { nowMs: 1200 });
  assert.ok(!texts.includes('280'), 'flash over after 150ms');
  assert.equal(saves, restores);
  resetHpFx();
});

console.log(`phoneCombatUi: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
