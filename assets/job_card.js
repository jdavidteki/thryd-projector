/* Command-panel job card + menu buttons (on by default, 2026-11-26).
   When the customer opens ›_ / the typed-command box, the open job card sits
   above the existing input and the menu options sit below it as plain buttons.
   Loaded on the bare URL, ?mode=live and any ?v=. Hide with ?cards=0 (no fetch, no timer, no DOM).
   One slow poll (>=30s) only while the panel is open; paused when the tab is hidden.
   Posts go through window.thrydNtfyPost (existing intake). Never seats or runs a menu action. */
(function(root){
  'use strict';
  if(/(?:^|[?&])cards=0(?:&|$)/.test(String(location.search||''))) return;

  // v621 look (Jesuye 26 Nov 12:13 PM "make it look nice"): dark glass panel, compact drag header,
  // Literata (self-hosted 18 KB Latin subset) for the story text, full archive safe under each option,
  // capped height with the card body scrolling inside so the [[god]] header always stays grabbable.
  const CSS = [
    "@font-face{font-family:'ThrydRead';src:url('assets/fonts/literata-420.woff2') format('woff2');font-weight:300 700;font-style:normal;font-display:swap}",
    '#aibox.cards-on{width:min(94vw,660px);max-height:min(74vh,700px);max-height:min(74dvh,700px);overflow:hidden;bottom:9vh;padding:0;gap:0;border-radius:14px;background:rgba(16,15,13,.86);-webkit-backdrop-filter:blur(10px) saturate(1.1);backdrop-filter:blur(10px) saturate(1.1);border:1px solid rgba(255,215,106,.22);box-shadow:0 10px 34px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.05)}',
    '#aibox.cards-on #aihead{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:7px 12px 6px;font:700 12px/1.2 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.06em;color:#ffd76a;background:rgba(255,215,106,.06);border-bottom:1px solid rgba(255,255,255,.07)}',
    "#aibox.cards-on #aihead::after{content:'';flex:1 1 auto;height:4px;margin-left:6px;background:radial-gradient(circle,rgba(255,255,255,.28) 1.2px,transparent 1.6px) 0 0/7px 4px repeat-x;opacity:.8}",
    '#aibox.cards-on > form.airow{flex:0 0 auto;padding:8px 12px 0}',
    '#aibox.cards-on > .aim{flex:0 0 auto;padding:3px 12px 0;font:400 11px/1.3 ui-sans-serif,system-ui,sans-serif;color:#8f897c}',
    '#aibox.cards-on > .aic{flex:0 0 auto;padding:0 12px}',
    '#aibox.cards-on textarea{font-size:13px}',
    '#aibox.cards-on textarea::placeholder{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#7d786c}',
    '#aibox.cards-on > .aic:empty{display:none}',
    '#aicard{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;gap:9px;padding:11px 12px 10px;border-bottom:1px solid rgba(255,255,255,.07)}',
    '#aicard::-webkit-scrollbar{width:6px}#aicard::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:3px}',
    '#aicard .aictitle{font:700 13px/1.35 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#ffe3a0;letter-spacing:.01em}',
    '#aicard .aicprompt{display:flex;flex-direction:column;gap:7px;color:#ece6d8;font:400 15px/1.6 ThrydRead,Georgia,"Times New Roman",serif;font-weight:420;letter-spacing:.003em}',
    '#aicard .aicprompt p{margin:0}',
    '#aicard .aicprompt .lead{font:600 10.5px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:#c9a95a;margin-right:6px;vertical-align:1px}',
    '#aicard .aicprompt p.now{padding:8px 10px;border-left:2px solid #ffd76a;background:rgba(255,215,106,.07);border-radius:0 8px 8px 0;color:#fff6df}',
    '#aicard .aicprompt p.tap{font:italic 400 12.5px/1.45 ThrydRead,Georgia,serif;color:#a59f91}',
    '#aicard .aichelt{color:#8a8476;font:400 11px/1.45 ui-sans-serif,system-ui,sans-serif;padding-top:2px;border-top:1px dashed rgba(255,255,255,.08)}',
    '#aicard .aicopts{display:flex;flex-direction:column;gap:6px}',
    '#aicard .aicopt{display:flex;flex-direction:column;align-items:flex-start;gap:3px;width:100%;box-sizing:border-box;text-align:left;color:#fff;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.13);border-radius:10px;padding:8px 11px 8px 34px;cursor:pointer;min-height:40px;position:relative;transition:background .12s,border-color .12s;-webkit-tap-highlight-color:transparent}',
    "#aicard .aicopt::before{content:'';position:absolute;left:11px;top:11px;width:13px;height:13px;border-radius:4px;border:1.5px solid rgba(255,255,255,.35);box-sizing:border-box}",
    '#aicard .aicopt .ol{font:600 13px/1.3 ui-monospace,Menlo,Consolas,monospace;color:#f3efe6}',
    // v633: title on its own line; numbered tweet lines flow as one wrapped paragraph
    // (verbatim, middot between them, «picked» gold); ~68% type, tight leading, so most of a safe
    // shows without scrolling; the box still scrolls a very long safe, picked line only inside it
    '#aicard .aicopt .ot{font:400 8.5px/1.25 ui-monospace,Menlo,Consolas,monospace;font-style:normal;color:#e8e0d0;display:block;width:100%;box-sizing:border-box;max-height:15em;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;cursor:text;padding:4px 6px;margin-top:2px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.08);border-radius:8px;white-space:normal;word-break:break-word;scrollbar-width:thin;scrollbar-color:rgba(255,215,106,.45) transparent}',
    '#aicard .aicopt .ot::-webkit-scrollbar{width:4px}#aicard .aicopt .ot::-webkit-scrollbar-thumb{background:rgba(255,215,106,.45);border-radius:2px}',
    '#aicard .aicopt .ot .ott{color:#c9a95a;font:600 8.5px/1.3 ui-monospace,Menlo,Consolas,monospace;margin:0 0 2px;display:block}',
    '#aicard .aicopt .ot .otb{display:block}',
    '#aicard .aicopt .ot .otl{display:inline;white-space:pre-wrap}',
    '#aicard .aicopt .ot .ots{color:rgba(232,224,208,.4);font-weight:400}',
    '#aicard .aicopt .ot .otl.pick{color:#ffd76a;font-weight:600;background:rgba(255,215,106,.16);border-radius:2px}',
    '#aicard .aicopt.on{border-color:#ffd76a;background:rgba(255,215,106,.13)}',
    "#aicard .aicopt.on::before{background:#ffd76a;border-color:#ffd76a;box-shadow:inset 0 0 0 2.5px #2a2416}",
    '#aicard .aicopt:disabled,#aicard .aicopt[aria-disabled="true"],#aimenu button:disabled{opacity:.5;cursor:default}',
    '#aicard .aicfree{width:100%;box-sizing:border-box;font:400 14px/1.4 ThrydRead,Georgia,serif;color:#fff;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.16);border-radius:10px;padding:8px 11px;min-height:38px;outline:none}',
    '#aicard .aicfree:focus{border-color:#ffd76a}',
    '#aicard .aicsend{display:flex;align-items:center;gap:10px;justify-content:flex-end}',
    '#aicard .aicnote{flex:1 1 auto;min-height:1em;font:500 12.5px/1.35 ui-sans-serif,system-ui,sans-serif;color:#b8b2a4}',
    '#aicard .aicnote.busy{color:#ffd76a}#aicard .aicnote.ok{color:#7fe0a0}#aicard .aicnote.err{color:#ff8f86;font-weight:600}',
    '#aicard .aicgo{flex:0 0 auto;min-width:96px;min-height:38px;padding:0 16px;font:700 14px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.02em;color:#1a1608;background:linear-gradient(#ffe08a,#f5c84c);border:1px solid #c9a227;border-radius:10px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.35)}',
    '#aicard .aicgo.sent{background:#1f5a34;border-color:#2f8a50;color:#e6ffee}',
    '#aicard .aicgo.err{background:#5a1f1f;border-color:#a04040;color:#ffe3e0}',
    '#aicard .aicgo.busy{opacity:.75}',
    '#aicard .aicempty{font:italic 400 14px/1.5 ThrydRead,Georgia,serif;color:#a59f91}',
    '#aimenu{flex:0 0 auto;display:flex;flex-direction:column;gap:6px;padding:8px 12px 10px;margin:0}',
    '#aimenu .aimrow{display:flex;flex-wrap:nowrap;align-items:center;gap:6px;min-width:0}',
    '#aimenu .aimscroll{flex:1 1 auto;min-width:0;display:flex;flex-wrap:nowrap;align-items:center;gap:6px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;touch-action:pan-x;scroll-snap-type:x proximity;scrollbar-width:thin;scrollbar-color:rgba(255,215,106,.45) transparent}',
    '#aimenu .aimscroll::-webkit-scrollbar{height:3px}#aimenu .aimscroll::-webkit-scrollbar-thumb{background:rgba(255,215,106,.45);border-radius:2px}',
    '#aimenu .aimscroll::after{content:"";flex:0 0 18px;width:18px;height:30px;margin-left:-18px;position:sticky;right:0;background:linear-gradient(to right,transparent,rgba(16,15,13,.92));pointer-events:none;z-index:1}',
    '#aimenu button{font:600 12px/1.2 ui-sans-serif,system-ui,sans-serif;color:#efe9dc;background:rgba(255,255,255,.06);border:1px solid rgba(201,169,90,.45);border-radius:999px;padding:5px 11px;cursor:pointer;min-height:30px;flex:0 0 auto;white-space:nowrap;scroll-snap-align:start}',
    '#aimenu button.live{border-color:rgba(255,120,120,.55);background:rgba(255,90,90,.1)}',
    '#aimenu button.sent{border-color:#2f8a50;background:rgba(47,138,80,.22);color:#d8ffe5}',
    '#aimenu button.err{border-color:#a04040;background:rgba(160,64,64,.25)}',
    '#aimenu .aimlab{color:#8f897c;font:600 10px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;font-variant:small-caps;min-width:40px;flex:0 0 auto}',
    '#aimenu .aimnote{font:500 11.5px/1.3 ui-sans-serif,system-ui,sans-serif;color:#b8b2a4;min-height:1.3em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#aimenu .aimnote.ok{color:#7fe0a0}#aimenu .aimnote.err{color:#ff8f86}#aimenu .aimnote.busy{color:#ffd76a}',
    // v629 seat line + lock progress + waiting state + lock banner (Jesuye 2:05 PM "make it happen")
    '#aicard .aicseat{display:flex;flex-direction:column;gap:5px;padding:7px 9px 8px;border-radius:10px;background:rgba(127,224,160,.06);border:1px solid rgba(127,224,160,.18)}',
    '#aicard .aicseat .sh{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;font:600 11.5px/1.3 ui-sans-serif,system-ui,sans-serif;color:#a8e8bf;letter-spacing:.02em}',
    '#aicard .aicseat .sh b{color:#d8ffe5;font-weight:700}',
    '#aicard .aicseat .sl{font:400 12px/1.45 ui-monospace,Menlo,Consolas,monospace;color:#e8e0d0;white-space:pre-wrap;word-break:break-word;padding:4px 7px;background:rgba(0,0,0,.28);border-radius:6px;max-height:6.6em;overflow-y:auto;overscroll-behavior:contain}',
    '#aicard .aicseat .sl div{display:block}',
    '#aicard .aicprog{display:flex;align-items:center;gap:8px;font:600 11px/1.2 ui-monospace,Menlo,Consolas,monospace;color:#d9cfb6}',
    '#aicard .aicprog .bar{flex:1 1 auto;min-width:60px;height:5px;border-radius:3px;background:rgba(255,255,255,.1);overflow:hidden}',
    '#aicard .aicprog .bar i{display:block;height:100%;background:linear-gradient(90deg,#c9a95a,#ffd76a);border-radius:3px}',
    '#aicard .aicprog .nx{color:#8f897c;font-weight:500}',
    '#aicard .aicwait{display:flex;align-items:center;gap:7px;font:600 11.5px/1.3 ui-sans-serif,system-ui,sans-serif;color:#ffd76a;padding:5px 9px;border-radius:999px;background:rgba(255,215,106,.08);border:1px dashed rgba(255,215,106,.4);align-self:flex-start}',
    '#aicard .aicwait .dot{width:7px;height:7px;border-radius:50%;background:#ffd76a;opacity:.85}',
    '#aicard .aicwait.aicsent.done{color:#8fe3a1;background:rgba(143,227,161,.08);border:1px solid rgba(143,227,161,.45)}',
    '#aicard .aicwait.aicsent.done .dot{background:#8fe3a1}',
    '#aicard .aicwait.aicasync{cursor:pointer;flex-wrap:wrap;max-width:100%;white-space:normal;border-radius:12px}',
    '#aicard .aicwait.aicasync .ax{display:none;width:100%;font:400 11.5px/1.4 ui-sans-serif,system-ui,sans-serif;color:#e8e0d0;padding:4px 0 1px 0;font-weight:500}',
    '#aicard .aicwait.aicasync.open .ax{display:block}',
    '#aicard .aiclock{padding:10px 12px;border-radius:10px;border:1px solid #ffd76a;background:rgba(255,215,106,.12);color:#fff3cf;font:400 14px/1.5 ThrydRead,Georgia,serif}',
    '#aicard .aiclock b{display:block;font:700 13px/1.3 ui-sans-serif,system-ui,sans-serif;color:#ffd76a;letter-spacing:.03em;margin-bottom:3px}',
    '#aimenu .aimrow.hot{padding:5px 6px;margin:0 -6px;border-radius:10px;background:rgba(255,215,106,.1);box-shadow:inset 0 0 0 1px rgba(255,215,106,.55)}',
    '#aimenu .aimrow.hot .aimlab{color:#ffd76a}',
    '#aimenu .aimrow.hot button{border-color:#ffd76a;color:#fff3cf}',
    '#aisheet{margin:6px 0 0;padding:8px 10px;border:1px solid rgba(201,169,90,.35);border-radius:12px;background:rgba(0,0,0,.28)}',
    '#aisheet .sh{font:650 13px/1.3 ui-sans-serif,system-ui,sans-serif;color:#efe9dc;margin:0 0 4px}',
    '#aisheet .ht{font:500 11.5px/1.35 ui-sans-serif,system-ui,sans-serif;color:#b8b2a4;margin:0 0 8px;white-space:pre-wrap}',
    '#aisheet .bd{font:500 12px/1.4 ui-sans-serif,system-ui,sans-serif;color:#efe9dc;white-space:pre-wrap;max-height:12em;overflow:auto;margin:0 0 8px}',
    '#aisheet .opts{display:flex;flex-direction:column;gap:4px;max-height:16em;overflow:auto}',
    '#aisheet button{font:600 12px/1.3 ui-sans-serif,system-ui,sans-serif;text-align:left;color:#efe9dc;background:rgba(255,255,255,.06);border:1px solid rgba(201,169,90,.4);border-radius:10px;padding:6px 10px;cursor:pointer}',
    '#aisheet button.sent{border-color:#2f8a50;background:rgba(47,138,80,.22)}',
    '@media (max-width:520px){#aibox.cards-on{width:96vw;bottom:6vh}#aicard .aicprompt{font-size:14.5px}}',
    '@media (max-height:600px){#aibox.cards-on{max-height:84vh;max-height:84dvh;bottom:6vh}#aibox.cards-on > .aim{display:none}#aibox.cards-on > form.airow{padding-top:7px}#aibox.cards-on textarea{min-height:32px}#aicard{gap:7px;padding:9px 12px 8px}#aicard .aicprompt{font-size:14px;line-height:1.55}}'
  ].join('\n');
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  const STORE = 'thryd_card_sent';
  const POLL_MS = 30000;
  let card = null, cardSig = '', pollId = 0, userClose = false, sending = false;
  let meta = null; // v629: newest fetched payload (seat line / pending / lock), even while a sent card is kept
  // Selection lives in JS, not only in the DOM, so a poll / re-render never wipes a pick (v621).
  let sel = {job: null, values: new Set(), text: ''};
  let status = {job: null, text: '', kind: ''};
  let asyncOpen = new Set(); // v634: which async-job pills are expanded
  // v644 send_receipt (Jesuye "yes" 11/27 1:27 PM ET; j64/j66 sends that looked sent but had not reached the box):
  // a Send shows a tick only once the box answers for that exact event_id (relay reply, or open_card resolved[]).
  // No answer in RECEIPT_MS: say so plainly and offer Resend, which re-posts the SAME body / event_id, so the box
  // dedupes it (relay event_id + card_pick find_event) and it can never become a second pick.
  const RECEIPT_MS = 20000;
  let pendingSend = null;            // {job, sig, body, r, t0, state: 'waiting'|'not_received'}
  const pendingMenu = {};            // action -> {body, r, t0} awaiting a receipt / resend
  function resendFor(c){ return (pendingSend && c && pendingSend.state === 'not_received' && pendingSend.job === c.job && pendingSend.sig === optSig(c)) ? pendingSend : null; }
  function seenResolved(eid){ const j = meta || card; return !!(j && (j.resolved || []).some(x => x && x.event_id === eid)); }

  const box = () => document.getElementById('aibox');
  const AI = () => root.thrydIntentAI;
  const log = info => { try{ root.thrydLogSend && root.thrydLogSend(Object.assign({branch: 'card'}, info)); }catch(e){} };
  function sentMap(){ try{ return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; }catch(e){ return {}; } }
  // v642: a send locks only the card version it was sent on. If the same jN is rebuilt with
  // new lines (or the send was consumed without a seat), the fresh card opens for a pick again.
  function optSig(c){ try{ return String((c && c.job) || '') + '|' + ((c && c.options) || []).map(o => o && o.value).join('\u241e'); }catch(e){ return ''; } }
  function markSent(job, c){ const m = sentMap(); m[job] = optSig(c && c.job === job ? c : card); try{ localStorage.setItem(STORE, JSON.stringify(m)); }catch(e){} }
  function unmarkSent(job){ const m = sentMap(); delete m[job]; try{ localStorage.setItem(STORE, JSON.stringify(m)); }catch(e){} }
  function wasSent(job, c){
    if(!job) return false; const v = sentMap()[job]; if(!v) return false;
    const ref = (c && c.job === job) ? c : ((card && card.job === job) ? card : null);
    if(!ref || !ref.options) return true;
    return v === optSig(ref);
  }
  const MENU_STORE = 'thryd_menu_sent';
  const MENU_DEDUPE_MS = 120000;
  function menuKey(run, action){ return String(run || '') + '::' + String(action || ''); }
  function menuRecent(run, action){
    try{
      const m = JSON.parse(localStorage.getItem(MENU_STORE) || '{}') || {};
      const t = +m[menuKey(run, action)] || 0;
      return t && (Date.now() - t) < MENU_DEDUPE_MS;
    }catch(e){ return false; }
  }
  function markMenu(run, action){
    try{
      const m = JSON.parse(localStorage.getItem(MENU_STORE) || '{}') || {};
      m[menuKey(run, action)] = Date.now();
      localStorage.setItem(MENU_STORE, JSON.stringify(m));
    }catch(e){}
  }
  function uid(prefix){
    try{ if(root.crypto && crypto.randomUUID) return prefix + crypto.randomUUID(); }catch(e){}
    return prefix + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }
  const sleep = ms => new Promise(z => setTimeout(z, ms));
  // v630 (Jesuye 2:39 PM "on page refresh, i should still know jump ahead has been sent"): every Send (card pick,
  // menu or lock tap) is kept in localStorage {run, job|action, label, event_id, sent_at} and shown as a
  // 'sent · time · waiting' pill until open_card.json shows that event as seated/done (resolved[] / no longer
  // pending) or the job has moved on; then '✓ done' for a few seconds and the entry is cleared.
  const SENT_LOG = 'thryd_sent_log_v630';
  const SENT_TTL = 6 * 3600 * 1000, DONE_MS = 5000;
  function sentLog(){ try{ const a = JSON.parse(localStorage.getItem(SENT_LOG) || '[]'); return Array.isArray(a) ? a.filter(e => e && e.event_id && Date.now() - (+e.sent_at || 0) < SENT_TTL) : []; }catch(e){ return []; } }
  function saveSentLog(a){ try{ localStorage.setItem(SENT_LOG, JSON.stringify(a.slice(-12))); }catch(e){} }
  function logSent(e){ const a = sentLog().filter(x => x.event_id !== e.event_id); a.push(Object.assign({sent_at: Date.now()}, e)); saveSentLog(a); kickLane(); }
  function jn(j){ const m = /^j(\d+)$/i.exec(String(j || '')); return m ? +m[1] : 0; }
  function atMs(iso){ const t = Date.parse(iso || ''); return isNaN(t) ? 0 : t; }
  // is a sent entry finished, judged from an open_card payload?
  function sentResolved(e, j){
    if(!e || !j) return false;
    if((j.resolved || []).some(x => x && x.event_id === e.event_id)) return true;
    const p = j.pending || {};
    const stillPending = (p.pick && p.pick.event_id === e.event_id) || (p.menu || []).some(x => x && x.event_id === e.event_id);
    if(stillPending) return false;
    if(j.run && e.run && j.run !== e.run) return true;
    if(e.kind === 'pick'){
      if(j.last_seat && j.last_seat.job === e.job) return true;
      if(j.open && jn(j.job) > jn(e.job)) return true;
      return false;
    }
    // menu / lock tap: the job moved on since it was sent
    if(e.job && j.job && jn(j.job) > jn(e.job)) return true;
    if(!e.job && j.open && j.job && atMs(j.at) > (+e.sent_at || 0) + 15000) return true;
    return false;
  }
  function settleSent(j){
    const a = sentLog(); let changed = false;
    a.forEach(e => { if(!e.done_at && sentResolved(e, j)){ e.done_at = Date.now(); changed = true; } });
    const keep = a.filter(e => !(e.done_at && Date.now() - e.done_at > DONE_MS));
    if(changed || keep.length !== a.length) saveSentLog(keep);
    if(changed) setTimeout(() => { try{ settleSent(meta || card); updateStrip(); }catch(e){} }, DONE_MS + 200);
    return changed;
  }
  function sentPills(run){
    return sentLog().filter(e => !run || !e.run || e.run === run).map(e => {
      const w = document.createElement('div'); w.className = 'aicwait aicsent' + (e.done_at ? ' done' : ''); w.setAttribute('role', 'status');
      w.dataset.eid = e.event_id;
      const d = document.createElement('span'); d.className = 'dot'; w.appendChild(d);
      const what = e.kind === 'pick' ? (e.job + ' pick') : (e.label || e.action || 'tap');
      const tm = hhmm(new Date(+e.sent_at).toISOString());
      w.appendChild(document.createTextNode(e.done_at ? ('\u2713 ' + what + ' done') : (what + ' sent' + (tm ? ' \u00b7 ' + tm : '') + ' \u00b7 waiting')));
      return w;
    });
  }
  // v630 card lane: the box publishes each changed open card to ntfy <drag topic>-c (chunked) the moment it is
  // seated, so the panel need not wait for a Pages build. Polled every 5 s only while a Send is waiting (max 6 min).
  let laneTimer = 0;
  function laneBase(){
    const DG = (root.thrydDrag && root.thrydDrag()) || root.DRAG || {};
    return DG.endpoint ? String(DG.endpoint).replace(/\/?$/, '') + '-c' : null;
  }
  async function laneFetch(){
    const base = laneBase(); if(!base) return null;
    const getter = root.thrydNtfyGet || ((u, ms) => fetch(u, {cache: 'no-store'}));
    const tx = await (await getter(base + '/json?poll=1&since=15m', 8000)).text();
    const by = {};
    for(const l of String(tx).split('\n')){
      if(!l) continue; let m, x;
      try{ m = JSON.parse(l); x = JSON.parse(m.message || '{}'); }catch(e){ continue; }
      if(!x || x.k !== 'open_card' || !x.id) continue;
      const g = by[x.id] = by[x.id] || {n: x.n, parts: {}, t: 0};
      g.parts[x.i] = x.part; g.t = Math.max(g.t, +m.time || 0);
    }
    let best = null;
    Object.keys(by).forEach(id => { const g = by[id]; if(Object.keys(g.parts).length === g.n && (!best || g.t > best.t)) best = g; });
    if(!best) return null;
    try{ let raw = ''; for(let i = 0; i < best.n; i++) raw += best.parts[i]; return JSON.parse(raw); }catch(e){ return null; }
  }
  // v632 (Jesuye 3:00 PM "pls implement!"): the lane is read ALWAYS, not only while a Send waits: one ntfy SSE
  // stream (EventSource, idle = no CPU, no polling) with since=10m, reopened when the tab comes back; if the stream
  // cannot open, a 10 s JSON poll. Whichever of lane or Pages has the newest `at` wins; chunks dedupe by card id.
  let es = null, esFails = 0, laneBuf = {}, laneSeen = '';
  function laneTake(x, t){
    if(!x || x.k !== 'open_card' || !x.id || x.id === laneSeen) return;
    const g = laneBuf[x.id] = laneBuf[x.id] || {n: x.n, parts: {}, t: 0};
    g.parts[x.i] = x.part; g.t = Math.max(g.t, +t || 0);
    if(Object.keys(g.parts).length !== g.n) return;
    let j = null; try{ let raw = ''; for(let i = 0; i < g.n; i++) raw += g.parts[i]; j = JSON.parse(raw); }catch(e){ return; }
    delete laneBuf[x.id];
    laneOffer(j, x.id);
  }
  function laneOffer(j, id){
    if(!j || typeof j !== 'object') return;
    if(id) laneSeen = id;
    if(meta && atMs(j.at) <= atMs(meta.at)) return;           // not newer than what we show
    applyCard(j, 'lane');
  }
  function laneTick(){
    laneTimer = 0;
    if(document.hidden || (es && es.readyState !== 2)) return;
    laneFetch().then(j => laneOffer(j)).catch(() => {})
      .finally(() => { if(!laneTimer && !(es && es.readyState !== 2)) laneTimer = setTimeout(laneTick, 10000); });
  }
  let laneBaseP = null;
  function laneBaseAsync(){
    const b = laneBase(); if(b) return Promise.resolve(b);
    if(!laneBaseP) laneBaseP = fetch('data/drag.json?t=' + Date.now(), {cache: 'no-store'}).then(r => r.ok ? r.json() : null)
      .then(d => (d && d.endpoint) ? String(d.endpoint).replace(/\/?$/, '') + '-c' : null).catch(() => null)
      .finally(() => { setTimeout(() => { laneBaseP = null; }, 30000); });
    return laneBaseP;
  }
  function laneOpen(){
    if(document.hidden || (es && es.readyState !== 2)) return;
    laneBaseAsync().then(base => {
      if(!base || document.hidden || (es && es.readyState !== 2)) return;
      if(typeof root.EventSource !== 'function' || esFails >= 3){ if(!laneTimer) laneTimer = setTimeout(laneTick, 500); return; }
      try{
        es = new EventSource(base + '/sse?since=10m');
        es.onopen = () => { esFails = 0; };
        es.onmessage = ev => { try{ const m = JSON.parse(ev.data); if(m && m.message) laneTake(JSON.parse(m.message), m.time); }catch(e){} };
        es.onerror = () => { if(es && es.readyState === 2){ esFails++; es = null; setTimeout(laneOpen, 5000 * esFails); } };
      }catch(e){ esFails++; es = null; if(!laneTimer) laneTimer = setTimeout(laneTick, 500); }
    });
  }
  function laneClose(){ try{ es && es.close(); }catch(e){} es = null; if(laneTimer){ clearTimeout(laneTimer); laneTimer = 0; } }
  document.addEventListener('visibilitychange', () => { if(document.hidden) laneClose(); else laneOpen(); });
  function kickLane(){ laneOpen(); if(!laneTimer) laneTimer = setTimeout(laneTick, 1500); }
  // v622 (Jesuye 12:39 PM "there is a http error", HTTP 429): card picks and menu taps no longer share the
  // busy drag/drift lane. They go through the typeline lane (own ntfy.sh topic, plus the independent backup
  // host ntfy.envs.net in parallel after 8 s), and a 429 / network failure backs off (Retry-After) and retries
  // on its own, up to 3 tries, before anything is shown as an error.
  function friendly(x){
    const t = String((x && (x.message || x.status)) || x || '');
    if(/429/.test(t)) return 'the network is busy right now';
    if(/timed? ?out|timeout/i.test(t)) return 'the network timed out';
    if(/no_endpoint|intake not loaded/i.test(t)) return 'the page is still loading \u00b7 reload it';
    if(/failed to fetch|network/i.test(t)) return 'no connection';
    return t || 'no response';
  }
  async function post(body, onRetry){
    const tl = root.thrydTypelinePost, np = root.thrydNtfyPost;
    if(!tl && !np) throw new Error('intake not loaded \u00b7 reload the page');
    let lastR = null, lastE = null;
    for(let i = 0; i < 3; i++){
      lastR = null; lastE = null;
      try{
        const r = tl ? await tl(body, 'card') : await np(body, 'call');
        if(r && r.ok) return r;
        lastR = r;
      }catch(e){ lastE = e; }
      if(i === 2) break;
      let wait = i ? 8000 : 3000;
      const ra = lastR && lastR.retryAfter; const n = parseInt(ra, 10);
      if(isFinite(n)) wait = Math.min(30000, Math.max(1000, n * 1000));
      log({event: 'post_retry', type: body.type, try: i + 1, wait, why: lastR ? ('HTTP ' + lastR.status) : String(lastE && lastE.message || lastE)});
      try{ onRetry && onRetry(i + 1, wait, lastR ? ('HTTP ' + lastR.status) : lastE); }catch(e){}
      await sleep(wait);
    }
    if(lastR) return lastR;
    throw lastE || new Error('no response');
  }
  // Wait for the validator's answer on the reply topic (same pattern as stage.js taps).
  async function awaitReply(body, t0, r, limitMs, waits){
    const DG = (root.thrydDrag && root.thrydDrag()) || root.DRAG || {};
    // the reply comes back on <the topic it was posted to>-r (relay.py); backup posts carry r.reply
    const base = (r && r.reply) || (r && r.endpoint ? String(r.endpoint).replace(/\/?$/, '') + '-r' : null) || DG.reply || (DG.endpoint ? String(DG.endpoint).replace(/\/?$/, '') + '-r' : null);
    const plan = waits || (limitMs ? [1000, 1500, 2000, 2500, 3000, 4000, 6000] : [1500, 2500, 4000, 6000, 8000, 12000]);
    let spent = 0;
    for(const w of plan){
      if(limitMs && spent >= limitMs) break;
      await sleep(w); spent += w;
      if(seenResolved(body.event_id)) return {ok: true, status: 'seated', event_id: body.event_id, via: 'open_card'};   // v644: the seat itself is a receipt
      if(!base) continue;
      try{
        const getter = root.thrydNtfyGet || ((u, ms) => fetch(u, {cache: 'no-store'}));
        const tx = await (await getter(base + '/json?poll=1&since=' + t0, 8000)).text();
        for(const l of String(tx).split('\n')){ if(!l) continue; let m; try{ m = JSON.parse(l); m = JSON.parse(m.message || '{}'); }catch(e){ continue; }
          if(m.rid === body.rid || m.event_id === body.event_id) return m; }
      }catch(e){}
    }
    return null;
  }
  function isLiveOpt(o){ return /^\s*\ud83c\udfa5\s*$/.test(String((o && o.label) || '')) || (/^j\d+:\s*\ud83c\udfa5\s*$/i.test(String((o && o.value) || ''))); }
  // Pull the tweet line out of an option: explicit `line`, else the value without its "jN: " prefix.
  function tweetLine(o){
    if(o && typeof o.line === 'string') return o.line;
    const v = String((o && o.value) || '').replace(/^j\d+:\s*/i, '');
    return /^\s*\ud83c\udfa5\s*$/.test(v) ? '' : v;
  }

  // Keep the dragged box (and its [[god]] header) on screen after it grows or the window resizes.
  function reclamp(){
    // v623: same rule as the drag (intent_ai.js clampPos): the box may hang off an edge, the [[god]] header strip may not
    const ai = AI(); if(ai && typeof ai.clampBox === 'function'){ try{ ai.clampBox(); }catch(e){} }
  }
  addEventListener('resize', () => { try{ reclamp(); }catch(e){} }, {passive: true});

  function mount(){
    const b = box(); if(!b) return;
    b.classList.add('cards-on');
    try{ const ta = b.querySelector('form.airow textarea'); if(ta && innerWidth < 560) ta.placeholder = 'type a call \u00b7 or say it'; }catch(e){}
    let jobEl = document.getElementById('aicard');
    if(!jobEl){
      jobEl = document.createElement('div'); jobEl.id = 'aicard';
      const form = b.querySelector('form.airow') || b.firstChild;
      b.insertBefore(jobEl, form);
    }
    let menuEl = document.getElementById('aimenu');
    if(!menuEl){
      menuEl = document.createElement('div'); menuEl.id = 'aimenu';
      b.appendChild(menuEl);
    }
    return {jobEl, menuEl};
  }

  const LEADS = [/^(Where things stand:)\s*/i, /^(What just happened:)\s*/i, /^(\ud83d\udcd6 Now:)\s*/];
  function promptEl(text){
    const lines = String(text || '').split('\n').map(x => x.trim()).filter(Boolean);
    const frag = document.createDocumentFragment();
    if(!lines.length) return frag;
    const t = document.createElement('div'); t.className = 'aictitle'; t.textContent = lines[0]; frag.appendChild(t);
    const body = document.createElement('div'); body.className = 'aicprompt';
    lines.slice(1).forEach(line => {
      const p = document.createElement('p');
      let lead = null;
      for(const re of LEADS){ const m = line.match(re); if(m){ lead = m[1]; line = line.slice(m[0].length); break; } }
      if(lead){ const s = document.createElement('span'); s.className = 'lead'; s.textContent = lead.replace(/:$/, ''); p.appendChild(s); }
      else if(/tapped .* times/i.test(line)) p.className = 'tap';
      if(lead && /Now/.test(lead)) p.className = 'now';
      p.appendChild(document.createTextNode(line));
      body.appendChild(p);
    });
    frag.appendChild(body);
    return frag;
  }

  function setStatus(text, kind){
    status = {job: card && card.job, text: text || '', kind: kind || ''};
    const n = document.getElementById('aicnote');
    if(n){ n.textContent = status.text; n.className = 'aicnote' + (status.kind ? ' ' + status.kind : ''); }
  }
  const note = setStatus;

  // v627 (Jesuye 1:26 PM "add publish to the lock menu and remove hold and tweets from the menu")
  // v637: Hold and Tweets are back on the main row (full [[god]] navigator). Jump ahead stays lock-only.
  const PUBLISH = {label: '\ud83d\udce3 Publish', value: 'publish!'};
  function withPublish(lock){
    const out = (lock || []).slice();
    if(!out.length || out.some(o => /^(lock:\s*)?publish!?$/i.test(String(o.value || '').trim()))) return out;
    const i = out.findIndex(o => /jump ahead/i.test(String(o.value || '')));
    if(i < 0) out.push(PUBLISH); else out.splice(i, 0, PUBLISH);
    return out;
  }

  // v628: full archive safe (chat option description) under each option.
  function safeText(o){
    if(o && typeof o.safe === 'string' && o.safe.trim()) return o.safe;
    if(o && typeof o.description === 'string' && o.description.trim()) return o.description;
    return '';
  }
  function safeRows(text){
    let s = String(text || '').replace(/\s+$/, '');
    let year = '';
    const ym = s.match(/\s+(\d{4})$/);
    if(ym){ year = ym[1]; s = s.slice(0, ym.index); }
    const m = s.match(/:\s+(?=\d+\.\s)/);
    let title = '', rows = [];
    if(m){
      title = s.slice(0, m.index).trim();
      rows = s.slice(m.index + m[0].length).split(' / ').map(x => x.trim()).filter(Boolean);
    } else if(s){
      rows = [s];
    }
    if(year) title = title ? (title + ' \u00b7 ' + year) : year;
    return {title, rows};
  }
  function fillSafe(el, text){
    const {title, rows} = safeRows(text);
    el.textContent = '';
    if(title){ const h = document.createElement('div'); h.className = 'ott'; h.textContent = title; el.appendChild(h); }
    let pick = null;
    if(rows.length){
      const body = document.createElement('div'); body.className = 'otb';
      rows.forEach((line, i) => {
        if(i){ const sep = document.createElement('span'); sep.className = 'ots'; sep.textContent = ' \u00b7 '; body.appendChild(sep); }
        const r = document.createElement('span'); r.className = 'otl';
        if(/\u00ab[\s\S]*\u00bb/.test(line)){ r.classList.add('pick'); pick = r; }
        r.textContent = line;
        body.appendChild(r);
      });
      el.appendChild(body);
    }
    return pick;
  }

  // v629: seat line, lock progress, waiting-to-be-seated, lock state. Data: open_card.json last_seat / pending / lines.
  function hhmm(iso){
    try{ const d = new Date(iso); if(isNaN(d)) return ''; return d.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}); }catch(e){ return ''; }
  }
  function isLocked(m){ return !!(m && (m.lock_open || (m.next_lock_at_lines && m.lines >= m.next_lock_at_lines))); }
  function progressEl(m){
    if(!m || !m.next_lock_at_lines) return null;
    const at = +m.next_lock_at_lines, n = Math.max(0, +m.lines || 0);
    const p = document.createElement('div'); p.className = 'aicprog';
    const t = document.createElement('span'); t.className = 'n'; t.textContent = Math.min(n, 99999) + '/' + at; p.appendChild(t);
    const bar = document.createElement('span'); bar.className = 'bar'; const fill = document.createElement('i');
    fill.style.width = Math.max(2, Math.min(100, Math.round(100 * n / at))) + '%'; bar.appendChild(fill); p.appendChild(bar);
    const nx = document.createElement('span'); nx.className = 'nx';
    nx.textContent = isLocked(m) ? 'locked' : ('next lock at ' + at + (at - n > 0 ? ' \u00b7 ' + (at - n) + ' to go' : ''));
    p.appendChild(nx);
    return p;
  }
  function pendingFor(m, c){
    const pk = m && m.pending && m.pending.pick;
    if(pk && pk.job && (!c || !c.job || pk.job === c.job || !c.open)) return pk;
    // just sent from this screen, export not caught up yet
    if(c && c.open && wasSent(c.job) && !(m && m.last_seat && m.last_seat.job === c.job)) return {job: c.job, local: true};
    return null;
  }
  // v634: open async jobs from open_card.json (no new timers; age is computed on each render/SSE update).
  function prettyKind(kind){
    const k = String(kind || '').split('.')[0];
    const s = k.replace(/(ps5|ps4|fifa|nba|nfl|ufc|xbox)/ig, ' $1').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
    return s.split(/\s+/).filter(Boolean).map(w => {
      const l = w.toLowerCase();
      if(l === 'ps5' || l === 'ps4' || l === 'fifa' || l === 'nba' || l === 'nfl' || l === 'ufc' || l === 'ea') return l.toUpperCase();
      return l;
    }).join(' ');
  }
  function jobText(j){
    if(j && typeof j.text === 'string' && j.text.trim()) return j.text.trim();
    const who = String((j && j.characters) || '').split(',').map(s => s.trim()).filter(Boolean).join(' vs ');
    const game = prettyKind(j && j.kind);
    return (who && game) ? (who + ' ' + game) : (who || game || ((j && j.id) || ''));
  }
  function ago(iso, now){
    const t = Date.parse(iso || '');
    if(isNaN(t)) return '';
    const s = Math.max(0, Math.floor(((now != null ? now : Date.now()) - t) / 1000));
    if(s < 60) return 'just opened';
    if(s < 3600){ const n = Math.floor(s / 60); return n === 1 ? 'open 1 minute' : ('open ' + n + ' minutes'); }
    if(s < 86400){ const n = Math.floor(s / 3600); return n === 1 ? 'open 1 hour' : ('open ' + n + ' hours'); }
    const n = Math.floor(s / 86400); return n === 1 ? 'open 1 day' : ('open ' + n + ' days');
  }
  function asyncPills(m){
    const jobs = (m && Array.isArray(m.async_jobs)) ? m.async_jobs : [];
    return jobs.filter(j => j && (j.text || j.kind || j.characters || j.id)).map(j => {
      const open = !!(j.id && asyncOpen.has(j.id));
      const w = document.createElement('div');
      w.className = 'aicwait aicasync' + (open ? ' open' : '');
      w.setAttribute('role', 'button');
      w.setAttribute('aria-expanded', open ? 'true' : 'false');
      w.setAttribute('tabindex', '0');
      if(j.id) w.dataset.jid = j.id;
      const age = ago(j.opened_at);
      w.appendChild(document.createTextNode('\u23f3 ' + jobText(j) + ' \u00b7 waiting on real life' + (age ? ' \u00b7 ' + age : '')));
      const ax = document.createElement('div'); ax.className = 'ax';
      const bits = [];
      if(j.id) bits.push(j.id);
      if(j.run) bits.push(j.run + (j.card ? ' ' + j.card : ''));
      if(j.stake) bits.push(j.stake);
      if(j.world_time) bits.push(j.world_time);
      ax.textContent = bits.join(' \u00b7 ');
      w.appendChild(ax);
      const tog = ev => {
        ev.preventDefault(); ev.stopPropagation();
        if(!j.id) return;
        if(asyncOpen.has(j.id)) asyncOpen.delete(j.id); else asyncOpen.add(j.id);
        const on = asyncOpen.has(j.id);
        w.classList.toggle('open', on);
        w.setAttribute('aria-expanded', on ? 'true' : 'false');
      };
      w.addEventListener('click', tog);
      w.addEventListener('keydown', ev => { if(ev.key === 'Enter' || ev.key === ' ') tog(ev); });
      return w;
    });
  }
  function seatStrip(){

    const m = meta || card, c = card;
    const wrap = document.createElement('div'); wrap.id = 'aicfb';
    const jobs = (m && Array.isArray(m.async_jobs)) ? m.async_jobs : [];
    if((!m || !m.run) && !jobs.length) return wrap;
    if(m && m.run && isLocked(m)){
      const lk = document.createElement('div'); lk.className = 'aiclock'; lk.setAttribute('role', 'status');
      const b = document.createElement('b'); b.textContent = '\ud83d\udd12 This agenda is locked \u00b7 ' + (m.lines || 0) + '/' + (m.next_lock_at_lines || m.lines || 0); lk.appendChild(b);
      lk.appendChild(document.createTextNode('No more jobs on this agenda. Pick \ud83c\udf81 Souvenir, \ud83d\udc26 Tweets, \ud83d\udce3 Publish or \u23e9 Jump ahead on the lock row below.'));
      wrap.appendChild(lk);
    }
    const ls = m && m.last_seat;
    if(m && m.run && ls && ls.job && (ls.lines || []).length){
      const box = document.createElement('div'); box.className = 'aicseat';
      const h = document.createElement('div'); h.className = 'sh';
      const t = document.createElement('span'); t.textContent = '\u2713 '; const b = document.createElement('b'); b.textContent = ls.job + ' seated'; t.appendChild(b);
      t.appendChild(document.createTextNode(' \u00b7 ' + ls.lines.length + ' line' + (ls.lines.length === 1 ? '' : 's') + (hhmm(ls.at) ? ' \u00b7 ' + hhmm(ls.at) : '')));
      h.appendChild(t); box.appendChild(h);
      const sl = document.createElement('div'); sl.className = 'sl';
      ls.lines.forEach(x => { const r = document.createElement('div'); r.textContent = x; sl.appendChild(r); });
      box.appendChild(sl);
      const pr = progressEl(m); if(pr) box.appendChild(pr);
      wrap.appendChild(box);
    } else if(m && m.run) {
      const pr = progressEl(m); if(pr) wrap.appendChild(pr);
    }
    const pills = sentPills(m && m.run);
    const pillJobs = new Set(sentLog().filter(e => e.kind === 'pick').map(e => e.job));
    const pillLabels = new Set(sentLog().filter(e => e.kind !== 'pick').map(e => e.label));
    const pk = pendingFor(m, c);
    if(pk && !isLocked(m) && !pillJobs.has(pk.job)){
      const w = document.createElement('div'); w.className = 'aicwait'; w.setAttribute('role', 'status');
      const d = document.createElement('span'); d.className = 'dot'; w.appendChild(d);
      w.appendChild(document.createTextNode(pk.job + ' pick waiting to be seated' + (hhmm(pk.at) ? ' \u00b7 sent ' + hhmm(pk.at) : '')));
      wrap.appendChild(w);
    }
    const menus = ((m && m.pending && m.pending.menu) || []).filter(x => !pillLabels.has(x.label));
    pills.forEach(x => wrap.appendChild(x));
    if(menus && menus.length){
      const w = document.createElement('div'); w.className = 'aicwait';
      const d = document.createElement('span'); d.className = 'dot'; w.appendChild(d);
      w.appendChild(document.createTextNode(menus.map(x => x.label).join(', ') + ' waiting'));
      wrap.appendChild(w);
    }
    asyncPills(m).forEach(x => wrap.appendChild(x));
    wrap.style.display = wrap.childNodes.length ? 'flex' : 'none';
    wrap.style.flexDirection = 'column'; wrap.style.gap = '6px';
    return wrap;
  }
  function updateStrip(){
    const old = document.getElementById('aicfb'); if(!old) return;
    old.replaceWith(seatStrip());
    const lr = document.querySelector('#aimenu .aimrow[data-row="lock"]'); if(lr) lr.classList.toggle('hot', isLocked(meta || card));
  }


  function sheetEl(s){
    const box = document.createElement('div'); box.id = 'aisheet';
    if(s.prompt){ const h = document.createElement('div'); h.className = 'sh'; h.textContent = s.prompt; box.appendChild(h); }
    if(s.helpText){ const h = document.createElement('div'); h.className = 'ht'; h.textContent = s.helpText; box.appendChild(h); }
    if(s.body){ const b = document.createElement('div'); b.className = 'bd'; b.textContent = s.body; box.appendChild(b); }
    const opts = s.options || [];
    if(opts.length){
      const wrap = document.createElement('div'); wrap.className = 'opts';
      opts.forEach(o => wrap.appendChild(menuBtn(o)));
      box.appendChild(wrap);
    }
    return box;
  }

  function render(){
    const els = mount(); if(!els) return;
    const {jobEl, menuEl} = els;
    const c = card;
    if(c && sel.job !== c.job){ sel = {job: c.job, values: new Set(), text: ''}; }
    const keepScroll = jobEl.scrollTop;
    // --- job card (above the typeline) ---
    jobEl.textContent = '';
    jobEl.appendChild(seatStrip());
    const sheet = (meta && meta.sheet) || (c && c.sheet);
    if(sheet && (sheet.prompt || (sheet.options || []).length || sheet.body)){
      jobEl.appendChild(sheetEl(sheet));
    }
    if(!c || !c.open || !(c.options || []).length){
      if(c && isLocked(meta || c)){ /* the lock banner above says it */ }
      else {
      const empty = document.createElement('div'); empty.className = 'aicempty';
      // v627: a pinned [[god]] run between a seat and its next card says so instead of showing another agenda
      empty.textContent = c && !c.open ? (c.waiting && c.seated_job ? c.seated_job + ' is seated \u2014 the next job appears here when it is posted.' : 'No open job card right now. The next one appears here when it is posted.') : 'loading card\u2026';
      jobEl.appendChild(empty);
      }
    } else {
      const locked = wasSent(c.job);
      if(c.prompt) jobEl.appendChild(promptEl(c.prompt));
      if(c.helpText){ const h = document.createElement('div'); h.className = 'aichelt'; h.textContent = c.helpText; jobEl.appendChild(h); }
      const opts = document.createElement('div'); opts.className = 'aicopts';
      // 🎥 is not a line any more: it is the '🎥 Live view' pill in the menu row (Jesuye 12:42 PM)
      (c.options || []).filter(o => !isLiveOpt(o)).forEach(o => {
        const b = document.createElement('div'); b.className = 'aicopt' + (sel.values.has(o.value) ? ' on' : '');
        b.dataset.value = o.value; b.setAttribute('role', 'button'); b.tabIndex = locked ? -1 : 0;
        b.setAttribute('aria-pressed', sel.values.has(o.value) ? 'true' : 'false');
        if(locked) b.setAttribute('aria-disabled', 'true');
        const l = document.createElement('span'); l.className = 'ol'; l.textContent = o.label; b.appendChild(l);
        const raw = safeText(o) || tweetLine(o);
        if(raw){
          const t = document.createElement('div'); t.className = 'ot';
          const pick = fillSafe(t, raw);
          // taps in the scroll area must not toggle the option (tap guard still covers the label)
          ;['pointerdown','pointerup','click'].forEach(k => t.addEventListener(k, ev => { ev.stopPropagation(); }, true));
          b.appendChild(t);
          // v629: centre the picked row inside its own code block only (scrollIntoView also scrolled the
          // whole card to the bottom, hiding the prompt and the seat line on open)
          if(pick) setTimeout(() => { try{ t.scrollTop = Math.max(0, pick.offsetTop - t.offsetTop - (t.clientHeight - pick.offsetHeight) / 2); }catch(e){} }, 0);
        }
        if(!locked){
          const toggle = () => {
            if(sel.values.has(o.value)) sel.values.delete(o.value); else sel.values.add(o.value);
            const on = sel.values.has(o.value);
            b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
            if(status.kind === 'err') setStatus('', '');
          };
          tapOnce(b, toggle);
          b.addEventListener('keydown', ev => { if(ev.key !== 'Enter' && ev.key !== ' ') return; ev.preventDefault(); ev.stopPropagation(); toggle(); });
        }
        opts.appendChild(b);
      });
      jobEl.appendChild(opts);
      if(c.allowCustom && !locked){
        const t = document.createElement('input'); t.type = 'text'; t.className = 'aicfree'; t.placeholder = 'or type your own line'; t.autocomplete = 'off';
        t.value = sel.text || '';
        t.addEventListener('keydown', e => { e.stopPropagation(); if(e.key === 'Enter'){ e.preventDefault(); sendCard(document.querySelector('#aicard .aicgo')); } });
        t.addEventListener('input', () => { sel.text = t.value; });
        jobEl.appendChild(t);
      }
      const row = document.createElement('div'); row.className = 'aicsend';
      const n = document.createElement('div'); n.className = 'aicnote'; n.id = 'aicnote'; n.setAttribute('role', 'status'); n.setAttribute('aria-live', 'polite');
      if(status.job === c.job && status.text){ n.textContent = status.text; if(status.kind) n.classList.add(status.kind); }
      else if(locked){ n.textContent = 'sent \u2014 next job coming'; n.classList.add('ok'); }
      const waitingReceipt = !!(locked && pendingSend && pendingSend.state === 'waiting' && pendingSend.job === c.job);   // v644: no tick before the receipt
      const go = document.createElement('button'); go.type = 'button'; go.className = 'aicgo' + (waitingReceipt ? ' busy' : (locked ? ' sent' : ''));
      go.textContent = waitingReceipt ? 'sending\u2026' : (locked ? 'sent \u2713' : (resendFor(c) ? 'Resend' : 'Send')); go.disabled = locked;
      tapOnce(go, () => sendCard(go));
      row.append(n, go);
      jobEl.appendChild(row);
    }
    jobEl.scrollTop = keepScroll;
    // --- menu buttons (below the typeline): always visible, no list / dropdown / collapse ---
    menuEl.textContent = '';
    const main = (c && c.menus && c.menus.main) || [];
    if(main.length){
      const row = document.createElement('div'); row.className = 'aimrow'; row.dataset.row = 'main';
      const lab = document.createElement('span'); lab.className = 'aimlab'; lab.textContent = 'menu'; row.appendChild(lab);
      const sc = document.createElement('div'); sc.className = 'aimscroll';
      // one Jump ahead only (Jesuye 12:39 PM): the LOCK row keeps it
      const lockHasJump = ((c && c.menus && c.menus.lock) || []).some(x => /jump ahead/i.test(String(x.value || x.label || '')));
      // v637: full [[god]] navigator on the menu row; Jump ahead stays on LOCK only; Live view shows while waiting too
      // v638: buttons live in a sideways-sliding strip so the story above keeps the height
      main.filter(o => !(lockHasJump && /jump ahead/i.test(String(o.value || o.label || '')))).forEach(o => sc.appendChild(menuBtn(o)));
      ((c && c.menus && c.menus.live) || []).forEach(o => { const lb = menuBtn(o); lb.classList.add('live'); sc.appendChild(lb); });
      row.appendChild(sc);
      menuEl.appendChild(row);
    }
    const lock = (c && c.menus && c.menus.lock) || [];
    if(lock.length){
      const row = document.createElement('div'); row.className = 'aimrow' + (isLocked(meta || c) ? ' hot' : ''); row.dataset.row = 'lock';
      const lab = document.createElement('span'); lab.className = 'aimlab'; lab.textContent = 'lock'; row.appendChild(lab);
      const sc = document.createElement('div'); sc.className = 'aimscroll';
      withPublish(lock).forEach(o => sc.appendChild(menuBtn(o)));
      row.appendChild(sc);
      menuEl.appendChild(row);
    }
    const mn = document.createElement('div'); mn.className = 'aimnote'; mn.id = 'aimnote'; mn.setAttribute('role', 'status'); menuEl.appendChild(mn);
    setTimeout(reclamp, 0);
  }

  // One activation per physical tap: pointerup and click both route here, deduped (Android tablets
  // sometimes drop or double the synthetic click inside the panel).
  // v624: one activation per tap across the WHOLE panel, so the trailing click of a tap can never land on a
  // neighbouring button if the layout shifts (QA 12:54 PM: a Seed tap also fired Souvenir).
  // A real new tap (pointerup) is always honored; only a trailing synthetic click on a DIFFERENT button
  // within 600 ms of a pointerup activation is ignored.
  let lastUp = {el: null, at: 0};
  function tapOnce(el, fn){
    let last = 0, sx = 0, sy = 0;
    el.addEventListener('pointerdown', ev => { sx = ev.clientX || 0; sy = ev.clientY || 0; }, {passive: true});
    const run = ev => { ev.preventDefault(); ev.stopPropagation(); if(el.disabled) return; const now = Date.now();
      if(Math.abs((ev.clientX || sx) - sx) > 14 || Math.abs((ev.clientY || sy) - sy) > 14) return;
      if(ev.type === 'click' && lastUp.el && lastUp.el !== el && now - lastUp.at < 600) return;
      if(now - last < 450) return; last = now; if(ev.type === 'pointerup') lastUp = {el, at: now}; fn(ev); };
    el.addEventListener('pointerup', ev => { if(ev.pointerType === 'mouse' && ev.button !== 0) return; run(ev); });
    el.addEventListener('click', run);
  }

  function menuBtn(o){
    const b = document.createElement('button'); b.type = 'button';
    b.textContent = o.label; b.dataset.value = o.value;
    if(menuRecent(card && card.run, o.value)){ b.classList.add('sent'); b.title = 'sent'; }
    tapOnce(b, () => sendMenu(b, o));
    return b;
  }
  function menuNote(text, kind){ const n = document.getElementById('aimnote'); if(n){ n.textContent = text || ''; n.className = 'aimnote' + (kind ? ' ' + kind : ''); } }

  function fetchOpen(ms){
    const ac = typeof AbortController === 'function' ? new AbortController() : null;
    const t = setTimeout(() => { try{ ac && ac.abort(); }catch(e){} }, ms || 8000);
    return fetch('data/open_card.json?t=' + Date.now(), {cache: 'no-store', signal: ac ? ac.signal : undefined})
      .then(r => r.ok ? r.json() : null).catch(() => null).finally(() => clearTimeout(t));
  }

  async function sendCard(btn){
    if(sending){ setStatus('still sending\u2026', 'busy'); return; }
    if(!card || !card.open){ setStatus('This card is closed \u2014 there is no open job right now.', 'err'); return; }
    if(wasSent(card.job)){ setStatus('Already sent for ' + card.job + ' \u2014 next job coming.', 'ok'); return; }
    const again = resendFor(card);   // v644: Resend re-posts the same event_id (no double pick)
    const chosen = (card.options || []).map(o => o.value).filter(v => sel.values.has(v));
    const labels = again ? (again.body.labels || []) : (card.options || []).filter(o => sel.values.has(o.value)).map(o => o.label);
    const free = (document.querySelector('#aicard .aicfree') || {}).value;
    const text = (free && String(free).trim()) || undefined;
    if(!again && !chosen.length && !text){
      setStatus('Pick a line (or type one) first.', 'err');
      if(btn){ btn.classList.add('err'); setTimeout(() => btn.classList.remove('err'), 1400); }
      log({event: 'send_empty', job: card.job});
      return;
    }
    sending = true;
    if(btn){ btn.disabled = true; btn.classList.add('busy'); btn.textContent = 'sending\u2026'; }
    setStatus('Checking the card is still open\u2026', 'busy');
    const job = card.job;
    const fresh = await fetchOpen(6000);
    if(fresh && typeof fresh === 'object' && (!fresh.open || fresh.job !== job)){
      sending = false;
      const was = job; card = fresh; meta = fresh; cardSig = JSON.stringify(fresh);
      if(again && seenResolved(again.body.event_id)){ pendingSend = null; status = {job: fresh.job, text: '\u2713 your ' + was + ' pick was seated \u2014 ' + (fresh.open ? fresh.job + ' is open now.' : 'next card coming.'), kind: 'ok'}; render(); return; }
      log({event: 'send_stale', job: was, open: fresh.open ? fresh.job : null});
      status = {job: fresh.job, text: fresh.open ? (was + ' is closed \u2014 ' + fresh.job + ' is open now. Pick again.') : (was + ' is closed \u2014 no open job right now.'), kind: 'err'};
      render(); return;
    }
    const eid = again ? again.body.event_id : uid('pick-');
    const body = again ? again.body : {v:1, type:'card_pick', event_id:eid, rid:eid+'-r', run:card.run, job:card.job, card:card.card,
      options:chosen, labels:labels, source:'projector', client_ts:new Date().toISOString()};
    if(!again && text) body.text = text.slice(0, 500);
    const t0 = again ? again.t0 : Math.floor(Date.now() / 1000) - 5;
    const ps = pendingSend = {job, sig: optSig(card), body, t0, r: null, state: 'waiting'};
    setStatus(again ? '\u2026 resending the same pick to the box' : '\u2026 sending to the box', 'busy');
    let r = null;
    const onRetry = (n, wait) => setStatus('The network is busy \u2014 retrying in ' + Math.round(wait / 1000) + ' s (' + (n + 1) + '/3)\u2026', 'busy');
    try{ r = await post(body, onRetry); }
    catch(e){
      sending = false; ps.state = 'not_received'; log({event: 'send_throw', job, error: String(e && e.message || e), event_id: eid});
      if(btn){ btn.disabled = false; btn.classList.remove('busy'); btn.textContent = 'Resend'; }
      setStatus('Not sent \u2014 ' + friendly(e) + '. Your pick is kept; tap Resend in a moment (same send, no double pick).', 'err'); return;
    }
    if(!(r && r.ok)){
      sending = false; ps.state = 'not_received'; log({event: 'send_http', job, status: r && r.status, event_id: eid});
      if(btn){ btn.disabled = false; btn.classList.remove('busy'); btn.textContent = 'Resend'; }
      setStatus('Not sent \u2014 ' + friendly(r ? 'HTTP ' + r.status : '') + '. Your pick is kept; tap Resend in a moment (same send, no double pick).', 'err'); return;
    }
    ps.r = r;
    markSent(job, card);   // holds the card while the receipt is pending (no second pick)
    logSent({kind: 'pick', run: body.run, job, label: labels.join(', ').slice(0, 80), event_id: eid});
    if(btn){ btn.classList.add('busy'); btn.textContent = 'sending\u2026'; }
    try{ updateStrip(); }catch(e){}
    setStatus('\u2026 waiting for the box to confirm ' + job, 'busy');
    log({event: 'send_ok', job, id: r.ntfyId, event_id: eid, resend: !!again});
    const m = await awaitReply(body, t0, r, RECEIPT_MS);
    sending = false;
    if(!m){
      if(pendingSend !== ps) return;
      ps.state = 'not_received'; unmarkSent(job);
      log({event: 'receipt_timeout', job, event_id: eid});
      status = {job, text: '\u2717 the box hasn\u2019t confirmed this send after 20 s. Tap Resend \u2014 it\u2019s the same send, so it can\u2019t pick twice.', kind: 'err'};
      render();
      lateReceipt(ps);
      return;
    }
    takeReceipt(ps, m);
  }
  // after a 20 s timeout keep listening a little longer; a late receipt still flips the card to ✓
  async function lateReceipt(ps){
    const m = await awaitReply(ps.body, ps.t0, ps.r, 0, [5000, 10000, 15000, 15000, 15000]);
    if(m && pendingSend === ps && ps.state === 'not_received' && !sending) takeReceipt(ps, m);
  }
  function takeReceipt(ps, m){
    const job = ps.job;
    if(pendingSend === ps) pendingSend = null;
    if(card && card.job !== job){ if(m.ok) status = {job: card.job, text: '\u2713 your ' + job + ' pick reached the box.', kind: 'ok'}; return; }
    const btn = document.querySelector('#aicard .aicgo');
    if(m.ok){
      markSent(job, card);
      if(btn){ btn.disabled = true; btn.classList.remove('busy'); btn.classList.add('sent'); btn.textContent = 'sent \u2713'; }
      status = {job, text: (m.status === 'seated' ? '\u2713 seated on ' + job : '\u2713 the box has your ' + job + ' pick') + ' \u2014 next card coming.', kind: 'ok'};
      setStatus(status.text, 'ok'); return;
    }
    // v643: 'already_sent' means this Send was NOT stored, so never show it as a success or keep the lock.
    if(m.code === 'already_sent'){ unmarkSent(job); status = {job, text: 'Not stored \u2014 the box already had a send for ' + job + '. Tap Send again.', kind: 'err'}; render(); return; }
    // v628: a seat can make the open job disappear before the receipt. v644: only call it in when the seat shows this event.
    if(m.code === 'job_mismatch' || m.code === 'no_open_job'){
      if(seenResolved(ps.body.event_id)){ setStatus('Sent \u2713 your ' + job + ' pick is in \u2014 next job coming.', 'ok'); return; }
      unmarkSent(job);
      status = {job, text: '\u2717 ' + job + ' closed before this send reached the box, so it was not stored. Pick on the open card.', kind: 'err'};
      render(); return;
    }
    unmarkSent(job);
    status = {job, text: '\u2717 Not accepted \u00b7 ' + (m.detail || m.code || 'rejected') + ' \u00b7 tap Send to try again.', kind: 'err'};
    render();
  }

  function sendMenu(btn, o){
    if(!o || !o.value || btn.disabled) return;
    const run = card && card.run;
    const again = pendingMenu[o.value] && pendingMenu[o.value].state === 'not_received' ? pendingMenu[o.value] : null;
    if(!again && menuRecent(run, o.value)){ btn.classList.add('sent'); btn.title = 'sent'; menuNote(o.label + ' already sent \u2713', 'ok'); return; } // drop before POST
    if(o.href && !again){ try{ window.open(o.href, '_blank', 'noopener'); }catch(e){} }
    btn.disabled = true; menuNote((again ? 'resending ' : 'sending ') + o.label + '\u2026', '');
    const eid = again ? again.body.event_id : uid('menu-');
    const body = again ? again.body : {v:1, type:'menu_action', event_id:eid, rid:eid+'-r', run:card && card.run, job:card && card.job, card:card && card.card,
      action:o.value, label:o.label, source:'projector', client_ts:new Date().toISOString()};
    const t0 = again ? again.t0 : Math.floor(Date.now() / 1000) - 5;
    const pm = pendingMenu[o.value] = {body, t0, r: null, state: 'waiting'};
    const onRetry = (n, wait) => menuNote(o.label + ': the network is busy \u2014 retrying in ' + Math.round(wait / 1000) + ' s (' + (n + 1) + '/3)\u2026', 'busy');
    const fail = why => { pm.state = 'not_received'; btn.disabled = false; btn.classList.add('err'); setTimeout(() => btn.classList.remove('err'), 1400); menuNote(o.label + ' not sent \u2014 ' + friendly(why) + '. Tap it again in a moment (same send, no double).', 'err'); };
    const done = m => {
      if(pendingMenu[o.value] === pm) delete pendingMenu[o.value];
      if(m.ok) return menuNote(o.label + ' received \u2713', 'ok');
      if(m.code === 'duplicate' || m.status === 'duplicate') return menuNote(o.label + ' already received \u2713', 'ok');
      btn.classList.remove('sent'); menuNote('\u2717 ' + o.label + ' not accepted \u2014 ' + (m.detail || m.code || 'rejected'), 'err');
    };
    post(body, onRetry).then(async r => {
      if(!(r && r.ok)) return fail(r ? 'HTTP ' + r.status : '');
      pm.r = r;
      btn.disabled = false; markMenu(run, o.value); logSent({kind: 'menu', run, job: body.job || null, action: o.value, label: o.label, event_id: eid}); try{ updateStrip(); }catch(e){}
      btn.title = 'sending'; menuNote('\u2026 ' + o.label + ' sent, waiting for the box to confirm', 'busy');
      const m = await awaitReply(body, t0, r, RECEIPT_MS);
      if(m) return done(m);
      // v644: no receipt in 20 s: say so; a second tap resends the same event_id (the box dedupes it)
      pm.state = 'not_received'; btn.classList.remove('sent'); btn.title = 'resend';
      try{ const mm = JSON.parse(localStorage.getItem(MENU_STORE) || '{}') || {}; delete mm[menuKey(run, o.value)]; localStorage.setItem(MENU_STORE, JSON.stringify(mm)); }catch(e){}
      menuNote('\u2717 the box hasn\u2019t confirmed ' + o.label + ' after 20 s. Tap it again to resend (same send, no double).', 'err');
      const late = await awaitReply(body, t0, r, 0, [5000, 10000, 15000, 15000, 15000]);
      if(late && pendingMenu[o.value] === pm && pm.state === 'not_received'){ btn.classList.add('sent'); btn.title = 'sent'; markMenu(run, o.value); done(late); }
    }).catch(fail);
  }

  function fetchCard(){
    if(document.hidden) return Promise.resolve();
    const panelOn = box() && box().classList.contains('on');
    if(!panelOn) return Promise.resolve();
    return fetchOpen(10000).then(j => {
      if(!j || typeof j !== 'object') return;
      if(meta && atMs(j.at) && atMs(meta.at) > atMs(j.at)) return;   // v630: the lane already brought a newer card
      applyCard(j, 'pages');
    }).catch(()=>{});
  }
  function applyCard(j, src){
    {
      const settled = settleSent(j);
      const sig = JSON.stringify(Object.assign({}, j, {at: null}));
      // After Send we wait on this job ('sent — next job coming'). When the
      // published card moves to the next jN, swap it in automatically.
      const metaChanged = JSON.stringify(Object.assign({}, meta || {}, {at: null})) !== sig;
      meta = j;
      if(card && sig === cardSig){ if(settled) updateStrip(); return; } // unchanged: keep the DOM (and the pick) as is
      // v628: a waiting / closed refresh must not collapse the sent card (confirmation
      // and size stay until the next job is actually open, or the user closes the panel).
      if(card && card.open && wasSent(card.job, j) && !(j.open && j.job && j.job !== card.job) && !isLocked(j)){
        cardSig = sig;
        if(metaChanged) updateStrip(); // v629: seat line / waiting / lock update in place, the sent card stays
        return;
      }
      // v643: same jN rebuilt with new lines: drop the old card's note, ticks and send lock so it reads fresh.
      if(card && j && card.job === j.job && optSig(card) !== optSig(j)){
        if(status.job === j.job) status = {job: null, text: '', kind: ''};
        if(sel.job === j.job){ const keep = new Set((j.options || []).map(o => o.value)); sel.values = new Set([...sel.values].filter(v => keep.has(v))); }
        if(sentMap()[j.job] && sentMap()[j.job] !== optSig(j)) unmarkSent(j.job);
      }
      card = j; cardSig = sig;
      if(box() && box().classList.contains('on')) render();   // v632: a lane card before the panel opens is kept for open()
    }
  }

  function startPoll(){
    stopPoll();
    const tick = () => { if(document.hidden) return; if(!box() || !box().classList.contains('on')) return; fetchCard(); };
    if(root.LH && typeof LH.poll === 'function'){
      pollId = LH.poll(tick, POLL_MS);
    } else {
      pollId = setInterval(tick, POLL_MS);
    }
  }
  function stopPoll(){
    if(!pollId) return;
    if(root.LH && typeof LH.clear === 'function'){ try{ LH.clear(pollId); }catch(e){} }
    else { clearInterval(pollId); }
    pollId = 0;
  }

  function hookClose(){
    const ai = AI(); if(!ai || ai._cardsHook) return !!ai;
    ai._cardsHook = true;
    const _open = ai.open, _close = ai.close;
    ai.open = function(){ const r = _open.apply(this, arguments); mount(); if(card) render(); fetchCard(); startPoll(); laneOpen(); return r; };
    ai.close = function(){
      if(!userClose) return; // typeline auto-close must not dismiss the card panel
      stopPoll();
      return _close.apply(this, arguments);
    };
    const b = document.getElementById('aicmd');
    if(b && !b._cardsHook){
      b._cardsHook = true;
      b.addEventListener('click', ev => {
        ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation();
        const on = box() && box().classList.contains('on');
        if(on){ userClose = true; try{ _close.call(ai); } finally { userClose = false; stopPoll(); } }
        else { ai.open(); }
      }, true);
    }
    addEventListener('keydown', ev => {
      if(ev.key !== 'Escape') return;
      if(!(box() && box().classList.contains('on'))) return;
      const t = ev.target;
      if(t && t.classList && t.classList.contains('aicfree')) return;
      userClose = true; try{ _close.call(ai); } finally { userClose = false; stopPoll(); }
    }, true);
    return true;
  }

  function ready(){
    laneOpen();                                   // v632: lane from load, panel open or not
    if(hookClose()) return;
    setTimeout(ready, 100);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})(window);
