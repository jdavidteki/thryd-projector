// v610 heat/memory: same-file data GETs at load share one request; each caller gets its own clone; other URLs untouched
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import vm from 'node:vm';
const src = fs.readFileSync(new URL('../assets/fetch_dedupe.js', import.meta.url), 'utf8');
const ix = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function env(){ let n = 0; const calls = [];
  const fetch = (u) => { n++; calls.push(String(u)); return Promise.resolve({ok: true, n, clone(){ return {ok: true, n: this.n, json: async () => ({n: this.n})}; }}); };
  const w = {fetch, location: {href: 'https://x.test/thryd/', origin: 'https://x.test'}, URL, setTimeout: () => 0};
  w.window = w; vm.runInNewContext(src, w); return {w, calls}; }
test('loaded first in index.html', () => { assert.match(ix, /<script src="assets\/fetch_dedupe\.js\?v=\d+"><\/script><script src="assets\/lowheat\.js/); });
test('three tweets_all loads with different ?t= share one request', async () => {
  const {w, calls} = env();
  const r = await Promise.all([w.fetch('data/tweets_all.json?t=1'), w.fetch('data/tweets_all.json?t=2', {cache: 'no-store'}), w.fetch('https://x.test/thryd/data/tweets_all.json')]);
  assert.equal(calls.length, 1); assert.equal(r.length, 3); assert.notEqual(r[0], r[1]); assert.equal((await r[2].json()).n, 1);
});
test('other files and non-GET are not touched', async () => {
  const {w, calls} = env();
  await w.fetch('data/state.json?t=1'); await w.fetch('data/state.json?t=2'); await w.fetch('data/medium_cuts.json', {method: 'POST'}); await w.fetch('data/medium_cuts.json', {method: 'POST'});
  assert.equal(calls.length, 4);
});
