// v605 (Jesuye 3:01 PM "make the djinee moving less flashy but still smooth"): one soft thin double trail, a few faint
// sparkles, a brief soft glow instead of the rayed flash, no additive blending, slower smooth easing; cadence unchanged.
// genie return (Jesuye 21 Nov 2026 2:10 PM ET: "sometimes the objects go back inside its background like how the djinee goes back
// into its lamp. make it flamboyant and dont break anything"; 2:11 PM "only for the projector"; 2:12 PM "anytime, to any object").
// 2:16 PM "an object can slip into ANY other background". Every several seconds one visible object (stage cut, slideshow run-view
// cut-out or Medium cut) shrinks and spirals in a swirling smoke trail with sparkles in its agenda colour into a DIFFERENT background
// on screen (another story's faded frame on the stage), a glow flash where it vanishes, a small ember while it is inside, then it
// bursts back out of yet another background and flies home to where its spot is now. Only a few are away at once so the screen never empties.
// Pure overlay: the object is hidden with one class (visibility) and drawn as a copy on a pointer-events:none canvas; no positions,
// drags, offsets, timers or frames of the other scripts are changed. Hidden objects ignore pointer input until they return.
// Off: ?genie=0, localStorage thryd_genie=0, data/genie.json {"on":false}, prefers-reduced-motion, phone.html.
(function(root){
  'use strict';
  if(typeof document === 'undefined' || root.__thrydGenie) return;
  const Q = location.search || '';
  const PHONE = /phone\.html$/.test(location.pathname);
  let lsOff = false; try{ lsOff = localStorage.getItem('thryd_genie') === '0'; }catch(e){}
  const RM = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const FAST = /(?:^|[?&])genie=fast(?:&|$)/.test(Q);
  const FORCED = FAST || /(?:^|[?&])genie=1(?:&|$)/.test(Q);
  if(PHONE || /(?:^|[?&])genie=0(?:&|$)/.test(Q) || (!FORCED && (lsOff || RM))) { root.__thrydGenie = {on:false}; return; }

  const CFG = {on: true, every_s: [7, 15], away_s: [8, 18], max_away: 2, min_visible: 2};
  if(FAST){ CFG.every_s = [2, 3.5]; CFG.away_s = [4, 6]; CFG.min_visible = 1; }
  const G = root.__thrydGenie = {on: true, cfg: CFG, away: [], anims: 0, count: {in: 0, out: 0}, last: null};

  const css = document.createElement('style'); css.id = 'genie-css';
  css.textContent = [
    '.genie-in{visibility:hidden!important;pointer-events:none!important}',
    '#objs .ob.genie-in .spw{visibility:hidden!important}',
    '#objs .ob.genie-in .patch{visibility:visible!important}',
    '#objs .dpatch.genie-hole{opacity:1!important}',
    'canvas.genie-fx{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:2147483000}',
    '.genie-ember{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;pointer-events:none;z-index:2147482999;',
    'background:radial-gradient(circle,var(--gc,#ffd27a) 0,transparent 70%);animation:genieEmber 3.2s ease-in-out infinite}',
    '@keyframes genieEmber{0%,100%{opacity:.12;transform:scale(.7)}50%{opacity:.4;transform:scale(1.1)}}'
  ].join('\n');
  document.head.appendChild(css);

  const R = (a, b) => a + Math.random() * (b - a);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const easeIn = t => t * t * t * (t * (t * 6 - 15) + 10); // smootherstep: slow start, slow finish
  const easeOutBack = t => t * t * t * (t * (t * 6 - 15) + 10); // v605: no overshoot pop, same smootherstep
  function hexRgb(h){ h = String(h || '').trim(); const m = h.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i); if(!m) return null; let s = m[1]; if(s.length === 3) s = s.split('').map(c => c + c).join('');
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]; }
  function hueRgb(key){ let h = 0; key = String(key || 'thryd'); for(let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    const H = (h % 360) / 60, C = 0.85, X = C * (1 - Math.abs(H % 2 - 1)), L = 0.6 - C / 2; const t = [[C,X,0],[X,C,0],[0,C,X],[0,X,C],[X,0,C],[C,0,X]][Math.floor(H) % 6];
    return t.map(v => Math.round((v + L) * 255)); }
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')';
  const lighten = (c, k) => c.map(v => Math.round(v + (255 - v) * k));
  const darken = (c, k) => c.map(v => Math.round(v * (1 - k)));
  // white stage: additive glow vanishes on white, so draw normally with deeper tones there
  const WHITE = () => !!(document.body && document.body.classList.contains('stage-white') && document.body.classList.contains('stage1'));
  const GLOW = () => 'source-over'; // v605: never additive
  const WHITE_RGB = () => WHITE() ? [70, 40, 140] : [255, 255, 255];

  function paused(){ const b = document.body && document.body.classList; if(!b) return true;
    return document.hidden || b.contains('dragmode') || b.contains('cm-paused') || b.contains('cerebro') || b.contains('lovemap') ||
      !!document.querySelector('[data-dragging="1"],#objs .dob.lifting,#objs .dob[data-held="1"]'); }
  function visibleRect(el){ const r = el.getBoundingClientRect(); if(r.width < 14 || r.height < 14) return null;
    const W = innerWidth, H = innerHeight; if(r.right < 8 || r.bottom < 8 || r.left > W - 8 || r.top > H - 8) return null;
    const cs = getComputedStyle(el); if(cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.6) return null; return r; }
  function isAway(el){ return G.away.some(a => a.el === el); }

  // candidates: [{kind, el, draw, colour, host, ...}]
  function candidates(){
    const out = [];
    const S = root.__thrydStage, gs = document.getElementById('gstage');
    if(S && gs && document.body.classList.contains('stage1') && !document.body.classList.contains('stage-replay')){
      (S.cuts || []).forEach(c => {
        const el = c.el; if(!el || !el.isConnected || isAway(el) || el.tagName !== 'CANVAS') return;
        if(c.entering || c.leaving || c.dragging || c.wan || !c.g || c.g.gone || el.dataset.dragging === '1') return;
        const r = visibleRect(el); if(!r) return;
        const col = (c.g.colour && (c.g.colour.hex || c.g.colour)) || (c.g.row && (c.g.row.colour && (c.g.row.colour.hex || c.g.row.colour) || c.g.row.color)) || null;
        out.push({kind: 'stage', el, draw: el, host: gs, colour: hexRgb(col) || hueRgb(c.g.run || c.g.mid), cut: c});
      });
    }
    const L = [...document.querySelectorAll('#objs.on')].filter(n => !n.classList.contains('gone')).pop();
    if(L && L.offsetParent !== null){
      L.querySelectorAll('.ob:not(.dpatch):not(.anchor):not([data-dp]):not(.lifting):not(.cm-fly):not(.cm-out):not(.offscene):not(.genie-in)').forEach(b => {
        const spw = b.querySelector('.spw'), sp = b.querySelector('img.sp'); if(!spw || !sp || isAway(b) || spw.classList.contains('offstage')) return;
        if(!sp.complete || !sp.naturalWidth) return; const r = visibleRect(sp); if(!r) return;
        let run = ''; try{ run = (root.thrydDebug && root.thrydDebug().run) || ''; }catch(e){}
        out.push({kind: 'objs', el: b, draw: sp, host: L.parentNode, colour: hueRgb(run || L.dataset.key)});
      });
    }
    const M = document.getElementById('mcut');
    if(M && M.offsetParent !== null){
      M.querySelectorAll('canvas.sprite').forEach(c => { const i = +c.dataset.i; if(isAway(c) || c.dataset.dragging === '1') return;
        if((M._gone && M._gone[i]) || (M._wan && M._wan[i]) || M.classList.contains('dragging')) return; const r = visibleRect(c); if(!r) return;
        out.push({kind: 'mcut', el: c, draw: c, host: M.parentNode, colour: hueRgb(M._mid || 'medium'), layer: M, i}); });
    }
    return out;
  }

  // ---------- one shared fx canvas per host, alive only while something animates
  let fx = null, fxHost = null, raf = 0; const effects = []; const embers = new Set();
  function ensureFx(host){
    if(fx && fxHost === host && fx.isConnected) return fx;
    if(fx) fx.remove();
    fx = document.createElement('canvas'); fx.className = 'genie-fx'; fxHost = host; host.appendChild(fx); sizeFx(); return fx; }
  function sizeFx(){ if(!fx) return; const r = fxHost.getBoundingClientRect(), d = Math.min(1.5, root.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d)); if(fx.width !== w || fx.height !== h){ fx.width = w; fx.height = h; } fx._d = d; fx._r = r; }
  function startLoop(){ if(!raf) raf = requestAnimationFrame(tick); }
  function tick(now){
    raf = 0; if(!fx || !fx.isConnected){ effects.length = 0; return; }
    sizeFx(); const g = fx.getContext('2d'), d = fx._d, hr = fx._r;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, fx.width, fx.height); g.setTransform(d, 0, 0, d, -hr.left * d, -hr.top * d);
    for(let i = effects.length - 1; i >= 0; i--){ const e = effects[i]; let alive = false; try{ alive = e.step(g, now); }catch(err){ alive = false; try{ e.done && e.done(); }catch(e2){} } if(!alive) effects.splice(i, 1); }
    if(effects.length) startLoop(); else { fx.remove(); fx = null; fxHost = null; }
  }

  // particles shared by the in/out effects
  function Particles(){ return []; }
  function puff(P, x, y, col, n, spread, swirl){ for(let k = 0; k < n; k++){ const a = R(0, Math.PI * 2), v = R(.2, 1) * spread;
    P.push({t: 'smoke', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - R(0, .4), r: R(4, 10), gr: R(.25, .6), life: R(700, 1300), age: 0, col: Math.random() < .35 ? (WHITE() ? darken(col, .35) : [255, 255, 255]) : col, sw: swirl || 0}); } }
  function sparkle(P, x, y, col, n, spread){ for(let k = 0; k < n; k++){ const a = R(0, Math.PI * 2), v = R(.6, 1.6) * spread;
    const W = WHITE(), c = Math.random() < .3 ? (W ? [214, 150, 20] : [255, 236, 170]) : (Math.random() < .3 ? WHITE_RGB() : (W ? darken(col, R(0, .3)) : lighten(col, R(0, .35))));
    P.push({t: 'spark', x, y, vx: Math.cos(a) * v * .6, vy: Math.sin(a) * v * .6, r: R(1.5, 3.2), life: R(500, 1100), age: 0, col: c, rot: R(0, 6.3), tw: R(8, 16)}); } }
  function drawParticles(g, P, dt){
    for(let k = P.length - 1; k >= 0; k--){ const p = P[k]; p.age += dt; if(p.age >= p.life){ P.splice(k, 1); continue; }
      const f = p.age / p.life, s = dt / 16.7;
      if(p.sw){ const vx = p.vx; p.vx += -p.vy * p.sw * .02 * s; p.vy += vx * p.sw * .02 * s; }
      p.x += p.vx * s; p.y += p.vy * s; p.vx *= Math.pow(.97, s); p.vy *= Math.pow(.97, s);
      if(p.t === 'smoke'){ const r = p.r * (1 + f * 3.2 * p.gr * 3); const a = .14 * (1 - f) * Math.min(1, f * 6);
        const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); gr.addColorStop(0, rgba(p.col, a)); gr.addColorStop(1, rgba(p.col, 0));
        g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r, 0, 6.2832); g.fill(); }
      else { const a = .45 * (1 - f) * (.6 + .4 * Math.sin(p.age / 1000 * p.tw * 3.14)); const r = p.r * (1 - f * .5); star(g, p.x, p.y, r, p.rot + f * 2, rgba(p.col, clamp(a, 0, 1))); }
    } }
  function star(g, x, y, r, rot, fill){ g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = fill; g.beginPath();
    for(let k = 0; k < 8; k++){ const rr = k % 2 ? r * .22 : r, a = k * Math.PI / 4; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); g.restore(); }
  function flash(g, x, y, col, f, big){ // v605: a brief soft glow, no ring, no rays
    const a = Math.sin(Math.PI * clamp(f, 0, 1)) * .28, R0 = big * (.35 + f * .45);
    g.save(); const gr = g.createRadialGradient(x, y, 0, x, y, R0);
    gr.addColorStop(0, rgba(lighten(col, .45), a)); gr.addColorStop(.5, rgba(col, a * .45)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, R0, 0, 6.2832); g.fill(); g.restore(); }
  function trail(g, H, col, w0){ // v605: two thin soft strands, low opacity
    if(H.length < 3) return; g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; const W = WHITE();
    for(let s = 0; s < 2; s++){ const ph = s * 2.6;
      g.beginPath();
      for(let k = 0; k < H.length; k++){ const f = k / H.length, off = Math.sin(k * .3 + ph) * w0 * .12 * (1 - f);
        if(k === 0) g.moveTo(H[k].x + off, H[k].y - off); else g.lineTo(H[k].x + off, H[k].y - off); }
      const end = H[H.length - 1], st = H[0], gr = g.createLinearGradient(st.x, st.y, end.x, end.y);
      const c = W ? darken(col, .1) : lighten(col, .25); gr.addColorStop(0, rgba(c, 0)); gr.addColorStop(1, rgba(c, s ? .16 : .24));
      g.strokeStyle = gr; g.lineWidth = Math.max(1, w0 * (s ? .1 : .16)); g.stroke(); }
    g.restore(); }

  function vanishPoint(r){ return {x: r.left + r.width * .5, y: r.top + r.height * .78}; }
  // backgrounds an object can slip into: any OTHER story's faded frame on the stage (visible first), else the slide backdrop /
  // Medium plate; a point well inside it (fx, fy fractions) so it follows camera drift. Never the object's own spot.
  function onScreen(r){ return r.width > 20 && r.height > 20 && r.right > 30 && r.bottom > 30 && r.left < innerWidth - 30 && r.top < innerHeight - 30; }
  function bgTarget(c, avoid){
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const S = root.__thrydStage;
    if(c.kind === 'stage' && S){
      // every other story group on the stage is a background (its faded frame when it has one, else the frame's own box)
      const all = (S.groups || []).filter(g => !g.gone && !g.map && g !== (c.cut && c.cut.g) && !(avoid && (avoid === g || avoid === g.bgEl)) && (g.cuts || []).some(k => k.el && k.el.isConnected));
      const vis = all.filter(g => onScreen(groupRect(g)));
      const g = vis.length ? pick(vis) : null;
      if(g) return {g, el: (g.bgEl && g.bgEl.isConnected) ? g.bgEl : null, fx: R(.3, .7), fy: R(.3, .7), colour: hexRgb(g.colour && (g.colour.hex || g.colour)) || null};
      const own = c.cut && c.cut.g; // only one story on screen: its own frame, away from the object
      if(own && own !== avoid) return {g: own, el: null, fx: R(.2, .8), fy: R(.2, .8)};
      return null;
    }
    const bgs = [...document.querySelectorAll('#stage > img.on, #mcut canvas.plate')].filter(n => n !== avoid && onScreen(n.getBoundingClientRect()));
    if(!bgs.length) return null;
    // a spot of the backdrop away from the object itself
    const r = c.el.getBoundingClientRect(), el = pick(bgs), br = el.getBoundingClientRect(); let fx = .5, fy = .5;
    for(let k = 0; k < 8; k++){ fx = R(.15, .85); fy = R(.2, .8); const x = br.left + br.width * fx, y = br.top + br.height * fy;
      if(Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) > Math.max(r.width, r.height) * .9) break; }
    return {el, fx, fy};
  }
  // a stage group's frame box on screen: its faded frame when mounted, else g.x/y/w/h through the #gworld camera transform
  function groupRect(g){
    if(g.bgEl && g.bgEl.isConnected){ const r = g.bgEl.getBoundingClientRect(); if(r.width > 2) return r; }
    const w = document.getElementById('gworld'); if(!w || !isFinite(g.x) || !isFinite(g.w)) return {left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0};
    let M; try{ M = new DOMMatrix(getComputedStyle(w).transform === 'none' ? undefined : getComputedStyle(w).transform); }catch(e){ M = new DOMMatrix(); }
    const o = w.parentNode.getBoundingClientRect(), a = M.transformPoint(new DOMPoint(g.x, g.y)), b = M.transformPoint(new DOMPoint(g.x + g.w, g.y + g.h));
    const left = o.left + Math.min(a.x, b.x), top = o.top + Math.min(a.y, b.y), width = Math.abs(b.x - a.x), height = Math.abs(b.y - a.y);
    return {left, top, width, height, right: left + width, bottom: top + height}; }
  function tPoint(t, fallback){ if(!t) return fallback; let r;
    if(t.g){ if(t.g.gone) return fallback; r = groupRect(t.g); }
    else { if(!t.el || !t.el.isConnected) return fallback; r = t.el.getBoundingClientRect(); }
    if(!r || r.width < 2) return fallback; return {x: r.left + r.width * t.fx, y: r.top + r.height * t.fy}; }

  function hide(c, on){
    c.el.classList.toggle('genie-in', on);
    if(c.kind === 'objs'){ const L = c.el.parentNode; const q = L && L.querySelector('.dpatch[data-label="' + (root.CSS && CSS.escape ? CSS.escape(c.el.dataset.label || '') : '') + '"]'); if(q) q.classList.toggle('genie-hole', on); }
    if(c.kind === 'mcut' && c.layer){ c.layer._gone = c.layer._gone || []; if(on){ c.prevGone = !!c.layer._gone[c.i]; c.layer._gone[c.i] = true; } else c.layer._gone[c.i] = !!c.prevGone; }
  }

  function boxOf(c){ return (c.el === c.draw ? c.el : c.draw).getBoundingClientRect(); }
  // swirl path from A to B: eased straight line plus a widening-then-closing spiral around it
  function swirlAt(A, B, p, turns, amp, phase){ const x = A.x + (B.x - A.x) * p, y = A.y + (B.y - A.y) * p;
    const th = phase + turns * 6.2832 * p, rad = amp * Math.sin(Math.PI * Math.min(1, p)) * (1 - .55 * p);
    return {x: x + Math.cos(th) * rad, y: y + Math.sin(th) * rad * .75, th}; }

  function goIn(c){
    const r0 = boxOf(c); const tgt = bgTarget(c, null); if(!tgt) return false;
    ensureFx(c.host); const snap = snapshot(c.draw); if(!snap) return false;
    c.tgt = tgt; c.colour = c.colour || tgt.colour || [255, 210, 120];
    hide(c, true); G.away.push(c); G.anims++; G.count.in++;
    G.last = {dir: 'in', kind: c.kind, at: Date.now(), label: (c.cut && c.cut.label) || (c.el.dataset && c.el.dataset.label) || '', into: tgt.g ? ('group ' + (tgt.g.title || tgt.g.mid || '')).slice(0, 60) : (tgt.el.className || tgt.el.tagName), own: !!(c.cut && tgt.g && c.cut.g === tgt.g)};
    const C0 = {x: r0.left + r0.width / 2, y: r0.top + r0.height / 2}, big = Math.max(r0.width, r0.height);
    const dur = R(3000, 3600), turns = R(1.6, 2.4) * (Math.random() < .5 ? -1 : 1), ph = R(0, 6.28), amp = Math.max(40, big * .55);
    const P = Particles(), H = []; let t0 = 0, last = 0, flashAt = 0, V = tPoint(tgt, vanishPoint(r0));
    effects.push({step(g, now){
      if(!t0){ t0 = now; last = now; puff(P, C0.x, C0.y, c.colour, 3, .8, 1); }
      const dt = Math.min(50, now - last); last = now; const e = (now - t0) / dur;
      V = tPoint(tgt, V); // follows the target background as the camera drifts
      if(e < 1){
        const p = easeIn(clamp(e, 0, 1)), pt = swirlAt(C0, V, p, turns, amp, ph), x = pt.x, y = pt.y;
        const s = Math.pow(1 - p, 1.2), sx = s * (1 - .1 * Math.sin(Math.PI * p)), sy = s * (1 + .12 * Math.sin(Math.PI * p));
        H.push({x, y}); if(H.length > 52) H.shift();
        trail(g, H, c.colour, big * .3 * s + 6);
        if(Math.random() < .25) puff(P, x, y, c.colour, 1, .7, turns > 0 ? 1 : -1);
        if(Math.random() < .08) sparkle(P, x, y, c.colour, 1, .8);
        drawParticles(g, P, dt);
        if(s > .015){ g.save(); g.translate(x, y); g.rotate((pt.th - ph) * .22); g.scale(sx, sy); g.globalAlpha = clamp(1.2 - p, 0, 1);
          g.shadowColor = rgba(c.colour, .35); g.shadowBlur = 8 * p + 2;
          g.drawImage(snap, -r0.width / 2, -r0.height / 2, r0.width, r0.height); g.restore(); }
        return true;
      }
      if(!flashAt){ flashAt = now; sparkle(P, V.x, V.y, c.colour, 3, .9); puff(P, V.x, V.y, c.colour, 3, .8, 1); ember(c, true); }
      const f = (now - flashAt) / 900; if(f < 1) flash(g, V.x, V.y, c.colour, f, Math.max(50, big * .45));
      H.splice(0, Math.max(1, Math.ceil(H.length * .12))); trail(g, H, c.colour, 6);
      drawParticles(g, P, dt);
      if(f >= 1 && !P.length && !H.length){ G.anims--; c.inAt = Date.now(); return false; }
      return true;
    }, done(){ G.anims--; c.inAt = c.inAt || Date.now(); }});
    startLoop(); return true;
  }

  function goOut(c){
    const i = G.away.indexOf(c); if(i < 0) return;
    const gone = !c.el.isConnected || (c.cut && (c.cut.leaving || !c.cut.g || c.cut.g.gone));
    if(gone){ ember(c, false); hide(c, false); G.away.splice(i, 1); return; }
    const rr = boxOf(c);
    if(rr.width < 2 || paused()){ c.outAt = Date.now() + 3000; return; }
    const snap = snapshot(c.draw); if(!snap){ ember(c, false); hide(c, false); G.away.splice(i, 1); return; }
    // bursts out of ANOTHER background when there is one (not the one it went into), else the same one
    const src = bgTarget(c, c.tgt && (c.tgt.g || c.tgt.el)) || c.tgt; ember(c, false);
    ensureFx(c.host); G.anims++; G.count.out++; G.last = {dir: 'out', kind: c.kind, at: Date.now(), from: src ? (src.g ? ('group ' + (src.g.title || src.g.mid || '')).slice(0, 60) : (src.el.className || src.el.tagName)) : 'home', same: !!(src && c.tgt && (src.g ? src.g === c.tgt.g : src.el === c.tgt.el))};
    const C1 = {x: rr.left + rr.width / 2, y: rr.top + rr.height / 2}, big = Math.max(rr.width, rr.height);
    const V = tPoint(src, vanishPoint(rr));
    const dur = R(2600, 3200), turns = R(1.2, 2) * (Math.random() < .5 ? -1 : 1), ph = R(0, 6.28), amp = Math.max(36, big * .5);
    const P = Particles(), H = []; let t0 = 0, last = 0, shown = false;
    effects.push({step(g, now){
      if(!t0){ t0 = now; last = now; sparkle(P, V.x, V.y, c.colour, 3, .9); puff(P, V.x, V.y, c.colour, 3, .9, -1); }
      const dt = Math.min(50, now - last); last = now; const e = (now - t0) / dur;
      const ff = (now - t0) / 900; if(ff < 1) flash(g, V.x, V.y, c.colour, ff, Math.max(50, big * .45));
      const home = c.el.isConnected ? boxOf(c) : rr, Ch = home.width > 2 ? {x: home.left + home.width / 2, y: home.top + home.height / 2} : C1;
      if(e < 1){
        const p = clamp(e, 0, 1), q = 1 - p, pt = swirlAt(V, Ch, 1 - Math.pow(1 - p, 2.2), turns, amp, ph), x = pt.x, y = pt.y, s = clamp(easeOutBack(p), 0, 1.12);
        H.push({x, y}); if(H.length > 44) H.shift(); trail(g, H, c.colour, big * .25 * Math.min(1, s) + 5);
        if(Math.random() < .08) sparkle(P, x, y, c.colour, 1, .8); if(Math.random() < .2) puff(P, x, y, c.colour, 1, .7, -1);
        drawParticles(g, P, dt);
        g.save(); g.translate(x, y); g.rotate(-(pt.th - ph) * .15 * q); g.scale(s * (1 + .08 * Math.sin(Math.PI * p)), s * (1 - .06 * Math.sin(Math.PI * p))); g.globalAlpha = clamp(p * 1.8, 0, 1);
        g.shadowColor = rgba(c.colour, .35); g.shadowBlur = 8 * q + 2; g.drawImage(snap, -home.width / 2, -home.height / 2, home.width || rr.width, home.height || rr.height); g.restore();
        return true;
      }
      if(!shown){ shown = true; hide(c, false); const k = G.away.indexOf(c); if(k >= 0) G.away.splice(k, 1); puff(P, Ch.x, Ch.y, c.colour, 2, .6, 1); }
      H.splice(0, Math.max(1, Math.ceil(H.length * .15))); trail(g, H, c.colour, 5); drawParticles(g, P, dt);
      if(!P.length && !H.length){ G.anims--; return false; }
      return true;
    }, done(){ G.anims--; if(!shown){ hide(c, false); const k = G.away.indexOf(c); if(k >= 0) G.away.splice(k, 1); } }});
    startLoop();
  }

  // ember: a small glint on the background the object is inside; lives in the fx host, re-placed every loop tick
  function ember(c, on){
    if(c.emberEl){ c.emberEl.remove(); embers.delete(c.emberEl); c.emberEl = null; }
    if(!on || !c.host) return;
    const e = document.createElement('div'); e.className = 'genie-ember'; e.style.setProperty('--gc', rgba(c.colour, 1)); e.style.transition = 'left .5s linear, top .5s linear';
    e._c = c; c.host.appendChild(e); embers.add(e); c.emberEl = e; placeEmber(e);
  }
  function placeEmber(e){ const c = e._c; if(!c || !c.host || !c.host.isConnected){ e.remove(); embers.delete(e); return; }
    const hr = c.host.getBoundingClientRect(), pt = tPoint(c.tgt, null); if(!pt){ e.style.display = 'none'; return; }
    e.style.display = ''; e.style.left = (pt.x - hr.left) + 'px'; e.style.top = (pt.y - hr.top) + 'px'; }

  function snapshot(src){ try{ const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height; if(!w || !h) return null;
    const k = Math.min(1, 360 / Math.max(w, h)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c; }catch(e){ return null; } }

  // ---------- cadence
  let nextAt = Date.now() + R(CFG.every_s[0], CFG.every_s[1]) * 1000 + (FAST ? 0 : 4000);
  function loop(){
    try{
      const now = Date.now();
      // clean up anything whose object vanished with its scene
      for(let k = G.away.length - 1; k >= 0; k--){ const c = G.away[k]; if(!c.el.isConnected && !c.outStarted){ ember(c, false); G.away.splice(k, 1); } }
      embers.forEach(placeEmber);
      G.away.forEach(c => { if(c.inAt && !c.outStarted && now >= (c.outAt || (c.inAt + c.awayMs))){ c.outStarted = true; goOut(c); if(G.away.includes(c) && c.outAt && c.outAt > now) c.outStarted = false; } });
      if(CFG.on && now >= nextAt){
        nextAt = now + R(CFG.every_s[0], CFG.every_s[1]) * 1000;
        if(!paused() && G.anims < 2 && G.away.length < CFG.max_away){
          const cs = candidates();
          if(cs.length >= Math.max(1, CFG.min_visible)){ const c = cs[Math.floor(Math.random() * cs.length)]; c.awayMs = R(CFG.away_s[0], CFG.away_s[1]) * 1000; goIn(c); }
        }
      }
    }catch(e){ G.err = String(e && e.message || e); }
  }
  setInterval(loop, 500);
  G.now = () => { nextAt = 0; loop(); return G.last; }; // QA: genie one now
  G.peek = () => candidates().map(c => c.kind);
  G.stop = () => { CFG.on = false; G.away.slice().forEach(c => { ember(c, false); hide(c, false); }); G.away.length = 0; effects.length = 0; if(fx){ fx.remove(); fx = null; fxHost = null; } };
  // remote off / tune without a code release: data/genie.json {"on":false} (missing file = defaults)
  if(!FAST) fetch('data/genie.json?t=' + Date.now(), {cache: 'no-store'}).then(r => r.ok ? r.json() : null).then(j => {
    if(!j) return; ['every_s', 'away_s'].forEach(k => { if(Array.isArray(j[k]) && j[k].length === 2 && j[k].every(v => +v > 0)) CFG[k] = j[k].map(Number); });
    ['max_away', 'min_visible'].forEach(k => { if(+j[k] >= 0) CFG[k] = +j[k]; });
    if(j.on === false && !FORCED) G.stop();
  }).catch(() => {});
})(typeof window !== 'undefined' ? window : globalThis);
