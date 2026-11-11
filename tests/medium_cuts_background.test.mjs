// The setting from the original GIF is always drawn behind the cut objects (never a black stage),
// and a dragged object leaves no duplicate of itself at its old spot.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import test from 'node:test';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const M = require(path.join(root, 'assets/medium_cuts.js'));

const w = 6, h = 4, n = w * h;
const SUBJ = [220, 30, 30, 255];
function scene(f){
  // a lit, non-black setting that changes per frame, with a red subject
  const rgba = new Uint8ClampedArray(n * 4);
  for(let i = 0; i < n; i++) rgba.set([90 + f * 10 + i, 120, 160, 255], i * 4);
  const mask = new Uint8Array(n);
  for(const i of [1 * w + 1, 1 * w + 2, 2 * w + 1, 2 * w + 2]){ mask[i] = 1; rgba.set(SUBJ, i * 4); }
  return {rgba, mask};
}
function plan(withPlate){
  const frames = [scene(0), scene(1)];
  const known = new Uint8Array(n), fill = new Uint8ClampedArray(n * 4);
  if(withPlate){ known[1 * w + 1] = 1; fill.set([90, 120, 160, 255], (1 * w + 1) * 4); }
  const p = {ok:true, kind:'gif', width:w, height:h, frameCount:2, delays_cs:[5, 5],
    objects:[{label:'cut1', masks:frames.map(f=>f.mask)}], plate: withPlate ? fill : null, plateKnown: withPlate ? known : null};
  const decoded = {width:w, height:h, frames:frames.map(f=>({rgba:f.rgba, delayCs:5}))};
  return {frames, played: M.planFrames(decoded, p)};
}
const black = px => { let k = 0; for(let i = 0; i < px.length; i += 4) if(px[i+3] < 10 || px[i] + px[i+1] + px[i+2] < 30) k++; return k; };

for(const withPlate of [true, false]){
  test(`unmoved cut: background is the original frame, not black (plate=${withPlate})`, () => {
    const {frames, played} = plan(withPlate);
    assert.equal(played.ok, true);
    const layer = {_w:w, _h:h, _off:[{x:0, y:0}]};
    played.frames.forEach((fr, f) => {
      const bg = M.plateFor(layer, fr);
      assert.equal(black(bg), 0, 'no black or transparent pixel behind an unmoved cut');
      assert.deepEqual(Array.from(bg), Array.from(frames[f].rgba), 'exact original pixels');
    });
  });

  test(`dragged cut leaves no duplicate at its old spot (plate=${withPlate})`, () => {
    const {frames, played} = plan(withPlate);
    for(const off of [{x:30, y:12}, {x:-5, y:0}]){ // live drag, or a place restored by Resume
      const layer = {_w:w, _h:h, _off:[off]};
      played.frames.forEach((fr, f) => {
        const bg = M.plateFor(layer, fr);
        for(let i = 0; i < n; i++){
          const p = i * 4;
          if(frames[f].mask[i]){
            const dup = bg[p] === SUBJ[0] && bg[p+1] === SUBJ[1] && bg[p+2] === SUBJ[2] && bg[p+3] > 0;
            assert.equal(dup, false, 'subject pixel duplicated at old spot');
            if(withPlate && i === 1 * w + 1) assert.deepEqual(Array.from(bg.slice(p, p + 4)), [90, 120, 160, 255], 'stored plate fill used');
            else assert.equal(bg[p+3], 0, 'no fill: transparent');
          }else{
            assert.deepEqual(Array.from(bg.slice(p, p + 4)), Array.from(frames[f].rgba.slice(p, p + 4)), 'setting kept outside the hole');
          }
        }
      });
    }
  });
}

test('two cuts: only the dragged one opens a hole; the unmoved one keeps the setting under it', () => {
  const rgba = new Uint8ClampedArray(n * 4).fill(150);
  const a = new Uint8Array(n), b = new Uint8Array(n); a[0] = 1; b[n - 1] = 1;
  const got = M.compose(rgba, w, h, [a, b], null, [false, true]);
  assert.equal(got.plate[3], 150);
  assert.equal(got.plate[(n - 1) * 4 + 3], 0);
  assert.equal(M.movedFlags({_off:[{x:0, y:0}, {x:1, y:0}]}, 2).join(), 'false,true');
});

// Moved-object fill from other frames of the same GIF (exact posted pixels, no ghost).
function moving(){
  // 3 frames; the red subject (2x2) walks right; background differs per frame
  const W = 8, H = 4, N = W * H, frames = [];
  for(let f = 0; f < 3; f++){
    const rgba = new Uint8ClampedArray(N * 4), mask = new Uint8Array(N);
    for(let i = 0; i < N; i++) rgba.set([60 + f, 100 + i, 140, 255], i * 4);
    for(const dx of [0, 1]) for(const dy of [1, 2]){ const i = dy * W + f * 3 + dx; mask[i] = 1; rgba.set(SUBJ, i * 4); }
    frames.push({rgba, mask});
  }
  return {W, H, N, frames};
}
test('moved object: hole filled only from real frame pixels outside the mask, never the subject', () => {
  const {W, H, N, frames} = moving();
  const p = {ok:true, kind:'gif', width:W, height:H, frameCount:3, delays_cs:[5,5,5], objects:[{label:'cut1', masks:frames.map(f=>f.mask)}], plate:null, plateKnown:null};
  const fb = M.fillBuilder(W, H, null, null, 0);
  frames.forEach((fr, f) => fb.add(f, fr.rgba, [fr.mask]));
  const fill = fb.done();
  p.plate = fill.rgba; p.plateKnown = fill.known;
  const played = M.planFrames({width:W, height:H, frames:frames.map(f=>({rgba:f.rgba, delayCs:5}))}, p);
  const layer = {_w:W, _h:H, _off:[{x:40, y:0}]};
  let filled = 0, holes = 0;
  played.frames.forEach((fr, f) => {
    const bg = M.plateFor(layer, fr);
    for(let i = 0; i < N; i++){
      if(!frames[f].mask[i]) continue;
      holes++;
      const q = i * 4;
      assert.notDeepEqual(Array.from(bg.slice(q, q + 4)), SUBJ, 'ghost of the moved subject');
      if(bg[q + 3] === 0) continue;
      filled++;
      const g = fill.from[i];
      assert.ok(g >= 0 && !frames[g].mask[i], 'source frame has the spot uncovered');
      assert.deepEqual(Array.from(bg.slice(q, q + 4)), Array.from(frames[g].rgba.slice(q, q + 4)), 'exact posted pixel');
    }
    // unmoved = exact original frame
    assert.deepEqual(Array.from(M.plateFor({_w:W, _h:H, _off:[{x:0, y:0}]}, fr)), Array.from(frames[f].rgba));
  });
  assert.equal(filled, holes, 'every hole pixel here was uncovered in some other frame');
});
test('fill prefers the stored plate pixel, and the guard band keeps mask edges out', () => {
  const {W, H, N, frames} = moving();
  const plate = new Uint8ClampedArray(N * 4), known = new Uint8Array(N);
  known[1 * W + 0] = 1; plate.set([1, 2, 3, 255], (1 * W + 0) * 4);
  const fb = M.fillBuilder(W, H, plate, known, 1);
  frames.forEach((fr, f) => fb.add(f, fr.rgba, [fr.mask]));
  const fill = fb.done();
  assert.deepEqual(Array.from(fill.rgba.slice((1 * W) * 4, (1 * W) * 4 + 4)), [1, 2, 3, 255]);
  assert.equal(fill.from[1 * W + 0], -2);
  for(let i = 0; i < N; i++){
    const g = fill.from[i]; if(g < 0) continue;
    const x = i % W, y = (i / W) | 0;
    for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){
      const xx = x + dx, yy = y + dy; if(xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      assert.equal(frames[g].mask[yy * W + xx], 0, 'fill pixel taken next to the subject edge');
    }
  }
});
