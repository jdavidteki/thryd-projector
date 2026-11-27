// v636: ambient in-cut motion + command verbs + anim manifest fallback + 2x dwell
import test from 'node:test';
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import {createContext, runInContext} from 'node:vm';

const here = new URL('..', import.meta.url);
const rd = p => readFileSync(new URL(p, here), 'utf8');
const st = rd('assets/stage.js'), ca = rd('assets/cut_animate.js');
const html = rd('index.html'), ver = JSON.parse(rd('data/version.json'));
const anim = JSON.parse(rd('data/anim_cuts.json'));

function loadAnimate(){
  const root = {};
  const ctx = createContext({window: root, globalThis: root, module: {exports: {}}, exports: {}, console});
  runInContext(ca, ctx, {filename: 'cut_animate.js'});
  return root.ThrydCutAnimate;
}

test('index, loader and version.json stay at or above v636; cut_animate.js loads before stage.js', ()=>{
  assert.ok(ver.v >= 636);
  assert.match(html, /var VER=\d+,/);
  assert.match(html, /cut_animate\.js\?v=1['"],'stage\.js\?v=\d+'/);
});

test('anim_cuts manifest has dwell_k 3.5 (v646) and a cuts list (still fallback when empty or file missing)', ()=>{
  assert.equal(anim.v, 1);
  assert.equal(anim.dwell_k, 3.5);
  assert.ok(Array.isArray(anim.cuts));
  assert.match(st, /data\/anim_cuts\.json/);
  assert.match(st, /function applyAnim\(/);
  assert.match(st, /anim fallback still/);
  assert.match(st, /L\.hasAnim = true/);
});

test('v646: animated groups stay 3.5x as long as plain stills (ANIM_DWELL_K = 3.5); live views 4x', ()=>{
  assert.match(st, /const ANIM_DWELL_K = 3\.5;/);
  assert.match(st, /\(L\.hasAnim \|\| L\.animated\) \? ANIM_DWELL_K : 1/);
  assert.match(st, /const LIVE_DWELL_K = 4;/);
  assert.match(st, /row\.live_view \? LIVE_DWELL_K : \(\(L\.hasAnim \|\| L\.animated\) \? ANIM_DWELL_K : 1\)/);
});

test('ambient in-cut paint runs on the display-rate loop for visible cuts, not off-screen, not when reduced-motion', ()=>{
  assert.match(st, /ThrydCutAnimate\.paintAmbient|A\.paintAmbient\(cut, now/);
  assert.match(st, /cut\._vis === false \|\| cut\.dragging/);
  assert.match(st, /if\(!RM && root\.ThrydCutAnimate\)/);
  assert.match(st, /keepSrc\(cut\)/);
});

test('kindOf, un-synced phases, person breath/sway/blink, object kinds, and verb dictionary', ()=>{
  const A = loadAnimate();
  assert.equal(A.kindOf('person'), 'person');
  assert.equal(A.kindOf('cell phone'), 'phone');
  assert.equal(A.kindOf('cup'), 'cup');
  assert.equal(A.kindOf('lantern'), 'lamp');
  assert.equal(A.kindOf('flag'), 'cloth');
  assert.equal(A.ANIM_DWELL_K, 3.5);
  const a = {label: 'cut1', klass: 'person', g: {mid: 'a'}};
  const b = {label: 'cut1', klass: 'person', g: {mid: 'b'}};
  const pa = A.sampleAmbient(a, 0, 100, 200);
  const pb = A.sampleAmbient(b, 0, 100, 200);
  assert.equal(pa.kind, 'person');
  assert.equal(pa.strips.length, 6);
  assert.notEqual(A.seedOf(a), A.seedOf(b));
  // two people are not in sync at t=0 (different phases)
  const dxA = pa.strips[0].dx, dxB = pb.strips[0].dx;
  assert.notEqual(dxA, dxB);
  // breath scale is minor
  const mid = pa.strips[2].sy;
  assert.ok(Math.abs(mid - 1) < 0.05, 'breath is minor, got ' + mid);
  const phone = A.sampleAmbient({label: 'cut1', klass: 'cell phone', g: {mid: 'p'}}, 800, 40, 60);
  assert.equal(phone.kind, 'phone');
  const cup = A.sampleAmbient({label: 'cut1', klass: 'bowl', g: {mid: 'c'}}, 400, 80, 50);
  assert.equal(cup.kind, 'cup');
  for(const v of ['walk','approach','bounce','shake','spin','orbit','fade','nod']){
    assert.ok(A.verbOf(v), v);
  }
  assert.equal(A.verbOf('approach'), 'walk');
  assert.equal(A.verbOf('explode'), null);
  const sc = A.makeScript('bounce', 1000, null);
  assert.equal(sc.verb, 'bounce');
  const pose = A.sampleScript(sc, 0.25, {left:0,top:0,w:50,h:80}, null);
  assert.ok(pose.ty < 0, 'bounce goes up');
  const nod = A.sampleScript(A.makeScript('nod'), 0.25, {w:50,h:80}, null);
  assert.ok(nod.ty !== 0 || nod.rot !== 0);
});

test('stage hooks playMotion and command verbs into typed/cli calls', ()=>{
  assert.match(st, /S\.playMotion = function/);
  assert.match(st, /ThrydCutAnimate\.verbOf\(piece\.fn\)/);
  assert.match(st, /ThrydCutAnimate\.makeScript\(piece\.fn/);
  assert.match(st, /ThrydCutAnimate\.verbOf\(f\.method\)/);
});

test('fun was not cut: display-rate loop, grain default, and v635 float stay', ()=>{
  assert.match(st, /tickBgs\(now\);/);
  assert.match(st, /#gstage \.gcut\.fl\{animation:mcfloat/);
  assert.match(rd('index.html'), /alive\.css\?v=10/);
});

test('v641: fe_anim.js loads after stage.js (opt-in ?feanim=1); applyLiveAnim is on the stage; 20 pilot candidates are published', ()=>{
  assert.match(html, /stage\.js\?v=6[4-9]\d','fe_anim\.js\?v=2/);
  assert.match(st, /function applyLiveAnim\(/);
  assert.match(st, /S\.applyLiveAnim = applyLiveAnim/);
  assert.match(st, /root\.ThrydStage = S/);
  assert.match(st, /ANIM\.by\.size/);
  assert.match(st, /only swap a still when a \*new\* anim url actually exists|never redraw stills/);
  assert.equal(anim.space, 'Lightricks/ltx-video-distilled');
  assert.equal(anim.endpoint, '/image_to_video');
  assert.ok(Array.isArray(anim.candidates));
  assert.equal(anim.candidates.length, 20);
  assert.ok(anim.candidates.every(c => c.cut_id && c.png && c.prompt && c.i2v_size));
});
