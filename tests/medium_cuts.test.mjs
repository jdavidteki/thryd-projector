import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const M = require('../assets/medium_cuts.js');
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const gif = fs.readFileSync(path.join(root, 'tests/fixtures/cut_two.gif'));

function maskAt(x, y){
  const m = new Array(64).fill(0);
  m[y * 8 + x] = m[y * 8 + x + 1] = m[(y + 1) * 8 + x] = m[(y + 1) * 8 + x + 1] = 1;
  return m;
}
const mask0 = maskAt(1, 1);
const mask1 = maskAt(4, 4);
const set = {how:'medium', remote:true, url:'https://miro.medium.com/v2/1*cut.gif', medium_image_id:'1*cut.gif', extension:'gif', animated:true};
function row(extra){
  return Object.assign({
    medium_image_id:'1*cut.gif', kind:'gif', status:'ready', frame_size:[8, 8], delays_cs:[10, 20],
    objects:[{label:'square', masks:[mask0, mask1]}],
  }, extra);
}

function reds(rgba, w){
  let n = 0;
  for(let i = 0; i < rgba.length; i += 4) if(rgba[i] === 255 && rgba[i+3] === 255) n++;
  return n;
}

test('remote wiring keeps the original fallback and the current-agenda newest pick', () => {
  const fs = require('node:fs');
  const src = fs.readFileSync(new URL('../assets/projector.js', import.meta.url), 'utf8');
  assert.match(src, /const NEWEST=\(\)=>RUNX\(\)/);
  assert.match(src, /objsFor\(null\); clearScene\(\)/);
  assert.match(src, /ThrydMediumCuts\.attach\(set/);
  assert.equal(src.includes('ThrydMovement'), false);
  assert.equal(src.includes('object_id'), false);
});

test('one requested GIF frame matches the full decode and does not keep earlier pixels', () => {
  const full = M.decodeGif(gif);
  const mid = M.decodeGif(gif, {only: 1});
  assert.equal(mid.frames.length, 2);
  assert.equal(mid.frames[0].rgba, undefined);
  assert.deepEqual(Array.from(mid.frames[1].rgba), Array.from(full.frames[1].rgba));
  assert.equal(M.frameHoldBytes(600, 360, 105) > 16 * 1024 * 1024, true);
  assert.equal(M.frameHoldBytes(8, 8, 2) > 16 * 1024 * 1024, false);
});

test('decoded fixture keeps the file delays and the original colors', () => {
  const d = M.decodeGif(gif);
  assert.equal(d.frames.length, 2);
  assert.deepEqual(d.frames.map(f => f.delayCs), [10, 20]);
  const px = (f, x, y) => { const o = (y * 8 + x) * 4; return [f.rgba[o], f.rgba[o+1], f.rgba[o+2], f.rgba[o+3]]; };
  assert.deepEqual(px(d.frames[0], 1, 1), [255, 0, 0, 255]);
  assert.deepEqual(px(d.frames[0], 0, 0), [0, 0, 255, 255]);
  assert.deepEqual(px(d.frames[1], 4, 4), [255, 0, 0, 255]);
  assert.deepEqual(px(d.frames[1], 1, 1), [0, 0, 255, 255]);
  assert.equal(M.playMs(10), 100);
  assert.equal(M.playMs(0), 100);
});

test('per-frame masks lift the subject and leave no red ghost', () => {
  const d = M.decodeGif(gif);
  const plan = M.forSet(set, {assets:[row()]});
  const play = M.planFrames(d, plan);
  assert.equal(play.ok, true);
  assert.deepEqual(play.frames.map(f => f.playMs), [100, 200]);
  const f1 = play.frames[1];
  assert.equal(reds(f1.plate), 0);
  assert.equal(f1.sprites.length, 1);
  assert.deepEqual([f1.sprites[0].x, f1.sprites[0].y, f1.sprites[0].w, f1.sprites[0].h], [4, 4, 2, 2]);
  assert.equal(f1.sprites[0].rgba.length, 16);
  for(let i = 0; i < 16; i += 4){
    assert.equal(f1.sprites[0].rgba[i], 255);
    assert.equal(f1.sprites[0].rgba[i+3], 255);
  }
  const home = (1 * 8 + 1) * 4;
  assert.equal(f1.plate[home], 0);
  assert.equal(f1.plate[home+2], 255);
  assert.equal(f1.plate[home+3], 255);
  const ghost = M.compose(d.frames[1].rgba, 8, 8, [mask0], null);
  assert.ok(reds(ghost.plate) > 0);
});

test('a static patch and a whole-frame mask are not cuts', () => {
  const one = row(); one.objects = [{label:'square', masks:[mask0]}];
  assert.equal(M.forSet(set, {assets:[one]}).reason, 'static_patch_rejected');
  const patched = row(); patched.objects = [{label:'square', masks:[mask0, mask1], patch:'still.png'}];
  assert.equal(M.forSet(set, {assets:[patched]}).reason, 'static_patch_rejected');
  const whole = new Array(64).fill(1);
  const big = row(); big.objects = [{label:'all', masks:[whole, whole]}];
  assert.equal(M.forSet(set, {assets:[big]}).reason, 'whole_frame_mask');
  const box = row(); box.objects = [{label:'box', bbox:[0, 0, 1, 1]}];
  assert.equal(M.forSet(set, {assets:[box]}).reason, 'bbox_not_a_mask');
});

test('agenda rows and engine ids are refused, and a local set is not a medium cut', () => {
  const named = row(); named.objects = [{label:'Ronke', object_id:'cast1_2eb42d', masks:[mask0, mask1]}];
  assert.equal(M.forSet(set, {assets:[named]}).reason, 'unproven_id');
  const agenda = row({run:'run-2eb42d', jN:'j1'});
  assert.equal(M.forSet(set, {assets:[agenda]}).reason, 'agenda_bind');
  assert.equal(M.forSet({how:'gif', dir:'assets/webp/live/run-2eb42d_j1', run:'run-2eb42d'}, {assets:[row()]}).reason, 'not_medium');
  assert.equal(M.forSet(set, {assets:[{medium_image_id:'1*cut.gif', status:'awaiting_manifest'}]}).reason, 'awaiting_manifest');
  assert.equal(M.forSet(set, {assets:[{medium_image_id:'1*cut.gif', status:'no_object'}]}).reason, 'no_object');
});

test('delay mismatch refuses the pack', () => {
  const d = M.decodeGif(gif);
  const plan = M.forSet(set, {assets:[row({delays_cs:[10, 10]})]});
  assert.equal(M.planFrames(d, plan).reason, 'delay_mismatch');
});

test('an invented plate is refused and an observed plate fills only known pixels', () => {
  const bare = row(); bare.objects[0].plate = new Array(64 * 4).fill(0);
  assert.equal(M.forSet(set, {assets:[bare]}).reason, 'invented_plate');
  const known = new Array(64).fill(0);
  known[1 * 8 + 1] = known[1 * 8 + 2] = known[2 * 8 + 1] = known[2 * 8 + 2] = 1;
  const fill = new Uint8ClampedArray(64 * 4);
  for(let i = 0; i < 64; i++) if(known[i]){ fill[i*4+1] = 9; fill[i*4+3] = 255; }
  const d = M.decodeGif(gif);
  const withPlate = row();
  withPlate.objects[0].plate = fill;
  withPlate.objects[0].plate_known = known;
  const play = M.planFrames(d, M.forSet(set, {assets:[withPlate]}));
  const o = (1 * 8 + 1) * 4;
  assert.equal(play.frames[0].plate[o+1], 9);
  assert.equal(play.frames[0].plate[o+3], 255);
  const other = (4 * 8 + 4) * 4;
  assert.equal(play.frames[0].plate[other+2], 255);
});

test('a zlib plate is read and a gzip plate is not dropped', () => {
  const zlib = require('node:zlib');
  const w = 2, h = 2;
  const fill = Buffer.alloc(w * h * 4, 0);
  fill[0] = 9; fill[3] = 255;
  const z = zlib.deflateSync(fill);
  assert.equal(z[0], 0x78);
  assert.throws(() => zlib.gunzipSync(z));
  const row = {
    medium_image_id: '1*cut.gif', kind: 'gif', status: 'ready', frame_size: [2, 2], delays_cs: [10],
    plate_deflate_b64: z.toString('base64'),
    plate_known_bits: {x: 0, y: 0, w: 2, h: 1, bits: Buffer.from([0b10000000]).toString('base64')},
    objects: [{label: 'cut1', masks: [[1, 0, 0, 0]]}],
  };
  const plan = M.forSet(set, {assets: [row]});
  assert.equal(plan.ok, true);
  assert.equal(plan.plate[0], 9);
  assert.equal(plan.plateKnown[2], 0);
  const broken = Object.assign({}, row, {plate_deflate_b64: Buffer.from([1, 2, 3]).toString('base64')});
  assert.equal(M.forSet(set, {assets: [broken]}).reason, 'plate_decode_failed');
});

test('attach mounts a ready remote GIF and drag does not move the plate', async () => {
  const fs = require('node:fs');
  const gif = fs.readFileSync(new URL('./fixtures/cut_two.gif', import.meta.url));
  const decoded = M.decodeGif(gif);
  const mask = new Array(64).fill(0);
  mask[1 * 8 + 1] = 1;
  const row = {
    medium_image_id: '1*cut.gif', kind: 'gif', status: 'ready', frame_size: [8, 8], delays_cs: [10, 20],
    objects: [{label: 'cut1', masks: [mask, mask]}],
  };
  const els = {};
  function node(name){
    return {
      id: name, className: '', style: {}, children: [], dataset: {},
      classList: { removed: [], remove(c){ this.removed.push(c); }, add(){} },
      appendChild(c){ this.children.push(c); c.parent = this; },
      querySelector(sel){
        if(sel === 'canvas.plate') return this.children.find(c => c.className === 'plate') || null;
        const m = /canvas\.sprite\[data-i="(\d+)"\]/.exec(sel);
        if(m) return this.children.find(c => c.className === 'sprite' && c.dataset.i === m[1]) || null;
        return null;
      },
      addEventListener(type, fn){ this['on' + type] = fn; },
      getContext(){ return { putImageData(){} }; },
      closest(sel){ return sel.indexOf('sprite') >= 0 && this.className === 'sprite' ? this : null; },
      remove(){ this.removedNode = true; if(els.mcut === this) els.mcut = null; },
    };
  }
  const stage = node('stage');
  stage.clientWidth = 80; stage.clientHeight = 80;
  stage.insertBefore = (n) => { stage.children.push(n); els.mcut = n; };
  const image = node('img');
  image.classList.add = () => {};
  const g = globalThis;
  g.document = { getElementById(id){ return id === 'mcut' ? els.mcut || null : null; }, createElement: () => node('el') };
  g.ImageData = class { constructor(data, w, h){ this.data = data; this.width = w; this.height = h; } };
  const mounted = await M.attach({
    how: 'medium', remote: true, url: 'https://miro.medium.com/1*cut.gif', medium_image_id: '1*cut.gif', extension: 'gif',
  }, {
    manifest: {assets: [row]}, image, stage,
    fetch: async () => ({ok: true, arrayBuffer: async () => gif.buffer.slice(gif.byteOffset, gif.byteOffset + gif.byteLength)}),
  });
  assert.equal(mounted.ok, true);
  assert.ok(image.classList.removed.includes('on'));
  assert.equal(image.style.opacity, '0');
  const layer = els.mcut;
  assert.ok(layer);
  const sprite = layer.querySelector('canvas.sprite[data-i="0"]');
  const plateBefore = layer.querySelector('canvas.plate');
  layer.onpointerdown({target: sprite, clientX: 5, clientY: 6, preventDefault(){}});
  layer.onpointermove({clientX: 25, clientY: 9});
  assert.equal(layer._off[0].x, 20);
  assert.equal(layer._off[0].y, 3);
  assert.equal(layer.querySelector('canvas.plate'), plateBefore);
  assert.equal(JSON.stringify(row).includes('object_id'), false);
  clearTimeout(layer._timer);
  M.detach();
  assert.equal(decoded.frames.length, 2);
});

test('a gzip plate fills only known pixels and leaves the rest transparent', () => {
  const zlib = require('node:zlib');
  const w = 2, h = 2;
  const rgba = Uint8ClampedArray.from([10, 0, 0, 255, 20, 0, 0, 255, 30, 0, 0, 255, 40, 0, 0, 255]);
  const mask = [1, 0, 1, 0];
  const known = [1, 0, 0, 0];
  const fill = Uint8ClampedArray.from([1, 2, 3, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const drawn = M.compose(rgba, w, h, [mask], {rgba: fill, known});
  assert.equal(drawn.plate[0], 1);
  assert.equal(drawn.plate[3], 255);
  assert.equal(drawn.plate[8 + 3], 0);
  assert.notEqual(drawn.plate[8], 255);
  const gz = zlib.gzipSync(Buffer.from(fill));
  assert.equal(gz[0], 0x1f);
  assert.equal(gz[1], 0x8b);
  const row = {
    medium_image_id: '1*cut.gif', kind: 'gif', status: 'ready', frame_size: [2, 2], delays_cs: [10],
    plate_gzip_b64: gz.toString('base64'),
    plate_known_bits: {x: 0, y: 0, w: 2, h: 1, bits: Buffer.from([0b10000000]).toString('base64')},
    objects: [{label: 'cut1', masks: [mask]}],
  };
  const plan = M.forSet(set, {assets: [row]});
  assert.equal(plan.ok, true);
  assert.equal(plan.plate[0], 1);
  assert.equal(plan.plateKnown[0], 1);
  assert.equal(plan.plateKnown[2], 0);
});

test('an unreviewed pack is not mounted and a packed mask round-trips', () => {
  const held = row({status:'unreviewed'});
  assert.equal(M.forSet(set, {assets:[held]}).reason, 'unreviewed');
  const bits = Buffer.alloc(1); bits[0] = 0b11000000;
  const spec = {x:1, y:1, w:2, h:1, bits: bits.toString('base64')};
  const mask = M.unpackMask(spec, 8, 8);
  assert.equal(mask[1 * 8 + 1], 1);
  assert.equal(mask[1 * 8 + 2], 1);
  assert.equal(mask[0], 0);
});

test('budget gate uses the measured published bytes and does not admit an unmeasured pack', () => {
  const room = M.roomBytes();
  assert.equal(room, 1073741824 - 791846092 - 41943040);
  assert.equal(room, 239952692);
  assert.equal(M.admit(room).ok, true);
  assert.equal(M.admit(room + 1).reason, 'blocked_budget');
  assert.equal(M.admit(undefined).reason, 'unmeasured');
});

test('coverage of the committed list is the full library and nothing is ready', () => {
  const live = JSON.parse(fs.readFileSync(path.join(root, 'data/live_extra.json'), 'utf8'));
  const man = JSON.parse(fs.readFileSync(path.join(root, 'data/medium_cuts.json'), 'utf8'));
  const counts = M.coverage(live.sets, man);
  assert.equal(counts.medium, 968);
  assert.equal(counts.gif, 651);
  assert.equal(counts.still, 317);
  assert.equal(counts.awaiting_manifest, 968);
  assert.equal(counts.ready, 0);
  assert.equal(counts.missing, 0);
  assert.ok(man.assets.every(a => !a.object_id && !a.masks && a.status === 'awaiting_manifest'));
});
