// ?stage=1 only (Jesuye 11-12 10:34 PM): instead of sliding through frames, one giant shared stage. Groups of cuts from
// the same Medium/X scene come in from the edges at random, staggered times, live there a while (idle float, wander,
// cross-story visitors, drag) and leave again, so several stories overlap. The camera drifts slowly across the stage.
// Pixels: only the existing cuts (exact source frames + their masks) and a faded, hole-filled copy of the same frame behind
// each group. Nothing generated, no blur on faces. Engine link unchanged: drags dispatch 'thryd:cutmove' and automatic trips go
// through window.thrydDrift, exactly like assets/medium_cuts.js. Tweets: frame_feed.js asks window.thrydStageFocus() for the
// story group in focus (same quiet/no-repeat/cooldown rules). Production default since 11-12 11:16 PM ("merge to production"):
// index.html loads this file unless ?slides=1 (the old slideshow, kept as the fallback). phone.html never loads it.
// REPLAY (and a ?mode=replay link) hands the screen back to the classic single-scene view; LIVE returns to the stage.
(function(root){
  if(typeof document === 'undefined' || typeof location === 'undefined') return;
  if(/(?:^|[?&])slides=1(?:&|$)/.test(location.search) || /phone\.html$/.test(location.pathname)) return;
  const MC = root.ThrydMediumCuts;
  if(!MC || !MC.createGifDecoder) return;

  const S = root.__thrydStage = {on:true, hold:true, groups:[], cuts:[], bytes:0, loading:0, near:null, spawned:0, left:0, fails:0, recent:[], bad:new Set(), log:[], maxSeen:0};
  const note = (...a)=>{ S.log.push([new Date().toISOString().slice(11,19)].concat(a).join(' ')); if(S.log.length > 120) S.log.splice(0, S.log.length - 120); };

  // 1. the slideshow stays parked: every backdrop() call is refused while stage mode is on, so no GIF is fetched for the hidden #stage
  if(root.ThrydMlibPin && root.ThrydMlibPin.create){
    const orig = root.ThrydMlibPin.create;
    const HOLD = {stage:true, dir:'stage', how:'stage'};
    root.ThrydMlibPin.create = function(){
      const p = orig.apply(this, arguments), pp = p.pinned, pa = p.allow;
      p.pinned = ()=> S.hold ? HOLD : pp();
      p.allow = set => S.hold ? false : pa(set);
      return p;
    };
  }
  // and no single-scene #mcut layer is built
  const origAttach = MC.attach;
  MC.attach = function(){ return S.hold ? Promise.resolve({ok:false, reason:'stage_mode'}) : origAttach.apply(this, arguments); };

  const RM = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const PHONE = (root.innerWidth || 1000) < 760 || !!(root.matchMedia && root.matchMedia('(pointer:coarse)').matches);
  // busy (Jesuye 11-12 11:09 PM "make it very busy"): many small story groups at once, arriving in quick overlapping waves
  // full (Jesuye 11-12 11:41 PM "too much black space ... plenty objects floating all the time"): more cuts, a decoded
  // group always waiting in the wings so a leaving story is replaced at once, and spawns aimed at the emptiest part of the screen
  const CAP = PHONE ? 36 : 72;               // cuts on screen at once
  const MAX_GROUPS = PHONE ? 18 : 36;     // most scenes carry 1-2 cuts, so the cut count comes from many groups
  const PER_GROUP = PHONE ? 4 : 6;
  const READY = PHONE ? 1 : 2;               // decoded groups kept in the wings
  const MAXF = PHONE ? 10 : 20;              // stored frames per animated cut (longer GIFs keep every k-th frame, delays summed)
  const BUDGET = (PHONE ? 90 : 260) * 1048576; // decoded bitmap bytes held by the stage
  const PG_MAX = (PHONE ? 6 : 16) * 1048576;  // one group's sprite frames; bigger ones are drawn at a lower resolution
  const INFLIGHT = PHONE ? 1 : 2;             // groups decoding at the same time (in the decode worker, off the main thread)
  const BG_P = PHONE ? 0.8 : 0.9;             // share of groups that get the faded source-frame backdrop (covers the gaps)
  const DPR = Math.min(root.devicePixelRatio || 1, PHONE ? 1 : 1.25);
  const vw = ()=> root.innerWidth || 1280, vh = ()=> root.innerHeight || 720;
  const R = (a, b)=> a + Math.random() * (b - a);
  const sleep = ms => new Promise(z => setTimeout(z, ms));
  const paused = ()=> document.hidden || document.body.classList.contains('stage-replay') || document.body.classList.contains('dragmode') || document.body.classList.contains('cerebro') || document.body.classList.contains('lovemap');
  const drift = info => { try{ if(root.thrydDrift) root.thrydDrift(info); }catch(e){} };
  const titleOf = mid => { try{ return (root.thrydSceneTitle && root.thrydSceneTitle(mid)) || null; }catch(e){ return null; } };
  const STILL_RX = /stall|sign|table|shelter|door|street|window|board|wall|tree|gate|house|building|kiosk|road|sky|floor|bed|couch|sofa|counter|shelf/i;

  // ---------- DOM
  const css = document.createElement('style');
  css.textContent = [
    'body.stage1:not(.stage-replay) #stage{display:none!important}',
    'body.stage1:not(.stage-replay) #slide{display:none!important}', // no slides on the stage, so no slide-speed menu (Jesuye 11-12 10:51 PM)
    'body.stage-replay #gstage{display:none}',
    '#gstage{position:fixed;inset:0;overflow:hidden;z-index:1;background:#050607}',
    'body.cerebro #gstage,body.lovemap #gstage{display:none}',
    '#gworld{position:absolute;left:0;top:0;will-change:transform}',
    '#gbgs,#gcuts{position:absolute;left:0;top:0}',
    '#gstage .gbg{position:absolute;pointer-events:none;opacity:0;transition:opacity 3.5s ease}',
    '#gstage .gbg.on{opacity:1}',
    '#gstage .gbg.gm{-webkit-mask-image:radial-gradient(ellipse 50% 50% at 50% 50%,#000 45%,transparent 100%);mask-image:radial-gradient(ellipse 50% 50% at 50% 50%,#000 45%,transparent 100%)}', // main-thread fallback only
    '#gstage .gbg.gm.on{opacity:.34}',
    '#gstage .gcut{position:absolute;pointer-events:auto;touch-action:none;cursor:grab;transform-origin:50% 85%;user-select:none;will-change:transform,translate,opacity;backface-visibility:hidden}',
    '#gstage .gcut.fl{animation:mcfloat var(--fd,7s) ease-in-out var(--fdl,0s) infinite}',
    '#gstage .gcut[data-dragging="1"]{animation:none;cursor:grabbing;z-index:9999!important}',
    '#gstage .gcut.gnotice{animation:mcnotice 1.1s ease-out 1 both}',
    '#gstage .gtag{position:absolute;transform:translateX(-50%);font:1.15vh ui-monospace,Menlo,monospace;color:#fff;background:#000a;padding:.15vh .5vw;border-radius:.6vh;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity 1.6s;max-width:40vw;overflow:hidden;text-overflow:ellipsis}',
    '#gstage .gtag.on{opacity:.85}',
    '#gstage .gtag.gcarry{color:#f0d7a2;z-index:9998}',
    '@media (prefers-reduced-motion:reduce){#gstage .gcut.fl,#gstage .gcut.gnotice{animation:none}}'
  ].join('\n');
  document.head.appendChild(css);
  const stage = document.createElement('div'); stage.id = 'gstage';
  const world = document.createElement('div'); world.id = 'gworld';
  const bgs = document.createElement('div'); bgs.id = 'gbgs';
  const cutsL = document.createElement('div'); cutsL.id = 'gcuts';
  world.appendChild(bgs); world.appendChild(cutsL); stage.appendChild(world);
  const mount = ()=>{ document.body.classList.add('stage1'); const old = document.getElementById('stage'); document.body.insertBefore(stage, old ? old.nextSibling : document.body.firstChild); };
  if(document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  // ---------- camera (smooth, 11-12 11:41 PM): the pan runs as a Web Animation on the compositor, so decoding or a busy main thread
  // never stalls it. The world is only a little bigger than the screen (so the view is always full) and each leg heads to a random
  // point, so the drift goes every way, not one way.
  const W = {w:0, h:0};
  const sizeWorld = ()=>{ W.w = Math.round(vw() * (PHONE ? 1.1 : 1.14)); W.h = Math.round(vh() * (PHONE ? 1.07 : 1.12)); world.style.width = W.w + 'px'; world.style.height = W.h + 'px'; };
  sizeWorld();
  const cam = {x:(W.w - vw()) / 2, y:(W.h - vh()) / 2, fx:0, fy:0, tx:0, ty:0, dur:1, a:null};
  const tr = (x, y)=> 'translate3d(' + (-x).toFixed(1) + 'px,' + (-y).toFixed(1) + 'px,0)';
  const clampCam = ()=>{ cam.x = Math.max(0, Math.min(W.w - vw(), cam.x)); cam.y = Math.max(0, Math.min(W.h - vh(), cam.y)); };
  const ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  function camNow(){ const a = cam.a; if(!a) return; let k = (a.currentTime || 0) / cam.dur; k = Math.max(0, Math.min(1, k)); const e = ease(k);
    cam.x = cam.fx + (cam.tx - cam.fx) * e; cam.y = cam.fy + (cam.ty - cam.fy) * e; }
  function camGo(tx, ty, dur){
    camNow(); if(cam.a){ try{ cam.a.cancel(); }catch(e){} cam.a = null; }
    clampCam(); cam.fx = cam.x; cam.fy = cam.y; world.style.transform = tr(cam.x, cam.y);
    if(RM || typeof world.animate !== 'function') return;
    const mx = Math.max(0, W.w - vw()), my = Math.max(0, W.h - vh());
    if(tx == null){ for(let t = 0; t < 6; t++){ tx = R(0, mx); ty = R(0, my); if(Math.hypot(tx - cam.x, ty - cam.y) > Math.min(mx, my) * .45) break; } }
    cam.tx = Math.max(0, Math.min(mx, tx)); cam.ty = Math.max(0, Math.min(my, ty));
    cam.dur = dur || Math.max(14000, Math.hypot(cam.tx - cam.fx, cam.ty - cam.fy) / (vw() * 0.006) * 1000);
    try{ DIRS.cam[oct(Math.atan2(cam.ty - cam.fy, cam.tx - cam.fx))]++; }catch(e){}
    const a = cam.a = world.animate([{transform: tr(cam.fx, cam.fy)}, {transform: tr(cam.tx, cam.ty)}], {duration: cam.dur, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards'});
    a.onfinish = ()=>{ if(cam.a !== a) return; cam.x = cam.tx; cam.y = cam.ty; world.style.transform = tr(cam.x, cam.y); cam.a = null; try{ a.cancel(); }catch(e){} setTimeout(()=> camGo(), R(400, 2500)); };
  }
  function camHold(){ const a = cam.a; if(!a) return; const p = paused(); if(p && a.playState === 'running') a.pause(); else if(!p && a.playState === 'paused') a.play(); }
  world.style.transform = tr(cam.x, cam.y); setTimeout(()=> camGo(), 1500);
  root.addEventListener('resize', ()=>{ sizeWorld(); camGo(); });
  // one rAF loop: GIF frames of every group advance here, on the display's own clock (no per-group timers)
  const anims = new Set(); S.loop = {n:0, slow:0, max:0};
  function frame(now){
    const t0 = performance.now();
    if(!document.hidden && !document.body.classList.contains('cerebro')){
      anims.forEach(A => {
        const g = A.g; if(g.gone && !S.cuts.some(c => c.home === g)){ anims.delete(A); return; }
        if(now < A.due) return;
        let n = 0; while(now >= A.due && n++ < 4){ A.f = (A.f + 1) % A.delays.length; A.due += Math.max(40, A.delays[A.f] || 100); }
        if(now - A.due > 1000) A.due = now + 60; // after a pause, pick up again instead of racing
        for(let i = 0; i < S.cuts.length; i++){ const cut = S.cuts[i]; if(cut.home !== g || !cut.frames[A.f] || !cut.ctx) continue;
          cut.ctx.clearRect(0, 0, cut.el.width, cut.el.height); cut.ctx.drawImage(cut.frames[A.f], 0, 0); }
      });
    }
    const dt = performance.now() - t0; S.loop.n++; if(dt > 8) S.loop.slow++; if(dt > S.loop.max) S.loop.max = +dt.toFixed(1);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  const view = ()=>{ camNow(); return {x:cam.x, y:cam.y, w:vw(), h:vh()}; };

  // ---------- decoding: exact source frames, cut by each object's own mask, scaled to on-screen size
  let manifest = null;
  async function bitmapOf(img, dw, dh){
    if(typeof createImageBitmap === 'function'){
      try{ return await createImageBitmap(img, {resizeWidth: dw, resizeHeight: dh, resizeQuality: 'medium'}); }catch(e){}
    }
    const c1 = document.createElement('canvas'); c1.width = img.width; c1.height = img.height; c1.getContext('2d').putImageData(img, 0, 0);
    const c2 = document.createElement('canvas'); c2.width = dw; c2.height = dh; c2.getContext('2d').drawImage(c1, 0, 0, dw, dh);
    c1.width = 0; return c2;
  }
  const b64 = s => { const bin = atob(s), out = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
  function cropMasked(rgba, fw, spec, U){
    const out = new ImageData(U.w, U.h), d = out.data;
    if(!spec || !spec.bits) return out;
    const raw = spec._raw || (spec._raw = b64(spec.bits)), stride = (spec.w + 7) >> 3;
    for(let y = 0; y < spec.h; y++){
      const sy = spec.y + y, oy = sy - U.y; if(oy < 0 || oy >= U.h) continue;
      for(let x = 0; x < spec.w; x++){
        if(!(raw[y * stride + (x >> 3)] & (0x80 >> (x & 7)))) continue;
        const sx = spec.x + x, ox = sx - U.x; if(ox < 0 || ox >= U.w) continue;
        const p = (sy * fw + sx) * 4, o = (oy * U.w + ox) * 4;
        d[o] = rgba[p]; d[o+1] = rgba[p+1]; d[o+2] = rgba[p+2]; d[o+3] = rgba[p+3];
      }
    }
    return out;
  }
  function unionBox(masks){
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    masks.forEach(m => { if(!m || typeof m.x !== 'number') return; x0 = Math.min(x0, m.x); y0 = Math.min(y0, m.y); x1 = Math.max(x1, m.x + m.w); y1 = Math.max(y1, m.y + m.h); });
    return x1 < 0 ? null : {x:x0, y:y0, w:x1 - x0, h:y1 - y0};
  }
  async function fetchBytes(row){
    const keep = root.ThrydKeep, sha = row.source_sha256 || '', ver = row.pack_version || '1', url = row.url;
    const r = (keep && sha && keep.mayCache && keep.mayCache(url)) ? await keep.fetchCached(url, {cache:'force-cache'}, 'gif:' + sha + ':' + ver) : await fetch(url, {cache:'force-cache'});
    if(!r || !r.ok) throw new Error('fetch');
    return new Uint8Array(await r.arrayBuffer());
  }
  async function stillPixels(bytes, w, h){
    const bm = await createImageBitmap(new Blob([bytes]));
    if(bm.width !== w || bm.height !== h){ bm.close && bm.close(); throw new Error('mask_size'); }
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(bm, 0, 0); bm.close && bm.close();
    const px = g.getImageData(0, 0, w, h).data; c.width = 0; return px;
  }

  // ---------- decode worker (smooth, 11-12 11:41 PM): GIF decode, mask crop, downscale and backdrop run in assets/stage_worker.js
  // (a typed-array LZW, pixel-identical to medium_cuts.js and ~3-4x faster); the page thread only receives finished ImageBitmaps.
  // If workers or OffscreenCanvas are missing, the old main-thread path below is used.
  const WK = {pool: [], seq: 0, wait: new Map(), off: false, ms: []};
  try{
    if(typeof Worker === 'function' && typeof OffscreenCanvas === 'function' && typeof createImageBitmap === 'function'){
      const base = (document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/stage\.js.*$/, '') : 'assets/';
      for(let n = 0; n < INFLIGHT; n++){ const w = new Worker(base + 'stage_worker.js?v=1&t=' + Date.now()); w.busy = 0;
        w.onmessage = e => { const m = e.data, z = WK.wait.get(m.id); if(!z) return; WK.wait.delete(m.id); w.busy--; if(m.ok){ WK.ms.push(m.ms); if(WK.ms.length > 40) WK.ms.shift(); z.ok(m); } else z.no(new Error(m.error || 'worker')); };
        w.onerror = ev => { ev.preventDefault && ev.preventDefault(); WK.off = true; WK.wait.forEach(z => z.no(new Error('worker_down'))); WK.wait.clear(); };
        WK.pool.push(w); }
    } else WK.off = true;
  }catch(e){ WK.off = true; }
  const lite = m => m ? {x: m.x, y: m.y, w: m.w, h: m.h, bits: m.bits} : null;
  function offDecode(msg, transfer){
    if(WK.off || !WK.pool.length) return Promise.reject(new Error('worker_off'));
    const w = WK.pool.slice().sort((a, b) => a.busy - b.busy)[0], id = ++WK.seq; w.busy++;
    return new Promise((ok, no) => { WK.wait.set(id, {ok, no}); w.postMessage(Object.assign({id}, msg), transfer); });
  }

  // ---------- groups
  function pickRow(){
    const ok = (manifest.assets || []).filter(a => a && a.status === 'ready' && a.url && !S.bad.has(a.medium_image_id) &&
      !S.recent.includes(a.medium_image_id) && !S.groups.some(g => g.mid === a.medium_image_id));
    if(!ok.length){ S.recent = S.recent.slice(-5); return null; }
    const gifsOn = S.groups.filter(g => g.kind === 'gif').length;
    const wantGif = gifsOn < (PHONE ? 1 : 2) && Math.random() < 0.45;
    const pool = ok.filter(a => (a.kind === 'gif') === wantGif);
    const from = pool.length ? pool : ok;
    return from[Math.random() * from.length | 0];
  }
  // fill (11-12 11:41 PM): a coarse grid over the camera view; each new story goes where the screen is emptiest
  const GX = PHONE ? 6 : 10, GY = PHONE ? 9 : 7;
  function coverGrid(v){
    const c = new Float32Array(GX * GY), cw = v.w / GX, ch = v.h / GY;
    const add = (x, y, w, h, wt)=>{ const i0 = Math.max(0, Math.floor((x - v.x) / cw)), i1 = Math.min(GX - 1, Math.floor((x + w - v.x) / cw)), j0 = Math.max(0, Math.floor((y - v.y) / ch)), j1 = Math.min(GY - 1, Math.floor((y + h - v.y) / ch));
      for(let i = i0; i <= i1; i++) for(let j = j0; j <= j1; j++){ const cx = v.x + i * cw, cy = v.y + j * ch; const ix = Math.max(0, Math.min(cx + cw, x + w) - Math.max(cx, x)), iy = Math.max(0, Math.min(cy + ch, y + h) - Math.max(cy, y)); c[i + j * GX] += wt * ix * iy / (cw * ch); } };
    S.groups.forEach(g => { add(g.x, g.y, g.w, g.h, g.bgEl ? .6 : .35); });
    S.cuts.forEach(cut => { if(!cut.leaving) add(cut.left, cut.top, cut.w, cut.h, 1); });
    S.pend.forEach(b => add(b.x, b.y, b.w, b.h, 1));
    return c;
  }
  S.fill = ()=>{ const v = view(), c = coverGrid(v); let n = 0; for(let i = 0; i < c.length; i++) if(c[i] > .2) n++; return +(n / c.length).toFixed(2); };
  function placeGroup(Dw, Dh){
    const v = view(), c = coverGrid(v), cw = v.w / GX, ch = v.h / GY; let best = null;
    // seed candidates on the emptiest cells, plus a few random ones
    const order = Array.from(c, (x, i) => [x + Math.random() * .15, i]).sort((a, b) => a[0] - b[0]).slice(0, 10);
    const cand = order.map(([, i]) => [v.x + (i % GX + .5) * cw - Dw / 2, v.y + ((i / GX | 0) + .5) * ch - Dh / 2]);
    for(let t = 0; t < 8; t++) cand.push([R(v.x - Dw * .1, v.x + v.w - Dw * .9), R(v.y - Dh * .05, v.y + v.h - Dh * .95)]);
    cand.forEach(([gx, gy]) => {
      gx = Math.max(0, Math.min(W.w - Dw, gx + R(-.15, .15) * Dw)); gy = Math.max(0, Math.min(W.h - Dh, gy + R(-.15, .15) * Dh));
      let sc = 0;
      const i0 = Math.max(0, Math.floor((gx - v.x) / cw)), i1 = Math.min(GX - 1, Math.floor((gx + Dw - v.x) / cw)), j0 = Math.max(0, Math.floor((gy - v.y) / ch)), j1 = Math.min(GY - 1, Math.floor((gy + Dh - v.y) / ch));
      for(let i = i0; i <= i1; i++) for(let j = j0; j <= j1; j++) sc += Math.max(0, 1 - c[i + j * GX]) - Math.max(0, c[i + j * GX] - 1) * .6;
      const vis = Math.max(0, Math.min(gx + Dw, v.x + v.w) - Math.max(gx, v.x)) * Math.max(0, Math.min(gy + Dh, v.y + v.h) - Math.max(gy, v.y)) / (Dw * Dh);
      sc *= .4 + .6 * vis;
      if(!best || sc > best.sc) best = {gx, gy, sc};
    });
    return best;
  }
  async function loadGroup(row){
    await MC.expandRow(row);
    const ext = ((String(row.url).split('?')[0].match(/\.([A-Za-z0-9]+)$/) || [])[1] || '').toLowerCase();
    const set = {how:'medium', remote:true, url:row.url, medium_image_id:row.medium_image_id, extension:ext, animated: row.kind === 'gif'};
    const plan = MC.forSet(set, manifest);
    if(!plan.ok) throw new Error(plan.reason || 'plan');
    const fw = plan.width, fh = plan.height;
    const room = CAP - S.cuts.length; if(room < 1) throw new Error('cap');
    let objs = plan.objects.map((o, k) => ({o, k, U: unionBox(plan.kind === 'gif' ? o.masks : [o.masks[0]])})).filter(x => x.U && x.U.w > 2 && x.U.h > 2);
    objs.sort((a, b) => b.U.w * b.U.h - a.U.w * a.U.h);
    objs = objs.slice(0, Math.min(room, PER_GROUP));
    if(!objs.length) throw new Error('no_object');
    // on-screen size of the whole source frame for this group
    let Dh = vh() * (PHONE ? R(0.18, 0.30) : R(0.22, 0.40)), k = Dh / fh;
    if(fw * k > vw() * (PHONE ? 0.6 : 0.42)) k = vw() * (PHONE ? 0.6 : 0.42) / fw;
    Dh = fh * k; const Dw = fw * k; let s = Math.min(1, k * DPR);
    const animated = plan.kind === 'gif' && plan.frameCount > 1;
    const step = animated ? Math.max(1, Math.ceil(plan.frameCount / MAXF)) : 1;
    const nf = animated ? Math.ceil(plan.frameCount / step) : 1;
    let est = objs.reduce((n, x) => n + Math.ceil(x.U.w * s) * Math.ceil(x.U.h * s) * 4, 0) * nf;
    if(est > PG_MAX){ s *= Math.sqrt(PG_MAX / est); est = PG_MAX; }
    if(S.bytes + est > BUDGET) throw new Error('budget');
    const wantBg = Math.random() < BG_P;
    const animated0 = plan.kind === 'gif';
    if(!WK.off){ // the worker also fetches the file itself (HTTP cache), so multi-MB GIF bytes never pass through the page thread
      const bs = Math.min(1, k * (PHONE ? 0.55 : 0.7));
      const msg = {url: row.url, fw, fh, gif: animated0, frameCount: plan.frameCount, stillFrame: plan.still_frame | 0, step, delays_cs: plan.delays_cs,
        objs: objs.map(x => ({U: x.U, dw: Math.max(1, Math.round(x.U.w * s)), dh: Math.max(1, Math.round(x.U.h * s)),
          masks: animated0 ? x.o.masks.map((m, i) => i % step === 0 ? lite(m) : null) : [lite(x.o.masks[0])]})),
        bg: wantBg ? {w: Math.max(1, Math.round(fw * bs)), h: Math.max(1, Math.round(fh * bs)), plate: plan.plate || null, known: plan.plate ? plan.plateKnown : null} : null};
      try{
        const r = await offDecode(msg, []);
        return {plan, fw, fh, k, Dw, Dh, s, objs, frames: r.frames, delays: r.delays, bg: r.bg || null, animated, kind: plan.kind};
      }catch(e){ if(!/worker_off|worker_down/.test(String(e && e.message))) throw e; note('worker off, main-thread decode'); return loadGroup(row); }
    }
    const bytes = await fetchBytes(row);
    const isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
    const frames = objs.map(() => []), delays = [];
    let bg = null;
    const plateSrc = plan.plate ? {rgba: plan.plate, known: plan.plateKnown} : null;
    const take = async (rgba, mi, ms)=>{
      for(let j = 0; j < objs.length; j++){
        const x = objs[j], img = cropMasked(rgba, fw, x.o.masks[mi], x.U);
        frames[j].push(await bitmapOf(img, Math.max(1, Math.round(x.U.w * s)), Math.max(1, Math.round(x.U.h * s))));
      }
      delays.push(ms);
      if(!bg && wantBg){ // the same frame with every staged cut's spot hole-filled (stored plate or a darkened copy of this frame), faded behind the group
        try{
          const drawn = MC.compose(rgba, fw, fh, objs.map(x => x.o.masks[mi]), plateSrc);
          const bs = Math.min(1, k * 0.75);
          bg = await bitmapOf(new ImageData(drawn.plate instanceof Uint8ClampedArray ? drawn.plate : new Uint8ClampedArray(drawn.plate), fw, fh), Math.max(1, Math.round(fw * bs)), Math.max(1, Math.round(fh * bs)));
        }catch(e){ bg = null; }
      }
    };
    if(isGif){
      const dec = MC.createGifDecoder(bytes);
      if(dec.width !== fw || dec.height !== fh) throw new Error('mask_size');
      const want = plan.kind === 'gif' ? plan.frameCount : (plan.still_frame | 0) + 1;
      let fr, acc = 0, keepI = -1;
      while((fr = dec.next())){
        const i = fr.index;
        if(plan.kind === 'gif'){
          if(fr.delayCs !== plan.delays_cs[i]) throw new Error('delay_mismatch');
          acc += MC.playMs(fr.delayCs);
          if(i % step === 0){ keepI = i; await take(fr.rgba, i, 0); }
          if(i % step === step - 1 || i === plan.frameCount - 1){ delays[delays.length - 1] = acc; acc = 0; }
        } else if(i === (plan.still_frame | 0)){ await take(fr.rgba, 0, 0); }
        if(i + 1 >= want) break;
        await sleep(0); // one frame per task, so decoding never freezes the page
      }
      if(!frames[0].length) throw new Error('decode');
    } else {
      await take(await stillPixels(bytes, fw, fh), 0, 0);
    }
    return {plan, fw, fh, k, Dw, Dh, s, objs, frames, delays, bg, bgMask: true, animated, kind: plan.kind};
  }

  // the shift that takes a box at screen (sx, sy, w, h) fully off the screen along heading a (radians, 0 = right, y down)
  function offTo(sx, sy, w, h, v, a){
    const ux = Math.cos(a), uy = Math.sin(a), M = 50; let d = 1e9;
    if(ux > .15) d = Math.min(d, (v.w - sx + M) / ux); else if(ux < -.15) d = Math.min(d, (sx + w + M) / -ux);
    if(uy > .15) d = Math.min(d, (v.h - sy + M) / uy); else if(uy < -.15) d = Math.min(d, (sy + h + M) / -uy);
    if(d > 1e8) d = Math.max(v.w, v.h);
    return [ux * d, uy * d];
  }
  const DIRS = S.dirs8 = {in: new Array(8).fill(0), out: new Array(8).fill(0), wander: new Array(8).fill(0), cam: new Array(8).fill(0)};
  const oct = a => ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8; // 0 = moving right, 2 = down, 4 = left, 6 = up
  S.dirs = ()=>({note: '0=right 1=down-right 2=down 3=down-left 4=left 5=up-left 6=up 7=up-right (heading of travel)', in: DIRS.in, out: DIRS.out, wander: DIRS.wander, cam: DIRS.cam});
  function bytesOf(list){ return list.reduce((n, b) => n + (b ? b.width * b.height * 4 : 0), 0); }
  function spawn(row, L){
    const pos = placeGroup(L.Dw, L.Dh); const v = view();
    const g = {mid: row.medium_image_id, row, kind: L.kind, x: pos.gx, y: pos.gy, w: L.Dw, h: L.Dh, k: L.k, fw: L.fw, fh: L.fh,
      title: titleOf(row.medium_image_id), born: Date.now(), life: (PHONE ? R(30, 50) : R(35, 70)) * 1000, cuts: [], gone: false, offSince: 0, sha: row.source_sha256 || '', ver: row.pack_version || '1'};
    if(L.bg){
      const c = document.createElement('canvas'); c.className = 'gbg' + (L.bgMask ? ' gm' : ''); c.width = L.bg.width; c.height = L.bg.height;
      c.getContext('2d').drawImage(L.bg, 0, 0); L.bg.close && L.bg.close();
      const E = PHONE ? 0.22 : 0.28; // the faded frame reaches well past the group, so neighbouring stories meet instead of black gaps
      Object.assign(c.style, {left: (g.x - g.w * E) + 'px', top: (g.y - g.h * E) + 'px', width: (g.w * (1 + 2 * E)) + 'px', height: (g.h * (1 + 2 * E)) + 'px'});
      bgs.appendChild(c); g.bgEl = c; S.bytes += c.width * c.height * 4; g.bgBytes = c.width * c.height * 4;
      setTimeout(()=> c.classList.add('on'), 60);
    }
    if(g.title){ const t = document.createElement('div'); t.className = 'gtag'; t.textContent = String(g.title).slice(0, 60); Object.assign(t.style, {left: (g.x + g.w / 2) + 'px', top: (g.y + g.h + 6) + 'px'}); cutsL.appendChild(t); g.tag = t;
      setTimeout(()=> t.classList.add('on'), 2500); setTimeout(()=> t.classList.remove('on'), 11000); }
    // directions (11-12 11:41 PM): each story walks in along a random heading from any edge or corner (no left-to-right bias)
    const ang = g.inAng = Math.random() * Math.PI * 2;
    L.objs.forEach((x, j) => {
      const fr = L.frames[j]; if(!fr.length) return;
      const c = document.createElement('canvas'); c.className = 'gcut' + (RM ? '' : ' fl'); c.width = fr[0].width; c.height = fr[0].height;
      const ctx = c.getContext('2d'); ctx.drawImage(fr[0], 0, 0);
      const cut = {ctx, g, home: g, el: c, frames: fr, label: x.o.label || ('cut' + (x.k + 1)), klass: x.o.model_class || x.o.label || null, i: x.k, U: x.U,
        w: x.U.w * g.k, h: x.U.h * g.k, hx: g.x + x.U.x * g.k, hy: g.y + x.U.y * g.k, entering: true, bytes: bytesOf(fr), area: (x.U.w * x.U.h) / (g.fw * g.fh)};
      cut.left = cut.hx; cut.top = cut.hy;
      Object.assign(c.style, {left: cut.left + 'px', top: cut.top + 'px', width: cut.w + 'px', height: cut.h + 'px', zIndex: String(10 + Math.round(x.U.y + x.U.h))});
      c.style.setProperty('--fd', R(5.5, 9).toFixed(2) + 's'); c.style.setProperty('--fdl', (-R(0, 6)).toFixed(2) + 's');
      S.bytes += cut.bytes; S.cuts.push(cut); g.cuts.push(cut);
      bindDrag(cut);
      // in along the group's heading, from just off the screen, staggered
      const a1 = ang + R(-.18, .18), off = offTo(cut.left - v.x, cut.top - v.y, cut.w, cut.h, v, a1 + Math.PI);
      c.style.opacity = '0';
      if(!RM){ c.style.transition = 'none'; c.style.translate = off[0].toFixed(0) + 'px ' + off[1].toFixed(0) + 'px'; }
      cutsL.appendChild(c);
      const dur = RM ? 2 : R(5, 9), delay = j * R(300, 1100);
      setTimeout(()=>{
        c.style.transition = RM ? 'opacity 2s' : 'translate ' + dur.toFixed(2) + 's cubic-bezier(.22,.1,.25,1), opacity 1.4s';
        requestAnimationFrame(()=>{ c.style.opacity = '1'; if(!RM) c.style.translate = '0px 0px'; });
        setTimeout(()=>{ cut.entering = false; if(!cut.wan){ c.style.transition = ''; c.style.translate = ''; } }, dur * 1000 + 100);
      }, delay + 80);
    });
    DIRS.in[oct(ang)]++;
    S.groups.push(g); S.spawned++;
    if(g.cuts.length <= 2 && Math.random() < 0.5) S.near = g;
    S.recent.push(g.mid); if(S.recent.length > 40) S.recent.shift();
    S.maxSeen = Math.max(S.maxSeen, S.cuts.length);
    note('spawn', g.mid, L.kind, g.cuts.length + ' cuts', 'on stage ' + S.cuts.length + '/' + CAP, g.title || '');
    if(L.animated) animate(g, L.delays);
    setTimeout(()=> carry(g), 6000 + Math.random() * 3000); // once it has walked in, earlier moves of the same object carry over here
  }
  // ---------- move carry-over: projector.js thrydMoves.fireFor(scene, objects) is the default page's consequence step
  // (earlier customer moves that share an object with this scene). Records + emits the consequence; here the group reacts.
  let lastCarry = 0;
  const nkey = x => String(x || '').toLowerCase().replace(/^[oc]:/, '').replace(/_[0-9a-f]{4,}$/, '').replace(/[_\s]*\d+$/, '').replace(/_/g, ' ').trim();
  function carry(g, why){
    if(!g || g.gone || !g.cuts.length || g.carried || !root.thrydMoves || typeof root.thrydMoves.fireFor !== 'function') return null;
    if(Date.now() - lastCarry < 8000) return null; // a busy stage would otherwise fire one for every arriving group
    const objs = g.cuts.map(c => c.klass).concat(g.cuts.map(c => c.label));
    let r = null; try{ r = root.thrydMoves.fireFor(g.mid, objs); }catch(e){ r = null; }
    if(!r || !r.consequence) return null;
    lastCarry = Date.now(); g.carried = true; g.life += 15000;
    const keys = new Set((r.shared || []).filter(k => k.startsWith('o:')).map(k => k.slice(2)));
    const hit = g.cuts.filter(c => keys.has(nkey(c.klass)) || keys.has(nkey(c.label)));
    (hit.length ? hit : g.cuts).forEach((c, n) => setTimeout(()=>{ if(!c.el.isConnected) return; c.el.classList.remove('gnotice'); void c.el.offsetWidth; c.el.classList.add('gnotice'); setTimeout(()=> c.el.classList.remove('gnotice'), 1300); }, n * 220));
    const h = r.hits[r.hits.length - 1] || {}, at = h.at ? new Date(h.at).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) : '';
    const t = document.createElement('div'); t.className = 'gtag gcarry';
    t.textContent = '↺ ' + (h.label || h.object_key || 'it') + ' was moved' + (at ? ' at ' + at : '') + (h.title ? ' in “' + String(h.title).slice(0, 32) + '”' : '') + ' · carried over';
    Object.assign(t.style, {left: (g.x + g.w / 2) + 'px', top: (g.y - 18) + 'px'}); cutsL.appendChild(t);
    requestAnimationFrame(()=> t.classList.add('on')); setTimeout(()=> t.classList.remove('on'), 8000); setTimeout(()=> t.remove(), 10000);
    g.carryEvent = r.consequence.event_id; S.carries = (S.carries || 0) + 1;
    note('carry', g.mid, (r.shared || []).join(','), why || 'arrival', r.consequence.event_id);
    return r;
  }
  function animate(g, delays){ anims.add({g, delays, f: 0, due: performance.now() + Math.max(40, delays[0] || 100)}); }
  function unloadCut(cut){
    const at = S.cuts.indexOf(cut); if(at >= 0) S.cuts.splice(at, 1);
    if(cut.g){ const j = cut.g.cuts.indexOf(cut); if(j >= 0) cut.g.cuts.splice(j, 1); }
    cut.frames.forEach(b => { try{ b.close ? b.close() : (b.width = 0); }catch(e){} }); cut.frames = [];
    try{ cut.el.width = 0; cut.el.height = 0; }catch(e){} cut.el.remove(); S.bytes -= cut.bytes; S.left++;
    // a home group whose last own cut left stops its GIF clock
    const h = cut.home; if(h && h.gone && !S.cuts.some(c => c.home === h)) clearTimeout(h.timer);
  }
  function foldTranslate(cut){
    const t = (getComputedStyle(cut.el).translate || '').split(/\s+/).map(parseFloat);
    const tx = isFinite(t[0]) ? t[0] : 0, ty = isFinite(t[1]) ? t[1] : 0;
    cut.left += tx; cut.top += ty; cut.el.style.transition = 'none'; cut.el.style.translate = '';
    cut.el.style.left = cut.left + 'px'; cut.el.style.top = cut.top + 'px'; cut.wan = false;
  }
  function exitGroup(g, quick){
    if(g.gone) return; g.gone = true;
    const at = S.groups.indexOf(g); if(at >= 0) S.groups.splice(at, 1);
    const v = view(), outAng = Math.random() * Math.PI * 2; if(!quick) DIRS.out[oct(outAng)]++;
    g.cuts.slice().forEach((cut, j) => {
      const go = ()=>{
        if(cut.dragging){ setTimeout(go, 1200); return; }
        if(quick || RM){ cut.el.style.transition = 'opacity 1.5s'; cut.el.style.opacity = '0'; setTimeout(()=> unloadCut(cut), quick ? 10 : 1600); return; }
        foldTranslate(cut); cut.leaving = true;
        const [dx, dy] = offTo(cut.left - v.x, cut.top - v.y, cut.w, cut.h, v, outAng + R(-.2, .2));
        const dur = R(6, 10);
        requestAnimationFrame(()=>{ cut.el.style.transition = 'translate ' + dur.toFixed(2) + 's cubic-bezier(.5,0,.4,1), opacity 2s ease-in ' + (dur - 2).toFixed(2) + 's';
          requestAnimationFrame(()=>{ cut.el.style.translate = dx.toFixed(0) + 'px ' + dy.toFixed(0) + 'px'; cut.el.style.opacity = '0'; cut.el.style.pointerEvents = 'none'; }); });
        setTimeout(()=> unloadCut(cut), dur * 1000 + 200);
      };
      setTimeout(go, quick ? 0 : j * R(500, 1500));
    });
    if(g.bgEl){ g.bgEl.classList.remove('on'); setTimeout(()=>{ try{ g.bgEl.width = 0; }catch(e){} g.bgEl.remove(); S.bytes -= g.bgBytes || 0; }, quick ? 50 : 4000); }
    if(g.tag) g.tag.remove();
    if(!g.cuts.length) clearTimeout(g.timer);
    note('exit', g.mid, quick ? 'offscreen' : 'life', 'on stage ' + S.cuts.length);
    setTimeout(refill, quick ? 0 : 700); // the next story walks in while this one is still walking out
  }

  // ---------- drag: the same 'thryd:cutmove' detail medium_cuts.js sends (exact scene + cut identity, percent of the source frame)
  function framePct(cut, host){
    const g = host || cut.home;
    if(g === cut.home){
      const cx = cut.U.x + cut.U.w / 2 + (cut.left - cut.hx) / g.k, cy = cut.U.y + cut.U.h / 2 + (cut.top - cut.hy) / g.k;
      return {x: +(cx / g.fw * 100).toFixed(3), y: +(cy / g.fh * 100).toFixed(3)};
    }
    return {x: +((cut.left + cut.w / 2 - g.x) / g.w * 100).toFixed(3), y: +((cut.top + cut.h / 2 - g.y) / g.h * 100).toFixed(3)};
  }
  function bindDrag(cut){
    const el = cut.el; let d = null, moved = false;
    el.addEventListener('pointerdown', ev => {
      if(cut.leaving) return;
      ev.preventDefault(); ev.stopPropagation();
      foldTranslate(cut); cut.entering = false; el.style.opacity = '1';
      d = {sx: ev.clientX, sy: ev.clientY, l: cut.left, t: cut.top, from: framePct(cut, cut.g), raf: 0}; moved = false;
      cut.dragging = true; el.dataset.dragging = '1';
      try{ el.setPointerCapture(ev.pointerId); }catch(e){}
      document.body.classList.add('dragmode'); camHold();
    });
    el.addEventListener('pointermove', ev => {
      if(!d) return; const dx = ev.clientX - d.sx, dy = ev.clientY - d.sy; if(Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      cut.left = d.l + dx; cut.top = d.t + dy;
      if(d.raf) return; d.raf = requestAnimationFrame(()=>{ if(d){ d.raf = 0; el.style.left = cut.left + 'px'; el.style.top = cut.top + 'px'; } });
    });
    const end = ()=>{
      if(!d) return; const from = d.from; if(d.raf) cancelAnimationFrame(d.raf); d = null;
      el.style.left = cut.left + 'px'; el.style.top = cut.top + 'px';
      cut.dragging = false; delete el.dataset.dragging;
      try{ document.body.classList.remove('dragmode'); }catch(e){} camHold();
      if(!moved) return;
      cut.dragged = true; if(cut.g && !cut.g.gone) cut.g.life += 20000; // a story someone is playing with stays a little longer
      const g = cut.g, visitor = g !== cut.home;
      try{ root.dispatchEvent(new CustomEvent('thryd:cutmove', {detail: Object.assign({
        scene: cut.home.mid, cut: cut.label, cut_index: visitor ? null : cut.i, klass: cut.klass || null,
        source_frame_index: 0, frame_count: cut.frames.length || 1, from, to: framePct(cut, g),
        place_key: (!visitor && root.ThrydKeep && cut.home.sha) ? root.ThrydKeep.placeKey(cut.home.sha, cut.label, cut.home.ver) : null
      }, visitor ? {visitor_in: g.mid} : {})})); }catch(e){}
      const k = nkey(cut.klass || cut.label);
      setTimeout(()=>{ const other = S.groups.find(o => o !== cut.home && !o.gone && !o.carried && o.cuts.some(c => nkey(c.klass) === k || nkey(c.label) === k));
        if(other){ lastCarry = 0; carry(other, 'drag'); } }, 3000);
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('click', ev => { ev.stopPropagation(); }); // a drop never toggles fullscreen
  }

  // ---------- life: wander inside the stage, and now and then a small cut walks over to another story
  function settled(cut){ return !cut.entering && !cut.leaving && !cut.dragging && !cut.wan && cut.g && !cut.g.gone; }
  function wander(){
    const pool = S.cuts.filter(c => settled(c) && c.area <= 0.3 && !STILL_RX.test(c.label + ' ' + (c.klass || '')));
    if(!pool.length) return;
    const cut = pool[Math.random() * pool.length | 0], v = view();
    const wa = Math.random() * Math.PI * 2, dist = R(.04, .13) * Math.min(v.w, v.h * 1.4);
    let dx = Math.cos(wa) * dist, dy = Math.sin(wa) * dist;
    dx = Math.max(-cut.left, Math.min(W.w - cut.w - cut.left, dx)); dy = Math.max(-cut.top, Math.min(W.h - cut.h - cut.top, dy));
    if(Math.hypot(dx, dy) < .02 * v.w) return;
    DIRS.wander[oct(Math.atan2(dy, dx))]++;
    const from = framePct(cut, cut.g);
    cut.wan = true; const dur = 4 + Math.hypot(dx, dy) / v.w * 16, el = cut.el;
    el.style.transition = 'translate ' + dur.toFixed(2) + 's cubic-bezier(.45,.05,.35,1)';
    requestAnimationFrame(()=>{ el.style.translate = dx.toFixed(1) + 'px ' + dy.toFixed(1) + 'px'; });
    const g = cut.g;
    drift({kind:'wander', scene: g === cut.home ? cut.home.mid : g.mid, scene_kind:'medium_cut', cut: cut.label, cut_index: g === cut.home ? cut.i : null, klass: cut.klass,
      from, to: {x: +(from.x + dx / g.k / g.fw * 100).toFixed(2), y: +(from.y + dy / g.k / g.fh * 100).toFixed(2)}});
    const back = ()=>{
      if(!el.isConnected || !cut.wan) return;
      if(paused() || cut.dragging){ setTimeout(back, 1500); return; }
      el.style.translate = '0px 0px';
      setTimeout(()=>{ if(el.isConnected && cut.wan){ cut.wan = false; el.style.transition = ''; el.style.translate = ''; } }, dur * 1000 + 80);
    };
    setTimeout(back, dur * 1000 + R(1500, 6000));
  }
  function crossover(){
    const live = S.groups.filter(g => Date.now() - g.born > 9000 && g.born + g.life - Date.now() > 15000);
    if(live.length < 2) return;
    const pool = S.cuts.filter(c => settled(c) && c.area <= 0.14 && !STILL_RX.test(c.label + ' ' + (c.klass || '')) && live.includes(c.g));
    if(!pool.length) return;
    const cut = pool[Math.random() * pool.length | 0], A = cut.g;
    const B = live.filter(g => g !== A).sort((p, q) => Math.hypot(p.x - A.x, p.y - A.y) - Math.hypot(q.x - A.x, q.y - A.y))[0];
    if(!B) return;
    foldTranslate(cut);
    const tx = B.x + R(.08, .92) * B.w - cut.w / 2, ty = B.y + B.h * R(.55, .9) - cut.h;
    const dx = tx - cut.left, dy = ty - cut.top, dur = Math.min(11, 4 + Math.hypot(dx, dy) / vw() * 9);
    cut.wan = true; cut.entering = true; // busy while it walks
    const fromPct = framePct(cut, A);
    drift({kind:'leave', scene: A.mid, scene_kind:'medium_cut', cut: cut.label, cut_index: A === cut.home ? cut.i : null, klass: cut.klass,
      from: fromPct, to: {x: dx < 0 ? -10 : 110, y: fromPct.y}, edge: dx < 0 ? 'left' : 'right'});
    const el = cut.el;
    el.style.transition = RM ? 'none' : 'translate ' + dur.toFixed(2) + 's cubic-bezier(.45,.05,.35,1)';
    requestAnimationFrame(()=>{ el.style.translate = dx.toFixed(0) + 'px ' + dy.toFixed(0) + 'px'; });
    setTimeout(()=>{
      if(!el.isConnected) return;
      foldTranslate(cut); cut.entering = false;
      if(A.cuts.includes(cut)) A.cuts.splice(A.cuts.indexOf(cut), 1);
      if(B.gone){ unloadCut(cut); return; }
      cut.g = B; B.cuts.push(cut);
      el.style.zIndex = String(10 + Math.round((cut.top - B.y) / B.k));
      drift({kind:'arrive', scene: B.mid, scene_kind:'medium_cut', cut: cut.label, klass: cut.klass, from_scene: cut.home.mid, from_title: cut.home.title || null,
        to: {x: +((cut.left + cut.w / 2 - B.x) / B.w * 100).toFixed(2), y: null}});
      const t = document.createElement('div'); t.className = 'gtag'; t.textContent = 'from ' + String(cut.home.title || cut.home.mid).slice(0, 48);
      Object.assign(t.style, {left: (cut.left + cut.w / 2) + 'px', top: (cut.top + cut.h + 4) + 'px'}); cutsL.appendChild(t);
      requestAnimationFrame(()=> t.classList.add('on')); setTimeout(()=> t.classList.remove('on'), 5000); setTimeout(()=> t.remove(), 7000);
      B.cuts.forEach((c, n) => { if(c === cut || !settled(c)) return; setTimeout(()=>{ c.el.classList.remove('gnotice'); void c.el.offsetWidth; c.el.classList.add('gnotice'); setTimeout(()=> c.el.classList.remove('gnotice'), 1300); }, 400 + n * 180); });
      note('visit', cut.label, 'from', A.mid, 'to', B.mid);
    }, dur * 1000 + 120);
  }

  // ---------- spawner / housekeeping
  // decoding fills a small queue of ready groups; a group goes on stage the moment there is room (cap, budget, an empty patch)
  S.ready = []; S.pend = [];
  function place(item){
    if(S.cuts.length + item.L.objs.length > CAP || S.groups.length >= MAX_GROUPS) return false;
    S.ready.splice(S.ready.indexOf(item), 1); S.bytes -= item.held;
    try{ spawn(item.row, item.L); }catch(e){ note('spawn fail', item.row.medium_image_id, String(e && e.message || e)); item.L.frames.forEach(f => f.forEach(b => b.close && b.close())); }
    return true;
  }
  function refill(){ if(paused()) return; while(S.ready.length && place(S.ready[0])); spawnOne(); }
  async function spawnOne(){
    if(S.loading >= INFLIGHT || !manifest) return;
    if(S.ready.length >= READY || S.cuts.length >= CAP || S.bytes > BUDGET * .9) return;
    if(S.groups.length + S.ready.length >= MAX_GROUPS && S.cuts.length >= CAP - 2) return;
    const row = pickRow(); if(!row) return;
    S.recent.push(row.medium_image_id); if(S.recent.length > 40) S.recent.shift(); // never picked twice while it decodes
    S.loading++;
    try{ const L = await loadGroup(row); const held = L.frames.reduce((n, f) => n + bytesOf(f), 0) + (L.bg ? L.bg.width * L.bg.height * 4 : 0);
      const item = {row, L, held}; S.bytes += held; S.ready.push(item); place(item); }
    catch(e){ const why = String(e && e.message || e); if(why !== 'cap' && why !== 'budget') S.bad.add(row.medium_image_id); else S.recent.push(row.medium_image_id); S.fails++; note('skip', row.medium_image_id, why); }
    finally{ S.loading--; }
    if(!paused()) setTimeout(spawnOne, 50);
  }
  function spawner(){
    const wait = S.groups.length < MAX_GROUPS * 0.5 ? R(150, 400) : R(500, 1400);
    setTimeout(()=>{ if(!paused()) refill(); spawner(); }, wait);
  }
  function house(){
    const now = Date.now(), v = view();
    S.groups.slice().forEach(g => {
      const vis = g.x < v.x + v.w && g.x + g.w > v.x && g.y < v.y + v.h && g.y + g.h > v.y;
      if(vis) g.offSince = 0; else if(!g.offSince) g.offSince = now;
      if(g.offSince && now - g.offSince > 12000) exitGroup(g, true);
      else if(now - g.born > g.life && !g.cuts.some(c => c.dragging)) exitGroup(g, false);
    });
    // never more than CAP: the oldest group gives way at once
    if(S.cuts.length > CAP && S.groups.length) exitGroup(S.groups.slice().sort((a, b) => a.born - b.born)[0], true);
    S.maxSeen = Math.max(S.maxSeen, S.cuts.length);
    camHold();
  }
  setInterval(house, 1000);
  // the centre ticker line has no single scene to report here: show what is on the stage instead of a stuck "loading"
  // (projector.js keeps writing "loading" because no single view ever comes up in stage mode, so this also replaces it the moment it is written)
  let updBusy = false;
  const upd = ()=>{ const u = document.getElementById('upd'); if(!u || updBusy) return; const t = u.textContent || '';
    if(t && t !== 'loading' && t !== 'loading cuts' && !t.startsWith('on stage')) return;
    const n = S.groups.length, f = focus && !focus.gone ? (focus.title || '') : '';
    const want = n ? 'on stage: ' + n + (n === 1 ? ' story' : ' stories') + (f ? ' · ' + String(f).slice(0, 48) : '') : 'loading';
    if(t !== want){ updBusy = true; u.textContent = want; updBusy = false; } };
  setInterval(upd, 2000);
  (function watch(){ const u = document.getElementById('upd'); if(!u || typeof MutationObserver !== 'function'){ setTimeout(watch, 500); return; }
    new MutationObserver(upd).observe(u, {childList:true, characterData:true, subtree:true}); })();
  if(!RM){
    (function w(){ setTimeout(()=>{ if(!paused()) try{ wander(); }catch(e){} w(); }, PHONE ? R(600, 1500) : R(250, 800)); })();
    (function x(){ setTimeout(()=>{ if(!paused()) try{ crossover(); }catch(e){} x(); }, R(8000, 16000)); })();
  }

  // ---------- tweets: frame_feed.js reads the story group in focus (rotates about every 14 s among settled groups)
  let focus = null, focusAt = 0, focusI = 0;
  function focusGroup(){
    const ok = S.groups.filter(g => !g.gone && g.cuts.length && Date.now() - g.born > 5000);
    if(focus && !focus.gone && ok.includes(focus) && Date.now() - focusAt < 14000) return focus;
    if(!ok.length){ focus = null; return null; }
    focus = ok[focusI++ % ok.length]; focusAt = Date.now(); return focus;
  }
  root.thrydStageFocus = function(){
    const g = focusGroup();
    if(!g) return {id: '', title: '', objects: []};
    return {id: g.mid, title: g.title || '', objects: g.cuts.map(c => { const p = framePct(c, g); return {id: c.label, label: c.label, klass: c.klass || '', name: '', x: p.x, y: p.y, dragged: !!c.dragged}; })};
  };
  root.thrydStageBubble = function(){
    const g = focus && !focus.gone ? focus : null; if(!g || !g.cuts.length) return null;
    let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
    g.cuts.forEach(c => { const q = c.el.getBoundingClientRect(); l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); });
    if(r < 0 || l > vw()) return null;
    const right = (l + r) / 2 > vw() / 2;
    return {left: l, right: r, top: t, height: b - t, r: right};
  };
  S.stats = ()=>({groups: S.groups.length, stories: [...new Set(S.groups.map(g => g.mid))], cuts: S.cuts.length, cap: CAP, maxSeen: S.maxSeen, mb: +(S.bytes / 1048576).toFixed(1), spawned: S.spawned, left: S.left, fails: S.fails, carries: S.carries || 0, loading: S.loading, visible: S.groups.filter(g => { const v = view(); return g.x < v.x + v.w && g.x + g.w > v.x && g.y < v.y + v.h && g.y + g.h > v.y; }).length, cam: {x: Math.round(cam.x), y: Math.round(cam.y)}, ready: S.ready.length, fill: S.fill(), loop: S.loop, worker: WK.off ? 'off' : 'on', decodeMs: WK.ms.length ? Math.round(WK.ms.reduce((a, b) => a + b, 0) / WK.ms.length) : null, focus: focus && focus.mid, rm: RM, phone: PHONE});

  // ---------- black / white stage (Jesuye 12:03 AM "add a switch for black or white"): a button beside mute/reset, saved per device
  // (localStorage thryd_stage_bg). White turns the page, the stage and the dark overlays white and flips light text to dark.
  const BGK = 'thryd_stage_bg';
  const wcss = document.createElement('style'); wcss.id = 'stagewhite';
  // every rule is scoped to the live stage, so REPLAY, CEREBRO and LOVEMAP keep their own look. Colours picked by a contrast scan
  // of every visible text node on white (all >= 4.5:1 after this, the LIVE clock and the right-side place labels included).
  const WS = 'body.stage-white:not(.stage-replay):not(.cerebro):not(.lovemap)';
  wcss.textContent = [
    'body.stage-white:not(.stage-replay):not(.cerebro):not(.lovemap){background:#fff!important}',
    WS + ' #gstage{background:#fff!important}',
    WS + ' #vignette{display:none!important}',
    WS + ' #gstage .gtag{background:#fffe;color:#111;box-shadow:0 0 0 1px #0002}',
    WS + ' #gstage .gtag.gcarry{color:#7a4a00}',
    WS + ' #live,' + WS + ' #live *{text-shadow:0 0 3px #fff,0 0 6px #fff}',
    WS + ' #clk{color:#111!important}',
    WS + ' #live b{color:#c00000!important}',
    WS + ' #code{text-shadow:0 0 3px #fff,0 0 6px #fff}',
    WS + ' #code,' + WS + ' #code div{color:#0b6b16!important}',
    WS + ' #code .d{color:#2e6b34!important}',
    WS + ' #code .a{color:#8a4b00!important}',
    WS + ' #ticker,' + WS + ' #ticker *{text-shadow:0 0 4px #fff,0 0 8px #fff!important}',
    WS + ' #world{color:#8a4b00!important}',
    WS + ' #upd{color:#1a1a1a!important}',
    WS + ' #meta{color:#4a4a4a!important}',
    WS + ' #cmove{color:#0b4f9a!important}',
    WS + ' #map .ph{color:#4a4a4a!important;text-shadow:0 0 3px #fff,0 0 6px #fff}',
    WS + ' #map .ph.here{color:#8a4b00!important}',
    WS + ' #zlvl{color:#333!important}',
    WS + ' #ents .chip{background:#1d1d1deb!important}', // chips keep a solid dark pill on white, so their own light label colours stay readable
    '@media (max-width:760px){body.stage1 #modes{max-width:100vw;overflow-x:auto;scrollbar-width:none}}', // phones: the bar scrolls so the black/white switch and + GIF are reachable
    '#bgmode{min-width:5.5em}'
  ].join('\n');
  document.head.appendChild(wcss);
  const setWhite = (on, save)=>{ document.body.classList.toggle('stage-white', !!on); const b = document.getElementById('bgmode'); if(b){ b.textContent = on ? '○ white' : '● black'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    if(save) try{ localStorage.setItem(BGK, on ? 'white' : 'black'); }catch(e){} S.white = !!on; };
  (function addBg(n){
    const mute = document.getElementById('mute'); if(!mute){ if(n < 100) setTimeout(()=> addBg(n + 1), 100); return; }
    if(document.getElementById('bgmode')) return;
    const b = document.createElement('button'); b.id = 'bgmode'; b.type = 'button'; b.title = 'Black or white stage background (saved on this device)';
    mute.parentNode.insertBefore(b, mute.nextSibling);
    b.addEventListener('click', ev => { ev.stopPropagation(); setWhite(!document.body.classList.contains('stage-white'), true); });
    let v = null; try{ v = localStorage.getItem(BGK); }catch(e){}
    setWhite(v === 'white', false);
  })(0);

  // ---------- panels: REPLAY uses the classic single-scene view; LIVE comes back to the stage; CEREBRO/LOVEMAP overlay either
  const toReplay = on => { S.hold = !on; document.body.classList.toggle('stage-replay', !!on);
    if(!on){ try{ MC.detach && MC.detach(); }catch(e){} } note(on ? 'mode replay (classic view)' : 'mode live (stage)'); };
  try{ if(/(?:^|[?&])mode=replay(?:&|$)/.test(location.search)) toReplay(true); }catch(e){}
  document.querySelectorAll('#modes button[data-m]').forEach(b => b.addEventListener('click', ()=>{
    const m = b.dataset.m; if(m === 'replay') toReplay(true); else if(m === 'live') toReplay(false); }, true));
  // the medium-id search and Resume put that exact scene on the stage (as its own group) instead of pinning a slide
  async function showOnStage(mid){
    if(!manifest) return null;
    const row = (manifest.assets || []).find(a => a && a.medium_image_id === mid && a.status === 'ready'); if(!row) return null;
    let g = S.groups.find(x => x.mid === mid && !x.gone);
    if(!g){
      while(S.cuts.length > CAP - PER_GROUP && S.groups.length) exitGroup(S.groups.slice().sort((a, b) => a.born - b.born)[0], true);
      S.loading++;
      try{ spawn(row, await loadGroup(row)); }catch(e){ note('library skip', mid, String(e && e.message || e)); return null; } finally{ S.loading--; }
      g = S.groups.find(x => x.mid === mid && !x.gone); if(g) g.life += 60000;
    }
    if(g && !RM) camGo(g.x + g.w / 2 - vw() / 2, g.y + g.h / 2 - vh() / 2, 6000);
    return g ? g.mid : null;
  }
  S.showOnStage = showOnStage;
  (function wrapLib(n){
    const L = root.thrydLibrary; if(!L || !L.show){ if(n < 200) setTimeout(()=> wrapLib(n + 1), 100); return; }
    if(L._stage) return; const orig = L.show.bind(L);
    L.show = function(id){ if(!S.hold) return orig(id); const q = String(id || '').trim();
      const ok = manifest && (manifest.assets || []).some(a => a && a.medium_image_id === q && a.status === 'ready');
      if(!manifest){ S.pendingLib = q; return 'stage:' + q; }
      if(!ok) return orig(id); showOnStage(q); try{ root.ThrydKeep && root.ThrydKeep.rememberGif(q); }catch(e){} return 'stage:' + q; };
    L._stage = true;
  })(0);

  MC.loadManifest().then(m => { manifest = m || {assets: []}; note('manifest', (manifest.assets || []).length + ' assets'); spawner();
    let q = S.pendingLib; try{ q = q || new URLSearchParams(location.search).get('mlib'); }catch(e){} if(q) showOnStage(String(q).trim()); }).catch(()=>{ manifest = {assets: []}; });
})(typeof window !== 'undefined' ? window : globalThis);
