/* yoki DJ v6 — the story sings its own soundtrack (Jesuye 22 Nov 2026 3:15 PM EST, staffroom: "turn that feature back on ...
   the story should sing its own soundtrack"). v554 (17 Nov) had reverted yoki to a plain full-catalog shuffle; this turns the
   story-following pick back on, now from the CURRENT church story instead of the old 10-agenda pool:
   - story/yoki_pulse.json, rebuilt on the box after every seat (tools/story_yoki_pulse.py, run by story_edges_publish.sh): the open
     card's storyline, place, 📖 problem and d, the newest seated lines and their func_call consequences, ranked against every
     africariyoki lyric line (BM25). Top 60 candidates with scores and a why-line.
   - each next(): the best 8 candidates NOT in the last 40 played (localStorage thryd_yoki_recent) are picked with probability
     proportional to score (crypto random). A new job means a new pulse, so the next song follows it; the playing song is never cut.
   - missing/broken pulse, or nothing unplayed left in it: Fisher–Yates shuffle of the full catalog (data/yoki_songs.json), which
     also skips the last 40 played.
   extras.js still owns the sound choice: this file never plays anything by itself, so Off stays off. */
(function(root){
  'use strict';
  const KEY = 'thryd_yoki_bag', RKEY = 'thryd_yoki_recent', RECENT = 40, POOL = 8, PULSE_URL = 'story/yoki_pulse.json';
  const DJ = root.thrydYokiDJ = {state: 'idle', mode: 'pulse', why: null, errors: [], active: false, log: []};
  let songs = null, songsP = null, bag = [], last = null, pulse = null, pulseAt = 0;

  const rnd = (n)=>{ try{ if(root.crypto && crypto.getRandomValues){ const u = new Uint32Array(1); crypto.getRandomValues(u); return u[0] / 4294967296 * n; } }catch(e){} return Math.random() * n; };
  function fy(arr){ const a = arr.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd(i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function loadSongs(){
    if(songs) return Promise.resolve(songs);
    if(songsP) return songsP;
    songsP = fetch('data/yoki_songs.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : Promise.reject(new Error('yoki_songs ' + r.status))).then(d => {
      songs = (d.songs || []).map(s => ({id: s.id, t: s.t, a: s.a})).filter(s => s && s.id);
      if(!songs.length) throw new Error('empty catalog');
      restore(); DJ.state = 'ok'; return songs;
    }).catch(e => { songsP = null; DJ.errors.push(String(e && e.message || e)); DJ.state = 'error'; throw e; });
    return songsP;
  }
  function loadPulse(){
    if(pulse && Date.now() - pulseAt < 20000) return Promise.resolve(pulse);
    return fetch(PULSE_URL + '?t=' + Date.now(), {cache: 'no-store'}).then(r => r.ok ? r.json() : null).then(d => {
      if(d && Array.isArray(d.candidates) && d.candidates.length){ pulse = d; pulseAt = Date.now(); }
      return pulse;
    }).catch(()=> pulse);
  }
  const recent = ()=>{ try{ const r = JSON.parse(localStorage.getItem(RKEY) || '[]'); return Array.isArray(r) ? r : []; }catch(e){ return []; } };
  function remember(id){ const r = recent().filter(x => x !== id); r.push(id); try{ localStorage.setItem(RKEY, JSON.stringify(r.slice(-RECENT))); }catch(e){} }
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify({bag, last, n: songs ? songs.length : 0})); }catch(e){} }
  function restore(){
    const ids = new Set(songs.map(s => s.id));
    try{ const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if(!d || !Array.isArray(d.bag) || (d.n && Math.abs(d.n - songs.length) > 40)){ refill(); return; }
      bag = d.bag.filter(id => ids.has(id)); last = ids.has(d.last) ? d.last : null; if(!bag.length) refill();
    }catch(e){ refill(); }
  }
  function refill(){ const ids = songs.map(s => s.id); bag = fy(last && ids.length > 1 ? ids.filter(id => id !== last) : ids); save(); }

  function shuffle(accept, rec){
    for(let pass = 0; pass < 2; pass++){
      if(!bag.length) refill();
      const skipped = []; let id = null;
      while(bag.length){ const c = bag.pop(); if(accept(c) && !rec.has(c)){ id = c; break; } skipped.push(c); }
      if(skipped.length) bag = bag.concat(skipped.reverse());
      if(id) return id;
      bag = [];
    }
    return null;
  }

  async function next(ok){
    await loadSongs();
    const accept = typeof ok === 'function' ? ok : ()=> true;
    const rec = new Set(recent());
    const known = new Set(songs.map(s => s.id));
    const p = await loadPulse();
    let pick = null, why = null, mode = 'shuffle';
    if(p){
      const pool = p.candidates.filter(c => c && c.id && known.has(c.id) && !rec.has(c.id) && accept(c.id)).slice(0, POOL);
      const tot = pool.reduce((s, c) => s + Math.max(0.01, +c.score || 0), 0);
      let x = rnd(tot);
      for(const c of pool){ x -= Math.max(0.01, +c.score || 0); if(x <= 0){ pick = c; break; } }
      if(!pick && pool.length) pick = pool[pool.length - 1];
      if(pick){ mode = 'pulse'; why = {src: 'match', text: pick.why, line: pick.line, title: pick.title, job: p.job}; }
    }
    let id = pick ? pick.id : shuffle(accept, rec);
    if(!id){ id = shuffle(accept, new Set()); }
    if(!id) throw new Error('no song');
    last = id; remember(id); save();
    const s = songs.find(x => x.id === id) || {id};
    DJ.state = 'ok'; DJ.mode = mode; DJ.why = why;
    DJ.log.push({at: new Date().toISOString(), id, title: s.t, artist: s.a, mode, job: p && p.job, sig: p && p.sig,
      score: pick ? pick.score : null, rank: pick ? p.candidates.indexOf(pick) + 1 : null, why: why ? why.text : 'shuffle'});
    if(DJ.log.length > 300) DJ.log.shift();
    return {id: s.id, title: s.t, artist: s.a, why};
  }

  // the light pill under the lyrics: why this song, in story terms; stays while the song plays
  let note = null;
  const CSS = 'position:fixed;right:1.5vw;top:calc(7.4vh + 20px + max(10px,1.3vh)*1.5);max-width:min(46vw,560px);z-index:60;pointer-events:none;font-size:max(10px,1.15vh);line-height:1.35;color:#111;background:rgba(255,255,255,.78);border:0;border-radius:999px;padding:2px 10px;opacity:0;transition:opacity .8s ease;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  DJ.showWhy = function(w){ w = w || DJ.why; if(!w || !w.text || !document.body) return;
    if(!note){ note = document.createElement('div'); note.id = 'yoki_why'; document.body.appendChild(note); }
    note.style.cssText = CSS; note.textContent = w.text; note.title = w.text; requestAnimationFrame(()=>{ note.style.opacity = '1'; }); };
  DJ.hideWhy = ()=>{ if(note) note.style.opacity = '0'; };

  DJ.next = next;
  DJ.setActive = on => { DJ.active = !!on; if(!on) DJ.hideWhy(); };
  DJ.match = ()=> ({state: DJ.state, mode: DJ.mode, n: songs ? songs.length : 0, job: pulse && pulse.job, sig: pulse && pulse.sig, recent: recent().slice(-10)});
  DJ.recent = ()=> recent().slice(-10);
})(typeof window !== 'undefined' ? window : globalThis);
