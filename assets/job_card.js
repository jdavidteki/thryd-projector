/* Command-panel job card + menu buttons (?cards=1 only, 2026-11-26).
   When the customer opens ›_ / the typed-command box, the open job card sits
   above the existing input and the menu options sit below it as plain buttons.
   Does nothing on a normal viewer URL: no fetch, no timer, no DOM.
   One slow poll (>=30s) only while the panel is open; paused when the tab is hidden.
   Posts go through window.thrydNtfyPost (existing intake). Never seats or runs a menu action. */
(function(root){
  'use strict';
  if(!/(?:^|[?&])cards=1(?:&|$)/.test(String(location.search||''))) return;

  // v621 look (Jesuye 26 Nov 12:13 PM "make it look nice"): dark glass panel, compact drag header,
  // Literata (self-hosted 18 KB Latin subset) for the story text, tweet line under each option,
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
    '#aicard .aicopt .ot{font:italic 400 14px/1.45 ThrydRead,Georgia,serif;color:#b9b2a2}',
    '#aicard .aicopt.on{border-color:#ffd76a;background:rgba(255,215,106,.13)}',
    "#aicard .aicopt.on::before{background:#ffd76a;border-color:#ffd76a;box-shadow:inset 0 0 0 2.5px #2a2416}",
    '#aicard .aicopt.on .ot{color:#f2e3b8}',
    '#aicard .aicopt:disabled,#aimenu button:disabled{opacity:.5;cursor:default}',
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
    '#aimenu .aimrow{display:flex;flex-wrap:wrap;align-items:center;gap:6px}',
    '#aimenu button{font:600 12px/1.2 ui-sans-serif,system-ui,sans-serif;color:#efe9dc;background:rgba(255,255,255,.06);border:1px solid rgba(201,169,90,.45);border-radius:999px;padding:5px 11px;cursor:pointer;min-height:30px}',
    '#aimenu button.sent{border-color:#2f8a50;background:rgba(47,138,80,.22);color:#d8ffe5}',
    '#aimenu button.err{border-color:#a04040;background:rgba(160,64,64,.25)}',
    '#aimenu .aimlab{color:#8f897c;font:600 10px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;font-variant:small-caps;min-width:40px}',
    '#aimenu .aimnote:empty{display:none}',
    '#aimenu .aimnote{font:500 11.5px/1.3 ui-sans-serif,system-ui,sans-serif;color:#b8b2a4;min-height:0}',
    '#aimenu .aimnote.ok{color:#7fe0a0}#aimenu .aimnote.err{color:#ff8f86}',
    '@media (max-width:520px){#aibox.cards-on{width:96vw;bottom:6vh}#aicard .aicprompt{font-size:14.5px}}',
    '@media (max-height:600px){#aibox.cards-on{max-height:84vh;max-height:84dvh;bottom:6vh}#aibox.cards-on > .aim{display:none}#aibox.cards-on > form.airow{padding-top:7px}#aibox.cards-on textarea{min-height:32px}#aicard{gap:7px;padding:9px 12px 8px}#aicard .aicprompt{font-size:14px;line-height:1.55}}'
  ].join('\n');
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  const STORE = 'thryd_card_sent';
  const POLL_MS = 30000;
  let card = null, cardSig = '', pollId = 0, userClose = false, sending = false;
  // Selection lives in JS, not only in the DOM, so a poll / re-render never wipes a pick (v621).
  let sel = {job: null, values: new Set(), text: ''};
  let status = {job: null, text: '', kind: ''};

  const box = () => document.getElementById('aibox');
  const AI = () => root.thrydIntentAI;
  const log = info => { try{ root.thrydLogSend && root.thrydLogSend(Object.assign({branch: 'card'}, info)); }catch(e){} };
  function sentMap(){ try{ return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; }catch(e){ return {}; } }
  function markSent(job){ const m = sentMap(); m[job] = 1; try{ localStorage.setItem(STORE, JSON.stringify(m)); }catch(e){} }
  function unmarkSent(job){ const m = sentMap(); delete m[job]; try{ localStorage.setItem(STORE, JSON.stringify(m)); }catch(e){} }
  function wasSent(job){ return !!(job && sentMap()[job]); }
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
  function post(body, kind){
    const fn = root.thrydNtfyPost;
    if(!fn) return Promise.reject(new Error('intake not loaded \u00b7 reload the page'));
    return fn(body, kind || 'call');
  }
  const sleep = ms => new Promise(z => setTimeout(z, ms));
  // Wait for the validator's answer on the reply topic (same pattern as stage.js taps).
  async function awaitReply(body, t0){
    const DG = (root.thrydDrag && root.thrydDrag()) || root.DRAG || {};
    const base = DG.reply || (DG.endpoint ? String(DG.endpoint).replace(/\/?$/, '') + '-r' : null);
    if(!base) return null;
    for(const w of [1500, 2500, 4000, 6000, 8000, 12000]){
      await sleep(w);
      try{
        const getter = root.thrydNtfyGet || ((u, ms) => fetch(u, {cache: 'no-store'}));
        const tx = await (await getter(base + '/json?poll=1&since=' + t0, 8000)).text();
        for(const l of String(tx).split('\n')){ if(!l) continue; let m; try{ m = JSON.parse(l); m = JSON.parse(m.message || '{}'); }catch(e){ continue; }
          if(m.rid === body.rid || m.event_id === body.event_id) return m; }
      }catch(e){}
    }
    return null;
  }
  // Pull the tweet line out of an option: explicit `line`, else the value without its "jN: " prefix.
  function tweetLine(o){
    if(o && typeof o.line === 'string') return o.line;
    const v = String((o && o.value) || '').replace(/^j\d+:\s*/i, '');
    return /^\s*\ud83c\udfa5\s*$/.test(v) ? '' : v;
  }

  // Keep the dragged box (and its [[god]] header) on screen after it grows or the window resizes.
  function reclamp(){
    const b = box(); if(!b || !b.classList.contains('on')) return;
    if(!b.style.top || b.style.top === 'auto') return; // default centered position
    const r = b.getBoundingClientRect(), W = innerWidth, H = innerHeight;
    let left = r.left, top = r.top;
    if(r.bottom > H) top = H - r.height;
    if(r.right > W) left = W - r.width;
    top = Math.max(0, top); left = Math.max(0, left);
    if(top !== r.top || left !== r.left){
      b.style.top = top + 'px'; b.style.left = left + 'px';
      try{ localStorage.setItem('thryd_aibox_pos', JSON.stringify({left, top})); }catch(e){}
    }
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

  function render(){
    const els = mount(); if(!els) return;
    const {jobEl, menuEl} = els;
    const c = card;
    if(c && sel.job !== c.job){ sel = {job: c.job, values: new Set(), text: ''}; }
    const keepScroll = jobEl.scrollTop;
    // --- job card (above the typeline) ---
    jobEl.textContent = '';
    if(!c || !c.open || !(c.options || []).length){
      const empty = document.createElement('div'); empty.className = 'aicempty';
      empty.textContent = c && !c.open ? 'No open job card right now. The next one appears here when it is posted.' : 'loading card\u2026';
      jobEl.appendChild(empty);
    } else {
      const locked = wasSent(c.job);
      if(c.prompt) jobEl.appendChild(promptEl(c.prompt));
      if(c.helpText){ const h = document.createElement('div'); h.className = 'aichelt'; h.textContent = c.helpText; jobEl.appendChild(h); }
      const opts = document.createElement('div'); opts.className = 'aicopts';
      (c.options || []).forEach(o => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'aicopt' + (sel.values.has(o.value) ? ' on' : '');
        b.dataset.value = o.value; b.setAttribute('aria-pressed', sel.values.has(o.value) ? 'true' : 'false');
        const l = document.createElement('span'); l.className = 'ol'; l.textContent = o.label; b.appendChild(l);
        const tl = tweetLine(o);
        if(tl){ const t = document.createElement('span'); t.className = 'ot'; t.textContent = '\u201c' + tl + '\u201d'; b.appendChild(t); }
        if(locked) b.disabled = true;
        tapOnce(b, () => {
          if(locked) return;
          if(sel.values.has(o.value)) sel.values.delete(o.value); else sel.values.add(o.value);
          const on = sel.values.has(o.value);
          b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
          if(status.kind === 'err') setStatus('', '');
        });
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
      const go = document.createElement('button'); go.type = 'button'; go.className = 'aicgo' + (locked ? ' sent' : '');
      go.textContent = locked ? 'sent \u2713' : 'Send'; go.disabled = locked;
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
      main.forEach(o => row.appendChild(menuBtn(o)));
      menuEl.appendChild(row);
    }
    const lock = (c && c.menus && c.menus.lock) || [];
    if(lock.length){
      const row = document.createElement('div'); row.className = 'aimrow'; row.dataset.row = 'lock';
      const lab = document.createElement('span'); lab.className = 'aimlab'; lab.textContent = 'lock'; row.appendChild(lab);
      lock.forEach(o => row.appendChild(menuBtn(o)));
      menuEl.appendChild(row);
    }
    const mn = document.createElement('div'); mn.className = 'aimnote'; mn.id = 'aimnote'; mn.setAttribute('role', 'status'); menuEl.appendChild(mn);
    setTimeout(reclamp, 0);
  }

  // One activation per physical tap: pointerup and click both route here, deduped (Android tablets
  // sometimes drop or double the synthetic click inside the panel).
  function tapOnce(el, fn){
    let last = 0;
    const run = ev => { ev.preventDefault(); ev.stopPropagation(); if(el.disabled) return; const now = Date.now(); if(now - last < 450) return; last = now; fn(ev); };
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
    const chosen = (card.options || []).map(o => o.value).filter(v => sel.values.has(v));
    const labels = (card.options || []).filter(o => sel.values.has(o.value)).map(o => o.label);
    const free = (document.querySelector('#aicard .aicfree') || {}).value;
    const text = (free && String(free).trim()) || undefined;
    if(!chosen.length && !text){
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
      const was = job; card = fresh; cardSig = JSON.stringify(fresh);
      log({event: 'send_stale', job: was, open: fresh.open ? fresh.job : null});
      status = {job: fresh.job, text: fresh.open ? (was + ' is closed \u2014 ' + fresh.job + ' is open now. Pick again.') : (was + ' is closed \u2014 no open job right now.'), kind: 'err'};
      render(); return;
    }
    const eid = uid('pick-');
    const body = {v:1, type:'card_pick', event_id:eid, rid:eid+'-r', run:card.run, job:card.job, card:card.card,
      options:chosen, labels:labels, source:'projector', client_ts:new Date().toISOString()};
    if(text) body.text = text.slice(0, 500);
    setStatus('Sending\u2026', 'busy');
    const t0 = Math.floor(Date.now() / 1000) - 5;
    let r = null;
    try{ r = await post(body, 'call'); }
    catch(e){
      sending = false; log({event: 'send_throw', job, error: String(e && e.message || e)});
      if(btn){ btn.disabled = false; btn.classList.remove('busy'); btn.textContent = 'Send'; }
      setStatus('Not sent \u00b7 ' + String(e && e.message || e) + ' \u00b7 tap Send to try again.', 'err'); return;
    }
    if(!(r && r.ok)){
      sending = false; log({event: 'send_http', job, status: r && r.status});
      if(btn){ btn.disabled = false; btn.classList.remove('busy'); btn.textContent = 'Send'; }
      const st = r ? ('HTTP ' + r.status + (r.status === 429 ? ' (busy, wait a minute)' : '')) : 'no response';
      setStatus('Not sent \u00b7 ' + st + ' \u00b7 tap Send to try again.', 'err'); return;
    }
    markSent(job);
    if(btn){ btn.classList.remove('busy'); btn.classList.add('sent'); btn.textContent = 'sent \u2713'; }
    setStatus('Sent \u2713 waiting for the receipt\u2026', 'busy');
    log({event: 'send_ok', job, id: r.ntfyId, event_id: eid});
    const m = await awaitReply(body, t0);
    sending = false;
    if(card && card.job !== job) return;
    if(!m){ setStatus('Sent \u2713 (no receipt yet \u2014 it will still be picked up)', 'ok'); return; }
    if(m.ok){ setStatus('Received \u2713 your ' + job + ' pick is in \u2014 next job coming.', 'ok'); return; }
    if(m.code === 'already_sent'){ setStatus('Already sent for ' + job + ' \u2713 next job coming.', 'ok'); return; }
    unmarkSent(job);
    if(m.code === 'job_mismatch' || m.code === 'no_open_job'){
      const f2 = await fetchOpen(6000); if(f2){ card = f2; cardSig = JSON.stringify(f2); }
      status = {job: card && card.job, text: job + ' is closed' + (card && card.open && card.job !== job ? ' \u2014 ' + card.job + ' is open now. Pick again.' : '.'), kind: 'err'};
      render(); return;
    }
    status = {job, text: 'Not accepted \u00b7 ' + (m.detail || m.code || 'rejected') + ' \u00b7 tap Send to try again.', kind: 'err'};
    render();
  }

  function sendMenu(btn, o){
    if(!o || !o.value || btn.disabled) return;
    const run = card && card.run;
    if(menuRecent(run, o.value)){ btn.classList.add('sent'); btn.title = 'sent'; menuNote(o.label + ' already sent \u2713', 'ok'); return; } // drop before POST
    btn.disabled = true; menuNote('sending ' + o.label + '\u2026', '');
    const eid = uid('menu-');
    const body = {v:1, type:'menu_action', event_id:eid, rid:eid+'-r', run:card && card.run, job:card && card.job, card:card && card.card,
      action:o.value, label:o.label, source:'projector', client_ts:new Date().toISOString()};
    post(body, 'call').then(r => {
      btn.disabled = false;
      if(r && r.ok){ markMenu(run, o.value); btn.classList.add('sent'); btn.title = 'sent'; menuNote(o.label + ' sent \u2713', 'ok'); }
      else { btn.classList.add('err'); setTimeout(() => btn.classList.remove('err'), 1400); menuNote(o.label + ' not sent \u00b7 ' + (r ? 'HTTP ' + r.status : 'no response') + ' \u00b7 try again', 'err'); }
    }).catch(e => { btn.disabled = false; menuNote(o.label + ' not sent \u00b7 ' + String(e && e.message || e) + ' \u00b7 try again', 'err'); });
  }

  function fetchCard(){
    if(document.hidden) return Promise.resolve();
    const panelOn = box() && box().classList.contains('on');
    if(!panelOn) return Promise.resolve();
    return fetchOpen(10000).then(j => {
      if(!j || typeof j !== 'object') return;
      const sig = JSON.stringify(Object.assign({}, j, {at: null}));
      // After Send we wait on this job ('sent — next job coming'). When the
      // published card moves to the next jN, swap it in automatically.
      if(card && sig === cardSig){ return; } // unchanged: keep the DOM (and the pick) as is
      card = j; cardSig = sig;
      render();
    }).catch(()=>{});
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
    ai.open = function(){ const r = _open.apply(this, arguments); mount(); fetchCard(); startPoll(); return r; };
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
    if(hookClose()) return;
    setTimeout(ready, 100);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})(window);
