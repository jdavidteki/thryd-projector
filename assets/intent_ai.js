/* intent AI layer (Jesuye 17 Nov 2026 👍 "add Transformers.js so tap menus and typed commands understand what people mean, plus
   Chrome's built-in model as a bonus"). Sits on top of the smart-tap scoring rule in stage.js; never required.
   - After the page is idle, a module worker (assets/intent_ai_worker.js) lazy-loads Transformers.js from jsDelivr and the
     Xenova/all-MiniLM-L6-v2 sentence-embedding model (q8, ~23 MB, cached by the browser). No server, no keys.
   - Menus: each choice gets a bonus (0..0.2) from its similarity to this viewer's recent picks and typed commands; stage.js's
     scoreOf() adds it (thrydIntentAI.bonus). It can reorder a menu but can never make a tap skip the menu on its own (max .4 < .75).
   - Typed commands: "/" (or the [[god]] button) opens a box. teo.folds(surgical) or "teo fold" maps to the nearest real function name;
     high confidence auto-applies with a brief "did you mean" and an undo; otherwise up to three suggestions to tap.
   - Chrome's Prompt API (LanguageModel), only where it is already downloaded and available: free-text commands get a ✨ suggestion.
   - Falls back silently to the plain scoring rule (and letter-level matching in the box) if anything fails, on weak devices, Save-Data
     or slow networks, and with ?noai=1. */
(function(root){
  'use strict';
  const Q = String(location.search || ''), NOAI = /(?:^|[?&])noai=1(?:&|$)/.test(Q);
  const AI = root.thrydIntentAI = {state: NOAI ? 'optout' : 'waiting', why: NOAI ? '?noai=1' : '', model: 'Xenova/all-MiniLM-L6-v2 (q8)', ms: 0, chrome: 'unchecked', errors: []};
  const ST = ()=> root.__thrydStage || {};
  const OMF = ()=> ((ST().objectMethods || {}).functions) || {};
  const hz = s => String(s || '').replace(/^#/, '').replace(/\(.*$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[._\-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const nk = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

  // ---------- weak device / network: no model at all
  function weak(){ const n = navigator, cn = n.connection;
    if(typeof Worker !== 'function' || typeof WebAssembly !== 'object') return 'no worker/wasm';
    if(cn && cn.saveData) return 'save-data'; if(cn && /(^|-)(2g|3g)$/.test(cn.effectiveType || '')) return 'slow network';
    if(n.deviceMemory && n.deviceMemory < 4) return 'low memory'; if(n.hardwareConcurrency && n.hardwareConcurrency < 4) return 'few cores';
    return ''; }

  // ---------- the worker and a small embedding cache
  const V = AI.vecs = new Map(); let W = null, seq = 0; const waits = new Map(), want = new Set(); let flushT = 0;
  function fail(why){ AI.state = 'fallback'; AI.why = why; try{ W && W.terminate(); }catch(e){} W = null; waits.forEach(p => p.res(null)); waits.clear(); }
  function start(){
    if(AI.state !== 'waiting') return; const w = weak(); if(w){ AI.state = 'fallback'; AI.why = w; return; }
    AI.state = 'loading'; const t0 = Date.now();
    try{ W = new Worker('assets/intent_ai_worker.js?v=1', {type: 'module'}); }catch(e){ fail('worker: ' + (e && e.message || e)); return; }
    const to = setTimeout(()=>{ if(AI.state === 'loading') fail('model load timed out'); }, 180000);
    W.onerror = e => { clearTimeout(to); fail('worker error ' + (e && e.message || '')); };
    W.onmessage = ev => { const m = ev.data || {};
      if(m.type === 'ready'){ clearTimeout(to); AI.state = 'ready'; AI.ms = Date.now() - t0; seedCorpus(); return; }
      if(m.type === 'error'){ AI.errors.push(m.error); if(AI.errors.length > 5) AI.errors.shift(); if(AI.state === 'loading'){ clearTimeout(to); fail(m.error); } const p = waits.get(m.id); if(p){ waits.delete(m.id); p.res(null); } return; }
      if(m.type === 'vecs'){ const p = waits.get(m.id); if(!p) return; waits.delete(m.id); const out = [];
        for(let i = 0; i < p.texts.length; i++){ const v = m.buf.subarray(i * m.dim, (i + 1) * m.dim); V.set(p.texts[i], v); out.push(v); } p.res(out); } };
    W.postMessage({type: 'init'});
  }
  function embed(texts){ texts = [...new Set(texts.map(hz).filter(Boolean))];
    if(AI.state !== 'ready' || !W) return Promise.resolve(null);
    const need = texts.filter(t => !V.has(t)); if(!need.length) return Promise.resolve(texts.map(t => V.get(t)));
    const chunks = []; for(let i = 0; i < need.length; i += 32) chunks.push(need.slice(i, i + 32));
    return Promise.all(chunks.map(ch => new Promise(res => { const id = ++seq; waits.set(id, {res, texts: ch}); W.postMessage({type: 'embed', id, texts: ch}); })))
      .then(()=> texts.map(t => V.get(t) || null)); }
  function later(t){ t = hz(t); if(!t || V.has(t) || AI.state !== 'ready') return; want.add(t);
    if(!flushT) flushT = setTimeout(()=>{ flushT = 0; const a = [...want]; want.clear(); embed(a); }, 250); }
  const dot = (a, b)=>{ let s = 0; for(let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  function seedCorpus(){ const F = OMF(), xs = [];
    Object.keys(F).forEach(id => { xs.push(id); (F[id].titles || []).forEach(t => xs.push(t.title)); });
    ['glow', 'grow', 'shrink', 'dim', 'brighten', 'setmood'].forEach(x => xs.push(x)); histTexts().forEach(x => xs.push(x)); embed(xs); }

  // ---------- this viewer's context: recent picks (stage.js smart-tap history) + typed commands (this box)
  const TK = 'thryd_ai_typed';
  const typed = ()=>{ try{ return JSON.parse(localStorage.getItem(TK) || '[]'); }catch(e){ return []; } };
  function pushTyped(text){ const a = typed().filter(x => x.text !== text); a.push({text, t: Date.now()}); if(a.length > 12) a.splice(0, a.length - 12); try{ localStorage.setItem(TK, JSON.stringify(a)); }catch(e){} }
  function histItems(){ const IH = (ST().intentHistory && ST().intentHistory()) || {o: {}}, out = [];
    Object.keys(IH.o || {}).forEach(k => (IH.o[k] || []).forEach(h => out.push({text: String(h.id || '').replace(/^[fm]:/, ''), t: h.t})));
    typed().forEach(x => out.push(x)); return out.sort((a, b) => b.t - a.t).slice(0, 10); }
  const histTexts = ()=> histItems().map(h => h.text);
  let ctxSig = '', ctxV = null;
  function context(){ const hs = histItems(), sig = hs.map(h => h.t).join(','); if(sig === ctxSig) return ctxV;
    let acc = null, n = 0; hs.forEach((h, i) => { const v = V.get(hz(h.text)); if(!v){ later(h.text); return; } const w = Math.pow(.5, i / 4);
      if(!acc) acc = new Float32Array(v.length); for(let j = 0; j < v.length; j++) acc[j] += w * v[j]; n++; });
    if(acc){ let s = 0; for(let j = 0; j < acc.length; j++) s += acc[j] * acc[j]; s = Math.sqrt(s) || 1; for(let j = 0; j < acc.length; j++) acc[j] /= s; }
    // only cache once every item had a vector, so the context fills in as embeddings arrive
    if(n === hs.length) ctxSig = sig; ctxV = acc; return acc; }
  AI.hasContext = ()=> AI.state === 'ready' && !!context();
  // the bonus stage.js's scoreOf() adds (sync; 0 until the model and this choice's vector are ready)
  AI.bonus = (c, x)=>{ try{ if(AI.state !== 'ready' || !x) return 0; const text = x.it ? (x.it.t && x.it.t.title) || x.it.id : x.m ? x.m.fn : '';
      const v = V.get(hz(text)); if(!v){ later(text); return 0; } const ctx = context(); if(!ctx) return 0;
      const s = dot(v, ctx); return Math.round(.2 * Math.max(0, Math.min(1, (s - .25) / .6)) * 1000) / 1000; }catch(e){ return 0; } };

  // ---------- typed command -> the nearest real function
  function lev(a, b){ if(a === b) return 0; const m = a.length, n = b.length; if(!m || !n) return m || n; let p = new Array(n + 1), q = new Array(n + 1);
    for(let j = 0; j <= n; j++) p[j] = j; for(let i = 1; i <= m; i++){ q[0] = i; for(let j = 1; j <= n; j++) q[j] = Math.min(p[j] + 1, q[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); [p, q] = [q, p]; } return p[n]; }
  const stem = w => w.replace(/(ing|ed|es|s)$/, '') || w;
  function wsim(a, b){ a = nk(a); b = nk(b); if(!a || !b) return 0; if(a === b) return 1; if(stem(a) === stem(b)) return .95;
    if(b.startsWith(a) && a.length >= 3) return .85; const L = Math.max(a.length, b.length); return Math.max(0, 1 - lev(a, b) / L) * .9; }
  function parse(text){ const s = String(text || '').trim().replace(/^\/+/, '').replace(/;+\s*$/, '');
    let m = s.match(/^#?([A-Za-z_][\w]*)\s*\.\s*([A-Za-z_][\w]*)\s*(?:\((.*)\))?$/) || s.match(/^#?([A-Za-z_][\w]*)\s+([A-Za-z_][\w]*)(?:\s*\((.*)\))?$/);
    if(m) return {obj: m[1], fn: m[2], args: m[3] != null ? m[3].split(',').map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean) : [], free: false};
    return {free: true, words: s.toLowerCase().split(/[^a-z0-9_]+/).filter(w => w.length > 1)}; }
  function onStage(){ const S = ST(), map = new Map(); (S.cuts || []).forEach(c => { if(!c || !c.el || !c.el.isConnected || c.leaving || !S.choicesFor) return;
      let xs = []; try{ xs = S.choicesFor(c); }catch(e){} xs.forEach(x => { if(x.it && !map.has(x.it.id)) map.set(x.it.id, {c, x}); else if(x.it && x.kind === 'own') map.set(x.it.id, {c, x}); }); });
    return map; }
  async function resolve(text){
    const F = OMF(), ids = Object.keys(F), P = parse(text), live = onStage(); if(!ids.length) return {P, top: []};
    const lexOf = id => { const [o, f] = [id.split('.')[0], F[id].method || id.split('.').slice(1).join('.')];
      if(!P.free) return .5 * wsim(P.obj, o) + .5 * wsim(P.fn, f);
      const ws = P.words; if(!ws.length) return 0; return .5 * Math.max(...ws.map(w => wsim(w, o))) + .5 * Math.max(...ws.map(w => wsim(w, f))); };
    let qv = null; if(AI.state === 'ready'){ const r = await embed([P.free ? text : P.obj + ' ' + P.fn]); qv = r && r[0]; }
    const top = ids.map(id => { const lex = lexOf(id), v = qv && V.get(hz(id)); const emb = v ? Math.max(0, dot(qv, v)) : null;
        const s = emb == null ? lex : .65 * lex + .35 * emb; return {id, lex, emb, s: s + (live.has(id) ? .03 : 0), live: live.get(id) || null, f: F[id]}; })
      .sort((a, b) => b.s - a.s).slice(0, 5);
    return {P, top, used: qv ? 'embeddings' : 'letters'}; }
  AI.resolve = resolve;
  // yoki DJ (assets/yoki_dj.js): vectors for its few short context texts, one per input (null where missing)
  AI.embed = texts => embed(texts).then(vs => { if(!vs) return null; const m = new Map(); [...new Set(texts.map(hz).filter(Boolean))].forEach((t, i) => m.set(t, vs[i])); return texts.map(t => m.get(hz(t)) || null); });

  // ---------- Chrome built-in AI (Prompt API): detect only; used only when already available on this device
  let LMS = null;
  async function chromeCheck(){ try{ const LM = root.LanguageModel || (root.ai && root.ai.languageModel); if(!LM){ AI.chrome = 'none'; return; }
      const a = LM.availability ? await LM.availability() : (LM.capabilities ? (await LM.capabilities()).available : 'no'); AI.chrome = String(a); }catch(e){ AI.chrome = 'none'; } }
  const chromeOk = ()=> !NOAI && /^(available|readily)$/.test(AI.chrome);
  async function chromeSuggest(text, ids){ if(!chromeOk()) return null; const LM = root.LanguageModel || (root.ai && root.ai.languageModel);
    const tmo = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(()=> r(new Error('timeout')), ms))]);
    try{ if(!LMS) LMS = await tmo(LM.create({initialPrompts: [{role: 'system', content: 'You map a viewer\'s free-text wish to one function call from a list. Reply with exactly one item from the list and nothing else, or NONE.'}]}), 8000);
      const ans = String(await tmo(LMS.prompt('Functions: ' + ids.join(', ') + '\nWish: ' + text + '\nAnswer:'), 8000) || '').toLowerCase();
      return ids.find(id => ans.includes(id.toLowerCase())) || null; }catch(e){ AI.errors.push('chrome: ' + (e && e.message || e)); return null; } }

  // ---------- the box
  const css = document.createElement('style'); css.textContent = [
    '#aibox{position:fixed;left:50%;bottom:12vh;transform:translateX(-50%);z-index:10060;display:none;flex-direction:column;gap:.6vh;width:min(92vw,520px);padding:.8vh;border-radius:1vh;background:rgba(12,12,12,.92);box-shadow:0 3px 16px #0009;font:600 max(13px,1.6vh) ui-monospace,Menlo,Consolas,monospace;color:#fff}',
    '#aibox.on{display:flex}', '#aibox .airow{display:flex;align-items:stretch;gap:.5vh;width:100%}', '#aibox input,#aibox textarea{flex:1 1 auto;min-width:0;font:inherit;color:#fff;background:#222;border:1px solid #666;border-radius:.7vh;padding:.8vh 1vh;outline:none;min-height:36px;resize:none;overflow:hidden;line-height:1.3}',
    '#aibox #aisend{flex:0 0 auto;min-width:44px;min-height:36px;padding:0 .85vh;font:inherit;color:#111;background:#ffd76a;border:1px solid #c9a227;border-radius:.7vh;cursor:pointer;line-height:1}',
    '#aibox input:focus,#aibox textarea:focus{border-color:#ffd76a}', '#aibox .aim{color:#bbb;font-weight:400;font-size:.85em;min-height:1em}', '#aibox .aic{display:flex;flex-wrap:wrap;gap:.5vh}',
    '#aibox .aic button{font:inherit;color:#fff;background:#2a2a2a;border:1px solid #8a6d2b;border-radius:.8vh;padding:.6vh .9vh;cursor:pointer;min-height:34px}',
    '#aibox .aic button.ch{border-color:#9f7aea}', '#aibox .aic button.off{opacity:.6}', '#aibox .aiu{color:#9fd3ff;cursor:pointer;text-decoration:underline;margin-left:.6em}',
    '#aibox #aihead{cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none;padding:.15vh .35vh .35vh;color:#fff;font:inherit;line-height:1.2}',
    '#aibox #aihead:active{cursor:grabbing}',
    '#aicmd{min-width:auto;white-space:nowrap}'].join('\n'); document.head.appendChild(css);
  let box = null, inp = null, msg = null, chips = null, sendBtn = null, lastSub = 0;
  const POS_KEY = 'thryd_aibox_pos';
  function readPos(){ try{ const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null'); if(p && isFinite(+p.left) && isFinite(+p.top)) return {left: +p.left, top: +p.top}; }catch(e){} return null; }
  function writePos(left, top){ try{ localStorage.setItem(POS_KEY, JSON.stringify({left, top})); }catch(e){} }
  function clearPos(){ try{ localStorage.removeItem(POS_KEY); }catch(e){} }
  function boxSize(){ const r = box.getBoundingClientRect(); return {w: r.width, h: r.height}; }
  // v623 (Jesuye 26 Nov 12:45 PM): the box may hang off any edge, but a grabbable strip of the [[god]] header
  // always stays on screen: >= GRIP px of its width and its full height, never above the top edge.
  const GRIP = 120;
  function headH(){ const hd = box && box.querySelector('#aihead'); const r = hd && hd.getBoundingClientRect(); return ((r && r.height) || 30) + ((hd && hd.offsetTop) || 0) + 1; }
  function onscreen(left, top){ const {w, h} = boxSize(); if(!w || !h) return false; const g = Math.min(GRIP, w);
    return top >= 0 && top + headH() <= window.innerHeight && left + w >= g && left <= window.innerWidth - g; }
  function clampPos(left, top){ const {w} = boxSize(); const g = Math.min(GRIP, w || GRIP);
    const minL = g - (w || g), maxL = Math.max(minL, window.innerWidth - g), maxT = Math.max(0, window.innerHeight - headH());
    return {left: Math.min(maxL, Math.max(minL, left)), top: Math.min(maxT, Math.max(0, top))}; }
  function setPos(left, top){ const p = clampPos(left, top); box.style.left = p.left + 'px'; box.style.top = p.top + 'px'; box.style.bottom = 'auto'; box.style.transform = 'none'; writePos(p.left, p.top); return p; }
  function resetPos(){ clearPos(); if(!box) return; box.style.left = ''; box.style.top = ''; box.style.bottom = ''; box.style.transform = ''; }
  function applyPos(){ if(!box || !box.classList.contains('on')) return; const p = readPos(); if(!p){ resetPos(); return; } const c = onscreen(p.left, p.top) ? p : clampPos(p.left, p.top); box.style.left = c.left + 'px'; box.style.top = c.top + 'px'; box.style.bottom = 'auto'; box.style.transform = 'none'; if(c !== p) writePos(c.left, c.top); }
  AI.clampBox = function(){ if(!box || !box.classList.contains('on') || !box.style.top || box.style.top === 'auto') return; const r = box.getBoundingClientRect(); if(onscreen(r.left, r.top)) return; const c = clampPos(r.left, r.top); box.style.left = c.left + 'px'; box.style.top = c.top + 'px'; writePos(c.left, c.top); };
  function fromControl(t){ return !!(t && t.closest && t.closest('input,textarea,button,select,option,[role="option"],a,label,[contenteditable="true"]')); }
  function bindDrag(head){
    head.addEventListener('pointerdown', ev => {
      if(ev.button != null && ev.button !== 0) return;
      if(fromControl(ev.target)) return;
      ev.preventDefault();
      const r = box.getBoundingClientRect();
      const sx = ev.clientX, sy = ev.clientY, sl = r.left, st = r.top;
      try{ head.setPointerCapture(ev.pointerId); }catch(e){}
      const move = ev2 => { setPos(sl + ev2.clientX - sx, st + ev2.clientY - sy); };
      const up = ev2 => {
        try{ head.releasePointerCapture(ev2.pointerId); }catch(e){}
        head.removeEventListener('pointermove', move);
        head.removeEventListener('pointerup', up);
        head.removeEventListener('pointercancel', up);
      };
      head.addEventListener('pointermove', move);
      head.addEventListener('pointerup', up);
      head.addEventListener('pointercancel', up);
    }, {passive: false});
  }

  function markQueued(text){
    const line = String(text || '').replace(/;?$/, ';');
    try{ const S = ST(); if(S && S.markQueued) S.markQueued(line, 'queued\u2026'); }catch(e){}
    try{ if(msg) msg.textContent = 'queued\u2026'; }catch(e){}
  }
  function submitNow(ev, how){
    if(ev){ ev.preventDefault(); ev.stopPropagation(); }
    const now = Date.now();
    if(now - lastSub < 400) return;
    lastSub = now;
    let text = inp ? String(inp.value || '') : '';
    if(/\n/.test(text)) text = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    if(inp) inp.value = '';
    const path = how || (ev && ev.type) || 'go';
    try{ console.log('[thryd send]', {branch: 'submit', how: path, text: String(text).slice(0, 80)}); }catch(e){}
    if(text){ markQueued(text); try{ if(window.thrydCliAttempt) window.thrydCliAttempt(text, path); }catch(e){} }
    return go(text);
  }
  function ui(){ if(box) return; box = document.createElement('div'); box.id = 'aibox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Type a call');
    const form = document.createElement('form'); form.className = 'airow'; form.setAttribute('action', ''); form.setAttribute('method', 'get'); form.setAttribute('novalidate', '');
    inp = document.createElement('textarea'); inp.rows = 1; inp.name = 'call'; inp.autocomplete = 'off'; inp.spellcheck = false;
    inp.setAttribute('enterkeyhint', 'go'); inp.setAttribute('inputmode', 'text'); inp.setAttribute('aria-label', 'Type a call');
    inp.placeholder = 'type a call · teo.fold() · or say what you want';
    sendBtn = document.createElement('button'); sendBtn.id = 'aisend'; sendBtn.type = 'button'; sendBtn.setAttribute('aria-label', 'Submit');
    sendBtn.title = 'Send'; sendBtn.textContent = '\u27a4';
    form.append(inp, sendBtn);
    msg = document.createElement('div'); msg.className = 'aim'; chips = document.createElement('div'); chips.className = 'aic';
    const head = document.createElement('div'); head.id = 'aihead'; head.textContent = '[[god]]';
    box.append(head, form, msg, chips); document.body.appendChild(box);
    bindDrag(head);
    ['pointerdown', 'click'].forEach(k => box.addEventListener(k, e => { if(e.target !== sendBtn) e.stopPropagation(); }));
    form.addEventListener('submit', e => { e.preventDefault(); e.stopPropagation(); submitNow(e, 'form_submit'); });
    // pointerdown + preventDefault keeps the Android keyboard open (input does not blur before send)
    sendBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); submitNow(e, 'button_pointerdown'); }, {passive: false});
    sendBtn.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); submitNow(e, 'button_touchend'); }, {passive: false});
    sendBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); submitNow(e, 'button_click'); });
    inp.addEventListener('keydown', e => { e.stopPropagation(); if(e.key === 'Escape'){ close(); } else if(e.key === 'Enter' || e.key === 'Go' || e.key === 'Search' || e.keyCode === 13){ e.preventDefault(); submitNow(e, 'keydown_' + (e.key || e.keyCode)); } });
    inp.addEventListener('keyup', e => { e.stopPropagation(); if(e.key === 'Enter' || e.key === 'Go' || e.key === 'Search' || e.keyCode === 13){ e.preventDefault(); submitNow(e, 'keyup_' + (e.key || e.keyCode)); } });
    // Android Chrome IME Go often fires beforeinput insertLineBreak instead of (or before) keydown Enter
    inp.addEventListener('beforeinput', e => { if(e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph'){ e.preventDefault(); e.stopPropagation(); submitNow(e, 'beforeinput_' + e.inputType); } });
    inp.addEventListener('input', e => { if(inp && /\n/.test(String(inp.value || ''))){ if(e.preventDefault) e.preventDefault(); submitNow(e, 'input_newline'); } }); }
  function open(){ ui(); box.classList.add('on'); applyPos(); msg.textContent = AI.state === 'ready' ? 'AI matching on' + (chromeOk() ? ' · ✨ Chrome AI' : '') : (AI.state === 'loading' ? 'AI model loading… letter matching for now' : 'letter matching'); chips.textContent = ''; inp.value = ''; setTimeout(()=> inp.focus(), 0); }
  function close(){ if(box){ box.classList.remove('on'); inp.blur(); } }
  AI.open = open; AI.close = close;
  // v628 (Jesuye 1:36 PM "the panel closes by itself after i make my selections"):
  // typeline go() used to call close() 3.5s later. That local close() bypasses the
  // job_card hook on AI.close, so the [[god]] panel vanished after a typeline
  // submit (and after Send, if focus had left the typeline). With cards-on the
  // panel stays until the user closes it ([[god]] or Escape).
  function autoDismiss(){ if(box && box.classList.contains('cards-on')) return; if(box && box.classList.contains('on') && document.activeElement !== inp) close(); }
  function label(r){ return r.id.split('.')[0] + '.' + ((r.f && r.f.method) || r.id.split('.').slice(1).join('.')) + '()'; }
  function fire(r, how){ const S = ST(); if(!r.live || !S.fireFunc){ msg.textContent = label(r) + ' · ' + r.id.split('.')[0] + ' isn\'t on stage right now'; return null; }
    const {c, x} = r.live, name = (S.objName ? S.objName(c) : null) || r.id.split('.')[0];
    try{ S.fireFunc(c, name, x.it, 'intent'); }catch(e){ msg.textContent = 'could not run ' + label(r); return null; }
    const M = S.methods || {}, rec = (M.sent || [])[M.sent.length - 1]; if(rec) rec.intent = {why: how, typed: true};
    return {c, rec, id: 'f:' + x.it.t.title}; }
  async function go(text){
    ui();
    text = String(text || '').trim(); if(!text) return; pushTyped(text); ctxSig = ''; later(text);
    try{ msg.textContent = '\u2026'; }catch(e){}
    try{ chips.textContent = ''; }catch(e){}
    const S = ST();
    const showErr = (err) => {
      const why = String((err && (err.message || err.reason)) || err || 'parse_error');
      try{ if(S.enqueueRawCli) S.enqueueRawCli(text, why); }catch(e){}
      try{ msg.textContent = 'parse error \u00b7 ' + why + ' \u00b7 still sending raw'; }catch(e){}
      try{ const toast = (window.thrydCtx && window.thrydCtx().toast) || (()=>{}); toast(text + ' \u00b7 parse error \u00b7 ' + why + ' \u00b7 still sending raw'); }catch(e){}
      try{ inp.value = ''; }catch(e){}
    };
    const simpleCall = (s) => {
      s = String(s || '').trim().replace(/;+\s*$/, '');
      return /^#?[A-Za-z_][\w]*\s*\.\s*[A-Za-z_][\w]*\s*(?:\([^()]*\))?$/.test(s)
        || /^#?[A-Za-z_][\w]*\s+[A-Za-z_][\w]*(?:\s*\([^()]*\))?$/.test(s);
    };
    try{
      let parts;
      try{ parts = (S.splitCli ? S.splitCli(text) : [text]).filter(Boolean); }
      catch(e){ showErr(e); return; }
      const multi = parts.length > 1;
      const simple = !multi && parts[0] && simpleCall(parts[0]);
      if(simple){
        try{
          const R = await resolve(parts[0]), top = R.top;
          const exact = !!(top.length && !R.P.free && top[0].lex >= .999), conf = top.length ? top[0].s - (top[1] ? top[1].s : 0) : 0;
          if(top.length && (exact || (top[0].s >= .82 && conf >= .08 && top[0].live))){
            let evd = null;
            try{
              const run = (S.currentRun && S.currentRun()) || '';
              if(S.everydayImpl && S.parseCliPiece && run){
                evd = S.everydayImpl(run, S.parseCliPiece(parts[0]));
                if(evd) S._pendingFlesh = evd;
              }
            }catch(e){}
            const done = fire(top[0], exact ? 'typed' : 'did you mean (' + top[0].s.toFixed(2) + ')');
            S._pendingFlesh = null;
            if(done){ inp.value = ''; msg.textContent = (exact ? '' : 'did you mean ') + label(top[0]) + (exact ? ' \u00b7 ran' : '? \u00b7 applied')
              + (evd && evd.ranAs ? ' \u00b7 ran as: ' + evd.ranAs : '')
              + (evd && evd.result ? ' \u2192 ' + evd.result : '');
              if(!exact && ST().undoIntent){ const u = document.createElement('span'); u.className = 'aiu'; u.textContent = 'undo'; u.onclick = ()=>{ ST().undoIntent(done.c, done.rec, done.id); msg.textContent = 'undone'; }; msg.appendChild(u); }
              setTimeout(autoDismiss, 3500); }
            if(done) return; // fire() already started sendCall; otherwise fall through and send as a new typeline
          }
        }catch(e){ /* fall through and still accept / enqueue the raw typeline */ }
      }
      let recs = [];
      try{
        if(S.applyCliLine) recs = S.applyCliLine(text) || [];
        else recs = parts.map(p => S.applyFreeCmd && S.applyFreeCmd(p)).filter(Boolean);
      }catch(e){ showErr(e); return; }
      if((!recs || !recs.length) && text){
        try{ recs = S.enqueueRawCli ? [S.enqueueRawCli(text, 'no parsed command')] : []; }catch(e){ showErr(e); return; }
      }
      // Every typeline submit must end in a send (Jesuye 18 Nov 2026 1:15 PM ET): the
      // 'new command → this agenda' branch used to apply locally and could skip the post.
      try{
        (recs || []).forEach(r => { if(r && S.ensureCliSent) S.ensureCliSent(r); });
      }catch(e){ try{ if(S.enqueueRawCli) S.enqueueRawCli(text, e); }catch(e2){} }
      const rec = recs[0];
      const run = (rec && rec.run) || (S.currentRun && S.currentRun()) || (S.agenda && S.agenda.active) || '';
      const bad = recs.find(r => r && (r.parseError || r.parse_error));
      const fleshed = recs.find(r => r && r.fleshed && r.resolved && r.resolved !== r.raw) || recs.find(r => r && r.fleshed && r.resolved);
      const got = recs.find(r => r && r.result && !(fleshed && r === fleshed) && !(r.parseError || r.parse_error));
      const n = recs.length || parts.length || 1;
      if(bad){
        msg.textContent = 'parse error \u00b7 ' + (bad.parseError || bad.parse_error) + ' \u00b7 still sending raw'
          + (run ? ' \u00b7 ' + run : '');
      } else {
        msg.textContent = (n === 1 ? 'new command' : (n + ' commands')) + ' \u2192 this agenda' + (run ? ' \u00b7 ' + run : '')
          + (fleshed ? ' \u00b7 ran as: ' + fleshed.resolved : '')
          + (got ? ' \u2192 ' + got.result : '');
      }
      chips.textContent = ''; inp.value = '';
      setTimeout(autoDismiss, 3500);
    }catch(e){ showErr(e); }
  }
  AI.go = go; AI.submit = submitNow;
  function button(){ const bar = document.getElementById('modes'); if(!bar){ setTimeout(button, 1000); return; } if(document.getElementById('aicmd')) return;
    const b = document.createElement('button'); b.id = 'aicmd'; b.type = 'button'; b.textContent = '[[god]]'; b.title = '[[god]]'; b.setAttribute('aria-label', '[[god]]');
    b.addEventListener('click', e => { e.stopPropagation(); box && box.classList.contains('on') ? close() : open(); });
    const st = document.getElementById('smarttap'); if(st && st.parentNode === bar) bar.insertBefore(b, st.nextSibling); else bar.appendChild(b); }
  addEventListener('resize', ()=>{ applyPos(); });
  addEventListener('keydown', e => { const t = e.target; if(e.ctrlKey || e.metaKey || e.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
    if(e.key === '/'){ e.preventDefault(); open(); } });
  // stage only (index.html loads this after stage.js; ?slides=1 has no stage)
  if(!/(?:^|[?&])slides=1(?:&|$)/.test(Q)) button();

  // ---------- typed calls from the rooms that miss a real function: one quiet "≈ did you mean" line in #code (high confidence only)
  const said = new Set(); let lastSaid = 0;
  setInterval(async ()=>{ if(AI.state !== 'ready') return; const dl = root.__thrydDriftLines || []; const e = dl.find(l => l && /^typed \(no look yet\)/.test(l.note || '') && !said.has(l.t)); if(!e) return;
    said.add(e.t); const P = parse(e.t); if(P.free || /^thryd/i.test(P.obj) || OMF()[nk(P.obj) + '.' + nk(P.fn)]) return; if(Date.now() - lastSaid < 10000) return;
    const R = await resolve(e.t); const r = R.top[0]; if(!r || r.s < .82 || r.lex >= .999 || (R.top[1] && r.s - R.top[1].s < .08)) return; lastSaid = Date.now();
    dl.unshift({t: '\u2248 ' + label(r), a: true, note: 'did you mean (nearest real function to ' + e.t.replace(/;$/, '') + ')'}); if(dl.length > 8) dl.length = 8; }, 2500);

  AI.status = ()=> ({state: AI.state, why: AI.why, model: AI.model, loadMs: AI.ms, vectors: V.size, chrome: AI.chrome, context: !!(AI.state === 'ready' && context()), errors: AI.errors.slice()});
  if(NOAI) return;
  chromeCheck();
  // lazy: only after the page has loaded and gone idle (never blocks the first paint or the first cuts)
  // v610 memory/heat (Jesuye 24 Nov 2026 8:05 PM ET "this is too heavy"; 8:55 PM "stop overheating"): the model (~100 MB in the tab)
  // now loads the first time it can matter: the first tap, key or touch on the page, the typed-command box, or the first typed call
  // from the rooms that has no look yet (the "≈ did you mean" line). A wall nobody touches never pays for it; nothing else changes.
  const idle = f => (root.requestIdleCallback ? requestIdleCallback(f, {timeout: 20000}) : setTimeout(f, 2000));
  const NEED_EV = ['pointerdown', 'keydown', 'touchstart'];
  const kick = ()=>{ let went = false; const go = ()=>{ if(went) return; went = true; NEED_EV.forEach(ev => removeEventListener(ev, go, true)); clearInterval(AI.needT); idle(start); };
    AI.need = go; NEED_EV.forEach(ev => addEventListener(ev, go, {capture: true, passive: true}));
    AI.needT = setInterval(()=>{ if(AI.state !== 'waiting'){ clearInterval(AI.needT); return; } const dl = root.__thrydDriftLines || []; if(dl.some(l => l && /^typed \(no look yet\)/.test(l.note || ''))) go(); }, 2500); };
  if(document.readyState === 'complete') kick(); else addEventListener('load', kick, {once: true});
  // new functions published later get vectors too
  setInterval(()=>{ if(AI.state === 'ready') seedCorpus(); }, 300000);
})(typeof window !== 'undefined' ? window : globalThis);
