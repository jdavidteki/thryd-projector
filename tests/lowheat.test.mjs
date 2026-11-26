// low-heat scheduler (v607, v635 funback): loaded first; hidden pauses all but audio/saving;
// decorative loops keep running while the tab is visible; polls stay slowed.
import test from 'node:test';
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
const here = new URL('..', import.meta.url);
const rd = p => readFileSync(new URL(p, here), 'utf8');
const lh = rd('assets/lowheat.js'), html = rd('index.html');

test('lowheat.js loads before every other script on the projector, /story/ and the lovemap', ()=>{
  assert.ok(html.indexOf('assets/lowheat.js') > 0 && html.indexOf('assets/lowheat.js') < html.indexOf('<script>'));
  const st = rd('story/index.html'); assert.ok(st.indexOf('../assets/lowheat.js') < st.indexOf('<script>'));
  const lm = rd('assets/lovemap.html'); assert.ok(lm.indexOf('lowheat.js') < lm.indexOf('3d-force-graph'));
});

test('?lowheat=0 off switch, reduced motion flag, visibilitychange, polls 2-5 min, hidden keeps only keep-kind timers', ()=>{
  assert.match(lh, /lowheat'\)==='0'/);
  assert.match(lh, /prefers-reduced-motion/);
  assert.match(lh, /visibilitychange/);
  assert.match(lh, /if\(ms>=300000\)return ms;if\(ms>=60000\)return 180000;return 120000;/);
  assert.match(lh, /if\(s==='hidden'\)return r\.kind==='keep'\?r\.ms:Infinity;/);
  assert.match(lh, /\|\|60000\)/);
});

test('decorative loops keep their own pace while visible, including when idle', ()=>{
  assert.match(lh, /if\(r\.kind==='keep'\|\|r\.kind==='slide'\|\|r\.kind==='deco'\)return r\.ms;/);
  assert.doesNotMatch(lh, /if\(r\.kind==='deco'\)return s==='idle'\?Infinity:r\.ms;/);
  assert.doesNotMatch(lh, /if\(s==='idle'&&r\.deco\)return;/);
});

test('version check every 5 min', ()=>{ assert.match(html, /setInterval\(chk,300000\)/); assert.match(html, /var VER=\d+,/); });

test('decorative loops use LH.deco; slideshow, live GIF, audio and persistence opt out', ()=>{
  assert.match(rd('assets/alive.js'), /LH\.deco:requestAnimationFrame\)\(anim\)/);
  const g = rd('story/gode.js'); assert.match(g, /LH\.deco:requestAnimationFrame\)\(drift\)/); assert.match(g, /LH\.decoEvery:setInterval\)\(settle,1000\)/);
  assert.match(rd('story/gode_fx.js'), /LH\.deco:requestAnimationFrame\)\(frame\)/);
  assert.match(rd('assets/story_card.js'), /LH\.deco:requestAnimationFrame\)\(mframe\)/);
  const p = rd('assets/projector.js'); assert.match(p, /bgTimer=\(window\.LH\?LH\.slide:setInterval\)\(tick/); assert.match(p, /slideT=\(window\.LH\?LH\.slide/);
  assert.match(p, /LH\.keep:setInterval\)\(\(\)=>\{if\(mine\(\)\|\|take\(\)\)write\(\);\},1000\)/);
  assert.equal((rd('assets/extras.js').match(/LH\.keep:setInterval/g) || []).length, 3);
});
