// Regression (23 Nov 2026, Jesuye: "many objects are refusing dragging"): when a story leaves the stage, exitGroup marks ALL of
// its cuts `leaving` at once, but they walk off one by one (up to ~1.5 s apart each) and bindDrag returned early for any leaving
// cut, so whole groups stood still on screen and ignored every grab; walking cuts were also click-through for their whole walk.
// Fix: a grab on a still-visible leaving cut rescues it (cancels its exit where it stands); walking cuts stay grabbable until
// their 2 s fade begins; a rescued cut whose story is gone walks off again 20 s after its last release.
// This also runs the real rescue/walk-off code from stage.js against a tiny fake DOM.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const stage = readFileSync(new URL('../assets/stage.js', import.meta.url), 'utf8');

test('bindDrag no longer refuses leaving cuts outright', () => {
  assert.doesNotMatch(stage, /pointerdown', ev => \{\s*if\(cut\.leaving\) return;/);
  assert.match(stage, /if\(cut\.leaving && !rescueCut\(cut\)\) return;/);
});

test('walk-off keeps the cut grabbable until the fade, and every exit timer is cancellable', () => {
  const walk = stage.slice(stage.indexOf('function walkOffCut('), stage.indexOf('function exitGroup('));
  assert.match(walk, /cut\.peT = setTimeout\(/);
  assert.match(walk, /cut\.offT = setTimeout\(\(\)=>\{ if\(cut\.leaving\) unloadCut\(cut\); \}/);
  // the walking branch must not switch pointer events off in the same frame it starts walking
  assert.doesNotMatch(walk, /style\.opacity = '0'; cut\.el\.style\.pointerEvents = 'none'; \}\); \}\);/);
  const ex = stage.slice(stage.indexOf('function exitGroup('), stage.indexOf('S.exitGroup = exitGroup'));
  assert.match(ex, /cut\.goT = setTimeout\(go,/);
  assert.match(ex, /if\(!cut\.leaving\) return; \/\/ rescued/);
});

test('rescueCut freezes a walking cut where it stands and clears its exit timers (behaviour)', () => {
  const src = stage.slice(stage.indexOf('function rescueCut('), stage.indexOf('S.rescueCut = rescueCut'));
  const cleared = [];
  const S = {};
  const style = { transition: 'translate 7s', translate: '', pointerEvents: 'none', opacity: '' };
  const cls = new Set(['gcut', 'leaving']);
  const el = { isConnected: true, style, classList: { remove: c => cls.delete(c) } };
  const cs = { opacity: '0.9', translate: '120px -40px' };
  const timers = []; let seq = 0;
  const env = {
    S, note(){}, cutOnScreen: () => true, walkOffCut: (c) => { c.walked = true; },
    getComputedStyle: () => cs,
    clearTimeout: id => cleared.push(id),
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return ++seq; },
  };
  const make = new Function(...Object.keys(env), src + '\nreturn {rescueCut, leaveLater};');
  const { rescueCut, leaveLater } = make(...Object.values(env));
  const cut = { el, frames: [1], leaving: true, goT: 11, offT: 12, peT: 13, label: 'man', home: { mid: 'v1' }, g: { gone: true } };
  assert.equal(rescueCut(cut), true);
  assert.equal(cut.leaving, false);
  assert.ok(!cls.has('leaving'));
  assert.equal(style.translate, '120px -40px', 'frozen at its current mid-walk offset, not the end of the walk');
  assert.equal(style.transition, 'none');
  assert.equal(style.pointerEvents, '');
  assert.equal(style.opacity, '1');
  for (const id of [11, 12, 13]) assert.ok(cleared.includes(id), 'timer ' + id + ' cleared');
  assert.equal(S.rescues, 1);
  // released: its story is gone, so it walks off again 20 s later (not at once)
  leaveLater(cut);
  assert.equal(timers.length, 1); assert.equal(timers[0].ms, 20000);
  timers[0].fn(); assert.equal(cut.walked, true);
  // an invisible (faded) cut is not rescued
  const cut2 = { el: { ...el, style: { ...style } }, frames: [1], leaving: true };
  cs.opacity = '0.05';
  assert.equal(rescueCut(cut2), false);
  assert.equal(cut2.leaving, true);
});

test('low-heat is untouched: pointerdown still wakes it and keeps full-rate frames while held', () => {
  const lh = readFileSync(new URL('../assets/lowheat.js', import.meta.url), 'utf8');
  assert.match(lh, /addEventListener\('pointerdown',function\(\)\{ptrDown=true;input\(\);\}/);
  assert.match(lh, /s==='active'&&!ptrDown&&lastFlush/);
});
