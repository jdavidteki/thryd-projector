// yoki lyric match layer: score-weighted pick among candidates, recent last 5 in sessionStorage (no seed)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import test from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = fs.readFileSync(path.join(root, 'assets/yoki_dj.js'), 'utf8');
const song = (id, rank) => ({id, title: 'T' + id, artist: 'A', audio: 'https://a/' + id + '.mp3', lrc: 'https://a/' + id + '.lrc', score: 10 - rank,
  matches: [{t: 1, line: 'line ' + id, term: 'love', via: 'j31 blender line'}], why: '♪ matched: “line ' + id + '” ↔ j31 blender line'});
function load({match, search = '', active = 'run-x', recent} = {}){
  const store = {}, sess = {}, body = {children: [], appendChild(c){ this.children.push(c); return c; }};
  if(recent) sess.thryd_yoki_recent = JSON.stringify(recent);
  const files = {'data/yoki_match.json': () => match, 'data/agenda_objects.json': () => ({active_run: active})};
  const ctx = {URLSearchParams, Date, Math, JSON, Promise, Set, Map, Array, String, Number, Object, Error, Int8Array, Float32Array, atob,
    Uint32Array, crypto,
    location: {search}, setInterval(){ return 0; }, clearInterval(){}, setTimeout(){ return 0; }, clearTimeout(){}, requestAnimationFrame(f){ f(); },
    localStorage: {getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, clear(){ for(const k of Object.keys(store)) delete store[k]; }},
    sessionStorage: {getItem: k => sess[k] ?? null, setItem: (k, v) => { sess[k] = String(v); }, removeItem: k => { delete sess[k]; }},
    document: {body, hidden: false, createElement: () => ({style: {}, textContent: '', appendChild(){}})},
    fetch: async (u) => { const k = Object.keys(files).find(f => u.startsWith(f)); const v = k ? files[k]() : null;
      return {ok: !!v, json: async () => v}; }};
  ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
  return {DJ: ctx.thrydYokiDJ, files, body, store, sess};
}
const M = (ids, extra = {}) => {
  const top = ids.map((id, i) => song(id, i + 1));
  return Object.assign({v: 1, run: 'run-x', job: 'j32', sig: ids.slice().sort().join(','), generated: new Date().toISOString(), candidates: top, top}, extra);
};

test('picks a mood match and still shows the why-line pill', async () => {
  const {DJ, body} = load({match: M(['a', 'b', 'c', 'd', 'e'])});
  const r1 = await DJ.next(() => true);
  assert.ok(['a', 'b', 'c', 'd', 'e'].includes(r1.id));
  assert.equal(r1.why.src, 'match');
  DJ.showWhy(r1.why); const note = body.children.find(n => n.id === 'yoki_why');
  assert.match(note.textContent, /^♪ matched: “line [a-e]” ↔ j31 blender line$/); assert.match(note.style.cssText, /color:#111/);
});

test('score-weighted pick skips the last 5, stores them in sessionStorage, and reshuffles when exhausted', async () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const {DJ, sess} = load({match: M(ids)});
  const first = [];
  for(let i = 0; i < 8; i++){
    const id = (await DJ.next(() => true)).id;
    const window = first.slice(-5);
    assert.ok(!window.includes(id), 'pick ' + i + ' (' + id + ') must not be in the last 5 ' + window);
    first.push(id);
  }
  const recent = JSON.parse(sess.thryd_yoki_recent);
  assert.ok(Array.isArray(recent) && recent.length >= 3 && recent.length <= 5, 'recent is last 3–5 in sessionStorage: ' + recent);
  assert.deepEqual(recent, first.slice(-recent.length));
  const nxt = (await DJ.next(() => true)).id;
  assert.ok(!recent.includes(nxt), 'next pick must still skip the stored recent list; got ' + nxt + ' recent=' + recent);
});

test('when every candidate has recently played, the recent list resets and picking resumes without immediately repeating the last id', async () => {
  const ids = ['a', 'b', 'c', 'd', 'e']; // 5 candidates, recent window is 5, so the 6th pick exhausts the pool
  const {DJ, sess} = load({match: M(ids)});
  const first = [];
  for(let i = 0; i < 5; i++) first.push((await DJ.next(() => true)).id);
  assert.deepEqual([...first].sort(), ids.slice().sort(), 'with 5 candidates the first pass is a permutation');
  const before = JSON.parse(sess.thryd_yoki_recent);
  assert.deepEqual(before, first.slice(-5));
  const nxt = (await DJ.next(() => true)).id;
  assert.ok(nxt !== first[first.length - 1], 'after exhaustion, skip the last played; got ' + nxt + ' last=' + first[first.length - 1]);
  assert.ok(ids.includes(nxt));
  const after = JSON.parse(sess.thryd_yoki_recent);
  assert.equal(after[after.length - 1], nxt);
  assert.ok(after.length <= 5);
});

test('persists only the recent id list in sessionStorage (no seed, bag, or play index; nothing in localStorage)', async () => {
  const {DJ, store, sess} = load({match: M(['a', 'b', 'c', 'd', 'e', 'f'])});
  for(let i = 0; i < 3; i++) await DJ.next(() => true);
  assert.deepEqual(Object.keys(store), [], 'localStorage keys: ' + Object.keys(store).join(','));
  assert.deepEqual(Object.keys(sess), ['thryd_yoki_recent']);
  const recent = JSON.parse(sess.thryd_yoki_recent);
  assert.ok(Array.isArray(recent) && recent.length === 3);
  assert.ok(recent.every(id => typeof id === 'string'));
  for(const k of Object.keys(sess)){
    assert.ok(!/seed|index|bag/i.test(k));
  }
});

test('two fresh loads produce different first-5 sequences', async () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  const seq = async () => {
    const {DJ} = load({match: M(ids)});
    const got = [];
    for(let i = 0; i < 5; i++) got.push((await DJ.next(() => true)).id);
    assert.equal(new Set(got).size, 5);
    return got.join(',');
  };
  const seen = new Set();
  for(let i = 0; i < 8; i++) seen.add(await seq());
  assert.ok(seen.size > 1, 'expected different first-5 sequences across loads, got only ' + [...seen]);
});

test('first picks are score-weighted, not a fixed walk of #1', async () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const firsts = [];
  for(let i = 0; i < 24; i++) firsts.push((await load({match: M(ids)}).DJ.next(() => true)).id);
  assert.ok(new Set(firsts).size > 1, 'expected more than one first-pick id across loads, got only ' + firsts[0]);
  assert.ok(firsts.some(id => id !== 'a'), 'must not always pick the highest-scored id');
});

test('a new ranking does not always take its #1, and the first pick is not one of the last 3–5', async () => {
  const t = load({match: M(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])});
  const played = [];
  for(let i = 0; i < 3; i++) played.push((await t.DJ.next(() => true)).id);
  t.files['data/yoki_match.json'] = () => M(['z', ...played, 'q', 'r']);
  const nxt = (await t.DJ.next(() => true)).id;
  assert.ok(!played.includes(nxt), 'first pick after a new ranking must skip the last 3 ' + played + '; got ' + nxt);
  assert.ok(['z', 'q', 'r'].includes(nxt));
});

test('sessionStorage recent of the last 5 is honored on a fresh load in the same session', async () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const recent = ['a', 'b', 'c', 'd', 'e'];
  const {DJ, sess} = load({match: M(ids), recent});
  const nxt = (await DJ.next(() => true)).id;
  assert.ok(!recent.includes(nxt), 'must skip the session recent list; got ' + nxt);
  assert.ok(['f', 'g', 'h'].includes(nxt));
  const stored = JSON.parse(sess.thryd_yoki_recent);
  assert.equal(stored[stored.length - 1], nxt);
  assert.ok(stored.length <= 5);
});

test('missing, stale or ?yokimatch=0 falls back to the DJ ranking (no match pick)', async () => {
  for(const opt of [{match: null}, {match: M(['a']), active: 'run-other'}, {match: M(['a'], {generated: '2020-01-01T00:00:00Z'})}, {match: M(['a']), search: '?yokimatch=0'}]){
    const {DJ} = load(opt); const r = await DJ.next(() => true);   // no yoki_songs.json in this harness -> null (extras then shuffles)
    assert.equal(r, null); assert.notEqual(DJ.matchState, 'ok');
  }
});
