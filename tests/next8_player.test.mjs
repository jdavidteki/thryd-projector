import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tree = process.env.NEXT8_TREE || '';
const originals = process.env.NEXT8_ORIGINALS || '';
const M = require(path.join(root, 'assets/medium_cuts.js'));

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
    remove(){ this.removedNode = true; },
  };
}

async function mount(row, gif){
  const els = {};
  const stage = node('stage');
  stage.clientWidth = 200;
  stage.clientHeight = 200;
  stage.insertBefore = (n) => { stage.children.push(n); els.mcut = n; };
  const image = node('img');
  image.classList.add = () => { image.classList.added = (image.classList.added || []).concat(['on']); };
  const g = globalThis;
  g.document = {
    getElementById(id){ return id === 'mcut' ? els.mcut || null : null; },
    createElement: () => node('el'),
  };
  g.ImageData = class { constructor(data, w, h){ this.data = data; this.width = w; this.height = h; } };
  delete g.ThrydKeep;
  const pack = JSON.parse(fs.readFileSync(path.join(tree, row.pack)));
  g.fetch = async (url) => {
    const u = String(url);
    if(u.includes('medium_cuts.json') || u.endsWith('.json') || u.includes(row.pack)){
      return {ok: true, status: 200, json: async () => pack, arrayBuffer: async () => Buffer.from(JSON.stringify(pack)).buffer};
    }
    return {ok: true, status: 200, arrayBuffer: async () => gif.buffer.slice(gif.byteOffset, gif.byteOffset + gif.byteLength)};
  };
  const mounted = await M.attach({
    how: 'medium', remote: true, url: row.url, medium_image_id: row.medium_image_id, extension: 'gif',
  }, {manifest: {assets: [row]}, image, stage});
  return {mounted, els, image};
}

test('each new cut mounts on its original URL and the drag moves only the sprite', {skip: !tree || !originals}, async () => {
  const man = JSON.parse(fs.readFileSync(path.join(tree, 'data/medium_cuts.json'), 'utf8'));
  const rows = man.assets.filter(a => a.pack && fs.existsSync(path.join(tree, a.pack)) && a.review && a.review.rough_cut);
  assert.equal(rows.length, 8);
  for(const row of rows){
    const gif = fs.readFileSync(path.join(originals, row.medium_image_id.split('*').join('_')));
    const {mounted, els, image} = await mount(row, gif);
    assert.equal(mounted.ok, true, row.medium_image_id + ' ' + (mounted && mounted.reason));
    assert.equal(row.url, 'https://miro.medium.com/' + row.medium_image_id);
    assert.equal(image.style.opacity, '0');
    const layer = els.mcut;
    const plate = layer.querySelector('canvas.plate');
    const sprite = layer.querySelector('canvas.sprite[data-i="0"]');
    assert.ok(sprite, row.medium_image_id);
    layer.onpointerdown({target: sprite, clientX: 4, clientY: 5, preventDefault(){}});
    layer.onpointermove({clientX: 64, clientY: 35});
    assert.equal(layer._off[0].x, 60);
    assert.equal(layer._off[0].y, 30);
    assert.equal(layer.querySelector('canvas.plate'), plate);
    clearTimeout(layer._timer);
    M.detach();
  }
});
