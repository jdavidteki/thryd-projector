// v635 funback: CSS mcfloat with rotation, letter-by-letter typing, 4x grain, 120 ms warp compose.
// Invisible heat savings that stay: off-screen GIF skip, hidden-tab pause.
import test from 'node:test';
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
const here = new URL('..', import.meta.url);
const rd = p => readFileSync(new URL(p, here), 'utf8');
const st = rd('assets/stage.js'), lh = rd('assets/lowheat.js'), al = rd('assets/alive.js'), css = rd('assets/alive.css'), sb = rd('assets/stretchy_bg.js');

test('stage float is the CSS mcfloat animation, with rotation, and no JS ticker', ()=>{
  assert.match(st, /#gstage \.gcut\.fl\{animation:mcfloat var\(--fd,7s\) ease-in-out var\(--fdl,0s\) infinite\}/);
  assert.doesNotMatch(st, /#gstage \.gcut\.fl\{transform:translate\(calc\(-1\.4% \+ 2\.8% \* var\(--s,\.5\)\)/);
  const cssSrc = rd('assets/projector.css');
  assert.match(cssSrc, /@keyframes mcfloat\{0%,100%\{transform:translate\(-1\.4%,\.9%\) rotate\(-1\.8deg\) scale\(1\.045\)\}50%\{transform:translate\(1\.4%,-1\.8%\) rotate\(1\.8deg\) scale\(1\.06\)\}\}/);
  assert.match(st, /#gstage \.gcut\[data-dragging="1"\]\{animation:none;transform:none;/);
  assert.doesNotMatch(st, /function floatTick\(/);
  assert.doesNotMatch(st, /LH\.slide : setInterval\)\(floatTick, 83\)/);
});

test('off-screen cuts still skip the GIF redraw and drop will-change', ()=>{
  assert.match(st, /cut\._vis === false\) continue;/);
  assert.match(st, /el\.style\.willChange = 'transform'/);
  assert.match(st, /el\.style\.willChange = 'auto'/);
});

test('lowheat runs at the display rate while visible (no 30 fps timer wait unless ?cool=1)', ()=>{
  assert.doesNotMatch(lh, /if\(s==='active'&&!ptrDown&&lastFlush\)\{var w=lastFlush\+ACTIVE_FRAME-performance\.now\(\)-5;/);
  assert.match(lh, /if\(LH\.cool&&!ptrDown&&lastFlush\)\{var w=lastFlush\+ACTIVE_FRAME-performance\.now\(\)-5;/);
  assert.match(lh, /function govern\(gap\)\{return;\}/);
});

test('code panel types 1 letter per step; grain layer is ~4x the screen and jitters at .9s', ()=>{
  assert.match(al, /d\.textContent=s\.slice\(0,\+\+i\)/);
  assert.doesNotMatch(al, /i=st==='idle'\?s\.length:Math\.min\(s\.length,i\+3\)/);
  assert.match(css, /#grain\{position:fixed;inset:-50%;/);
  assert.match(css, /animation:grain \.9s steps\(6\) infinite/);
  assert.match(sb, /var COMPOSE_MS = 120;/);
});
