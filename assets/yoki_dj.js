/* yoki DJ (Jesuye 17 Nov 2026 👍 "make the yoki station pick songs from the live agenda instead of shuffling at random").
   extras.js asks thrydYokiDJ.next() for the next africariyoki song; it answers with the best match to the live job:
   - context, all from data the 45 s loop already publishes: the active run (agenda_objects.json), its newest job scene and 📖 line
     (narrative_calls.json), the seated picks' tweets of its newest jobs (object_methods.json) and its last #thryd.importtheme()
     calls (commands.json; deepromance, eddiemurphy, ...). Read only; nothing is ever written or posted.
   - songs: data/yoki_songs.json, built on the box (tools/yoki_embed/build.mjs) with the same MiniLM model the intent layer runs
     (assets/intent_ai_worker.js): per song a centroid and 6 representative lyric-line vectors (int8) plus TF-IDF lyric terms.
   - score: when thrydIntentAI is ready the page embeds only the few short context texts (scene, theme, each seated tweet) and takes
     0.5 centroid + 0.5 best line per part, weighted theme .45 / scene .3 / tweets .25. Otherwise (?noai=1, weak device, model still
     loading) it scores TF-IDF lyric terms against the context words. Either way the why-note names the lyric line and the part it met.
   - no song repeats in a session (sessionStorage); ⏭ takes the next-best. When a new pick changes the context it re-ranks; a large mood
     shift (context similarity < .7) moves on after the current song has had 25 s, a small one only changes what plays next.
   Lyric match layer (v542, Jesuye 17 Nov 2026 3:24 PM ET "use the lyrics for the searching"): next() first reads data/yoki_match.json,
   the box's BM25 search over every africariyoki lyric line (tools/yoki_match.py in the 45 s export loop: #thryd's mood note for the live
   card, its scene and card lines, the seated lines, typed themes). When it is there and fresh (same active run, under 24 h old) songs
   play in its rank order, skipping the last 3 played; ⏭ = next by rank; a new ranking waits for the current song to end (no mood-shift
   cut); the why-line is a light pill under the lyrics ('♪ matched: “lyric” ↔ j31 blender line'). Missing/stale file or ?yokimatch=0:
   everything above, unchanged. */
(function(root){
  'use strict';
  const Q = new URLSearchParams(location.search), NOAI = Q.get('noai') === '1';
  const DJ = root.thrydYokiDJ = {state: 'idle', mode: '', ctx: null, why: null, errors: []};
  const D = 384, W = {theme: .45, scene: .3, tweet: .25}, POLL = 120000;
  const HINTS = {deepromance: 'deep romance, true love, my heart is yours, forever with you',
    eddiemurphy: 'comedy, funny jokes, laughing, playful teasing', romance: 'romance, love, my heart', comedy: 'comedy, funny, laughing'};
  const SYN = {romance: ['love', 'heart', 'darling', 'kiss', 'forever', 'lover', 'sweet', 'feel'], love: ['heart', 'lover', 'darling', 'forever'],
    comedy: ['laugh', 'funny', 'joke', 'play', 'crazy'], funny: ['laugh', 'joke', 'crazy'], song: ['sing', 'music', 'dance', 'tune'],
    night: ['tonight', 'night', 'party'], morning: ['sun', 'morning', 'wake'], bakery: ['bread', 'sweet'], answer: ['tell', 'know', 'question'],
    sea: ['ocean', 'water', 'beach'], beach: ['ocean', 'water', 'sea'], money: ['cash', 'money', 'rich', 'bills'], coffee: ['morning', 'wake']};
  const STOPW = new Set('the and for with from that this was were are has have had his her its into onto over than then them they their there what when where which while who will would your you she him our out all any but not can just like still same first second last away back been being very some more most only also even such into here near up'.split(' '));
  const PLAYED_K = 'thryd_yoki_played';
  let songs = null, songsP = null, vocab = null, ranked = [], rankSig = '', lastVec = null, lastKw = null, pollT = 0, active = false, busy = null;
  const played = new Set((()=>{ try{ return JSON.parse(sessionStorage.getItem(PLAYED_K) || '[]'); }catch(e){ return []; } })());
  const savePlayed = ()=>{ try{ sessionStorage.setItem(PLAYED_K, JSON.stringify([...played].slice(-500))); }catch(e){} };
  const getJ = u => fetch(u, {cache: 'no-cache'}).then(r => r.ok ? r.json() : null).catch(()=> null);
  const toks = s => (String(s || '').toLowerCase().match(/[a-z']{3,}/g) || []).map(w => w.replace(/'/g, '')).filter(w => w.length > 2 && !STOPW.has(w));
  const AI = ()=> (!NOAI && root.thrydIntentAI && root.thrydIntentAI.state === 'ready' && typeof root.thrydIntentAI.embed === 'function') ? root.thrydIntentAI : null;
  const clean = s => String(s || '').replace(/\[\[|\]\]/g, '').replace(/[()]/g, ' ').replace(/https?:\S+/g, '').replace(/\s+/g, ' ').trim();

  function loadSongs(){ if(songs) return Promise.resolve(songs); if(songsP) return songsP;
    songsP = fetch('data/yoki_songs.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : Promise.reject(new Error('yoki_songs ' + r.status))).then(d => {
      const sc = +d.scale || (0.35 / 127);
      songs = (d.songs || []).map(s => { const b = atob(s.v), q = new Int8Array(b.length); for(let i = 0; i < b.length; i++){ const c = b.charCodeAt(i); q[i] = c > 127 ? c - 256 : c; }
        return {id: s.id, t: s.t, a: s.a, l: s.l || [], all: s.all || s.l || [], k: s.k || {}, q, sc}; });
      vocab = new Set(); songs.forEach(s => Object.keys(s.k).forEach(w => vocab.add(w))); return songs; })
      .catch(e => { songsP = null; DJ.errors.push(String(e && e.message || e)); throw e; });
    return songsP; }

  // "deepromance" -> "deep romance" (hint table first, then a greedy split on English-ish words)
  function themeText(a){ const k = String(a || '').toLowerCase().replace(/[^a-z0-9]/g, ''); if(!k) return ''; if(HINTS[k]) return HINTS[k];
    const dict = w => w.length > 2 && (vocab && vocab.has(w) || SYN[w]); const out = []; let i = 0;
    while(i < k.length){ let j = k.length; for(; j > i + 2; j--) if(dict(k.slice(i, j))) break; if(j <= i + 2){ out.push(k.slice(i)); break; } out.push(k.slice(i, j)); i = j; }
    return out.join(' '); }

  // ---------- live job context (read only)
  async function context(){
    const [ao, nc, om, cm] = await Promise.all(['agenda_objects', 'narrative_calls', 'object_methods', 'commands'].map(f => getJ('data/' + f + '.json')));
    const run = (ao && ao.active_run) || (nc && nc.runs && nc.runs[0]) || ''; if(!run) return null;
    const num = j => +String(j || '').replace(/\D+/g, '') || 0;
    const jobs = (nc && nc.jobs && nc.jobs[run]) || []; const live = jobs.slice().sort((a, b) => b.n - a.n)[0] || null;
    const scene = live ? clean(String(live.scene || '').replace(/^[^\n]*·[^\n]*\n/, '')) : '';
    const book = ((nc && nc.calls) || []).filter(c => c.run === run).sort((a, b) => b.n - a.n)[0];
    const titles = []; Object.values((om && om.functions) || {}).forEach(f => (f.titles || []).forEach(t => { if(t.run === run) titles.push(t); }));
    titles.sort((a, b) => num(b.job) - num(a.job)); const top = titles.length ? num(titles[0].job) : 0;
    const tweets = []; titles.filter(t => num(t.job) >= top - 1).slice(0, 3).forEach(t => (t.tweets || []).forEach(x => { const s = clean(x.text); if(s.length > 8 && tweets.length < 8) tweets.push({text: s, title: t.title, job: t.job}); }));
    const themes = ((cm && cm.calls) || []).filter(c => c.run === run && c.fn === 'importtheme' && c.args && c.args[0] && !/^</.test(c.args[0])).slice(-2).map(c => c.args[0]);
    const themeLabel = themes.map(a => themeText(a).split(',')[0]).join(' + ');
    const theme = [themes.map(themeText).join('. '), book && book.sentence ? clean(book.sentence) : ''].filter(Boolean).join('. ');
    return {run, job: live && live.job, scene: scene.slice(0, 250), theme: theme.slice(0, 250), themes, themeLabel, book: book && book.sentence || '', tweets,
      sig: [run, live && live.job, scene, theme, tweets.map(t => t.text).join('|')].join('#')}; }

  // ---------- scoring
  const dotQ = (q, off, v, sc)=>{ let s = 0; for(let i = 0; i < D; i++) s += q[off + i] * v[i]; return s * sc; };
  function songVsVec(s, v){ const n = s.q.length / D; const c = dotQ(s.q, 0, v, s.sc); let ml = -2, li = 0;
    for(let j = 1; j < n; j++){ const x = dotQ(s.q, j * D, v, s.sc); if(x > ml){ ml = x; li = j - 1; } } return {sc: .5 * c + .5 * ml, ml, line: s.l[li] || ''}; }
  async function rankEmbed(c, ai){
    const tw = c.tweets.map(t => t.text); const texts = [c.scene, c.theme, ...tw].map(t => t || 'song');
    const vs = await ai.embed(texts); if(!vs || vs.some(v => !v)) return null;
    const [sv, tv, ...wv] = vs; const all = new Float32Array(D); [sv, tv, ...wv].forEach((v, i) => { const w = i === 0 ? W.scene : i === 1 ? W.theme : W.tweet / Math.max(1, wv.length); for(let k = 0; k < D; k++) all[k] += w * v[k]; });
    const out = songs.map(s => { const a = songVsVec(s, sv), b = songVsVec(s, tv); let best = null;
      wv.forEach((v, i) => { const r = songVsVec(s, v); if(!best || r.sc > best.sc){ best = r; best.tw = c.tweets[i]; } });
      const parts = [{k: 'theme', r: b, w: W.theme}, {k: 'scene', r: a, w: W.scene}]; if(best) parts.push({k: 'tweet', r: best, w: W.tweet});
      const score = parts.reduce((x, p) => x + p.w * p.r.sc, 0) / parts.reduce((x, p) => x + p.w, 0);
      const top = parts.slice().sort((x, y) => (y.w * y.r.ml) - (x.w * x.r.ml))[0];
      return {s, score, why: {line: top.r.line, part: top.k, tweet: top.k === 'tweet' ? best.tw : null}}; });
    return {list: out, vec: all}; }
  function rankKw(c){
    const exp = ws => { const o = []; ws.forEach(w => { o.push([w, 1]); (SYN[w] || []).forEach(x => o.push([x, .6])); }); return o; };
    const parts = [{k: 'theme', w: W.theme, t: exp(toks(c.theme))}, {k: 'scene', w: W.scene, t: exp(toks(c.scene))}];
    c.tweets.forEach(t => parts.push({k: 'tweet', w: W.tweet / Math.max(1, c.tweets.length), t: exp(toks(t.text)), tw: t}));
    const out = songs.map(s => { let score = 0, bestP = null, bestV = 0;
      parts.forEach(p => { let v = 0; p.t.forEach(([w, f]) => { if(s.k[w]) v += f * s.k[w]; }); v = v / Math.sqrt(p.t.length + 4); score += p.w * v; if(p.w * v > bestV){ bestV = p.w * v; bestP = p; } });
      let line = s.l[0] || '';
      if(bestP){ const set = new Set(bestP.t.map(x => x[0])); let bl = -1; s.all.forEach(l => { const n = toks(l).filter(w => set.has(w)).length; if(n > bl){ bl = n; line = l; } }); }
      return {s, score, why: {line, part: bestP ? bestP.k : 'theme', tweet: bestP && bestP.tw || null}}; });
    const kw = new Set(); parts.forEach(p => p.t.forEach(x => kw.add(x[0]))); return {list: out, kw}; }
  const jac = (a, b)=>{ if(!a || !b) return 1; let n = 0; a.forEach(x => { if(b.has(x)) n++; }); return n / Math.max(1, a.size + b.size - n); };

  // re-rank when the context changes; returns {shift} (true when the mood moved a lot)
  async function refresh(){ if(busy) return busy;
    busy = (async ()=>{ await loadSongs(); const c = await context(); if(!c) return {shift: false};
      const ai = AI(), m = ai ? 'embed' : 'keywords'; const sig = m + '#' + c.sig; if(sig === rankSig && ranked.length) return {shift: false};
      let shift = false, r = null;
      if(ai){ try{ r = await rankEmbed(c, ai); }catch(e){ DJ.errors.push(String(e && e.message || e)); r = null; } }
      if(r && r.vec){ if(lastVec && rankSig.split('#')[0] === 'embed'){ let s = 0, na = 0, nb = 0; for(let i = 0; i < D; i++){ s += r.vec[i] * lastVec[i]; na += r.vec[i] ** 2; nb += lastVec[i] ** 2; } shift = s / Math.sqrt(na * nb || 1) < .7; } lastVec = r.vec; DJ.mode = 'embed'; }
      else { r = rankKw(c); if(lastKw && rankSig && rankSig.split('#')[2] !== c.sig.split('#')[1]) shift = jac(lastKw, r.kw) < .15; lastKw = r.kw; DJ.mode = 'keywords'; }
      const changedJob = rankSig && rankSig.split('#').slice(1, 3).join('#') !== [c.run, c.job].join('#');
      ranked = r.list.sort((a, b) => b.score - a.score); rankSig = (r.vec ? 'embed' : 'keywords') + '#' + c.sig; DJ.ctx = c; DJ.state = 'ready';
      return {shift: shift && !!changedJob}; })().finally(()=>{ busy = null; });
    return busy; }

  // next(exclude): best unplayed song that extras.js can play (has: id -> true)
  DJ.next = async function(has){ let lm = null; try{ lm = await loadMatch(); }catch(e){ lm = null; }
    if(lm){ const r = nextMatched(has); if(r) return r; }
    try{ await refresh(); }catch(e){ DJ.state = 'fallback'; return null; }
    let pool = ranked.filter(r => (!has || has(r.s.id)) && !played.has(r.s.id));
    if(!pool.length){ played.clear(); savePlayed(); pool = ranked.filter(r => !has || has(r.s.id)); }
    const r = pool[0]; if(!r) return null; played.add(r.s.id); savePlayed(); DJ.why = {id: r.s.id, title: r.s.t, artist: r.s.a, score: +r.score.toFixed(3), mode: DJ.mode, ...r.why, ctx: {run: DJ.ctx.run, job: DJ.ctx.job, theme: DJ.ctx.themeLabel}};
    return {id: r.s.id, why: DJ.why}; };
  DJ.queue = (n)=> match ? match.top.slice(0, n || 5).map(x => ({title: x.title, artist: x.artist, score: x.score, line: x.matches && x.matches[0] && x.matches[0].line, part: 'lyrics'})) : ranked.filter(r => !played.has(r.s.id)).slice(0, n || 5).map(r => ({title: r.s.t, artist: r.s.a, score: +r.score.toFixed(3), line: r.why.line, part: r.why.part}));
  DJ.played = ()=> [...played];

  // ---------- lyric match layer (data/yoki_match.json)
  const NOMATCH = Q.get('yokimatch') === '0', RECENT_K = 'thryd_yoki_recent', MATCH_MAX_AGE = 24 * 3600e3;
  let match = null, matchSig = '', matchNew = false, mLast = null;
  let recent = (()=>{ try{ const r = JSON.parse(localStorage.getItem(RECENT_K) || '[]'); return Array.isArray(r) ? r.slice(-3) : []; }catch(e){ return []; } })();
  const remember = id => { recent = recent.filter(x => x !== id); recent.push(id); recent = recent.slice(-3); try{ localStorage.setItem(RECENT_K, JSON.stringify(recent)); }catch(e){} };
  DJ.matchState = NOMATCH ? 'off' : 'unread';
  async function loadMatch(){ if(NOMATCH){ match = null; return null; }
    const [m, ao] = await Promise.all([getJ('data/yoki_match.json?_=' + Date.now()), getJ('data/agenda_objects.json')]);
    const top = (m && Array.isArray(m.top) ? m.top : []).filter(x => x && x.id);
    const run = ao && ao.active_run, gen = m && Date.parse(m.generated || '');
    const stale = !top.length || (run && m.run && run !== m.run) || (gen && Date.now() - gen > MATCH_MAX_AGE);
    if(stale){ match = null; DJ.matchState = top.length ? 'stale' : 'missing'; return null; }
    const sig = String(m.sig || top.map(x => x.id).join(','));
    if(sig !== matchSig){ if(matchSig) matchNew = true; matchSig = sig; }
    match = {job: m.job, run: m.run, sig, top}; DJ.matchState = 'ok'; return match; }
  function nextMatched(has){ if(!match) return null; const L = match.top.filter(x => !has || has(x.id)); if(!L.length) return null;
    const s0 = matchNew ? 0 : Math.max(0, L.findIndex(x => x.id === mLast) + 1); matchNew = false;
    let x = null; for(let k = 0; k < L.length; k++){ const c = L[(s0 + k) % L.length]; if(recent.indexOf(c.id) < 0){ x = c; break; } }
    x = x || L[s0 % L.length]; mLast = x.id; remember(x.id); played.add(x.id); savePlayed();
    const m0 = (x.matches && x.matches[0]) || {};
    DJ.mode = 'lyrics'; DJ.why = {src: 'match', id: x.id, title: x.title, artist: x.artist, score: x.score, rank: x.rank, text: x.why || '', line: m0.line || '', term: m0.term || '', via: m0.via || '', mode: 'lyrics', ctx: {run: match.run, job: match.job}};
    return {id: x.id, why: DJ.why}; }
  DJ.match = ()=> ({state: DJ.matchState, job: match && match.job, sig: matchSig, n: match ? match.top.length : 0, pending: matchNew, last: mLast, recent: recent.slice()});
  DJ.reloadMatch = ()=> loadMatch().then(()=> DJ.match());

  // ---------- the fading why-note
  let note = null, noteT = 0;
  const DARK_CSS = 'position:fixed;right:12px;top:calc(7.4vh + 34px);max-width:min(46vw,520px);z-index:60;pointer-events:none;font-size:max(11px,1.35vh);line-height:1.35;color:#ddd;background:#000b;border:1px solid #444;border-radius:.4em;padding:.35em .6em;opacity:0;transition:opacity 1.2s ease;text-align:right';
  const MATCH_CSS = 'position:fixed;right:1.5vw;top:calc(7.4vh + 20px + max(10px,1.3vh)*1.5);max-width:min(46vw,560px);z-index:60;pointer-events:none;font-size:max(10px,1.15vh);line-height:1.35;color:#111;background:rgba(255,255,255,.78);border:0;border-radius:999px;padding:2px 10px;opacity:0;transition:opacity .8s ease;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  DJ.showWhy = function(w){ w = w || DJ.why; if(!w || !document.body) return;
    if(!note){ note = document.createElement('div'); note.id = 'yoki_why'; document.body.appendChild(note); }
    if(w.src === 'match'){ // light pill under the lyrics, stays while the song plays
      note.style.cssText = MATCH_CSS; note.textContent = w.text || ('♪ matched: “' + (w.line || w.title) + '”'); note.title = note.textContent;
      if(noteT){ clearTimeout(noteT); noteT = 0; } requestAnimationFrame(()=>{ note.style.opacity = '1'; }); return; }
    note.style.cssText = DARK_CSS;
    const met = w.part === 'tweet' && w.tweet ? '«' + w.tweet.text.slice(0, 90) + (w.tweet.text.length > 90 ? '…' : '') + '» (' + (w.tweet.title || w.tweet.job) + ')'
      : w.part === 'theme' ? 'theme: ' + ((w.ctx && w.ctx.theme) || 'the 📖 line') : 'the ' + ((w.ctx && w.ctx.job) || 'live job') + ' scene';
    note.textContent = '';
    const a = document.createElement('div'); a.textContent = 'why this song: «' + (w.line || w.title) + '»'; const b = document.createElement('div'); b.style.opacity = '.75'; b.textContent = 'met ' + met + (w.mode === 'keywords' ? ' · word match' : '');
    note.appendChild(a); note.appendChild(b); requestAnimationFrame(()=>{ note.style.opacity = '1'; });
    if(noteT) clearTimeout(noteT); noteT = setTimeout(()=>{ note.style.opacity = '0'; }, 9000); };
  DJ.hideWhy = ()=>{ if(note) note.style.opacity = '0'; };

  // ---------- polling while yoki plays; onShift is set by extras.js
  DJ.setActive = function(on){ on = !!on; if(on === active) return; active = on;
    if(pollT){ clearInterval(pollT); pollT = 0; } if(!on){ DJ.hideWhy(); return; }
    pollT = setInterval(()=>{ if(!active || document.hidden) return; loadMatch().catch(()=> null).then(m => m ? null : refresh().then(r => { if(r && r.shift && !match && DJ.onShift) DJ.onShift(); })).catch(()=>{}); }, POLL); };
  // once the model becomes ready, re-rank with embeddings (no cut, just the queue)
  let aiSeen = false; setInterval(()=>{ if(!aiSeen && AI() && active){ aiSeen = true; rankSig = ''; refresh().catch(()=>{}); } }, 15000);
})(typeof window !== 'undefined' ? window : globalThis);
