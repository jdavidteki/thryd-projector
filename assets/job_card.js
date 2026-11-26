/* Command-panel job card + menu buttons (?cards=1 only, 2026-11-26).
   When the customer opens ›_ / the typed-command box, the open job card sits
   above the existing input and the menu options sit below it as plain buttons.
   Does nothing on a normal viewer URL: no fetch, no timer, no DOM.
   One slow poll (>=30s) only while the panel is open; paused when the tab is hidden.
   Posts go through window.thrydNtfyPost (existing intake). Never seats or runs a menu action. */
(function(root){
  'use strict';
  if(!/(?:^|[?&])cards=1(?:&|$)/.test(String(location.search||''))) return;

  const CSS = [
    '#aibox.cards-on{width:min(96vw,640px);max-height:min(78vh,720px);overflow:auto;bottom:10vh}',
    '#aicard{display:flex;flex-direction:column;gap:.55vh;padding:.2vh .2vh .6vh;border-bottom:1px solid #333;margin-bottom:.4vh}',
    '#aicard .aicprompt{white-space:pre-wrap;color:#ece6d6;font:500 max(12px,1.45vh)/1.35 Georgia,serif;max-height:18vh;overflow:auto}',
    '#aicard .aichelt{color:#8d877a;font:400 max(11px,1.25vh)/1.3 ui-monospace,Menlo,Consolas,monospace}',
    '#aicard .aicopts{display:flex;flex-direction:column;gap:.35vh}',
    '#aicard .aicopt{text-align:left;font:600 max(12px,1.45vh)/1.3 ui-monospace,Menlo,Consolas,monospace;color:#fff;background:#2a2a2a;border:1px solid #666;border-radius:.7vh;padding:.55vh .8vh;cursor:pointer;min-height:34px}',
    '#aicard .aicopt.on{border-color:#ffd76a;background:#3a3218;color:#ffe9a8}',
    '#aicard .aicopt:disabled,#aimenu button:disabled{opacity:.55;cursor:default}',
    '#aicard .aicfree{width:100%;box-sizing:border-box;font:inherit;color:#fff;background:#222;border:1px solid #666;border-radius:.7vh;padding:.5vh .7vh;min-height:32px}',
    '#aicard .aicgo{align-self:flex-end;min-width:88px;min-height:36px;padding:0 1vh;font:600 max(13px,1.5vh) ui-monospace,Menlo,Consolas,monospace;color:#111;background:#ffd76a;border:1px solid #c9a227;border-radius:.7vh;cursor:pointer}',
    '#aicard .aicgo.sent{background:#2a4;border-color:#185;color:#fff}',
    '#aicard .aicnote{color:#bbb;font-weight:400;font-size:.85em;min-height:1em}',
    '#aimenu{display:flex;flex-direction:column;gap:.5vh;padding:.55vh .2vh .2vh;border-top:1px solid #333;margin-top:.4vh}',
    '#aimenu .aimrow{display:flex;flex-wrap:wrap;gap:.45vh}',
    '#aimenu button{font:600 max(12px,1.4vh)/1.2 ui-sans-serif,system-ui,sans-serif;color:#fff;background:#2a2a2a;border:1px solid #8a6d2b;border-radius:.8vh;padding:.55vh .85vh;cursor:pointer;min-height:34px}',
    '#aimenu button.sent{border-color:#185;background:#1a3a22;color:#cfe}',
    '#aimenu .aimlab{color:#8d877a;font:400 max(10px,1.15vh)/1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.04em;text-transform:uppercase}'
  ].join('\n');
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  const STORE = 'thryd_card_sent';
  const POLL_MS = 30000;
  let card = null, pollId = 0, userClose = false, sending = false;

  const box = () => document.getElementById('aibox');
  const AI = () => root.thrydIntentAI;
  function sentMap(){ try{ return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; }catch(e){ return {}; } }
  function markSent(job){ const m = sentMap(); m[job] = 1; try{ localStorage.setItem(STORE, JSON.stringify(m)); }catch(e){} }
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
    if(!fn) return Promise.reject(new Error('no_endpoint'));
    return fn(body, kind || 'call');
  }

  function mount(){
    const b = box(); if(!b) return;
    b.classList.add('cards-on');
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

  function render(){
    const els = mount(); if(!els) return;
    const {jobEl, menuEl} = els;
    const c = card;
    // --- job card (above the typeline) ---
    jobEl.textContent = '';
    if(!c || !c.open || !(c.options || []).length){
      const empty = document.createElement('div'); empty.className = 'aicnote';
      empty.textContent = c && !c.open ? 'no open job card' : 'loading card…';
      jobEl.appendChild(empty);
    } else {
      const locked = wasSent(c.job);
      if(c.prompt){ const p = document.createElement('div'); p.className = 'aicprompt'; p.textContent = c.prompt; jobEl.appendChild(p); }
      if(c.helpText){ const h = document.createElement('div'); h.className = 'aichelt'; h.textContent = c.helpText; jobEl.appendChild(h); }
      const opts = document.createElement('div'); opts.className = 'aicopts';
      (c.options || []).forEach(o => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'aicopt';
        b.textContent = o.label; b.dataset.value = o.value;
        if(locked) b.disabled = true;
        b.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); if(locked) return; b.classList.toggle('on'); });
        opts.appendChild(b);
      });
      jobEl.appendChild(opts);
      if(c.allowCustom && !locked){
        const t = document.createElement('input'); t.type = 'text'; t.className = 'aicfree'; t.placeholder = 'or type a line'; t.autocomplete = 'off';
        t.addEventListener('keydown', e => e.stopPropagation());
        jobEl.appendChild(t);
      }
      const go = document.createElement('button'); go.type = 'button'; go.className = 'aicgo' + (locked ? ' sent' : '');
      go.textContent = locked ? 'sent' : 'Send'; go.disabled = locked;
      go.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); sendCard(go); });
      jobEl.appendChild(go);
      const note = document.createElement('div'); note.className = 'aicnote'; note.id = 'aicnote';
      if(locked) note.textContent = 'sent \u2014 next job coming';
      jobEl.appendChild(note);
    }
    // --- menu buttons (below the typeline): always visible, no list / dropdown / collapse ---
    menuEl.textContent = '';
    const main = (c && c.menus && c.menus.main) || [];
    if(main.length){
      const lab = document.createElement('div'); lab.className = 'aimlab'; lab.textContent = 'menu'; menuEl.appendChild(lab);
      const row = document.createElement('div'); row.className = 'aimrow'; row.dataset.row = 'main';
      main.forEach(o => row.appendChild(menuBtn(o)));
      menuEl.appendChild(row);
    }
    const lock = (c && c.menus && c.menus.lock) || [];
    if(lock.length){
      const lab = document.createElement('div'); lab.className = 'aimlab'; lab.textContent = 'lock'; menuEl.appendChild(lab);
      const row = document.createElement('div'); row.className = 'aimrow'; row.dataset.row = 'lock';
      lock.forEach(o => row.appendChild(menuBtn(o)));
      menuEl.appendChild(row);
    }
  }

  function menuBtn(o){
    const b = document.createElement('button'); b.type = 'button';
    b.textContent = o.label; b.dataset.value = o.value;
    if(menuRecent(card && card.run, o.value)){ b.classList.add('sent'); b.title = 'sent'; }
    b.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); sendMenu(b, o); });
    return b;
  }

  function note(text){ const n = document.getElementById('aicnote'); if(n) n.textContent = text || ''; }

  function sendCard(btn){
    if(sending || !card || !card.open || wasSent(card.job)){ if(card && wasSent(card.job)) note('sent \u2014 next job coming'); return; }
    const chosen = [...document.querySelectorAll('#aicard .aicopt.on')].map(b => b.dataset.value).filter(Boolean);
    const labels = [...document.querySelectorAll('#aicard .aicopt.on')].map(b => b.textContent);
    const free = (document.querySelector('#aicard .aicfree') || {}).value;
    const text = (free && String(free).trim()) || undefined;
    if(!chosen.length && !text){ note('pick a line or type one'); return; }
    sending = true; if(btn) btn.disabled = true;
    const eid = uid('pick-');
    const body = {v:1, type:'card_pick', event_id:eid, rid:eid+'-r', run:card.run, job:card.job, card:card.card,
      options:chosen, labels:labels, source:'projector', client_ts:new Date().toISOString()};
    if(text) body.text = text.slice(0, 500);
    post(body, 'call').then(r => {
      sending = false;
      if(r && r.ok){ markSent(card.job); if(btn){ btn.textContent = 'sent'; btn.classList.add('sent'); } render(); }
      else { if(btn) btn.disabled = false; note('not sent · try again'); }
    }).catch(() => { sending = false; if(btn) btn.disabled = false; note('not sent · try again'); });
  }

  function sendMenu(btn, o){
    if(!o || !o.value || btn.disabled) return;
    const run = card && card.run;
    if(menuRecent(run, o.value)){ btn.classList.add('sent'); btn.title = 'sent'; return; } // drop before POST
    btn.disabled = true;
    const eid = uid('menu-');
    const body = {v:1, type:'menu_action', event_id:eid, rid:eid+'-r', run:card && card.run, job:card && card.job, card:card && card.card,
      action:o.value, label:o.label, source:'projector', client_ts:new Date().toISOString()};
    post(body, 'call').then(r => {
      if(r && r.ok){ markMenu(run, o.value); btn.classList.add('sent'); btn.title = 'sent'; btn.disabled = false; }
      else { btn.disabled = false; }
    }).catch(() => { btn.disabled = false; });
  }

  function fetchCard(){
    if(document.hidden) return Promise.resolve();
    const panelOn = box() && box().classList.contains('on');
    if(!panelOn) return Promise.resolve();
    return fetch('data/open_card.json?t=' + Date.now(), {cache:'no-store'}).then(r => r.ok ? r.json() : null).then(j => {
      if(!j || typeof j !== 'object') return;
      const prev = card && card.job;
      card = j;
      // After Send we wait on this job ('sent — next job coming'). When the
      // published card moves to the next jN, swap it in automatically.
      if(j.job && j.job !== prev){ /* previous job stays marked sent in localStorage */ }
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
