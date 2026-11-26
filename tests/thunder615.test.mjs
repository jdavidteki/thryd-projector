// v615: `.thunder()` flash + rumble on the stage. Source checks + a behavioural run of thunderFx against a tiny fake DOM.
import test from 'node:test';
import assert from 'node:assert';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const here = new URL('..', import.meta.url);
const rd = p => readFileSync(new URL(p, here), 'utf8');
const st = rd('assets/stage.js'), css = rd('assets/alive.css'), html = rd('index.html'), ver = rd('data/version.json');
const src = (() => { const i = st.indexOf('function thunderFx(rec, m){'); const j = st.indexOf('root.thrydThunder = thunderFx;'); return st.slice(i, j); })();

function env(over = {}){
  const els = {}, timers = [], codeLines = [];
  const mk = id => { const o = {id, className: '', _cl: new Set(), children: [], setAttribute(){}, remove(){ delete els[o.id]; }, offsetWidth: 1,
    classList: {add: c => o._cl.add(c), remove: c => o._cl.delete(c), contains: c => o._cl.has(c)}}; return o; };
  const document = {hidden: false, getElementById: id => els[id] || null, createElement: () => mk('new'), body: {appendChild: e => { els[e.id] = e; }}};
  els.gstage = mk('gstage');
  const cut = {el: mk('cut')};
  const ctx = {document, root: {LH: {state: 'active', cool: false}, matchMedia: () => ({matches: false}), ...over.root}, THDONE: new Set(),
    clearTimeout(){}, setTimeout: (f, ms) => { timers.push({f, ms}); return timers.length; }, codeLine: (t, n) => codeLines.push([t, n]),
    parseFree: raw => { const m = raw.match(/^#?(\w+)\.(\w+)\((.*)\)$/); return {obj: m && m[1], fn: m && m[2], args: m && m[3] ? m[3].split(',').map(x => x.trim()) : []}; },
    ckey: x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, ''), currentRun: () => 'run-cf203b', matchFreeCuts: (n, run) => n === 'tobi' ? [cut] : [], ...over.ctx};
  vm.createContext(ctx); vm.runInContext(src.replace(/^function thunderFx/, 'var thunderFx = function thunderFx') + ';', ctx);
  return {ctx, els, timers, codeLines, cut, fx: ctx.thunderFx, document};
}
const HIT = {result: '\u26a1 j19.thunder: lightning strikes Tobi (shaken); storm over the agenda from j19 (getweather reads it)', event_id: 'e1'};

test('a landed strike flashes, rumbles the stage, shakes the struck cut, and cleans up in under 1 s', () => {
  const e = env(); assert.equal(e.fx({raw: 'tobi.thunder()', run: 'run-cf203b'}, HIT), true);
  assert.equal(e.els.gthunder.className, 'on'); assert.ok(e.els.gstage._cl.has('gth-rumble')); assert.ok(e.cut.el._cl.has('gth-hit'));
  assert.ok(e.timers.every(t => t.ms < 1000), JSON.stringify(e.timers.map(t => t.ms)));
  e.timers.forEach(t => t.f()); assert.equal(e.els.gthunder, undefined); assert.ok(!e.els.gstage._cl.has('gth-rumble')); assert.ok(!e.cut.el._cl.has('gth-hit'));
});
test('a refusal (plain words) or a non-thunder reply plays nothing and builds nothing', () => {
  const e = env();
  assert.equal(e.fx({raw: 'tobi.thunder()'}, {result: 'thunder refused: tobi was already struck at j19; one strike per subject every 3 jobs', event_id: 'e2'}), false);
  assert.equal(e.fx({raw: 'tobi.glow()'}, HIT), false); assert.equal(e.fx({raw: 'tobi.thunder()'}, {event_id: 'e3'}), false);
  assert.equal(e.els.gthunder, undefined); assert.equal(e.timers.length, 0);
});
test('cool mode and reduced motion get one static dim frame (0.35 s), no rumble, no shake', () => {
  for (const over of [{root: {LH: {state: 'active', cool: true}}}, {root: {LH: {state: 'active', cool: false}, matchMedia: () => ({matches: true})}}]) {
    const e = env(over); assert.equal(e.fx({raw: 'tobi.thunder()'}, HIT), true);
    assert.equal(e.els.gthunder.className, 'calm'); assert.ok(!e.els.gstage._cl.has('gth-rumble')); assert.ok(!e.cut.el._cl.has('gth-hit')); assert.deepEqual(e.timers.map(t => t.ms), [350]);
  }
});
test('a hidden tab or hidden low-heat state plays nothing', () => {
  const a = env(); a.document.hidden = true; assert.equal(a.fx({raw: 'tobi.thunder()'}, HIT), false); assert.equal(a.els.gthunder, undefined);
  const b = env({root: {LH: {state: 'hidden', cool: false}}}); assert.equal(b.fx({raw: 'tobi.thunder()'}, HIT), false);
});
test('one play per event id', () => { const e = env(); assert.equal(e.fx({raw: 'tobi.thunder()'}, HIT), true); assert.equal(e.fx({raw: 'tobi.thunder()'}, HIT), false); });
test('why.thunder(una) (scene or everyone) flashes without shaking a named cut', () => {
  const e = env(); assert.equal(e.fx({raw: 'why.thunder(una)'}, {...HIT, event_id: 'e9'}), true); assert.ok(!e.cut.el._cl.has('gth-hit')); assert.equal(e.els.gthunder.className, 'on');
});
test('the reply handler calls it only for an accepted reply; CSS is one-shot, under 1 s, with cool / reduced-motion overrides', () => {
  assert.match(st, /if\(m\.ok\)\{ try\{ thunderFx\(rec, m\); \}catch\(e\)\{\} toast/);
  assert.match(css, /#gthunder\.on\{animation:gthflash \.9s linear 1 both\}/); assert.match(css, /#gstage\.gth-rumble\{animation:gthrumble \.8s linear 1\}/);
  assert.match(css, /html\.lh-cool #gstage\.gth-rumble\{animation:none\}/); assert.match(css, /prefers-reduced-motion:reduce[^}]*#gthunder\.on\{animation:none/);
  assert.doesNotMatch(css.slice(css.indexOf('v615 thunder')), /infinite/);
  assert.doesNotMatch(src, /requestAnimationFrame|setInterval/);                         // no JS frame loop: nothing runs between strikes
});
test('index and version.json are at v615 or later', () => {
  const v = +(ver.match(/"v": (\d+)/) || [])[1]; assert.ok(v >= 615);
  assert.match(html, new RegExp('var VER=' + v + ',')); assert.match(html, /stage\.js\?v=\d+/); assert.match(html, /alive\.css\?v=\d+/);
});
