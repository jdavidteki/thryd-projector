// v635 funback: warp and GIF/plate loops run on every display frame while visible;
// off-screen cuts still skip redraw and drop will-change; pin pulse pauses only when hidden.
import test from 'node:test';
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
const here = new URL('..', import.meta.url);
const rd = p => readFileSync(new URL(p, here), 'utf8');
const st = rd('assets/stage.js'), sb = rd('assets/stretchy_bg.js'), css = rd('assets/alive.css'), html = rd('index.html'), ver = rd('data/version.json');

test('stretchy warp is scheduled on every display frame, compose 120 ms, render 0.7x; paused when hidden', ()=>{
  assert.match(sb, /var COMPOSE_MS = 120;/);
  assert.doesNotMatch(sb, /var DRAW_MS = /);
  assert.doesNotMatch(sb, /function drawMs\(/);
  assert.doesNotMatch(sb, /function composeMs\(/);
  assert.match(sb, /var k = 0\.7;/);
  assert.match(sb, /_loop\.raf = requestAnimationFrame\(_wrapped\);/);
  assert.doesNotMatch(sb, /wake only when a warp frame is due/);
  assert.doesNotMatch(sb, /_timer = setTimeout\(function\(\)\{/);
  assert.match(sb, /if\(document\.hidden\)\{/);
  assert.match(sb, /_clock\.paused = true/);
  assert.match(sb, />= COMPOSE_MS/);
});

test('stage GIF/plate loop runs on every display frame while visible; off-screen cuts still skip redraw and drop will-change', ()=>{
  assert.match(st, /cut\._vis === false\) continue;/);
  assert.match(st, /el\.style\.willChange = 'transform'/);
  assert.match(st, /el\.style\.willChange = 'auto'/);
  assert.match(st, /function scheduleFrame\(\)\{/);
  assert.match(st, /requestAnimationFrame\(function\(now\)\{ frameArmed = 0;/);
  assert.doesNotMatch(st, /anims\.forEach\(A => \{ const d = A\.due - t; if\(d < wait\) wait = d; \}\);/);
  assert.doesNotMatch(st, /LH\.slide : setInterval\)\(floatTick, 83\)/);
  assert.doesNotMatch(st, /tickBgs\(now, 0\.16\)/);
  assert.match(st, /tickBgs\(now\);/);
});

test('map-pin pulse and LIVE badge blink pause only when hidden; video card still autoplays and loops', ()=>{
  assert.match(css, /html\.lh-hidden #gstage \.gcut\.gpin \.gmappin\.live/);
  assert.match(css, /html\.lh-hidden #live \.dot\{animation-play-state:paused/);
  assert.doesNotMatch(css, /html\.lh-idle #gstage \.gcut\.gpin/);
  assert.doesNotMatch(css, /html\.lh-idle #live \.dot/);
  const vc = rd('assets/video_card.js');
  assert.match(vc, /\.autoplay\s*=\s*true|\bautoplay\b/);
  assert.match(vc, /\.loop\s*=\s*true|\bloop\b/);
  assert.match(css, /html\.lh-hidden \.videocard[\s\S]*animation-play-state:paused/);
});

test('one CAP_DEFAULT (56) sets how many story objects are on stage; ?cap=N overrides; groups and soft cap follow', ()=>{
  assert.match(st, /const CAP_DEFAULT = 56;/);
  assert.match(st, /URLSearchParams\(location\.search\)\.get\('cap'\)/);
  assert.match(st, /const CAP = \(function\(\)\{/);
  assert.match(st, /const SOFT_CAP = CAP;/);
  assert.match(st, /MAX_GROUPS = Math\.max\(CAP \* 4, 16\)/);
  assert.doesNotMatch(st, /SOFT_CAP = Math\.max\(1, CAP - Math\.max\(2, Math\.round\(CAP \/ 6\)\)\)/);
  assert.doesNotMatch(st, /MAX_GROUPS = Math\.max\(1, Math\.round\(CAP \/ 2\)\)/);
  assert.doesNotMatch(st, /const CAP = 36;/);
  assert.doesNotMatch(st, /const MAX_GROUPS = 18;/);
  assert.match(st, /S\.CAP_DEFAULT = CAP_DEFAULT/);
  assert.match(st, /function makeRoom\(needCuts\)/);
  assert.match(st, /evictOldest\('room'\)/);
  assert.match(st, /activeStoryCuts\(\)\.length > SOFT_CAP/);
  assert.match(st, /evictOldest\('soft-cap'\)/);
  assert.match(st, /evictOldest\('cap'\)/);
});

test('index and version.json stay at or above v636', ()=>{
  assert.match(html, /var VER=\d+,/);
  assert.match(html, /stage\.js\?v=\d+/);
  const v = JSON.parse(ver);
  assert.ok(v.v >= 636);
  assert.match(html, /var VER=(6[4-9]\d),/);
  assert.match(html, /stage\.js\?v=6[4-9]\d/);
  assert.match(html, /stretchy_bg\.js\?v=9/);
  assert.match(html, /alive\.css\?v=10/);
  assert.match(html, /alive\.js\?v=59/);
  assert.match(html, /lowheat\.js\?v=4/);
});
