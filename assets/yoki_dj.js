/* yoki DJ — restored original full-catalog shuffle (v538 extras.js bag, before v542 yoki_match).
   extras.js calls thrydYokiDJ.next() for the next africariyoki song. Picks are a Fisher–Yates
   shuffle of the full catalog in data/yoki_songs.json (same ids as the africariyoki songs API).
   No data/yoki_match.json, no mood or lyric ranking. The remaining bag and played history live
   in localStorage (thryd_yoki_bag) so a reload continues the shuffle instead of restarting it.
   When the bag is empty, a new shuffle is drawn (the last song is not immediately repeated). */
(function(root){
  'use strict';
  const KEY = 'thryd_yoki_bag';
  const DJ = root.thrydYokiDJ = {state: 'idle', mode: 'shuffle', why: null, errors: [], active: false};
  let songs = null, songsP = null, bag = [], played = [], last = null;

  function fy(arr){
    const a = arr.slice();
    const rnd = (n)=>{
      try{
        if(root.crypto && crypto.getRandomValues){
          const u = new Uint32Array(1); crypto.getRandomValues(u);
          return Math.floor(u[0] / 4294967296 * n);
        }
      }catch(e){}
      return Math.floor(Math.random() * n);
    };
    for(let i = a.length - 1; i > 0; i--){ const j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  function loadSongs(){
    if(songs) return Promise.resolve(songs);
    if(songsP) return songsP;
    songsP = fetch('data/yoki_songs.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : Promise.reject(new Error('yoki_songs ' + r.status))).then(d => {
      songs = (d.songs || []).map(s => ({id: s.id, t: s.t, a: s.a})).filter(s => s && s.id);
      if(!songs.length) throw new Error('empty catalog');
      restore();
      DJ.state = 'ok';
      return songs;
    }).catch(e => { songsP = null; DJ.errors.push(String(e && e.message || e)); DJ.state = 'error'; throw e; });
    return songsP;
  }

  function save(){
    try{ localStorage.setItem(KEY, JSON.stringify({bag, played, last, n: songs ? songs.length : 0})); }catch(e){}
  }
  function restore(){
    const ids = new Set(songs.map(s => s.id));
    try{
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if(!d || !Array.isArray(d.bag) || (d.n && Math.abs(d.n - songs.length) > 40)){ refill(); return; }
      bag = d.bag.filter(id => ids.has(id));
      played = Array.isArray(d.played) ? d.played.filter(id => ids.has(id)) : [];
      last = ids.has(d.last) ? d.last : null;
      if(!bag.length && !played.length) refill();
    }catch(e){ refill(); }
  }
  function refill(){
    const ids = songs.map(s => s.id);
    const pool = last && ids.length > 1 ? ids.filter(id => id !== last) : ids.slice();
    bag = fy(pool);
    played = [];
    save();
  }

  async function next(ok){
    await loadSongs();
    if(!bag.length) refill();
    const accept = typeof ok === 'function' ? ok : ()=> true;
    const skipped = [];
    let id = null;
    while(bag.length){
      const cand = bag.pop();
      if(accept(cand)){ id = cand; break; }
      skipped.push(cand);
    }
    if(skipped.length) bag = bag.concat(skipped.reverse());
    if(!id){
      refill();
      while(bag.length){
        const cand = bag.pop();
        if(accept(cand)){ id = cand; break; }
      }
    }
    if(!id) throw new Error('no song');
    last = id;
    played.push(id);
    save();
    const s = songs.find(x => x.id === id) || {id};
    DJ.state = 'ok'; DJ.mode = 'shuffle'; DJ.why = null;
    return {id: s.id, title: s.t, artist: s.a, why: null};
  }

  DJ.next = next;
  DJ.setActive = on => { DJ.active = !!on; };
  DJ.match = ()=> ({state: DJ.state, mode: 'shuffle', n: songs ? songs.length : 0, bag: bag.length, last, pending: false});
  DJ.recent = ()=> played.slice(-10);
})(typeof window !== 'undefined' ? window : globalThis);
