// smart taps (Jesuye 17 Nov 2026 2:54 PM ET): intent, preference order, forgiving input, dwell + prefetch, the setting
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const src = fs.readFileSync(new URL('../assets/stage.js', import.meta.url), 'utf8');
const pj = fs.readFileSync(new URL('../assets/projector.js', import.meta.url), 'utf8');
test('a tap with one obvious choice runs it with a 3 s undo; long-press / right-click open the menu', () => {
  assert.match(src, /if\(own\.length === 1\) return \{x: own\[0\], why: 'its only function'/);
  assert.match(src, /last3\.filter\(v => v === id\)\.length >= 2/); assert.match(src, /sc\[0\]\.s >= \.75 && \(sc\.length < 2 \|\| sc\[0\]\.s - sc\[1\]\.s >= \.25\)/);
  assert.match(src, /\.5 \* Math\.min\(1, freq\) \+ \.3 \* rec \+ \.2 \* fitOf\(x, g\)/); assert.match(src, /CLS\.genre_types/);
  assert.match(src, /if\(dur >= 450\)\{ try\{ openMethods\(d\.c, \{full: true\}\)/); assert.match(src, /addEventListener\('contextmenu'/);
  assert.match(src, /tapIntent\(d\.c\)/); assert.match(src, /setTimeout\(\(\)=>\{ t\.classList\.remove\('on'\); setTimeout\(\(\)=>\{ t\.remove\(\); if\(UT === t\) UT = null; \}, 400\); \}, 3000\)/);
});
test('intent calls carry source intent; undo reverses the look and is logged over the relay', () => {
  assert.match(src, /if\(src === 'intent'\) body\.source = 'intent';[\s\S]*if\(src === 'intent'\) body\.source = 'intent';/);
  assert.match(src, /type: 'undo', event_id: eid, rid: eid \+ '-r', undo_of: rec\.body\.event_id/); assert.match(src, /sendCall\(u, u\.code, eid\)/);
  assert.match(src, /\(c\._ripT \|\| \[\]\)\.forEach\(clearTimeout\)/); assert.match(src, /c\.tapL\.keys = pv\.keys/);
});
test('menus follow this device history; near-miss taps snap; drags ease toward a drop zone', () => {
  assert.match(src, /orderByPref\(c, funcsFor\(c\)/); assert.match(src, /remember\(c, 'f:' \+ it\.t\.title\)/);
  assert.match(src, /const R = touch \? 36 : 24/); assert.match(src, /function dropZone\(cut, vs\)/); assert.match(src, /if\(sp < \.45\) return null/);
});
test('a read tweet pop-up stays and holds the slideshow; the next scene is prefetched; smart taps can be turned off', () => {
  assert.match(src, /if\(held\(\)\)\{ setTimeout\(bye, 1500\); return; \}/); assert.match(pj, /classList\.contains\('dwell'\)\)return;/);
  assert.match(pj, /function prefetchNext\(\)/); assert.match(pj, /saveData/);
  assert.match(src, /b\.id = 'smarttap'/); assert.match(src, /localStorage\.getItem\(SK\) !== '0'/);
});
test('one past pick is never obvious on its own, and a right-click never also counts as a tap', () => {
  assert.match(src, /n = Math\.max\(3, hist\.length\)/);
  assert.match(src, /e\.isPrimary === false \|\| \(e\.button != null && e\.button > 0\)\)\{ tapD = null; return; \}/);
});
