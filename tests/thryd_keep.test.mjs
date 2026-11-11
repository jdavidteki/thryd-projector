import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const Keep = require(path.join(root, 'assets/thryd_keep.js'));

function memoryStorage(){
  const m = new Map();
  return {
    getItem(k){ return m.has(k) ? m.get(k) : null; },
    setItem(k, v){ if(this.fail) throw new Error('quota'); m.set(k, String(v)); },
    removeItem(k){ m.delete(k); },
    fail: false
  };
}

function memoryDb(){
  const rows = new Map();
  return {
    failPut: 0,
    async get(k){ if(this.failGet) throw new Error('corrupt'); return rows.get(k) || null; },
    async put(k, rec){ if(this.failPut){ this.failPut--; throw new Error('quota'); } rows.set(k, rec); },
    async del(k){ rows.delete(k); },
    async all(){ return [...rows.entries()].map(([key, v]) => Object.assign({key}, v)); },
    size(){ return rows.size; }
  };
}

test('settings and the last library gif survive a revisit, and a bad store does not throw', () => {
  const storage = memoryStorage();
  const a = Keep.create({storage, db: null});
  assert.equal(a.saveSettings({slide: 30, mute: 1}), true);
  a.rememberGif('1*UQolGv9h9_i7sWsk3lDLCA.gif');
  const b = Keep.create({storage, db: null});
  assert.equal(b.settings().slide, 30);
  assert.equal(b.settings().mute, 1);
  assert.equal(b.settings().lastGif, '1*UQolGv9h9_i7sWsk3lDLCA.gif');
  assert.deepEqual(Keep.stageChoice('1*other.gif', b.settings().lastGif, false), {id: '1*other.gif', why: 'query'});
  assert.deepEqual(Keep.stageChoice('', b.settings().lastGif, false), {id: null, why: 'live'});
  assert.deepEqual(Keep.stageChoice('', b.settings().lastGif, true), {id: '1*UQolGv9h9_i7sWsk3lDLCA.gif', why: 'resume'});
  storage.fail = true;
  assert.equal(a.saveSettings({slide: 60}), false);
  assert.equal(b.settings().slide, 30);
  storage.setItem = () => { throw new Error('quota'); };
  assert.equal(Keep.create({storage, db: null}).savePlace('k', {x: 1, y: 2}), false);
});

test('drag positions are per source hash and are not written until save', () => {
  const storage = memoryStorage();
  const keep = Keep.create({storage, db: null});
  const key = keep.placeKey('abc', 'cut1', '1');
  const other = keep.placeKey('def', 'cut1', '1');
  assert.equal(keep.loadPlace(key), null);
  assert.equal(keep.savePlace(key, {x: 12, y: -4}), true);
  assert.deepEqual(keep.loadPlace(key), {x: 12, y: -4});
  assert.equal(keep.loadPlace(other), null);
  storage.setItem('thryd_keep_pos_v1', '{');
  assert.equal(Keep.create({storage, db: null}).loadPlace(key), null);
});

test('a changed source hash misses the cache, and a full budget drops the older byte', async () => {
  const db = memoryDb();
  let calls = 0;
  const net = async () => { calls++; return {ok: true, status: 200, arrayBuffer: async () => new Uint8Array([calls]).buffer}; };
  const keep = Keep.create({storage: memoryStorage(), db, budget: 1, fetch: net});
  assert.equal(keep.mayCache('data/state.json?t=1'), false);
  assert.equal(keep.mayCache('data/live_extra.json'), false);
  assert.equal(keep.mayCache('data/medium_cuts.json'), false);
  assert.equal(keep.mayCache('https://miro.medium.com/1*a.gif'), true);
  const first = await keep.fetchCached('https://miro.medium.com/1*a.gif', {}, 'gif:sha-old');
  assert.equal(new Uint8Array(await first.arrayBuffer())[0], 1);
  const again = await keep.fetchCached('https://miro.medium.com/1*a.gif', {}, 'gif:sha-old');
  assert.equal(calls, 1);
  assert.equal(new Uint8Array(await again.arrayBuffer())[0], 1);
  await keep.fetchCached('https://miro.medium.com/1*a.gif', {}, 'gif:sha-new');
  assert.equal(calls, 2);
  assert.equal(db.size(), 1);
  db.failGet = true;
  const fell = await keep.fetchCached('https://miro.medium.com/1*a.gif', {}, 'gif:sha-new');
  assert.equal(new Uint8Array(await fell.arrayBuffer())[0], 3);
  db.failGet = false;
  db.failPut = 1;
  const stored = await keep.fetchCached('https://miro.medium.com/1*b.gif', {}, 'gif:sha-b');
  assert.equal(stored.ok, true);
  const missed = await keep.fetchCached('https://miro.medium.com/1*a.gif', {}, 'gif:sha-old:2');
  assert.equal(new Uint8Array(await missed.arrayBuffer())[0], 5);
});

test('a pack version is a different cache entry, live json stays on the network, and reset clears this device', async () => {
  const db = memoryDb();
  const storage = memoryStorage();
  let calls = 0;
  const net = async (url) => {
    calls++;
    const body = JSON.stringify({url, n: calls});
    const bytes = new TextEncoder().encode(body);
    return {ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)};
  };
  const keep = Keep.create({storage, db, budget: 1000, fetch: net});
  const v1 = await keep.fetchCached('assets/medium_cuts/a.json', {}, 'pack:sha:1');
  assert.equal((await v1.json()).n, 1);
  const again = await keep.fetchCached('assets/medium_cuts/a.json', {}, 'pack:sha:1');
  assert.equal((await again.json()).n, 1);
  assert.equal(calls, 1);
  const v2 = await keep.fetchCached('assets/medium_cuts/a.json', {}, 'pack:sha:2');
  assert.equal((await v2.json()).n, 2);
  assert.equal(calls, 2);
  db.put('pack:sha:1', {bytes: new TextEncoder().encode('{').buffer, at: 1, n: 1});
  const repaired = await keep.fetchCached('assets/medium_cuts/a.json', {}, 'pack:sha:1');
  assert.equal((await repaired.json()).n, 3);
  const before = calls;
  await keep.fetchCached('data/state.json?t=1', {}, 'state');
  await keep.fetchCached('data/live_extra.json?t=2', {}, 'live');
  await keep.fetchCached('data/medium_cuts.json?t=3', {}, 'manifest');
  assert.equal(calls, before + 3);
  assert.equal(db.size() <= 4, true);
  keep.saveSettings({slide: 30, mute: 1});
  keep.rememberGif('1*kept.gif');
  keep.savePlace(keep.placeKey('sha', 'cut1', '1'), {x: 4, y: 5});
  assert.equal(keep.placeKey('sha', 'cut1', '2') !== keep.placeKey('sha', 'cut1', '1'), true);
  assert.equal(keep.loadPlace(keep.placeKey('sha', 'cut2', '1')), null);
  const dead = Keep.create({storage: null, db: null, fetch: net});
  assert.equal(dead.saveSettings({slide: 8, mute: 0}), false);
  assert.equal((await dead.fetchCached('https://miro.medium.com/1*a.gif', {}, 'gif:sha:1')).ok, true);
  assert.equal(await keep.resetLocal(), true);
  assert.equal(keep.settings().lastGif, '');
  assert.equal(keep.settings().slide, 30);
  assert.equal(keep.settings().mute, 1);
  assert.equal(keep.loadPlace(keep.placeKey('sha', 'cut1', '1')), null);
  assert.equal(db.size(), 0);
});
