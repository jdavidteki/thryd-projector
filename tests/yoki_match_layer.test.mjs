// v542 yoki lyric match layer (assets/yoki_dj.js reads data/yoki_match.json first; falls back to its own ranking)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = fs.readFileSync(path.join(root, 'assets/yoki_dj.js'), 'utf8');
const song = (id, rank) => ({rank, id, title: 'T' + id, artist: 'A', audio: 'https://a/' + id + '.mp3', lrc: 'https://a/' + id + '.lrc', score: 10 - rank,
  matches: [{t: 1, line: 'line ' + id, term: 'love', via: 'j31 blender line'}], why: '♪ matched: “line ' + id + '” ↔ j31 blender line'});
function load({match, search = '', active = 'run-x'} = {}){
  const store = {}, body = {children: [], appendChild(c){ this.children.push(c); return c; }};
  const files = {'data/yoki_match.json': () => match, 'data/agenda_objects.json': () => ({active_run: active})};
  const ctx = {URLSearchParams, Date, Math, JSON, Promise, Set, Map, Array, String, Number, Object, Error, Int8Array, Float32Array, atob,
    location: {search}, setInterval(){ return 0; }, clearInterval(){}, setTimeout(){ return 0; }, clearTimeout(){}, requestAnimationFrame(f){ f(); },
    localStorage: {getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }},
    sessionStorage: {getItem: () => null, setItem(){}},
    document: {body, hidden: false, createElement: () => ({style: {}, textContent: '', appendChild(){}})},
    fetch: async (u) => { const k = Object.keys(files).find(f => u.startsWith(f)); const v = k ? files[k]() : null;
      return {ok: !!v, json: async () => v}; }};
  ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
  return {DJ: ctx.thrydYokiDJ, files, body, store};
}
const M = (ids, extra = {}) => Object.assign({v: 1, run: 'run-x', job: 'j32', sig: ids.join(','), generated: new Date().toISOString(), top: ids.map((id, i) => song(id, i + 1))}, extra);

test('plays the match in rank order, ⏭ advances by rank, why-line is the light pill', async () => {
  const {DJ, body} = load({match: M(['a', 'b', 'c', 'd', 'e'])});
  const r1 = await DJ.next(() => true); assert.equal(r1.id, 'a'); assert.equal(r1.why.src, 'match');
  DJ.showWhy(r1.why); const note = body.children.find(n => n.id === 'yoki_why');
  assert.match(note.textContent, /^♪ matched: “line a” ↔ j31 blender line$/); assert.match(note.style.cssText, /color:#111/);
  assert.equal((await DJ.next(() => true)).id, 'b');
  assert.equal((await DJ.next(id => id !== 'c')).id, 'd');
});

test('skips the last 3 songs played and a new ranking starts at its top', async () => {
  const t = load({match: M(['a', 'b', 'c', 'd', 'e'])});
  for(const id of ['a', 'b', 'c']) assert.equal((await t.DJ.next(() => true)).id, id);
  t.files['data/yoki_match.json'] = () => M(['b', 'c', 'a', 'z']);  // new top is b, but b/c/a were just played
  assert.equal((await t.DJ.next(() => true)).id, 'z');
});

test('missing, stale or ?yokimatch=0 falls back to the DJ ranking (no match pick)', async () => {
  for(const opt of [{match: null}, {match: M(['a']), active: 'run-other'}, {match: M(['a'], {generated: '2020-01-01T00:00:00Z'})}, {match: M(['a']), search: '?yokimatch=0'}]){
    const {DJ} = load(opt); const r = await DJ.next(() => true);   // no yoki_songs.json in this harness -> null (extras then shuffles)
    assert.equal(r, null); assert.notEqual(DJ.matchState, 'ok');
  }
});
