/* #thryd podcasts page (17 Nov 2026): episodes come from ../data/podcasts.json (one row per episode); the video files live on
   GitHub Releases. GitHub answers the download URL with a redirect to a byte-range-capable file, which <video> follows and
   streams; if inline playback still fails, the card shows the cover with a direct "watch / download" link instead. */
(function(){
  const $ = (t, cls, txt) => { const e = document.createElement(t); if(cls) e.className = cls; if(txt != null) e.textContent = txt; return e; };
  const main = document.getElementById('eps');
  const fmtDate = d => { try{ return new Date(d + 'T12:00:00').toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'}); }catch(e){ return d; } };
  const secs = s => { const p = String(s).split(':').map(Number); return p.reduce((a, b) => a * 60 + b, 0); };
  function inline(host, text, video){ // text with [m:ss] stamps that seek the episode; everything goes in as text, never HTML
    const re = /\[(\d{1,2}:\d{2})\]/g; let i = 0, m;
    while((m = re.exec(text))){ if(m.index > i) host.appendChild(document.createTextNode(text.slice(i, m.index)));
      const b = $('button', 'ts', m[1]); b.type = 'button'; b.title = 'Play from ' + m[1]; const at = secs(m[1]);
      b.addEventListener('click', () => { try{ video.currentTime = at; video.play().catch(()=>{}); video.scrollIntoView({behavior: 'smooth', block: 'center'}); }catch(e){} });
      host.appendChild(b); i = re.lastIndex; }
    if(i < text.length) host.appendChild(document.createTextNode(text.slice(i)));
  }
  function renderMd(md, box, video){
    box.textContent = ''; let q = null;
    md.split(/\r?\n/).forEach(raw => { const line = raw.replace(/\s+$/, '');
      if(!line.trim()){ q = null; return; }
      if(/^#\s/.test(line)) return; // the page title already says it
      if(/^##\s/.test(line)){ q = null; box.appendChild($('h3', '', line.replace(/^##\s*/, ''))); return; }
      if(/^>\s?/.test(line)){ if(!q){ q = $('blockquote'); box.appendChild(q); } else q.appendChild(document.createElement('br')); q.appendChild(document.createTextNode(line.replace(/^>\s?/, ''))); return; }
      q = null; const p = $('p'); const m = line.match(/^\*\*([^*]+)\*\*\s*(.*)$/);
      if(m){ p.appendChild($('span', 'who ' + m[1].replace(/\W/g, ''), m[1])); p.appendChild(document.createTextNode(' ')); inline(p, m[2], video); }
      else { p.className = 'info'; inline(p, line.replace(/\*\*/g, ''), video); }
      box.appendChild(p); });
  }
  const rel = u => !u ? '' : /^https?:/.test(u) ? u : '../' + u; // repo paths in the JSON are relative to the site root
  function player(ep){
    const wrap = $('div', 'player'); const v = $('video'); v.controls = true; v.preload = 'metadata'; v.playsInline = true; v.setAttribute('playsinline', '');
    v.poster = rel(ep.cover); const full = ep.video_release || rel(ep.video); v.setAttribute('aria-label', 'Episode: ' + ep.title); wrap.appendChild(v);
    const fb = $('div', 'fallback'); if(ep.cover) fb.style.backgroundImage = 'linear-gradient(#000a,#000a),url("' + encodeURI(rel(ep.cover)) + '")';
    fb.appendChild($('div', '', 'The episode could not stream here. Open it on GitHub instead.')); const a = $('a', '', '▶ open the episode (' + (ep.length || 'mp4') + ')'); a.href = full; a.rel = 'noopener'; a.target = '_blank'; fb.appendChild(a); wrap.appendChild(fb);
    v.addEventListener('error', () => { fb.classList.add('on'); wrap.dataset.fallback = '1'; });
    v.src = rel(ep.video); // same-origin web copy (video/mp4 + ranges, plays inline on iOS); the release is the full-quality link and the fallback
    return {wrap, v};
  }
  function card(ep){
    const art = $('article', 'ep' + (ep.featured ? ' featured' : '')); art.id = ep.id;
    const {wrap, v} = player(ep); art.appendChild(wrap);
    const b = $('div', 'body'); if(ep.featured) b.appendChild($('span', 'badge', 'featured'));
    b.appendChild($('h2', '', ep.title));
    const meta = $('div', 'meta'); meta.appendChild($('span', '', fmtDate(ep.date))); meta.appendChild($('span', '', '⏱ ' + (ep.length || ''))); if(ep.run) meta.appendChild($('span', '', ep.run)); b.appendChild(meta);
    const row = $('div', 'row'); const dl = $('a', 'btn', '⬇ full quality'); dl.title = 'Full-quality mp4 / download (GitHub Release)'; dl.href = ep.video_release || rel(ep.video); dl.rel = 'noopener'; row.appendChild(dl);
    if(ep.release){ const rl = $('a', 'btn', 'release'); rl.href = ep.release; rl.rel = 'noopener'; row.appendChild(rl); }
    const sh = $('button', 'btn', '🔗 link'); sh.type = 'button'; sh.addEventListener('click', () => { const u = location.href.split('#')[0] + '#' + ep.id; try{ navigator.clipboard.writeText(u); sh.textContent = '✓ copied'; setTimeout(() => sh.textContent = '🔗 link', 1600); }catch(e){ location.hash = ep.id; } }); row.appendChild(sh);
    b.appendChild(row);
    if(ep.teaser){ const t = $('div', 'teaser'); const tv = $('video'); tv.controls = true; tv.preload = 'metadata'; tv.playsInline = true; tv.setAttribute('playsinline', ''); tv.poster = rel(ep.cover); tv.setAttribute('aria-label', 'Teaser: ' + ep.title);
      const tp = $('p', '', 'Teaser · ' + (ep.teaser_length || '0:30') + ' · the quick version to share. '); t.appendChild(tv); t.appendChild(tp);
      tv.addEventListener('error', () => { if(tp.querySelector('a')) return; const ta = $('a', '', 'Open the teaser'); ta.href = ep.teaser_release || rel(ep.teaser); ta.rel = 'noopener'; ta.target = '_blank'; tp.appendChild(ta); t.dataset.fallback = '1'; });
      tv.src = rel(ep.teaser); /* listener first, so an early load error still shows the link */ b.appendChild(t); }
    if(ep.transcript){ const d = $('details', 'tr'); const s = $('summary', '', 'Transcript'); d.appendChild(s); const box = $('div', 'tx'); box.textContent = 'Loading…'; d.appendChild(box); let got = false;
      d.addEventListener('toggle', () => { if(!d.open || got) return; got = true;
        fetch('../' + ep.transcript + '?t=' + Date.now()).then(r => { if(!r.ok) throw new Error(r.status); return r.text(); }).then(md => renderMd(md, box, v)).catch(() => { got = false; box.textContent = 'Transcript could not load. Try again.'; }); });
      b.appendChild(d); }
    art.appendChild(b); return art;
  }
  fetch('../data/podcasts.json?t=' + Date.now()).then(r => r.json()).then(doc => {
    const eps = (doc.episodes || []).slice().sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || String(b.date).localeCompare(String(a.date)));
    main.textContent = ''; if(!eps.length){ main.appendChild($('p', 'note', 'No episodes yet.')); return; }
    eps.forEach(ep => main.appendChild(card(ep)));
    if(location.hash){ const el = document.getElementById(location.hash.slice(1)); if(el) el.scrollIntoView(); }
  }).catch(() => { main.textContent = ''; main.appendChild($('p', 'note', 'Episodes could not load. Refresh to try again.')); });
})();
