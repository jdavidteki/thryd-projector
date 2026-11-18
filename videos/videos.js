/* #thryd videos page (18 Nov 2026, Jesuye 2:48 PM ET "post them on my videos page on projector"): scene videos come from
   ../data/videos.json (one row per scene: run, j, story, place, video, added), written by /workspace/thryd-drag/publish_videos.sh.
   Newest first. Files live same-origin under videos/media/ (H.264, faststart) so <video playsinline> streams on phones/tablets. */
(function(){
  const $ = (t, cls, txt) => { const e = document.createElement(t); if(cls) e.className = cls; if(txt != null) e.textContent = txt; return e; };
  const main = document.getElementById('vids');
  const rel = u => !u ? '' : /^https?:/.test(u) ? u : '../' + u;
  const short = s => { s = String(s || '').replace(/\s+/g, ' ').trim(); if(s.length <= 220) return s;
    const cut = s.slice(0, 220); const i = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    return i > 80 ? cut.slice(0, i + 1) : cut.replace(/\s+\S*$/, '') + '…'; };
  const when = v => { const d = new Date(v.added || v.ts || 0); return isNaN(d) ? '' : d.toLocaleString(undefined, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'}); };
  function empty(){ main.textContent = ''; main.appendChild($('p', 'empty', 'no scenes yet')); }
  function card(v){
    const art = $('article', 'vid'); art.id = v.id || '';
    const el = $('video'); el.controls = true; el.preload = 'metadata'; el.playsInline = true; el.setAttribute('playsinline', '');
    el.src = rel(v.video); if(v.poster) el.poster = rel(v.poster); el.setAttribute('aria-label', 'Scene ' + (v.j || '') + ' · ' + (v.run || ''));
    art.appendChild(el);
    const b = $('div', 'body');
    b.appendChild($('h2', '', [v.j, v.place].filter(Boolean).join(' · ') || 'scene'));
    const m = $('div', 'meta'); [v.run, v.length, when(v)].filter(Boolean).forEach(x => m.appendChild($('span', '', x))); b.appendChild(m);
    const c = short(v.caption || v.story || v.place); if(c) b.appendChild($('p', 'cap', c));
    art.appendChild(b); return art;
  }
  fetch('../data/videos.json?t=' + Date.now(), {cache: 'no-store'}).then(r => r.ok ? r.json() : {videos: []}).catch(() => ({videos: []})).then(doc => {
    const vs = (doc && doc.videos || []).filter(v => v && v.video);
    vs.sort((a, b) => String(b.added || b.ts || '').localeCompare(String(a.added || a.ts || '')));
    if(!vs.length) return empty();
    main.textContent = ''; vs.forEach(v => main.appendChild(card(v)));
  });
})();
