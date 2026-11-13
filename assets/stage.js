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
  const CAP = PHONE ? 28 : 56;               // cuts on screen at once
  const MAX_GROUPS = PHONE ? 15 : 30;     // most scenes carry 1-2 cuts, so the cut count comes from many groups
  const PER_GROUP = PHONE ? 4 : 6;
  const MAXF = PHONE ? 10 : 20;              // stored frames per animated cut (longer GIFs keep every k-th frame, delays summed)
  const BUDGET = (PHONE ? 90 : 260) * 1048576; // decoded bitmap bytes held by the stage
  const PG_MAX = (PHONE ? 6 : 16) * 1048576;  // one group's sprite frames; bigger ones are drawn at a lower resolution
  const INFLIGHT = 2;                         // groups decoding at the same time (each decodes one frame per task)
  const BG_P = PHONE ? 0.35 : 0.55;           // share of groups that get the faded source-frame backdrop
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
    '#gstage .gbg{position:absolute;pointer-events:none;opacity:0;transition:opacity 3.5s ease;-webkit-mask-image:radial-gradient(ellipse 50% 50% at 50% 50%,#000 45%,transparent 100%);mask-image:radial-gradient(ellipse 50% 50% at 50% 50%,#000 45%,transparent 100%)}',
    '#gstage .gbg.on{opacity:.28}',
    '#gstage .gcut{position:absolute;pointer-events:auto;touch-action:none;cursor:grab;transform-origin:50% 85%;user-select:none}',
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

  // ---------- camera: a slow drift across a world about 2.2 x 1.7 screens
  const W = {w:0, h:0};
  const sizeWorld = ()=>{ W.w = Math.round(vw() * (PHONE ? 1.6 : 1.7)); W.h = Math.round(vh() * (PHONE ? 1.3 : 1.35)); world.style.width = W.w + 'px'; world.style.height = W.h + 'px'; };
  sizeWorld();
  const cam = {x:(W.w - vw()) / 2, y:(W.h - vh()) / 2, fx:0, fy:0, tx:0, ty:0, t0:0, dur:1, paused:0};
  cam.fx = cam.tx = cam.x; cam.fy = cam.ty = cam.y;
  const clampCam = ()=>{ cam.x = Math.max(0, Math.min(W.w - vw(), cam.x)); cam.y = Math.max(0, Math.min(W.h - vh(), cam.y)); };
  function newTarget(now){
    cam.fx = cam.x; cam.fy = cam.y;
    cam.tx = R(0, Math.max(0, W.w - vw())); cam.ty = R(0, Math.max(0, W.h - vh()));
    const d = Math.hypot(cam.tx - cam.fx, cam.ty - cam.fy);
    cam.dur = Math.max(18000, d / (vw() * 0.014) * 1000); cam.t0 = now;
  }
  let lastT = 0;
  function frame(now){
    const dt = lastT ? now - lastT : 0; lastT = now;
    if(!RM){
      if(paused()) cam.t0 += dt;               // hold the pan while dragging / hidden
      else {
        if(!cam.t0) newTarget(now);
        let k = (now - cam.t0) / cam.dur;
        if(k >= 1){ cam.x = cam.tx; cam.y = cam.ty; newTarget(now); k = 0; }
        const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        cam.x = cam.fx + (cam.tx - cam.fx) * e; cam.y = cam.fy + (cam.ty - cam.fy) * e;
      }
    }
    clampCam();
    world.style.transform = 'translate3d(' + (-cam.x).toFixed(1) + 'px,' + (-cam.y).toFixed(1) + 'px,0)';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  root.addEventListener('resize', ()=>{ sizeWorld(); clampCam(); cam.t0 = 0; });
  const view = ()=>({x:cam.x, y:cam.y, w:vw(), h:vh()});

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
  function placeGroup(Dw, Dh){
    const v = view(); let best = null;
    // now and then a story lands right beside another one, so clusters of stories share a corner of the stage
    const nb = S.near && !S.near.gone ? S.near : null; S.near = null;
    for(let t = 0; t < 14; t++){
      let gx = R(v.x - Dw * 0.15, v.x + v.w - Dw * 0.85), gy = R(v.y + v.h * 0.04, v.y + v.h * 0.9 - Dh);
      if(nb && t < 8){ gx = nb.x + (Math.random() < .5 ? -Dw * R(.55, .85) : nb.w * R(.55, .85)); gy = nb.y + R(-.25, .25) * Dh; }
      gx = Math.max(0, Math.min(W.w - Dw, gx)); gy = Math.max(0, Math.min(W.h - Dh, gy));
      let ov = 0;
      S.groups.forEach(g => { const ix = Math.max(0, Math.min(gx + Dw, g.x + g.w) - Math.max(gx, g.x)), iy = Math.max(0, Math.min(gy + Dh, g.y + g.h) - Math.max(gy, g.y)); ov += ix * iy; });
      if(!best || ov < best.ov) best = {gx, gy, ov};
      if(!ov) break;
    }
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
    let Dh = vh() * (PHONE ? R(0.17, 0.28) : R(0.20, 0.36)), k = Dh / fh;
    if(fw * k > vw() * (PHONE ? 0.6 : 0.42)) k = vw() * (PHONE ? 0.6 : 0.42) / fw;
    Dh = fh * k; const Dw = fw * k; let s = Math.min(1, k * DPR);
    const animated = plan.kind === 'gif' && plan.frameCount > 1;
    const step = animated ? Math.max(1, Math.ceil(plan.frameCount / MAXF)) : 1;
    const nf = animated ? Math.ceil(plan.frameCount / step) : 1;
    let est = objs.reduce((n, x) => n + Math.ceil(x.U.w * s) * Math.ceil(x.U.h * s) * 4, 0) * nf;
    if(est > PG_MAX){ s *= Math.sqrt(PG_MAX / est); est = PG_MAX; }
    if(S.bytes + est > BUDGET) throw new Error('budget');
    const wantBg = Math.random() < BG_P;
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
    return {plan, fw, fh, k, Dw, Dh, s, objs, frames, delays, bg, animated, kind: plan.kind};
  }

  function bytesOf(list){ return list.reduce((n, b) => n + (b ? b.width * b.height * 4 : 0), 0); }
  function spawn(row, L){
    const pos = placeGroup(L.Dw, L.Dh); const v = view();
    const g = {mid: row.medium_image_id, row, kind: L.kind, x: pos.gx, y: pos.gy, w: L.Dw, h: L.Dh, k: L.k, fw: L.fw, fh: L.fh,
      title: titleOf(row.medium_image_id), born: Date.now(), life: (PHONE ? R(30, 50) : R(35, 70)) * 1000, cuts: [], gone: false, offSince: 0, sha: row.source_sha256 || '', ver: row.pack_version || '1'};
    if(L.bg){
      const c = document.createElement('canvas'); c.className = 'gbg'; c.width = L.bg.width; c.height = L.bg.height;
      c.getContext('2d').drawImage(L.bg, 0, 0); L.bg.close && L.bg.close();
      Object.assign(c.style, {left: (g.x - g.w * 0.08) + 'px', top: (g.y - g.h * 0.08) + 'px', width: (g.w * 1.16) + 'px', height: (g.h * 1.16) + 'px'});
      bgs.appendChild(c); g.bgEl = c; S.bytes += c.width * c.height * 4; g.bgBytes = c.width * c.height * 4;
      setTimeout(()=> c.classList.add('on'), 60);
    }
    if(g.title){ const t = document.createElement('div'); t.className = 'gtag'; t.textContent = String(g.title).slice(0, 60); Object.assign(t.style, {left: (g.x + g.w / 2) + 'px', top: (g.y + g.h + 6) + 'px'}); cutsL.appendChild(t); g.tag = t;
      setTimeout(()=> t.classList.add('on'), 2500); setTimeout(()=> t.classList.remove('on'), 11000); }
    const gcx = g.x + g.w / 2 - v.x, gcy = g.y + g.h / 2 - v.y;
    const edges = [['l', gcx], ['r', v.w - gcx], ['t', gcy * 1.6], ['b', (v.h - gcy) * 1.6]].sort((a, b) => a[1] - b[1]);
    const edge = edges[0][0];
    L.objs.forEach((x, j) => {
      const fr = L.frames[j]; if(!fr.length) return;
      const c = document.createElement('canvas'); c.className = 'gcut' + (RM ? '' : ' fl'); c.width = fr[0].width; c.height = fr[0].height;
      c.getContext('2d').drawImage(fr[0], 0, 0);
      const cut = {g, home: g, el: c, frames: fr, label: x.o.label || ('cut' + (x.k + 1)), klass: x.o.model_class || x.o.label || null, i: x.k, U: x.U,
        w: x.U.w * g.k, h: x.U.h * g.k, hx: g.x + x.U.x * g.k, hy: g.y + x.U.y * g.k, entering: true, bytes: bytesOf(fr), area: (x.U.w * x.U.h) / (g.fw * g.fh)};
      cut.left = cut.hx; cut.top = cut.hy;
      Object.assign(c.style, {left: cut.left + 'px', top: cut.top + 'px', width: cut.w + 'px', height: cut.h + 'px', zIndex: String(10 + Math.round(x.U.y + x.U.h))});
      c.style.setProperty('--fd', R(5.5, 9).toFixed(2) + 's'); c.style.setProperty('--fdl', (-R(0, 6)).toFixed(2) + 's');
      S.bytes += cut.bytes; S.cuts.push(cut); g.cuts.push(cut);
      bindDrag(cut);
      // in from the nearer screen edge, staggered
      const sx = cut.left - v.x, sy = cut.top - v.y;
      const off = edge === 'l' ? [-(sx + cut.w + 60), R(-.04, .04) * v.h] : edge === 'r' ? [v.w - sx + 60, R(-.04, .04) * v.h] : edge === 't' ? [R(-.05, .05) * v.w, -(sy + cut.h + 60)] : [R(-.05, .05) * v.w, v.h - sy + 60];
      c.style.opacity = '0';
      if(!RM){ c.style.transition = 'none'; c.style.translate = off[0].toFixed(0) + 'px ' + off[1].toFixed(0) + 'px'; }
      cutsL.appendChild(c);
      const dur = RM ? 2 : R(4.5, 7.5), delay = j * R(400, 1300);
      setTimeout(()=>{
        c.style.transition = RM ? 'opacity 2s' : 'translate ' + dur.toFixed(2) + 's cubic-bezier(.22,.1,.25,1), opacity 1.4s';
        requestAnimationFrame(()=>{ c.style.opacity = '1'; if(!RM) c.style.translate = '0px 0px'; });
        setTimeout(()=>{ cut.entering = false; if(!cut.wan){ c.style.transition = ''; c.style.translate = ''; } }, dur * 1000 + 100);
      }, delay + 80);
    });
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
  function animate(g, delays){
    let f = 0;
    const tick = ()=>{
      if(g.gone && !S.cuts.some(c => c.home === g)) return;
      if(!document.hidden && !document.body.classList.contains('cerebro')){
        f = (f + 1) % delays.length;
        S.cuts.forEach(cut => { if(cut.home !== g || !cut.frames[f]) return; const x = cut.el.getContext('2d'); x.clearRect(0, 0, cut.el.width, cut.el.height); x.drawImage(cut.frames[f], 0, 0); });
      }
      g.timer = setTimeout(tick, Math.max(40, delays[f] || 100));
    };
    g.timer = setTimeout(tick, Math.max(40, delays[0] || 100));
  }
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
    const v = view();
    g.cuts.slice().forEach((cut, j) => {
      const go = ()=>{
        if(cut.dragging){ setTimeout(go, 1200); return; }
        if(quick || RM){ cut.el.style.transition = 'opacity 1.5s'; cut.el.style.opacity = '0'; setTimeout(()=> unloadCut(cut), quick ? 10 : 1600); return; }
        foldTranslate(cut); cut.leaving = true;
        const sx = cut.left - v.x + cut.w / 2, sy = cut.top - v.y + cut.h / 2;
        const d = [['l', sx], ['r', v.w - sx], ['t', sy * 1.6], ['b', (v.h - sy) * 1.6]].sort((a, b) => a[1] - b[1])[0][0];
        const dx = d === 'l' ? -(sx + cut.w + 80) : d === 'r' ? v.w - sx + cut.w + 80 : R(-.05, .05) * v.w;
        const dy = d === 't' ? -(sy + cut.h + 80) : d === 'b' ? v.h - sy + cut.h + 80 : R(-.04, .04) * v.h;
        const dur = R(5, 8);
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
      document.body.classList.add('dragmode');
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
      try{ document.body.classList.remove('dragmode'); }catch(e){}
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
    let dx = (Math.random() < .5 ? -1 : 1) * R(.04, .14) * v.w, dy = R(-.03, .03) * v.h;
    dx = Math.max(-cut.left, Math.min(W.w - cut.w - cut.left, dx)); dy = Math.max(-cut.top, Math.min(W.h - cut.h - cut.top, dy));
    if(Math.abs(dx) < .02 * v.w) return;
    const from = framePct(cut, cut.g);
    cut.wan = true; const dur = 3.2 + Math.abs(dx) / v.w * 14, el = cut.el;
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
    setTimeout(back, dur * 1000 + R(2500, 8500));
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
  async function spawnOne(){
    if(S.loading >= INFLIGHT || !manifest) return;
    if(S.groups.length + S.loading >= MAX_GROUPS || S.cuts.length >= CAP) return;
    const row = pickRow(); if(!row) return;
    S.recent.push(row.medium_image_id); if(S.recent.length > 40) S.recent.shift(); // never picked twice while it decodes
    S.loading++;
    try{ const L = await loadGroup(row); if(S.cuts.length >= CAP){ L.frames.forEach(f => f.forEach(b => b.close && b.close())); } else spawn(row, L); }
    catch(e){ const why = String(e && e.message || e); if(why !== 'cap' && why !== 'budget') S.bad.add(row.medium_image_id); else S.recent.push(row.medium_image_id); S.fails++; note('skip', row.medium_image_id, why); }
    finally{ S.loading--; }
  }
  function spawner(){
    const wait = S.groups.length < MAX_GROUPS * 0.4 ? R(250, 700) : R(900, 2200);
    setTimeout(()=>{ if(!paused()) spawnOne(); spawner(); }, wait); // overlapping: the next wave does not wait for this one to decode
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
    (function w(){ setTimeout(()=>{ if(!paused()) try{ wander(); }catch(e){} w(); }, PHONE ? R(1800, 4000) : R(1000, 2600)); })();
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
  S.stats = ()=>({groups: S.groups.length, stories: [...new Set(S.groups.map(g => g.mid))], cuts: S.cuts.length, cap: CAP, maxSeen: S.maxSeen, mb: +(S.bytes / 1048576).toFixed(1), spawned: S.spawned, left: S.left, fails: S.fails, carries: S.carries || 0, loading: S.loading, visible: S.groups.filter(g => { const v = view(); return g.x < v.x + v.w && g.x + g.w > v.x && g.y < v.y + v.h && g.y + g.h > v.y; }).length, cam: {x: Math.round(cam.x), y: Math.round(cam.y)}, focus: focus && focus.mid, rm: RM, phone: PHONE});

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
    if(g && !RM){ cam.fx = cam.x; cam.fy = cam.y; cam.tx = Math.max(0, Math.min(W.w - vw(), g.x + g.w / 2 - vw() / 2)); cam.ty = Math.max(0, Math.min(W.h - vh(), g.y + g.h / 2 - vh() / 2)); cam.t0 = performance.now(); cam.dur = 6000; }
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
