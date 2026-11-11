import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const M = require('../assets/movement.js');
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCENE = 'assets/webp/live/run-0ae93c_j2';
const CUTS = [{ scene: SCENE, cut: 'person3', run: 'run-0ae93c', object_id: 'obj_ronke_db' }];

function mem(){
  let raw = null;
  return {
    load(){ return raw ? JSON.parse(JSON.stringify(raw)) : null; },
    save(box){ raw = JSON.parse(JSON.stringify(box)); },
  };
}
function deferred(){
  let release;
  const promise = new Promise(res => { release = res; });
  return { promise, release };
}
function mv(extra){
  const storage = (extra && extra.storage) || mem();
  const calls = [];
  let gate = null;
  let n = 0;
  const transport = (extra && extra.transport) || { async send(body){
    calls.push(body);
    if(gate) return gate.promise;
    return { event_id: body.event_id, rid: body.rid, ok: true, status: 'accepted', committed: true };
  } };
  const api = M.createMovement(Object.assign({
    storage, transport, bridge: { enabled: false }, cutMap: CUTS, placeIds: ['place_okeayo'],
    newId: () => 'id-' + (++n),
  }, extra || {}, { storage, transport }));
  return { api, storage, calls, setGate(g){ gate = g; } };
}
const scene = {
  kind: 'scene', sceneKey: SCENE, cut: 'person3', name: 'Ronke',
  fromPercent: { x: 10.18, y: 11.59 }, toPercent: { x: 35.852, y: 40 },
};

test('raw percent anchors stay beside a labeled normalized copy', async () => {
  const { api } = mv();
  const ev = await api.commit(scene);
  assert.equal(ev.body.scene, SCENE);
  assert.equal(ev.body.cut, 'person3');
  assert.deepEqual(ev.body.raw, { unit: 'percent', from: { x: 10.18, y: 11.59 }, to: { x: 35.852, y: 40 } });
  assert.deepEqual(ev.body.normalized.from, { x: 0.1018, y: 0.1159 });
  assert.equal(ev.body.normalized.clamped, false);
  assert.equal(ev.body.frame, 'j2');
  assert.equal(ev.body.object_id, 'obj_ronke_db');
  assert.equal(ev.body.from, undefined);
  assert.equal(ev.rid, 'id-1-r');
});

test('off-frame raw inside [-50,150] is kept and the clamped copy is marked', async () => {
  const { api, calls } = mv({ bridge: { enabled: true } });
  const ev = await api.commit(Object.assign({}, scene, { toPercent: { x: 35.852, y: -1.47 } }));
  assert.equal(ev.hold, null);
  assert.deepEqual(ev.body.raw.to, { x: 35.852, y: -1.47 });
  assert.ok(Math.abs(ev.body.normalized.to.x - 0.35852) < 1e-9);
  assert.equal(ev.body.normalized.to.y, 0);
  assert.equal(ev.body.normalized.clamped, true);
  assert.match(ev.text, /raw kept/);
  assert.match(ev.text, /normalized is not the visual/);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].raw.to, { x: 35.852, y: -1.47 });
});

test('anchors outside [-50,150] are not sent and are not clipped into a body', async () => {
  const { api, calls } = mv({ bridge: { enabled: true } });
  const ev = await api.commit(Object.assign({}, scene, { toPercent: { x: 35, y: -80 } }));
  assert.equal(ev.hold, 'raw_window');
  assert.equal(ev.body, null);
  assert.deepEqual(ev.captured.raw.to, { x: 35, y: -80 });
  assert.match(ev.text, /not clipped/);
  assert.equal(calls.length, 0);
});

test('server canonical coordinates stay beside the raw anchors', async () => {
  const { api } = mv({
    bridge: { enabled: true },
    transport: { async send(body){ return { event_id: body.event_id, rid: body.rid, ok: true, status: 'accepted', committed: true, canonical: { unit: 'frame', from: { x: body.raw.from.x / 100, y: body.raw.from.y / 100 }, to: { x: body.raw.to.x / 100, y: body.raw.to.y / 100 } } }; } },
  });
  const ev = await api.commit(Object.assign({}, scene, { toPercent: { x: 35.852, y: -1.47 } }));
  assert.equal(ev.body.raw.to.y, -1.47);
  assert.equal(ev.body.normalized.to.y, 0);
  assert.equal(ev.body.normalized.clamped, true);
  assert.ok(Math.abs(ev.canonical.to.y - (-0.0147)) < 1e-9);
  assert.equal(ev.canonical_outside, true);
  assert.equal(ev.canonical_note, 'unclamped raw/100');
  assert.match(ev.text, /db commit accepted/);
  assert.doesNotMatch(ev.text, /story consumed/);
});

test('names are not ids; only the scene and cut row is', async () => {
  const { api } = mv();
  const named = await api.commit(Object.assign({}, scene, { cut: 'Ronke', name: 'Ronke' }));
  assert.equal(named.hold, 'unmapped');
  assert.match(named.text, /unmapped/);
  const otherScene = await api.commit(Object.assign({}, scene, { sceneKey: 'assets/webp/live/run-0ae93c_j9' }));
  assert.equal(otherScene.hold, 'unmapped');
});

test('story card wN is not the frame', async () => {
  const { api } = mv();
  const ev = await api.commit(Object.assign({}, scene, { sceneCard: 'w14' }));
  assert.equal(ev.body.frame, 'j2');
  const clash = await api.commit(Object.assign({}, scene, { sceneCard: 'j9' }));
  assert.equal(clash.hold, 'stale');
});

test('place-only setlocation has a validated place id and no coordinates', async () => {
  const { api, calls } = mv({ bridge: { enabled: true } });
  const missing = await api.commit({ kind: 'place', place: 'Oke-Ayo bus stop', cut: 'person3', sceneKey: SCENE });
  assert.equal(missing.hold, 'place_id_missing');
  assert.equal(missing.body, null);
  assert.equal(missing.captured.raw, undefined);
  const bad = await api.commit({ kind: 'place', place: 'Oke-Ayo bus stop', placeId: 'place_nope', cut: 'person3', sceneKey: SCENE });
  assert.equal(bad.hold, 'place_id_unvalidated');
  const ok = await api.commit({ kind: 'place', place: 'Oke-Ayo bus stop', placeId: 'place_okeayo', cut: 'person3', sceneKey: SCENE });
  assert.equal(ok.body.schema, 'setlocation');
  assert.equal(ok.body.place_id, 'place_okeayo');
  assert.equal(ok.body.from, undefined);
  assert.equal(ok.body.raw, undefined);
  assert.equal(calls.length, 1);
});

test('no-op and bridge-off pending do not claim a db commit', async () => {
  const { api, calls } = mv();
  const same = await api.commit(Object.assign({}, scene, { toPercent: { x: 10.18, y: 11.59 } }));
  assert.equal(same.hold, 'noop');
  const ev = await api.commit(scene);
  assert.equal(ev.transport_status, 'pending');
  assert.match(ev.text, /bridge off/);
  assert.match(ev.text, /not accepted/);
  assert.doesNotMatch(ev.text, /db commit/);
  assert.equal(calls.length, 0);
});

test('accepted and duplicate replies must echo event_id and rid', async () => {
  const gate = deferred();
  const { api, calls, setGate } = mv({ bridge: { enabled: true } });
  setGate(gate);
  const pending = api.commit(scene);
  await Promise.resolve();
  assert.match(api.get('id-1').text, /not accepted/);
  gate.release({ event_id: 'id-1', rid: 'id-1-r', ok: true, status: 'accepted', committed: true });
  const ev = await pending;
  assert.equal(ev.transport_status, 'accepted');
  assert.equal(ev.story_status, 'unread');
  const mismatch = deferred();
  setGate(mismatch);
  const again = api.retry('id-1');
  await Promise.resolve();
  mismatch.release({ event_id: 'id-1', rid: 'other-rid', ok: true, status: 'duplicate', committed: true });
  const bad = await again;
  assert.equal(bad.transport_status, 'failed');
  assert.equal(bad.reason, 'reply_event_mismatch');
  const dupGate = deferred();
  setGate(dupGate);
  const third = api.retry('id-1');
  await Promise.resolve();
  dupGate.release({ event_id: 'id-1', rid: 'id-1-r', ok: true, status: 'duplicate', committed: true });
  const dup = await third;
  assert.equal(dup.transport_status, 'duplicate');
  assert.equal(api.lines().length, 1);
  assert.equal(calls[0].event_id, calls[1].event_id);
  assert.equal(calls[0].rid, calls[2].rid);
});

test('accepted before db commit is not stored as accepted', async () => {
  const { api } = mv({
    bridge: { enabled: true },
    transport: { async send(body){ return { event_id: body.event_id, rid: body.rid, status: 'accepted', committed: false }; } },
  });
  const ev = await api.commit(scene);
  assert.equal(ev.transport_status, 'failed');
  assert.equal(ev.reason, 'not_committed');
});

test('reload, out-of-order story ack, reject and failed retry', async () => {
  const storage = mem();
  let n = 0;
  const make = (transport) => M.createMovement({
    storage, cutMap: CUTS, bridge: { enabled: !!transport }, transport: transport || null,
    newId: () => 'e' + (++n),
  });
  const a = make();
  await a.commit(scene);
  await a.commit(Object.assign({}, scene, { toPercent: { x: 80, y: 20 } }));
  const b = make();
  assert.equal(b.lines().length, 2);
  b.readback(['e2'], 'run-0ae93c');
  assert.equal(b.get('e2').story_status, 'consumed');
  assert.equal(b.get('e1').story_status, 'unread');
  assert.equal(b.get('e1').transport_status, 'pending');
  let mode = 'reject';
  const live = make({ async send(body){
    if(mode==='reject') return { event_id: body.event_id, rid: body.rid, ok: false, status: 'rejected', reason: 'unknown_object' };
    if(mode==='boom') throw new Error('relay down');
    return { event_id: body.event_id, rid: body.rid, ok: true, status: 'accepted', committed: true };
  } });
  const rejected = await live.retry('e1');
  assert.equal(rejected.transport_status, 'rejected');
  assert.match(rejected.text, /unknown_object/);
  mode = 'boom';
  const failed = await live.retry('e1');
  assert.equal(failed.event_id, 'e1');
  assert.match(failed.text, /relay down/);
  mode = 'ok';
  const ok = await live.retry('e1');
  assert.equal(ok.transport_status, 'accepted');
  assert.equal(ok.story_status, 'unread');
});

test('stale run does not borrow another scene cut row', async () => {
  const { api } = mv();
  api.setCutMap([{ scene: 'assets/webp/live/run-7c51d3_j9', cut: 'person3', run: 'run-7c51d3', object_id: 'other' }]);
  const ev = await api.commit(Object.assign({}, scene, { sceneKey: 'assets/webp/live/run-7c51d3_j9', run: 'run-0ae93c' }));
  assert.equal(ev.hold, 'stale');
  assert.equal(ev.body, null);
});

test('missing ok or committed is not a durable accept', async () => {
  const { api } = mv({
    bridge: { enabled: true },
    transport: { async send(body){ return { event_id: body.event_id, rid: body.rid, status: 'accepted' }; } },
  });
  const ev = await api.commit(scene);
  assert.equal(ev.transport_status, 'failed');
  assert.equal(ev.reason, 'not_committed');
  assert.doesNotMatch(ev.text, /db commit/);
});

test('verified rows map only the two run-5a58c4 cuts and no places', async () => {
  const doc = JSON.parse(fs.readFileSync(path.join(root, 'data/object_map_rows_v1.json'), 'utf8'));
  const loaded = M.loadMapDoc(doc);
  assert.equal(loaded.cuts.length, 4);
  assert.deepEqual([...new Set(loaded.cuts.map(c => c.object_id))].sort(), ['dez_5a58c4', 'marisol_5a58c4']);
  assert.ok(loaded.cuts.every(c => c.run === 'run-5a58c4'));
  assert.deepEqual(loaded.placeIds, {});
  const { api } = mv({ cutMap: [], placeIds: null });
  assert.equal(api.loadMap(doc), true);
  const current = await api.commit({
    kind: 'scene', sceneKey: 'assets/webp/live/run-2eb42d_j2', cut: 'person3', name: 'Ronke',
    fromPercent: { x: 10, y: 10 }, toPercent: { x: 20, y: 20 },
  });
  assert.equal(current.hold, 'unmapped');
  const dez = await api.commit({
    kind: 'scene', sceneKey: '/workspace/run-5a58c4/run/views/j6.gif', cut: 'Dez', name: 'someone else',
    fromPercent: { x: 10, y: 10 }, toPercent: { x: 20, y: 12 },
  });
  assert.equal(dez.body.object_id, 'dez_5a58c4');
  assert.equal(dez.body.frame, 'j6');
  assert.equal(dez.body.scene, '/workspace/run-5a58c4/run/views/j6.gif');
  assert.equal(dez.body.cut, 'Dez');
  const alias = await api.commit({
    kind: 'scene', sceneKey: 'run-5a58c4/j6', cut: 'Dez',
    fromPercent: { x: 12, y: 12 }, toPercent: { x: 22, y: 14 },
  });
  assert.equal(alias.body.object_id, 'dez_5a58c4');
  assert.equal(alias.body.scene, 'run-5a58c4/j6');
  const wrongCut = await api.commit({
    kind: 'scene', sceneKey: '/workspace/run-5a58c4/run/views/j6.gif', cut: 'Marisol',
    fromPercent: { x: 10, y: 10 }, toPercent: { x: 30, y: 10 },
  });
  assert.equal(wrongCut.hold, 'unmapped');
  const place = await api.commit({
    kind: 'place', place: 'Oke-Ayo bus stop', placeId: 'place_okeayo', cut: 'Dez',
    sceneKey: '/workspace/run-5a58c4/run/views/j6.gif',
  });
  assert.equal(place.hold, 'place_id_unvalidated');
  assert.equal(place.body, null);
});

test('acks apply only when the envelope run matches the event run', async () => {
  const { api } = mv({ cutMap: [], placeIds: null });
  api.loadMap(JSON.parse(fs.readFileSync(path.join(root, 'data/object_map_rows_v1.json'), 'utf8')));
  const dez = await api.commit({
    kind: 'scene', sceneKey: '/workspace/run-5a58c4/run/views/j6.gif', cut: 'Dez',
    fromPercent: { x: 5, y: 5 }, toPercent: { x: 15, y: 8 },
  });
  api.observeState({ run: 'run-2eb42d', movement_acks: { run: 'run-2eb42d', movement_acks: [dez.event_id] } });
  assert.equal(api.get(dez.event_id).story_status, 'unread');
  api.observeState({ run: 'run-5a58c4', movement_acks: ['bare-array-is-ignored'] });
  assert.equal(api.get(dez.event_id).story_status, 'unread');
  api.observeState({ run: 'run-5a58c4', movement_acks: { run: 'run-2eb42d', movement_acks: [dez.event_id] } });
  assert.equal(api.get(dez.event_id).story_status, 'unread');
  api.observeState({ run: 'run-5a58c4', movement_acks: { run: 'run-5a58c4', movement_acks: [dez.event_id] } });
  assert.equal(api.get(dez.event_id).story_status, 'consumed');
});

test('a later move with a different raw from is stale and is not clipped', async () => {
  const { api } = mv({ bridge: { enabled: true } });
  const first = await api.commit(scene);
  assert.equal(first.transport_status, 'accepted');
  const drifted = await api.commit(Object.assign({}, scene, { fromPercent: { x: 1, y: 1 }, toPercent: { x: 80, y: 80 } }));
  assert.equal(drifted.hold, 'stale');
  assert.equal(drifted.reason, 'stale_raw_from');
  assert.equal(drifted.body, null);
  const next = await api.commit(Object.assign({}, scene, { fromPercent: { x: 35.852, y: 40 }, toPercent: { x: 60, y: 40 } }));
  assert.equal(next.body.base_event_id, first.event_id);
  assert.deepEqual(next.body.raw.from, { x: 35.852, y: 40 });
});

test('rid stays within 80 characters and pose bodies include scene and cut', async () => {
  const { api } = mv();
  const ev = await api.commit(scene);
  assert.ok(ev.rid.length <= 80);
  assert.equal(ev.body.scene, SCENE);
  assert.equal(ev.body.cut, 'person3');
  const long = mv({ newId: () => 'a'.repeat(79) });
  const bad = await long.api.commit(scene);
  assert.equal(bad.hold, 'bad_rid');
  assert.equal(bad.body, null);
});

test('movement file does not carry the public drag key and the slide timer is unchanged', () => {
  const drag = JSON.parse(fs.readFileSync(path.join(root, 'data/drag.json'), 'utf8'));
  const movement = fs.readFileSync(path.join(root, 'assets/movement.js'), 'utf8');
  const projector = fs.readFileSync(path.join(root, 'assets/projector.js'), 'utf8');
  assert.equal(movement.includes(drag.key), false);
  assert.equal(movement.includes('ntfy.sh'), false);
  assert.equal(projector.includes(drag.key), false);
  assert.match(projector, /function startSlide\(\)\{clearInterval\(slideT\);slideT=setInterval\(/);
  assert.match(projector, /DRAG\.transport!=='ntfy'/);
  assert.match(projector, /bridge:\{enabled:false\}/);
  assert.match(projector, /kind:'scene'/);
  assert.doesNotMatch(projector, /style\.left=.*normalized/);
});
