import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const js = readFileSync(new URL('../assets/projector.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../assets/projector.css', import.meta.url), 'utf8');
const keep = readFileSync(new URL('../assets/thryd_keep.js', import.meta.url), 'utf8');
const stage = readFileSync(new URL('../assets/stage.js', import.meta.url), 'utf8');
const cuts = readFileSync(new URL('../assets/medium_cuts.js', import.meta.url), 'utf8');

test('zoom targets the whole #canvas, not only #stage', () => {
  assert.match(js, /zoom\/pan the whole canvas/);
  assert.match(js, /const MIN=0\.5, MAX=3, STEP=1\.2/);
  assert.match(js, /id='canvas'/);
  assert.match(css, /#canvas\{position:fixed;inset:0/);
  assert.match(css, /#canvas\.zoom-anim\{transition:transform \.22s ease\}/);
});

test('keep settings persist zoom', () => {
  assert.match(keep, /thryd_zoom/);
  assert.match(keep, /cur\.zoom/);
});

test('pointer math divides by scale', () => {
  assert.match(js, /screenDelta=\(dx,dy\)=>\{ const s=z\|\|1; return \[dx\/s, dy\/s\]; \}/);
  assert.match(stage, /const dx = \(ev\.clientX - d\.sx\) \/ z/);
  assert.match(cuts, /function zoomDelta\(dx, dy\)/);
});

test('zoomAt / toScene / clamp math around the viewport centre', () => {
  const MIN = 0.5, MAX = 3, STEP = 1.2;
  let z = 1, tx = 0, ty = 0;
  const W = 1000, H = 800;
  const clampZ = n => Math.min(MAX, Math.max(MIN, +n || 1));
  const clamp = () => {
    if (z >= 1) { tx = Math.min(0, Math.max(W - W * z, tx)); ty = Math.min(0, Math.max(H - H * z, ty)); }
    else { tx = (W - W * z) / 2; ty = (H - H * z) / 2; }
  };
  const zoomAt = (nz, cx, cy) => {
    nz = clampZ(nz);
    const sx = (cx - tx) / z, sy = (cy - ty) / z;
    z = nz; tx = cx - sx * z; ty = cy - sy * z;
    if (Math.abs(z - 1) < 1e-6) { z = 1; tx = ty = 0; }
    clamp();
  };
  const toScene = (x, y) => [(x - tx) / z, (y - ty) / z];
  zoomAt(z * STEP, W / 2, H / 2);
  assert.ok(Math.abs(z - 1.2) < 1e-9);
  const mid = toScene(W / 2, H / 2);
  assert.ok(Math.abs(mid[0] - W / 2) < 1e-6);
  assert.ok(Math.abs(mid[1] - H / 2) < 1e-6);
  zoomAt(0.5, W / 2, H / 2);
  assert.equal(z, 0.5);
  assert.equal(tx, (W - W * z) / 2);
  const [dx, dy] = [120, -40].map((v, i) => v / z);
  assert.equal(dx, 240);
  assert.equal(dy, -80);
  zoomAt(99, W / 2, H / 2);
  assert.equal(z, 3);
});
