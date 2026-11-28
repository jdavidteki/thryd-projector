// v619 command-panel job card + menu buttons (on by default; ?cards=0 hides)
import test from 'node:test';
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
const here = new URL('..', import.meta.url);
const rd = p => readFileSync(new URL(p, here), 'utf8');
const js = rd('assets/job_card.js'), html = rd('index.html'), st = rd('assets/stage.js'), ver = rd('data/version.json'), ai = rd('assets/intent_ai.js'), pcs = rd('assets/projector.css'), alive = rd('assets/alive.css');

test('job_card.js loads by default; ?cards=0 hides the panel', ()=>{
  assert.match(html, /cards=0/);
  assert.match(html, /job_card\.js\?v=2[12]/);
  assert.match(js, /cards=0/);
  assert.match(html, /if\(!\/\(\?:\^\|\[\?&\]\)cards=0/);
  assert.match(js, /if\(\/\(\?:\^\|\[\?&\]\)cards=0/);
  assert.doesNotMatch(html, /if\(\/\(\?:\^\|\[\?&\]\)cards=1/);
  assert.match(html, /var VER=(6[4-9]\d),/);
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
  assert.deepEqual(card.menus.main.map(o => o.value), [
    'menu: Seed an agenda','menu: Draw a story','menu: Prayer jobs',
    'menu: Async jobs','menu: Show all agendas','menu: More'
  ]);
  assert.equal(card.menus.main.length, 6);
  assert.ok(!card.menus.main.some(o => /tweets|poetry|Move/i.test(o.label+o.value)));
  assert.ok(card.menus.lock.length >= 3 && card.menus.lock.length <= 5);
  const lockVals = card.menus.lock.map(o => o.value);
  ['souvenir','tweets','publish!'].forEach(v => assert.ok(lockVals.includes(v), v));
  assert.equal(card.menus.lock.find(o => o.value === 'souvenir').label, '🎁 Make the Hold');
  assert.equal(card.menus.lock.find(o => o.value === 'tweets').label, '🐦 Show lines as tweets');
  assert.equal(card.menus.lock.find(o => o.value === 'publish!').label, '📣 Publish');
  if(card.lock_open){
    assert.ok(lockVals.includes('jump ahead'));
    assert.equal(card.menus.lock.find(o => o.value === 'jump ahead').label, '⏩ Continue');
    assert.ok(!lockVals.includes('lock now'));
  } else {
    assert.ok(lockVals.includes('lock now'));
    assert.ok(!lockVals.includes('jump ahead'));
  }
});

test('after Send the panel waits for the next job, then swaps on the slow poll', ()=>{
  assert.match(js, /sent \\u2014 next job coming/);
  assert.match(js, /published card moves to the next jN/);
  assert.match(js, /still fetch when the panel is closed so the job alert/);
  assert.match(js, /if\(document\.hidden\) return Promise.resolve\(\)/);
  assert.match(js, /POLL_MS = 30000/);
});

test('one Send per job client-side; menu taps deduped for 2 minutes before POST', ()=>{
  assert.match(js, /wasSent\(card\.job\)/);
  assert.match(js, /'sent \\u2713' : \(resendFor\(c\) \? '#thryd again' : '#thryd'\)/);   // v649: the Send button is #thryd   // v644: Resend after a receipt timeout
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

test('v623: 🎥 is a Live view pill (own menu_action per job)', ()=>{
  assert.match(js, /function isLiveOpt/);
  assert.match(js, /c\.menus\.live/);
  const card = JSON.parse(rd('data/open_card.json'));
  if(card.open){
    assert.equal(card.menus.live[0].value, 'live_view: ' + card.job);
    assert.match(card.menus.live[0].label, /Live/);
  }
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
  assert.match(html, /job_card\.js\?v=2[12]/);
  assert.match(html, /intent_ai\.js\?v=614/);
  const src = js.slice(js.indexOf('function stripTweetUrls(s){') >= 0 ? js.indexOf('function stripTweetUrls(s){') : js.indexOf('function safeText(o){'), js.indexOf('function render(){'));
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
  assert.match(js, /(jobEl|body)\.appendChild\(seatStrip\(\)\)/);
  assert.match(js, /if\(metaChanged\) updateStrip\(\)/);
  assert.match(js, /pick waiting to be seated/);
  assert.match(js, /\\ud83d\\udd12 Locked \\u00b7 /);
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
  assert.match(js, /' sent' \+ \(tm \? ' \\u00b7 ' \+ tm : ''\)/);
  assert.match(js, /head \+ ' \\u00b7 waiting'/);   // v645: pillState
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
  const src = js.slice(js.indexOf('function stripTweetUrls(s){') >= 0 ? js.indexOf('function stripTweetUrls(s){') : js.indexOf('function safeText(o){'), js.indexOf('function render(){'));
  const f = new Function(src + '; return {safeRows};')();
  const s = f.safeRows('330. intense flirting: 1. #juniorboys - like me? / 2. - instead of fighting [[stronga]] / 3. «- the picked line» 2024');
  assert.equal(s.title, '330. intense flirting \u00b7 2024');
  assert.deepEqual(s.rows, ['1. #juniorboys - like me?', '2. - instead of fighting [[stronga]]', '3. \u00ab- the picked line\u00bb']);
});

test('v634: open async jobs render as persistent waiting-on-real-life pills; empty list shows nothing', ()=>{
  assert.match(html, /var VER=(6[4-9]\d),/);
  assert.match(html, /job_card\.js\?v=2[12]/);
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
  const pillSrc = js.slice(js.indexOf('function asyncPills('), js.indexOf('function armSeedTypeline(') >= 0 ? js.indexOf('function armSeedTypeline(') : js.indexOf('function seatStrip(){'));
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

test('v653: MENU and LOCK stay one nowrap row (v654: 40px targets, sideways scroll if needed)', ()=>{
  assert.match(js, /#aimenu \.aimrow\{display:flex;flex-wrap:nowrap/);
  assert.match(js, /#aimenu \.aimscroll\{/);
  assert.match(js, /#aimenu \.aimscroll\{[^}]*flex-wrap:nowrap/);
  assert.match(js, /max-height:44px/);
  assert.match(js, /#aimenu \.aimscroll\{[^}]*overflow-x:auto/);
  assert.match(js, /#aimenu button\{[^}]*min-height:40px/);
  assert.match(js, /sc\.className = 'aimscroll'/);
  assert.match(js, /sc\.appendChild\(menuBtn\(o\)\)/);
  assert.match(js, /Math\.abs\(\(ev\.clientX \|\| sx\) - sx\) > 14/);
  assert.match(html, /var VER=(6[4-9]\d),/);
  assert.match(html, /job_card\.js\?v=2[12]/);
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
  __a.match(html, /var VER=(6[4-9]\d),/); __a.match(html, /job_card\.js\?v=2[12]/); __a.match(html, /projector\.js\?v=578/);
  __a.ok(ver.v >= 645);
  __a.match(src, /const RECEIPT_MS = 20000;/);
  __a.match(src, /const eid = again \? again\.body\.event_id : uid\('pick-'\)/);          // resend reuses the event_id
  __a.match(src, /const body = again \? again\.body :/);
  __a.match(src, /hasn\\u2019t confirmed this send after 20 s\. Tap #thryd again/);
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
__t('v645: pills read the box answer, say when unconfirmed, and a ✕ cancels by event_id without double picks', async () => {
  const src = __fs.readFileSync(new URL('../assets/job_card.js', import.meta.url), 'utf8');
  const html = __fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const pj = __fs.readFileSync(new URL('../assets/projector.js', import.meta.url), 'utf8');
  const ver = JSON.parse(__fs.readFileSync(new URL('../data/version.json', import.meta.url), 'utf8'));
  __a.ok(ver.v >= 645); __a.match(html, /var VER=(6[4-9]\d),/); __a.match(html, /job_card\.js\?v=2[12]/); __a.match(html, /projector\.js\?v=578/);
  __a.match(html, /thryd-update-ready/); __a.match(html, /window\.thrydReloadNow=/);
  __a.match(src, /update ready \(v/);
  __a.match(pj, /accept\(r, dest\.name, dest\.ep\)/);                       // reply topic follows the topic that carried it
  const a = src.indexOf('  function pillWhat('), b = src.indexOf('  let pillT = 0;');
  const mk = new Function('RECEIPT_MS', 'NOTE_MS', 'QUIET_MS', 'hhmm', src.slice(a, b) + '; return {pillState, pillWhat};');
  const {pillState} = mk(20000, 15000, 180000, () => '1:51 PM');
  const now = 1_000_000_000_000;
  const jump = {kind: 'menu', label: '⏩ Jump ahead', action: 'jump ahead', event_id: 'menu-b2fb10f1', sent_at: now - 5000};
  __a.deepEqual(pillState(jump, {}, now), {text: '⏩ Jump ahead sent · 1:51 PM · waiting', cls: '', x: true});
  __a.equal(pillState(Object.assign({}, jump, {sent_at: now - 30000}), {}, now).text, '⏩ Jump ahead sent · 1:51 PM · box hasn’t confirmed');
  __a.equal(pillState(Object.assign({}, jump, {sent_at: now - 30000, receipt_at: now - 25000}), {}, now).text, '⏩ Jump ahead sent · 1:51 PM · received · waiting');
  __a.equal(pillState(Object.assign({}, jump, {sent_at: now - 200000, receipt_at: now - 190000}), {}, now).text, '⏩ Jump ahead sent · 1:51 PM · received, no answer yet');
  const j = {resolved: [{event_id: 'menu-b2fb10f1', status: 'declined', note: 'Jump ahead: not at a lock yet (257/270)'}]};
  __a.equal(pillState(Object.assign({}, jump, {done_at: now}), j, now).text, '⏩ Jump ahead · Jump ahead: not at a lock yet (257/270)');
  __a.equal(pillState(Object.assign({}, jump, {done_at: now}), j, now).x, false);
  const pend = {pending: {menu: [{event_id: 'menu-b2fb10f1', label: '⏩ Jump ahead', note: 'with the Chief of Staff'}]}};
  __a.equal(pillState(jump, pend, now).text, '⏩ Jump ahead sent · 1:51 PM · with the Chief of Staff');
  __a.equal(pillState(Object.assign({}, jump, {cancel: 'sending', cancel_at: now - 1000}), {}, now).x, false);
  __a.equal(pillState(Object.assign({}, jump, {cancel: 'unconfirmed'}), {}, now).text, '⏩ Jump ahead · cancel not confirmed · tap ✕ to retry');
  __a.equal(pillState(Object.assign({}, jump, {cancel: 'cancelled', done_at: now}), {}, now).text, '✕ ⏩ Jump ahead cancelled');
  const pick = {kind: 'pick', job: 'j68', event_id: 'pick-1', sent_at: now - 1000, cancel: 'too_late', note: 'already seated — can’t cancel', done_at: now};
  __a.equal(pillState(pick, {}, now).text, 'j68 pick · already seated — can’t cancel');
  // ✕: same cancel id on retry, the lock lifts (card can be picked again), too_late re-locks, state persists in localStorage
  __a.match(src, /const cid = e\.cancel_id \|\| uid\('cancel-'\)/);
  __a.match(src, /type:'cancel', event_id:cid, rid:cid \+ '-r', target:e\.event_id/);
  __a.match(src, /function liftLock\(e\)\{\n\s+if\(e\.kind === 'pick'\)\{\n\s+unmarkSent\(e\.job\);/);
  __a.match(src, /m\.status === 'too_late'\)\{ out = patchSent\(eid, \{cancel: 'too_late'.*relock\(e\)/);
  __a.match(src, /localStorage\.setItem\(SENT_LOG/);
  __a.match(src, /kind: 'typed'/); __a.match(src, /cancelTyped/);
  __a.match(src, /adoptX\(\{kind: 'menu'/);                                   // taps from another tab get a ✕ too
  __a.match(src, /type a name \\u00b7 e\.g\. cheat \\u2192 mean/);            // agenda list takes a typed name  // Seed / Draw / minutes never open over an open job card (Jesuye 2:12 PM)
  const g0 = src.indexOf('  const SEED_RE ='), g1 = src.indexOf('  function sendMenu(');
  const G = new Function('isLocked', 'meta', src.slice(g0, g1) + '; return {SEED_RE, seedGate, seedNote};')(m => !!(m && m.lock_open), null);
  __a.ok(G.SEED_RE.test('menu: Seed an agenda') && G.SEED_RE.test('minutes: 120') && G.SEED_RE.test('menu: Draw a story'));
  __a.ok(!G.SEED_RE.test('menu: Show all agendas'));
  __a.equal(G.seedGate({open: true, job: 'j69', options: [{}]}), true);
  __a.equal(G.seedGate({open: true, job: 'j69', options: [{}], lock_open: true}), false);
  __a.equal(G.seedNote({job: 'j69'}), 'j69 is open — finish or lock this agenda first');
  __a.match(src, /sheet\.kind === 'minutes' && seedGate\(c\)/);
});

test('v652 Prayer jobs shows about 5 cards; Show all agendas box has an x and Escape closes it', ()=>{
  assert.match(js, /const PRAYER_PAGE = 5/);
  assert.match(js, /function fillPrayerCards\(/);
  assert.match(js, /function closeSheet\(/);
  assert.match(js, /function sheetCloseBtn\(/);
  assert.match(js, /className = 'shx'/);
  assert.match(js, /aria-label', 'Close'/);
  assert.match(js, /textContent = '\\u00d7'/);
  assert.match(js, /#aisheet \.shx\{/);
  assert.match(js, /width:40px;height:40px;min-width:40px;min-height:40px/);
  assert.match(js, /isSheetClosed\(sheet\)/);
  assert.match(js, /s\.kind === 'prayers'/);
  assert.match(js, /cards\.slice\(lo, lo \+ PRAYER_PAGE\)/);
  assert.match(js, /if\(document\.getElementById\('aisheet'\)\)/);
  assert.match(js, /closeSheet\(\); return;/);
  assert.match(html, /job_card\.js\?v=2[12]/);
  const v = JSON.parse(ver);
  assert.ok(v.v >= 652);
});


test('v653/v654 menu and lock stay one line; lock banner is short', ()=>{
  assert.match(js, /max-height:44px/);
  assert.match(js, /#aimenu \.aimscroll\{[^}]*flex-wrap:nowrap/);
  assert.match(js, /\\ud83d\\udd12 Locked \\u00b7 /);
  assert.doesNotMatch(js, /Pick from the lock row below/);
  assert.match(html, /var VER=(6[5-9]\d|65\d),/);
  const v = JSON.parse(ver);
  assert.ok(v.v >= 654);
});

test('v654 sheet options are inline pills; menu slider auto-hides; panel stays tighter', ()=>{
  assert.match(js, /#aisheet \.opts\{display:flex;flex-wrap:wrap/);
  assert.match(js, /#aisheet button\{[^}]*border-radius:999px/);
  assert.doesNotMatch(js, /#aisheet \.opts\{display:flex;flex-direction:column/);
  assert.match(js, /function armScrollHide/);
  assert.match(js, /aimhidebar/);
  assert.match(js, /setTimeout\(.*aimhidebar.*, 3000\)/);
  assert.match(js, /armScrollHide\(sc\)/);
  assert.match(js, /aicpills/);
  assert.match(js, /#aibox\.cards-on:has\(#aisheet \.pcards\)/);
  assert.match(html, /var VER=(6[5-9]\d|65\d),/);
  const v = JSON.parse(ver);
  assert.ok(v.v >= 654);
  assert.doesNotMatch(js, /Pick from the lock row below/);
  assert.match(js, /seed_pending/);
  assert.match(js, /seed\.label/);
  assert.match(js, /#aisheet \.shx\{[^}]*min-height:40px/);
  assert.match(js, /#aisheet button\{[^}]*min-height:40px/);
});

test('v655 typeline stays up for the Medium link, focused, with a paste placeholder', ()=>{
  assert.match(js, /paste the Medium link/);
  assert.match(js, /function armSeedTypeline/);
  assert.match(js, /#aibox\.cards-on:has\(\.aicseed\) > form\.airow,#aibox\.cards-on\.seed-wait > form\.airow\{display:flex!important\}/);
  assert.doesNotMatch(js, /#aibox\.cards-on:has\(\.aicseed\) > form\.airow,#aibox\.cards-on:has\(\.aiclock\) > form\.airow\{display:none\}/);
  assert.match(html, /var VER=(6[5-9]\d),/);
  const v = JSON.parse(ver);
  assert.ok(v.v >= 655);
});

test('v656 typeline + #thryd stay docked above the menu; only the options list scrolls', ()=>{
  assert.match(js, /aicdock/);
  assert.match(js, /aicbody/);
  assert.match(js, /#aicard\{[^}]*overflow:hidden/);
  assert.match(js, /#aicard \.aicbody\{[^}]*overflow:auto/);
  assert.match(js, /#aicard \.aicdock\{[^}]*flex:0 0 auto/);
  assert.match(js, /padding-bottom:8px/);
  assert.match(js, /visualViewport/);
  assert.match(js, /function liftForKeyboard/);
  assert.match(js, /function armKeyboardLift/);
  assert.match(js, /dock\.appendChild\(t\)/);
  assert.match(js, /jobEl\.appendChild\(dock\)/);
  assert.match(html, /var VER=(6[5-9]\d),/);
  const v2 = JSON.parse(ver);
  assert.ok(v2.v >= 656);
});

test('v656 next job card shows in the existing alert and stays there, not tappable', ()=>{
  assert.match(js, /function isJobCard/);
  assert.match(js, /function jobAlertTitle/);
  assert.match(js, /function noteJobAlert/);
  assert.match(js, /function jobAlertEl/);
  assert.match(js, /aicwait aicalert/);
  assert.match(js, /id = 'aicalert'/);
  assert.match(js, /if\(j\.kind && j\.kind !== 'job'\) return false/);
  assert.match(js, /jobAlert && jobAlert\.job === j\.job/);
  assert.match(js, /pointer-events:none/);
  // not a tappable control: the alert is a div status, never a button, never tapOnce
  const alertSrc = js.slice(js.indexOf('function jobAlertEl('), js.indexOf('function seatStrip()'));
  assert.match(alertSrc, /createElement\('div'\)/);
  assert.doesNotMatch(alertSrc, /createElement\('button'\)/);
  assert.doesNotMatch(alertSrc, /tapOnce/);
  assert.match(js, /aicmdalert/);
  assert.doesNotMatch(js, /thrydCtx\(\)\.toast/);
});

test('v657 typeline and #thryd share one 40px row; alert is a slim 24px line; short landscape grows the panel', ()=>{
  assert.match(js, /#aicard \.aicdock\{[^}]*flex-direction:row/);
  assert.match(js, /#aicard \.aicfree\{[^}]*height:40px/);
  assert.match(js, /#aicard \.aicgo\{[^}]*height:40px/);
  assert.match(js, /#aicard \.aicwait\.aicalert\{[^}]*height:24px/);
  assert.match(js, /@media \(max-height:600px\)\{[^}]*height:calc\(100dvh - 52px\)/);
  assert.match(js, /#aimenu\{flex-direction:row;flex-wrap:nowrap/);
  assert.match(js, /min-height:45%/);
  assert.match(js, /bottom:44px/);
  assert.match(html, /var VER=(6[5-9]\d),/);
  const v = JSON.parse(ver);
  assert.ok(v.v >= 657);
});

test('v658 typelines use self-hosted JetBrains Mono at 15px; 40px dock height is kept', ()=>{
  assert.match(pcs, /@font-face\{font-family:'JetBrains Mono'/);
  assert.match(pcs, /fonts\/JetBrainsMono-Regular\.woff2/);
  assert.match(pcs, /fonts\/JetBrainsMono-SemiBold\.woff2/);
  assert.match(pcs, /font-display:swap/);
  assert.match(js, /#aicard \.aicfree\{[^}]*JetBrains Mono/);
  assert.match(js, /#aicard \.aicfree\{[^}]*15px/);
  assert.match(js, /#aicard \.aicfree\{[^}]*letter-spacing:\.03em/);
  assert.match(js, /#aicard \.aicfree\{[^}]*height:40px/);
  assert.match(js, /#aicard \.aicgo\{[^}]*height:40px/);
  assert.match(js, /#aicard \.aicfree::placeholder/);
  assert.match(js, /#aibox\.cards-on textarea\{[^}]*JetBrains Mono/);
  assert.match(ai, /#aibox input,#aibox textarea\{[^}]*JetBrains Mono/);
  assert.match(ai, /#aibox input::placeholder,#aibox textarea::placeholder/);
  assert.match(alive, /#code\{[^}]*JetBrains Mono/);
  assert.doesNotMatch(js, /#aicard \.aicfree\{[^}]*ThrydRead/);
  // story / card body stays on ThrydRead
  assert.match(js, /#aicard \.aicprompt\{[^}]*ThrydRead/);
  assert.match(html, /var VER=(658|659),/);
  const v2 = JSON.parse(ver);
  assert.ok(v2.v >= 658);
});

test('v659 tweet option descriptions never render x.com or twitter.com URLs; 🎥 live view stays', ()=>{
  assert.match(js, /function stripTweetUrls\(s\)\{/);
  assert.match(html, /job_card\.js\?v=22/);
  assert.match(html, /var VER=659,/);
  const v = JSON.parse(ver);
  assert.equal(v.v, 659);
  const src = js.slice(js.indexOf('function stripTweetUrls(s){'), js.indexOf('function render(){'));
  const f = new Function(src + '; return {stripTweetUrls, safeText, safeRows};')();
  const raw = 'tweet, 2026-02-23, x.com/i/status/2026052053957566676: 1. «- tell am say make him come back» / 2. next line';
  const out = f.stripTweetUrls(raw);
  assert.equal(out.includes('x.com'), false);
  assert.equal(out.includes('twitter.com'), false);
  assert.equal(out.includes('status/'), false);
  assert.match(out, /tell am say make him come back/);
  const shown = f.safeText({label: 'tell.say(make) 🪙', value: 'j1: - tell am say make him come back', safe: raw});
  assert.equal(shown.includes('x.com'), false);
  assert.match(shown, /tell am say make him come back/);
  const live = f.safeText({label: '🎥', value: 'j3: 🎥', safe: 'a live view of the scene so far'});
  assert.equal(live, 'a live view of the scene so far');
  // _source is never read for display
  const withSrc = f.safeText({label: 't', value: 'j3: line', safe: '1. «line» / 2. two / 3. three / 4. four', _source: {kind:'tweet', id:'123'}});
  assert.equal(withSrc.includes('123'), false);
  assert.match(withSrc, /«line»/);
});

test('v657 🎥 option publishes its description and is rendered like the other options', ()=>{
  assert.doesNotMatch(js, /filter\(o => !isLiveOpt\(o\)\)/);
  assert.match(js, /\(c\.options \|\| \[\]\)\.forEach\(o => \{/);
  const card = JSON.parse(rd('data/open_card.json'));
  if(card.open){
    const live = card.options.find(o => o.label && /\u{1f3a5}/u.test(o.label.trim()));
    assert.ok(live, 'open_card.json has a 🎥 option');
    assert.equal(typeof live.safe, 'string');
    assert.match(live.safe, /live view of the scene so far/i);
  }
});

