// v614 heat: grain off unless ?grain=1; cool mode when frames stay slow; leftover bobs pause when idle/hidden
import test from 'node:test';
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
const here = new URL('..', import.meta.url);
const rd = p => readFileSync(new URL(p, here), 'utf8');
const al = rd('assets/alive.js'), css = rd('assets/alive.css'), lh = rd('assets/lowheat.js'), st = rd('assets/stage.js'), html = rd('index.html'), ver = rd('data/version.json');
test('film grain is not created unless ?grain=1', ()=>{
  assert.match(al, /\(\?:\^\|\[\?&\]\)grain=1\(\?:&\|\$\)/);
  assert.match(al, /classList\.add\('grain-on'\)/);
  assert.doesNotMatch(al, /\$\('div','grain'\);/);
  assert.match(css, /html:not\(\.grain-on\) #grain\{display:none\}/);
});
test('cool mode drops to ~20 fps, is forced by ?cool=1, and can be turned off with ?cool=0', ()=>{
  assert.match(lh, /ACTIVE_FRAME=on\?1000\/20-3:1000\/30-3/);
  assert.match(lh, /Q\.get\('cool'\)/);
  assert.match(lh, /COOL_Q==='1'\)setCool\(true/);
  assert.match(lh, /classList\.toggle\('lh-cool',on\)/);
  assert.match(css, /html\.lh-cool \*/);
  assert.match(st, /LH\.cool && LH\.state !== 'idle' && \(FLOAT\.n\+\+ % 2\)/);
});
test('leftover decorative card bobs pause when idle or hidden; video card still autoplays and loops', ()=>{
  assert.match(css, /html\.lh-idle \.videocard[\s\S]*animation-play-state:paused/);
  const vc = rd('assets/video_card.js');
  assert.match(vc, /\.autoplay\s*=\s*true|\bautoplay\b/);
  assert.match(vc, /\.loop\s*=\s*true|\bloop\b/);
});
test('index and version.json are at v614', ()=>{
  assert.match(html, /var VER=614,/);
  assert.match(html, /stage\.js\?v=614/);
  assert.match(html, /lowheat\.js\?v=3/);
  assert.match(ver, /"v": 614/);
});
