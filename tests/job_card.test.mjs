// v619 command-panel job card + menu buttons (?cards=1)
import test from 'node:test';
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
const here = new URL('..', import.meta.url);
const rd = p => readFileSync(new URL(p, here), 'utf8');
const js = rd('assets/job_card.js'), html = rd('index.html'), st = rd('assets/stage.js'), ver = rd('data/version.json'), ai = rd('assets/intent_ai.js');

test('job_card.js loads only with ?cards=1 and no-ops otherwise', ()=>{
  assert.match(html, /cards=1/);
  assert.match(html, /job_card\.js\?v=3/);
  assert.match(js, /cards=1/);
  assert.match(html, /var VER=623,/);
  const v = JSON.parse(ver);
  assert.equal(v.v, 623);
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
  assert.match(js, /'sent \\u2713' : 'Send'/);
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

test('CAP_DEFAULT is back to 36 (Jesuye approved 26 Nov 12:35 PM); video_card.js is not the hook', ()=>{
  assert.match(st, /const CAP_DEFAULT = 36;/);
  assert.doesNotMatch(st, /Follow-up \(after Jesuye approves command-panel job cards\)/);
  assert.doesNotMatch(html, /video_card\.js\?v=6/);
});

test('command button visible text and aria-label are [[god]], click still toggles the panel', ()=>{
  assert.match(ai, /b\.textContent = '\[\[god\]\]'/);
  assert.match(ai, /setAttribute\('aria-label', '\[\[god\]\]'\)/);
  assert.doesNotMatch(ai, /textContent = '\\u203a_'/);
  assert.match(ai, /box && box\.classList\.contains\('on'\) \? close\(\) : open\(\)/);
  assert.match(html, /intent_ai\.js\?v=612/);
  // close keeps the dragged position for the next open
  assert.match(ai, /function close\(\)\{ if\(box\)\{ box\.classList\.remove\('on'\); inp\.blur\(\); \} \}/);
  assert.match(ai, /POS_KEY = 'thryd_aibox_pos'/);
});

test('v621: Send is never silent; stale card says so; tweet lines; Literata; capped height', ()=>{
  assert.match(js, /Pick a line \(or type one\) first\./);
  assert.match(js, /is closed \\u2014 /);
  assert.match(js, /function awaitReply/);
  assert.match(js, /setStatus\('Not sent/);
  assert.match(js, /sel\.values/);
  assert.match(js, /sig === cardSig/);
  assert.match(js, /className = 'ot'/);
  assert.match(js, /literata-420\.woff2/);
  assert.match(js, /overflow:hidden/);
  assert.match(js, /function reclamp/);
  const card = JSON.parse(rd('data/open_card.json'));
  if(card.open){ assert.ok(card.options.some(o => typeof o.line === 'string' && o.line.length > 0)); }
});

test('v622: card/menu posts use the typeline lane with 429 backoff+retry, friendly errors, one Jump ahead, long tweet lines scroll', ()=>{
  assert.match(js, /root\.thrydTypelinePost/);
  assert.match(js, /lastR\.retryAfter/);
  assert.match(js, /the network is busy right now/);
  assert.doesNotMatch(js, /'HTTP ' \+ r\.status \+ \(r\.status === 429/);
  assert.match(js, /lockHasJump/);
  assert.match(js, /max-height:5\.8em;overflow-y:auto/);
  assert.match(js, /awaitReply\(body, t0, r\)/);
});

test('v623: 🎥 is a Live view pill (own menu_action per job), not a line option', ()=>{
  assert.match(js, /function isLiveOpt/);
  assert.match(js, /filter\(o => !isLiveOpt\(o\)\)/);
  assert.match(js, /c\.menus\.live/);
  const card = JSON.parse(rd('data/open_card.json'));
  if(card.open){ assert.deepEqual(card.menus.live, [{label: '\u{1f3a5} Live view', value: 'live_view: ' + card.job}]); }
});
