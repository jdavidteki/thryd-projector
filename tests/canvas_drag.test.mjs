// Regression: v544 #canvas wrapper stole pointer events from the stage (full-viewport
// #map / #ents / #prophs were forced to pointer-events:auto and sat above #gstage).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('../assets/projector.css', import.meta.url), 'utf8');
const js = readFileSync(new URL('../assets/projector.js', import.meta.url), 'utf8');
const stage = readFileSync(new URL('../assets/stage.js', import.meta.url), 'utf8');
const cuts = readFileSync(new URL('../assets/medium_cuts.js', import.meta.url), 'utf8');

test('canvas wrapper does not force pointer-events:auto on overlay layers', () => {
  assert.doesNotMatch(css, /#canvas\s*>\s*\*\s*\{[^}]*pointer-events\s*:\s*auto/);
  assert.match(css, /#canvas\s*>\s*#gstage[\s\S]*?pointer-events\s*:\s*auto/);
  assert.match(css, /#canvas\s*>\s*#map[\s\S]*?pointer-events\s*:\s*none/);
  assert.match(css, /#canvas\s*>\s*#ents[\s\S]*?pointer-events\s*:\s*none/);
  assert.match(css, /#canvas\s*>\s*#prophs[\s\S]*?pointer-events\s*:\s*none/);
  assert.match(css, /#map,#ents\{[^}]*pointer-events:none/);
  assert.match(css, /#prophs\{[^}]*pointer-events:none/);
});

test('zoomed pan ignores object / cut pointerdowns', () => {
  assert.match(js, /onItem=t=>t&&t\.closest&&t\.closest\('[^']*\.gcut/);
  assert.match(js, /\.dob/);
  assert.match(js, /canvas\.sprite/);
  assert.match(js, /else if\(P\.size===1&&z>1\)\{pan=/);
});

test('object drag pointer math divides client delta by scale once', () => {
  assert.match(stage, /const dx = \(ev\.clientX - d\.sx\) \/ z, dy = \(ev\.clientY - d\.sy\) \/ z/);
  assert.match(cuts, /function zoomDelta\(dx, dy\)/);
  // #objs uses the parent transformed rect (getBoundingClientRect already includes scale) — no extra /z
  assert.match(js, /d\.b\.style\.left=\(d\.l0\+dx\/L\.width\*100\)\+'%'/);
});
