// v619 command-panel job card + menu buttons (on by default; ?cards=0 hides)
import test from 'node:test';
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
const here = new URL('..', import.meta.url);
const rd = p => readFileSync(new URL(p, here), 'utf8');
const js = rd('assets/job_card.js'), html = rd('index.html'), st = rd('assets/stage.js'), ver = rd('data/version.json'), ai = rd('assets/intent_ai.js');

test('job_card.js loads by default; ?cards=0 hides the panel', ()=>{
  assert.match(html, /cards=0/);
  assert.match(html, /job_card\.js\?v=18/);
  assert.match(js, /cards=0/);
  assert.match(html, /if\(!\/\(\?:\^\|\[\?&\]\)cards=0/);
  assert.match(js, /if\(\/\(\?:\^\|\[\?&\]\)cards=0/);
  assert.doesNotMatch(html, /if\(\/\(\?:\^\|\[\?&\]\)cards=1/);
  assert.match(html, /var VER=644,/);
  const v = JSON.parse(ver);
  assert.ok(v.v >= 644);
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
  // v637: full [[god]] navigator on the menu row; Publish still lock-row only; Live view is menus.live
  assert.deepEqual(card.menus.main.map(o => o.label), [
    '🌱 Seed an agenda','📐 Draw a story','🧭 Move','🙏 Prayer jobs','⏳ Async jobs',
    '🤲 Hold','🐦 Tweets','📋 Show all agendas','🖼️ view story diagram',
    '🕊️ [[poetry]]','🐦 [[hpr]]','🗺️ Lovemap','🎙️ Podcasts'
  ]);
  assert.ok(card.menus.lock.length >= 4);
  assert.deepEqual(card.menus.lock.map(o => o.value), ['souvenir','tweets','publish!','jump ahead']);
  assert.equal(card.menus.lock.find(o => o.value === 'publish!').label, '📣 Publish');
});

test('after Send the panel waits for the next job, then swaps on the slow poll', ()=>{
  assert.match(js, /sent \\u2014 next job coming/);
  assert.match(js, /published card moves to the next jN/);
  assert.match(js, /if\(!panelOn\) return Promise.resolve\(\)/);
  assert.match(js, /POLL_MS = 30000/);
});

test('one Send per job client-side; menu taps deduped for 2 minutes before POST', ()=>{
  assert.match(js, /wasSent\(card\.job\)/);
  assert.match(js, /'sent \\u2713' : \(resendFor\(c\) \? 'Resend' : 'Send'\)/);   // v644: Resend after a receipt timeout
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
  assert.match(html, /intent_ai\.js\?v=614/);
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
  assert.match(js, /max-height:15em;overflow-y:auto/);
  assert.match(js, /awaitReply\(body, t0, r, RECEIPT_MS\)/);   // v644: 20 s receipt window
});

test('v623: 🎥 is a Live view pill (own menu_action per job), not a line option', ()=>{
  assert.match(js, /function isLiveOpt/);
  assert.match(js, /filter\(o => !isLiveOpt\(o\)\)/);
  assert.match(js, /c\.menus\.live/);
  const card = JSON.parse(rd('data/open_card.json'));
  if(card.open){ assert.deepEqual(card.menus.live, [{label: '\u{1f3a5} Live view', value: 'live_view: ' + card.job}]); }
});

test('v624: the panel may hang off any edge; a 120px strip of the [[god]] header always stays on screen', ()=>{
  assert.match(ai, /const GRIP = 120;/);
  assert.match(ai, /minL = g - \(w \|\| g\)/);
  assert.match(ai, /AI\.clampBox = function/);
  assert.match(js, /ai\.clampBox\(\)/);
});

test('v625: one activation per tap across the whole panel (no ghost tap on a neighbouring button)', ()=>{
  assert.match(js, /lastUp\.el !== el && now - lastUp\.at < 600/);
  assert.doesNotMatch(js, /aimnote:empty\{display:none\}/);
});

test('v637: full [[god]] menu on the panel, Live view while waiting, lock row still gets Publish', ()=>{
  assert.match(js, /value: 'publish!'/);
  assert.match(js, /withPublish\(lock\)\.forEach/);
  assert.match(js, /out\.splice\(i, 0, PUBLISH\)/);
  assert.match(js, /c\.waiting && c\.seated_job/);
  assert.match(js, /\(\(c && c\.menus && c\.menus\.live\) \|\| \[\]\)\.forEach/);
  assert.match(js, /function sheetEl\(/);
  assert.doesNotMatch(js, /MAIN_DROP = \/\^menu:\\s\*\(hold\|tweets\)\$\/i/);
  const src = js.slice(js.indexOf('const PUBLISH'), js.indexOf('function render(){'));
  const f = new Function(src + '; return {withPublish};')();
  assert.deepEqual(f.withPublish([{value:'souvenir'},{value:'tweets'},{value:'jump ahead'}]).map(o => o.value), ['souvenir','tweets','publish!','jump ahead']);
  assert.deepEqual(f.withPublish([{value:'souvenir'},{value:'publish!'},{value:'jump ahead'}]).map(o => o.value), ['souvenir','publish!','jump ahead']);
});

test('v628: panel stays open after Send; waiting refresh keeps the sent card; each option shows the full archive safe', ()=>{
  // typeline auto-close must not dismiss a cards-on panel (the old close() call bypassed the hook)
  assert.match(ai, /function autoDismiss\(\)\{ if\(box && box\.classList\.contains\('cards-on'\)\) return;/);
  assert.match(ai, /setTimeout\(autoDismiss, 3500\)/);
  assert.doesNotMatch(ai, /setTimeout\(\(\)=>\{ if\(box && box\.classList\.contains\('on'\) && document\.activeElement !== inp\) close\(\); \}, 3500\)/);
  // hook still blocks typeline AI.close; only a user close dismisses the panel
  assert.match(js, /if\(!userClose\) return;/);
  // after Send, a waiting / closed open_card must not collapse the sent confirmation
  assert.match(js, /card\.open && wasSent\(card\.job, j\) && !\(j\.open && j\.job && j\.job !== card\.job\) && !isLocked\(j\)/);
  assert.match(js, /Sent \\u2713 your ' \+ job \+ ' pick is in \\u2014 next job coming/);
  // full archive safe under each option: title + numbered lines (verbatim), «picked» highlighted, no curly quotes / italics
  assert.match(js, /function safeRows\(/);
  assert.match(js, /function fillSafe\(/);
  assert.match(js, /safeText\(o\) \|\| tweetLine\(o\)/);
  assert.match(js, /r\.classList\.add\('pick'\)/);
  assert.match(js, /t\.scrollTop = Math\.max\(0, pick\.offsetTop - t\.offsetTop/);
  assert.doesNotMatch(js, /pick\.scrollIntoView/);
  assert.match(js, /\['pointerdown','pointerup','click'\]\.forEach\(k => t\.addEventListener\(k, ev => \{ ev\.stopPropagation\(\); \}, true\)\)/);
  assert.doesNotMatch(js, /textContent = '\\u201c' \+ tl \+ '\\u201d'/);
  assert.doesNotMatch(js, /\.ot\{font:italic/);
  assert.match(js, /ui-monospace,Menlo,Consolas,monospace/);
  assert.match(js, /background:rgba\(0,0,0,\.35\)/);
  assert.match(js, /border-radius:8px;white-space:normal/);
  assert.match(js, /max-height:15em;overflow-y:auto/);
  assert.match(js, /touch-action:pan-y/);
  assert.match(html, /job_card\.js\?v=18/);
  assert.match(html, /intent_ai\.js\?v=614/);
  const src = js.slice(js.indexOf('function safeText(o){'), js.indexOf('function render(){'));
  const f = new Function(src + '; return {safeRows, safeText};')();
  const s = f.safeRows('330. intense flirting: 1. #juniorboys - him. his name is kiyo. / 2. other [[code]] line / 3. «- the picked line» 2024');
  assert.equal(s.title, '330. intense flirting \u00b7 2024');
  assert.deepEqual(s.rows, ['1. #juniorboys - him. his name is kiyo.', '2. other [[code]] line', '3. \u00ab- the picked line\u00bb']);
  assert.ok(s.rows[2].includes('\u00ab') && s.rows[2].includes('\u00bb'));
  const card = JSON.parse(rd('data/open_card.json'));
  if(card.open){
    const withSafe = card.options.filter(o => o.line && o.line !== '\u{1f3a5}');
    assert.ok(withSafe.length >= 1, 'job options should carry a safe');
    assert.ok(withSafe.every(o => typeof o.safe === 'string' && o.safe.includes('«')), 'each line option has a full safe with «picked»');
    assert.ok(withSafe.every(o => !('description' in o)), 'public field is safe, not description');
  }
});

test('v629: seat line, lock progress, waiting-to-be-seated, lock state on the panel', ()=>{
  assert.match(js, /function seatStrip\(\)/);
  assert.match(js, /function updateStrip\(\)/);
  assert.match(js, /jobEl\.appendChild\(seatStrip\(\)\)/);
  assert.match(js, /if\(metaChanged\) updateStrip\(\)/);
  assert.match(js, /pick waiting to be seated/);
  assert.match(js, /This agenda is locked/);
  assert.match(js, /'aimrow' \+ \(isLocked\(meta \|\| c\) \? ' hot' : ''\)/);
  assert.match(js, /#aimenu \.aimrow\.hot\{/);
  // no new timers / animation loops (heat)
  assert.doesNotMatch(js, /requestAnimationFrame/);
  const src = js.slice(js.indexOf('function hhmm('), js.indexOf('function seatStrip()'));
  let sent = {};
  const f = new Function('wasSent', src + '; return {isLocked, pendingFor};')(j => !!sent[j]);
  assert.equal(f.isLocked({lines: 159, next_lock_at_lines: 162}), false);
  assert.equal(f.isLocked({lines: 162, next_lock_at_lines: 162}), true);
  assert.equal(f.isLocked({lines: 10, lock_open: true}), true);
  const c = {open: true, job: 'j43'};
  assert.equal(f.pendingFor({pending: null, last_seat: {job: 'j42'}}, c), null);
  assert.deepEqual(f.pendingFor({pending: {pick: {job: 'j43', at: 'x', n: 2}}}, c), {job: 'j43', at: 'x', n: 2});
  sent.j43 = 1; // sent from this screen, export not caught up yet
  assert.deepEqual(f.pendingFor({pending: null, last_seat: {job: 'j42'}}, c), {job: 'j43', local: true});
  assert.equal(f.pendingFor({pending: null, last_seat: {job: 'j43'}}, c), null);
  const card = JSON.parse(rd('data/open_card.json'));
  if(card.run && card.next_lock_at_lines){ assert.ok('last_seat' in card && 'pending' in card, 'export carries last_seat + pending'); }
});

test('v630: sent taps survive a refresh as pills, cleared by resolved/seated, card lane while waiting', ()=>{
  assert.match(js, /SENT_LOG = 'thryd_sent_log_v630'/);
  assert.match(js, /logSent\(\{kind: 'pick'/);
  assert.match(js, /logSent\(\{kind: 'menu'/);
  assert.match(js, /' sent' \+ \(tm \? ' \\u00b7 ' \+ tm : ''\) \+ ' \\u00b7 waiting'/);
  assert.match(js, /'\\u2713 ' \+ what \+ ' done'/);
  assert.match(js, /j\.resolved/);
  assert.match(js, /'-c'/);
  assert.match(js, /setTimeout\(laneTick, 10000\)/);   // v632: lane always on (SSE; 10 s poll fallback)
  assert.match(js, /POLL_MS = 30000/);   // Pages poll unchanged
});

test('v632: lane always on (SSE since 10m, poll fallback), newest at wins, closed when hidden', ()=>{
  assert.match(js, /new EventSource\(base \+ '\/sse\?since=10m'\)/);
  assert.match(js, /laneOpen\(\);\s+\/\/ v632: lane from load/);
  assert.match(js, /if\(document\.hidden\) laneClose\(\); else laneOpen\(\)/);
  assert.match(js, /setTimeout\(laneTick, 10000\)/);
  assert.match(js, /atMs\(j\.at\) <= atMs\(meta\.at\)/);
  assert.doesNotMatch(js, /laneUntil/);
});

test('v633: archive safe lines flow inline at a smaller font; title stays its own line', ()=>{
  assert.match(js, /createElement\('span'\); r\.className = 'otl'/);
  assert.match(js, /sep\.className = 'ots'/);
  assert.match(js, /sep\.textContent = ' \\u00b7 '/);
  assert.match(js, /body\.className = 'otb'/);
  assert.match(js, /#aicard \.aicopt \.ot \.otl\{display:inline/);
  assert.match(js, /#aicard \.aicopt \.ot\{font:400 8\.5px\/1\.25/);
  assert.match(js, /max-height:15em;overflow-y:auto/);
  assert.doesNotMatch(js, /#aicard \.aicopt \.ot \.otl\{display:block\}/);
  assert.doesNotMatch(js, /max-height:8\.7em/);
  assert.match(js, /t\.scrollTop = Math\.max\(0, pick\.offsetTop - t\.offsetTop/);
  assert.doesNotMatch(js, /pick\.scrollIntoView/);
  const src = js.slice(js.indexOf('function safeText(o){'), js.indexOf('function render(){'));
  const f = new Function(src + '; return {safeRows};')();
  const s = f.safeRows('330. intense flirting: 1. #juniorboys - like me? / 2. - instead of fighting [[stronga]] / 3. «- the picked line» 2024');
  assert.equal(s.title, '330. intense flirting \u00b7 2024');
  assert.deepEqual(s.rows, ['1. #juniorboys - like me?', '2. - instead of fighting [[stronga]]', '3. \u00ab- the picked line\u00bb']);
});

test('v634: open async jobs render as persistent waiting-on-real-life pills; empty list shows nothing', ()=>{
  assert.match(html, /var VER=644,/);
  assert.match(html, /job_card\.js\?v=18/);
  const v = JSON.parse(ver);
  assert.ok(v.v >= 644);
  assert.match(js, /function asyncPills\(/);
  assert.match(js, /function jobText\(/);
  assert.match(js, /function ago\(/);
  assert.match(js, /waiting on real life/);
  assert.match(js, /aicwait aicasync/);
  assert.match(js, /asyncPills\(m\)\.forEach/);
  assert.match(js, /m\.async_jobs/);
  // no new timers / polling / animation loops for the pill (render on existing SSE/open_card update)
  assert.doesNotMatch(js, /setInterval\([^)]*async/i);
  assert.doesNotMatch(js, /requestAnimationFrame/);
  // no result-entry form wired on the pill
  const pillSrc = js.slice(js.indexOf('function asyncPills('), js.indexOf('function seatStrip(){'));
  assert.doesNotMatch(pillSrc, /setscore|setresult|textarea|input/i);
  const src = js.slice(js.indexOf('function prettyKind('), js.indexOf('function asyncPills('));
  const f = new Function(src + '; return {prettyKind, jobText, ago};')();
  assert.equal(f.prettyKind('playps5'), 'play PS5');
  assert.equal(f.prettyKind('fifa.match'), 'FIFA');
  assert.equal(f.jobText({text: 'kunle vs dapo play PS5'}), 'kunle vs dapo play PS5');
  assert.equal(f.jobText({characters: 'kunle,dapo', kind: 'playps5'}), 'kunle vs dapo play PS5');
  const now = Date.parse('2026-11-26T17:00:00-05:00');
  assert.equal(f.ago('2026-11-26T16:59:20-05:00', now), 'just opened');
  assert.equal(f.ago('2026-11-26T16:10:00-05:00', now), 'open 50 minutes');
  assert.equal(f.ago('2026-11-26T05:00:00-05:00', now), 'open 12 hours');
  assert.equal(f.ago('2026-11-25T17:00:00-05:00', now), 'open 1 day');
  assert.equal(f.ago('2026-10-27T17:00:00-05:00', now), 'open 30 days');
  assert.equal(f.ago('', now), '');
  const card = JSON.parse(rd('data/open_card.json'));
  assert.ok(Array.isArray(card.async_jobs), 'export carries async_jobs (possibly empty)');
  // never invent: every listed job has a real id
  assert.ok(card.async_jobs.every(j => j && typeof j.id === 'string' && j.id && typeof j.text === 'string'));
});

test('v638: MENU and LOCK buttons sit in one sideways-sliding row; a swipe is not a tap', ()=>{
  assert.match(js, /#aimenu \.aimrow\{display:flex;flex-wrap:nowrap/);
  assert.match(js, /#aimenu \.aimscroll\{/);
  assert.match(js, /overflow-x:auto/);
  assert.match(js, /-webkit-overflow-scrolling:touch/);
  assert.match(js, /scroll-snap-type:x proximity/);
  assert.match(js, /#aimenu \.aimscroll::after\{content:""/);
  assert.match(js, /sc\.className = 'aimscroll'/);
  assert.match(js, /sc\.appendChild\(menuBtn\(o\)\)/);
  assert.doesNotMatch(js, /#aimenu \.aimrow\{display:flex;flex-wrap:wrap/);
  assert.match(js, /Math\.abs\(\(ev\.clientX \|\| sx\) - sx\) > 14/);
  assert.match(html, /var VER=644,/);
  assert.match(html, /job_card\.js\?v=18/);
  const v = JSON.parse(ver);
  assert.ok(v.v >= 644);
});

import { test as __t } from 'node:test';
import __a from 'node:assert/strict';
import __fs from 'node:fs';
__t('v642: sent lock is tied to the card version (rebuilt jN reopens)', () => {
  const src = __fs.readFileSync(new URL('../assets/job_card.js', import.meta.url), 'utf8');
  __a.match(src, /function optSig\(c\)/);
  __a.match(src, /return v === optSig\(ref\)/);
  __a.match(src, /markSent\(job, card\)/);
});
__t('v643: rebuilt jN clears old note/lock; already_sent is not a success', () => {
  const src = __fs.readFileSync(new URL('../assets/job_card.js', import.meta.url), 'utf8');
  __a.match(src, /card\.job === j\.job && optSig\(card\) !== optSig\(j\)/);
  __a.match(src, /m\.code === 'already_sent'\)\{ unmarkSent\(job\)/);
});
__t('v644: send_receipt: tick only on the box receipt; 20 s timeout offers Resend with the same event_id', async () => {
  const src = __fs.readFileSync(new URL('../assets/job_card.js', import.meta.url), 'utf8');
  const html = __fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ver = JSON.parse(__fs.readFileSync(new URL('../data/version.json', import.meta.url), 'utf8'));
  const pj = __fs.readFileSync(new URL('../assets/projector.js', import.meta.url), 'utf8');
  __a.match(html, /var VER=644,/); __a.match(html, /job_card\.js\?v=18/); __a.match(html, /projector\.js\?v=577/);
  __a.equal(ver.v, 644);
  __a.match(src, /const RECEIPT_MS = 20000;/);
  __a.match(src, /const eid = again \? again\.body\.event_id : uid\('pick-'\)/);          // resend reuses the event_id
  __a.match(src, /const body = again \? again\.body :/);
  __a.match(src, /hasn\\u2019t confirmed this send after 20 s\. Tap Resend/);
  __a.match(src, /waitingReceipt \? 'sending\\u2026'/);                                   // no tick while waiting
  __a.doesNotMatch(src, /Sent \\u2713 waiting for the receipt/);
  __a.doesNotMatch(src, /no receipt yet \\u2014 it will still be picked up/);
  __a.match(pj, /setTimeout\(r,kind==='card'\?0:8000\)/);                                 // picks go to the backup at once
  // awaitReply: stops at the limit, matches only this event id, and a seat in open_card resolved[] counts as the receipt
  const a = src.indexOf('  async function awaitReply('), b = src.indexOf('  function isLiveOpt(');
  let meta = null, polls = [], replies = [];
  const root = {thrydDrag: () => ({reply: 'https://x/r'}), thrydNtfyGet: async (u) => { polls.push(u); return {text: async () => replies.join('\n')}; }};
  const make = new Function('root', 'sleep', 'getMeta', 'let card = null; function seenResolved(eid){ const j = getMeta(); return !!(j && (j.resolved || []).some(x => x && x.event_id === eid)); }\n' + src.slice(a, b) + '; return awaitReply;');
  const aw = make(root, async () => {}, () => meta);
  const body = {event_id: 'pick-aaaaaaaaaaaaaaaa', rid: 'pick-aaaaaaaaaaaaaaaa-r'};
  __a.equal(await aw(body, 1, {}, 20000), null);
  __a.equal(polls.length, 7);                                                              // 1+1.5+2+2.5+3+4+6 = 20 s
  replies = [JSON.stringify({message: JSON.stringify({rid: 'other-r', event_id: 'other', ok: true})})];
  __a.equal(await aw(body, 1, {}, 20000), null);                                           // someone else's receipt is not ours
  replies.push(JSON.stringify({message: JSON.stringify({rid: body.rid, event_id: body.event_id, ok: true, status: 'accepted'})}));
  __a.equal((await aw(body, 1, {}, 20000)).status, 'accepted');
  replies = []; meta = {resolved: [{event_id: body.event_id}]};
  __a.equal((await aw(body, 1, {}, 20000)).status, 'seated');
});
