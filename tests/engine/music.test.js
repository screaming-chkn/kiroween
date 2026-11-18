/**
 * tests/engine/music.test.js — M3 music: format choice, loop points (incl. the
 * MP3 padding fix), leading-silence measure, scene transitions, asset paths.
 *   node tests/engine/music.test.js
 */
import assert from 'node:assert/strict';
import { existsSync, statSync, readFileSync } from 'node:fs';
import {
  LOOP_LENGTH_S, TRACKS, CROSSFADE_S, MUSIC_DIR, TITLE_STING_LEAD_S,
  chooseMusicFormat, trackUrl, leadingSilenceS, loopPoints, musicTransition,
  cueMusic, loadTrack,
} from '../../src/engine/music.js';
import { CANVAS_FONTS, loadGameFonts, _resetFontsForTests } from '../../src/engine/fonts.js';

let passed = 0;
let failed = 0;
const pending = [];
function test(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      pending.push(r.then(() => { console.log(`  ✓ ${name}`); passed++; },
        (err) => { console.error(`  ✗ ${name}\n    ${err.message}`); failed++; }));
      return;
    }
    console.log(`  ✓ ${name}`); passed++;
  } catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); failed++; }
}
console.log('\nsrc/engine/music.js + src/engine/fonts.js\n');

test('musical loop lengths are whole bars at their tempo', () => {
  assert.equal(LOOP_LENGTH_S.garage, 76.8);
  assert.equal(LOOP_LENGTH_S.duel, 75.0);
  assert.equal(LOOP_LENGTH_S.garage * 48000, 3686400);        // sample-exact @48k
  assert.equal(LOOP_LENGTH_S.duel * 48000, 3600000);
  assert.equal(32 * 4 * 60 / 100, LOOP_LENGTH_S.garage);       // 32 bars @100 BPM
  assert.equal(40 * 4 * 60 / 128, LOOP_LENGTH_S.duel);         // 40 bars @128 BPM
});

test('format: OGG when Vorbis plays, MP3 otherwise (older iOS Safari)', () => {
  assert.equal(chooseMusicFormat(() => 'probably'), 'ogg');
  assert.equal(chooseMusicFormat(() => 'maybe'), 'ogg');
  assert.equal(chooseMusicFormat(() => ''), 'mp3');
  assert.equal(chooseMusicFormat(null), 'mp3');
  assert.equal(chooseMusicFormat(() => { throw new Error('x'); }), 'mp3');
  let asked = null;
  chooseMusicFormat((t) => { asked = t; return ''; });
  assert.equal(asked, 'audio/ogg; codecs="vorbis"');
});

test('OGG loops the whole buffer', () => {
  assert.deepEqual(loopPoints('ogg', 'garage', 76.8, 0), { loopStart: 0, loopEnd: 0 });
});

test('MP3 loops only the musical length, offset by measured lead padding', () => {
  assert.deepEqual(loopPoints('mp3', 'garage', 76.824, 0), { loopStart: 0, loopEnd: 76.8 });
  const lp = loopPoints('mp3', 'duel', 75.024, 0.012);
  assert.equal(lp.loopStart, 0.012);
  assert.ok(Math.abs(lp.loopEnd - 75.012) < 1e-9);
  // Never past the end of a short buffer.
  assert.equal(loopPoints('mp3', 'duel', 74.9, 0).loopEnd, 74.9);
  // Stings are not loops.
  assert.deepEqual(loopPoints('mp3', 'title', 3.024, 0), { loopStart: 0, loopEnd: 0 });
});

test('leadingSilenceS measures padding, not guesses', () => {
  const sr = 48000;
  const buf = new Float32Array(sr);
  const pad = 576;                           // a typical MP3 decoder delay
  for (let i = pad; i < buf.length; i++) buf[i] = 0.2 * Math.sin(i / 7);
  buf[pad] = 0.2;                            // first non-silent sample
  assert.ok(Math.abs(leadingSilenceS(buf, sr) - pad / sr) < 1e-9);
  assert.equal(leadingSilenceS(new Float32Array([0.5, 0, 0]), sr), 0);
  // All-silent: capped at maxS (0.1 s).
  assert.ok(Math.abs(leadingSilenceS(new Float32Array(sr), sr) - 0.1) < 1e-9);
  assert.equal(leadingSilenceS(null, sr), 0);
});

test('scene transitions: title sting → garage, garage ↔ duel, stings at the end', () => {
  const go = musicTransition(null, 'title-go');
  assert.deepEqual(go, { loop: 'garage', sting: 'title', delayS: TITLE_STING_LEAD_S });
  assert.equal(musicTransition('garage', 'duel').loop, 'duel');
  assert.equal(musicTransition('duel', 'garage').loop, 'garage');
  assert.deepEqual(musicTransition('duel', 'win'), { loop: null, sting: 'victory', delayS: 0 });
  assert.deepEqual(musicTransition('duel', 'lose'), { loop: null, sting: 'defeat', delayS: 0 });
  assert.equal(musicTransition('duel', 'bogus').loop, 'duel');
  assert.ok(CROSSFADE_S >= 0.2 && CROSSFADE_S <= 0.5);
});

test('every track file ships in both formats; old WAV bed is gone', () => {
  for (const id of Object.keys(TRACKS)) {
    for (const f of ['ogg', 'mp3']) {
      const url = trackUrl(id, f);
      assert.ok(url.startsWith(MUSIC_DIR) && !url.startsWith('/'), url);
      assert.ok(existsSync(url) && statSync(url).size > 1000, `missing ${url}`);
    }
  }
  assert.ok(!existsSync('assets/audio/haunt-hound-loop.wav'));
  assert.ok(!readFileSync('src/engine/audio.js', 'utf8').includes('.wav'));
});

test('music runtime is a safe no-op before unlock (Node)', async () => {
  assert.equal(cueMusic('garage'), false);
  assert.equal(await loadTrack('garage'), null);
});

test('fonts: canvas faces are self-hosted with OFL licences and preloaded', () => {
  const html = readFileSync('index.html', 'utf8');
  for (const [face, file] of [['VT323', 'vt323-400'], ['Share Tech Mono', 'share-tech-mono-400'],
    ['IBM Plex Mono', 'ibm-plex-mono-400'], ['Rajdhani', 'rajdhani-600']]) {
    assert.ok(existsSync(`assets/fonts/${file}.woff2`), file);
    assert.ok(html.includes(`font-family: '${face}'`), `@font-face ${face}`);
  }
  for (const lic of ['VT323', 'ShareTechMono', 'IBMPlexMono', 'Rajdhani']) {
    assert.match(readFileSync(`assets/fonts/OFL-${lic}.txt`, 'utf8'), /SIL Open Font License/);
  }
  assert.equal((html.match(/font-display: swap/g) || []).length, 4);
  assert.ok(html.includes('rel="preload" href="assets/fonts/vt323-400.woff2"'));
  assert.ok(CANVAS_FONTS.some(f => f.includes('VT323')) && CANVAS_FONTS.some(f => f.includes('Share Tech Mono')));
});

test('loadGameFonts waits for every canvas face, then fonts.ready', async () => {
  _resetFontsForTests();
  const loaded = [];
  const doc = { fonts: { load: (f) => { loaded.push(f); return Promise.resolve([]); }, ready: Promise.resolve() } };
  assert.equal(await loadGameFonts(doc, 1000), true);
  assert.deepEqual(loaded, [...CANVAS_FONTS]);
});

test('loadGameFonts never blocks play: times out, and survives no FontFace API', async () => {
  _resetFontsForTests();
  const hang = { fonts: { load: () => new Promise(() => {}), ready: new Promise(() => {}) } };
  assert.equal(await loadGameFonts(hang, 20), false);
  _resetFontsForTests();
  assert.equal(await loadGameFonts({}, 20), false);
  _resetFontsForTests();
});

await Promise.all(pending);
console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
