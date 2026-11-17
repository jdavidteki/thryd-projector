// yoki lyric match layer: mood-matched candidates, shuffled bag (no rank-order walk, no persisted seed)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import test from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = fs.readFileSync(path.join(root, 'assets/yoki_dj.js'), 'utf8');
const song = (id, rank) => ({rank, id, title: 'T' + id, artist: 'A', audio: 'https://a/' + id + '.mp3', lrc: 'https://a/' + id + '.lrc', score: 10 - rank,
  matches: [{t: 1, line: 'line ' + id, term: 'love', via: 'j31 blender line'}], why: '♪ matched: “line ' + id + '” ↔ j31 blender line'});
function load({match, search = '', active = 'run-x'} = {}){
  const store = {}, sess = {}, body = {children: [], appendChild(c){ this.children.push(c); return c; }};
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
const M = (ids, extra = {}) => Object.assign({v: 1, run: 'run-x', job: 'j32', sig: ids.join(','), generated: new Date().toISOString(), top: ids.map((id, i) => song(id, i + 1))}, extra);

test('picks a mood match and still shows the why-line pill', async () => {
  const {DJ, body} = load({match: M(['a', 'b', 'c', 'd', 'e'])});
  const r1 = await DJ.next(() => true);
  assert.ok(['a', 'b', 'c', 'd', 'e'].includes(r1.id));
  assert.equal(r1.why.src, 'match');
  DJ.showWhy(r1.why); const note = body.children.find(n => n.id === 'yoki_why');
  assert.match(note.textContent, /^♪ matched: “line [a-e]” ↔ j31 blender line$/); assert.match(note.style.cssText, /color:#111/);
});

test('shuffle bag: no repeats until every match has played, then reshuffles and skips the last 3', async () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const {DJ} = load({match: M(ids)});
  const first = [];
  for(let i = 0; i < ids.length; i++) first.push((await DJ.next(() => true)).id);
  assert.deepEqual([...first].sort(), ids.slice().sort(), 'first pass is a permutation of the matches');
  assert.equal(new Set(first).size, ids.length, 'no repeats in the bag');
  const nxt = (await DJ.next(() => true)).id;
  const last3 = first.slice(-3);
  assert.ok(!last3.includes(nxt), 'after reshuffle, the next pick is not one of the last 3 (' + last3 + '); got ' + nxt);
});

test('does not persist a seed, bag or play index in localStorage / sessionStorage', async () => {
  const {DJ, store, sess} = load({match: M(['a', 'b', 'c', 'd', 'e', 'f'])});
  for(let i = 0; i < 3; i++) await DJ.next(() => true);
  const keys = [...Object.keys(store), ...Object.keys(sess)];
  assert.deepEqual(keys, [], 'storage keys: ' + keys.join(','));
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

test('a new ranking does not always take its #1, and the first pick is not one of the last 3', async () => {
  const t = load({match: M(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])});
  const played = [];
  for(let i = 0; i < 3; i++) played.push((await t.DJ.next(() => true)).id);
  t.files['data/yoki_match.json'] = () => M(['z', ...played, 'q', 'r']); // z is new top by rank
  const nxt = (await t.DJ.next(() => true)).id;
  assert.ok(!played.includes(nxt), 'first pick after a new ranking must skip the last 3 ' + played + '; got ' + nxt);
  assert.ok(['z', 'q', 'r'].includes(nxt));
});

test('missing, stale or ?yokimatch=0 falls back to the DJ ranking (no match pick)', async () => {
  for(const opt of [{match: null}, {match: M(['a']), active: 'run-other'}, {match: M(['a'], {generated: '2020-01-01T00:00:00Z'})}, {match: M(['a']), search: '?yokimatch=0'}]){
    const {DJ} = load(opt); const r = await DJ.next(() => true);   // no yoki_songs.json in this harness -> null (extras then shuffles)
    assert.equal(r, null); assert.notEqual(DJ.matchState, 'ok');
  }
});
