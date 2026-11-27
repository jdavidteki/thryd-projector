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

  // S.bad (Jesuye 15 Nov 2026 11:56 AM ET "after every few hours ... only text objects are on the screen. no gif or image objects go in
  // and out"): it used to be a Set that kept every failed item out for good. A wifi drop, a laptop sleep or a slow CDN made every
  // GIF/image/agenda load fail at ~2 a second, so a few minutes offline blacklisted the whole catalogue until a reload, and only the
  // text chips (drawn locally, no network) kept coming. Now a failure only cools an item down (network: 1 min doubling to 15 min;
  // other errors: 10 min doubling to 6 h), a run of network failures pauses media loads instead of blaming items (S.net), and a
  // success clears the item. Same has / add / size API as before.
  function Cooldown(){ const m = new Map(), NET = /fetch|network|load failed|live_view_fetch|sprite|worker_timeout|worker_down|err_/i;
    return {
      add(id, why){ if(!id) return; const w = String(why || ''), net = NET.test(w), e = m.get(id) || {n: 0}; e.n++;
        e.until = Date.now() + Math.min(net ? 15 * 60e3 : 6 * 3600e3, (net ? 60e3 : 10 * 60e3) * Math.pow(2, Math.min(e.n - 1, 10))); e.why = w; m.set(id, e); return net; },
      has(id){ const e = m.get(id); return !!e && Date.now() < e.until; },
      ok(id){ m.delete(id); }, delete(id){ return m.delete(id); }, clear(){ m.clear(); },
      release(){ let n = 0; m.forEach(e => { if(Date.now() < e.until){ e.until = 0; n++; } }); return n; }, // keep n (backoff), drop the wait
      get size(){ let n = 0; const t = Date.now(); m.forEach(e => { if(t < e.until) n++; }); return n; },
      isNet: w => NET.test(String(w || '')), entries: () => [...m.entries()]
    }; }
  const S = root.__thrydStage = {on:true, hold:true, groups:[], cuts:[], bytes:0, loading:0, near:null, spawned:0, left:0, fails:0, recent:[], bad:Cooldown(), log:[], maxSeen:0,
    net: {hold: 0, k: 0, fails: [], holds: 0}, lastMedia: Date.now(), mediaAt: Date.now(), releases: 0};
  // network breaker: 4 network failures inside 30 s (or the browser saying it is offline) pause media loads 15 s, doubling to 5 min;
  // the items that failed are not blamed for it. Back online or a good load resets it.
  function netFail(){ const t = Date.now(), N = S.net; N.fails = N.fails.filter(x => t - x < 30000); N.fails.push(t);
    if(N.fails.length >= 4 || navigator.onLine === false){ N.hold = t + Math.min(300000, 15000 * Math.pow(2, Math.min(N.k++, 5))); N.holds++; N.fails = []; } }
  function netOk(){ S.net.k = 0; S.net.fails = []; }
  const netHeld = ()=> navigator.onLine === false || Date.now() < S.net.hold;
  addEventListener('online', ()=>{ S.net.hold = 0; S.net.k = 0; S.bad.release(); });
  function failed(id, why){ const w = String(why || ''); if(S.bad.isNet(w) || navigator.onLine === false){ netFail(); if(navigator.onLine === false) return; } if(isNewestId(id)){ note('live view keep', id, w); return; } S.bad.add(id, w); }
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
  // v617 heat (Jesuye 26 Nov 2026 1:16 AM ET "or even 10"): one config for how many story objects (cuts) may be on the
  // stage at once; older groups walk off and new ones rotate in. Pins do not count. Change CAP_DEFAULT to retune;
  // ?cap=N overrides for QA (e.g. ?cap=20 or ?cap=36). v610 had set this at 36 (desktop 72→36, same as phone).
  const CAP_DEFAULT = 36;
  const CAP = (function(){ try{ const n = +(new URLSearchParams(location.search).get('cap')); if(n >= 1 && n <= 200) return Math.floor(n); }catch(e){} return CAP_DEFAULT; })();
  // v618 (Jesuye 26 Nov 2026 1:46 AM ET): hold 10 picture objects most of the time. SOFT_CAP equals CAP, so
  // the oldest is evicted only to make room for an incoming group (not early at 8). MAX_GROUPS is large enough
  // that the cut cap is the limit. A group that will not fit evicts the oldest instead of being skipped.
  const SOFT_CAP = CAP; // evict only to make room for an incoming group, never walk off early
  const MAX_GROUPS = Math.max(CAP * 4, 16); // plenty of groups; the cut cap is the limit
  const PER_GROUP = PHONE ? 4 : 6;
  const READY = PHONE ? 1 : 2;               // decoded groups kept in the wings
  const MAXF = PHONE ? 10 : 20;                // stored frames per animated cut (v635 funback: phone 8→10, undoing v608)
  const BUDGET = (PHONE ? 90 : 260) * 1048576; // v635 funback: phone 60→90 MB (v608 had cut this for Fold memory/heat)
  // pins float on the stage but never count toward CAP, MAX_GROUPS, or the byte budget (Jesuye 17 Nov 9:57 PM ET)
  const isLeaving = c => !!(c && (c.leaving || (c.g && c.g.gone)));
  const storyCuts = ()=> S.cuts.filter(c => !c.map);
  const activeStoryCuts = ()=> S.cuts.filter(c => !c.map && !isLeaving(c));
  const storyGroups = ()=> S.groups.filter(g => !g.map && !g.gone);
  S.storyCuts = storyCuts; S.activeStoryCuts = activeStoryCuts; S.storyGroups = storyGroups; S.CAP = CAP; S.CAP_DEFAULT = CAP_DEFAULT; S.SOFT_CAP = SOFT_CAP; S.MAX_GROUPS = MAX_GROUPS;
  const PG_MAX = (PHONE ? 6 : 16) * 1048576;  // one group's sprite frames; bigger ones are drawn at a lower resolution
  const INFLIGHT = PHONE ? 1 : 2;             // groups decoding at the same time (in the decode worker, off the main thread)
  const BG_P = PHONE ? 0.8 : 0.9;             // share of groups that get the faded source-frame backdrop (covers the gaps)
  // live views (Jesuye 14 Nov 2026 8:52 AM ET): newest final jN GIFs jump the queue and stay ~2.5× as long as a normal cut
  const LIVE_DWELL_K = 4;                      // v646 (was 2.5): vs a normal group life of 30–50s (phone) or 35–70s (desktop)
  const ANIM_DWELL_K = 3.5;                    // v646 (was 2, and Medium GIF groups were 1x): every animated group (Medium GIF or still with a manifest anim) stays 3.5x a plain still
  S.ANIM_DWELL_K = ANIM_DWELL_K;
  // v646 (Jesuye 27 Nov 2026 4:53 PM ET "make the live ones stay longer - there should always be at least 10 live objects on screen"):
  // a floor of LIVE_FLOOR animated cuts (cuts with more than one frame: Medium GIF cuts, anim-manifest cuts, live-view cuts).
  // A group whose leaving would drop the stage under the floor does not leave on 'life' or get evicted for room; while under
  // the floor the deck prefers GIFs and stills with an anim. With fewer than LIVE_FLOOR animated cuts available, all of them stay.
  const LIVE_FLOOR = 10;
  const isLiveCut = c => !!(c && !c.map && !isLeaving(c) && c.frames && c.frames.length > 1);
  const liveCutsOn = ()=> S.cuts.filter(isLiveCut).length;
  const groupLiveCuts = g => (g && g.cuts ? g.cuts.filter(isLiveCut).length : 0);
  function floorHolds(g){ const n = groupLiveCuts(g); return n > 0 && liveCutsOn() - n < LIVE_FLOOR; }
  S.LIVE_FLOOR = LIVE_FLOOR; S.liveCutsOn = liveCutsOn; S.floorHolds = floorHolds; S.isLiveCut = isLiveCut;
  const LIVE_POLL_MS = 45000;                  // at most as often as the data loop; do not poll faster
  const LIVE_KEEP = 3;                         // most recent 1–3 of the current agenda recur more often than ordinary cuts
  // a live view that has left stays off for a while before it recurs (fix 14 Nov 9:45 AM ET: they came straight back, so they
  // looked pinned). A brand-new view still comes on at once; the rest still return far sooner than a Medium cut (one per deck cycle).
  const LIVE_COOL_MS = (PHONE ? 120 : 150) * 1000;
  S.LIVE_DWELL_K = LIVE_DWELL_K; S.LIVE_POLL_MS = LIVE_POLL_MS; S.LIVE_KEEP = LIVE_KEEP;
  // live-view cutouts (Jesuye 14 Nov 2026 9:05 AM ET "cut them as they come"; 17 Nov 9:18 PM ET "i see an uncut liveview"):
  // a view with a pack (tools/cut_live_views.py, same per-frame mask pack as the Medium cuts) comes on as animated cutouts
  // only. The stage never mounts the raw GIF — not as a .gcut, not as a .gbg plate, and not as a cut-load fallback.
  // If the cut is not ready or fails, this view is skipped (the last cut view of the agenda can stay).
  // fresh plates (9:08 AM ET "less blurry and faded ... so customers can tell where they are"): the current agenda's newest 1–3
  // live views get a sharper, stronger plate. Normal plates: alpha 0.34, solid to 45% of the oval, drawn at 0.7× (phone 0.55×) of
  // the group scale then stretched ~2.2–2.6× (the soft look). Fresh: alpha 0.80, solid to 70%, drawn at 2.8× (phone 2.2×), i.e. ~4×
  // the pixels per side (a quarter of the softness), capped at the source size. Older live views and regular cuts keep the normal look.
  const BG_NORMAL = {A: 0.34, solid: 0.45, res: PHONE ? 0.55 : 0.7};
  const BG_FRESH = {A: 0.80, solid: 0.70, res: PHONE ? 2.2 : 2.8};
  S.BG_NORMAL = BG_NORMAL; S.BG_FRESH = BG_FRESH;
  const DPR = Math.min(root.devicePixelRatio || 1, PHONE ? 1 : 1.25);
  const vw = ()=> root.innerWidth || 1280, vh = ()=> root.innerHeight || 720;
  const overlayHost = ()=> document.getElementById('canvas') || document.body;
  const zsc = ()=>{ const z = root.thrydZoom && thrydZoom.get && thrydZoom.get().z; return (z && z > 0) ? z : 1; };
  const toLocal = (x, y)=>{ if(root.thrydZoom && thrydZoom.toScene){ const p = thrydZoom.toScene(x, y); return {x:p[0], y:p[1]}; } return {x, y}; };
  const visBox = ()=>{ const z = zsc(), g = root.thrydZoom && thrydZoom.get && thrydZoom.get() || {tx:0,ty:0}; return {l: -g.tx/z, t: -g.ty/z, w: vw()/z, h: vh()/z}; };
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
    '#gstage .gbg{position:absolute;pointer-events:none;opacity:0;transition:opacity 3.5s ease;will-change:transform;backface-visibility:hidden}',
    '#gstage .gbg.on{opacity:1}',
    '#gstage .gbg.gm{-webkit-mask-image:radial-gradient(ellipse 50% 50% at 50% 50%,#000 45%,transparent 100%);mask-image:radial-gradient(ellipse 50% 50% at 50% 50%,#000 45%,transparent 100%)}', // main-thread fallback only
    '#gstage .gbg.gm.on{opacity:.34}',
    '#gstage .gbg.glive.on{opacity:.34;filter:saturate(.9)}',
    '#gstage .gbg.gm.gfresh.on,#gstage .gbg.glive.gfresh.on{opacity:.8;filter:none}',
    '#gstage img.gcut,#gstage img.gbg{display:block;max-width:none;-webkit-user-drag:none}',
    '#gstage .gcut{position:absolute;pointer-events:auto;touch-action:none;cursor:grab;transform-origin:50% 85%;user-select:none;will-change:transform,translate,opacity;backface-visibility:hidden}',
    // v635 funback: CSS mcfloat with the +-1.8deg rotation is back (v612 had replaced it with a JS ticker and no rotate).
    '#gstage .gcut.fl{animation:mcfloat var(--fd,7s) ease-in-out var(--fdl,0s) infinite}',
    '#gstage .gcut[data-dragging="1"]{animation:none;transform:none;cursor:grabbing;z-index:9999!important}',
    '#gstage .gcut.gnotice{animation:mcnotice 1.1s ease-out 1 both}',
    '#gstage .gtag{position:absolute;transform:translateX(-50%);font:1.15vh ui-monospace,Menlo,monospace;color:#fff;background:#000a;padding:.15vh .5vw;border-radius:.6vh;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity 1.6s;max-width:40vw;overflow:hidden;text-overflow:ellipsis}',
    '#gstage .gtag.on{opacity:.85}',
    '#gstage .gtag.gcarry{color:#f0d7a2;z-index:9998}',
    '@media (prefers-reduced-motion:reduce){#gstage .gcut.fl,#gstage .gcut.gnotice{animation:none}}',
    '#gstage .gcut.gpin{overflow:hidden;background:transparent;border:0;box-shadow:none;width:40px;height:40px}',
    '#gstage .gcut.gpin.gmap-live{filter:drop-shadow(0 0 5px color-mix(in srgb, var(--pin, #f0c14b) 70%, transparent))}',
    '#gstage .gcut.gpin .gmappin{position:absolute;left:0;right:0;top:0;height:22px;width:auto;margin:0;border:0;border-radius:0;background:transparent !important;box-shadow:none;transform:none;display:flex;align-items:center;justify-content:center;font:15px/1 system-ui,"Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif;letter-spacing:-0.08em;text-shadow:0 1px 2px #000a;pointer-events:none;white-space:nowrap}',
    '#gstage .gcut.gpin .gmappin::after{content:none;display:none}',
    '#gstage .gcut.gpin .gmappin.live{animation:gpinpulse 1.8s ease-in-out infinite}',
    '@keyframes gpinpulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.25) drop-shadow(0 0 3px #fff8)}}',
    '#gstage .gcut.gpin .gpin-lab{position:absolute;left:1px;right:1px;bottom:1px;font:600 8px/1.05 "IBM Plex Mono",ui-monospace,monospace;color:#fff;text-align:center;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 0 3px #000,0 1px 2px #000c;pointer-events:none}',
    '#gpinpop{position:absolute;z-index:40;width:180px;padding:8px 8px 6px;background:#141210f2;border:1px solid #ffffff22;border-radius:8px;box-shadow:0 10px 24px #000c;color:#eee;transform:translateX(-50%);pointer-events:auto}',
    '#gpinpop .gpin-name{font:600 11px/1.25 "IBM Plex Sans",sans-serif;margin:0 0 2px}',
    '#gpinpop .gpin-meta{font:500 9px/1.2 "IBM Plex Mono",monospace;color:#bbb;margin:0 0 6px}',
    '#gpinpop .gpin-wxl{font:500 10px/1.2 "IBM Plex Mono",monospace;color:#eee;margin:0 0 6px}',
    '#gpinpop .gpin-prev{position:relative;width:164px;height:110px;overflow:hidden;border-radius:5px;background:#1a1814}',
    '#gpinpop .gpin-prev img{display:block;width:100%;height:100%;object-fit:cover;pointer-events:none}',
    '#gpinpop .gpin-prev .gmappin{position:absolute;width:14px;height:14px;margin:-10px 0 0 -7px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:1.5px solid #fff;pointer-events:none}',
    '#gpinpop .gpin-attr{position:absolute;right:3px;bottom:2px;font:500 7px/1 "IBM Plex Mono",monospace;color:#fff9;pointer-events:none}'

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
  // faded .gbg wander (Jesuye 13 Nov 2026 5:05 PM ET): the hole-filled scene plates drift around the stage on
  // their own, while cuts stay at the group's home and still migrate as before. There was no independent plate
  // motion before this (plates were pinned with left/top only). Speed is set at 2.67× the camera drift
  // (camera uses vw*0.006 px/s, min 14s legs, 400–2500ms pauses, trying to travel 0.45 of the small pan range).
  const BG_SPEED_K = PHONE ? 0.015 : 0.016;          // px/s = k * vw  (camera: 0.006; 0.016 ≈ 2.67×)
  const BG_TURN = PHONE ? [1600, 3200] : [1800, 3600]; // ms between heading changes (camera legs are ≥14s)
  const BG_TRAVEL = PHONE ? 0.42 : 0.50;             // max offset from the group's home, as a fraction of min(vw,vh)
  const BG_EASE = 0.35;                              // seconds to ease into a new heading (no jitter)
  S.bg = {speedK: BG_SPEED_K, turn: BG_TURN, travel: BG_TRAVEL, ease: BG_EASE, camSpeedK: 0.006};
  function bgRetarget(g, now, ang){
    const sp = BG_SPEED_K * vw();
    const a = ang == null ? Math.random() * Math.PI * 2 : ang;
    g.btx = Math.cos(a) * sp; g.bty = Math.sin(a) * sp;
    g.bTurn = now + R(BG_TURN[0], BG_TURN[1]);
  }
  function tickBgs(now, cap){
    const prev = tickBgs.t; tickBgs.t = now;
    if(RM || !prev) return;
    if(paused()) return;
    const dt = Math.min(cap || 0.05, (now - prev) / 1000);
    const rad = BG_TRAVEL * Math.min(vw(), vh());
    const k = 1 - Math.exp(-dt / BG_EASE);
    const E = PHONE ? 0.22 : 0.28;
    for(let i = 0; i < S.groups.length; i++){
      const g = S.groups[i], el = g.bgEl; if(!el || g.gone) continue;
      if(g.bx == null){ g.bx = 0; g.by = 0; g.bvx = 0; g.bvy = 0; bgRetarget(g, now); }
      if(now >= (g.bTurn || 0)) bgRetarget(g, now);
      g.bvx += (g.btx - g.bvx) * k; g.bvy += (g.bty - g.bvy) * k;
      g.bx += g.bvx * dt; g.by += g.bvy * dt;
      const d = Math.hypot(g.bx, g.by);
      if(d > rad && d > 1){
        const s = rad / d; g.bx *= s; g.by *= s;
        bgRetarget(g, now, Math.atan2(-g.by, -g.bx) + R(-0.8, 0.8));
      }
      const left = g.x - g.w * E, top = g.y - g.h * E, bw = g.w * (1 + 2 * E), bh = g.h * (1 + 2 * E);
      // only clamp an axis the plate actually fits on, so an oversized faded frame cannot flip between edges
      if(bw < W.w){ if(g.bx + left < 0) g.bx = -left; else if(g.bx + left + bw > W.w) g.bx = W.w - bw - left; }
      if(bh < W.h){ if(g.by + top < 0) g.by = -top; else if(g.by + top + bh > W.h) g.by = W.h - bh - top; }
      el.style.transform = 'translate3d(' + g.bx.toFixed(1) + 'px,' + g.by.toFixed(1) + 'px,0)';
    }
  }

  // one rAF loop: GIF frames of every group advance here, on the display's own clock (no per-group timers)
  const anims = new Set(); S.loop = {n:0, slow:0, max:0};
  // v612 heat: which cuts are on screen, checked ~3x a second (not per frame). Off-screen cuts skip their GIF redraw and their float pose.
  let visAt = 0;
  function markVis(now){
    if(now - visAt < 350 && now >= visAt) return; visAt = now;
    const w = vw(), h = vh(), m = 160;
    for(let i = 0; i < S.cuts.length; i++){ const c = S.cuts[i], el = c.el;
      if(!el || !el.isConnected){ c._vis = false; continue; }
      const r = el.getBoundingClientRect(); c._vis = r.right > -m && r.left < w + m && r.bottom > -m && r.top < h + m;
      // v617 heat: only promote on-screen cuts (off-screen will-change layers still cost compositor memory/GPU)
      if(c._vis){ if(c._wc !== 1){ el.style.willChange = 'transform'; c._wc = 1; } }
      else if(c._wc !== 0){ el.style.willChange = 'auto'; c._wc = 0; } }
  }
  S.markVis = markVis;
  function frame(now){
    const t0 = performance.now();
    if(!document.hidden && !document.body.classList.contains('cerebro')){
      markVis(now);
      anims.forEach(A => {
        const g = A.g; if(g.gone && !S.cuts.some(c => c.home === g)){ anims.delete(A); return; }
        if(now < A.due) return;
        let n = 0; while(now >= A.due && n++ < 4){ A.f = (A.f + 1) % A.delays.length; A.due += Math.max(40, A.delays[A.f] || 100); }
        if(now - A.due > 1000) A.due = now + 60; // after a pause, pick up again instead of racing
        for(let i = 0; i < S.cuts.length; i++){ const cut = S.cuts[i]; if(cut.home !== g || !cut.frames[A.f] || !cut.ctx || cut._vis === false) continue;
          cut._animFr = cut.frames[A.f]; cut.ctx.clearRect(0, 0, cut.el.width, cut.el.height); cut.ctx.drawImage(cut.frames[A.f], 0, 0); }
      });
      // v635 funback: plates drift on every display frame again (v612 had throttled them to ~11 Hz under the warp)
      tickBgs(now);
      // v636: ambient in-cut motion (and any command script) on visible cuts; skipped off-screen and when reduced-motion
      if(!RM && root.ThrydCutAnimate){
        const A = root.ThrydCutAnimate;
        for(let i = 0; i < S.cuts.length; i++){
          const cut = S.cuts[i];
          if(!cut || !cut.ctx || !cut.el || cut._vis === false || cut.dragging) continue;
          try{
            const src = (cut.frames && cut.frames.length > 1) ? (cut._animFr || null) : null;
            A.paintAmbient(cut, now, src);
          }catch(e){}
          if(cut.motion){ try{ if(A.applyScript(cut, cut.motion, now)) cut.motion = null; }catch(e){} }
        }
      }
    } else { tickBgs.t = 0; }
    const dt = performance.now() - t0; S.loop.n++; if(dt > 8) S.loop.slow++; if(dt > S.loop.max) S.loop.max = +dt.toFixed(1);
    scheduleFrame();
  }
  // v635 funback: the GIF/plate loop runs on every display frame while visible (v617 had slept until a GIF frame was due).
  // Off-screen cuts still skip their GIF redraw and drop will-change (invisible when off-screen).
  let frameArmed = 0;
  function frameHidden(){ return document.hidden || !!(root.LH && LH.state === 'hidden'); }
  function scheduleFrame(){
    if(frameHidden() || frameArmed) return;
    frameArmed = 1;
    requestAnimationFrame(function(now){ frameArmed = 0; if(frameHidden()) return; frame(now); });
  }
  scheduleFrame();
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) scheduleFrame(); });
  if(root.LH && LH.on) LH.on(function(s){ if(s !== 'hidden') scheduleFrame(); });
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
    // a decode that never answers (worker killed, GIF stuck) must not hold a loading slot forever: give up after 90 s
    return new Promise((ok, no) => { const tm = setTimeout(()=>{ if(WK.wait.has(id)){ WK.wait.delete(id); w.busy = Math.max(0, w.busy - 1); no(new Error('worker_timeout')); } }, 90000);
      WK.wait.set(id, {ok: v => { clearTimeout(tm); ok(v); }, no: e => { clearTimeout(tm); no(e); }}); w.postMessage(Object.assign({id}, msg), transfer); });
  }

  // ---------- groups
  // deck (11-13): every ready cut is shown once before any comes back, remembered across visits in localStorage
  const SEEN_K = 'thryd_seen_cuts_v1';
  let SEEN = new Set(); try{ SEEN = new Set(JSON.parse(localStorage.getItem(SEEN_K) || '[]')); }catch(e){}
  const saveSeen = ()=>{ try{ localStorage.setItem(SEEN_K, JSON.stringify([...SEEN])); }catch(e){} };
  function pickRow(){
    const live = (manifest.assets || []).filter(a => a && a.status === 'ready' && a.url && !S.bad.has(a.medium_image_id) &&
      !S.recent.includes(a.medium_image_id) && !S.groups.some(g => g.mid === a.medium_image_id));
    if(!live.length){ S.recent = S.recent.slice(-5); return null; }
    let ok = live.filter(a => !SEEN.has(a.medium_image_id));
    if(!ok.length){ SEEN = new Set(); saveSeen(); ok = live; }
    // live-view cut groups are kind 'gif' too (v505) but have their own lane: they must not use up the Medium GIF slots (fix 14 Nov 9:45 AM ET)
    const gifsOn = S.groups.filter(g => g.kind === 'gif' && !g.live).length;
    const gifShare = ok.filter(a => a.kind === 'gif').length / ok.length; // GIFs come up in proportion to how many are left, so 109 GIFs don't loop
    // v646 live floor: under LIVE_FLOOR animated cuts, take a GIF (or a still with a manifest anim) next; the byte budget still applies
    const under = liveCutsOn() < LIVE_FLOOR;
    const animStill = a => a.kind !== 'gif' && animMids().has(a.medium_image_id);
    if(under){
      const lp = ok.filter(animStill).concat(gifsOn < (PHONE ? 4 : 8) ? ok.filter(a => a.kind === 'gif') : []);
      const lp2 = lp.length ? lp : live.filter(animStill).concat(gifsOn < (PHONE ? 4 : 8) ? live.filter(a => a.kind === 'gif') : []);
      if(lp2.length){ const row = lp2[Math.random() * lp2.length | 0]; SEEN.add(row.medium_image_id); saveSeen(); return row; }
    }
    // v646: stills that have a real moving version come up often (about 1 pick in 3 while any is free), not 4 in 642
    if(Math.random() < 0.33){ const as = live.filter(animStill); if(as.length){ const row = as[Math.random() * as.length | 0]; SEEN.add(row.medium_image_id); saveSeen(); return row; } }
    const wantGif = gifsOn < (PHONE ? 1 : 2) && Math.random() < gifShare;
    const pool = ok.filter(a => (a.kind === 'gif') === wantGif);
    let from = pool.length ? pool : ok;
    // end of the deck: only GIFs are left unseen. Keep the GIF limit anyway (30 GIF groups at once, ~155 MB, was seen live) and
    // take a still that was already shown instead
    if(!pool.length && !wantGif){ const st = live.filter(a => a.kind !== 'gif'); if(st.length) from = st; }
    const row = from[Math.random() * from.length | 0];
    SEEN.add(row.medium_image_id); saveSeen();
    return row;
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
  function placeGroup(Dw, Dh, opts){
    const v = view();
    if(opts && opts.center){
      return {gx: v.x + (v.w - Dw) / 2, gy: v.y + (v.h - Dh) / 2 - Math.min(40, v.h * 0.04), sc: 1};
    }
    const c = coverGrid(v), cw = v.w / GX, ch = v.h / GY; let best = null;
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
  async function loadGroup(row0, man, lo){
    lo = lo || {};
    // long-session fix (15 Nov 2026, 2nd starvation report): expand the pack onto a throwaway copy of the row. Expanding onto the shared
    // manifest row kept every decoded pack (masks, plate) in memory for the whole session (~0.5 GB+ after one pass of the deck), until
    // fetches and decodes started failing and only the text chips (no network, no big buffers) still came on.
    const row = Object.assign({}, row0); if(Array.isArray(row.objects)) row.objects = row.objects.map(o => o ? Object.assign({}, o) : o);
    await MC.expandRow(row);
    const ext = ((String(row.url).split('?')[0].match(/\.([A-Za-z0-9]+)$/) || [])[1] || '').toLowerCase();
    const set = {how:'medium', remote:true, url:row.url, medium_image_id:row.medium_image_id, extension:ext, animated: row.kind === 'gif'};
    if(row.pack && row.plate_error === 'pack_missing' && !(row.objects && row.objects.length)) throw new Error('pack_fetch_missing'); // network class: short cooldown, retried
    const plan = MC.forSet(set, {assets: [row]});
    if(!plan.ok) throw new Error(plan.reason || 'plan');
    const fw = plan.width, fh = plan.height;
    if(lo.live) roomForLive(PER_GROUP);
    let objs = plan.objects.map((o, k) => ({o, k, U: unionBox(plan.kind === 'gif' ? o.masks : [o.masks[0]])})).filter(x => x.U && x.U.w > 2 && x.U.h > 2);
    objs.sort((a, b) => b.U.w * b.U.h - a.U.w * a.U.h);
    objs = objs.slice(0, Math.min(PER_GROUP, CAP));
    if(!objs.length) throw new Error('no_object');
    // on-screen size of the whole source frame for this group
    let Dh = lo.live ? vh() * (lo.newest ? (PHONE ? 0.44 : 0.52) : (PHONE ? R(0.28, 0.42) : R(0.32, 0.50))) : vh() * (PHONE ? R(0.18, 0.30) : R(0.22, 0.40)), k = Dh / fh;
    const wmax = lo.live ? (lo.newest ? (PHONE ? 0.86 : 0.72) : (PHONE ? 0.72 : 0.55)) : (PHONE ? 0.6 : 0.42);
    if(fw * k > vw() * wmax) k = vw() * wmax / fw;
    Dh = fh * k; const Dw = fw * k; let s = Math.min(1, k * DPR);
    const animated = plan.kind === 'gif' && plan.frameCount > 1;
    const step = animated ? Math.max(1, Math.ceil(plan.frameCount / MAXF)) : 1;
    const nf = animated ? Math.ceil(plan.frameCount / step) : 1;
    let est = objs.reduce((n, x) => n + Math.ceil(x.U.w * s) * Math.ceil(x.U.h * s) * 4, 0) * nf;
    if(est > PG_MAX){ s *= Math.sqrt(PG_MAX / est); est = PG_MAX; }
    if(S.bytes + est > BUDGET) throw new Error('budget');
    const wantBg = lo.live ? false : Math.random() < BG_P; // live views: cutouts only, never the uncut frame as a plate
    const BGL = lo.fresh ? BG_FRESH : BG_NORMAL;
    const animated0 = plan.kind === 'gif';
    if(!WK.off){ // the worker also fetches the file itself (HTTP cache), so multi-MB GIF bytes never pass through the page thread
      const bs = Math.min(1, k * BGL.res);
      const msg = {url: new URL(row.url, location.href).href, fw, fh, gif: animated0, frameCount: plan.frameCount, stillFrame: plan.still_frame | 0, step, delays_cs: plan.delays_cs,
        objs: objs.map(x => ({U: x.U, dw: Math.max(1, Math.round(x.U.w * s)), dh: Math.max(1, Math.round(x.U.h * s)),
          masks: animated0 ? x.o.masks.map((m, i) => i % step === 0 ? lite(m) : null) : [lite(x.o.masks[0])]})),
        bg: wantBg ? {w: Math.max(1, Math.round(fw * bs)), h: Math.max(1, Math.round(fh * bs)), plate: plan.plate || null, known: plan.plate ? plan.plateKnown : null, A: BGL.A, solid: BGL.solid} : null};
      try{
        const r = await offDecode(msg, []);
        return {plan, fw, fh, k, Dw, Dh, s, objs, frames: r.frames, delays: r.delays, bg: r.bg || null, animated, kind: plan.kind, fresh: !!lo.fresh};
      }catch(e){ if(!/worker_off|worker_down/.test(String(e && e.message))) throw e; note('worker off, main-thread decode'); return loadGroup(row, man, lo); }
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
          const bs = Math.min(1, k * (lo.fresh ? BG_FRESH.res : 0.75));
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
    return {plan, fw, fh, k, Dw, Dh, s, objs, frames, delays, bg, bgMask: true, animated, kind: plan.kind, fresh: !!lo.fresh};
  }

  // v636: a cut may name an animated GIF in data/anim_cuts.json (or object.anim). Missing/failed files fall back to the still.
  const ANIM = S.animCuts = {v: 0, dwell_k: 3.5, by: new Map(), at: 0};
  function animKey(mid, label){ return String(mid || '') + '\t' + String(label || ''); }
  function animMids(){ const m = new Set(); ANIM.by.forEach(c => m.add(c.medium_image_id)); return m; }
  function loadAnimCatalog(){
    fetch('data/anim_cuts.json?t=' + Date.now(), {cache: 'no-store'}).then(r => r.ok ? r.json() : null).then(d => {
      if(!d) return;
      ANIM.v = d.v || 1; ANIM.dwell_k = +d.dwell_k || 3.5; ANIM.at = Date.now(); ANIM.by.clear();
      (d.cuts || []).forEach(c => { if(c && c.medium_image_id && (c.anim || c.webp)) ANIM.by.set(animKey(c.medium_image_id, c.cut || c.label), c); });
      // v641: only swap a still when a *new* anim url actually exists; never redraw stills on an empty or unchanged catalog (that flicker was visible on phones)
      try{ if(S.applyLiveAnim && ANIM.by.size) applyCatalogToStage(); }catch(e){}
    }).catch(()=>{});
  }
  loadAnimCatalog();
  function animRec(mid, label, obj){
    return ANIM.by.get(animKey(mid, label)) || (obj && (obj.anim || obj.anim_url) ? {anim: obj.anim || obj.anim_url} : null);
  }
  async function decodeAnimUrl(url, proto){
    const dw = proto && proto.width || 0, dh = proto && proto.height || 0;
    const res = await fetch(url, {cache: 'no-store'});
    if(!res.ok) throw new Error('anim_http_' + res.status);
    const buf = new Uint8Array(await res.arrayBuffer());
    if(!MC || !MC.createGifDecoder) throw new Error('no_gif_decoder');
    const dec = MC.createGifDecoder(buf);
    const collected = [];
    let fr;
    while((fr = dec.next())){
      const ms = (MC.playMs && fr.delayCs != null) ? MC.playMs(fr.delayCs) : Math.max(40, (fr.delayCs || 10) * 10);
      collected.push({rgba: fr.rgba, w: dec.width, h: dec.height, ms});
    }
    if(!collected.length) throw new Error('anim_empty');
    const step = Math.max(1, Math.ceil(collected.length / MAXF));
    const frames = [], delays = [];
    for(let i = 0; i < collected.length; i += step){
      const x = collected[i];
      const img = new ImageData(x.rgba instanceof Uint8ClampedArray ? x.rgba : new Uint8ClampedArray(x.rgba), x.w, x.h);
      frames.push(await bitmapOf(img, dw || x.w, dh || x.h));
      let acc = 0; for(let k = i; k < i + step && k < collected.length; k++) acc += collected[k].ms;
      delays.push(Math.max(40, acc));
    }
    return {frames, delays};
  }
  async function applyAnim(row, L){
    if(!L || !L.objs || !L.frames) return L;
    const mid = row && row.medium_image_id;
    let any = false, delays = null;
    for(let j = 0; j < L.objs.length; j++){
      const rec = animRec(mid, (L.objs[j].o && (L.objs[j].o.label || L.objs[j].o.cut)) || ('cut' + (j + 1)), L.objs[j].o);
      const url = rec && (rec.anim || rec.webp);
      if(!url) continue;
      try{
        const frs = await decodeAnimUrl(url, L.frames[j] && L.frames[j][0]);
        if(frs && frs.frames && frs.frames.length){
          L.frames[j] = frs.frames; delays = frs.delays; any = true;
        }
      }catch(e){ note('anim fallback still', mid, String(e && e.message || e)); }
    }
    if(any){
      L.hasAnim = true; L.animated = true;
      if(delays && delays.length) L.delays = delays;
      else {
        const n = (L.frames.find(f => f && f.length > 1) || []).length || 8;
        L.delays = new Array(n).fill(120);
      }
    }
    return L;
  }
  const _loadGroup = loadGroup;
  loadGroup = async function(row0, man, lo){
    const L = await _loadGroup(row0, man, lo);
    try{ await applyAnim(row0, L); }catch(e){ try{ note('anim fallback', String(e && e.message || e)); }catch(e2){} }
    return L;
  };

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
  function clearRect(gx, gy, Dw, Dh, keepMid){
    S.groups.filter(g => evictable(g) && g.mid !== keepMid).forEach(g => {
      const ix = Math.max(0, Math.min(g.x + g.w, gx + Dw) - Math.max(g.x, gx));
      const iy = Math.max(0, Math.min(g.y + g.h, gy + Dh) - Math.max(g.y, gy));
      if(ix * iy > 0.22 * Dw * Dh) exitGroup(g, false, 'newest-live');
    });
  }
  function spawn(row, L){
    const newest = !!(row.live_view && (row.newest || isNewestId(row.medium_image_id)));
    const pos = placeGroup(L.Dw, L.Dh, newest ? {center: true} : null); const v = view();
    if(newest) clearRect(pos.gx, pos.gy, L.Dw, L.Dh, row.medium_image_id);
    const g = {mid: row.medium_image_id, row, kind: L.kind, x: pos.gx, y: pos.gy, w: L.Dw, h: L.Dh, k: L.k, fw: L.fw, fh: L.fh,
      title: row.title || titleOf(row.medium_image_id), agenda: !!row.agenda, live: !!row.live_view, run: row.run || null, card: row.card || null, born: Date.now(), life: (PHONE ? R(30, 50) : R(35, 70)) * 1000 * (row.live_view ? LIVE_DWELL_K : ((L.hasAnim || L.animated) ? ANIM_DWELL_K : 1)), cuts: [], gone: false, offSince: 0, sha: row.source_sha256 || '', ver: row.pack_version || '1', place: row.place || null, colour: row.colour || row.color || null, fresh: !!(L.fresh || row.fresh), newest};
    if(L.hasAnim) g.hasAnim = true; // v648: a still with a manifest anim is marked on its group (QA + dwell refresh)
    if(L.bg && !row.live_view){
      const c = document.createElement('canvas'); c.className = 'gbg' + (L.bgMask ? ' gm' : '') + (L.bgMask && g.fresh ? ' gfresh' : ''); c.width = L.bg.width; c.height = L.bg.height;
      c.getContext('2d').drawImage(L.bg, 0, 0); L.bg.close && L.bg.close();
      const E = PHONE ? 0.22 : 0.28; // the faded frame reaches well past the group, so neighbouring stories meet instead of black gaps
      Object.assign(c.style, {left: (g.x - g.w * E) + 'px', top: (g.y - g.h * E) + 'px', width: (g.w * (1 + 2 * E)) + 'px', height: (g.h * (1 + 2 * E)) + 'px', zIndex: newest ? '70' : ''});
      bgs.appendChild(c); g.bgEl = c; S.bytes += c.width * c.height * 4; g.bgBytes = c.width * c.height * 4;
      g.bx = 0; g.by = 0; g.bvx = 0; g.bvy = 0; bgRetarget(g, performance.now());
      setTimeout(()=> c.classList.add('on'), 60);
    } else if(L.bg){ try{ L.bg.close && L.bg.close(); }catch(e){} }
    if(g.title){ const t = document.createElement('div'); t.className = 'gtag'; t.textContent = String(g.title).slice(0, 60); const col = (g.colour && (g.colour.hex || g.colour)) || g.color || g.hex || (row.colour && (row.colour.hex || row.colour)) || row.color || null; if(col && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(col))){ t.style.color = col; t.style.boxShadow = '0 0 0 1px ' + col; } Object.assign(t.style, {left: (g.x + g.w / 2) + 'px', top: (g.y + g.h + 6) + 'px'}); cutsL.appendChild(t); g.tag = t;
      setTimeout(()=> t.classList.add('on'), 2500); setTimeout(()=> t.classList.remove('on'), 11000); }
    // directions (11-12 11:41 PM): each story walks in along a random heading from any edge or corner (no left-to-right bias)
    const ang = g.inAng = Math.random() * Math.PI * 2;
    L.objs.forEach((x, j) => {
      const fr = L.frames[j] || [];
      if(L.kind === 'live_view') return; // never mount the raw GIF as a cut; only masked canvas frames from a cut pack
      if(!fr.length) return;
      const c = document.createElement('canvas'); c.className = 'gcut' + (RM ? '' : ' fl'); c.width = fr[0].width; c.height = fr[0].height;
      const ctx = c.getContext('2d'); ctx.drawImage(fr[0], 0, 0);
      const cut = {ctx, sid: x.o.state_id || null, g, home: g, el: c, frames: fr, label: x.o.label || ('cut' + (x.k + 1)), klass: x.o.model_class || x.o.label || null, i: x.k, U: x.U,
        w: x.U.w * g.k, h: x.U.h * g.k, hx: g.x + x.U.x * g.k, hy: g.y + x.U.y * g.k, entering: true, bytes: bytesOf(fr), area: (x.U.w * x.U.h) / (g.fw * g.fh)};
      cut.left = cut.hx; cut.top = cut.hy;
      Object.assign(c.style, {left: cut.left + 'px', top: cut.top + 'px', width: cut.w + 'px', height: cut.h + 'px', zIndex: String((newest ? 80 : 10) + Math.round(x.U.y + x.U.h))});
      c.style.setProperty('--fd', R(5.5, 9).toFixed(2) + 's'); c.style.setProperty('--fdl', (-R(0, 6)).toFixed(2) + 's');
      S.bytes += cut.bytes; S.cuts.push(cut); g.cuts.push(cut);
      if(root.ThrydCutAnimate && ThrydCutAnimate.keepSrc) try{ ThrydCutAnimate.keepSrc(cut); }catch(e){}
      if(fr.length === 1){ try{ fr[0].close && fr[0].close(); }catch(e){} } // v610 memory: a still cut's canvas already holds its only frame; free the bitmap copy (v636 keeps a srcCanvas for in-cut motion)
      bindDrag(cut);
      if(newest){
        // newest active live view appears in place (no off-screen walk-in)
        c.style.opacity = '0'; cutsL.appendChild(c); cut.entering = true;
        requestAnimationFrame(()=>{ c.style.transition = 'opacity .65s ease'; c.style.opacity = '1'; });
        setTimeout(()=>{ cut.entering = false; if(!cut.wan) c.style.transition = ''; }, 750);
      } else {
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
      }
    });
    DIRS.in[oct(ang)]++;
    S.groups.push(g); S.spawned++; if(!(row && row.chips)){ S.lastMedia = Date.now(); S.mediaAt = S.lastMedia; }
    if(g.cuts.length <= 2 && Math.random() < 0.5) S.near = g;
    S.recent.push(g.mid); if(S.recent.length > 40) S.recent.shift();
    S.maxSeen = Math.max(S.maxSeen, storyCuts().length);
    note('spawn', g.mid, L.kind, g.cuts.length + ' cuts', 'on stage ' + storyCuts().length + '/' + CAP, g.title || '');
    if(L.animated && L.kind !== 'live_view') animate(g, L.delays);
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
  // v639: swap a still already on stage for a newly arrived (or just-generated) anim
  function applyLiveAnim(mid, label, frames, delays){
    if(!frames || frames.length < 2) return 0;
    const hits = S.cuts.filter(c => c && c.g && !c.g.gone && c.g.mid === mid && String(c.label || '') === String(label || ''));
    let n = 0;
    hits.forEach(cut => {
      try{
        const w = cut.el.width, h = cut.el.height;
        const fitted = frames.map(fr => fr);
        if(w && h && frames[0] && (frames[0].width !== w || frames[0].height !== h)){
          // draw into bitmaps the size of the cut canvas
          // (kept as-is if drawImage can scale each tick; we still set the first frame now)
        }
        S.bytes -= (cut.bytes || 0);
        cut.frames = fitted; cut.bytes = bytesOf(fitted); S.bytes += cut.bytes;
        if(cut.ctx){ cut.ctx.clearRect(0, 0, cut.el.width, cut.el.height); cut.ctx.drawImage(fitted[0], 0, 0, cut.el.width, cut.el.height); }
        n++;
      }catch(e){}
    });
    const g = hits[0] && hits[0].g;
    if(g){ g.hasAnim = true; g.life = Math.max(g.life || 0, (PHONE ? 40 : 55) * 1000 * ANIM_DWELL_K); animate(g, delays && delays.length ? delays : new Array(frames.length).fill(120)); }
    return n;
  }
  S.applyLiveAnim = applyLiveAnim;
  S.loadAnimCatalog = loadAnimCatalog;
  function applyCatalogToStage(){
    if(!ANIM.by.size) return Promise.resolve();
    const jobs = [];
    S.cuts.forEach(cut => {
      if(!cut || !cut.g || cut.g.gone) return;
      const rec = animRec(cut.g.mid, cut.label, null);
      const url = rec && (rec.anim || rec.webp);
      if(!url) return;
      if(cut._animUrl === url && cut.frames && cut.frames.length > 1) return; // already showing this anim
      if(!cut.frames || cut.frames.length < 2){
        jobs.push(decodeAnimUrl(url, {width: cut.el.width, height: cut.el.height}).then(frs => {
          if(frs && frs.frames && frs.frames.length > 1){
            const n = applyLiveAnim(cut.g.mid, cut.label, frs.frames, frs.delays);
            if(n) cut._animUrl = url;
          }
        }).catch(()=>{}));
      }
    });
    return Promise.all(jobs);
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
  // 17 Nov 10:18 PM ET: pictures must never pop off. Every exit walks off (or fades if already off-screen).
  // The old exitGroup(g, true) path started a 1.5s opacity transition but unloaded the cut after 10ms.
  function cutOnScreen(el){
    if(!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect(), op = +getComputedStyle(el).opacity;
    return r.width > 2 && r.height > 2 && r.bottom > 0 && r.right > 0 && r.left < innerWidth && r.top < innerHeight && op > 0.15;
  }
  function groupOnScreen(g){ return !!(g && ((g.cuts || []).some(c => cutOnScreen(c.el)) || (g.bgEl && cutOnScreen(g.bgEl)))); }
  S.exits = [];
  function recordExit(rec){ rec.t = rec.t || Date.now(); S.exits.push(rec); if(S.exits.length > 240) S.exits.splice(0, S.exits.length - 240); }
  function walkOffCut(cut, opts){
    opts = opts || {};
    if(!cut || !cut.el) return 0;
    cut.leaving = true; try{ cut.el.classList.add('leaving'); }catch(e){}
    const fadeOnly = !!(opts.fadeOnly || RM);
    clearTimeout(cut.goT); clearTimeout(cut.offT); clearTimeout(cut.peT); clearTimeout(cut.backT);
    if(fadeOnly){
      cut.el.style.transition = 'opacity 1.5s ease'; cut.el.style.pointerEvents = 'none';
      requestAnimationFrame(()=>{ cut.el.style.opacity = '0'; });
      cut.offT = setTimeout(()=> unloadCut(cut), 1600);
      return 1.6;
    }
    const v = opts.view || view(), ang = (opts.ang == null ? Math.random() * Math.PI * 2 : opts.ang);
    foldTranslate(cut);
    const [dx, dy] = offTo(cut.left - v.x, cut.top - v.y, cut.w, cut.h, v, ang + R(-.2, .2));
    const dur = R(6, 10);
    requestAnimationFrame(()=>{ if(!cut.leaving) return; cut.el.style.transition = 'translate ' + dur.toFixed(2) + 's cubic-bezier(.5,0,.4,1), opacity 2s ease-in ' + (dur - 2).toFixed(2) + 's';
      requestAnimationFrame(()=>{ if(!cut.leaving) return; cut.el.style.translate = dx.toFixed(0) + 'px ' + dy.toFixed(0) + 'px'; cut.el.style.opacity = '0'; }); });
    // dragfix 23 Nov 2026 (Jesuye: "many objects are refusing dragging"): a cut stays grabbable while it walks off; it only
    // turns click-through once its 2 s fade starts. Grabbing it calls rescueCut() and keeps it on stage.
    cut.peT = setTimeout(()=>{ if(cut.leaving) cut.el.style.pointerEvents = 'none'; }, Math.max(0, dur - 2) * 1000);
    cut.offT = setTimeout(()=>{ if(cut.leaving) unloadCut(cut); }, dur * 1000 + 200);
    return dur;
  }
  function exitGroup(g, _quick, why){
    if(!g || g.gone) return; g.gone = true;
    why = why || 'life';
    const wasNewest = isNewestId(g.mid);
    if(g.live){ try{ LV.left[g.mid] = Date.now(); }catch(e){} }
    const at = S.groups.indexOf(g); if(at >= 0) S.groups.splice(at, 1);
    (g.cuts || []).forEach(c => { c.leaving = true; try{ c.el && c.el.classList.add('leaving'); }catch(e){} });
    const onScreen = groupOnScreen(g);
    const walk = onScreen && !RM;
    const how = walk ? 'walk-off' : 'fade';
    recordExit({mid: g.mid, why, how, onScreen, cuts: (g.cuts || []).length, map: !!g.map});
    const v = view(), outAng = Math.random() * Math.PI * 2; if(walk) DIRS.out[oct(outAng)]++;
    g.cuts.slice().forEach((cut, j) => {
      const go = ()=>{
        if(!cut.leaving) return; // rescued by a grab
        if(cut.dragging){ cut.goT = setTimeout(go, 1200); return; }
        walkOffCut(cut, {fadeOnly: !walk, view: v, ang: outAng});
      };
      cut.goT = setTimeout(go, walk ? j * R(500, 1500) : j * 80);
    });
    if(g.bgEl){ g.bgEl.classList.remove('on'); try{ g.bgEl.classList.add('leaving'); }catch(e){}
      g.bgEl.style.transition = walk ? 'opacity 4s ease' : 'opacity 1.5s ease'; g.bgEl.style.opacity = '0';
      setTimeout(()=>{ try{ g.bgEl.width = 0; }catch(e){} g.bgEl.remove(); S.bytes -= g.bgBytes || 0; }, walk ? 4000 : 1600); }
    if(g.tag) g.tag.remove();
    if(!g.cuts.length) clearTimeout(g.timer);
    note('exit', g.mid, why, how, onScreen ? 'on-screen' : 'off-screen', 'on stage ' + storyCuts().length);
    if(wasNewest){
      const nv = (LV.list || []).find(x => liveId(x) === g.mid);
      if(nv) setTimeout(()=>{ enqueueLive(nv, true); if(!paused()) spawnOne(); }, 60);
    }
    setTimeout(refill, walk ? 700 : 200); // the next story walks in while this one is still walking out
  }
  S.exitGroup = exitGroup; S.walkOffCut = walkOffCut;

  // ---------- drag: the same 'thryd:cutmove' detail medium_cuts.js sends (exact scene + cut identity, percent of the source frame)
  function framePct(cut, host){
    const g = host || cut.home;
    if(g === cut.home){
      const cx = cut.U.x + cut.U.w / 2 + (cut.left - cut.hx) / g.k, cy = cut.U.y + cut.U.h / 2 + (cut.top - cut.hy) / g.k;
      return {x: +(cx / g.fw * 100).toFixed(3), y: +(cy / g.fh * 100).toFixed(3)};
    }
    return {x: +((cut.left + cut.w / 2 - g.x) / g.w * 100).toFixed(3), y: +((cut.top + cut.h / 2 - g.y) / g.h * 100).toFixed(3)};
  }
  // dragfix 23 Nov 2026: a cut whose story is leaving (queued to walk off, or walking off) used to ignore every grab, and when a
  // story leaves ALL its cuts are marked leaving at once, so whole groups stood still on screen and refused to move. Grabbing a
  // still-visible leaving cut now cancels its exit where it stands; 20 s after the last release it walks off again.
  function rescueCut(cut){
    const el = cut.el; if(!el || !el.isConnected || !cut.frames) return false;
    const op = +getComputedStyle(el).opacity; if(!(op > 0.15)) return false;
    clearTimeout(cut.goT); clearTimeout(cut.offT); clearTimeout(cut.peT); clearTimeout(cut.backT);
    const tl = getComputedStyle(el).translate; // freeze mid-walk where it stands (read before the transition is cut, or it jumps to the end)
    el.style.transition = 'none'; el.style.translate = (tl && tl !== 'none') ? tl : '';
    cut.leaving = false; el.classList.remove('leaving'); el.style.pointerEvents = ''; el.style.opacity = '1';
    cut.rescued = (cut.rescued || 0) + 1; S.rescues = (S.rescues || 0) + 1; note('rescue', cut.label, cut.home && cut.home.mid);
    return true;
  }
  function leaveLater(cut){ // a rescued cut whose story is gone: walk off again after 20 s untouched
    clearTimeout(cut.backT); if(!cut.rescued || !(cut.g && cut.g.gone)) return;
    cut.backT = setTimeout(()=>{ if(cut.dragging || cut.leaving || !cut.el || !cut.el.isConnected) return; walkOffCut(cut, {fadeOnly: !cutOnScreen(cut.el)}); }, 20000);
  }
  S.rescueCut = rescueCut;
  function bindDrag(cut){
    const el = cut.el; let d = null, moved = false;
    el.addEventListener('pointerdown', ev => {
      if(cut.leaving && !rescueCut(cut)) return;
      if(typeof cut.canDrag === 'function' && !cut.canDrag(ev)) return;
      ev.preventDefault(); ev.stopPropagation();
      foldTranslate(cut); cut.entering = false; el.style.opacity = '1';
      d = {sx: ev.clientX, sy: ev.clientY, l: cut.left, t: cut.top, z: zsc(), from: framePct(cut, cut.g), raf: 0, v: [{x: ev.clientX, y: ev.clientY, t: performance.now()}]}; moved = false;
      cut.dragging = true; el.dataset.dragging = '1';
      try{ el.setPointerCapture(ev.pointerId); }catch(e){}
      document.body.classList.add('dragmode'); camHold();
    });
    el.addEventListener('pointermove', ev => {
      if(!d) return; const z = d.z || zsc(); const dx = (ev.clientX - d.sx) / z, dy = (ev.clientY - d.sy) / z; if(Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      d.v.push({x: ev.clientX, y: ev.clientY, t: performance.now()}); if(d.v.length > 6) d.v.shift();
      cut.left = d.l + dx; cut.top = d.t + dy;
      if(d.raf) return; d.raf = requestAnimationFrame(()=>{ if(d){ d.raf = 0; el.style.left = cut.left + 'px'; el.style.top = cut.top + 'px'; } });
    });
    const end = ()=>{
      if(!d) return; const from = d.from, vs = d.v; if(d.raf) cancelAnimationFrame(d.raf); d = null;
      const z = moved ? dropZone(cut, vs) : null;
      if(z){ cut.easing = true; const x0 = cut.left, y0 = cut.top, t0 = performance.now(), T = 260; note('ease', cut.label, z.why);
        const step = now => { const k = Math.min(1, (now - t0) / T), e = 1 - Math.pow(1 - k, 3); cut.left = x0 + (z.x - x0) * e; cut.top = y0 + (z.y - y0) * e;
          el.style.left = cut.left + 'px'; el.style.top = cut.top + 'px'; if(k < 1) requestAnimationFrame(step); else { cut.easing = false; finish(from); } };
        requestAnimationFrame(step); return; }
      finish(from); };
    const finish = from => {
      el.style.left = cut.left + 'px'; el.style.top = cut.top + 'px';
      cut.dragging = false; delete el.dataset.dragging;
      try{ document.body.classList.remove('dragmode'); }catch(e){} camHold();
      leaveLater(cut);
      if(!moved) return;
      cut.dragged = true; if(cut.g && !cut.g.gone) cut.g.life += 20000; // a story someone is playing with stays a little longer
      const g = cut.g, visitor = g !== cut.home;
      if(cut.home.agenda){ try{ const H = cut.home, to = framePct(cut, H);
          if(root.thrydMoves && root.thrydMoves.record) root.thrydMoves.record({type: 'move', scene: H.row && H.row.chips ? (H.run || '') + '/' + (H.card || '') : H.mid, scene_kind: H.row && H.row.chips ? 'agenda_chip' : 'run_view',
            cut: cut.label, klass: cut.klass, object_id: cut.sid, object_key: cut.label, label: cut.label, run: H.run, from, to}); }catch(e){}
        const k2 = nkey(cut.klass || cut.label); setTimeout(()=>{ const other = S.groups.find(o => o !== cut.home && !o.gone && !o.carried && o.cuts.some(c => nkey(c.klass) === k2 || nkey(c.label) === k2)); if(other){ lastCarry = 0; carry(other, 'drag'); } }, 3000);
        return; }
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

  // a drag released moving fast (>= .45 px/ms) toward another story's frame, or a cut of the same kind, within 25 degrees and 420 px,
  // glides the rest of the way (until its centre sits just inside that frame / beside that cut, at most 220 px)
  function dropZone(cut, vs){ if(!vs || vs.length < 2) return null; const a = vs[0], b = vs[vs.length - 1], dt = b.t - a.t; if(dt <= 0 || dt > 220) return null;
    const z = zsc(), vx = (b.x - a.x) / dt / z, vy = (b.y - a.y) / dt / z, sp = Math.hypot(vx, vy); if(sp < .45) return null;
    const cx = cut.left + cut.w / 2, cy = cut.top + cut.h / 2, k = nkey(cut.klass || cut.label); let best = null;
    const zones = S.groups.filter(g => !g.gone && g !== cut.g && g.w > 0).map(g => ({x: g.x + g.w / 2, y: g.y + g.h / 2, r: Math.min(g.w, g.h) * .35, why: 'story ' + (g.mid || '')}))
      .concat(S.cuts.filter(o => o !== cut && o.el && o.el.isConnected && !o.leaving && (nkey(o.klass) === k || nkey(o.label) === k)).map(o => ({x: o.left + o.w / 2 + o.w * .6, y: o.top + o.h / 2, r: 0, why: 'beside ' + o.label})));
    zones.forEach(z => { const dx = z.x - cx, dy = z.y - cy, dist = Math.hypot(dx, dy); if(dist < 30 || dist > 420) return;
      const cos = (dx * vx + dy * vy) / (dist * sp); if(cos < Math.cos(25 * Math.PI / 180)) return; const sc = cos * 2 - dist / 420; if(!best || sc > best.sc) best = {...z, dist, sc}; });
    if(!best) return null; const go = Math.min(220, Math.max(0, best.dist - best.r)); if(go < 8) return null; const ux = (best.x - cx) / best.dist, uy = (best.y - cy) / best.dist;
    return {x: cut.left + ux * go, y: cut.top + uy * go, why: best.why}; }
  S.dropZone = dropZone;

  // ---------- life: wander inside the stage, and now and then a small cut walks over to another story
  function settled(cut){ return !cut.entering && !cut.leaving && !cut.dragging && !cut.wan && cut.g && !cut.g.gone; }
  function wander(){
    const pool = S.cuts.filter(c => settled(c) && !c.mapFocus && ((c.g && c.g.map) || (c.area <= 0.3 && !STILL_RX.test(c.label + ' ' + (c.klass || '')))));
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
      if(B.gone){ walkOffCut(cut, {fadeOnly: !cutOnScreen(cut.el)}); return; }
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
  // ---------- agenda objects (Jesuye 12:59 AM "the agendas objects are not showing, only the safe and tweets objects"): the stage
  // only read the Medium/X cut catalog. Now it also brings in the agendas' own objects: every run-view scene in data/objects_map.json
  // with real sprite crops (assets/sprites/run-*/jN/*.png, cut from that scene's frame) becomes a group of its run, and the live
  // agenda's characters and objects in state.json that have no picture come on as plain text chips (never invented imagery).
  // Both drag (a normal mapped move with the object's state_id), carry over and take typed commands like any cut.
  // Every run's own objects (/workspace/run-*/run/objects.json, exported as data/agenda_objects.json, active run first) come on as
  // story groups of their run; the active run is weighted 4x. An object whose run has a real sprite crop of the same name uses it.
  const AG = S.agenda = {map: null, state: null, runs: [], active: null, keys: [], spawned: 0, chips: 0, avail: 0, availChips: 0, sprite: new Map(), turn: {}};
  const AG_P = 0.35; // share of new groups that are agenda groups
  const runOfK = k => (String(k).match(/run-[0-9a-f]{4,}/) || String(k).match(/live\/([a-z0-9-]+?)_(?:[jw]\d+)/) || [])[0] || null;
  const cardOfK = k => (String(k).match(/(?:^|[\/_])([jw]\d{1,3})(?:\.gif|$|[^0-9])/) || [])[1] || null;
  Promise.all([fetch('data/objects_map.json?t=' + Date.now(), {cache: 'no-store'}).then(r => r.ok ? r.json() : null).catch(()=> null),
    fetch('https://raw.githubusercontent.com/jdavidteki/thryd-projector/main/data/state.json?t=' + Date.now(), {cache: 'no-store'}).then(r => r.ok ? r.json() : null).catch(()=> null)
      .then(j => j || fetch('data/state.json?t=' + Date.now(), {cache: 'no-store'}).then(r => r.ok ? r.json() : null).catch(()=> null)),
    fetch('data/agenda_objects.json?t=' + Date.now(), {cache: 'no-store'}).then(r => r.ok ? r.json() : null).catch(()=> null)]).then(([m, st, ao]) => {
    if(ao && Array.isArray(ao.runs)){ AG.runs = ao.runs.filter(r => r && ((r.objects || []).length || (r.characters || []).length)); AG.active = ao.active_run || (AG.runs[0] && AG.runs[0].run); }
    AG.map = m || {}; AG.state = st || null;
    AG.keys = Object.keys(AG.map).filter(k => (AG.map[k].objects || []).some(o => o && o.sprite && Array.isArray(o.bbox)));
    AG.avail = AG.keys.reduce((n, k) => n + AG.map[k].objects.filter(o => o && o.sprite && Array.isArray(o.bbox)).length, 0);
    AG.keys.forEach(k => { const r = runOfK(k); (AG.map[k].objects || []).forEach(o => { if(o && o.sprite && r) AG.sprite.set(r + '|' + ckey(o.label), o.sprite); }); });
    AG.availChips = st ? ((st.characters || []).length + (st.objects || []).length) : 0;
    note('agenda', AG.keys.length + ' scenes', AG.avail + ' sprites', AG.availChips + ' chips');
  });
  function pickAgenda(){
    const ok = AG.keys.filter(k => !S.groups.some(g => g.mid === k) && !S.recent.includes(k) && !S.bad.has(k));
    return ok.length ? ok[Math.random() * ok.length | 0] : null;
  }
  async function loadAgenda(key){
    const e = AG.map[key], fs = e.frame_size || [480, 270], fw = fs[0], fh = fs[1];
    let objs = (e.objects || []).filter(o => o && o.sprite && Array.isArray(o.bbox)).map((o, k) => ({o: {label: o.label, model_class: o.label, state_id: o.state_id || null}, k,
      U: {x: Math.round(o.bbox[0] * fw), y: Math.round(o.bbox[1] * fh), w: Math.max(3, Math.round(o.bbox[2] * fw)), h: Math.max(3, Math.round(o.bbox[3] * fh))}, src: o.sprite}));
    objs.sort((a, b) => b.U.w * b.U.h - a.U.w * a.U.h); objs = objs.slice(0, Math.min(PER_GROUP, CAP)); if(!objs.length) throw new Error('cap');
    let Dh = vh() * (PHONE ? R(0.2, 0.32) : R(0.24, 0.40)), k = Dh / fh; if(fw * k > vw() * (PHONE ? 0.62 : 0.44)) k = vw() * (PHONE ? 0.62 : 0.44) / fw;
    Dh = fh * k; const Dw = fw * k, s = Math.min(2.5, k * DPR);
    const frames = await Promise.all(objs.map(async x => { const r = await fetch(x.src, {cache: 'force-cache'}); if(!r.ok) throw new Error('sprite'); const b = await r.blob();
      return [await createImageBitmap(b, {resizeWidth: Math.max(1, Math.round(x.U.w * s)), resizeHeight: Math.max(1, Math.round(x.U.h * s)), resizeQuality: 'medium'})]; }));
    const run = e.run || runOfK(key), card = e.jN || cardOfK(key);
    return {row: {medium_image_id: key, agenda: true, run, card, title: (run || 'agenda') + (card ? ' · ' + card : '') + ' · objects'}, L: {plan: {}, fw, fh, k, Dw, Dh, s, objs, frames, delays: [0], bg: null, animated: false, kind: 'agenda'}};
  }
  function chipBitmap(text, sub){
    const fz = Math.round(Math.max(12, vh() * (PHONE ? 0.018 : 0.02)) * DPR), c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = '600 ' + fz + 'px ui-monospace,Menlo,monospace'; const w = Math.ceil(g.measureText(text).width) + fz * 1.6, h = Math.round(fz * (sub ? 2.5 : 1.8));
    c.width = w; c.height = h; g.font = '600 ' + fz + 'px ui-monospace,Menlo,monospace';
    g.fillStyle = 'rgba(18,18,18,.88)'; const r = h / 2.4; g.beginPath(); g.moveTo(r, 0); g.arcTo(w, 0, w, h, r); g.arcTo(w, h, 0, h, r); g.arcTo(0, h, 0, 0, r); g.arcTo(0, 0, w, 0, r); g.fill();
    g.fillStyle = '#f0b35a'; g.textBaseline = 'middle'; g.fillText(text, fz * .8, sub ? h * .36 : h / 2);
    if(sub){ g.font = Math.round(fz * .7) + 'px ui-monospace,Menlo,monospace'; g.fillStyle = '#b9b2a2'; g.fillText(sub, fz * .8, h * .74); }
    return c;
  }
  function pickRun(){
    // one chip group per run on stage, two for the active run, so the same object never shows three or four times over
    const on = {}; S.groups.concat(S.ready.map(x => x.g || x)).forEach(g => { if(g && g.row && g.row.chips) on[g.row.run] = (on[g.row.run] || 0) + 1; });
    const pool = AG.runs.filter(r => (on[r.run] || 0) < (r.run === AG.active ? 2 : 1)); if(!pool.length) return null;
    let tot = 0; const w = pool.map(r => { const x = r.run === AG.active ? 4 : 1; tot += x; return x; });
    let q = Math.random() * tot; for(let i = 0; i < pool.length; i++){ q -= w[i]; if(q <= 0) return pool[i]; } return pool[0];
  }
  async function loadChips(){
    let items = [], run = null, card = null, title = null;
    const R0 = AG.runs.length ? pickRun() : null;
    if(R0){ run = R0.run; title = R0.title;
      const all = [].concat((R0.characters || []).map(c => ({label: c.name, id: c.id, kind: 'character'})), (R0.objects || []).map(o => ({label: o.name, id: o.id ? o.id + '_' + run.slice(4) : null, kind: 'object', card: o.source_card, code: o.code_title})));
      // walk each run's list in turn, so every object gets its time on stage
      const t = AG.turn[run] = (AG.turn[run] || 0); const n = Math.min(PER_GROUP, all.length);
      for(let i = 0; i < n; i++) items.push(all[(t + i) % all.length]); AG.turn[run] = (t + n) % Math.max(1, all.length);
      card = (items.find(i => i.card) || {}).card || null;
    } else {
      const st = AG.state; if(!st) throw new Error('no_state'); run = st.run || null; card = st.current_card || null;
      items = [].concat((st.characters || []).map(c => ({label: c.name || c.id, id: c.id || null, kind: 'character'})), (st.objects || []).map(o => ({label: o.label, id: o.db_id || null, kind: 'object'})));
    }
    if(!items.length) throw new Error('no_items');
    const pick = items.slice(0, Math.min(PER_GROUP, CAP)); if(!pick.length) throw new Error('cap');
    // a real sprite crop of the same object in the same run is used when there is one; otherwise a plain text chip
    const bms = await Promise.all(pick.map(async i => { const sp = run && AG.sprite.get(run + '|' + ckey(i.label));
      if(sp){ try{ const r = await fetch(sp, {cache: 'force-cache'}); if(r.ok){ const b = await createImageBitmap(await r.blob()); const sc = Math.min(1, (vh() * .16 * DPR) / Math.max(b.width, b.height));
        if(sc < 1){ const b2 = await createImageBitmap(b, {resizeWidth: Math.max(1, Math.round(b.width * sc)), resizeHeight: Math.max(1, Math.round(b.height * sc))}); b.close && b.close(); return b2; } return b; } }catch(e){} }
      return chipBitmap(String(i.label).slice(0, 28), i.kind + (i.code ? ' · ' + String(i.code).slice(0, 24) : '')); }));
    const fw = 1000, fh = 600, cols = 2; let U = [];
    const bw = Math.max(...bms.map(b => b.width)), bh = Math.max(...bms.map(b => b.height));
    const k = Math.min((vw() * (PHONE ? .6 : .3)) / fw, 1), unitW = fw / cols, rows = Math.ceil(pick.length / cols), unitH = fh / Math.max(1, rows);
    pick.forEach((it, n) => { const w = bms[n].width / DPR / k, h = bms[n].height / DPR / k; U.push({x: Math.round((n % cols) * unitW + R(0, Math.max(0, unitW - w))), y: Math.round(((n / cols) | 0) * unitH + R(0, Math.max(0, unitH - h))), w: Math.max(4, Math.round(w)), h: Math.max(4, Math.round(h))}); });
    const objs = pick.map((it, n) => ({o: {label: it.label, model_class: it.kind, state_id: it.id}, k: n, U: U[n]}));
    const key = 'chips:' + (run || 'agenda') + ':' + Date.now();
    return {row: {medium_image_id: key, agenda: true, chips: true, run, card, title: (title ? title + ' · ' : '') + (run || 'agenda') + (run === AG.active ? ' (now)' : '')}, L: {plan: {}, fw, fh, k, Dw: fw * k, Dh: fh * k, s: DPR, objs, frames: bms.map(b => [b]), delays: [0], bg: null, animated: false, kind: 'chips'}};
  }

  // decoding fills a small queue of ready groups; a group goes on stage the moment there is room (cap, budget, an empty patch)
  S.ready = []; S.pend = [];
  function makeRoom(needCuts){
    needCuts = needCuts || 1;
    while((activeStoryCuts().length + needCuts > CAP || storyGroups().length >= MAX_GROUPS) && evictOldest('room')){}
    return activeStoryCuts().length + needCuts <= CAP && storyGroups().length < MAX_GROUPS;
  }
  function place(item){
    const need = (item.L && item.L.objs && item.L.objs.length) || 1;
    if(activeStoryCuts().length + need > CAP || storyGroups().length >= MAX_GROUPS) makeRoom(need);
    if(activeStoryCuts().length + need > CAP || storyGroups().length >= MAX_GROUPS) return false;
    S.ready.splice(S.ready.indexOf(item), 1); S.bytes -= item.held;
    try{ spawn(item.row, item.L); }catch(e){ note('spawn fail', item.row.medium_image_id, String(e && e.message || e)); item.L.frames.forEach(f => f.forEach(b => b.close && b.close())); }
    return true;
  }
  function refill(){ if(paused()) return; while(S.ready.length && place(S.ready[0])); spawnOne(); }

  // ---------- live views (data/live_views.json, published by the 45 s cmd loop). A view the device has not
  // seen yet is shown next, without waiting for the no-repeat Medium deck to cycle. The most recent 1–3 of
  // the current agenda (or the newest views overall if that agenda has none yet) come back more often.
  // Ids live in their own space, so they never write thryd_seen_cuts_v1 or steal a deck slot.
  // Newest active-agenda view (17 Nov 2026): always on stage, in the centre, faded in (no walk-in); older-agenda mix never delays it.
  // 17 Nov 7:51 PM ET: a world-writer batch or a Pages 503 must not empty the stage — skip bad entries, keep the last good list, never cool the newest on a fetch error, and do not drain groups while the network breaker is held.
  const LV_URLS = ['data/live_views.json', 'https://raw.githubusercontent.com/jdavidteki/thryd-projector/main/data/live_views.json'];
  const LV = S.liveViews = {list: [], seen: {}, pending: [], activeRun: null, at: 0, src: '', left: {}};
  const cooling = id => { if(isNewestId(id)) return false; return now0() - (LV.left[id] || 0) < LIVE_COOL_MS; };
  function now0(){ return Date.now(); }
  function liveId(v){ return (v && (v.id || ('live:' + v.run + ':' + v.card))) || ''; }
  function newestLive(){ return recentLive(1)[0] || null; }
  function isNewestId(id){ const n = newestLive(); return !!(id && n && liveId(n) === id); }
  function isNewestGroup(g){ return !!(g && g.live && isNewestId(g.mid)); }
  function lastCutLiveOnStage(g){
    // keep the last cut view of the active agenda on stage while the true newest is still loading its pack
    if(!g || !g.live || g.gone) return false;
    const n = newestLive();
    if(!n || g.run !== n.run || g.mid === liveId(n)) return false;
    return !liveOn(liveId(n));
  }
  function evictable(g){ return !!(g && !g.gone && !g.map && !g.cuts.some(c => c.dragging) && !isNewestGroup(g) && !lastCutLiveOnStage(g) && !floorHolds(g)); }
  function hasCut(v){
    const c = v && v.cut;
    if(!c || !c.pack || !/^assets\/live_views\/[^?#]+\.cut\.json$/.test(String(c.pack))) return false;
    if(c.objects != null && !(c.objects > 0)) return false;
    return true;
  }
  function liveOk(v){
    if(!v || !v.url || !v.card) return false;
    const card = String(v.card), url = String(v.url);
    if(!/^j\d+$/.test(card)) return false;
    if(/(cartoon|preview|plate|_src|_diff)/i.test(url) || /(?:cartoon|preview|plate|_src|_diff)/i.test(card)) return false;
    return true;
  }
  function recentLive(n){
    const run = LV.activeRun;
    let pool = LV.list.filter(v => run && v.run === run && hasCut(v));
    if(!pool.length) pool = LV.list.filter(hasCut);
    return pool.slice().sort((a, b) => (b.mtime || 0) - (a.mtime || 0)).slice(0, n || LIVE_KEEP);
  }
  function liveOn(id){
    return S.groups.some(g => !g.gone && g.mid === id) || S.ready.some(it => it.row && it.row.medium_image_id === id) || LV.pending.some(v => liveId(v) === id);
  }
  function roomForLive(needCuts){
    needCuts = needCuts || PER_GROUP;
    while((activeStoryCuts().length + needCuts > CAP || storyGroups().length >= MAX_GROUPS) && S.groups.filter(evictable).length){
      const old = S.groups.filter(evictable).sort((a, b) => (a.live ? 1 : 0) - (b.live ? 1 : 0) || a.born - b.born)[0];
      if(!old) break;
      exitGroup(old, false, 'live-room');
    }
  }
  function enqueueLive(v, front){
    if(!v || !liveOk(v) || !hasCut(v)) return;
    const id = liveId(v); v.id = id;
    if(isNewestId(id) && S.bad.has(id)) S.bad.ok(id);
    if(liveOn(id) || (S.bad.has(id) && !isNewestId(id))) return;
    if(LV.pending.some(p => liveId(p) === id)) return;
    if(front) LV.pending.unshift(v); else LV.pending.push(v);
  }
  // older agendas' views (Jesuye 17 Nov 2026 10:25 AM ET "liveviews of agendas older than run-5a58c4 should show"): besides the
  // current agenda's newest views, one view from another agenda is mixed in now and then, least recently shown first
  function olderLive(){
    const run = LV.activeRun, rec = new Set(recentLive(LIVE_KEEP).map(liveId));
    const pool = LV.list.filter(v => (!run || v.run !== run) && !rec.has(liveId(v)));
    if(pool.some(v => liveOn(liveId(v)))) return null;
    const free = pool.filter(v => !S.bad.has(liveId(v)) && !cooling(liveId(v)));
    if(!free.length) return null;
    free.sort((a, b) => (LV.left[liveId(a)] || 0) - (LV.left[liveId(b)] || 0) || Math.random() - 0.5);
    return free[Math.floor(Math.random() * Math.min(4, free.length))];
  }
  function wantLive(){
    const newest = newestLive();
    // the newest live view of the active agenda always comes first; older-agenda
    // mixing never delays or replaces it
    if(newest && !liveOn(liveId(newest))){ S.bad.ok(liveId(newest)); return newest; }
    if(newest && liveOn(liveId(newest)) && Math.random() < 0.35){ const o = olderLive(); if(o) return o; }
    const rec = recentLive(LIVE_KEEP);
    if(!rec.length) return olderLive();
    const on = rec.filter(v => liveOn(liveId(v)));
    const free = rec.filter(v => !liveOn(liveId(v)) && !S.bad.has(liveId(v)) && !cooling(liveId(v)));
    if(!free.length) return null;
    if(on.length === 0) return free[0];
    if(on.length < Math.min(LIVE_KEEP, rec.length) && Math.random() < 0.45) return free[0];
    return null;
  }
  // a cut live view: the same pack format and loader as a ready Medium cut (masks per displayed frame + plate), so it moves,
  // drags and fades like every other cutout; the manifest row lives only here (never in medium_cuts.json or the no-repeat deck)
  async function loadLiveCut(v, fresh){
    const c = v.cut; if(!c || !c.pack || !/^assets\/live_views\/[^?#]+\.cut\.json$/.test(String(c.pack))) throw new Error('no_cut');
    const id = liveId(v);
    const mrow = {medium_image_id: id, kind: 'gif', status: 'ready', url: v.url, pack: c.pack, pack_version: c.pack_version || '1', source_sha256: v.sha256 || ''};
    if(c.frame_size) mrow.frame_size = c.frame_size; if(c.delays_cs) mrow.delays_cs = c.delays_cs;
    roomForLive();
    const L = await loadGroup(mrow, {assets: [mrow]}, {live: true, fresh, newest: isNewestId(id)});
    const row = {medium_image_id: id, title: v.title || ((v.card || '') + ' · ' + (v.run || '')), agenda: false, live_view: true, live_cut: true, run: v.run, card: v.card, url: v.url, mtime: v.mtime, place: v.place || null, colour: v.colour || v.color || null, fresh, newest: isNewestId(id), source_sha256: v.sha256 || '', pack_version: mrow.pack_version};
    return {row, L};
  }
  const isFresh = v => recentLive(LIVE_KEEP).some(x => liveId(x) === liveId(v));
  function loadLiveView(v){
    if(!hasCut(v)) return Promise.reject(new Error('no_cut'));
    return loadLiveCut(v, isFresh(v));
  }
  S.badCut = new Set();
  function loadLiveFrame(v, fresh){
    // removed 17 Nov 9:18 PM ET: never present the raw rectangle GIF. Callers must use loadLiveCut only.
    return Promise.reject(new Error('no_raw_live_frame'));
  }
  async function spawnLive(v){
    const id = liveId(v);
    if(!id || liveOn(id)) return false;
    if(!hasCut(v)){ note('live view skip', id, 'no_cut'); return false; }
    if(S.bad.has(id) && !isNewestId(id)) return false;
    if(S.loading >= INFLIGHT){ enqueueLive(v, true); return false; }
    S.loading++;
    try{
      const A = await loadLiveView(v);
      if(paused() || S.groups.some(g => !g.gone && g.mid === A.row.medium_image_id)){
        try{ A.L.img && (A.L.img.src = ''); }catch(e){}
        try{ (A.L.frames || []).forEach(f => (f || []).forEach(b => b && b.close && b.close())); A.L.bg && A.L.bg.close && A.L.bg.close(); }catch(e){}
        return false;
      }
      roomForLive();
      spawn(A.row, A.L); S.bad.ok(id); netOk();
      note('live view', A.row.medium_image_id, A.row.title || '');
      return true;
    }catch(e){
      const why = String(e && e.message || e);
      if(isNewestId(id)){ enqueueLive(v, true); note('live view retry', id, why); failed(id, why); return false; }
      failed(id, why); note('live view skip', id, why);
      return false;
    }finally{ S.loading--; }
  }
  async function pollLiveViews(){
    let d = null, src = '';
    try{
    for(const u of LV_URLS){
      try{ const r = await fetch(u + '?t=' + Date.now(), {cache: 'no-store'}); if(r.ok){ d = await r.json(); src = u.startsWith('http') ? 'raw' : 'pages'; break; } }catch(e){}
    }
    if(!d || !Array.isArray(d.views)) return; // keep whatever is already on the stage
    const list = [];
    d.views.forEach(v => { try{ if(!liveOk(v)) return; v.id = liveId(v); list.push(v); }catch(e){} });
    if(!list.length && (LV.list || []).length){ note('live views poll', 'empty payload ignored'); return; }
    LV.src = src; LV.at = Date.now(); LV.activeRun = d.active_run || LV.activeRun || null;
    LV.list = list;
    const first = !Object.keys(LV.seen).length;
    const fresh = [];
    list.forEach(v => {
      const prev = LV.seen[v.id];
      const newer = !prev || ((v.mtime || 0) > (prev.mtime || 0)) || (v.sha256 && prev.sha256 && v.sha256 !== prev.sha256);
      if(newer) fresh.push(v);
    });
    const isStoryView = v => /^story-draw-/.test((v && v.run) || '');
    const queueStory = front => {
      list.filter(v => isStoryView(v) && hasCut(v) && !isNewestId(liveId(v)))
        .sort((a, b) => (a.mtime || 0) - (b.mtime || 0))
        .forEach(v => enqueueLive(v, !!front));
    };
    if(first){
      list.forEach(v => { LV.seen[v.id] = {mtime: v.mtime || 0, sha256: v.sha256 || ''}; });
      recentLive(LIVE_KEEP).filter(v => !isNewestId(liveId(v))).slice().reverse().forEach(v => enqueueLive(v, true));
      const newest = newestLive(); if(newest) enqueueLive(newest, true);
      queueStory(false); // behind the newest active-agenda view, never in front of it
    } else {
      fresh.sort((a, b) => (b.mtime || 0) - (a.mtime || 0)).forEach(v => {
        LV.seen[v.id] = {mtime: v.mtime || 0, sha256: v.sha256 || ''};
        enqueueLive(v, true);
      });
      const newest = newestLive();
      if(newest && !liveOn(liveId(newest))) enqueueLive(newest, true);
      queueStory(false);
    }
    if(LV.pending.length && !paused()) spawnOne();
    }catch(e){ note('live views poll', String(e && e.message || e)); }
  }
  S.pollLiveViews = pollLiveViews; S.enqueueLive = enqueueLive; S.recentLive = recentLive;

  async function spawnOne(){
    if(S.loading >= INFLIGHT) return;
    // newest live views go first, even if the Medium deck is mid-cycle or the manifest is still loading
    if(LV.pending.length){
      const v = LV.pending.shift();
      await spawnLive(v);
      if(!paused()) setTimeout(spawnOne, 50);
      return;
    }
    if(!manifest) return;
    if(S.ready.length >= READY || S.bytes > BUDGET * .9) return;
    // at the cut cap: keep wing items if any, but do not decode more; place() evicts when a ready group needs room
    if(activeStoryCuts().length >= CAP) return;
    const prefer = netHeld() ? null : wantLive();
    if(prefer){
      await spawnLive(prefer);
      if(!paused()) setTimeout(spawnOne, 50);
      return;
    }
    let agKey = null, chips = false;
    if(netHeld()){ // offline / breaker open: local chips only, media waits
      if(!(AG.runs.length || AG.state) || Math.random() > AG_P) return;
      S.loading++; try{ const A = await loadChips(); const held = A.L.frames.reduce((n, f) => n + bytesOf(f), 0); const item = {row: A.row, L: A.L, held}; S.bytes += held; S.ready.push(item); place(item); AG.chips++; }
      catch(e){ note('chips skip', String(e && e.message || e)); } finally{ S.loading--; } return; }
    const agOn = S.cuts.filter(c => c.home && c.home.agenda).length; // agenda cuts keep to ~40 % of the stage; Medium and X cuts keep the rest
    if((AG.keys.length || AG.runs.length) && agOn < CAP * .4 && Math.random() < AG_P){ chips = (AG.runs.length || AG.state) && (Math.random() < .6 || !AG.keys.length); if(!chips) agKey = pickAgenda(); }
    const row = (agKey || chips) ? null : pickRow(); if(!row && !agKey && !chips) return;
    if(row || agKey){ S.recent.push(row ? row.medium_image_id : agKey); if(S.recent.length > 40) S.recent.shift(); } // never picked twice while it decodes
    S.loading++;
    if(agKey || chips){ try{ const A = chips ? await loadChips() : await loadAgenda(agKey); const held = A.L.frames.reduce((n, f) => n + bytesOf(f), 0);
        const item = {row: A.row, L: A.L, held}; S.bytes += held; S.ready.push(item); place(item); if(chips) AG.chips++; else { AG.spawned++; S.bad.ok(agKey); netOk(); } }
      catch(e){ const why = String(e && e.message || e); if(agKey && why !== 'cap') failed(agKey, why); note('agenda skip', agKey || 'chips', why); }
      finally{ S.loading--; } if(!paused()) setTimeout(spawnOne, 50); return; }
    try{ const L = await loadGroup(row); const held = L.frames.reduce((n, f) => n + bytesOf(f), 0) + (L.bg ? L.bg.width * L.bg.height * 4 : 0);
      const item = {row, L, held}; S.bytes += held; S.ready.push(item); place(item); S.bad.ok(row.medium_image_id); netOk(); }
    catch(e){ const why = String(e && e.message || e); if(why !== 'cap' && why !== 'budget') failed(row.medium_image_id, why); else S.recent.push(row.medium_image_id); S.fails++; note('skip', row.medium_image_id, why); }
    finally{ S.loading--; }
    if(!paused()) setTimeout(spawnOne, 50);
  }
  function spawner(){
    const wait = storyGroups().length < MAX_GROUPS * 0.5 ? R(150, 400) : R(500, 1400);
    setTimeout(()=>{ if(!paused()) refill(); spawner(); }, wait);
  }
  function evictOldest(why){
    const old = S.groups.filter(evictable).sort((a, b) => a.born - b.born)[0];
    if(!old) return false;
    exitGroup(old, false, why || 'cap');
    return true;
  }
  function house(){
    const now = Date.now(), v = view();
    S.groups.slice().forEach(g => {
      if(g.map){ g.offSince = 0; return; }
      const vis = g.x < v.x + v.w && g.x + g.w > v.x && g.y < v.y + v.h && g.y + g.h > v.y;
      if(vis) g.offSince = 0; else if(!g.offSince) g.offSince = now;
      if(isNewestGroup(g) || netHeld()) g.offSince = 0;
      else if(g.offSince && now - g.offSince > 12000) exitGroup(g, false, 'offscreen');
      else if(!netHeld() && now - g.born > g.life && !g.cuts.some(c => c.dragging)){
        if(floorHolds(g)) g.life += 20000; // v646 live floor: an animated group stays until enough other live cuts are on
        else exitGroup(g, false, 'life');
      }
    });
    // soft cap equals CAP: evict only to make room for an incoming group (place/makeRoom), never early
    const incoming = !!(S.ready.length || S.loading || (S.liveViews && S.liveViews.pending && S.liveViews.pending.length));
    if(incoming && activeStoryCuts().length > SOFT_CAP) evictOldest('soft-cap');
    // never more than CAP: walk off (never unload in 10ms)
    if(activeStoryCuts().length > CAP) evictOldest('cap');
    // memory: walk groups off instead of deleting them when the decoded-byte budget is tight
    if(S.bytes > BUDGET * 0.85 && evictOldest('budget')) S.releases++;
    S.maxSeen = Math.max(S.maxSeen, storyCuts().length);
    // starvation guard: no GIF / image / agenda group for 4 min while online and running -> lift every cooldown and retry
    if(!paused() && !netHeld() && manifest && (manifest.assets || []).length && now - S.lastMedia > 240000){
      const n = S.bad.release(); S.badCut.clear(); S.recent = S.recent.slice(-5); S.lastMedia = now; S.releases++; note('starve guard: released', n, 'cooled items');
    }
    // last resort: no media at all for 12 min. Never jump a live viewer — walk a group off and retry while the tab is
    // visible; only reload once the tab is hidden (or after a later hidden check). At most once per 30 min per tab.
    if(!paused() && navigator.onLine !== false && manifest && (manifest.assets || []).length && now - S.mediaAt > 12 * 60e3 && !S.cuts.some(c => c.dragging)){
      S.mediaAt = now - 6 * 60e3;
      evictOldest('starve-walk');
      S.bad.release(); S.badCut.clear();
      if(document.hidden){
        let last = 0; try{ last = +sessionStorage.getItem('thryd_starve_reload') || 0; }catch(e){}
        if(now - last > 30 * 60e3 && !S.reloading) fetch('data/version.json?t=' + now, {cache: 'no-store'}).then(r => { r.text().catch(()=>{}); if(!r.ok) return;
          try{ sessionStorage.setItem('thryd_starve_reload', String(Date.now())); }catch(e){} note('starve guard: reloading hidden page'); S.reloading = true; setTimeout(()=> location.reload(), 200); }).catch(()=>{});
      } else note('starve guard: walked a group off; reload deferred until hidden');
    }
    camHold();
    if(!S.groups.some(g => g.map && !g.gone)) try{ bootMap(); }catch(e){}
  }
  setInterval(house, 1000);
  // the centre ticker line has no single scene to report here: show what is on the stage instead of a stuck "loading"
  // (projector.js keeps writing "loading" because no single view ever comes up in stage mode, so this also replaces it the moment it is written)
  let updBusy = false;
  const upd = ()=>{ const u = document.getElementById('upd'); if(!u || updBusy) return; const t = u.textContent || '';
    if(t && t !== 'loading' && t !== 'loading cuts' && !t.startsWith('on stage')) return;
    const stories = S.groups.filter(g => !g.gone && !g.map);
    const n = stories.length, foc = focus && !focus.gone && !focus.map ? focus : stories.find(g => g.live && g.newest) || stories[0] || null;
    const f = foc ? (foc.title || '') : '';
    const want = n ? 'on stage: ' + n + (n === 1 ? ' story' : ' stories') + (f ? ' · ' + String(f).slice(0, 48) : '') : (S.groups.some(g => g.map && !g.gone) ? 'on stage: 0 stories' : 'loading');
    if(t !== want){ updBusy = true; u.textContent = want; updBusy = false; } };
  setInterval(upd, 2000);
  (function watch(){ const u = document.getElementById('upd'); if(!u || typeof MutationObserver !== 'function'){ setTimeout(watch, 500); return; }
    new MutationObserver(upd).observe(u, {childList:true, characterData:true, subtree:true}); })();
  if(!RM){
    (function w(){ setTimeout(()=>{ if(!paused()) try{ wander(); }catch(e){} w(); }, PHONE ? R(600, 1500) : R(250, 800)); })();
    (function x(){ setTimeout(()=>{ if(!paused()) try{ crossover(); }catch(e){} x(); }, R(8000, 16000)); })();
  }

  // ---------- meetings (Jesuye 14 Nov 2026 9:12 AM ET): the code column shows stories touching, not drift.
  // When two named cutouts from different stories come close or overlap on screen, one calm line:
  //   a.approaches(b)  drifting toward each other     a.meets(b) / a.interactwith(b)  overlapping
  //   a.passes(b)      a moving cut crosses over b    a.leaves(b)  separating after a touch
  //   a.arrivesat(place) / a.leavesfrom(place)  when one side is a live view (its place from the card)
  //   a.remembers(b|place)  now and then, when a pair meets a second time
  // Names are real object / character names (agenda labels, the Medium sidecar class, a figure from a titled scene); no ids, no
  // numbers, never cutN; a cut with no name says nothing. Per-pair cooldown, at most one new line every ~4.5 s.
  const SIDE = new Map(); // pack url -> {cut1: 'tie', ...}
  const GENERIC = /^(?:object|objects|foreground|background|thing|live_view|view|blurred.*|unknown|item|character)$/;
  const PERSONISH = /^(?:person|people|man|woman|figure)(?:[\s_]*\d*)$/;
  const snk = t => String(t || '').toLowerCase().replace(/['\u2019]s\b/g, '').replace(/['\u2019]/g, '').replace(/[^a-z]+/g, ' ').trim().split(/\s+/).filter(w => w && !/^(?:the|a|an|of|in|on|at)$/.test(w)).slice(0, 3).join('_');
  function sideFor(g){
    const row = g && g.row; if(!row || !row.pack || row.live_view || g.agenda) return;
    const u = String(row.pack).replace(/\.json$/, '.objects.json'); if(SIDE.has(u)){ g.side = SIDE.get(u); return; }
    SIDE.set(u, null);
    fetch(u).then(r => r.ok ? r.json() : null).then(d => { const m = {}; ((d && d.objects) || []).forEach(o => { if(o && o.label) m[o.label] = o.klass || o.model_class || ''; }); SIDE.set(u, m); if(!g.gone) g.side = m; }).catch(()=>{});
  }
  function nameOf(c){
    const g = c.home; if(!g || g.live) return null;
    if(c._nm !== undefined && c._nmSide === !!g.side) return c._nm;
    let n = null; const lab = String(c.label || '');
    if(lab && !/^cut\d*$/i.test(lab) && !GENERIC.test(lab.toLowerCase()) && !PERSONISH.test(lab.toLowerCase())) n = snk(lab);
    else if(lab && PERSONISH.test(lab.toLowerCase()) && g.title && !/[·\d]/.test(g.title)){ const t = snk(g.title); if(t) n = 'figure_from_' + t; }
    if(!n){
      const k = String((g.side && g.side[lab]) || '').toLowerCase().trim();
      if(k && !GENERIC.test(k) && !PERSONISH.test(k)) n = snk(k);
      else if(k && PERSONISH.test(k) && g.title && !/[·\d]/.test(g.title)){ const t = snk(g.title); if(t) n = 'figure_from_' + t; }
    }
    if(n && (GENERIC.test(n) || PERSONISH.test(n) || /^(?:person|people)_/.test(n))) n = null; // "person 2" and the like are not names
    c._nm = n || null; c._nmSide = !!g.side; return c._nm;
  }
  const placeOf = c => c.home && c.home.live && c.home.place ? snk(String(c.home.place).replace(/_/g, ' ')) || null : null;
  const MEET = S.meet = {pairs: new Map(), place: {}, q: [], lastOut: 0, lines: [], GAP: 0.35, OV: 0.12, OFF: 0.02, PAIR_CD: 40000, OUT_MS: 4500};
  const PRI = {remembers: 4, meets: 3, interactwith: 3, arrivesat: 3, passes: 3, leaves: 2, leavesfrom: 2, consequence: 3, approaches: 1}; // a consequence ties with the meeting and follows it (older first)
  function say(verb, a, b, info){
    const t = a + '.' + verb + '(' + b + ');';
    MEET.q.push({t, verb, at: Date.now(), info}); MEET.q.sort((x, y) => (PRI[y.verb] || 0) - (PRI[x.verb] || 0) || x.at - y.at);
    if(MEET.q.length > 4) MEET.q.length = 4;
    if(WM_TOUCH.test(verb) && b) wmOnMeet(a, b);
  }
  function flushMeet(){
    const now = Date.now(); MEET.q = MEET.q.filter(x => now - x.at < 12000);
    if(!MEET.q.length || now - MEET.lastOut < MEET.OUT_MS) return;
    const x = MEET.q.shift(); MEET.lastOut = now;
    const dl = root.__thrydDriftLines = root.__thrydDriftLines || [];
    dl.push({t: x.t, a: true, note: x.verb === 'consequence' && x.info && x.info.wm ? 'world memory · ' + String(x.info.wm.text || '').slice(0, 140) : x.verb === 'remembers' ? 'they have met before' : x.info && x.info.live ? 'a live view of the agenda' : 'two stories touch on the stage'});
    if(dl.length > 6) dl.splice(0, dl.length - 6);
    MEET.lines.push(new Date().toTimeString().slice(0, 8) + ' ' + x.t); if(MEET.lines.length > 40) MEET.lines.shift();
    if(x.info && x.info.touch && typeof root.thrydMeet === 'function'){ try{ root.thrydMeet({a: x.info.a, b: x.info.b, verb: x.verb, scene: x.info.scene, with_scene: x.info.with_scene, run: x.info.run}); }catch(e){} }
  }
  // ---------- world memory (Jesuye 14 Nov 2026 3:24 PM ET: "stories should be naturally happening ... the laundromat has her data
  // somewhere in their database"): tools/world_memory.py (cmd_loop) keeps every object's facts in a shared append-only store
  // (#thryd and the box both write; #thryd wins) and publishes data/world_facts.json. When a pair that has a consequence meets
  // again on the stage, its consequence line follows the meeting line, e.g. yaba_bookshop.receives(ikeja_laundromat.receipt);
  // now and then (at most every ~2 min, only when the column is quiet) the newest unseen consequence shows on its own.
  // Lines go through the same queue as the meetings, so the column still gets at most one line every 4.5 s. No tags, no engine calls.
  const WM = S.worldMem = {cons: [], alias: {}, shown: new Map(), pair: new Map(), lastAmb: Date.now(), PAIR_CD: 90000, LINE_CD: 600000, AMB_MS: 120000, at: 0};
  const WM_TOUCH = /^(?:meets|interactwith|arrivesat|passes|remembers)$/;
  function loadWM(){ fetch('data/world_facts.json?t=' + Date.now(), {cache: 'no-store'}).then(r => r.ok ? r.json() : null).then(d => {
    if(!d || !Array.isArray(d.consequences)) return; // keep the last good bank; a malformed export must not wipe it
    const ok = c => { try{ return !!(c && c.id && /^[a-z][a-z0-9_]*\.[a-z]+\(/.test(String(c.code || '')) && !/\bcut\d+\b/.test(String(c.code))); }catch(e){ return false; } };
    const next = d.consequences.concat(Array.isArray(d.memories) ? d.memories : []).filter(ok);
    if(!next.length && WM.cons.length) return;
    next.sort((x, y) => String(x.ts || '') < String(y.ts || '') ? -1 : 1);
    WM.cons = next; WM.alias = (d.alias && typeof d.alias === 'object') ? d.alias : (WM.alias || {}); WM.at = Date.now(); }).catch(()=>{}); }
  loadWM(); setInterval(loadWM, 300000);
  const wmName = n => (WM.alias && WM.alias[n]) || n;
  function wmPick(a, b){
    const A = a == null ? null : wmName(a), B = b == null ? null : wmName(b), now = Date.now(); let best = null;
    for(let i = WM.cons.length - 1; i >= 0; i--){
      const c = WM.cons[i]; if(now - (WM.shown.get(c.id) || 0) < WM.LINE_CD) continue;
      const h = A == null ? 1 : ((c.a === A && c.b === B) || (c.a === B && c.b === A)) ? 2 : (c.a === A || c.b === A || c.a === B || c.b === B) ? 1 : 0;
      if(h && (!best || h > best.h)) best = {c, h}; if(best && (best.h === 2 || A == null)) break;
    }
    return best;
  }
  function wmSay(c){
    WM.shown.set(c.id, Date.now());
    MEET.q.push({t: String(c.code).replace(/;?\s*$/, m => /\}\s*$/.test(String(c.code)) ? '' : ';').slice(0, 170), verb: 'consequence', at: Date.now(), info: {wm: c}});
    MEET.q.sort((x, y) => (PRI[y.verb] || 0) - (PRI[x.verb] || 0) || x.at - y.at); if(MEET.q.length > 4) MEET.q.length = 4;
  }
  function wmOnMeet(a, b){
    if(!WM.cons.length) return; const k = [wmName(a), wmName(b)].sort().join('~'), now = Date.now();
    if(now - (WM.pair.get(k) || 0) < WM.PAIR_CD) return;
    const p = wmPick(a, b); if(!p || (p.h < 2 && Math.random() < .5)) return;
    WM.pair.set(k, now); wmSay(p.c);
  }
  function wmAmbient(now){
    if(!WM.cons.length || now - WM.lastAmb < WM.AMB_MS || MEET.q.length || now - MEET.lastOut < 20000 || Math.random() > .1) return;
    WM.lastAmb = now; const p = wmPick(null, null); if(p) wmSay(p.c);
  }
  S.wmPick = wmPick; S.meetSay = say;
  function meetTick(){
    if(paused()) return;
    const W0 = vw(), H0 = vh(), now = Date.now(), pts = [];
    S.groups.forEach(g => { if(!g.side && !g.live && !g.agenda) sideFor(g); });
    S.cuts.forEach(c => {
      if(c.entering || c.leaving || !c.el || !c.el.isConnected || !c.home || c.home.gone) return;
      const nm = c.home.live ? null : tagName(c), pl = placeOf(c); if(!nm && !pl) return; // same names as the tags
      const r = c.el.getBoundingClientRect(); if(r.width < 8 || r.height < 8 || r.right < 0 || r.bottom < 0 || r.left > W0 || r.top > H0) return;
      pts.push({c, nm, pl, r, z: +c.el.style.zIndex || 0, moving: !!(c.wan || c.dragging)});
    });
    const seen = new Set();
    for(let i = 0; i < pts.length; i++) for(let j = i + 1; j < pts.length; j++){
      const A = pts[i], B = pts[j]; if(A.c.home === B.c.home) continue;
      if(!A.nm && !B.nm) continue; // two places with no named object between them: nothing to say
      const an = A.nm || A.pl, bn = B.nm || B.pl; if(an === bn) continue;
      const key = [A.c.home.mid + '|' + A.c.label, B.c.home.mid + '|' + B.c.label].sort().join('~'); seen.add(key);
      const ix = Math.max(0, Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left)), iy = Math.max(0, Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top));
      const ov = ix * iy / Math.max(1, Math.min(A.r.width * A.r.height, B.r.width * B.r.height));
      const dx = Math.max(0, A.r.left - B.r.right, B.r.left - A.r.right), dy = Math.max(0, A.r.top - B.r.bottom, B.r.top - A.r.bottom);
      const gap = Math.hypot(dx, dy) / Math.max(1, Math.min(Math.max(A.r.width, A.r.height), Math.max(B.r.width, B.r.height)));
      let P = MEET.pairs.get(key); if(!P){ P = {touch: false, since: 0, met: 0, gap, last: {}, seen: now}; MEET.pairs.set(key, P); }
      const live = A.pl && !A.nm ? A : B.pl && !B.nm ? B : null, obj = live ? (live === A ? B : A) : null;
      const info = {a: an, b: bn, live: !!live, touch: true, scene: A.c.home.mid, with_scene: B.c.home.mid, run: (A.c.home.run || B.c.home.run || null)};
      const cool = v => now - (P.last[v] || 0) > MEET.PAIR_CD;
      if(!P.touch && ov > MEET.OV){
        P.touch = true; P.since = now; P.met++;
        if(cool('touch')){
          P.last.touch = now;
          if(live){ if(now - (MEET.place[live.pl] || 0) > 15000){ MEET.place[live.pl] = now; say('arrivesat', obj.nm, live.pl, Object.assign({}, info, {a: obj.nm, b: live.pl})); } }
          else {
            const mover = A.moving && !B.moving ? A : B.moving && !A.moving ? B : null;
            if(mover && mover.z >= (mover === A ? B : A).z) say('passes', mover.nm, (mover === A ? B : A).nm || (mover === A ? B : A).pl, info);
            else say(Math.random() < .6 ? 'meets' : 'interactwith', an, bn, info);
          }
          if(P.met >= 2 && Math.random() < .5 && cool('remembers')){ P.last.remembers = now; const o = obj || (Math.random() < .5 ? A : B), other = live ? live.pl : (o === A ? bn : an); if(o.nm) say('remembers', o.nm, other, {live: !!live}); }
        }
      } else if(P.touch && ov < MEET.OFF && gap > 0.04){
        const held = now - P.since; P.touch = false;
        if(held > 2500 && cool('leave')){ P.last.leave = now; if(live) say('leavesfrom', obj.nm, live.pl, {live: true}); else say('leaves', an, bn, {}); }
      } else if(!P.touch && gap < MEET.GAP && P.gap - gap > 0.05 && cool('approach') && cool('touch')){
        P.last.approach = now; const a1 = A.moving || !B.nm ? A : B, b1 = a1 === A ? B : A; if(a1.nm) say('approaches', a1.nm, b1.nm || b1.pl, {live: !!live});
      }
      P.gap = gap; P.seen = now;
    }
    MEET.pairs.forEach((P, k) => { if(!seen.has(k) && now - P.seen > 120000) MEET.pairs.delete(k); });
    try{ wmAmbient(now); }catch(e){}
    flushMeet();
  }
  S.meetTick = meetTick; S.nameOf = nameOf;
  setInterval(()=>{ try{ meetTick(); }catch(e){} }, 1500);

  // ---------- name tags (Jesuye 14 Nov 2026 10:11 AM ET): every cutout carries its object name under it and every frame / plate its
  // frame name in a corner, lowercase snake_case, so a customer can type frame.object.method(). Names come from data/frame_objects.json
  // (tools/export_frame_objects.py: live-view place, safe / scene title, sidecar class, objects_map / agenda labels); never cutN, no
  // real people's names. Jesuye 10:22-10:24 AM ET: tags are hidden by default; a plain tap/click on a cutout (moved < 6 px, < 300 ms)
  // shows that object's name, which follows it and fades by itself after ~3 s (or when it leaves); tapping it again only restarts
  // the timer (no tap-to-hide); several may show at a time.
  // Listeners are passive capture listeners that never cancel or stop the event, so drags are untouched; no menus, no engine calls here
  // (16 Nov 2026: the same tap also calls openMethods(), whose menu and relay send live in their own section after typed commands).
  const FO = S.frameObjects = {by: {}, chips: null, at: 0};
  function loadFO(){ fetch('data/frame_objects.json?t=' + Date.now(), {cache: 'no-store'}).then(r => r.ok ? r.json() : null).then(d => {
    if(!d || !d.by_scene) return; FO.by = d.by_scene; FO.at = Date.now();
    FO.chips = null; Object.keys(d.frames || {}).forEach(f => { if((d.frames[f].scenes || []).some(x => /^chips:/.test(x))) FO.chips = f; });
    S.cuts.forEach(c => { c._tag = undefined; c._time = undefined; }); S.groups.forEach(g => { g._ftag = undefined; }); }).catch(()=>{}); }
  loadFO(); setInterval(loadFO, 300000);
  function frameName(g){
    if(g._ftag !== undefined) return g._ftag;
    const e = FO.by[g.mid]; let f = e && e.frame;
    if(!f && g.live && g.place) f = snk(String(g.place).replace(/_/g, ' '));
    if(!f && /^chips:/.test(String(g.mid))) f = FO.chips || 'the_cast';
    if(!f && g.title && !/[·\d]/.test(g.title)) f = snk(g.title);
    return (g._ftag = f || null);
  }
  function tagName(c){
    if(c._tag !== undefined) return c._tag;
    const g = c.home, f = g ? frameName(g) : null, e = g && FO.by[g.mid], lab = String(c.label || '');
    let n = e && e.objects ? (e.objects[lab] || (Object.keys(e.objects).length ? Object.values(e.objects)[Math.min(c.i | 0, Object.keys(e.objects).length - 1)] : null)) : null;
    if(!n && g && /^chips:/.test(String(g.mid))) n = snk(lab);
    if(!n) n = nameOf(c);
    if(!n && f) n = f + (PERSONISH.test(String(c.klass || '').toLowerCase()) ? '_figure' : '_subject');
    if(n && (/^cut\d*$/.test(n) || /\d/.test(n.replace(/\u00b7\d+$/, '')))) n = f ? f + '_subject' : null; // a ·N version marker is allowed
    return (c._tag = n || null);
  }
  // Jesuye 15 Nov 2026 2:38 / 2:40 AM ET: a tapped name also shows its in-story time, "#time: HH:MM" (24 h), on a second line that
  // fades with it. Precomputed in data/frame_objects.json by_scene[id].time (card caption / frame text / stable placeholder,
  // see tools/export_frame_objects.py); a scene missing there gets the same placeholder: FNV-1a 32 of its id, 06:00-23:55 in 5 min.
  function fnv1a(t){ let h = 0x811c9dc5; const b = new TextEncoder().encode(String(t)); for(let i = 0; i < b.length; i++){ h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
  function placeholderTime(id){ const m = 360 + (fnv1a(id) % 216) * 5; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  function timeOf(c){
    if(c._time !== undefined) return c._time;
    const g = c.home, id = g ? String(g.mid || '') : '', e = id && FO.by[id];
    let t = e && /^\d\d:\d\d$/.test(String(e.time || '')) ? e.time : null;
    if(!t && id) t = placeholderTime(id);
    return (c._time = t || null);
  }
  S.tagName = tagName; S.frameName = frameName; S.timeOf = timeOf; S.placeholderTime = placeholderTime;
  const TAGS = document.createElement('div'); TAGS.id = 'gnames'; stage.appendChild(TAGS);
  const tcss = document.createElement('style');
  tcss.textContent = [
    '#gnames{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2}',
    '#gnames .gn{position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;font:600 ' + (PHONE ? 'max(10px,1.45vh)' : 'max(10px,1.3vh)') + ' ui-monospace,Menlo,Consolas,monospace;letter-spacing:.02em;color:#fff;' +
      'text-shadow:0 0 2px #000,0 0 3px #000,0 1px 2px #000,0 0 6px rgba(0,0,0,.55);transition:opacity .8s;will-change:transform;user-select:none}',
    '#gnames .gn.gt{white-space:pre;text-align:center;line-height:1.25}',
    '#gnames .gn.gf{color:#ffe7a8;font-size:' + (PHONE ? 'max(10px,1.35vh)' : 'max(10px,1.2vh)') + '}'
  ].join('\n');
  document.head.appendChild(tcss);
  const tagEls = new Map(); // key (cut or group) -> el
  function tagEl(key, text, frame){
    let el = tagEls.get(key);
    if(!el){ el = document.createElement('div'); el.className = 'gn' + (frame ? ' gf' : ''); el.style.opacity = '0'; TAGS.appendChild(el); tagEls.set(key, el); }
    if(el.textContent !== text){ el.textContent = text; el.classList.toggle('gt', text.indexOf('\n') >= 0); }
    return el;
  }
  const SHOWN = S.shownTags = new Map(), TAG_MS = 3000, FADE_MS = 800; // cut -> shown at
  let tapD = null; // (was swallowed by the comment above: every pointerdown threw 'tapD is not defined')
  function cutAt(t){ if(!t || !t.closest) return null; let best = null; S.cuts.forEach(c => { if(!best && c.el && c.el.isConnected && (c.el === t || c.el.contains(t))) best = c; }); return best; }
  // forgiving input (17 Nov 2026 2:54 PM ET): a tap that lands just off an object (24 px, 36 px on touch) snaps to the nearest one
  const UIQ = 'button,select,input,textarea,a,#gmeth,#gtweet,#gpinpop,#bar,#zoomui,#gundo,#uxhint,.bubble,#phone3310,[role=dialog]';
  function nearCut(x, y, touch){ const R = touch ? 36 : 24; let best = null, bd = R + 1;
    S.cuts.forEach(c => { if(!c.el || !c.el.isConnected || c.leaving) return; const r = c.el.getBoundingClientRect(); if(r.width < 2) return;
      const dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom), d = Math.hypot(dx, dy); if(d <= R && d < bd){ bd = d; best = c; } });
    return best; }
  S.nearCut = nearCut;
  addEventListener('pointerdown', e => { if(e.isPrimary === false || (e.button != null && e.button > 0)){ tapD = null; return; } let c = cutAt(e.target), snap = false;
    if(!c && !(e.target && e.target.closest && e.target.closest(UIQ))){ c = nearCut(e.clientX, e.clientY, e.pointerType === 'touch'); snap = !!c; }
    tapD = {x: e.clientX, y: e.clientY, t: performance.now(), c, m: false, snap}; }, {capture: true, passive: true});
  addEventListener('pointermove', e => { if(tapD && Math.hypot(e.clientX - tapD.x, e.clientY - tapD.y) >= 6) tapD.m = true; }, {capture: true, passive: true});
  addEventListener('pointercancel', () => { tapD = null; }, {capture: true, passive: true});
  addEventListener('pointerup', e => { const d = tapD; tapD = null; if(!d || !d.c || d.m) return;
    if(Math.hypot(e.clientX - d.x, e.clientY - d.y) >= 6) return; const dur = performance.now() - d.t;
    if(dur >= 450){ try{ openMethods(d.c, {full: true}); }catch(err){} return; } // long-press: always the whole menu
    if(d.c && d.c.map){ try{ showPinPop(d.c); }catch(err){} return; }
    if(dur >= 300) return;
    if(d.snap) note('snap', objName(d.c));
    if(tagName(d.c)) toggleTag(d.c); try{ tapIntent(d.c); }catch(err){ note('methods', String(err && err.message || err)); } }, {capture: true, passive: true});
  function toggleTag(c){ SHOWN.set(c, Date.now()); tagT = 0; scheduleTags(); } // show (or restart the ~3 s timer); never hides
  S.toggleTag = toggleTag;
  let tagT = 0;
  function tickTags(now){
    if(now - tagT < 50) return; tagT = now;
    const W0 = vw(), H0 = vh(), jobs = [], live = new Set();
    // reads first
    const tnow = Date.now();
    SHOWN.forEach((t, c) => { if(!c.el || !c.el.isConnected || c.gone || S.cuts.indexOf(c) < 0 || tnow - t > TAG_MS + FADE_MS) SHOWN.delete(c); });
    SHOWN.forEach((t, c) => {
      const n = (displayNameFor(c) || tagName(c)); if(!n) return;
      const r = c.el.getBoundingClientRect(); if(r.right < -50 || r.left > W0 + 50 || r.bottom < -30 || r.top > H0 + 30 || r.width < 6) return;
      const tm = timeOf(c);
      live.add(c); jobs.push({k: c, t: tm ? n + '\n#time: ' + tm : n, x: r.left + r.width / 2, y: r.bottom + 2, on: tnow - t < TAG_MS && !c.leaving && c.el.style.opacity !== '0', mid: true});
    });
    let wr = null;
    if(false) // frame tags stay hidden (Jesuye 10:22 AM ET: always-on tags were too noisy)
    S.groups.forEach(g => {
      if(g.gone) return; const f = frameName(g); if(!f) return; let x, y;
      if(g.bgEl && g.bgEl.isConnected){ const r = g.bgEl.getBoundingClientRect(); const E = PHONE ? 0.22 : 0.28, k0 = E / (1 + 2 * E); x = r.left + r.width * k0 + 4; y = r.top + r.height * k0 + 2; }
      else { wr = wr || world.getBoundingClientRect(); x = wr.left + g.x + 4; y = wr.top + g.y + 2; }
      if(x < -200 || x > W0 || y < -20 || y > H0) return;
      live.add(g); jobs.push({k: g, t: f, x, y, on: Date.now() - g.born > 2500, frame: true});
    });
    // then writes
    jobs.forEach(j => { const el = tagEl(j.k, j.t, j.frame); el.style.transform = 'translate3d(' + (j.mid ? 'calc(' + j.x.toFixed(1) + 'px - 50%)' : j.x.toFixed(1) + 'px') + ',' + j.y.toFixed(1) + 'px,0)';
      const o = j.on ? '1' : '0'; if(el.style.opacity !== o) el.style.opacity = o; });
    tagEls.forEach((el, k) => { if(!live.has(k)){ el.remove(); tagEls.delete(k); } });
  }
  S.tickTags = tickTags;
  // v617 heat: the name-tag follow used to request a display frame forever (even with no tag on screen, that kept the
  // shared 30/10 fps pump running). It now wakes only while a tapped tag is showing (~20 fps), and sleeps otherwise.
  let tagRaf = 0, tagWait = 0;
  function scheduleTags(){
    if(tagRaf || tagWait || !SHOWN.size) return;
    if(document.hidden || (root.LH && LH.state === 'hidden')) return;
    tagWait = setTimeout(function(){ tagWait = 0; if(!SHOWN.size || document.hidden || (root.LH && LH.state === 'hidden')) return; tagRaf = requestAnimationFrame(tagLoop); }, paused() ? 200 : 50);
  }
  function tagLoop(now){
    tagRaf = 0;
    try{ if(!paused()) tickTags(now || performance.now()); }catch(e){}
    scheduleTags();
  }
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) scheduleTags(); });

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
  S.stats = ()=>({groups: storyGroups().length, stories: [...new Set(storyGroups().map(g => g.mid))], cuts: storyCuts().length, pins: S.cuts.filter(c => c.map).length, cap: CAP, maxSeen: S.maxSeen, mb: +(S.bytes / 1048576).toFixed(1), spawned: S.spawned, left: S.left, fails: S.fails, carries: S.carries || 0, loading: S.loading, visible: S.groups.filter(g => { const v = view(); return g.x < v.x + v.w && g.x + g.w > v.x && g.y < v.y + v.h && g.y + g.h > v.y; }).length, cam: {x: Math.round(cam.x), y: Math.round(cam.y)}, ready: S.ready.length, fill: S.fill(), cmd: {calls: CMD.calls, looks: CMD.looks.size, applied: CMD.applied, src: CMD.src, cast: S.cuts.filter(c => c.castAs).length}, agenda: {active: AG.active, runs: AG.runs.length, runObjects: AG.runs.reduce((n, r) => n + (r.objects || []).length + (r.characters || []).length, 0), activeOnStage: S.cuts.filter(c => c.home && c.home.agenda && c.home.run === AG.active).length, scenes: AG.keys.length, sprites: AG.avail, chipsAvail: AG.availChips, groupsSpawned: AG.spawned, chipGroups: AG.chips, onStageGroups: S.groups.filter(g => g.agenda).length, onStageCuts: S.cuts.filter(c => c.home && c.home.agenda).length}, loop: S.loop, cooled: S.bad.size, net: {held: netHeld(), holds: S.net.holds}, releases: S.releases, exits: (S.exits || []).length, softCap: SOFT_CAP, mediaAgoS: Math.round((Date.now() - S.lastMedia) / 1000), worker: WK.off ? 'off' : 'on', decodeMs: WK.ms.length ? Math.round(WK.ms.reduce((a, b) => a + b, 0) / WK.ms.length) : null, focus: focus && focus.mid, rm: RM, phone: PHONE});

  // ---------- typed commands on the stage (Jesuye 11-13 12:43 AM "if dapo was on the screens i did dapo.setskincomplexion(light),
  // it should show on the projector"). Source: #thryd's typed_calls.json (every seated typed call of every agenda), published
  // data-only as data/commands.json by tools/cmd_loop.sh. The latest setX(value) per subject+key is the subject's look; it lasts,
  // and every later group with that subject on stage gets it too. Subjects bind to cuts by exact name/class (lamp, phone, Kunle),
  // and a character with no cut of its own name is cast onto up to two person cuts on stage (stable while they stay; a newcomer
  // takes the part when one leaves). Calls new since this page opened type into #code and pulse their cuts.
  // Looks are CSS filters / scale / opacity on the cut only: never a blur, never on faces alone.
  const CMD = S.cmd = {looks: new Map(), seen: new Set(), chars: new Set(['dapo']), first: true, calls: 0, at: null, applied: 0, src: null};
  const TONE = {light: 'brightness(1.22) saturate(.86) contrast(.96)', fair: 'brightness(1.22) saturate(.86) contrast(.96)', pale: 'brightness(1.3) saturate(.7)',
    lighter: 'brightness(1.22) saturate(.86)', medium: 'brightness(1.05) saturate(1.05) sepia(.12)', tan: 'brightness(.98) sepia(.28) saturate(1.2)', brown: 'brightness(.9) sepia(.3) saturate(1.15)',
    dark: 'brightness(.74) saturate(1.12) contrast(1.05)', darker: 'brightness(.74) saturate(1.12) contrast(1.05)', ebony: 'brightness(.62) saturate(1.1) contrast(1.08)'};
  const HUE = {red: 0, orange: 30, yellow: 55, gold: 45, green: 120, teal: 170, cyan: 185, blue: 220, purple: 275, violet: 275, pink: 320, magenta: 300};
  const lowv = v => String(v == null ? '' : v).toLowerCase().replace(/[\[\]"']/g, '').trim();
  const isOff = v => /^(false|no|off|0|none|hidden)$/.test(lowv(v));
  // key -> how it looks. Returns {filter?, scale?, opacity?} or null (unknown: shown in #code with a pulse only)
  const VERBS = {
    skincomplexion: v => TONE[lowv(v)] ? {filter: TONE[lowv(v)]} : null, complexion: v => VERBS.skincomplexion(v), skin: v => VERBS.skincomplexion(v), skintone: v => VERBS.skincomplexion(v),
    brightness: v => { const n = parseFloat(v); return {filter: 'brightness(' + (isFinite(n) ? Math.max(.3, Math.min(2, n > 3 ? n / 100 : n)) : (/dim|low/.test(lowv(v)) ? .7 : 1.3)) + ')'}; },
    glow: v => isOff(v) ? {filter: ''} : {filter: 'drop-shadow(0 0 .9vh ' + (HUE[lowv(v)] != null ? 'hsl(' + HUE[lowv(v)] + ',100%,60%)' : '#ffd76a') + ') drop-shadow(0 0 .3vh #fff8)'},
    colour: v => HUE[lowv(v)] != null ? {filter: 'sepia(.55) saturate(2.4) hue-rotate(' + (HUE[lowv(v)] - 35) + 'deg)'} : (lowv(v) === 'black' ? {filter: 'brightness(.45) saturate(.6)'} : lowv(v) === 'white' ? {filter: 'brightness(1.45) saturate(.4)'} : null),
    color: v => VERBS.colour(v), tint: v => VERBS.colour(v),
    size: v => { const x = lowv(v), n = parseFloat(x); return {scale: isFinite(n) ? Math.max(.4, Math.min(2.2, n)) : /big|large|tall|huge|giant/.test(x) ? 1.35 : /small|tiny|short|little/.test(x) ? .72 : 1}; },
    visible: v => ({opacity: isOff(v) ? .14 : 1}), hidden: v => ({opacity: isOff(v) ? 1 : .14}),
    mood: v => /sad|blue|down/.test(lowv(v)) ? {filter: 'saturate(.45) brightness(.9)'} : /happy|joy|glad/.test(lowv(v)) ? {filter: 'saturate(1.35) brightness(1.08)'} : /angry|mad/.test(lowv(v)) ? {filter: 'sepia(.4) saturate(2) hue-rotate(-30deg)'} : null
  };
  // non-set verbs that are a look too: grow(), shrink(), hide(), show(), glow(), dim(), brighten()
  const FNS = {grow: ['size', 'big'], shrink: ['size', 'small'], hide: ['visible', 'false'], show: ['visible', 'true'], appear: ['visible', 'true'], vanish: ['visible', 'false'],
    glow: ['glow', 'true'], dim: ['brightness', 'dim'], brighten: ['brightness', 'bright'], lighten: ['skincomplexion', 'light'], darken: ['skincomplexion', 'dark']};
  S.cmdVerbs = ()=>({set: Object.keys(VERBS), fns: Object.keys(FNS), tones: Object.keys(TONE), colours: Object.keys(HUE)});
  const ckey = x => String(x || '').toLowerCase().replace(/^[oc]:/, '').replace(/[^a-z0-9]+/g, '');
  const PERSON = /^(person|man|woman|boy|girl|child|kid|people|human|figure|lady|guy)$/i;
  function subjCuts(sk){
    const own = S.cuts.filter(c => !c.leaving && (ckey(c.label) === sk || ckey(c.klass) === sk || ckey(nkey(c.label)) === sk || ckey(nkey(c.klass)) === sk));
    const L = CMD.looks.get(sk);
    // a text chip naming the character is not a body: it gets the look too, but a person cut still plays the part
    if(own.length && (!L || !L.cast || own.some(c => !(c.home && c.home.row && c.home.row.chips)))) return own;
    if(!L || !L.cast) return own;
    // a character: up to two person cuts play the part
    let mine = S.cuts.filter(c => !c.leaving && c.castAs === sk);
    if(mine.length < 2){ const v0 = view(), free = S.cuts.filter(c => !c.leaving && !c.castAs && PERSON.test(String(c.klass || c.label || '')) && !c.entering && !c.dragging && c.g && !c.g.gone && inView(c, v0));
      if(!free.length) S.cuts.forEach(c => { if(!c.leaving && !c.castAs && !c.dragging && PERSON.test(String(c.klass || c.label || ''))) free.push(c); }); // nobody settled in view yet: take any figure
      const v = view(); free.sort((a, b) => b.w * b.h * (inView(b, v) ? 3 : 1) - a.w * a.h * (inView(a, v) ? 3 : 1)); // a big, visible figure plays the part
      while(mine.length < 2 && free.length){ const c = free.splice(Math.random() * Math.min(3, free.length) | 0, 1)[0]; c.castAs = sk; c.castNew = true; mine.push(c); } }
    return own.concat(mine);
  }
  const inView = (c, v)=> c.left < v.x + v.w && c.left + c.w > v.x && c.top < v.y + v.h && c.top + c.h > v.y;
  function paint(c, L){
    const f = [], parts = L.parts; let sc = 1, op = 1;
    Object.keys(parts).forEach(k => { const p = parts[k]; if(p.filter) f.push(p.filter); if(p.scale) sc *= p.scale; if(p.opacity != null) op = Math.min(op, p.opacity); });
    const ff = f.join(' ').trim(); if(c.el.style.filter !== ff) c.el.style.filter = ff;
    const ss = sc === 1 ? '' : String(sc); if(c.el.style.scale !== ss) c.el.style.scale = ss;
    if(!c.entering && !c.leaving){ const oo = op === 1 ? '' : String(op); if(c.el.style.opacity !== oo && !(c.el.style.opacity === '1' && oo === '')) c.el.style.opacity = oo || '1'; }
    c.look = L;
  }
  function tagAt(c, text){ const t = document.createElement('div'); t.className = 'gtag gcarry'; t.textContent = text;
    Object.assign(t.style, {left: (c.left + c.w / 2) + 'px', top: (c.top - 16) + 'px'}); cutsL.appendChild(t);
    requestAnimationFrame(()=> t.classList.add('on')); setTimeout(()=> t.classList.remove('on'), 6000); setTimeout(()=> t.remove(), 8000); }
  function pulse(c){ c.el.classList.remove('gnotice'); void c.el.offsetWidth; c.el.classList.add('gnotice'); setTimeout(()=> c.el.classList.remove('gnotice'), 1300); }
  function codeLine(t, note){ try{ const dl = root.__thrydDriftLines = root.__thrydDriftLines || []; const line=String(t==null?'':t); if(!line)return; dl.unshift({t:line, a: true, note: note==null?'':String(note)}); if(dl.length > 8) dl.length = 8; }catch(e){} }
  function prettySendErr(err, final){ const s=String(err||''); if(!s) return 'queued\u2026'; if(/timed out|abort/i.test(s)) return final ? 'timed out!' : 'timed out, retrying'; return 'retrying \u00b7 ' + s; }
  function updateCodeNote(code, note){
    const line=String(code||'').replace(/;+\s*$/,'');
    if(!line||note==null) return;
    try{
      const dl=root.__thrydDriftLines||[];
      for(const x of dl){ if(x && String(x.t||'').replace(/;+\s*$/,'')===line){ x.note=String(note); break; } }
    }catch(e){}
    try{
      const nodes=document.querySelectorAll('#code > div, #code div');
      for(const el of nodes){
        const first=el.childNodes[0];
        const raw=String((first && first.nodeType===3 ? first.textContent : el.textContent)||'').split('\n')[0].replace(/;?\s*$/,'');
        if(raw===line || raw.indexOf(line)===0){
          let span=el.querySelector('span.d');
          if(!span){ span=document.createElement('span'); span.className='d'; el.appendChild(span); }
          span.textContent='  // '+note;
          break;
        }
      }
    }catch(e){}
  }
  function setSendNote(code, rec, prefix){
    rec = rec || {};
    const err = rec.lastError || rec.error;
    const st = rec.status;
    let tail;
    if((st==='sent'||st==='accepted'||st==='ok') && rec.ntfyId) tail='sent \u2713 '+rec.ntfyId;
    else if(st==='sent'||st==='accepted'||st==='ok') tail='sent, waiting for an ntfy id';
    else if(st==='no_reply') tail='sent \u2713 '+(rec.ntfyId||'')+' \u00b7 no reply from the box yet';
    else if(st==='qa_not_sent') tail='QA: not sent';
    else if(st==='rejected') tail='rejected'+(err?(' \u00b7 '+err):'');
    else if(st==='failed') tail=prettySendErr(err, true);
    else if(err) tail=prettySendErr(err, false);
    else if(st==='queued'||st==='retrying') tail='queued\u2026'+(err?(' \u00b7 '+prettySendErr(err,false)):'');
    else tail='sending\u2026';
    const pre=String(prefix||rec.sendPrefix||'').replace(/\s*\u00b7\s*sending\u2026?\s*$/,'').replace(/\s+$/,'');
    const note=(pre? pre+' \u00b7 ' : '')+tail;
    rec.sendNote=note;
    updateCodeNote(code || rec.code || rec.resolved, note);
    return note;
  }
  function ingest(calls, quiet){
    const fresh = [];
    (calls || []).forEach(e => {
      if(!e || !e.id || CMD.seen.has(e.id)) return; CMD.seen.add(e.id);
      const sk = ckey(e.subject_key || e.subject); if(!sk) return;
      let key = e.change && e.change.key ? String(e.change.key).toLowerCase() : null, val = e.change ? e.change.value : null;
      const fn = String(e.fn || '').toLowerCase();
      if(!key && FNS[fn]){ key = FNS[fn][0]; val = (e.args && e.args[0] != null && fn === 'glow') ? e.args[0] : FNS[fn][1]; }
      if(key){ let L = CMD.looks.get(sk); if(!L){ L = {sk, name: e.subject, parts: {}, keys: {}, cast: false}; CMD.looks.set(sk, L); }
        const look = VERBS[key] ? VERBS[key](val) : null;
        L.keys[key] = {value: val, raw: e.raw, at: e.first_seen, run: e.run, card: e.card, known: !!look};
        if(look) L.parts[key] = look; else delete L.parts[key];
        // only a character (thryd.db kind 'character', or a person-only key like skin) is cast onto person cuts; a thing such as
        // lamp.setcolour(red) shows only on cuts named for it
        L.cast = L.cast || (!!look && (CMD.chars.has(sk) || /^(skincomplexion|complexion|skin|skintone|mood)$/.test(key)));
        L.at = e.first_seen; }
      if(!quiet) fresh.push({e, sk, key, known: !!(key && VERBS[key] && VERBS[key](val))});
    });
    return fresh;
  }
  function applyLooks(){
    CMD.looks.forEach((L, sk) => { const cuts = Object.keys(L.parts).length ? subjCuts(sk) : [];
      cuts.forEach(c => { if(c.tapL || c.freeLook) return; // a cut someone tapped a method on, or a new agenda command, keeps that look
        if(c.look !== L || c.lookN !== Object.keys(L.keys).length){ paint(c, L); c.lookN = Object.keys(L.keys).length; CMD.applied++; }
        if(c.castNew){ c.castNew = false; tagAt(c, String(L.name || sk) + ' · ' + Object.keys(L.keys).filter(k => L.keys[k].known).map(k => k + '=' + lowv(L.keys[k].value)).join(', ')); } }); });
    // a cut whose part was dropped goes back to its own look
    S.cuts.forEach(c => { if(c.castAs && !CMD.looks.has(c.castAs)) c.castAs = null; });
  }
  function announce(fresh){
    fresh.slice(-6).forEach(({e, sk, key, known}) => {
      const cuts = subjCuts(sk);
      codeLine(String(e.raw || (e.subject + '.' + e.fn + '()')).replace(/;?$/, ';'), (known ? 'typed in ' : 'typed (no look yet) in ') + (e.run || '') + (e.card ? '/' + e.card : '') + ' · ' + (cuts.length ? cuts.length + ' on stage' : 'shows when it comes on stage'));
      cuts.forEach((c, n) => setTimeout(()=>{ if(c.el.isConnected){ pulse(c); if(n === 0) tagAt(c, String(e.raw || '').slice(0, 60)); } }, n * 250));
      note('cmd', e.id, e.raw, known ? 'look' : 'code-only', cuts.length + ' cuts');
    });
  }
  const CMD_URLS = ['https://raw.githubusercontent.com/jdavidteki/thryd-projector/main/data/commands.json', 'data/commands.json'];
  async function pollCmds(){
    let d = null;
    for(const u of CMD_URLS){ try{ const r = await fetch(u + '?t=' + Date.now(), {cache: 'no-store'}); if(r.ok){ d = await r.json(); CMD.src = u.startsWith('http') ? 'raw' : 'pages'; break; } }catch(e){} }
    if(d && Array.isArray(d.characters)) d.characters.forEach(k => CMD.chars.add(ckey(k)));
    if(d && Array.isArray(d.calls)){ CMD.calls = d.calls.length; CMD.at = d.generated || null; const fresh = ingest(d.calls, CMD.first); CMD.first = false; applyLooks(); announce(fresh); }
  }
  // test hook (and for #thryd): feed calls straight in, e.g. thrydStageCmd([{id:'qa1',subject:'dapo',subject_key:'dapo',fn:'setskincomplexion',args:['light'],change:{key:'skincomplexion',value:'light'},raw:'dapo.setskincomplexion(light)'}])
  root.thrydStageCmd = calls => { const fresh = ingest(calls, false); applyLooks(); announce(fresh); return fresh.length; };
  pollCmds(); setInterval(pollCmds, 20000); setInterval(applyLooks, 1000);

  // ---------- new commands for the current agenda only (Jesuye 18 Nov 2026 9:15 AM ET): the ›_ prompt accepts any
  // typed call, even one that does not exist yet. Known commands still go through fireFunc / commands.json. An unknown
  // call is stored with the live run id and a timestamp (localStorage + data/agenda_cmds.json), never applied to other
  // agendas, and shown on stage (look / highlight / caption, or a tweet-style bubble tied to this agenda).
  const FREE_KEY = 'thryd_agenda_cmds_v1';
  if(!document.getElementById('gcmdcss')){ const st = document.createElement('style'); st.id = 'gcmdcss'; st.textContent = '.gcmdbub .gcas{color:#b6f0a0;font:600 .82em ui-monospace,Menlo,Consolas,monospace;margin-top:.2vh}.gcmdbub .gres{color:#ffe7a8;font:600 .82em ui-monospace,Menlo,Consolas,monospace;margin-top:.15vh}'; document.head.appendChild(st); }
  const FREE_URLS = ['data/agenda_cmds.json', 'https://raw.githubusercontent.com/jdavidteki/thryd-projector/main/data/agenda_cmds.json'];
  const FREE = S.freeCmds = {list: [], byId: new Map(), looks: new Map(), at: 0, src: null};
  function currentRun(){ return (LV && LV.activeRun) || (AG && AG.active) || null; }
  function parseFree(text){
    const s = String(text || '').trim().replace(/^\/+/, '').replace(/;+\s*$/, '');
    let m = s.match(/^#?([A-Za-z_][\w]*)\s*\.\s*([A-Za-z_][\w]*)\s*(?:\((.*)\))?$/) || s.match(/^#?([A-Za-z_][\w]*)\s+([A-Za-z_][\w]*)(?:\s*\((.*)\))?$/);
    if(m) return {obj: m[1], fn: m[2], args: m[3] != null ? m[3].split(',').map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean) : [], free: false, raw: s};
    return {free: true, obj: null, fn: null, args: [], words: s.toLowerCase().split(/[^a-z0-9_]+/).filter(w => w.length > 1), raw: s};
  }
  function loadFreeLocal(){
    try{ return JSON.parse(localStorage.getItem(FREE_KEY) || '[]'); }catch(e){ return []; }
  }
  function saveFreeLocal(){
    try{ localStorage.setItem(FREE_KEY, JSON.stringify(FREE.list.filter(c => c && c.local).map(c => ({id: c.id, run: c.run, raw: c.raw, text: c.text, subject: c.subject, fn: c.fn, args: c.args, at: c.at, t: c.t})))); }catch(e){}
  }
  function rememberFree(rec){
    if(!rec || !rec.id || FREE.byId.has(rec.id)) return FREE.byId.get(rec && rec.id) || rec;
    FREE.byId.set(rec.id, rec); FREE.list.push(rec);
    if(FREE.list.length > 200){ const drop = FREE.list.shift(); if(drop) FREE.byId.delete(drop.id); }
    if(rec.local) saveFreeLocal();
    return rec;
  }
  function agendaNames(run){
    const r = (AG.runs || []).find(x => x && x.run === run), out = [];
    if(r){
      (r.objects || []).forEach(o => { if(o) out.push(o.name || o.id || o.label); });
      (r.characters || []).forEach(c => { if(c) out.push(c.name || c.id); });
    }
    S.cuts.forEach(c => { if(c && c.home && c.home.run === run){ out.push(c.label, c.klass, c.castAs); } });
    return out.filter(Boolean);
  }
  function matchFreeCuts(sk, run){
    if(!sk) return [];
    const same = S.cuts.filter(c => !c.leaving && c.home && c.home.run === run && (ckey(c.label) === sk || ckey(c.klass) === sk || ckey(nkey(c.label)) === sk || ckey(nkey(c.klass)) === sk || ckey(c.castAs) === sk));
    if(same.length) return same;
    return S.cuts.filter(c => !c.leaving && (ckey(c.label) === sk || ckey(c.klass) === sk || ckey(nkey(c.label)) === sk || ckey(nkey(c.klass)) === sk || ckey(c.castAs) === sk));
  }
  function freeLookOf(P){
    if(!P || P.free || !P.fn) return null;
    const fn = String(P.fn || '').toLowerCase();
    let key = null, val = null;
    if(/^set/.test(fn) && VERBS[fn.slice(3)]){ key = fn.slice(3); val = P.args && P.args[0]; }
    else if(VERBS[fn]){ key = fn; val = (P.args && P.args[0] != null) ? P.args[0] : true; }
    else if(FNS[fn]){ key = FNS[fn][0]; val = (P.args && P.args[0] != null && fn === 'glow') ? P.args[0] : FNS[fn][1]; }
    if(!key || !VERBS[key]) return null;
    const look = VERBS[key](val);
    return look ? {key, val, look} : null;
  }
  function ensureCmdBub(rec){
    let el = rec.el;
    if(el && !el.isConnected) el = rec.el = null;
    if(!el){
      el = document.createElement('div'); el.className = 'gcmdbub'; el.dataset.agendaCmd = rec.id; el.dataset.run = rec.run || '';
      const esc = s => String(s || '').replace(/[<>&]/g, ch => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[ch]));
      const ranShow = (rec.resolved && rec.resolved !== rec.raw) ? rec.resolved : (rec.ranAs || rec.impl || '');
      el.innerHTML = '<div class="gct">' + esc(rec.raw || rec.text || '') + '</div>'
        + (ranShow ? '<div class="gcas">ran as: ' + esc(ranShow) + '</div>' : '')
        + (rec.result ? '<div class="gres">→ ' + esc(rec.result) + '</div>' : '')
        + '<div class="gcr">' + esc(rec.run || '') + '</div>';
      cutsL.appendChild(el); rec.el = el;
    }
    return el;
  }
  function placeCmdBub(rec){
    const el = ensureCmdBub(rec); if(!el) return;
    const cuts = rec.sk ? matchFreeCuts(rec.sk, rec.run) : [];
    const c = cuts[0];
    if(c){
      el.style.left = (c.left + c.w / 2) + 'px';
      el.style.top = (c.top - 10) + 'px';
      el.style.transform = 'translate(-50%,-100%)';
    } else {
      const g = S.groups.find(x => !x.gone && !x.map && x.run === rec.run) || S.groups.find(x => !x.gone && !x.map);
      const v = view();
      el.style.left = ((g ? g.x + g.w / 2 : v.x + v.w * 0.5)) + 'px';
      el.style.top = ((g ? g.y + 16 : v.y + 72)) + 'px';
      el.style.transform = 'translate(-50%,0)';
    }
  }
  function clearFreeLooks(){
    S.cuts.forEach(c => { if(c.freeLook){ c.el.style.filter = ''; if(!c.entering && !c.leaving) c.el.style.opacity = ''; c.el.style.scale = ''; c.freeLook = null; c.el.classList.remove('gcmdlit'); } });
  }
  function syncFreeCmds(){
    const run = currentRun();
    clearFreeLooks();
    FREE.list.forEach(rec => {
      const on = !!(rec.run && rec.run === run);
      if(rec.el){ rec.el.style.display = on ? '' : 'none'; rec.el.setAttribute('aria-hidden', on ? 'false' : 'true'); }
      if(!on) return;
      if(rec.sk && rec.look){
        matchFreeCuts(rec.sk, rec.run).forEach(c => {
          if(c.tapL) return;
          const p = rec.look;
          if(p.filter) c.el.style.filter = p.filter;
          if(p.scale) c.el.style.scale = String(p.scale);
          if(p.opacity != null && !c.entering && !c.leaving) c.el.style.opacity = String(p.opacity);
          c.freeLook = rec;
          c.el.classList.add('gcmdlit');
        });
      }
      placeCmdBub(rec);
    });
  }
  function cleanCliPiece(s){
    s = String(s == null ? '' : s).trim();
    if(!s) return '';
    s = s.replace(/^[;\s]+/, '').replace(/[;\s]+$/, '');
    const safe = s.match(/^\[\[\s*([A-Za-z_][\w]*)\s*\]\]/);
    if(safe) return '[[' + safe[1] + ']]';
    let bal = 0, last = -1;
    for(let i = 0; i < s.length; i++){
      if(s[i] === '(') bal++;
      else if(s[i] === ')'){ bal--; if(bal === 0) last = i; }
    }
    if(bal < 0 && last >= 0) s = s.slice(0, last + 1);
    else { while(bal < 0 && s.endsWith(')')){ s = s.slice(0, -1); bal++; } }
    return s.trim();
  }
  function splitCli(text){
    return String(text == null ? '' : text).split(';').map(cleanCliPiece).filter(Boolean);
  }
  function fleshCli(text){
    const raw = cleanCliPiece(text);
    let resolved = raw, fleshed = false;
    const m = raw.match(/^([\s\S]+?)\.contains\s*\(([\s\S]+)\)\s*$/);
    if(m){
      const head = m[1].trim(), arg = m[2].trim();
      const argIsList = /[.\[]/.test(arg) || /(?:qualities|likes|list|items|all|ones|set)$/i.test((arg.split('.').pop() || '')) || /s$/i.test((arg.split('.').pop() || ''));
      resolved = argIsList ? (head + '.filter(q => ' + arg + '.includes(q))') : (head + '.includes(' + arg + ')');
      fleshed = resolved !== raw;
    }
    return {raw, resolved, fleshed};
  }
  // Everyday flesh-out (Jesuye 18 Nov 2026 10:34 / 10:36 AM ET): every CLI command, known
  // ones included, gets a common-sense implementation. The function body may grow a line,
  // related constants may update, and everyday follow-ons may run (setname also updates
  // captions and mentions; a getter records the fact it learned). Nothing magical. Each
  // change is stored per agenda: body version, constants diff, and the 'ran as:' display.
  const IMPL_KEY = 'thryd_cli_impls_v2';
  const IMPL = S.cliImpls = {map: {}, props: {}, constants: {}, bodies: {}, changes: [], captions: {}};
  function loadImplStore(){
    try{
      const d = JSON.parse(localStorage.getItem(IMPL_KEY) || localStorage.getItem('thryd_cli_impls_v1') || '{}');
      IMPL.map = d.map || {}; IMPL.props = d.props || {}; IMPL.constants = d.constants || {};
      IMPL.bodies = d.bodies || {}; IMPL.changes = d.changes || []; IMPL.captions = d.captions || {};
    }catch(e){ IMPL.map = {}; IMPL.props = {}; IMPL.constants = {}; IMPL.bodies = {}; IMPL.changes = []; IMPL.captions = {}; }
  }
  function saveImplStore(){
    try{
      if(IMPL.changes && IMPL.changes.length > 80) IMPL.changes = IMPL.changes.slice(-80);
      localStorage.setItem(IMPL_KEY, JSON.stringify({map: IMPL.map, props: IMPL.props, constants: IMPL.constants, bodies: IMPL.bodies, changes: IMPL.changes, captions: IMPL.captions}));
    }catch(e){}
  }
  loadImplStore();
  function implKey(run, cmd){ return String(run || '') + '::' + String(cmd || '').trim().replace(/;+\s*$/, ''); }
  function prettyWho(obj){
    const s = String(obj || '').replace(/_+/g, ' ').trim();
    if(/^mama/i.test(s) && s.length > 4) return 'Mama ' + s.charAt(4).toUpperCase() + s.slice(5);
    return s.replace(/\b\w/g, ch => ch.toUpperCase());
  }
  function constName(obj, prop){ return (prettyWho(obj) + '_' + String(prop || 'VALUE')).replace(/\s+/g, '_').toUpperCase().replace(/[^A-Z0-9_]/g, '_') || 'VALUE'; }
  function stableInt(s, n){ let h = 2166136261; const t = String(s || ''); for(let i = 0; i < t.length; i++){ h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % (n || 1); }
  function stableDate(key){
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return months[stableInt(key + 'm', 12)] + ' ' + (1994 + stableInt(key, 12));
  }
  function getProps(run, obj){
    const r = IMPL.props[run] || (IMPL.props[run] = {});
    const k = String(obj || '').toLowerCase();
    return r[k] || (r[k] = {});
  }
  function setProp(run, obj, prop, val){
    getProps(run, obj)[String(prop || '').toLowerCase()] = val;
    saveImplStore();
  }
  function getProp(run, obj, prop){
    const v = getProps(run, obj)[String(prop || '').toLowerCase()];
    return v == null ? undefined : v;
  }
  function constantsOf(run){ return IMPL.constants[run] || (IMPL.constants[run] = {}); }
  function setConstant(run, name, val, diff){
    const box = constantsOf(run), prev = box[name], same = JSON.stringify(prev) === JSON.stringify(val);
    box[name] = val;
    if(!same) diff.push({name: name, from: (prev == null ? null : prev), to: val});
    return !same;
  }
  function bodyBox(run, fid){
    const r = IMPL.bodies[run] || (IMPL.bodies[run] = {});
    return r[fid] || (r[fid] = {v: 0, body: '', history: []});
  }
  function appendLine(body, line){
    const needle = String(line || '').trim();
    if(!needle) return body;
    if(String(body || '').indexOf(needle) >= 0) return body;
    // keep new lines executable: insert before the last return, else before the closing brace
    if(/\n\s*return[\s\S]*}\s*$/.test(body)) return String(body).replace(/(\n\s*return[\s\S]*}\s*)$/, '\n  ' + needle + '$1');
    if(/}\s*$/.test(body)) return String(body).replace(/}\s*$/, '  ' + needle + '\n}');
    return (body ? (body + '\n') : '') + needle;
  }
  function growBody(run, fid, nextBody){
    const box = bodyBox(run, fid);
    if(box.body === nextBody) return box;
    box.v += 1;
    box.body = nextBody;
    box.history.push({v: box.v, body: nextBody, at: new Date().toISOString()});
    if(box.history.length > 12) box.history.shift();
    return box;
  }
  function displayNameFor(c){
    try{
      const run = (c && c.home && c.home.run) || currentRun();
      const keys = [];
      [c && c.castAs, tagName(c), c && c.label, c && c.klass, S.objName && S.objName(c)].forEach(x => {
        if(!x) return;
        keys.push(String(x).toLowerCase());
        keys.push(String(x).toLowerCase().replace(/[^a-z0-9]+/g, ''));
      });
      for(const k of keys){
        const n = getProp(run, k, 'name');
        if(n) return String(n);
      }
    }catch(e){}
    return null;
  }
  function defaultList(run, obj, prop){
    const stored = getProp(run, obj, prop);
    if(Array.isArray(stored)) return stored.slice();
    if(typeof stored === 'string' && stored) return stored.split(/,\s*/);
    const o = String(obj || '').toLowerCase(), p = String(prop || '').toLowerCase();
    if(/ronke/.test(o) && /like/.test(p)) return ['the cooler', 'punctual', 'generous', 'funny'];
    if(/kazeem/.test(o) || /qualit/.test(o + ' ' + p)) return ['punctual', 'generous', 'funny'];
    return ['punctual', 'generous', 'funny'];
  }
  function listForExpr(run, expr){
    expr = String(expr || '').trim().replace(/;+\s*$/, '');
    const call = expr.match(/^([A-Za-z_][\w]*)\s*\.\s*([A-Za-z_][\w]*)\s*\(\s*\)$/);
    if(call) return defaultList(run, call[1], call[2]);
    const prop = expr.match(/^([A-Za-z_][\w]*)\s*\.\s*([A-Za-z_][\w]*)$/);
    if(prop) return defaultList(run, prop[1], prop[2]);
    return defaultList(run, expr, 'items');
  }
  function nameVariants(obj, display){
    const out = [], seen = {};
    [display, prettyWho(obj), obj, String(obj || '').replace(/_/g, ' '), 'Mama Ronke'].forEach(s => {
      s = String(s || '').trim();
      if(!s || seen[s.toLowerCase()]) return;
      seen[s.toLowerCase()] = 1; out.push(s);
    });
    return out.sort((a, b) => b.length - a.length);
  }
  function replaceAny(text, froms, to){
    let s = String(text || '');
    froms.forEach(f => {
      if(!f) return;
      const re = new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      s = s.replace(re, to);
    });
    return s;
  }
  function rewriteCaptionsAndMentions(run, obj, froms, to){
    let n = 0;
    const caps = IMPL.captions[run] || (IMPL.captions[run] = {});
    (S.groups || []).forEach(g => {
      if(g.run && g.run !== run) return;
      const raw = caps[g.mid] || g._caption || g.title || '';
      const next = replaceAny(raw, froms, to);
      if(next !== raw){ caps[g.mid] = next; g._caption = next; n++; if(g.tag) g.tag.textContent = String(next).slice(0, 60); }
    });
    (S.cuts || []).forEach(c => {
      if(!c || (c.home && c.home.run && c.home.run !== run)) return;
      ['label', 'klass', 'castAs'].forEach(k => { /* names stay as ids; displayNameFor paints the new caption */ });
    });
    try{
      document.querySelectorAll('#gstage .gtag, #gnames .gn, .gcmdbub .gct, .gcmdbub .gres, .gcmdbub .gcas').forEach(el => {
        const raw = el.textContent || '';
        const next = replaceAny(raw, froms, to);
        if(next !== raw){ el.textContent = next; n++; }
      });
    }catch(e){}
    setConstant(run, constName(obj, 'caption'), to, []);
    setConstant(run, constName(obj, 'mentions'), to, []);
    saveImplStore();
    return n;
  }
  function seatedHint(obj, fn){
    try{
      const id = (String(obj || '') + '.' + String(fn || '')).toLowerCase();
      const f = (S.objectMethods && S.objectMethods.functions && S.objectMethods.functions[id]) || (typeof OM !== 'undefined' && OM.functions && OM.functions[id]);
      const t = f && (f.titles || [])[0];
      return (t && (t.consequence || t.title)) || (f && f.note) || '';
    }catch(e){ return ''; }
  }
  function everydayImpl(run, piece){
    const cmd = (piece && (piece.resolved || piece.raw) || '').trim().replace(/;+\s*$/, '');
    if(!cmd || !run) return null;
    const obj = piece && piece.obj, fn = String((piece && piece.fn) || ''), args = (piece && piece.args) || [];
    const who = prettyWho(obj || 'they');
    const fid = (piece && piece.safe) ? ('[[' + (obj || 'safe') + ']]') : ((obj && fn) ? (String(obj) + '.' + fn).toLowerCase() : ('cli.' + cmd.toLowerCase().slice(0, 40)));
    const key = implKey(run, cmd);
    const prev = IMPL.map[key];
    const diff = [];
    let kind = 'call', result = prev && prev.result != null ? prev.result : '', value = prev ? prev.value : null;
    const filter = cmd.match(/^([\s\S]+?)\.filter\(\s*[a-zA-Z_]\w*\s*=>\s*([\s\S]+?)\.includes\(\s*[a-zA-Z_]\w*\s*\)\s*\)\s*$/);
    const hint = seatedHint(obj, fn);
    let base = '', extras = [];

    if(piece && piece.safe){
      kind = 'safe'; result = result || ('the ' + (obj || 'safe') + ' safe');
      base = 'function safe(){\n  return ' + JSON.stringify(result) + ';\n}';
    } else if(filter){
      kind = 'get';
      if(value == null){
        const left = listForExpr(run, filter[1]), right = listForExpr(run, filter[2]);
        value = left.filter(x => right.indexOf(x) >= 0);
      }
      result = Array.isArray(value) ? (value.length ? value.join(', ') : '(none)') : String(value);
      base = 'function filterQualities(){\n  const value = ' + JSON.stringify(value) + ';\n  return value;\n}';
      extras = ['learned.' + (obj || 'it') + '.overlap = value;'];
      setConstant(run, constName(obj, 'overlap'), value, diff);
      setConstant(run, 'LEARNED_' + constName(obj, 'overlap'), value, diff);
    } else if(/^set/i.test(fn)){
      kind = 'set';
      const prop = fn.replace(/^set/i, '').toLowerCase() || 'value';
      const val = args[0] != null ? String(args[0]).replace(/^['"]|['"]$/g, '') : '';
      const old = getProp(run, obj, prop) || prettyWho(obj);
      setProp(run, obj, prop, val);
      if(/name/i.test(prop) && obj){
        String(obj).toLowerCase().split(/[\s_]+/).forEach(k => { if(k) setProp(run, k, 'name', val); });
        setProp(run, String(obj).toLowerCase().replace(/[^a-z0-9]+/g, ''), 'name', val);
        rewriteCaptionsAndMentions(run, obj, nameVariants(obj, old), val);
      }
      setConstant(run, constName(obj, prop), val, diff);
      result = who + "'s " + prop + ' is now ' + val;
      value = val;
      base = 'function ' + fn + '(' + prop + '){\n  this.' + prop + ' = ' + JSON.stringify(val) + ';\n  return this.' + prop + ';\n}';
      extras = ['this.caption = ' + prop + ';', 'mentions.replace(this.' + prop + ', ' + prop + ');'];
    } else if(/^(get|is|has)/i.test(fn) || /^count$/i.test(fn)){
      kind = 'get';
      const prop = fn.replace(/^(get|is|has)/i, '').toLowerCase() || fn.toLowerCase();
      if(value == null){
        const preset = getProp(run, obj, prop);
        if(preset != null) value = preset;
        else if(/date|manufactured|born|year/i.test(fn + prop))
          value = (/cooler/i.test(obj || '') && /manufactured|date/i.test(fn + prop)) ? 'June 1998' : stableDate(key);
        else if(/like|qualit|items|list/i.test(fn + prop)){ value = defaultList(run, obj, prop); setProp(run, obj, prop, value); }
        else if(/name/i.test(prop) || /name/i.test(fn)) value = getProp(run, obj, 'name') || who;
        else if(/count|many|number|naira|price/i.test(fn + prop) || /^count$/i.test(fn)) value = 2 + stableInt(key, 11);
        else if(/^(is|has)/i.test(fn)) value = true;
        else { value = getProp(run, obj, prop); if(value == null) value = prop || 'ok'; }
      }
      result = Array.isArray(value) ? value.join(', ') : (value === true ? 'yes' : String(value));
      base = 'function ' + fn + '(){\n  const value = ' + JSON.stringify(value) + ';\n  return value;\n}';
      extras = ['learned.' + (obj || 'it') + '.' + prop + ' = value;', 'this.lastRead = value;'];
      setConstant(run, constName(obj, prop), value, diff);
      setConstant(run, 'LEARNED_' + constName(obj, prop), value, diff);
    } else if(fn && fn !== 'cli' && fn !== 'safe'){
      kind = 'verb';
      const what = args[0] != null ? String(args[0]).replace(/^['"]|['"]$/g, '') : '';
      const v = fn.toLowerCase();
      const phrases = {
        lift: who + ' lifts ' + (what || 'it'),
        hail: who + ' hails ' + (what || 'the hawker'),
        count: who + ' counts ' + (what || 'the change') + ': ' + (2 + stableInt(key, 8)) + ' coins',
        keep: who + ' keeps ' + (what || 'it'),
        claim: who + ' claims ' + (what || 'it'),
        open: who + ' opens ' + (what || 'it'),
        close: who + ' closes ' + (what || 'it'),
        say: who + ' says ' + (what || 'it'),
        ask: who + ' asks ' + (what || 'a question'),
        carry: who + ' carries ' + (what || 'it'),
        fold: who + ' folds ' + (what || 'it'),
        weigh: who + ' weighs ' + (what || 'it'),
        score: who + ' scores ' + (what || 'a point'),
        mend: who + ' mends ' + (what || 'it'),
        bring: who + ' brings ' + (what || 'it'),
        know: who + ' already knows',
        use: who + ' uses ' + (what || 'it'),
        sort: who + ' sorts ' + (what || 'them'),
        wave: who + ' waves'
      };
      if(!result) result = phrases[v] || (who + ' ' + v + (what ? ' ' + what : ''));
      value = result;
      const countName = constName(obj, fn + '_count');
      const prevCount = Number(constantsOf(run)[countName] || 0) || 0;
      setConstant(run, countName, prevCount + 1, diff);
      setConstant(run, constName(obj, 'last_' + fn), (what || result), diff);
      base = 'function ' + fn + '(' + (what ? 'what' : '') + '){\n' + (hint ? '  // ' + String(hint).slice(0, 120).replace(/\n/g, ' ') + '\n' : '') + '  ' + countName + ' += 1;\n  return ' + JSON.stringify(result) + ';\n}';
      extras = ['this.last' + fn.charAt(0).toUpperCase() + fn.slice(1) + ' = ' + JSON.stringify(what || result) + ';', 'this.times' + fn.charAt(0).toUpperCase() + fn.slice(1) + ' = ' + countName + ';'];
    } else {
      base = '/* ' + cmd + ' */';
      result = result || cmd;
    }

    const prior = bodyBox(run, fid);
    let body = prior.body || base;
    // first call starts from the base body; each later call adds at most one new common-sense line
    if(!prior.body){
      body = base;
      if(extras[0]) body = appendLine(body, extras[0]);
    } else {
      for(let i = 0; i < extras.length; i++){
        const grown = appendLine(body, extras[i]);
        if(grown !== body){ body = grown; break; }
      }
    }
    const box = growBody(run, fid, body);
    const ranAs = box.body;
    const rec = {body: box.body, result: result, kind: kind, value: value, cmd: cmd, fid: fid, version: box.v, constantsDiff: diff, ranAs: ranAs, at: new Date().toISOString()};
    IMPL.map[key] = rec;
    IMPL.changes.push({run: run, fid: fid, v: box.v, cmd: cmd, diff: diff, ranAs: ranAs, result: result, at: rec.at});
    try{
      const f = (typeof OM !== 'undefined' && OM.functions) ? (OM.functions[fid] || null) : null;
      if(f){ f.body = box.body; f.body_v = box.v; f.cliImpl = true; }
    }catch(e){}
    saveImplStore();
    return rec;
  }

  const SAFEIX = S.safeIndex = {by: new Map(), ready: false};
  function indexSafeText(text, meta){
    String(text || '').replace(/\[\[\s*([A-Za-z_][\w]*)\s*\]\]/g, (_, t) => {
      const k = t.toLowerCase();
      if(!SAFEIX.by.has(k)) SAFEIX.by.set(k, Object.assign({token: '[[' + t + ']]', object: t, found: true}, meta || {}));
    });
  }
  function resolveSafeToken(s){
    const m = String(s || '').trim().match(/^\[\[\s*([A-Za-z_][\w]*)\s*\]\]$/);
    if(!m) return {token: String(s || ''), found: false};
    const tok = '[[' + m[1] + ']]', hit = SAFEIX.by.get(m[1].toLowerCase());
    return hit ? Object.assign({token: tok}, hit) : {token: tok, object: m[1], found: false};
  }
  function loadSafeIndex(){
    const grab = (u) => fetch(u + (u.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now(), {cache: 'no-store'}).then(r => r.ok ? r.json() : null).catch(()=> null);
    Promise.all([grab('data/tweets_all.json'), grab('data/medium_library.json'), grab('data/live_extra.json')]).then(([tw, lib, extra]) => {
      (Array.isArray(tw) ? tw : []).forEach(p => indexSafeText(p && (p.line || p.text || p.body), {src: 'tweet', id: p && p.id}));
      const sets = (lib && (lib.sets || lib.items || lib.posts)) || (Array.isArray(lib) ? lib : []);
      (Array.isArray(sets) ? sets : []).forEach(st => {
        indexSafeText(JSON.stringify(st), {src: 'medium', id: st && (st.medium_image_id || st.id), title: st && (st.title || st.name)});
      });
      if(extra) indexSafeText(typeof extra === 'string' ? extra : JSON.stringify(extra), {src: 'live_extra'});
      SAFEIX.ready = true;
    });
  }
  loadSafeIndex();
  function exprSubjects(text){
    const names = [], re = /(?:^|[^A-Za-z0-9_])([A-Za-z_][\w]*)\s*\./g; let m;
    while((m = re.exec(String(text || '')))) names.push(m[1]);
    return names.filter((n, i) => names.findIndex(x => x.toLowerCase() === n.toLowerCase()) === i);
  }
  function currentJob(){
    const c = String(root.__thrydCard || (LV && LV.job) || (AG && AG.job) || '').toLowerCase();
    return /^[jw]\d{1,3}$/.test(c) ? 'j' + c.slice(1) : null;
  }
  function parseCliPiece(text){
    const raw = cleanCliPiece(text);
    const safe = raw.match(/^\[\[([A-Za-z_][\w]*)\]\]$/);
    if(safe) return {raw, resolved: raw, fleshed: false, safe: true, obj: safe[1], fn: 'safe', args: [], free: false, subjects: [safe[1]]};
    const fl = fleshCli(raw);
    const P = parseFree(fl.resolved);
    const subjects = exprSubjects(fl.resolved + ' ' + fl.raw);
    return {raw: fl.raw, resolved: fl.resolved, fleshed: !!fl.fleshed, safe: false, obj: P.obj || null, fn: P.fn || null, args: P.args || [], free: !!P.free, subjects};
  }
  function registerCliMethod(run, piece){
    if(!piece || piece.safe || !piece.obj || !piece.fn || piece.fn === 'safe') return null;
    const id = (piece.obj + '.' + piece.fn).toLowerCase();
    const title = piece.resolved || piece.raw;
    const job = currentJob();
    const f = OM.functions[id] || (OM.functions[id] = {object: piece.obj, method: piece.fn, args: piece.args || [], runs: [], defined: {run, job, title, at: new Date().toISOString()}, titles: [], source: 'cli', cli: true, calls: 0});
    f.cli = true; f.source = f.source || 'cli';
    if(!f.runs.includes(run)) f.runs.push(run);
    if(!f.titles.some(t => t.title === title)) f.titles.unshift({title, emoji: '', arg: (piece.args || []).join(', '), run, job, tweets: [], consequence: 'The customer typed this on ' + run + (job ? ' ' + job : '') + '.'});
    const ok = omKey(piece.obj);
    if(ok){ if(!OM.objects[ok]) OM.objects[ok] = []; if(!OM.objects[ok].includes(id)) OM.objects[ok].push(id); }
    const R = OM.runs[run] || (OM.runs[run] = {funcs: []});
    if(!R.funcs) R.funcs = [];
    if(!R.funcs.includes(id)) R.funcs.push(id);
    return {id, f, title};
  }
  function playCliOnCast(rec, piece){
    const run = rec.run, names = piece.subjects || [];
    const cuts = [];
    names.forEach(n => matchFreeCuts(ckey(n), run).forEach(c => { if(!cuts.includes(c)) cuts.push(c); }));
    cuts.forEach((c, n) => setTimeout(()=>{ if(!c.el || !c.el.isConnected) return; pulse(c); playGfx(c, gfxOf(piece.fn || 'know')); c.el.classList.add('gcmdlit'); if(n === 0) tagAt(c, (piece.resolved || piece.raw).slice(0, 80)); }, n * 180));
    if(root.ThrydCutAnimate && ThrydCutAnimate.verbOf(piece.fn)){
      const tgtName = (piece.args && piece.args[0]) || null;
      const tgt = tgtName ? (matchFreeCuts(ckey(tgtName), run)[0] || null) : null;
      cuts.forEach(c => { c.motion = ThrydCutAnimate.makeScript(piece.fn, 0, tgt); });
    }
    if(cuts[0]) try{ rec.ripples = ripple(cuts[0], piece.fn || 'know', piece.resolved || piece.raw); }catch(e){}
    rec.executed = true; rec.castCuts = cuts.length;
    return cuts;
  }
  function sendCliCall(rec, piece){
    const run = rec.run, eid = (function(){ try{ if(root.crypto && crypto.randomUUID) return 'cli-' + crypto.randomUUID(); }catch(e){} return 'cli-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12); })();
    const obj = String(piece.obj || 'cli').toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 60) || 'cli';
    const fn = piece.fn || 'cli';
    const code = (piece.resolved || piece.raw || '').replace(/;?$/, ';');
    const Hrun = run && /^run-[0-9a-f]{4,6}$/.test(run) ? run : null;
    const job = currentJob();
    const body = {v: 1, type: 'call', event_id: eid, rid: eid + '-r', source: 'cli', run: Hrun, card: job, job, object: obj, fn, args: piece.args || [], raw: piece.raw, resolved: piece.resolved || piece.raw, title: piece.resolved || piece.raw, impl: piece.impl || '', result: piece.result || '', body_v: piece.version || 0, const_diff: piece.constantsDiff || [], ran_as: piece.ranAs || piece.impl || '', client_ts: new Date().toISOString()};
    rec.body = body; rec.code = code; rec.event_id = eid;
    const Mbox = S.methods || (S.methods = {sent: []});
    Mbox.sent.push(rec); if(Mbox.sent.length > 40) Mbox.sent.shift();
    try{ const p = sendCall(rec, code, eid); if(p && typeof p.then === 'function') p.catch(e=>{ rec.status = 'failed'; rec.error = String(e && e.message || e); }); return p; }catch(e){ rec.status = 'failed'; rec.error = String(e && e.message || e); return rec; }
  }
  function applyFreeCmd(text, opts){
    opts = opts || {};
    const piece = (opts.piece && typeof opts.piece === 'object' && opts.piece.raw != null) ? opts.piece : parseCliPiece(opts.piece || text);
    const raw = piece.raw; if(!raw) return null;
    const run = opts.run || currentRun();
    if(!run){ note('free-cmd skip', 'no current agenda'); return null; }
    const P = piece.safe ? {free: false, obj: piece.obj, fn: 'safe', args: []} : parseFree(piece.resolved);
    const sk = (piece.safe || P.free) ? (piece.safe ? ckey(piece.obj) : null) : ckey(P.obj);
    const inAg = sk && agendaNames(run).some(n => ckey(n) === sk || ckey(nkey(n)) === sk);
    const cuts0 = sk ? matchFreeCuts(sk, run) : [];
    const named = !!(sk && (inAg || cuts0.length || piece.safe));
    const look = (!piece.safe && named) ? freeLookOf(P) : null;
    const evd = (!piece.safe && everydayImpl(run, piece)) || null;
    if(evd){ piece.impl = evd.body; piece.result = evd.result; piece.kind = evd.kind; piece.value = evd.value; piece.version = evd.version; piece.constantsDiff = evd.constantsDiff; piece.ranAs = evd.ranAs; }
    const rec = rememberFree({
      id: opts.id || ('fc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)),
      run, raw, text: raw, resolved: piece.resolved, fleshed: !!(piece.fleshed || evd), subjects: piece.subjects || [],
      subject: named ? (P.obj || piece.obj) : null, fn: P.fn || piece.fn || null, args: P.args || piece.args || [],
      sk: named ? sk : null, look: look && look.look, at: new Date().toISOString(), t: Date.now(), local: opts.local !== false,
      safe: !!piece.safe, cli: true, impl: evd && evd.body, result: evd && evd.result, value: evd && evd.value, kind: evd && evd.kind,
      version: evd && evd.version, constantsDiff: evd && evd.constantsDiff, ranAs: evd && evd.ranAs
    });
    const reg = registerCliMethod(run, piece);
    rec.methodId = reg && reg.id;
    const cuts = playCliOnCast(rec, piece);
    syncFreeCmds();
    if(rec.el){ rec.el.remove(); rec.el = null; placeCmdBub(rec); }
    const ranAs = (piece.fleshed && piece.resolved && piece.resolved !== piece.raw) ? piece.resolved : (piece.ranAs || piece.impl || '');
    const noteLine = (ranAs ? 'ran as: ' + ranAs + ' · ' : '')
      + (piece.result ? '→ ' + piece.result + ' · ' : '')
      + 'new command → this agenda · ' + run + (cuts.length ? ' · ' + cuts.length + ' on stage' : ' · caption');
    rec.sendPrefix = noteLine;
    rec.status = rec.status || 'sending';
    const codeTxt = (piece.resolved || raw).replace(/;?$/, ';');
    codeLine(codeTxt, noteLine + ' \u00b7 sending\u2026');
    try{ setSendNote(codeTxt, rec, noteLine); }catch(e){}
    note('free-cmd', rec.id, rec.run, raw, piece.resolved);
    saveFreeLocal();
    if(opts.send !== false) sendCliCall(rec, piece);
    return rec;
  }
  function ensureCliSent(rec, piece){
    if(!rec) return null;
    if(rec.body && rec.event_id) return rec; // already handed to sendCall
    const p = piece || {raw: rec.raw || rec.text, resolved: rec.resolved || rec.raw || rec.text, obj: rec.subject || rec.obj, fn: rec.fn || 'cli', args: rec.args || []};
    try{ return sendCliCall(rec, p); }catch(e){ try{ rec.error = String(e && e.message || e); setSendNote(rec.code || rec.raw, rec); }catch(e2){} return rec; }
  }
  function enqueueRawCli(raw, err, opts){
    opts = opts || {};
    const msg = String((err && (err.message || err.reason)) || err || 'parse_error');
    const text = String(raw == null ? '' : raw);
    const run = opts.run || currentRun();
    const eid = (function(){ try{ if(root.crypto && crypto.randomUUID) return 'cli-' + crypto.randomUUID(); }catch(e){} return 'cli-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12); })();
    const job = currentJob();
    const Hrun = run && /^run-[0-9a-f]{4,6}$/.test(run) ? run : null;
    const code = text.replace(/;?\s*$/, ';');
    const rec = rememberFree({
      id: opts.id || ('fc-err-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)),
      run, raw: text, text, resolved: text, fleshed: false, subjects: [], subject: null, fn: 'cli', args: [],
      sk: null, look: null, at: new Date().toISOString(), t: Date.now(), local: opts.local !== false,
      safe: false, cli: true, parseError: msg, parse_error: msg
    });
    rec.body = {v: 1, type: 'call', event_id: eid, rid: eid + '-r', source: 'cli', run: Hrun, card: job, job,
      object: 'cli', fn: 'cli', args: [], raw: text, resolved: text, title: text, parse_error: msg,
      client_ts: new Date().toISOString()};
    rec.code = code; rec.event_id = eid; rec.error = msg; rec.status = 'sending';
    try{
      const ctx = root.thrydCtx ? root.thrydCtx() : {};
      const toast = ctx.toast || (()=>{});
      toast(code + ' · parse error · ' + msg + ' · still sending raw');
      codeLine(code, 'parse error · ' + msg + ' · still sending raw');
      note('free-cmd parse_error', rec.id, run, text, msg);
    }catch(e){}
    if(opts.send !== false){
      try{ const p = sendCall(rec, code, eid); if(p && typeof p.then === 'function') p.catch(()=>{}); }catch(e){}
    }
    return rec;
  }
  function applyCliLine(text, opts){
    opts = opts || {};
    let parts;
    try{ parts = splitCli(text); }catch(e){ return [enqueueRawCli(text, e, opts)].filter(Boolean); }
    if((!parts || !parts.length) && String(text || '').trim()) return [enqueueRawCli(text, 'empty after parse', opts)].filter(Boolean);
    const recs = (parts || []).map(p => {
      try{
        let piece;
        try{ piece = parseCliPiece(p); }catch(e){ return enqueueRawCli(p, e, opts); }
        try{ return applyFreeCmd(p, Object.assign({}, opts, {piece: piece})); }
        catch(e){ return enqueueRawCli(p, e, opts); }
      }catch(e){ return enqueueRawCli(p, e, opts); }
    });
    return recs.filter(Boolean);
  }
  async function pollFreeCmds(){
    loadFreeLocal().forEach(e => { if(e && e.id){ e.local = true; rememberFree(e); } });
    let d = null;
    for(const u of FREE_URLS){ try{ const r = await fetch(u + '?t=' + Date.now(), {cache: 'no-store'}); if(r.ok){ d = await r.json(); FREE.src = u.startsWith('http') ? 'raw' : 'pages'; break; } }catch(e){} }
    if(d && Array.isArray(d.calls)){
      d.calls.forEach(e => {
        if(!e || !e.id || !e.run) return;
        rememberFree({id: e.id, run: e.run, raw: e.raw || e.text, text: e.text || e.raw, subject: e.subject, fn: e.fn, args: e.args || [],
          sk: e.subject ? ckey(e.subject) : (parseFree(e.raw || e.text || '').free ? null : ckey(parseFree(e.raw || e.text || '').obj)),
          look: freeLookOf(parseFree(e.raw || e.text || '')) && freeLookOf(parseFree(e.raw || e.text || '')).look,
          at: e.at, t: e.t || 0, local: false});
      });
      FREE.at = d.updated || Date.now();
    }
    syncFreeCmds();
  }
  // ---------- thunder (v615, Jesuye 25 Nov 2026 "make the thunder api"): a typed <who>.thunder() / jN.thunder() / why.thunder(una) is a code verb on the box
  // (thunder.py). When the box's REPLY says a strike landed (reply text starts with the lightning emoji; refusals are plain words and play nothing) this page
  // flashes the stage white and rumbles it, once, under 1 s, CSS only (alive.css #gthunder / .gth-rumble). It costs nothing until the first strike: the flash
  // layer is created then and removed afterwards. Cool mode (LH.cool), reduced motion and a hidden tab get no animation (cool / reduced: one static dim frame,
  // 0.35 s; hidden: nothing). A struck character or object's cut also shakes once (gth-hit: the existing gfxshake keyframes at 0.8 s). One play per event id.
  const THDONE = new Set();
  function thunderFx(rec, m){
    rec = rec || {}; m = m || {};
    const res = String(m.result == null ? '' : m.result), raw = String(rec.resolved || rec.raw || m.resolved || m.raw || '');
    if(!res || res.charCodeAt(0) !== 0x26A1 || !/thunder\s*\(/i.test(raw || res)) return false;     // only a landed strike
    const key = String(m.event_id || rec.event_id || rec.id || raw + res);
    if(THDONE.has(key)) return false; THDONE.add(key); if(THDONE.size > 60) THDONE.delete(THDONE.values().next().value);
    if(document.hidden || (root.LH && root.LH.state === 'hidden')) return false;                  // nobody is watching: nothing is played
    let calm = !!(root.LH && root.LH.cool);
    try{ if(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) calm = true; }catch(e){}
    let el = document.getElementById('gthunder');
    if(!el){ el = document.createElement('div'); el.id = 'gthunder'; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); }
    clearTimeout(el._t); el.className = ''; void el.offsetWidth; el.className = calm ? 'calm' : 'on';
    const gs = document.getElementById('gstage');
    if(!calm && gs){ gs.classList.remove('gth-rumble'); void gs.offsetWidth; gs.classList.add('gth-rumble'); setTimeout(() => { try{ gs.classList.remove('gth-rumble'); }catch(e){} }, 850); }
    el._t = setTimeout(() => { try{ el.className = ''; el.remove(); }catch(e){} }, calm ? 350 : 920);
    if(!calm){
      try{
        const P = parseFree(raw), names = (P && P.args && P.args.length ? P.args : [P && P.obj]).map(ckey).filter(Boolean), run = rec.run || currentRun();
        names.forEach(nm => matchFreeCuts(nm, run).forEach(c => { if(!c.el) return; c.el.classList.remove('gth-hit'); void c.el.offsetWidth; c.el.classList.add('gth-hit'); setTimeout(() => { try{ c.el.classList.remove('gth-hit'); }catch(e){} }, 850); }));
      }catch(e){}
    }
    try{ codeLine((rec.code || raw).replace(/;?$/, ';'), res); }catch(e){}
    return true;
  }
  root.thrydThunder = thunderFx;                                       // QA / #thryd: thrydThunder({raw:'tobi.thunder()'}, {result:'\u26a1 ...', event_id:'qa1'})
  S.markQueued = function(code, note){ try{ codeLine(String(code==null?'':code).replace(/;?$/, ';'), note||'queued\u2026'); }catch(e){} };
  S.applyFreeCmd = applyFreeCmd; S.applyCliLine = applyCliLine; S.enqueueRawCli = enqueueRawCli; S.sendCliCall = sendCliCall; S.ensureCliSent = ensureCliSent; S.splitCli = splitCli; S.cleanCliPiece = cleanCliPiece; S.fleshCli = fleshCli; S.parseCliPiece = parseCliPiece; S.everydayImpl = everydayImpl; S.displayNameFor = displayNameFor; S.resolveSafeToken = resolveSafeToken; S.syncFreeCmds = syncFreeCmds; S.currentRun = currentRun; S.parseFree = parseFree; S.registerCliMethod = registerCliMethod;
  pollFreeCmds(); setInterval(pollFreeCmds, 20000); setInterval(syncFreeCmds, 1000);

  // ---------- tap methods (Jesuye 16 Nov 2026 6:39 PM ET "add 2-3 object methods that are clickable. when we tap on an object, users can
  // click a method and it will fire in the db"). A tap (under 6 px and 300 ms, the same test as the name tag; a drag never opens it) shows
  // three buttons: glow() / glow('off'), grow() / shrink(), and setmood('happy'|'sad') for a figure or dim() / brighten() for a thing.
  // A click: the tapped cut reacts at once (its own look only, nothing else on stage changes), the line types into #code, and
  // {v:1,type:'call',...} goes over the drag relay (taps/intent: data/drag.json; typelines source=cli: data/cli.json -> relay.py -> server.py handle_call), where the box
  // rebuilds `<object>.<verb>(<arg>);` from a whitelist and writes it with #thryd's /workspace/thryd-db/world.py add (world.db).
  const MCSS = document.createElement('style');
  MCSS.textContent = ['#gmeth{position:fixed;z-index:10050;display:flex;gap:.5vh;flex-wrap:wrap;max-width:min(92vw,520px);padding:.6vh;border-radius:1vh;background:rgba(12,12,12,.9);box-shadow:0 2px 12px #0007;font:600 max(12px,1.5vh) ui-monospace,Menlo,Consolas,monospace;transform:translateX(-50%)}',
    '#gmeth .gmh{width:100%;color:#ffe7a8;font-weight:600;padding:0 .3vh .2vh;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#gmeth button{font:inherit;color:#fff;background:#2a2a2a;border:1px solid #555;border-radius:.8vh;padding:.7vh 1vh;cursor:pointer;min-height:36px;touch-action:manipulation}',
    '#gmeth button:hover,#gmeth button:focus-visible{background:#3c3c3c;border-color:#ffd76a;outline:none}',
    '#gmeth button.gfn{border-color:#8a6d2b;text-align:left}', '#gmeth button.genv{border-color:#3d6b8a;text-align:left}', '#gmeth button.gmcc{border-color:#6a8a3d;text-align:left}', '#gmeth button.gmhop{border-color:#8a6d9c;text-align:left}', '#gmeth .gmcl{width:100%;color:#9c9;font-weight:400;font-size:.8em;padding:0 .3vh .3vh}', '#gmeth{max-height:min(70vh,560px);overflow:auto}', '#gmeth .gms{width:100%;color:#bbb;font-weight:400;font-size:.85em;padding:0 .3vh}',
    '#gtweet{position:fixed;z-index:10040;max-width:min(80vw,460px);padding:1vh 1.2vh;border-radius:1vh;background:rgba(14,14,14,.94);color:#fff;box-shadow:0 3px 16px #0009;font:500 max(13px,1.6vh)/1.35 system-ui,sans-serif;transform:translateX(-50%);opacity:0;transition:opacity .5s;pointer-events:none}',
    '#gtweet.on{opacity:1;pointer-events:auto}', '#gtweet:focus-visible{outline:2px solid #ffd76a;outline-offset:2px}', '#gtweet .gtc{font:600 .82em ui-monospace,Menlo,Consolas,monospace;color:#ffd76a;margin-bottom:.4vh}',
    '#gtweet .gty{color:#9fd3ff;font-weight:700;white-space:nowrap}', '#gtweet .gtr{font:600 .8em ui-monospace,Menlo,Consolas,monospace;color:#b6f0a0;margin-bottom:.4vh}', '#gtweet .gtn{color:#bbb;font-size:.8em;margin-top:.5vh}',
    '@keyframes gfxfold{0%,100%{scale:1 1}35%{scale:1 .35}60%{scale:1 .5}}', '@keyframes gfxhide{0%,100%{opacity:1;translate:0 0}40%,70%{opacity:.12;translate:0 1.2vh}}',
    '@keyframes gfxtune{0%,100%{rotate:0deg}20%{rotate:-9deg}40%{rotate:8deg}60%{rotate:-6deg}80%{rotate:4deg}}',
    '@keyframes gfxknow{0%,100%{filter:none}30%{filter:brightness(1.6) drop-shadow(0 0 1.4vh #9fd3ff)}60%{filter:brightness(1.25) drop-shadow(0 0 .7vh #9fd3ff)}}',
    '@keyframes gfxweigh{0%,100%{translate:0 0;scale:1}40%{translate:0 2.4vh;scale:1.06 .9}70%{translate:0 1.6vh}}',
    '@keyframes gfxsay{0%,100%{translate:0 0}25%{translate:0 -2.6vh}50%{translate:0 0}70%{translate:0 -1.2vh}}',
    '@keyframes gfxshake{0%,100%{translate:0 0;filter:none}15%,45%,75%{translate:-1vh 0;filter:saturate(.3)}30%,60%,90%{translate:1vh 0;filter:saturate(.3)}}',
    '@keyframes gfxopen{0%,100%{scale:1}40%{scale:1.28}}',
    '#gstage .gcut.gfx-fold{animation:gfxfold 1.4s ease-in-out 1}', '#gstage .gcut.gfx-hide{animation:gfxhide 2.2s ease-in-out 1}',
    '#gstage .gcut.gfx-tune{animation:gfxtune 1.6s ease-in-out 1}', '#gstage .gcut.gfx-know{animation:gfxknow 1.8s ease-out 1}',
    '#gstage .gcut.gfx-weigh{animation:gfxweigh 1.8s ease-in-out 1}', '#gstage .gcut.gfx-say{animation:gfxsay 1.2s ease-out 1}',
    '#gstage .gcut.gfx-shake{animation:gfxshake 1.2s linear 1}', '#gstage .gcut.gfx-open{animation:gfxopen 1.3s ease-in-out 1}',
    // polymorphic effects (Phase A, 17 Nov 2026): a Person bows/ducks/nods/slumps, a Place dims/quakes, a Feeling shrinks
    '@keyframes gfxbow{0%,100%{rotate:0deg;translate:0 0}40%,60%{rotate:14deg;translate:0 1vh}}', '@keyframes gfxduck{0%,100%{scale:1 1;translate:0 0}35%,70%{scale:1.05 .7;translate:0 1.8vh}}',
    '@keyframes gfxnod{0%,100%{translate:0 0}20%,60%{translate:0 1.1vh}40%,80%{translate:0 -.3vh}}', '@keyframes gfxslump{0%,100%{scale:1;filter:none}50%{scale:.94 .86;filter:saturate(.5)}}',
    '@keyframes gfxquake{0%,100%{translate:0 0}10%,50%,90%{translate:-.6vh .3vh}30%,70%{translate:.6vh -.3vh}}', '@keyframes gfxdimfx{0%,100%{filter:none}40%,70%{filter:brightness(.35)}}',
    '@keyframes gfxshrinkfx{0%,100%{scale:1}45%{scale:.72}}',
    '#gstage .gcut.gfx-bow{animation:gfxbow 1.4s ease-in-out 1}', '#gstage .gcut.gfx-duck{animation:gfxduck 1.6s ease-in-out 1}', '#gstage .gcut.gfx-nod{animation:gfxnod 1.3s ease-in-out 1}',
    '#gstage .gcut.gfx-slump{animation:gfxslump 1.8s ease-in-out 1}', '#gstage .gcut.gfx-quake{animation:gfxquake 1.2s linear 1}', '#gstage .gcut.gfx-dimfx{animation:gfxdimfx 1.8s ease-in-out 1}',
    '#gstage .gcut.gfx-shrinkfx{animation:gfxshrinkfx 1.5s ease-in-out 1}',
    '.grip{position:fixed;z-index:10045;transform:translateX(-50%);padding:.25vh .7vh;border-radius:.7vh;background:rgba(20,40,60,.9);color:#cfe9ff;font:600 max(11px,1.25vh) ui-monospace,Menlo,Consolas,monospace;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .4s}',
    '.grip.on{opacity:1}', '#gundo{position:fixed;left:50%;bottom:12vh;transform:translateX(-50%);z-index:10070;display:flex;gap:10px;align-items:center;padding:6px 8px 6px 14px;border-radius:999px;background:rgba(14,14,14,.92);color:#fff;font:500 max(12px,1.45vh)/1.3 system-ui,sans-serif;box-shadow:0 3px 14px #0008;opacity:0;transition:opacity .3s;max-width:min(92vw,560px)}',
    '#gundo.on{opacity:1}', '#gundo span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}', '#gundo button{font:600 1em system-ui,sans-serif;color:#111;background:#ffd76a;border:0;border-radius:999px;padding:6px 14px;min-height:32px;cursor:pointer}',
    '#modes #smarttap[aria-pressed="false"]{opacity:.6}', '#gstage .gcut.gfaded{opacity:.38;filter:saturate(.25)}', '#gmeth button.gfaded{opacity:.5;border-style:dashed}',
    '#gmeth .gmvc{width:100%;color:#b9b2a0;font-weight:400;font-size:.78em;padding:0 .3vh}',
    // Phase B (v529): recursion layers in the pop-up, pending-promise markers, a resolved flash, thrown exceptions in the menu
    '#gtweet .grec{border-left:2px solid #6b8aa8;margin:.45vh 0 0 calc(var(--d,1) * .9vh);padding:.2vh 0 .2vh .7vh;font-size:.86em;color:#d8e6f2;background:rgba(40,60,80,.25);border-radius:0 .5vh .5vh 0}',
    '#gtweet .grec b{font:600 .92em ui-monospace,Menlo,Consolas,monospace;color:#ffd76a}', '#gtweet .gtx{color:#ffb0a0;font-size:.82em;margin-top:.4vh}',
    '@keyframes gpend{0%,100%{opacity:.25;scale:.9}50%{opacity:.7;scale:1.08}}', '@keyframes gpflash{0%{opacity:0;scale:.6}25%{opacity:1;scale:1.4}100%{opacity:0;scale:1}}',
    '.gprom{position:fixed;z-index:10030;transform:translate(-50%,-50%);width:max(16px,2.2vh);height:max(16px,2.2vh);border-radius:50%;border:2px solid #b9a4ff;color:#d9ccff;font:700 max(10px,1.3vh)/max(14px,1.9vh) system-ui,sans-serif;text-align:center;pointer-events:none;animation:gpend 2.4s ease-in-out infinite}',
    '.gprom.done{border-color:#9fe8a0;color:#9fe8a0;animation:gpflash 1.6s ease-out 1 forwards}',
    '#gpromq{position:fixed;left:1vh;bottom:1vh;z-index:10030;max-width:min(60vw,420px);padding:.4vh .8vh;border-radius:.8vh;background:rgba(30,20,50,.55);color:#e2d8ff;font:500 max(11px,1.3vh)/1.3 system-ui,sans-serif;pointer-events:none;animation:gpend 3.2s ease-in-out infinite;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#gmeth .gmx{width:100%;color:#ffb0a0;font-weight:400;font-size:.82em;padding:0 .3vh}', '#gmeth .gmx.soft,#gtweet .gtx.soft{color:#b8b0d8;font-style:italic}',
    '@media (prefers-reduced-motion:reduce){.gprom,#gpromq{animation:none;opacity:.5}}', '#gmeth .gmi{width:100%;color:#9fd3ff;font-weight:400;font-size:.82em;padding:0 .3vh}',
    '@media (prefers-reduced-motion:reduce){#gstage .gcut[class*="gfx-"]{animation:none}}'].join('\n');
  document.head.appendChild(MCSS);
  const M = S.methods = {el: null, cut: null, sent: [], timer: 0};
  const objName = c => { let n = c.castAs || tagName(c) || c.label || c.klass || 'object';
    n = String(n).replace(/\u00b7\d+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
    if(!n) n = 'object'; if(/^\d/.test(n)) n = 'o_' + n.slice(0, 58); return n; };
  const isFigure = c => !!c.castAs || PERSON.test(String(c.klass || '')) || PERSONISH.test(String(c.klass || c.label || '').toLowerCase()) || CMD.chars.has(ckey(objName(c)));
  const qstr = a => a.map(x => "'" + x + "'").join(', ');
  // ---------- registry functions (Jesuye 17 Nov 2026 10:51 AM ET "the objects methods on the projector should now mean something not just the
  // grow, dim, glow we have now"; 10:54 AM ET: an object with no functions of its own keeps only the old methods). data/object_methods.json
  // (tools/export_object_methods.py, cmd_loop) maps a stage object name to the functions grown from seated code titles in every agenda
  // (teo.fold(surgical) 🛤️ first seated run-5a58c4 j25). A tap lists those titles; a click pops one of its archive tweets with its year,
  // plays an effect that fits the verb, and logs a func_call (author projector, linked to the run/job it was seated in) over the same relay.
  const OM = S.objectMethods = {objects: {}, functions: {}, inherit: {}, runs: {}, safes: {}, scene_safes: {}, scene_env: {}, at: 0, turn: {}};
  function loadOM(){ fetch('data/object_methods.json?t=' + Date.now(), {cache: 'no-store'}).then(r => r.ok ? r.json() : null).then(d => {
    if(!d || !d.objects || !d.functions) return;
    const keep = {};
    Object.entries(OM.functions || {}).forEach(([id, f]) => { if(f && (f.cli || f.source === 'cli')) keep[id] = f; });
    OM.objects = d.objects; OM.functions = d.functions;
    OM.inherit = d.inherit || {}; OM.implements = d.implements || {}; OM.casts = d.casts || {}; OM.runs = d.runs || {}; OM.safes = d.safes || {}; OM.scene_safes = d.scene_safes || {}; OM.scene_env = d.scene_env || {}; OM.at = Date.now();
    Object.entries(keep).forEach(([id, f]) => {
      if(!OM.functions[id]) OM.functions[id] = f;
      else { const g = OM.functions[id]; g.cli = g.cli || f.cli; g.source = g.source || f.source; (f.runs || []).forEach(r => { if(!g.runs) g.runs = []; if(r && !g.runs.includes(r)) g.runs.push(r); }); }
      const ok = String(f.object || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
      if(ok){ if(!OM.objects[ok]) OM.objects[ok] = []; if(!OM.objects[ok].includes(id)) OM.objects[ok].push(id); }
      (f.runs || []).forEach(r => { const box = OM.runs[r] || (OM.runs[r] = {funcs: []}); if(!box.funcs) box.funcs = []; if(!box.funcs.includes(id)) box.funcs.push(id); });
    });
  }).catch(()=>{}); }
  loadOM(); setInterval(loadOM, 300000);
  // typed arguments + dependency injection (Jesuye 17 Nov 2026 12:34 PM ET "do everything"): data/classes.json holds each agenda's container
  // ([word, class, job, source]: seated picks, typed calls, objects on stage); a call resolves every parameter of its signature to the
  // newest instance of that class in the caller's run at or before the scene's job, else the original (same rule as thryd_classes.resolve
  // on the box, whose answer replaces this one when the relay replies)
  const CLS = S.classes = {containers: {}, classes: {}, instances: {}, parent: {}, overrides: {}, interfaces: {}, casts: {}, at: 0};
  function loadCLS(){ fetch('data/classes.json?t=' + Date.now(), {cache: 'no-store'}).then(r => r.ok ? r.json() : null).then(d => {
    if(!d || !d.containers) return; CLS.genre_types = d.genre_types || {}; CLS.containers = d.containers; CLS.classes = d.classes || {}; CLS.instances = d.instances || {};
    CLS.parent = d.parent || {}; CLS.overrides = d.overrides || {}; CLS.interfaces = d.interfaces || {}; CLS.casts = d.casts || {}; CLS.at = Date.now(); }).catch(()=>{}); }
  loadCLS(); setInterval(loadCLS, 300000);
  const jobN = j => { const m = String(j || '').match(/^[jw](\d+)$/i); return m ? +m[1] : null; };
  const SRC_RANK = {pick: 0, typed: 1, stage: 2};
  function injectFor(it, c){
    const H = c.home || {}, sig = (it.f && it.f.sig) || {params: []}, sm = String(H.mid || '').match(/^live:(run-[0-9a-z-]+):([jw]\d{1,3})$/);
    let run = null, limit = null;
    if(it.scope === 'env' && it.env_scope === 'run') run = it.env_from; else if(sm) run = sm[1]; else if(H.run && CLS.containers[H.run]) run = H.run; else run = it.t.run;
    if(sm && run === sm[1]) limit = jobN(sm[2]);
    const cont = CLS.containers[run] || [], used = new Set();
    return (sig.params || []).map(p => { let best = null;
      cont.forEach(([w, cl, job, src]) => { if(cl !== p.class || used.has(w)) return; const jn = jobN(job); if(limit != null && jn != null && jn > limit) return;
        const key = [jn == null ? -1 : jn, w === p.default ? 1 : 0, -(SRC_RANK[src] == null ? 3 : SRC_RANK[src])];
        if(!best || key[0] > best.k[0] || (key[0] === best.k[0] && (key[1] > best.k[1] || (key[1] === best.k[1] && key[2] > best.k[2])))) best = {k: key, w, job, src}; });
      if(best){ used.add(best.w); return {param: p.name, class: p.class, instance: best.w, from_run: run, from_job: best.job, source: best.src}; }
      return {param: p.name, class: p.class, instance: p.default, from_run: p.first_run, from_job: p.first_job, source: 'original'}; });
  }
  function resolvedText(it, inj){
    const head = it.id.split('.')[0] + '.' + it.f.method + '(' + inj.map(i => i.param + '=' + i.instance + ':' + i.class).join(', ') + ')';
    const src = [...new Set(inj.filter(i => i.from_job).map(i => i.from_job))];
    return head + (src.length === 1 ? ' from ' + src[0] : src.length ? ' from ' + inj.filter(i => i.from_job).map(i => i.param + '<-' + i.from_job).join(', ') : '');
  }
  S.injectFor = injectFor;
  const omKey = x => String(x || '').toLowerCase().replace(/\u00b7\d+$/, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  function funcsFor(c){
    const keys = []; [objName(c), c.castAs, tagName(c), c.label, c.klass].forEach(x => { const k = omKey(x); if(k){ keys.push(k); keys.push(k.replace(/_[0-9a-f]{4,6}$/, '')); } });
    const run = (c && c.home && c.home.run) || currentRun();
    const ids = []; keys.forEach(k => (OM.objects[k] || []).forEach(id => {
      const f = OM.functions[id]; if(!f || ids.includes(id)) return;
      if((f.cli || f.source === 'cli') && f.runs && f.runs.length && run && !f.runs.includes(run)) return;
      ids.push(id);
    }));
    const out = []; ids.forEach(id => (OM.functions[id].titles || []).forEach(t => { if(!out.some(o => o.t.title === t.title)) out.push({id, f: OM.functions[id], t}); }));
    return out;
  }
  // scope inheritance (Jesuye 17 Nov 2026 11:11 AM ET "you can also use functions and methods that belong to the safe where the objects
  // belong. we can call methods in the objects environment"): after its own functions an object lists what its environment holds, the
  // run it belongs to (OM.inherit from agenda_objects / frame_objects / objects_map, or the cut's own home run) and then the safe its frame
  // was cut from or its run was seeded from (every function seated there or in other runs seeded from that safe). One labelled row each.
  function envFor(c, own){
    const H = c.home || {}, rows = [], seen = new Set(own.map(o => o.id)), add = (scope, from, title) => {
      if(rows.some(r => r.scope === scope && r.from === from)) return;
      const src = scope === 'run' ? OM.runs[from] : OM.safes[from]; if(!src) return;
      const fs = (src.funcs || []).slice().reverse().filter(id => OM.functions[id] && !seen.has(id)); if(!fs.length) return;
      fs.forEach(id => seen.add(id)); rows.push({scope, from, title: title || (src.title || ''), funcs: fs}); };
    // environment by the object's own name (not its cut label, which many scenes share) and by the scene it was cut from
    const keys = []; [objName(c), c.castAs, tagName(c)].forEach(x => { const k = omKey(x); if(k){ keys.push(k); keys.push(k.replace(/_[0-9a-f]{4,6}$/, '')); } });
    const runs = [], safes = [], se = OM.scene_env[H.mid];
    if(se){ (se.runs || []).forEach(r => runs.push(r)); (se.safes || []).forEach(p => safes.push(p)); }
    if(H.run && /^run-/.test(H.run)) runs.push(H.run);
    keys.forEach(k => (OM.inherit[k] || []).forEach(r => (r.scope === 'run' ? runs : safes).push(r.from)));
    runs.forEach(r => { if(OM.runs[r] && OM.runs[r].safe) safes.push(OM.runs[r].safe); });
    (OM.scene_safes[H.mid] || []).forEach(p => safes.unshift(p));
    runs.forEach(r => add('run', r)); safes.forEach(p => add('safe', p));
    return rows.map(r => ({...r, items: r.funcs.map(id => { const f = OM.functions[id]; return {id, f, t: (f.titles || [])[0], scope: 'env', env_scope: r.scope, env_from: r.from}; }).filter(x => x.t)}));
  }
  S.envFor = envFor;
  // verb -> effect (a small mapping; get*/is* reveal like know, set* speaks like say; anything else gets the glint + pulse)
  const GFX = {fold: 'fold', hide: 'hide', vanish: 'hide', tune: 'tune', mix: 'tune', play: 'tune', hit: 'tune', count: 'tune', know: 'know', see: 'know', reveal: 'know',
    weigh: 'weigh', carry: 'weigh', teach: 'weigh', hold: 'weigh', say: 'say', on: 'say', made: 'say', belong: 'weigh', kill: 'shake', again: 'shake', open: 'open', map: 'open'};
  function gfxOf(method){ const m = String(method || '').toLowerCase(); if(GFX[m]) return GFX[m]; if(/^(get|is|has)/.test(m)) return 'know'; if(/^set/.test(m)) return 'say';
    const k = Object.keys(GFX).find(v => m.startsWith(v)); return k ? GFX[k] : 'know'; }
  function playGfx(c, fx){ if(!c.el || !c.el.isConnected) return; const cl = 'gfx-' + fx;
    [...c.el.classList].forEach(x => { if(/^gfx-/.test(x)) c.el.classList.remove(x); }); c.el.classList.remove('gnotice'); void c.el.offsetWidth; c.el.classList.add(cl);
    clearTimeout(c._gfxT); c._gfxT = setTimeout(()=> c.el && c.el.classList.remove(cl), 2400); }
  // ---------- inheritance + polymorphism + interfaces + observers (Phase A, Jesuye 17 Nov 2026 12:40 PM ET "do everything!!!!"): every
  // object is an instance of a class in Thing > Person|Place|Feeling|... (data/classes.json, thryd-db/thryd_oop.py); a class overrides the
  // verb's effect (Person.fold = bow), walked up the chain. Interfaces (Readable, Foldable, ...) come from the verbs an object's functions use.
  // A call notifies its listeners: the rest of its scene on stage, then the agenda's cast; each plays its own class's effect in turn, with a
  // small "because teo.fold(...)" tag. The box logs each ripple as its own func_call with cause_id.
  const baseKey = c => omKey(objName(c)).replace(/_[0-9a-f]{4,6}$/, '');
  function classOf(c){ const k = baseKey(c), i = CLS.instances[k] || CLS.instances[omKey(c.castAs)] || CLS.instances[omKey(tagName(c))];
    if(i && i.class) return i.class; return isFigure(c) ? 'Person' : 'Thing'; }
  function chainOf(cl){ const out = []; let x = cl || 'Thing'; while(x && !out.includes(x)){ out.push(x); x = CLS.parent[x] || (x === 'Thing' ? null : 'Thing'); } return out; }
  function effectOf(method, cl){ const fx = gfxOf(method); for(const k of chainOf(cl)){ const o = (CLS.overrides[k] || {})[fx]; if(o) return {fx: o, by: k}; } return {fx, by: 'Thing'}; }
  function ifacesOf(c){ const k = baseKey(c), own = (OM.implements || {})[k]; if(own && own.length) return own;
    return ((CLS.classes[classOf(c)] || {}).implements || []).slice(0, 4); }
  function listenersOf(c){ const H = c.home || {}, run = (String(H.mid || '').match(/^live:(run-[0-9a-z-]+):/) || [])[1] || H.run, me = baseKey(c), out = [];
    const cast = new Set(CLS.casts[run] || []), sib = x => { const k = baseKey(x); return k === me || k.startsWith(me + '_') || me.startsWith(k + '_'); };
    S.cuts.forEach(x => { if(x !== c && x.el && x.el.isConnected && !x.leaving && x.home === c.home && !sib(x) && out.length < 3) out.push(x); });
    S.cuts.forEach(x => { if(x !== c && !out.includes(x) && x.el && x.el.isConnected && !x.leaving && cast.has(baseKey(x)) && !sib(x) && out.length < 3) out.push(x); });
    return out; }
  function ripTag(c, text){ if(!c.el || !c.el.isConnected) return; const r = c.el.getBoundingClientRect(), t = document.createElement('div'); t.className = 'grip';
    t.textContent = text.length > 64 ? text.slice(0, 63) + '\u2026' : text; overlayHost().appendChild(t);
    const rp = toLocal(r.left + r.width / 2, r.top - 26), vb = visBox();
    t.style.left = Math.max(vb.l + 60, Math.min(vb.l + vb.w - 60, rp.x)).toFixed(1) + 'px'; t.style.top = Math.max(vb.t + 6, rp.y).toFixed(1) + 'px';
    requestAnimationFrame(()=> t.classList.add('on')); setTimeout(()=>{ t.classList.remove('on'); setTimeout(()=> t.remove(), 500); }, 2600); }
  function ripple(c, method, because){ const ls = listenersOf(c), done = []; c._ripT = []; c._ripL = ls;
    ls.forEach((x, n) => { const e = effectOf(method, classOf(x)); done.push({object: baseKey(x), fx: e.fx, cls: classOf(x)});
      c._ripT.push(setTimeout(()=>{ playGfx(x, e.fx); ripTag(x, 'because ' + because); }, 600 * (n + 1))); });
    return done; }
  // ---------- promises / exceptions / recursion (Phase B, 17 Nov 2026): #thryd's promises.jsonl and exceptions.jsonl (thryd-db/story_*.py) are
  // the only source of truth; data/promises.json and data/exceptions.json are read-only exports of them. A pending promise puts a faint pulsing
  // "?" on the objects it names (and a quiet line bottom-left); when it resolves the marker flashes once. Open exceptions show in the tap menu.
  // A function's earlier definitions (same method, then the same verb family, in older agendas) open as nested layers in its pop-up, depth 5.
  const PR = S.story = {promises: [], exceptions: [], marks: new Map(), state: {}, at: 0};
  function loadPR(){ ['promises', 'exceptions'].forEach(k => fetch('data/' + k + '.json?t=' + Date.now(), {cache: 'no-store'}).then(r => r.ok ? r.json() : null).then(d => {
    if(!d || !Array.isArray(d[k])) return; PR[k] = d[k]; PR.at = Date.now(); if(k === 'promises') d[k].forEach(p => {
      const was = PR.state[p.id]; PR.state[p.id] = p.status; if(was === 'pending' && p.status === 'resolved') PR.flash = (PR.flash || []).concat([p.id]); }); }).catch(()=>{})); }
  loadPR(); setInterval(loadPR, 120000);
  const promWords = p => (p.objects && p.objects.length ? p.objects : []).map(omKey);
  function promisesFor(c, status){ const k = baseKey(c), run = (c.home || {}).run;
    return PR.promises.filter(p => p.status === status && (!p.run || !run || !/^run-/.test(run) || p.run === run) && promWords(p).includes(k)); }
  // severity first (#thryd 1:30 PM ET: soft for genre_mismatch, hard for fact_conflict / promise_conflict); kind only when severity is missing
  const isSoft = e => { const sv = e && e.severity; if(sv != null) return String(sv).toLowerCase() === 'soft'; return String((e && e.kind) || '').toLowerCase() === 'genre_mismatch'; };
  function exceptionsFor(c){ const k = baseKey(c); return PR.exceptions.filter(e => e.status !== 'resolved' && e.status !== 'caught' && ((e.objects || []).map(omKey).includes(k))); }
  function paintPromises(){ const live = new Set(), flash = new Set(PR.flash || []); PR.flash = [];
    S.cuts.forEach(c => { if(!c.el || !c.el.isConnected || c.leaving) return; const pend = promisesFor(c, 'pending'), done = PR.promises.filter(p => flash.has(p.id) && promWords(p).includes(baseKey(c)));
      if(!pend.length && !done.length) return; live.add(c); let m = PR.marks.get(c);
      if(!m){ m = document.createElement('div'); m.className = 'gprom'; m.textContent = '?'; overlayHost().appendChild(m); PR.marks.set(c, m); }
      if(done.length){ m.classList.add('done'); m.textContent = '\u2713'; playGfx(c, 'know'); const mm = m; setTimeout(()=>{ mm.remove(); if(PR.marks.get(c) === mm) PR.marks.delete(c); }, 1700); }
      m.title = pend.map(p => p.text).join(' \u00b7 '); const r = c.el.getBoundingClientRect(), rp = toLocal(r.right - 4, r.top + 4);
      m.style.left = rp.x.toFixed(1) + 'px'; m.style.top = rp.y.toFixed(1) + 'px'; });
    PR.marks.forEach((m, c) => { if(!live.has(c) && !m.classList.contains('done')){ m.remove(); PR.marks.delete(c); } });
    const pend = PR.promises.filter(p => p.status === 'pending'); let q = document.getElementById('gpromq');
    if(!pend.length){ if(q) q.remove(); return; }
    if(!q){ q = document.createElement('div'); q.id = 'gpromq'; document.body.appendChild(q); }
    const last = pend[pend.length - 1]; q.textContent = '? ' + pend.length + ' pending \u00b7 ' + last.text + (last.job ? ' (' + last.job + ')' : ''); }
  setInterval(paintPromises, 1000);
  // Phase C (v530): faded functions/objects, revived by a call; a commit per pick and a branch per agenda in data/world_log.json
  const VC = S.worldLog = {branches: {}, at: 0};
  function loadVC(){ fetch('data/world_log.json?t=' + Date.now(), {cache: 'no-store'}).then(r => r.ok ? r.json() : null).then(d => { if(d && d.branches){ VC.branches = d.branches; VC.at = Date.now(); } }).catch(()=>{}); }
  loadVC(); setInterval(loadVC, 300000);
  function commitFor(c){ const H = c.home || {}, m = String(H.mid || '').match(/^live:(run-[0-9a-z-]+):([jw]\d{1,3})$/), r = m ? m[1] : H.run, j = m ? m[2] : H.card;
    return ((VC.branches[r] || {}).commits || []).find(x => jobN(x.job) === jobN(j)) || null; }
  function paintGC(){ S.cuts.forEach(c => { if(!c.el || !c.el.isConnected) return; const fs = funcsFor(c); c.el.classList.toggle('gfaded', fs.length > 0 && fs.every(it => it.f.faded)); }); }
  setInterval(paintGC, 1200); S.commitFor = commitFor;
  function priorOf(it){ return ((it.f && it.f.prior) || []).slice(0, 4).map(p => ({...p, f: OM.functions[p.id]})); }
  S.promisesFor = promisesFor; S.exceptionsFor = exceptionsFor; S.priorOf = priorOf;
  S.classOf = classOf; S.effectOf = effectOf; S.listenersOf = listenersOf; S.ifacesOf = ifacesOf;
  let TW = null;
  function popTweet(c, it, tw){
    if(TW){ TW.remove(); TW = null; document.body.classList.remove('dwell'); }
    const b = document.createElement('div'); b.id = 'gtweet'; b.setAttribute('role', 'status');
    const h = document.createElement('div'); h.className = 'gtc'; h.textContent = it.t.title + (it.t.emoji ? ' ' + it.t.emoji : '') + ' · ' + it.t.run + ' ' + it.t.job
      + (it.scope === 'env' ? ' · inherited from ' + (it.env_scope === 'run' ? it.env_from : 'the safe') : ''); b.appendChild(h);
    if(it.resolved){ const rv = document.createElement('div'); rv.className = 'gtr'; rv.textContent = it.resolved; b.appendChild(rv); }
    const q = document.createElement('div');
    if(tw){ q.appendChild(document.createTextNode('\u00ab' + tw.text + '\u00bb ')); const y = document.createElement('span'); y.className = 'gty'; y.textContent = tw.year; q.appendChild(y); }
    else q.textContent = '(no archive tweet with a year for this title)';
    b.appendChild(q);
    let host = b; priorOf(it).forEach((p, n) => { const L = document.createElement('div'); L.className = 'grec'; L.style.setProperty('--d', String(n ? 1 : 0));
      const t = (p.f && (p.f.titles || []).find(x => x.title === p.title)) || null, tw0 = t && (t.tweets || [])[0];
      const hd = document.createElement('b'); hd.textContent = '\u21b3 ' + p.title; L.appendChild(hd); L.appendChild(document.createTextNode(' \u00b7 ' + p.run + ' ' + p.job + ' \u00b7 ' + p.why));
      if(tw0){ const q2 = document.createElement('div'); q2.appendChild(document.createTextNode('\u00ab' + tw0.text + '\u00bb ')); const y2 = document.createElement('span'); y2.className = 'gty'; y2.textContent = tw0.year; q2.appendChild(y2); L.appendChild(q2); }
      host.appendChild(L); host = L; });
    (it.catches || []).forEach(x => { const e = document.createElement('div'), soft = isSoft(x); e.className = 'gtx' + (soft ? ' soft' : '');
      e.textContent = (soft ? '\u21af bends the scene: ' : '\u26a0 caught: ') + x.text + (x.job ? ' (' + x.job + ')' : ''); b.appendChild(e); });
    if(it.t.consequence){ const n = document.createElement('div'); n.className = 'gtn'; n.textContent = (it.t.consequence_job ? it.t.consequence_job + ': ' : '') + it.t.consequence; b.appendChild(n); }
    overlayHost().appendChild(b); TW = b;
    const r = c.el && c.el.isConnected ? c.el.getBoundingClientRect() : {left: vw() / 2, width: 0, top: vh() / 2, bottom: vh() / 2};
    const bw = b.offsetWidth, bh = b.offsetHeight, mid = toLocal(r.left + r.width / 2, r.top), bot = toLocal(r.left + r.width / 2, r.bottom), vb = visBox();
    const x = Math.max(vb.l + bw / 2 + 6, Math.min(vb.l + vb.w - bw / 2 - 6, mid.x)); let y = mid.y - bh - 10; if(y < vb.t + 6) y = Math.min(vb.t + vb.h - bh - 6, bot.y + 10);
    b.style.left = x.toFixed(1) + 'px'; b.style.top = y.toFixed(1) + 'px';
    requestAnimationFrame(()=> b.classList.add('on'));
    const me = b; b.tabIndex = 0; b.addEventListener('click', ev => ev.stopPropagation()); b.addEventListener('pointerdown', ev => ev.stopPropagation());
    const held = ()=> me.matches(':hover') || me.contains(document.activeElement);
    b.addEventListener('pointerenter', ()=> document.body.classList.add('dwell')); b.addEventListener('focusin', ()=> document.body.classList.add('dwell'));
    const out = ()=>{ if(!held()) document.body.classList.remove('dwell'); }; b.addEventListener('pointerleave', out); b.addEventListener('focusout', ()=> setTimeout(out, 0));
    const bye = ()=>{ if(!me.isConnected) return; if(held()){ setTimeout(bye, 1500); return; } // context: a reader keeps it
      me.classList.remove('on'); document.body.classList.remove('dwell'); setTimeout(()=>{ me.remove(); if(TW === me) TW = null; }, 600); };
    setTimeout(bye, 9000);
  }
  S.popTweet = popTweet;
  async function fireFunc(c, name, it, src){
    const tws = it.t.tweets || [], k = it.t.title, ti = tws.length ? ((OM.turn[k] = ((OM.turn[k] == null ? -1 : OM.turn[k]) + 1) % tws.length)) : null;
    const tw = ti == null ? null : tws[ti], H = c.home || {}, eid = uid();
    const f = it.f, inj = injectFor(it, c); it = {...it, injected: inj, resolved: resolvedText(it, inj)};
    const code = (inj.length ? it.id.split('.')[0] + '.' + f.method + '(' + inj.map(i => "'" + i.instance + "'").join(', ') + ')' : it.t.title) + ';';
    const body = {v: 1, type: 'call', event_id: eid, rid: eid + '-r', run: H.run || AG.active || null, card: null, object: name, fn: f.method, args: [it.t.arg],
      func: it.id, title: it.t.title, ti: ti == null ? 0 : ti, scope: it.scope === 'env' ? 'env' : 'own', ...(it.scope === 'env' ? {env_scope: it.env_scope, env_from: it.env_from} : {}), scene: H.mid ? String(H.mid).slice(0, 160) : null, cut: c.label ? String(c.label).slice(0, 60) : null, client_ts: new Date().toISOString()};
    if(src === 'intent') body.source = 'intent';
    const flesh = S._pendingFlesh;
    if(flesh){
      body.impl = flesh.body || ''; body.result = flesh.result || ''; body.body_v = flesh.version || 0;
      body.const_diff = flesh.constantsDiff || []; body.ran_as = flesh.ranAs || flesh.body || '';
    }
    const fr = (String(H.mid || '').match(/(?:^|[^A-Za-z0-9])([jw]\d{1,3})(?![0-9])/i) || [])[1];
    body.card = String(H.card || fr || root.__thrydCard || '').toLowerCase() || null;
    if(body.run && !/^run-[0-9a-f]{4,6}$/.test(body.run)) body.run = null; if(body.card && !/^[jw]\d{1,3}$/.test(body.card)) body.card = null;
    const rec = {code, body, status: 'sending', at: Date.now(), impl: body.impl, result: body.result, ranAs: body.ran_as, version: body.body_v, constantsDiff: body.const_diff}; M.sent.push(rec); if(M.sent.length > 40) M.sent.shift();
    // shown locally first, whatever the relay does
    if(it.f.faded){ it.f.faded = false; if(c.el) c.el.classList.remove('gfaded'); rec.revived = true; }
    const myCls = classOf(c), eff = effectOf(f.method, myCls); rec.effect = eff.fx; rec.effect_class = eff.by;
    it.catches = exceptionsFor(c).slice(0, 2); playGfx(c, eff.fx);
    if(root.ThrydCutAnimate && ThrydCutAnimate.verbOf(f.method)){ const tgt = (it.injected && it.injected[0] && matchFreeCuts(ckey(it.injected[0].instance || it.injected[0]), (c.home||{}).run || AG.active))[0] || null; c.motion = ThrydCutAnimate.makeScript(f.method, 0, tgt); }
    popTweet(c, it, tw); rec.ripples = ripple(c, f.method, it.resolved || it.t.title); rec.resolved = it.resolved; rec.injected = inj; if(c.el && c.el.isConnected) tagAt(c, code);
    rec.sendPrefix = 'tapped · ' + (it.scope === 'env' ? name + ' called it from ' + (it.env_scope === 'run' ? it.env_from : 'the safe') + ' · ' : '') + it.id + ' (first seated ' + ((f.defined || {}).run || '?') + ' ' + ((f.defined || {}).job || '') + ')';
    codeLine(it.resolved || code, rec.sendPrefix + ' · sending…'); note('func', code, eid);
    return sendCall(rec, code, eid);
  }
  S.fireFunc = fireFunc;
  S.playMotion = function(c, verb, target, dur){ const A = root.ThrydCutAnimate; if(!A) return null; const script = A.makeScript(verb, dur, target || null); if(script && c){ c.motion = script; script.t0 = 0; } return script; };
  // ---------- smart taps (Jesuye 17 Nov 2026 2:54 PM ET "they tap a button but the a.i knew they mean to click that button so it doesnt pop
  // up. it knows what the user wants and moves the way"). On this device only, no external model: a tap with one obvious choice runs it
  // and shows a 3 s undo instead of the menu. Obvious = one own function; or the same choice 2 of the last 3 times on this object or its
  // class; or a tiny scorer (frequency 0.5 + recency 0.3 + scene genre fit 0.2 from data/classes.json genre_types) >= .75 and .25 ahead of
  // the next. Long-press or right-click always opens the whole menu. Menus are ordered by this device's history. Calls made this way
  // go over the same validated relay with source 'intent'; an undo reverses the look and is logged (type 'undo').
  const IK = 'thryd_intent_v1', SK = 'thryd_smart';
  let IH = {o: {}, k: {}}; try{ IH = JSON.parse(localStorage.getItem(IK) || 'null') || IH; }catch(e){}
  const smartOn = ()=>{ try{ return localStorage.getItem(SK) !== '0'; }catch(e){ return true; } };
  const saveIH = ()=>{ try{ localStorage.setItem(IK, JSON.stringify(IH)); }catch(e){} };
  const choiceId = x => x.it ? 'f:' + x.it.t.title : 'm:' + x.m.fn + '(' + (x.m.args || []).join(',') + ')';
  function remember(c, id){ const t = Date.now(), ok = baseKey(c), kk = classOf(c);
    [[IH.o, ok], [IH.k, kk]].forEach(([b, k]) => { const a = b[k] || (b[k] = []); a.push({id, t}); if(a.length > 12) a.splice(0, a.length - 12); }); saveIH(); }
  function forget(c, id){ [[IH.o, baseKey(c)], [IH.k, classOf(c)]].forEach(([b, k]) => { const a = b[k] || []; for(let i = a.length - 1; i >= 0; i--) if(a[i].id === id){ a.splice(i, 1); break; } }); saveIH(); }
  function histOf(c){ return (IH.o[baseKey(c)] || []).concat((IH.k[classOf(c)] || []).map(h => ({...h, cls: 1}))); }
  function genreOf(c){ const cm = commitFor(c); return cm && cm.genre; }
  function fitOf(x, g){ if(!g || !x.it) return .5; const ok = (CLS.genre_types || {})[g]; if(!ok) return .5;
    const ps = ((x.it.f || {}).sig || {}).params || []; return ps.every(p => ok.includes(p.class)) ? 1 : 0; }
  function scoreOf(c, x, hist, g){ const id = choiceId(x), mine = hist.filter(h => h.id === id), n = Math.max(3, hist.length); // one pick is never 'obvious'
    const freq = mine.reduce((a, h) => a + (h.cls ? .5 : 1), 0) / n, last = mine.length ? Math.max(...mine.map(h => h.t)) : 0;
    const rec = last ? Math.exp(-(Date.now() - last) / 864e5) : 0; return .5 * Math.min(1, freq) + .3 * rec + .2 * fitOf(x, g) + aiB(c, x); }
  // in-browser AI bonus 0..0.2 (assets/intent_ai.js, v538): similarity to this viewer's recent picks and typed calls; 0 when off or not loaded
  const aiB = (c, x)=>{ try{ const A = root.thrydIntentAI; return A && A.bonus ? +A.bonus(c, x) || 0 : 0; }catch(e){ return 0; } };
  function choicesFor(c){ const own = funcsFor(c).map(it => ({it, kind: 'own'})), env = envFor(c, own.map(o => o.it));
    const mcc = (typeof mccItems === 'function') ? mccItems(c) : [];
    const out = own.concat(mcc, ...env.map(r => r.items.map(it => ({it, kind: 'env', row: r}))));
    if(!own.length && !mcc.length && !env.some(r => r.items.length)) methodsFor(c).forEach(m => out.push({m, kind: 'old'}));
    return out; }
  function intentFor(c){ if(!smartOn()) return null; const xs = choicesFor(c); if(!xs.length) return null;
    const own = xs.filter(x => x.kind === 'own'); if(own.length === 1) return {x: own[0], why: 'its only function', conf: 1};
    const ids = new Set(xs.map(choiceId));
    for(const [b, k, w] of [[IH.o, baseKey(c), 'this object'], [IH.k, classOf(c), 'its class ' + classOf(c)]]){ const last3 = (b[k] || []).slice(-3).map(h => h.id);
      const top = last3.find(id => ids.has(id) && last3.filter(v => v === id).length >= 2); if(top) return {x: xs.find(x => choiceId(x) === top), why: '2 of your last 3 on ' + w, conf: .9}; }
    const hist = histOf(c), g = genreOf(c); if(!hist.length) return null;
    const sc = xs.map(x => ({x, s: scoreOf(c, x, hist, g)})).sort((a, b) => b.s - a.s);
    if(sc[0].s >= .75 && (sc.length < 2 || sc[0].s - sc[1].s >= .25)) return {x: sc[0].x, why: 'your usual here (' + sc[0].s.toFixed(2) + ')', conf: sc[0].s};
    return null; }
  function orderByPref(c, xs){ const hist = histOf(c); if(!hist.length && !(root.thrydIntentAI && root.thrydIntentAI.hasContext && root.thrydIntentAI.hasContext())) return xs; const g = genreOf(c);
    return xs.map((x, i) => ({x, i, s: scoreOf(c, x, hist, g)})).sort((a, b) => (b.s - a.s) || (a.i - b.i)).map(o => o.x); }
  let UT = null;
  function undoToast(text, onUndo){ if(UT){ UT.remove(); UT = null; }
    const t = document.createElement('div'); t.id = 'gundo'; t.setAttribute('role', 'status');
    const sp = document.createElement('span'); sp.textContent = text; t.appendChild(sp);
    const b = document.createElement('button'); b.type = 'button'; b.textContent = 'undo'; b.setAttribute('aria-label', 'Undo ' + text);
    b.addEventListener('pointerdown', ev => ev.stopPropagation()); b.addEventListener('click', ev => { ev.stopPropagation(); ev.preventDefault(); onUndo(); t.remove(); if(UT === t) UT = null; });
    t.appendChild(b); t.addEventListener('click', ev => ev.stopPropagation()); document.body.appendChild(t); UT = t; requestAnimationFrame(()=> t.classList.add('on'));
    setTimeout(()=>{ t.classList.remove('on'); setTimeout(()=>{ t.remove(); if(UT === t) UT = null; }, 400); }, 3000); return t; }
  async function runIntent(c, ch){ const name = objName(c), x = ch.x, id = choiceId(x); remember(c, id);
    const p = x.it ? fireFunc(c, name, x.it, 'intent') : fireMethod(c, name, x.m.fn, x.m.args, 'intent');
    const rec = M.sent[M.sent.length - 1]; if(rec){ rec.intent = {why: ch.why, conf: ch.conf}; }
    undoToast('\u2728 ' + (x.it ? x.it.t.title : name + '.' + x.m.fn + '(' + qstr(x.m.args) + ')') + ' \u00b7 ' + ch.why, ()=> undoIntent(c, rec, id));
    note('intent', id, ch.why); return p; }
  function undoIntent(c, rec, id){ if(!rec || rec.undone) return; rec.undone = true; forget(c, id);
    (c._ripT || []).forEach(clearTimeout); [c].concat(c._ripL || []).forEach(x => { if(x.el) [...x.el.classList].forEach(k => { if(/^gfx-/.test(k)) x.el.classList.remove(k); }); });
    document.querySelectorAll('.grip').forEach(t => t.remove()); if(TW){ TW.remove(); TW = null; document.body.classList.remove('dwell'); }
    if(rec.body && rec.body.fn && !rec.body.func && c.tapL){ const pv = rec.prevLook || {keys: {}, parts: {}}; c.tapL.keys = pv.keys || {}; c.tapL.parts = pv.parts || {}; paint(c, c.tapL); }
    codeLine('undo ' + rec.code, 'smart tap undone \u00b7 logging the undo\u2026'); const eid = uid();
    const u = {code: 'undo ' + rec.code, body: {v: 1, type: 'undo', event_id: eid, rid: eid + '-r', undo_of: rec.body.event_id, client_ts: new Date().toISOString()}, status: 'sending', at: Date.now(), undo: true};
    M.sent.push(u); if(M.sent.length > 40) M.sent.shift(); sendCall(u, u.code, eid); return u; }
  function tapIntent(c){ const ch = intentFor(c); if(ch && ch.x){ closeMethods(); runIntent(c, ch); return ch; } openMethods(c); return null; }
  S.objName = objName; S.intentFor = intentFor; S.tapIntent = tapIntent; S.undoIntent = undoIntent; S.intentHistory = ()=> IH; S.smartOn = smartOn; S.choicesFor = choicesFor;
  // the setting: one button in the controls, on by default
  function smartButton(){ const bar = document.getElementById('modes'); if(!bar){ setTimeout(smartButton, 1000); return; } if(document.getElementById('smarttap')) return;
    const b = document.createElement('button'); b.id = 'smarttap'; b.type = 'button';
    const show = ()=>{ const on = smartOn(); b.textContent = on ? '\u2728 smart' : '\u2728 off'; b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.title = 'Smart taps: ' + (on ? 'on' : 'off') + '. When an object has one obvious choice, a tap runs it with a 3 s undo; long-press or right-click opens the menu'; b.setAttribute('aria-label', b.title); };
    b.addEventListener('click', ev => { ev.stopPropagation(); try{ localStorage.setItem(SK, smartOn() ? '0' : '1'); }catch(e){} show(); });
    show(); const bg = document.getElementById('bgmode'); if(bg && bg.parentNode === bar) bar.insertBefore(b, bg); else bar.appendChild(b); }
  smartButton();
  // right-click on an object (or just beside it) always opens the whole menu
  addEventListener('contextmenu', e => { if(e.target && e.target.closest && e.target.closest(UIQ)) return; const c = cutAt(e.target) || nearCut(e.clientX, e.clientY, false);
    if(!c) return; e.preventDefault(); try{ openMethods(c, {full: true}); }catch(err){} }, {capture: true}); S.funcsFor = funcsFor;
  function methodsFor(c){ const k = (c.tapL && c.tapL.keys) || {}, v = x => k[x] ? lowv(k[x].value) : '';
    const out = [v('glow') && !isOff(v('glow')) ? {fn: 'glow', args: ['off']} : {fn: 'glow', args: []}, v('size') === 'big' ? {fn: 'shrink', args: []} : {fn: 'grow', args: []}];
    if(isFigure(c)) out.push(v('mood') === 'happy' ? {fn: 'setmood', args: ['sad']} : {fn: 'setmood', args: ['happy']});
    else out.push(v('brightness') === 'dim' ? {fn: 'brighten', args: []} : {fn: 'dim', args: []});
    return out; }
  // ---------- medium cut code (26 Nov 2026): data/medium_cuts_code.json is a tiny
  // manifest; shards live in data/medium_cuts_code/sNN.json. Nothing is fetched at
  // page start. The first tap on a Medium-safe cut loads the manifest and one shard
  // (fnv1a32(medium_image_id) % mod), then both stay in memory. No timers, polling,
  // animations, or scene re-renders. Cuts with no entry keep today's menu.
  const MCC = S.cutCodeCache = {manifest: null, shards: Object.create(null), pending: Object.create(null), manP: null};
  function isMediumCut(c){
    const g = (c && c.home) || {}, mid = String(g.mid || '');
    if(g.live || g.agenda || g.map || /^(live:|chips:|pin:)/.test(mid)) return false;
    const pack = g.row && g.row.pack;
    return /^1\*/.test(mid) || /^x_/.test(mid) || (typeof pack === 'string' && /medium_cuts\//.test(pack));
  }
  function mccShardName(mid, man){
    const mod = (man && man.mod) || 8, pat = (man && man.shard_pattern) || 's{NN}.json';
    return pat.replace('{NN}', String(fnv1a(String(mid)) % mod).padStart(2, '0'));
  }
  function mccUrl(file, man){
    let dir = (man && man.shard_dir) || 'data/medium_cuts_code/';
    if(dir.charAt(dir.length - 1) !== '/') dir += '/';
    return dir + file;
  }
  function loadMccManifest(){
    if(MCC.manifest || MCC.manifest === false) return Promise.resolve(MCC.manifest);
    if(MCC.manP) return MCC.manP;
    MCC.manP = fetch('data/medium_cuts_code.json?t=' + Date.now(), {cache: 'no-store'}).then(r => r.ok ? r.json() : null).then(d => {
      MCC.manifest = (d && d.v === 1 && d.hash === 'fnv1a32' && d.mod) ? d : false;
      return MCC.manifest;
    }).catch(() => { MCC.manifest = false; return false; });
    return MCC.manP;
  }
  function indexMccShard(name, d){
    const by = Object.create(null);
    ((d && d.entries) || []).forEach(e => {
      if(!e || !e.medium_image_id || !e.cut) return;
      const mid = e.medium_image_id, cut = e.cut;
      (by[mid] || (by[mid] = Object.create(null)));
      (by[mid][cut] || (by[mid][cut] = [])).push(e);
    });
    MCC.shards[name] = {raw: d || {entries: []}, by, name};
    return MCC.shards[name];
  }
  function loadMccShard(mid){
    return loadMccManifest().then(man => {
      if(!man) return null;
      const name = mccShardName(mid, man);
      if(MCC.shards[name]) return MCC.shards[name];
      if(MCC.pending[name]) return MCC.pending[name];
      const p = fetch(mccUrl(name, man) + '?t=' + Date.now(), {cache: 'no-store'}).then(r => r.ok ? r.json() : {v: 1, shard: name.replace(/\.json$/, ''), entries: []}).then(d => indexMccShard(name, d)).catch(() => indexMccShard(name, {v: 1, entries: []}));
      MCC.pending[name] = p; p.then(() => { delete MCC.pending[name]; }, () => { delete MCC.pending[name]; });
      return p;
    });
  }
  function mccEntries(c){
    const g = (c && c.home) || {}, mid = g.mid, cut = c && c.label, man = MCC.manifest;
    if(!mid || !cut || !man) return [];
    const sh = MCC.shards[mccShardName(mid, man)];
    return (sh && sh.by && sh.by[mid] && sh.by[mid][cut]) || [];
  }
  function mccItems(c){
    return mccEntries(c).map(e => {
      const links = e.links || [];
      const lf = links.find(l => l && l.kind === 'function' && l.id && OM.functions[l.id]);
      const title = e.title || ((e.methods && e.methods[0] && e.methods[0].title) || (e.object + '.' + (e.method || 'go') + '()'));
      const method = e.method || (e.methods && e.methods[0] && e.methods[0].method) || 'go';
      const args = Array.isArray(e.args) ? e.args : ((e.methods && e.methods[0] && e.methods[0].args) || []);
      if(lf){
        const f = OM.functions[lf.id], t = (f.titles || [])[0] || {title: lf.title || title, run: '', job: ''};
        return {kind: 'mcc', entry: e, it: {id: lf.id, f, t, scope: 'mcc'}, show: title};
      }
      return {kind: 'mcc', entry: e, m: {fn: method, args, title}, show: title};
    });
  }
  const CUT_HOP_RE = /^(.*)#(cut[1-4])$/;
  function parseCutHop(s){
    const m = String(s || '').match(CUT_HOP_RE);
    return m ? {mid: m[1], cut: m[2]} : null;
  }
  function hopsOf(e){
    const out = [], seen = Object.create(null);
    const add = (mid, cut, title) => {
      if(!mid || !/^cut[1-4]$/.test(cut || '')) return;
      const id = mid + '#' + cut;
      if(seen[id]) return;
      seen[id] = 1;
      out.push({mid, cut, id, title: title || ''});
    };
    (e && e.related_cuts || []).forEach(x => {
      if(typeof x === 'string'){ const p = parseCutHop(x); if(p) add(p.mid, p.cut); }
      else if(x && typeof x === 'object'){
        if(x.medium_image_id && x.cut) add(x.medium_image_id, x.cut, x.title);
        else { const p = parseCutHop(x.id || x.href || ''); if(p) add(p.mid, p.cut, x.title); }
      }
    });
    (e && e.links || []).forEach(l => {
      if(!l || l.kind !== 'cut') return;
      if(l.medium_image_id && l.cut) add(l.medium_image_id, l.cut, l.title);
      else { const p = parseCutHop(l.id || ''); if(p) add(p.mid, p.cut, l.title); }
    });
    return out;
  }
  function hopLabel(h){
    const mid = h && h.mid, cut = h && h.cut, man = MCC.manifest;
    if(mid && cut && man){
      const sh = MCC.shards[mccShardName(mid, man)];
      const ents = sh && sh.by && sh.by[mid] && sh.by[mid][cut];
      if(ents && ents[0] && ents[0].title) return ents[0].title;
    }
    if(h && h.title) return h.title;
    return (h && h.cut ? h.cut : 'cut') + ' · ' + String((h && h.mid) || '').slice(0, 18);
  }
  function findHopCut(mid, cut){
    return S.cuts.find(c => c && !c.map && !isLeaving(c) && c.home && c.home.mid === mid && (!cut || c.label === cut));
  }
  function hopToCut(h){
    if(!h || !h.mid) return;
    closeMethods();
    const go = () => {
      const c = findHopCut(h.mid, h.cut) || findHopCut(h.mid, null);
      if(!c) return;
      const g = c.home || c.g;
      if(g && !RM) camGo(g.x + g.w / 2 - vw() / 2, g.y + g.h / 2 - vh() / 2, 6000);
      openMethods(c);
    };
    if(findHopCut(h.mid, h.cut) || findHopCut(h.mid, null)){ go(); return; }
    // dest shard is fetched only if this hop opens that cut's menu (mccEnsure). no prefetch.
    Promise.resolve(showOnStage(h.mid)).then(go).catch(() => {});
  }
  function mccLinkNote(e){
    const bits = [];
    (e.links || []).forEach(l => {
      if(!l) return;
      if(l.kind === 'function' && (l.title || l.id)) bits.push(l.title || l.id);
      else if(l.kind === 'seated' && l.title) bits.push(l.title + (l.run ? ' in ' + l.run + (l.job ? '/' + l.job : '') : ''));
      else if(l.kind === 'object' && l.name) bits.push(l.name);
      else if(l.kind === 'run' && l.id) bits.push(l.id);
    });
    const safe = e.safe && (e.safe.title || e.safe.id);
    if(safe) bits.push('from the safe · ' + safe);
    return bits.filter(Boolean).slice(0, 4).join(' · ');
  }
  function paintMcc(box, c, name, items){
    if(!box || !items || !items.length) return;
    if(box.querySelector('[data-mcc]')) return; // already filled; never rebuild the scene
    const lb = document.createElement('div'); lb.className = 'gms'; lb.dataset.mcc = '1'; lb.textContent = 'from the cut'; box.appendChild(lb);
    items.forEach(x => {
      const e = x.entry, b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.className = 'gmcc'; b.dataset.mcc = '1';
      b.textContent = x.show; b.title = mccLinkNote(e) || x.show;
      b.addEventListener('pointerdown', ev => ev.stopPropagation());
      b.addEventListener('click', ev => {
        ev.stopPropagation(); ev.preventDefault();
        if(x.it){ remember(c, 'f:' + x.it.t.title); fireFunc(c, name, x.it); }
        else { remember(c, 'mcc:' + x.show); fireMethod(c, e.object || name, x.m.fn, x.m.args || []); }
        closeMethods();
      });
      box.appendChild(b);
      const note = mccLinkNote(e);
      if(note){ const n = document.createElement('div'); n.className = 'gmcl'; n.dataset.mcc = '1'; n.textContent = note; box.appendChild(n); }
    });
    const hops = [], hs = Object.create(null);
    items.forEach(x => hopsOf(x.entry).forEach(h => { if(!hs[h.id]){ hs[h.id] = 1; hops.push(h); } }));
    if(hops.length){
      const lb2 = document.createElement('div'); lb2.className = 'gms'; lb2.dataset.mcc = '1'; lb2.textContent = 'related cuts'; box.appendChild(lb2);
      hops.forEach(h => {
        const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.className = 'gmhop'; b.dataset.mcc = '1'; b.dataset.hop = h.id;
        b.textContent = hopLabel(h); b.title = h.id;
        b.addEventListener('pointerdown', ev => ev.stopPropagation());
        b.addEventListener('click', ev => { ev.stopPropagation(); ev.preventDefault(); hopToCut(h); });
        box.appendChild(b);
      });
    }
  }
  function mccEnsure(c, done){
    if(!isMediumCut(c)) return;
    const mid = c.home && c.home.mid;
    if(!mid) return;
    const man = MCC.manifest;
    if(man && MCC.shards[mccShardName(mid, man)]){ if(done) done(mccItems(c)); return; }
    loadMccShard(mid).then(() => { if(done) done(mccItems(c)); }).catch(() => { if(done) done([]); });
  }
  const cutCodeApi = {
    shardName: mid => mccShardName(mid, MCC.manifest || {mod: 8, shard_pattern: 's{NN}.json'}),
    forCut: (mid, cut) => {
      const man = MCC.manifest; if(!man || !mid) return [];
      const sh = MCC.shards[mccShardName(mid, man)];
      return (sh && sh.by && sh.by[mid] && sh.by[mid][cut]) || [];
    },
    load: mid => loadMccShard(mid).then(sh => {
      const by = sh && sh.by && sh.by[mid];
      if(!by) return [];
      const out = []; Object.keys(by).forEach(k => { out.push(...by[k]); });
      return out;
    }),
    hops: (mid, cut) => {
      const out = [], seen = Object.create(null);
      ((cutCodeApi.forCut(mid, cut)) || []).forEach(e => hopsOf(e).forEach(h => { if(!seen[h.id]){ seen[h.id] = 1; out.push(h); } }));
      return out;
    },
    manifest: () => MCC.manifest || null
  };
  S.cutCode = cutCodeApi; root.thrydCutCode = cutCodeApi;

    function closeMethods(){ if(M.el){ M.el.remove(); M.el = null; } M.cut = null; clearTimeout(M.timer); }
  S.closeMethods = closeMethods;
  function openMethods(c, opts){
    if(!c || !c.el || !c.el.isConnected || c.leaving) return;
    if(M.cut === c && M.el){ if(opts && opts.full) return; closeMethods(); return; } // a second tap on the same object closes it
    closeMethods(); M.cut = c;
    const name = objName(c), box = document.createElement('div'); box.id = 'gmeth'; box.setAttribute('role', 'menu');
    const h = document.createElement('div'); h.className = 'gmh'; h.textContent = name + ' : ' + chainOf(classOf(c)).join(' : '); box.appendChild(h);
    const cm = commitFor(c); if(cm){ const v = document.createElement('div'); v.className = 'gmvc'; v.textContent = cm.id + ' \u00b7 ' + cm.branch + ' ' + cm.job + (cm.beat ? ' \u00b7 ' + cm.beat : '') + ' \u00b7 +' + (cm.diff || {}).facts_total + ' facts'; box.appendChild(v); }
    const ifs = ifacesOf(c); if(ifs.length){ const ih = document.createElement('div'); ih.className = 'gmi'; ih.textContent = 'implements ' + ifs.join(', '); box.appendChild(ih); }
    // by kind (17 Nov 2026 1:25 PM ET): #thryd's soft genre_mismatch is a twist, never a block; any other kind (or none) stays a hard throw
    exceptionsFor(c).slice(0, 2).forEach(e => { const x = document.createElement('div'), soft = isSoft(e); x.className = 'gmx' + (soft ? ' soft' : '');
      x.textContent = (soft ? '\u21af twist: ' : '\u26a0 throws: ') + e.text + (e.job ? ' (' + e.job + ')' : ''); box.appendChild(x); });
    if(c.g && c.g.map){
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.className = 'gfn';
      b.textContent = 'Place';
      b.addEventListener('pointerdown', ev => ev.stopPropagation());
      b.addEventListener('click', ev => { ev.stopPropagation(); ev.preventDefault(); closeMethods(); try{ showPinPop(c); }catch(err){} });
      box.appendChild(b);
    }
    const fns = orderByPref(c, funcsFor(c).map(it => ({it, kind: 'own'}))).map(x => x.it);
    fns.forEach(it => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.className = 'gfn';
      b.textContent = it.t.title + (it.t.emoji ? ' ' + it.t.emoji : ''); b.title = it.t.run + ' ' + it.t.job + (it.f.calls ? ' · called ' + it.f.calls + 'x since' : '');
      b.dataset.func = it.id; if(it.f.faded){ b.classList.add('gfaded'); b.title += ' \u00b7 faded (call to revive)'; }
      b.addEventListener('pointerdown', ev => ev.stopPropagation());
      b.addEventListener('click', ev => { ev.stopPropagation(); ev.preventDefault(); remember(c, 'f:' + it.t.title); fireFunc(c, name, it); closeMethods(); });
      box.appendChild(b); });
    const env = envFor(c, fns).map(r => ({...r, items: orderByPref(c, r.items.map(it => ({it, kind: 'env'}))).map(x => x.it)}));
    env.forEach(r => { if(!r.items.length) return; const lb = document.createElement('div'); lb.className = 'gms';
      lb.textContent = r.scope === 'run' ? 'from ' + r.from : 'from the safe' + (r.title ? ' \u00b7 ' + r.title : ''); box.appendChild(lb);
      r.items.forEach(it => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.className = 'genv';
        b.textContent = it.t.title + (it.t.emoji ? ' ' + it.t.emoji : ''); b.title = 'inherited from ' + (r.scope === 'run' ? r.from : 'the safe ' + (r.title || r.from)) + ' · seated ' + it.t.run + ' ' + it.t.job;
        b.dataset.func = it.id; b.dataset.scope = 'env'; if(it.f.faded){ b.classList.add('gfaded'); b.title += ' \u00b7 faded (call to revive)'; }
        b.addEventListener('pointerdown', ev => ev.stopPropagation());
        b.addEventListener('click', ev => { ev.stopPropagation(); ev.preventDefault(); remember(c, 'f:' + it.t.title); fireFunc(c, name, it); closeMethods(); });
        box.appendChild(b); }); });
    const mccNow = mccItems(c);
    if(!fns.length && !mccNow.length && !env.some(r => r.items.length)) orderByPref(c, methodsFor(c).map(m => ({m, kind: 'old'}))).map(x => x.m).forEach(m => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.dataset.oldmeth = '1';
      b.textContent = name + '.' + m.fn + '(' + qstr(m.args) + ')'; b.dataset.fn = m.fn; b.dataset.args = JSON.stringify(m.args);
      b.addEventListener('pointerdown', ev => ev.stopPropagation());
      b.addEventListener('click', ev => { ev.stopPropagation(); ev.preventDefault(); remember(c, 'm:' + m.fn + '(' + (m.args || []).join(',') + ')'); fireMethod(c, name, m.fn, m.args); closeMethods(); });
      box.appendChild(b); });
    paintMcc(box, c, name, mccNow);
    // first tap of a Medium cut: fetch one shard; if this menu is still open, append buttons to #gmeth only (no scene re-render)
    mccEnsure(c, items => {
      if(M.cut !== c || M.el !== box || !items.length) return;
      box.querySelectorAll('[data-oldmeth]').forEach(el => el.remove());
      paintMcc(box, c, name, items);
    });
    overlayHost().appendChild(box); M.el = box;
    const r = c.el.getBoundingClientRect(), bw = box.offsetWidth, bh = box.offsetHeight, mid = toLocal(r.left + r.width / 2, r.bottom), top = toLocal(r.left + r.width / 2, r.top), vb = visBox();
    let x = Math.max(vb.l + bw / 2 + 6, Math.min(vb.l + vb.w - bw / 2 - 6, mid.x)), y = mid.y + 34;
    if(y + bh > vb.t + vb.h - 6) y = Math.max(vb.t + 6, top.y - bh - 8);
    box.style.left = x.toFixed(1) + 'px'; box.style.top = y.toFixed(1) + 'px';
    M.timer = setTimeout(closeMethods, 12000);
  }
  S.openMethods = openMethods;
  addEventListener('pointerdown', e => { if(M.el && !M.el.contains(e.target)) closeMethods(); const t = e.target; if(pinPop.el && !(t && t.closest && t.closest('#gpinpop'))) try{ closePinPop(); }catch(err){} }, {capture: true, passive: true}); // outside tap closes menus / pin popup
  addEventListener('keydown', e => { if(e.key === 'Escape'){ closeMethods(); try{ closePinPop(); }catch(err){} } });
  function lookOn(c, fn, args){ // the tapped cut only, through the same VERBS/FNS as typed commands
    const L = c.tapL || (c.tapL = {sk: 'tap:' + objName(c), name: objName(c), parts: {}, keys: {}, cast: false});
    let key = null, val = null;
    if(fn === 'setmood'){ key = 'mood'; val = args[0]; } else if(FNS[fn]){ key = FNS[fn][0]; val = (fn === 'glow' && args[0] != null) ? args[0] : FNS[fn][1]; }
    if(!key) return; const look = VERBS[key] ? VERBS[key](val) : null;
    L.keys[key] = {value: val, raw: fn, at: new Date().toISOString(), known: !!look}; if(look) L.parts[key] = look; else delete L.parts[key];
    paint(c, L); pulse(c); }
  const uid = ()=> { try{ if(root.crypto && crypto.randomUUID) return 'tap-' + crypto.randomUUID(); }catch(e){} return 'tap-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12); };
  async function fireMethod(c, name, fn, args, src){
    const code = name + '.' + fn + '(' + qstr(args) + ');', H = c.home || {}, eid = uid();
    const fr = (String(H.mid || '').match(/(?:^|[^A-Za-z0-9])([jw]\d{1,3})(?![0-9])/i) || [])[1];
    const body = {v: 1, type: 'call', event_id: eid, rid: eid + '-r', run: H.run || AG.active || null, card: String(H.card || fr || root.__thrydCard || '').toLowerCase() || null,
      object: name, fn, args, scene: H.mid ? String(H.mid).slice(0, 160) : null, cut: c.label ? String(c.label).slice(0, 60) : null, client_ts: new Date().toISOString()};
    if(src === 'intent') body.source = 'intent';
    if(body.run && !/^run-[0-9a-f]{4,6}$/.test(body.run)) body.run = null; if(body.card && !/^[jw]\d{1,3}$/.test(body.card)) body.card = null;
    const rec = {code, body, status: 'sending', at: Date.now()}; M.sent.push(rec); if(M.sent.length > 40) M.sent.shift();
    if(c.el && c.el.isConnected){ rec.prevLook = c.tapL ? JSON.parse(JSON.stringify({keys: c.tapL.keys, parts: c.tapL.parts})) : null; lookOn(c, fn, args); tagAt(c, code); }
    rec.sendPrefix = 'tapped';
    codeLine(code, 'tapped · sending…'); note('method', code, eid);
    return sendCall(rec, code, eid);
  }
  async function sendCall(rec, code, eid){
    const body = rec.body;
    const ctx = root.thrydCtx ? root.thrydCtx() : {}, toast = ctx.toast || (()=>{}), DG = ctx.DRAG;
    if(root.thrydQA && root.thrydQA.log){ try{ root.thrydQA.log({kind: 'methodCall', ...body}); }catch(e){} }
    if(root.thrydQA && root.thrydQA.on && root.thrydQA.on()){ rec.status = 'qa_not_sent'; toast(code + ' (QA: not sent)'); return rec; }
    const net = root.thrydNetFetch || ((u, o)=> fetch(u, o));
    const enqueue = root.thrydEnqueueCall;
    const post = root.thrydNtfyPost;
    if(body && body.source === 'cli' && root.thrydEnsureCli){ try{ await root.thrydEnsureCli(); }catch(e){} }
    const cliCfg = (body && body.source === 'cli') ? ((root.thrydCli && root.thrydCli()) || (ctx && ctx.CLI) || window.CLI || null) : null;
    let replyBase = (cliCfg && cliCfg.reply) || (DG && DG.reply);
    const prettyErr = err => prettySendErr(err);
    const paint = item => {
      if(item){ if(item.lastError) rec.lastError = item.lastError; if(item.status) rec.status = item.status; }
      try{ setSendNote(code, rec); }catch(e){}
      toast(code + ' · ' + prettyErr(item && item.lastError));
    };
    const statusToast = paint;
    try{
      rec.status = 'sending';
      try{ setSendNote(code, rec); }catch(e){}
      const t0 = Math.floor(Date.now() / 1000) - 5;
      let ok = false;
      // First attempt: same ntfy POST the working tap path uses (thrydNtfyPost / ntfySend).
      if(post){
        try{
          const r = await post(body, 'call');
          const nid = r && (r.ntfyId || (root.thrydParseNtfyId && root.thrydParseNtfyId(r.raw || '')));
          if(r && r.reply) replyBase = r.reply;
          if(r && r.ok && nid){ ok = true; rec.ntfyId = nid; rec.via = r.via || rec.via; }
          else {
            rec.status = 'queued';
            const why = r && r.ok ? 'ntfy 200 with no id' : (r ? ('HTTP ' + r.status) : 'no_response');
            rec.lastError = why;
            statusToast({lastError: why});
            if(!enqueue) throw new Error(why);
            const ra = r && r.retryAfter; let wait = 2000; if(ra){ const n = parseInt(ra, 10); wait = isFinite(n) ? Math.min(60000, Math.max(500, n * 1000)) : 2000; }
            const queued = await enqueue(body, {attempts: 1, nextAt: Date.now() + wait, lastError: why, onStatus: (s, item) => { rec.status = s; if(item && item.ntfyId) rec.ntfyId = item.ntfyId; if(s === 'retrying' || s === 'queued') statusToast(item); if(s === 'sent' && item && item.ntfyId){ rec.ntfyId = item.ntfyId; rec.lastError = null; try{ setSendNote(code, rec); }catch(e){} } }});
            if(queued && queued.ntfyId){ rec.ntfyId = queued.ntfyId; ok = true; }
            else if(rec.ntfyId) ok = true;
            else throw new Error(why);
          }
        }catch(e){
          rec.status = 'queued';
          const why = (root.thrydIsTimeout && root.thrydIsTimeout(e)) ? 'timed out' : String(e && e.message || e);
          rec.lastError = why;
          statusToast({lastError: why});
          if(!enqueue) throw e;
          const queued = await enqueue(body, {attempts: 1, nextAt: Date.now() + (why === 'timed out' ? 0 : 1500), lastError: why, onStatus: (s, item) => { rec.status = s; if(item && item.ntfyId) rec.ntfyId = item.ntfyId; if(s === 'retrying' || s === 'queued') statusToast(item); if(s === 'sent' && item && item.ntfyId){ rec.ntfyId = item.ntfyId; rec.lastError = null; try{ setSendNote(code, rec); }catch(e2){} } }});
          if(queued && queued.ntfyId){ rec.ntfyId = queued.ntfyId; ok = true; }
          else if(rec.ntfyId) ok = true;
          else throw new Error(why);
        }
      } else if(DG && DG.endpoint){
        // exact tap fallback: thrydNetFetch(DRAG.endpoint) — same as projector.js ntfySend ~811
        const r = await net(DG.endpoint, {method: 'POST', body: JSON.stringify(body)}, 20000, 'normal');
        const tx = r && r.text ? await r.text() : '';
        const nid = (root.thrydParseNtfyId && root.thrydParseNtfyId(tx)) || null;
        try{ root.thrydLogSend && root.thrydLogSend({branch:'drag_netfetch',ok:!!(r&&r.ok),status:r&&r.status,id:nid,event_id:body&&body.event_id}); }catch(e){}
        if(!r || !r.ok || !nid) throw new Error(r && r.ok ? 'ntfy 200 with no id' : (r ? ('HTTP ' + r.status) : 'ntfy_busy'));
        rec.ntfyId = nid; ok = true;
      } else if(enqueue){
        const queued = await enqueue(body, {onStatus: (s, item) => { rec.status = s; if(item && item.ntfyId) rec.ntfyId = item.ntfyId; if(s === 'retrying' || s === 'queued') statusToast(item); }});
        if(queued && queued.ntfyId){ rec.ntfyId = queued.ntfyId; ok = true; }
        else if(rec.ntfyId) ok = true;
        else throw new Error('not posted');
      } else {
        throw new Error('no_endpoint');
      }
      if(!ok || !rec.ntfyId) throw new Error(rec.lastError || 'not posted');
      rec.status = 'sent'; rec.lastError = null;
      try{ setSendNote(code, rec); }catch(e){}
      toast(code + ' \u00b7 sent \u2713 ' + rec.ntfyId);
      for(const w of [1500, 2500, 4000, 8000, 16000]){ await sleep(w);
        try{ const getter = root.thrydNtfyGet || net; const tx = await (await getter(replyBase + '/json?poll=1&since=' + t0, 8000)).text();
          for(const l of tx.split('\n')){ if(!l) continue; let m; try{ m = JSON.parse(l); m = JSON.parse(m.message || '{}'); }catch(e){ continue; }
            if(m.rid === body.rid || m.event_id === eid){ rec.status = m.status || (m.ok ? 'accepted' : 'rejected'); rec.reply = m;
              if(m.ok){ try{ thunderFx(rec, m); }catch(e){} toast((m.code || code) + ' ✓ in the db'); codeLine(m.resolved || m.code || code, 'tapped · in the world db' + (m.run ? ' · ' + m.run + (m.card ? '/' + m.card : '') : ''));
                if(m.resolved && TW){ const rv = TW.querySelector('.gtr'); if(rv) rv.textContent = m.resolved; }
                if(m.ripples && m.ripples.length) rec.loggedRipples = m.ripples;
                if(m.lock && m.lock.queued) toast((m.code || code) + ' \u2713 queued ' + (m.lock.waited_ms / 1000).toFixed(1) + 's behind ' + m.lock.held_by); }
              else toast(code + ' ✗ ' + (m.detail || m.reason || 'rejected'), 1);
              return rec; } } }catch(e){} }
      rec.status = 'no_reply'; try{ setSendNote(code, rec); }catch(e2){} toast(code + ' sent; no reply from the box yet', 1);
    }catch(e){ rec.status = 'failed'; rec.error = rec.lastError = (root.thrydIsTimeout && root.thrydIsTimeout(e)) ? 'timed out' : String(e && e.message || e); try{ setSendNote(code, rec); }catch(e2){} toast(code + ' · ' + prettySendErr(rec.error, true)); }
    return rec;
  }
  S.fireMethod = fireMethod;

  // ---------- black / white stage (Jesuye 12:03 AM "add a switch for black or white"; white default since 12:43 AM): a button beside mute/reset, saved per device
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
    // #code (Jesuye 12:59 AM): a see-through panel whose left edge fades into the page (transparent -> panel over the left ~38 %),
    // so cuts show through; the text carries a dark halo, readable on white and on black
    WS + ' #code,' + WS + '.idle #code{opacity:1!important;background:linear-gradient(90deg,rgba(10,10,10,0) 0%,rgba(10,10,10,.22) 18%,rgba(10,10,10,.42) 38%,rgba(10,10,10,.48) 100%)!important;border-radius:0!important;box-shadow:none!important;padding:1vh 1vw 1vh 3.2vw!important}',
    WS + ' #code,' + WS + ' #code *{text-shadow:0 0 2px #000,0 0 4px #000,0 0 7px #000d!important}',
    WS + ' #code .d{color:#9f9!important}',
    WS + ' #mvcarry{background:rgba(10,10,10,.86);padding:.4vh .6vw;border-radius:.6vh;text-shadow:none!important}',
    WS + ' #cmove{background:rgba(10,10,10,.86);color:#9cf!important;padding:0 .5vw;border-radius:.5vh;text-shadow:none!important;display:inline-block}',
    WS + ' #ticker,' + WS + ' #ticker *{text-shadow:0 0 4px #fff,0 0 8px #fff!important}',
    WS + ' #world{color:#8a4b00!important}',
    WS + ' #upd{color:#1a1a1a!important}',
    WS + ' #meta{color:#4a4a4a!important}',
    WS + ' #map .ph{color:#4a4a4a!important;text-shadow:0 0 3px #fff,0 0 6px #fff}',
    WS + ' #map .ph.here{color:#8a4b00!important}',
    WS + ' #zlvl{color:#333!important}',
    WS + ' #ents .chip{background:#1d1d1deb!important}', // chips keep a solid dark pill on white, so their own light label colours stay readable
    '@media (max-width:760px){body.stage1 #modes{max-width:100vw;overflow-x:auto;scrollbar-width:none}}', // phones: the bar scrolls so the black/white switch and + GIF are reachable
    'body.stage1:not(.stage-white) #code{background:linear-gradient(90deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.25) 18%,rgba(0,0,0,.5) 38%,rgba(0,0,0,.55) 100%)!important;padding-left:3.2vw!important;opacity:.92!important}',
    'body.stage1:not(.stage-white) #code,body.stage1:not(.stage-white) #code *{text-shadow:0 0 2px #000,0 0 5px #000!important}',
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
    // white is the default (Jesuye 11-13 12:43 AM). Only a click ever saved this key, so a stored 'black' is a deliberate choice and stays.
    setWhite(v !== 'black', false);
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
      while(activeStoryCuts().length > CAP - PER_GROUP && storyGroups().length){ const old = S.groups.filter(evictable).sort((a, b) => a.born - b.born)[0]; if(!old) break; exitGroup(old, false, 'show-on-stage'); }
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

  // ---------- small place pins (Jesuye 17 Nov 2026 8:48 PM ET): no map tiles on the
  // stage. Each agenda with a place in data/map_pins.json is one floating coloured
  // pin (~40px) plus a tiny place label, like the other small chips. The live
  // agenda's pin pulses. The marker itself is 📍 plus the place's weather emoji
  // (📍🌙, 📍🌧️), always visible, nothing on hover. Tap opens a small popup
  // (place, run, jN, optional temperature · condition, static OSM preview).
  // Leaflet is never mounted on the stage. Bad pin data never throws.
  const PIN_W = 40, PIN_H = 40;
  function readPinFile(d){
    if(!d || typeof d !== 'object') return null;
    const pins = (Array.isArray(d.pins) ? d.pins : []).filter(p => p && p.run && isFinite(+p.lat) && isFinite(+p.lon) && Math.abs(+p.lat) <= 90 && Math.abs(+p.lon) <= 180);
    const runs = (Array.isArray(d.runs) ? d.runs : []).filter(r => r && r.run);
    return {v: d.v, sig: d.sig, active_run: d.active_run || null, pins, runs, unresolved: Array.isArray(d.unresolved) ? d.unresolved : []};
  }
  function loadMapPins(){
    return fetch('data/map_pins.json?t=' + Date.now(), {cache: 'no-store'}).then(r => r.ok ? r.json() : null).then(d => {
      const parsed = readPinFile(d);
      if(parsed && parsed.pins.length) S.mapData = parsed;
      else if(parsed && !S.mapData) S.mapData = parsed;
      return S.mapData || {pins: [], runs: [], sig: '', active_run: null};
    }).catch(()=> S.mapData || {pins: [], runs: [], sig: '', active_run: null});
  }
  function osmTile(lat, lon, z){
    z = z || 11;
    const n = 1 << z, rad = lat * Math.PI / 180;
    const xt = (lon + 180) / 360 * n;
    const yt = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n;
    const x = Math.floor(xt), y = Math.max(0, Math.min(n - 1, Math.floor(yt)));
    return {url: 'https://tile.openstreetmap.org/' + z + '/' + ((x % n) + n) % n + '/' + y + '.png', fx: xt - Math.floor(xt), fy: yt - Math.floor(yt), z: z};
  }
  function runShort(run){ return String(run || '').replace(/^run-/, '') || 'run'; }
  function pinLabel(pin){
    const s = String((pin && (pin.place || pin.city)) || runShort(pin && pin.run) || '').trim();
    return s.length > 14 ? s.slice(0, 13) + '\u2026' : s;
  }
  let pinPop = {el: null, cut: null, t: 0};
  function closePinPop(){
    if(pinPop.t){ clearTimeout(pinPop.t); pinPop.t = 0; }
    if(pinPop.el){ try{ pinPop.el.remove(); }catch(e){} pinPop.el = null; }
    pinPop.cut = null;
  }
  function wxOf(pin){
    const w = pin && pin.weather;
    if(!w || !w.emoji) return null;
    const emoji = String(w.emoji);
    const temp = (w.temp_c != null && isFinite(+w.temp_c)) ? (Math.round(+w.temp_c * 10) / 10) : null;
    const desc = (w.desc && String(w.desc).trim()) || '';
    const line = [temp != null ? (temp + '\u00b0C') : '', desc].filter(Boolean).join(' \u00b7 ');
    return {emoji, temp, desc, line};
  }
  function wxPaint(cut){
    if(!cut || !cut.el) return;
    const pin = cut.pin;
    const w = wxOf(pin);
    const mark = cut.el.querySelector('.gmappin');
    const icon = '\uD83D\uDCCD' + (w && w.emoji ? w.emoji : '');
    cut.el.classList.toggle('gwx', !!w);
    if(mark){
      mark.style.background = 'transparent';
      if(mark.textContent !== icon) mark.textContent = icon;
    }
    // Jesuye 19 Nov 1:03 PM ET: marker itself is the weather; nothing on hover
    cut.el.removeAttribute('title');
    cut.el.setAttribute('aria-label', [icon, (pin && pin.place) || 'pin', runShort(pin && pin.run)].filter(Boolean).join(' '));
  }
  root.thrydWeather = ()=>{
    const pins = [...document.querySelectorAll('#gstage .gcut.gpin')].map(el => {
      const mark = el.querySelector('.gmappin');
      const r = mark && mark.getBoundingClientRect();
      const lab = el.querySelector('.gpin-lab');
      const icon = mark ? String(mark.textContent || '') : '';
      const shown = !!(mark && r && r.width > 0 && r.height > 0 && /^\uD83D\uDCCD\S/u.test(icon) && getComputedStyle(mark).visibility !== 'hidden' && getComputedStyle(mark).display !== 'none');
      return {run: el.dataset.run || '', place: lab ? lab.textContent : '', emoji: icon, shown, title: el.getAttribute('title') || '', w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height};
    });
    return {n: pins.length, shown: pins.filter(p => p.shown).length, pins};
  };
  function showPinPop(cut){
    closePinPop();
    const pin = cut && cut.pin; if(!pin || !cut.el || !cut.el.isConnected) return;
    const box = document.createElement('div'); box.id = 'gpinpop'; box.setAttribute('role', 'dialog');
    const name = document.createElement('div'); name.className = 'gpin-name'; name.textContent = pin.place || 'place'; box.appendChild(name);
    const meta = document.createElement('div'); meta.className = 'gpin-meta';
    meta.textContent = [pin.run, pin.job || pin.card, pin.time || pin.beat].filter(Boolean).join(' \u00b7 ');
    box.appendChild(meta);
    const w = wxOf(pin);
    if(w && w.line){ const wl = document.createElement('div'); wl.className = 'gpin-wxl'; wl.textContent = w.line; box.appendChild(wl); }
    try{
      const t = osmTile(+pin.lat, +pin.lon, 12);
      const prev = document.createElement('div'); prev.className = 'gpin-prev';
      const img = document.createElement('img'); img.alt = ''; img.draggable = false; img.src = t.url;
      const mk = document.createElement('div'); mk.className = 'gmappin' + (pin.live ? ' live' : ''); mk.style.background = pin.color || '#e85d4c';
      mk.style.left = (t.fx * 100) + '%'; mk.style.top = (t.fy * 100) + '%';
      prev.appendChild(img); prev.appendChild(mk);
      const attr = document.createElement('div'); attr.className = 'gpin-attr'; attr.textContent = '\u00a9 OSM';
      prev.appendChild(attr);
      box.appendChild(prev);
    }catch(e){}
    overlayHost().appendChild(box); pinPop.el = box; pinPop.cut = cut;
    try{
      const r = cut.el.getBoundingClientRect(), bw = box.offsetWidth || 180, bh = box.offsetHeight || 160, mid = toLocal(r.left + r.width / 2, r.bottom), vb = visBox();
      let x = Math.max(vb.l + bw / 2 + 6, Math.min(vb.l + vb.w - bw / 2 - 6, mid.x)), y = mid.y + 10;
      if(y + bh > vb.t + vb.h - 6) y = Math.max(vb.t + 6, toLocal(r.left + r.width / 2, r.top).y - bh - 8);
      box.style.left = x.toFixed(1) + 'px'; box.style.top = y.toFixed(1) + 'px';
    }catch(e){}
    pinPop.t = setTimeout(closePinPop, 8000);
  }
  function paintPin(cut, pin){
    if(!cut || !cut.el || !pin) return;
    const mark = cut.el.querySelector('.gmappin');
    if(mark){ mark.style.background = 'transparent'; mark.classList.toggle('live', !!pin.live); }
    const lab = cut.el.querySelector('.gpin-lab');
    if(lab) lab.textContent = pinLabel(pin);
    cut.el.classList.toggle('gmap-live', !!pin.live);
    cut.el.dataset.run = pin.run || '';
    cut.el.removeAttribute('title');
    cut.pin = pin; cut.label = pin.place || 'pin';
    if(cut.g){ cut.g.live = !!pin.live; cut.g.place = pin.place; cut.g.card = pin.card || pin.job || null; cut.g.title = pinLabel(pin); }
    cut.el.style.setProperty('--pin', pin.color || '#f0c14b');
    try{ wxPaint(cut); }catch(e){}
  }
  function spawnOnePin(pin, slot){
    if(!pin || !pin.run) return null;
    if(S.groups.some(g => g.map && !g.gone && g.run === pin.run)) return null;
    const Dw = PIN_W, Dh = PIN_H;
    const pos = slot || placeGroup(Dw, Dh);
    const g = {mid: 'pin:' + pin.run, kind: 'pin', map: true, x: pos.gx, y: pos.gy, w: Dw, h: Dh, k: 1, fw: Dw, fh: Dh,
      title: pinLabel(pin), agenda: false, live: !!pin.live, run: pin.run, card: pin.card || pin.job || null,
      born: Date.now(), life: 24 * 3600 * 1000, cuts: [], gone: false, offSince: 0, sha: '', ver: '1', place: pin.place || null, fresh: false, newest: false};
    const el = document.createElement('div');
    el.className = 'gcut gmap gpin' + (pin.live ? ' gmap-live' : '') + (RM ? '' : ' fl');
    el.dataset.kind = 'pin'; el.dataset.run = pin.run;
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', (pin.place || 'pin') + ' ' + runShort(pin.run));
    el.style.setProperty('--pin', pin.color || '#f0c14b');
    el.removeAttribute('title');
    const mark = document.createElement('div'); mark.className = 'gmappin' + (pin.live ? ' live' : ''); mark.dataset.marker = '1';
    mark.style.background = 'transparent';
    const lab = document.createElement('div'); lab.className = 'gpin-lab'; lab.textContent = pinLabel(pin);
    el.appendChild(mark); el.appendChild(lab);
    const cut = {ctx: null, sid: null, g, home: g, el, frames: [], label: pin.place || 'pin', klass: 'pin', i: 0,
      U: {x: 0, y: 0, w: Dw, h: Dh}, w: Dw, h: Dh, hx: g.x, hy: g.y, entering: true, bytes: 0, area: 0.08,
      map: true, pin: pin};
    try{ wxPaint(cut); }catch(e){}
    cut.left = cut.hx; cut.top = cut.hy;
    Object.assign(el.style, {left: cut.left + 'px', top: cut.top + 'px', width: cut.w + 'px', height: cut.h + 'px', zIndex: String((pin.live ? 16 : 10) + Math.round(g.y))});
    el.style.setProperty('--fd', (R(5.5, 9)).toFixed(2) + 's'); el.style.setProperty('--fdl', (-R(0, 6)).toFixed(2) + 's');
    bindDrag(cut);
    S.cuts.push(cut); g.cuts.push(cut); // pin: bytes stay 0; not added to S.bytes / BUDGET
    const v = view();
    const ang = g.inAng = Math.random() * Math.PI * 2;
    const off = offTo(cut.left - v.x, cut.top - v.y, cut.w, cut.h, v, ang + Math.PI);
    el.style.opacity = '0';
    if(!RM){ el.style.transition = 'none'; el.style.translate = off[0].toFixed(0) + 'px ' + off[1].toFixed(0) + 'px'; }
    cutsL.appendChild(el);
    const dur = RM ? 1.2 : R(3.5, 6.5), delay = 40 + Math.random() * 400;
    setTimeout(()=>{
      el.style.transition = RM ? 'opacity 1s' : 'translate ' + dur.toFixed(2) + 's cubic-bezier(.22,.1,.25,1), opacity 1.1s';
      requestAnimationFrame(()=>{ el.style.opacity = '1'; if(!RM) el.style.translate = '0px 0px'; });
      setTimeout(()=>{ cut.entering = false; if(!cut.wan){ el.style.transition = ''; el.style.translate = ''; } }, dur * 1000 + 100);
    }, delay);
    S.groups.push(g); S.spawned++;
    return g;
  }
  function pinSlots(n){
    const slots = [], padX = Math.max(16, vw() * 0.05), padY = Math.max(28, vh() * 0.1);
    const ww = (W.w || vw()), wh = (W.h || vh());
    const cols = Math.max(4, Math.ceil(Math.sqrt(n * 1.8)));
    const rows = Math.max(2, Math.ceil(n / cols));
    const used = [];
    for(let i = 0; i < n; i++){
      const c = i % cols, r = (i / cols | 0);
      let gx = padX + (c + 0.3 + (i % 3) * 0.15) / cols * (ww - PIN_W - padX * 2);
      let gy = padY + (r + 0.25 + ((i * 3) % 5) * 0.1) / rows * (wh - PIN_H - padY * 2);
      gx = Math.max(0, Math.min(ww - PIN_W, gx));
      gy = Math.max(0, Math.min(wh - PIN_H, gy));
      used.forEach(u => { if(Math.hypot(gx - u.gx, gy - u.gy) < 56){ gx = Math.min(ww - PIN_W, gx + 48); gy = Math.min(wh - PIN_H, gy + 28); } });
      const s = {gx, gy}; used.push(s); slots.push(s);
    }
    return slots;
  }
  function syncMaps(data){
    data = data || S.mapData || {pins: []};
    const pins = (data.pins || []).filter(p => p && p.run && isFinite(+p.lat) && isFinite(+p.lon));
    const want = new Map(pins.map(p => [p.run, p]));
    S.groups.slice().forEach(g => {
      if(!g.map || g.gone) return;
      const pin = want.get(g.run);
      if(!pin){ try{ exitGroup(g, false, 'pin-sync'); }catch(e){} return; }
      const cut = g.cuts[0];
      if(cut) paintPin(cut, pin);
      want.delete(g.run);
    });
    const missing = pins.filter(p => want.has(p.run));
    const slots = pinSlots(Math.max(missing.length, pins.length));
    missing.forEach((p, i) => { try{ spawnOnePin(p, slots[i] || placeGroup(PIN_W, PIN_H)); }catch(e){ note('pin spawn', String(e && e.message || e)); } });
    note('pins', pins.length + ' agendas');
  }
  function bootMap(){
    if(S._mapBooting) return S._mapBooting;
    S._mapBooting = loadMapPins().then(d => { S._mapBooting = null; try{ syncMaps(d); }catch(e){ note('pin boot', String(e && e.message || e)); } }).catch(e => { S._mapBooting = null; note('pin boot', String(e && e.message || e)); try{ syncMaps(S.mapData || {pins: []}); }catch(err){} });
    return S._mapBooting;
  }
  function pollMapPins(){
    loadMapPins().then(d => { try{ syncMaps(d); }catch(e){} }).catch(()=>{});
  }
  S.bootMap = bootMap; S.syncMaps = syncMaps; S.showPinPop = showPinPop; S.closePinPop = closePinPop;

  bootMap(); setInterval(pollMapPins, 45000);

  pollLiveViews(); setInterval(pollLiveViews, LIVE_POLL_MS);
  MC.loadManifest().then(m => { manifest = m || {assets: []}; note('manifest', (manifest.assets || []).length + ' assets'); spawner();
    let q = S.pendingLib; try{ q = q || new URLSearchParams(location.search).get('mlib'); }catch(e){} if(q) showOnStage(String(q).trim()); })
    .catch(()=>{ manifest = {assets: []}; note('manifest failed, retrying'); spawner(); // (was: the spawner never started)
      const again = ()=> MC.loadManifest().then(m => { if(m && (m.assets || []).length){ manifest = m; note('manifest', m.assets.length + ' assets'); } else setTimeout(again, 60000); }).catch(()=> setTimeout(again, 60000));
      setTimeout(again, 30000); });
  root.ThrydStage = S;
})(typeof window !== 'undefined' ? window : globalThis);
