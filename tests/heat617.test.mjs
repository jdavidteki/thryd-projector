// v617 heat: warp and GIF/plate loops wake when a frame is due; off-screen cuts drop will-change; pin pulse pauses when idle/hidden
import test from 'node:test';
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
const here = new URL('..', import.meta.url);
const rd = p => readFileSync(new URL(p, here), 'utf8');
const st = rd('assets/stage.js'), sb = rd('assets/stretchy_bg.js'), css = rd('assets/alive.css'), html = rd('index.html'), ver = rd('data/version.json');

test('stretchy warp is scheduled at DRAW_MS (~4 fps), slower when idle or cool, not on every display frame', ()=>{
  assert.match(sb, /var DRAW_MS = 240;/);
  assert.match(sb, /var COMPOSE_MS = 500;/);
  assert.match(sb, /function drawMs\(\)\{ try\{ if\(window\.LH && \(LH\.state==='idle' \|\| LH\.cool\)\) return 500;/);
  assert.match(sb, /function composeMs\(\)\{ try\{ if\(window\.LH && \(LH\.state==='idle' \|\| LH\.cool\)\) return 800;/);
  assert.match(sb, /wake only when a warp frame is due/);
  assert.match(sb, /_timer = setTimeout\(function\(\)\{/);
  assert.doesNotMatch(sb, /_loop\.raf = requestAnimationFrame\(_wrapped\);\s*\n\s*if\(_loop\.busy\) return;/);
  assert.match(sb, />= composeMs\(\)/);
  assert.match(sb, /tn - lastDraw < drawMs\(\)/);
});

test('stage GIF/plate loop wakes when a frame is due; off-screen cuts still skip redraw and drop will-change', ()=>{
  assert.match(st, /cut\._vis === false\) continue;/);
  assert.match(st, /c\._vis === false \|\| !el\.classList\.contains\('fl'\)/);
  assert.match(st, /function scheduleFrame\(now\)\{/);
  assert.match(st, /anims\.forEach\(A => \{ const d = A\.due - t; if\(d < wait\) wait = d; \}\);/);
  assert.match(st, /el\.style\.willChange = 'transform'/);
  assert.match(st, /el\.style\.willChange = 'auto'/);
  assert.match(st, /LH\.slide : setInterval\)\(floatTick, 83\)/);
  assert.match(st, /tickBgs\(now, 0\.16\)/);
  assert.match(st, /function scheduleTags\(\)\{/);
  assert.doesNotMatch(st, /requestAnimationFrame\(tagLoop\); \}\)\(\);/);
});

test('map-pin pulse and LIVE badge blink pause when idle or hidden; video card still autoplays and loops', ()=>{
  assert.match(css, /html\.lh-idle #gstage \.gcut\.gpin \.gmappin\.live[\s\S]*animation-play-state:paused/);
  assert.match(css, /html\.lh-idle #live \.dot,html\.lh-hidden #live \.dot\{animation-play-state:paused/);
  const vc = rd('assets/video_card.js');
  assert.match(vc, /\.autoplay\s*=\s*true|\bautoplay\b/);
  assert.match(vc, /\.loop\s*=\s*true|\bloop\b/);
  assert.match(css, /html\.lh-idle \.videocard[\s\S]*animation-play-state:paused/);
});

test('one CAP_DEFAULT (36) sets how many story objects are on stage; ?cap=N overrides; groups and soft cap follow', ()=>{
  assert.match(st, /const CAP_DEFAULT = 36;/);
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

test('index and version.json are at v618 or later', ()=>{
  assert.match(html, /var VER=\d+,/);
  assert.match(html, /stage\.js\?v=\d+/);
  const v = JSON.parse(ver);
  assert.ok(v.v >= 618);
  assert.match(html, /var VER=625,/);
  assert.match(html, /stage\.js\?v=622/);
  assert.match(html, /stretchy_bg\.js\?v=8/);
  assert.match(html, /alive\.css\?v=9/);
});
