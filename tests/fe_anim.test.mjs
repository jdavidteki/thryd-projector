// v639: in-browser free image-to-video queue for the 20 pilot cuts
import test from 'node:test';
import assert from 'node:assert';
import {readFileSync, existsSync} from 'node:fs';
import {createContext, runInContext} from 'node:vm';

const here = new URL('..', import.meta.url);
const rd = p => readFileSync(new URL(p, here), 'utf8');
const src = rd('assets/fe_anim.js');
const html = rd('index.html');
const ver = JSON.parse(rd('data/version.json'));
const anim = JSON.parse(rd('data/anim_cuts.json'));

function load(search=''){
  const store = {};
  const pills = [];
  const doc = {
    hidden: false,
    readyState: 'loading',  // do not auto-start the idle queue in tests
    body: {classList: {contains: () => false}, appendChild(){}},
    getElementById: (id) => id === 'aianimpill' ? doc._pill : (id === 'aibox' ? doc._box : null),
    createElement(tag){
      const el = {tag, style: {}, setAttribute(){}, remove(){ doc._pill = null; }, textContent: ''};
      if(tag === 'div'){
        Object.defineProperty(el, 'textContent', {set(v){ el._t = v; pills.push(v); if(doc._pill === el) doc._pillText = v; }, get(){ return el._t; }, configurable: true});
      }
      return el;
    },
    addEventListener(){},
    querySelector: () => null,
    _box: {insertBefore(el){ doc._pill = el; }, appendChild(el){ doc._pill = el; }, parentNode: null},
    _pill: null,
  };
  const root = {
    document: doc,
    location: {search},
    localStorage: {
      getItem: k => store[k] || null,
      setItem: (k,v) => { store[k] = String(v); },
    },
    addEventListener(){},
    LH: {lastInput: 0, state: 'visible', poll(fn, ms){ return 0; }, keep(fn, ms){ return 0; }},
  };
  root.window = root; root.globalThis = root;
  const ctx = createContext({window: root, document: doc, location: root.location, localStorage: root.localStorage, console, Date, Math, JSON, Promise, Error, Map, Object, Array, String, Number, Boolean, parseInt, parseFloat, setTimeout, clearTimeout, setInterval, clearInterval, URL, URLSearchParams, addEventListener(){}, Uint8ClampedArray});
  // bind document/location from root for the IIFE
  ctx.window = root; ctx.document = doc;
  runInContext(src, ctx, {filename: 'fe_anim.js'});
  return {root, doc, store, pills};
}

test('v641: fe_anim.js is loaded after stage.js and version is 641', ()=>{
  assert.ok(ver.v >= 641);
  assert.match(html, /var VER=(6[4-9]\d),/);
  assert.match(html, /stage\.js\?v=6[4-9]\d','fe_anim\.js\?v=2/);
});

test('uses the public Lightricks LTX space over a CDN @gradio/client, never a paid or Grok API', ()=>{
  assert.equal(anim.space, 'Lightricks/ltx-video-distilled');
  assert.equal(anim.endpoint, '/image_to_video');
  assert.match(src, /cdn\.jsdelivr\.net\/npm\/@gradio\/client/);
  assert.match(src, /Lightricks\/ltx-video-distilled/);
  assert.doesNotMatch(src, /api\.x\.ai|openai\.com|generativelanguage|grok-credits|xAI/i);
  assert.match(src, /Never uses Grok \/ paid APIs/);
});

test('twenty pilot candidates are published with png + prompt + sizes; v646 cuts are real files keyed by medium id + cut', ()=>{
  assert.equal(anim.candidates.length, 20);
  for(const c of (anim.cuts || [])){
    assert.ok(c.medium_image_id && c.cut && /^assets\/anim_cuts\/[^/]+\.gif$/.test(c.anim));
    assert.ok(existsSync(new URL(c.anim, here)), 'anim file shipped: ' + c.anim);
    assert.ok(c.bytes > 0 && c.bytes < 2.2e6, 'GIF stays under ~2 MB');
  }
  for(const c of anim.candidates){
    assert.ok(c.cut_id && c.png.startsWith('assets/anim_pilot/'));
    assert.ok(c.prompt && c.prompt.length > 8);
    assert.ok(Array.isArray(c.i2v_size) && c.i2v_size.length === 2);
    assert.ok(Array.isArray(c.display_size) && c.display_size.length === 2);
  }
});

test('queue is off by default and with ?feanim=0; only ?feanim=1 exposes thrydFeAnim', ()=>{
  assert.equal(load('').root.thrydFeAnim, undefined);
  assert.equal(load('?mode=live').root.thrydFeAnim, undefined);
  assert.equal(load('?feanim=0').root.thrydFeAnim, undefined);
  const on = load('?feanim=1');
  assert.ok(on.root.thrydFeAnim);
  assert.equal(on.root.thrydFeAnim.space, 'Lightricks/ltx-video-distilled');
  assert.equal(on.root.thrydFeAnim.endpoint, '/image_to_video');
});

test('nextCandidate skips cuts that already have a saved anim and respects per-cut backoff', ()=>{
  const {root} = load('?feanim=1');
  const A = root.thrydFeAnim;
  const recs = anim.candidates.slice(0, 3);
  const cat = {candidates: recs, cuts: [{medium_image_id: recs[0].medium_image_id, cut: recs[0].cut, anim: 'assets/anim_cuts/x.gif'}]};
  assert.equal(A.hasAnim(cat, recs[0]), true);
  assert.equal(A.hasAnim(cat, recs[1]), false);
  assert.equal(A.nextCandidate(cat).cut_id, recs[1].cut_id);
  A.markFail(recs[1].cut_id, 'network boom');
  assert.equal(A.nextCandidate(cat).cut_id, recs[2].cut_id);
});

test('any failure (not only quota) holds the whole queue in localStorage; the pill is a status only', ()=>{
  const {root, pills} = load('?feanim=1');
  const A = root.thrydFeAnim;
  A.markFail('q', 'Failed to fetch');
  const st = A.loadState();
  assert.ok(st.holdUntil > Date.now() + 60 * 1000, 'generic errors must persist a queue-wide backoff');
  A.markFail('q2', 'ZeroGPU quota exceeded');
  const st2 = A.loadState();
  assert.ok(st2.holdUntil > Date.now() + 4 * 60 * 1000);
  A.pill('🎞️ animating cut 3/20', true);
  assert.ok(pills.includes('🎞️ animating cut 3/20') || pills.some(t => /animating cut 3\/20/.test(String(t||''))));
  assert.equal(typeof A.pillText, 'function');
  assert.doesNotMatch(src, /thrydSimplePost\([^)]*fail/);
  assert.match(src, /pill shows only while one real request is in flight|never retriggers/i);
});

test('chromaKey punches mid-grey letterbox and leaves other pixels', ()=>{
  const {root} = load('?feanim=1');
  const A = root.thrydFeAnim;
  const w = 4, h = 1;
  const data = new Uint8ClampedArray([128,128,128,255, 200,10,10,255, 130,128,127,255, 0,0,0,255]);
  const im = {data};
  const ctx = {getImageData: () => im, putImageData(){}};
  A.chromaKey(ctx, w, h);
  assert.equal(data[3], 0, 'grey becomes transparent');
  assert.equal(data[7], 255, 'red stays');
  assert.equal(data[11], 0, 'near-grey + nearly-neutral becomes transparent');
  assert.equal(data[15], 255, 'black stays');
});
