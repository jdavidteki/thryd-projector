// v635 funback: grain on by default; automatic cool mode off; bobs pause only when hidden
import test from 'node:test';
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
const here = new URL('..', import.meta.url);
const rd = p => readFileSync(new URL(p, here), 'utf8');
const al = rd('assets/alive.js'), css = rd('assets/alive.css'), lh = rd('assets/lowheat.js'), html = rd('index.html'), ver = rd('data/version.json');

test('film grain is created by default, and ?grain=0 opts out', ()=>{
  assert.match(al, /\(\?:\^\|\[\?&\]\)grain=0\(\?:&\|\$\)/);
  assert.match(al, /classList\.add\('grain-on'\)/);
  assert.match(al, /\$\('div','grain'\)/);
  assert.match(css, /html:not\(\.grain-on\) #grain\{display:none\}/);
  assert.doesNotMatch(al, /grain=1\(\?:&\|\$\)/);
});

test('cool mode is only forced by ?cool=1; the automatic governor is off', ()=>{
  assert.match(lh, /Q\.get\('cool'\)/);
  assert.match(lh, /COOL_Q==='1'\)setCool\(true/);
  assert.match(lh, /classList\.toggle\('lh-cool',on\)/);
  assert.match(lh, /function govern\(gap\)\{return;\}/);
  assert.match(css, /html\.lh-cool \*/);
  assert.doesNotMatch(lh, /setCool\(true,'slow frames'\)/);
});

test('leftover decorative card bobs, pin pulse and LIVE blink pause only when hidden; video card still autoplays and loops', ()=>{
  assert.match(css, /html\.lh-hidden \.videocard[\s\S]*animation-play-state:paused/);
  assert.doesNotMatch(css, /html\.lh-idle \.videocard/);
  assert.doesNotMatch(css, /html\.lh-idle #live \.dot/);
  assert.doesNotMatch(css, /html\.lh-idle #gstage \.gcut\.gpin/);
  const vc = rd('assets/video_card.js');
  assert.match(vc, /\.autoplay\s*=\s*true|\bautoplay\b/);
  assert.match(vc, /\.loop\s*=\s*true|\bloop\b/);
});

test('index and version.json are at v635 or later', ()=>{
  assert.match(html, /var VER=\d+,/);
  assert.match(html, /stage\.js\?v=\d+/);
  assert.match(html, /lowheat\.js\?v=4/);
  assert.match(ver, /"v": \d+/);
  const v = JSON.parse(ver);
  assert.ok(v.v >= 635);
});
