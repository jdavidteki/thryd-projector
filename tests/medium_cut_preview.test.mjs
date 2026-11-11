import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const M = require(path.join(root, 'assets/medium_cuts.js'));
const P = require(path.join(root, 'assets/medium_cut_preview.js'));

test('preview override does not mutate the pack and does not call fetch', async () => {
  const gif = fs.readFileSync(path.join(root, 'tests/fixtures/cut_two.gif'));
  const pack = {
    medium_image_id: '1*cut.gif', kind: 'gif', status: 'unreviewed', reviewed: false,
    frame_size: [8, 8], delays_cs: [10, 20],
    objects: [{label: 'cut1', masks: [(() => { const m = new Array(64).fill(0); m[9] = 1; return m; })(), (() => { const m = new Array(64).fill(0); m[9] = 1; return m; })()]}],
  };
  const before = JSON.stringify(pack);
  const row = P.previewPack(pack);
  assert.equal(JSON.stringify(pack), before);
  assert.equal(pack.status, 'unreviewed');
  assert.equal(pack.reviewed, false);
  assert.equal(row.status, 'ready');
  assert.equal(row.reviewed, false);
  assert.equal(row.preview_only, true);
  let fetches = 0;
  globalThis.fetch = () => { fetches += 1; throw new Error('network'); };
  const bytes = P.b64ToBytes(gif.toString('base64'));
  assert.equal(Buffer.compare(Buffer.from(bytes), gif), 0);
  const res = await P.inlineFetch(bytes)('https://example.invalid/original.gif');
  const got = new Uint8Array(await res.arrayBuffer());
  assert.equal(fetches, 0);
  assert.equal(Buffer.compare(Buffer.from(got), gif), 0);
  const els = {};
  function node(name){
    return {
      id: name, className: '', style: {}, children: [], dataset: {},
      classList: {removed: [], remove(c){ this.removed.push(c); }, add(){}},
      appendChild(c){ this.children.push(c); c.parent = this; },
      querySelector(sel){
        if(sel === 'canvas.plate') return this.children.find(c => c.className === 'plate') || null;
        const m = /canvas\.sprite\[data-i="(\d+)"\]/.exec(sel);
        if(m) return this.children.find(c => c.className === 'sprite' && c.dataset.i === m[1]) || null;
        return null;
      },
      addEventListener(type, fn){ this['on' + type] = fn; },
      getContext(){ return {putImageData(){}}; },
      closest(sel){ return sel.indexOf('sprite') >= 0 && this.className === 'sprite' ? this : null; },
      remove(){ this.removedNode = true; if(els.mcut === this) els.mcut = null; },
    };
  }
  const stage = node('stage');
  stage.clientWidth = 80; stage.clientHeight = 80;
  stage.insertBefore = (n) => { stage.children.push(n); els.mcut = n; };
  const image = node('img');
  globalThis.document = {getElementById(id){ return id === 'mcut' ? els.mcut || null : null; }, createElement: () => node('el')};
  globalThis.ImageData = class { constructor(data, w, h){ this.data = data; this.width = w; this.height = h; } };
  const mounted = await P.mount({pack, bytes: gif, stage, image, cuts: M});
  assert.equal(fetches, 0);
  assert.equal(mounted.ok, true);
  assert.equal(pack.status, 'unreviewed');
  const layer = els.mcut;
  const sprite = layer.querySelector('canvas.sprite[data-i="0"]');
  layer.onpointerdown({target: sprite, clientX: 1, clientY: 2, preventDefault(){}});
  layer.onpointermove({clientX: 11, clientY: 6});
  assert.equal(layer._off[0].x, 10);
  assert.equal(layer._off[0].y, 4);
  assert.ok(layer._frame);
  clearTimeout(layer._timer);
  M.detach();
});
