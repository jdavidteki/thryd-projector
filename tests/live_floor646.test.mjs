// v646: live (animated) cuts stay longer, and the stage keeps a floor of at least 10 animated cuts on screen
import test from 'node:test';
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import {createContext, runInContext} from 'node:vm';

const here = new URL('..', import.meta.url);
const st = readFileSync(new URL('assets/stage.js', here), 'utf8');

// pull the floor helpers out of stage.js and run them against a fake stage
function floorKit(){
  const a = st.indexOf('const LIVE_FLOOR = 10;');
  const b = st.indexOf('S.LIVE_FLOOR = LIVE_FLOOR;');
  assert.ok(a > 0 && b > a, 'floor block present');
  const src = st.slice(a, b);
  const S = {cuts: []};
  const ctx = createContext({S, isLeaving: c => !!(c && (c.leaving || (c.g && c.g.gone)))});
  runInContext(src + '\nthis.k = {LIVE_FLOOR, isLiveCut, liveCutsOn, groupLiveCuts, floorHolds};', ctx);
  return {S, k: ctx.k};
}
function group(nLive, nStill){
  const g = {cuts: [], gone: false};
  for(let i = 0; i < nLive; i++) g.cuts.push({g, frames: [1, 2, 3]});
  for(let i = 0; i < nStill; i++) g.cuts.push({g, frames: [1]});
  return g;
}

test('dwell: animated groups 3.5x a plain still, live views 4x (were 1x/2x and 2.5x)', ()=>{
  assert.match(st, /const ANIM_DWELL_K = 3\.5;/);
  assert.match(st, /const LIVE_DWELL_K = 4;/);
  assert.match(st, /row\.live_view \? LIVE_DWELL_K : \(\(L\.hasAnim \|\| L\.animated\) \? ANIM_DWELL_K : 1\)/);
});

test('floor is 10 animated cuts; a group holds only if leaving drops the stage under 10', ()=>{
  const {S, k} = floorKit();
  assert.equal(k.LIVE_FLOOR, 10);
  const A = group(4, 1), B = group(4, 0), C = group(3, 2), P = group(0, 5);
  S.cuts = [A, B, C, P].flatMap(g => g.cuts);
  assert.equal(k.liveCutsOn(), 11);
  assert.equal(k.floorHolds(P), false, 'a still-only group never holds');
  assert.equal(k.floorHolds(A), true, '11 - 4 = 7 < 10');
  const D = group(6, 0); S.cuts = S.cuts.concat(D.cuts);
  assert.equal(k.liveCutsOn(), 17);
  assert.equal(k.floorHolds(A), false, '17 - 4 = 13 >= 10, may leave');
  assert.equal(k.floorHolds(D), false, '17 - 6 = 11 >= 10, may leave');
});

test('fewer than 10 animated cuts in total: every animated group stays', ()=>{
  const {S, k} = floorKit();
  const A = group(3, 0), B = group(2, 3);
  S.cuts = [A, B].flatMap(g => g.cuts);
  assert.equal(k.floorHolds(A), true);
  assert.equal(k.floorHolds(B), true);
  A.cuts[0].leaving = true; // leaving cuts do not count toward the floor
  assert.equal(k.liveCutsOn(), 4);
});

test('floor is wired into life expiry, eviction and the deck', ()=>{
  assert.match(st, /if\(floorHolds\(g\)\) g\.life \+= 20000;/);
  assert.match(st, /function evictable\(g\)\{[^\n]*!floorHolds\(g\)\)/);
  assert.match(st, /const under = liveCutsOn\(\) < LIVE_FLOOR;/);
  assert.match(st, /animMids\(\)\.has\(a\.medium_image_id\)/);
});

test('stills with a real moving version come up about 1 pick in 3 while any is free', ()=>{
  assert.match(st, /if\(Math\.random\(\) < 0\.33\)\{ const as = live\.filter\(animStill\);/);
});
