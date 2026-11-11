import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const M = require(path.join(root, 'assets/medium_cuts.js'));

// What the stage shows at drag offset 0: the plate canvas, with each sprite
// drawn source-over. A zero alpha in the sprite leaves the plate pixel.
function visibleAtRest(drawn, w, h){
  const out = new Uint8ClampedArray(drawn.plate);
  for(const sp of drawn.sprites){
    for(let y = 0; y < sp.h; y++){
      for(let x = 0; x < sp.w; x++){
        const s = (y * sp.w + x) * 4;
        if(sp.rgba[s + 3] === 0) continue;
        const p = ((sp.y + y) * w + (sp.x + x)) * 4;
        out[p] = sp.rgba[s];
        out[p + 1] = sp.rgba[s + 1];
        out[p + 2] = sp.rgba[s + 2];
        out[p + 3] = sp.rgba[s + 3];
      }
    }
  }
  return out;
}

function maxAbs(a, b){
  let m = 0;
  for(let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

test('rest shows the current original frame, including background the static plate does not match', () => {
  const w = 4, h = 4, n = w * h;
  const frame0 = new Uint8ClampedArray(n * 4);
  const frame1 = new Uint8ClampedArray(n * 4);
  const plate = new Uint8ClampedArray(n * 4);
  const known = new Uint8Array(n);
  for(let i = 0; i < n; i++){
    frame0.set([10, 10, 10, 255], i * 4);
    frame1.set([40, 40, 40, 255], i * 4);
    plate.set([10, 10, 10, 255], i * 4);
    known[i] = 1;
  }
  frame0.set([200, 0, 0, 255], (1 * w + 1) * 4);
  frame1.set([200, 0, 0, 255], (1 * w + 2) * 4);
  const mask0 = new Uint8Array(n);
  const mask1 = new Uint8Array(n);
  mask0[1 * w + 1] = 1;
  mask1[1 * w + 2] = 1;
  const frames = [frame0, frame1];
  const masks = [mask0, mask1];
  let plateBufferDiffers = 0;
  for(let f = 0; f < 2; f++){
    const drawn = M.compose(frames[f], w, h, [masks[f]], {rgba: plate, known});
    const visible = visibleAtRest(drawn, w, h);
    assert.equal(maxAbs(visible, frames[f]), 0);
    for(let i = 0; i < n; i++){
      if(masks[f][i]) continue;
      const p = i * 4;
      assert.equal(drawn.plate[p], frames[f][p]);
      assert.equal(drawn.plate[p + 3], 255);
      if(plate[p] !== frames[f][p]) plateBufferDiffers++;
    }
  }
  assert.ok(plateBufferDiffers > 0);
});
