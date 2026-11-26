// v619 command-panel job card + menu buttons (?cards=1)
import test from 'node:test';
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
const here = new URL('..', import.meta.url);
const rd = p => readFileSync(new URL(p, here), 'utf8');
const js = rd('assets/job_card.js'), html = rd('index.html'), st = rd('assets/stage.js'), ver = rd('data/version.json'), ai = rd('assets/intent_ai.js');

test('job_card.js loads only with ?cards=1 and no-ops otherwise', ()=>{
  assert.match(html, /cards=1/);
  assert.match(html, /job_card\.js\?v=1/);
  assert.match(js, /cards=1/);
  assert.match(html, /var VER=619,/);
  const v = JSON.parse(ver);
  assert.equal(v.v, 619);
});

test('layout is job card, then typeline, then plain always-visible buttons', ()=>{
  assert.match(js, /insertBefore\(jobEl, form\)/);
  assert.match(js, /appendChild\(menuEl\)/);
  assert.match(js, /id = 'aicard'/);
  assert.match(js, /id = 'aimenu'/);
  assert.match(js, /function menuBtn/);
  assert.match(js, /createElement\('button'\)/);
  assert.match(js, /menus\.main/);
  assert.match(js, /menus\.lock/);
  assert.doesNotMatch(js, /lock_open && c\.menus/);
  const card = JSON.parse(rd('data/open_card.json'));
  assert.deepEqual(card.menus.main.map(o => o.label), ['🌱 Seed an agenda','🙏 Prayer jobs','🎁 Hold','🐦 Tweets','⏩ Jump ahead']);
  assert.ok(card.menus.lock.length >= 3);
  assert.deepEqual(card.menus.lock.map(o => o.value), ['souvenir','tweets','jump ahead']);
});

test('after Send the panel waits for the next job, then swaps on the slow poll', ()=>{
  assert.match(js, /sent \\u2014 next job coming/);
  assert.match(js, /published card moves to the next jN/);
  assert.match(js, /if\(!panelOn\) return Promise.resolve\(\)/);
  assert.match(js, /POLL_MS = 30000/);
});

test('one Send per job client-side; menu taps deduped for 2 minutes before POST', ()=>{
  assert.match(js, /wasSent\(card\.job\)/);
  assert.match(js, /'sent' : 'Send'/);
  assert.match(js, /MENU_DEDUPE_MS = 120000/);
  assert.match(js, /drop before POST/);
  assert.match(js, /type:'card_pick'/);
  assert.match(js, /type:'menu_action'/);
  assert.match(js, /thrydNtfyPost/);
});

test('one slow poll (>=30s) only while the panel is open; no work when hidden', ()=>{
  assert.match(js, /POLL_MS = 30000/);
  assert.match(js, /LH\.poll\(tick, POLL_MS\)/);
  assert.match(js, /if\(document\.hidden\) return/);
  assert.match(js, /function startPoll/);
  assert.match(js, /function stopPoll/);
});

test('CAP_DEFAULT stays 10, with a follow-up to restore 36; video_card.js is not the hook', ()=>{
  assert.match(st, /const CAP_DEFAULT = 10; \/\/ Follow-up \(after Jesuye approves command-panel job cards\): restore CAP_DEFAULT to 36\./);
  assert.doesNotMatch(html, /video_card\.js\?v=6/);
});

test('command button visible text and aria-label are [[god]], click still toggles the panel', ()=>{
  assert.match(ai, /b\.textContent = '\[\[god\]\]'/);
  assert.match(ai, /setAttribute\('aria-label', '\[\[god\]\]'\)/);
  assert.doesNotMatch(ai, /textContent = '\\u203a_'/);
  assert.match(ai, /box && box\.classList\.contains\('on'\) \? close\(\) : open\(\)/);
  assert.match(html, /intent_ai\.js\?v=611/);
});
