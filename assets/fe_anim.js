/* fe_anim.js — v639
   Free, in-browser image-to-video for the 20 pilot stills in data/anim_cuts.json.
   When the page is idle and a candidate has no saved anim yet, one cut at a time is
   sent to the public Lightricks/ltx-video-distilled Space via @gradio/client (CDN).
   Never uses Grok / paid APIs. Quota and network errors back off silently.
   A tiny panel pill reports progress; nothing is posted to chat.
   On success the clip is shown in place of the still and POSTed to intake /anim_cut
   (via the existing ntfy drag topic as a file attachment + a small JSON caption)
   so it can be saved once for every viewer.
*/
(function(root){
  'use strict';
  if(/(?:^|[?&])feanim=0(?:&|$)/.test(String(location.search||''))) return;
  if(/(?:^|[?&])slides=1(?:&|$)/.test(String(location.search||''))) return;

  const SPACE = 'Lightricks/ltx-video-distilled';
  const ENDPOINT = '/image_to_video';
  const CLIENT_URL = 'https://cdn.jsdelivr.net/npm/@gradio/client@1.19.0/+esm';
  const NEG = 'worst quality, inconsistent motion, blurry, jittery, distorted, camera move, zoom, pan, cut, morphing, extra limbs';
  const STATE_KEY = 'thryd_feanim_v639';
  const GREY = 128, TOL = 28;
  const MAXF = 10;
  const IDLE_MS = 8000;
  const POLL_MS = 120000;

  const Q = { catalog: null, at: 0, busy: false, timer: 0, client: null, nDone: 0, nTotal: 20, current: null, fails: {} };
  function Stage(){ return root.ThrydStage || root.__thrydStage || null; }

  function hidden(){ try{ if(document.hidden) return true; if(root.LH && root.LH.state === 'hidden') return true; }catch(e){} return false; }
  function dragging(){ try{ const b=document.body; return !!(b && (b.classList.contains('dragmode') || document.querySelector('[data-dragging="1"],#objs .dob.lifting'))); }catch(e){ return false; } }
  function idle(){
    if(hidden() || dragging()) return false;
    try{ if(root.LH && typeof root.LH.lastInput === 'number' && Date.now() - root.LH.lastInput < IDLE_MS) return false; }catch(e){}
    return true;
  }
  function loadState(){ try{ return JSON.parse(localStorage.getItem(STATE_KEY) || '{}') || {}; }catch(e){ return {}; } }
  function saveState(s){ try{ localStorage.setItem(STATE_KEY, JSON.stringify(s)); }catch(e){} }

  function pill(text, on){
    let el = document.getElementById('aianimpill');
    const box = document.getElementById('aibox') || document.getElementById('aicard');
    if(!on || !text){ if(el) el.remove(); return; }
    if(!el){
      el = document.createElement('div'); el.id = 'aianimpill'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
      el.style.cssText = 'flex:0 0 auto;align-self:flex-start;margin:6px 12px 0;display:inline-flex;align-items:center;gap:7px;font:600 11.5px/1.3 ui-sans-serif,system-ui,sans-serif;color:#ffd76a;padding:5px 11px;border-radius:999px;background:rgba(255,215,106,.08);border:1px dashed rgba(255,215,106,.4);max-width:calc(100% - 24px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;';
      if(box){
        const menu = document.getElementById('aimenu');
        if(menu && menu.parentNode === box) box.insertBefore(el, menu);
        else box.appendChild(el);
      } else {
        el.style.position = 'fixed'; el.style.left = '12px'; el.style.bottom = '72px'; el.style.zIndex = '10070';
        document.body.appendChild(el);
      }
    }
    el.textContent = text;
  }
  function pillText(){
    if(!Q.current) return '';
    const i = Q.nDone + 1;
    return '\u{1F39E}\uFE0F animating cut ' + i + '/' + Q.nTotal;
  }

  function fetchCatalog(force){
    if(!force && Q.catalog && Date.now() - Q.at < 20000) return Promise.resolve(Q.catalog);
    return fetch('data/anim_cuts.json?t=' + Date.now(), {cache: 'no-store'}).then(r => r.ok ? r.json() : null).then(d => {
      if(d){ Q.catalog = d; Q.at = Date.now(); Q.nTotal = (d.candidates || []).length || 20; Q.nDone = (d.cuts || []).filter(c => c && (c.anim || c.webp)).length; }
      return Q.catalog;
    }).catch(() => Q.catalog);
  }
  function hasAnim(cat, rec){
    const mid = rec.medium_image_id, lab = rec.cut;
    return (cat.cuts || []).some(c => c && (c.anim || c.webp) && c.medium_image_id === mid && (c.cut || c.label) === lab);
  }
  function nextCandidate(cat){
    const st = loadState();
    const now = Date.now();
    const list = (cat && cat.candidates) || [];
    Q.nTotal = list.length || 20;
    Q.nDone = list.filter(r => hasAnim(cat, r)).length;
    for(const rec of list){
      if(hasAnim(cat, rec)) continue;
      const f = (st.fails || {})[rec.cut_id];
      if(f && f.until && f.until > now) continue;
      if(st.tried && st.tried[rec.cut_id] === 'ok') continue;
      return rec;
    }
    return null;
  }
  function markFail(id, err){
    const st = loadState(); st.fails = st.fails || {};
    const n = ((st.fails[id] && st.fails[id].n) || 0) + 1;
    const quota = /quota|ZeroGPU|runs limit|429|rate/i.test(String(err || ''));
    const ms = quota ? Math.min(30 * 60 * 1000, 5 * 60 * 1000 * n) : Math.min(15 * 60 * 1000, 30 * 1000 * Math.pow(2, Math.min(n - 1, 6)));
    st.fails[id] = {n, until: Date.now() + ms, at: Date.now()};
    // a quota error backs off the whole queue, not just this cut
    if(quota) st.holdUntil = Date.now() + Math.min(30 * 60 * 1000, 5 * 60 * 1000 * n);
    saveState(st);
  }
  function markOk(id){
    const st = loadState(); st.tried = st.tried || {}; st.tried[id] = 'ok';
    if(st.fails) delete st.fails[id];
    saveState(st);
  }

  function loadClient(){
    if(Q.client) return Promise.resolve(Q.client);
    return import(CLIENT_URL).then(mod => {
      const Client = mod.Client || (mod.default && mod.default.Client) || mod.default;
      if(!Client || !Client.connect) throw new Error('no_client');
      return Client.connect(SPACE);
    }).then(c => { Q.client = c; return c; });
  }

  function fileFromPng(rec){
    return fetch(rec.png, {cache: 'force-cache'}).then(r => { if(!r.ok) throw new Error('png_' + r.status); return r.blob(); })
      .then(b => new File([b], rec.cut_id + '.png', {type: b.type || 'image/png'}));
  }
  function videoUrlOf(result){
    const walk = (x, n) => {
      if(!x || n > 6) return null;
      if(typeof x === 'string' && /^https?:\/\//.test(x) && /\.(mp4|webm|gif)(\?|$)/i.test(x)) return x;
      if(typeof x === 'string' && /^https?:\/\//.test(x) && /hf\.space|huggingface/.test(x)) return x;
      if(Array.isArray(x)){ for(const y of x){ const u = walk(y, n + 1); if(u) return u; } return null; }
      if(typeof x === 'object'){
        for(const k of ['video', 'url', 'path', 'name', 'data', 'value']){
          if(k in x){ const u = walk(x[k], n + 1); if(u) return u; }
        }
        for(const v of Object.values(x)){ const u = walk(v, n + 1); if(u) return u; }
      }
      return null;
    };
    return walk(result, 0);
  }

  async function predict(client, rec, file){
    const size = rec.i2v_size || [512, 512];
    const W = +size[0] || 512, H = +size[1] || 512;
    const params = {
      prompt: rec.prompt,
      negative_prompt: NEG,
      input_image_filepath: file,
      input_video_filepath: null,
      height_ui: H,
      width_ui: W,
      mode: 'image-to-video',
      duration_ui: 2,
      ui_frames_to_use: 9,
      seed_ui: 42,
      randomize_seed: false,
      ui_guidance_scale: 1,
      improve_texture_flag: true
    };
    let result;
    try{ result = await client.predict(ENDPOINT, params); }
    catch(e){
      // positional fallback for older client shapes
      result = await client.predict(ENDPOINT, [
        rec.prompt, NEG, file, null, H, W, 'image-to-video', 2, 9, 42, false, 1, true
      ]);
    }
    const url = videoUrlOf(result);
    if(!url) throw new Error('no_video');
    const res = await fetch(url);
    if(!res.ok) throw new Error('video_http_' + res.status);
    const blob = await res.blob();
    if(!blob || blob.size < 1000) throw new Error('video_empty');
    if(blob.size > 2000000) throw new Error('video_too_large');
    return blob;
  }

  function chromaKey(ctx, w, h){
    const im = ctx.getImageData(0, 0, w, h), d = im.data;
    for(let i = 0; i < d.length; i += 4){
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const dist = Math.max(Math.abs(r - GREY), Math.abs(g - GREY), Math.abs(b - GREY));
      const neut = Math.max(r, g, b) - Math.min(r, g, b) <= 12;
      if(dist <= TOL && neut) d[i + 3] = 0;
    }
    ctx.putImageData(im, 0, 0);
  }
  function sampleVideo(blob, maxF, dw, dh){
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
      const fail = (e) => { try{ URL.revokeObjectURL(url); }catch(x){} reject(e || new Error('video_decode')); };
      v.onerror = () => fail(new Error('video_el'));
      v.onloadedmetadata = () => {
        const dur = v.duration || 1;
        const n = Math.max(2, Math.min(maxF || MAXF, 10));
        const c = document.createElement('canvas');
        const tw = dw || v.videoWidth || 256, th = dh || v.videoHeight || 256;
        c.width = tw; c.height = th;
        const ctx = c.getContext('2d', {willReadFrequently: true});
        const frames = [], delays = [];
        let i = 0;
        const take = () => {
          const t = (i / (n - 1)) * Math.max(0, dur - 0.04);
          const onSeek = () => {
            v.removeEventListener('seeked', onSeek);
            try{
              ctx.clearRect(0, 0, tw, th);
              ctx.drawImage(v, 0, 0, tw, th);
              chromaKey(ctx, tw, th);
              frames.push(c.toDataURL('image/png'));
              delays.push(Math.max(40, Math.round(1000 / 8)));
            }catch(e){ return fail(e); }
            i++;
            if(i >= n){ try{ URL.revokeObjectURL(url); v.src = ''; }catch(e){} resolve({frames, delays, w: tw, h: th}); }
            else take();
          };
          v.addEventListener('seeked', onSeek);
          try{ v.currentTime = t; }catch(e){ fail(e); }
        };
        take();
      };
    });
  }
  async function bitmapsOf(sampled){
    const out = [];
    for(const u of sampled.frames){
      const im = new Image();
      await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = u; });
      const c = document.createElement('canvas'); c.width = sampled.w; c.height = sampled.h;
      c.getContext('2d').drawImage(im, 0, 0);
      if(root.createImageBitmap) out.push(await createImageBitmap(c));
      else out.push(c);
    }
    return {frames: out, delays: sampled.delays};
  }
  function showOnStage(rec, sampled){
    const st = Stage();
    if(!st || !st.applyLiveAnim) return Promise.resolve();
    return bitmapsOf(sampled).then(b => {
      try{ st.applyLiveAnim(rec.medium_image_id, rec.cut, b.frames, b.delays); }catch(e){}
    }).catch(()=>{});
  }

  function upload(rec, blob){
    const post = root.thrydNtfyPost || root.thrydSimplePost;
    const DG = root.DRAG || null;
    const payload = {v: 1, type: 'anim_cut', event_id: 'anim-' + rec.cut_id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24) + '-' + Date.now().toString(36),
      cut_id: rec.cut_id, medium_image_id: rec.medium_image_id, cut: rec.cut, bytes: blob.size, mime: blob.type || 'video/mp4', source: 'projector-feanim'};
    // Prefer a file attachment on the drag topic (ntfy 15 MiB cap). Caption is the small JSON.
    const endpoint = DG && DG.endpoint;
    if(endpoint && DG.transport === 'ntfy'){
      const rid = payload.event_id + '-r';
      return fetch(endpoint, {
        method: 'POST',
        headers: {
          'Filename': rec.cut_id + '.mp4',
          'Title': 'anim_cut',
          'Message': JSON.stringify(Object.assign({rid}, payload)),
          'Content-Type': blob.type || 'application/octet-stream'
        },
        body: blob
      }).then(r => ({ok: r.ok, status: r.status}));
    }
    if(typeof post === 'function'){
      // last resort: a tiny pointer only (no bytes) — the server cannot save the clip this way
      return post(payload, 'anim_cut').then(r => r || {ok: false});
    }
    return Promise.resolve({ok: false, status: 'no_endpoint'});
  }

  function schedule(ms){
    if(Q.timer) clearTimeout(Q.timer);
    const wait = Math.max(1500, ms || 4000);
    const kick = () => { Q.timer = 0; tick(); };
    Q.timer = (root.LH && root.LH.keep) ? 0 : setTimeout(kick, wait);
    if(root.LH && root.LH.keep && !Q._keep){ Q._keep = true; root.LH.keep(() => { if(!Q.timer && !Q.busy) tick(); }, 4000); }
    else if(!(root.LH && root.LH.keep)) Q.timer = setTimeout(kick, wait);
  }

  function tick(){
    if(Q.busy) return;
    const st = loadState();
    if(st.holdUntil && st.holdUntil > Date.now()){ pill('', false); return; }
    if(!idle()) return;
    Q.busy = true;
    fetchCatalog(true).then(cat => {
      if(!cat){ Q.busy = false; return; }
      const rec = nextCandidate(cat);
      if(!rec){ Q.busy = false; pill('', false); return; }
      Q.current = rec;
      pill(pillText(), true);
      return loadClient().then(client => fileFromPng(rec).then(file => predict(client, rec, file)))
        .then(blob => sampleVideo(blob, MAXF, (rec.display_size||[])[0], (rec.display_size||[])[1])
          .then(sampled => showOnStage(rec, sampled).then(() => blob)))
        .then(blob => upload(rec, blob).then(r => {
          markOk(rec.cut_id);
          Q.nDone = Math.min(Q.nTotal, Q.nDone + 1);
          Q.current = null;
          pill(Q.nDone >= Q.nTotal ? '' : pillText(), Q.nDone < Q.nTotal && false);
          const st = Stage(); if(st && st.loadAnimCatalog) try{ st.loadAnimCatalog(); }catch(e){}
          return r;
        }));
    }).catch(err => {
      try{ markFail(Q.current && Q.current.cut_id || 'queue', err && (err.message || err)); }catch(e){}
      Q.current = null;
      pill('', false);
    }).then(() => { Q.busy = false; schedule(6000); });
  }

  // Public hook used by tests and the stage.
  root.thrydFeAnim = {
    space: SPACE, endpoint: ENDPOINT, nextCandidate, hasAnim, videoUrlOf, chromaKey, markFail, markOk, loadState, pill, pillText,
    start: () => schedule(IDLE_MS), tick
  };

  document.addEventListener('visibilitychange', () => { if(!document.hidden) schedule(IDLE_MS); });
  if(document.readyState === 'complete') schedule(IDLE_MS);
  else addEventListener('load', () => schedule(IDLE_MS), {once: true});
  // refresh the catalog occasionally so other viewers pick up a saved GIF (data-only, no page reload)
  (root.LH && root.LH.poll ? root.LH.poll : setInterval)(() => { fetchCatalog(true).then(cat => {
    if(cat){ const st = Stage(); if(st && st.loadAnimCatalog) try{ st.loadAnimCatalog(); }catch(e){} }
  }); }, POLL_MS);
})(window);
