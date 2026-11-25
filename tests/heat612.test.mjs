// v612 heat: shared float ticker (no per-cut CSS animation, no rotation), timer-paced active frames, quieter typing, smaller grain, slower warp compose
import test from 'node:test';
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
const here = new URL('..', import.meta.url);
const rd = p => readFileSync(new URL(p, here), 'utf8');
const st = rd('assets/stage.js'), lh = rd('assets/lowheat.js'), al = rd('assets/alive.js'), css = rd('assets/alive.css'), sb = rd('assets/stretchy_bg.js');
test('stage float is driven by one ticker, with no rotation and no per-cut animation', ()=>{
  assert.match(st, /#gstage \.gcut\.fl\{transform:translate\(calc\(-1\.4% \+ 2\.8% \* var\(--s,\.5\)\)/);
  assert.doesNotMatch(st, /#gstage \.gcut\.fl\{animation:mcfloat/);
  const rule = st.match(/'#gstage \.gcut\.fl\{transform:[^']*'/)[0]; assert.doesNotMatch(rule, /rotate/);
  assert.match(st, /LH\.slide : setInterval\)\(floatTick, 83\)/);
  assert.match(st, /\[data-dragging="1"\]\{animation:none;transform:none;/);
});
test('off-screen cuts skip the GIF redraw and the float; plates drift ~11 Hz under the warp', ()=>{
  assert.match(st, /cut\._vis === false\) continue;/); assert.match(st, /c\._vis === false \|\| !el\.classList\.contains\('fl'\)/);
  assert.match(st, /tickBgs\(now, 0\.16\)/); assert.match(st, /Math\.min\(cap \|\| 0\.05,/);
});
test('lowheat waits on a timer between active frames, drags stay at the display rate', ()=>{
  assert.match(lh, /if\(s==='active'&&!ptrDown&&lastFlush\)\{var w=lastFlush\+ACTIVE_FRAME-performance\.now\(\)-5;/);
  assert.match(lh, /ACTIVE_FRAME=1000\/30/);
});
test('code panel types 3 letters per step, whole line when idle; grain layer is ~1.1x the screen', ()=>{
  assert.match(al, /i=st==='idle'\?s\.length:Math\.min\(s\.length,i\+3\)/);
  assert.match(css, /#grain\{position:fixed;inset:-5%;/); assert.match(css, /#code\{contain:paint;/);
  assert.match(sb, /var COMPOSE_MS = 500;/);
});
