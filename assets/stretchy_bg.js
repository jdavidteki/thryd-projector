/* stretchy_bg.js — full-viewport rubber-sheet field that also warps
   the current scene / live-view plates. Foreground cuts, text and
   tweet popups stay in the DOM, unwarped. Preview copy only. */
(function(){
  'use strict';
  var LIVE_OK = 'body.stage1:not(.stage-replay):not(.cerebro):not(.lovemap)';
  var BREATHE_MS = 8000;  // slow ghostly fade, 15% ↔ 60%
  var GRID_A = 0.08;     // very faint; the stretched image carries the feel
  var GRID_A_DARK = 0.14; // a touch stronger so the grid still reads on black
  var COMPOSE_MS = 200;  // recache GIF/plate texture at most this often (v610 heat: was 120)
  var DRAW_MS = 240;     // v610 heat (Jesuye 10:03 PM ET: cut drawing 50%): the warp is redrawn at most ~4 fps. Every redraw of this full-screen layer makes the browser
                         // recomposite every cut above it; the warp moves only a few px a second (7-23 s periods), so it looks the same.
  // Incommensurate warp periods (ms) and phase offsets (rad).
  var T1 = 7300, T2 = 11900, T3 = 17700, T4 = 23100;
  var PH1 = 0.0, PH2 = 1.7, PH3 = 3.1, PH4 = 4.9;
  var MAX_RW = 1280, MAX_RH = 720;

  function matchesLiveStage(){
    try{
      var b = document.body;
      if(!b) return false;
      return b.classList.contains('stage1')
        && !b.classList.contains('stage-replay')
        && !b.classList.contains('cerebro')
        && !b.classList.contains('lovemap');
    }catch(e){ return false; }
  }

  function isDark(){
    try{ return !document.body.classList.contains('stage-white'); }catch(e){ return false; }
  }

  function wrapPhase(ms, period, offset){
    var m = ms % period;
    if(m < 0) m += period;
    return (m / period) * Math.PI * 2 + offset;
  }

  function breatheAmt(ms){
    return 0.15 + 0.45 * (0.5 + 0.5 * Math.sin(wrapPhase(ms, BREATHE_MS, 0)));
  }

  // One shared rAF loop: schedule the next frame FIRST so a throw inside
  // tick cannot kill the animation, plus a 1s watchdog that restarts it.
  var _loop = { raf: 0, last: 0, tick: null, watch: 0, busy: false };
  var _clock = { t0Shift: 0, hiddenAt: 0, paused: false, wired: false };

  function animNow(){
    return performance.now() - _clock.t0Shift;
  }

  function _wrapped(now){
    _loop.raf = requestAnimationFrame(_wrapped);
    if(_loop.busy) return;
    if(_clock.paused){ _loop.last = performance.now(); return; }
    _loop.busy = true;
    _loop.last = performance.now();
    try{
      if(_loop.tick) _loop.tick(now);
    }catch(e){
      try{ console.warn('stretchy_bg tick', e); }catch(_){}
    }
    _loop.busy = false;
    _loop.last = performance.now();
  }

  function arm(tickFn){
    _loop.tick = tickFn;
    if(_loop.raf){ try{ cancelAnimationFrame(_loop.raf); }catch(e){} _loop.raf = 0; }
    _loop.last = performance.now();
    if(!_clock.paused) _loop.raf = requestAnimationFrame(_wrapped);
    if(!_loop.watch){
      _loop.watch = setInterval(function(){
        if(!_loop.tick) return;
        if(_clock.paused){ _loop.last = performance.now(); return; }
        if(_loop.busy) return;
        if(performance.now() - _loop.last > 1000){
          try{ if(_loop.raf) cancelAnimationFrame(_loop.raf); }catch(e){}
          _loop.raf = 0;
          _loop.last = performance.now();
          _loop.raf = requestAnimationFrame(_wrapped);
        }
      }, 1000);
    }
    if(!_clock.wired){
      _clock.wired = true;
      document.addEventListener('visibilitychange', function(){
        if(document.hidden){
          _clock.hiddenAt = performance.now();
          _clock.paused = true;
          if(_loop.raf){ try{ cancelAnimationFrame(_loop.raf); }catch(e){} _loop.raf = 0; }
          _loop.last = performance.now();
        } else {
          if(_clock.hiddenAt){
            _clock.t0Shift += performance.now() - _clock.hiddenAt;
            _clock.hiddenAt = 0;
          }
          _clock.paused = false;
          _loop.last = performance.now();
          if(_loop.tick && !_loop.raf) _loop.raf = requestAnimationFrame(_wrapped);
        }
      });
    }
  }

  function freshCanvas(old){
    var c = document.createElement('canvas');
    c.id = 'stretchy-bg';
    c.setAttribute('aria-hidden', 'true');
    if(old && old.parentNode){
      try{ old.removeAttribute('id'); }catch(e){}
      old.parentNode.replaceChild(c, old);
    } else if(document.body){
      var existing = document.getElementById('stretchy-bg');
      if(existing){
        try{ existing.removeAttribute('id'); }catch(e){}
        existing.parentNode.replaceChild(c, existing);
      } else {
        document.body.insertBefore(c, document.body.firstChild);
      }
    }
    return c;
  }

  function boot(){
    if(document.getElementById('stretchy-bg')) return;
    var canvas = document.createElement('canvas');
    canvas.id = 'stretchy-bg';
    canvas.setAttribute('aria-hidden', 'true');
    var parent = document.body;
    parent.insertBefore(canvas, parent.firstChild);
    parent.classList.add('stretchy-bg');
    // Override stage.js white paints, which are injected later with !important.
    // This style is appended at boot (after stage.js in the loader), so it wins.
    var ov = document.getElementById('stretchy-bg-override');
    if(!ov){
      ov = document.createElement('style');
      ov.id = 'stretchy-bg-override';
      ov.textContent = [
        'html body.stage1:not(.stage-replay):not(.cerebro):not(.lovemap) #gstage{background:transparent!important}',
        'html body.stage1.stage-white:not(.stage-replay):not(.cerebro):not(.lovemap){background:transparent!important}',
        'html body.stage1:not(.stage-replay):not(.cerebro):not(.lovemap) #vignette{display:none!important}',
        'html body.stretchy-bg #gbgs .gbg{opacity:0!important;transition:none!important;filter:none!important}'
      ].join('\n');
      document.head.appendChild(ov);
    }

    var gl = canvas.getContext('webgl', {alpha:false, antialias:false, premultipliedAlpha:false, preserveDrawingBuffer:true})
          || canvas.getContext('experimental-webgl', {alpha:false, antialias:false, premultipliedAlpha:false, preserveDrawingBuffer:true});
    if(gl) startGL(canvas, gl);
    else start2D(canvas);
  }

  function cssSize(){
    return {w: Math.max(2, window.innerWidth || 1280), h: Math.max(2, window.innerHeight || 720)};
  }

  function renderSize(cw, ch){
    var k = 0.5; // v610 heat: was 0.7; the field is a soft pastel warp of already-faded plates, so half the pixels look the same
    var w = Math.max(2, Math.round(cw * k));
    var h = Math.max(2, Math.round(ch * k));
    if(w > MAX_RW || h > MAX_RH){
      var s = Math.min(MAX_RW / w, MAX_RH / h);
      w = Math.max(2, Math.round(w * s));
      h = Math.max(2, Math.round(h * s));
    }
    return {w: w, h: h};
  }

  // Cheap plate signature: src / on-class only, no layout reads.
  function platesSig(){
    var box = document.getElementById('gbgs');
    if(!box) return '';
    var nodes = box.children, i, el, s = '', n = 0;
    for(i = 0; i < nodes.length; i++){
      el = nodes[i];
      if(!el.classList || !el.classList.contains('gbg')) continue;
      n++;
      s += el.classList.contains('on') ? '1' : '0';
      if(el.src) s += el.src;
      else if(el.currentSrc) s += el.currentSrc;
      if(el.tagName === 'CANVAS') s += el.width;
      else if(el.tagName === 'VIDEO') s += (el.currentTime | 0);
    }
    return s + '|' + n;
  }

  // ----- composite current .gbg plates into a 2D canvas (screen space) -----
  function makeCompositor(){
    var c = document.createElement('canvas');
    var ctx = c.getContext('2d', {alpha:true, willReadFrequently:false});
    var tmp = document.createElement('canvas');
    var tctx = tmp.getContext('2d', {alpha:true});
    function resize(w, h){
      if(c.width !== w || c.height !== h){ c.width = w; c.height = h; }
    }
    function draw(w, h){
      resize(w, h);
      ctx.setTransform(1,0,0,1,0,0);
      ctx.clearRect(0, 0, w, h);
      var css = cssSize();
      var sx = w / css.w, sy = h / css.h;
      var box = document.getElementById('gbgs');
      var nodes = box ? box.children : [];
      for(var i = 0; i < nodes.length; i++){
        var el = nodes[i];
        if(!el.classList || !el.classList.contains('gbg') || !el.classList.contains('on')) continue;
        var ready = true;
        if(el.tagName === 'IMG') ready = el.complete && el.naturalWidth > 0;
        if(el.tagName === 'CANVAS') ready = el.width > 0 && el.height > 0;
        if(!ready) continue;
        var r = el.getBoundingClientRect();
        var x = r.left * sx, y = r.top * sy, pw = r.width * sx, ph = r.height * sy;
        if(pw < 2 || ph < 2) continue;
        if(r.right < 0 || r.bottom < 0 || r.left > css.w || r.top > css.h) continue;
        var tw = Math.max(2, Math.round(pw)), th = Math.max(2, Math.round(ph));
        if(tmp.width !== tw || tmp.height !== th){ tmp.width = tw; tmp.height = th; }
        else tctx.clearRect(0, 0, tw, th);
        try{ tctx.drawImage(el, 0, 0, tw, th); }catch(e){ continue; }
        // soft radial edge, so plates dissolve into the pastel field
        var rad = tctx.createRadialGradient(tw * 0.5, th * 0.5, Math.min(tw, th) * 0.22, tw * 0.5, th * 0.5, Math.min(tw, th) * 0.52);
        rad.addColorStop(0, 'rgba(0,0,0,1)');
        rad.addColorStop(0.55, 'rgba(0,0,0,.85)');
        rad.addColorStop(1, 'rgba(0,0,0,0)');
        tctx.globalCompositeOperation = 'destination-in';
        tctx.fillStyle = rad;
        tctx.fillRect(0, 0, tw, th);
        tctx.globalCompositeOperation = 'source-over';
        try{ ctx.drawImage(tmp, x, y, pw, ph); }catch(e){}
      }
      return c;
    }
    return {draw: draw, canvas: c};
  }

  function compile(gl, type, src){
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)){
      console.warn('stretchy_bg shader', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  // Shared warp used by the 2D fallback (must match the fragment shader).
  var _q = {x: 0, y: 0};
  function warpPoint(px, py, cw, ch, p1, p2, p3, p4){
    var cx1 = cw * (0.5 + 0.16 * Math.cos(p1) + 0.09 * Math.cos(p2 + 0.4));
    var cy1 = ch * (0.5 + 0.12 * Math.sin(p2) + 0.08 * Math.sin(p3 + 1.1));
    var dx1 = px - cx1, dy1 = py - cy1;
    var r1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    var pull1 = (18 + 10 * Math.sin(p3)) * Math.exp(-r1 / 180);
    var qx = px, qy = py;
    if(r1 > 0.0001){ qx += (dx1 / r1) * pull1; qy += (dy1 / r1) * pull1; }
    var cx2 = cw * (0.5 + 0.10 * Math.cos(p3 + 0.8) + 0.05 * Math.cos(p4));
    var cy2 = ch * (0.5 + 0.08 * Math.sin(p4 + 1.4) + 0.04 * Math.sin(p1 + 2.2));
    var dx2 = px - cx2, dy2 = py - cy2;
    var r2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    var pull2 = (6 + 3 * Math.sin(p4 + 0.6)) * Math.exp(-r2 / 180);
    if(r2 > 0.0001){ qx += (dx2 / r2) * pull2; qy += (dy2 / r2) * pull2; }
    qx += 6 * Math.sin(py / 55 + p1) + 4 * Math.sin(py / 55 + p2);
    qy += 5 * Math.sin(px / 70 - p3) + 3 * Math.sin(px / 70 - p4);
    _q.x = qx; _q.y = qy;
    return _q;
  }

  function startGL(canvas, gl){
    var vs = compile(gl, gl.VERTEX_SHADER, [
      'attribute vec2 aPos;',
      'varying vec2 vUv;',
      'void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }'
    ].join('\n'));
    var fs = compile(gl, gl.FRAGMENT_SHADER, [
      'precision mediump float;',
      'varying vec2 vUv;',
      'uniform sampler2D uScene;',
      'uniform vec2 uCss;',
      'uniform vec4 uP;',
      'uniform float uBreathe;',
      'uniform float uGrid;',
      'uniform float uDark;',
      'vec2 warp(vec2 p){',
      '  float cx1 = uCss.x * (0.5 + 0.16 * cos(uP.x) + 0.09 * cos(uP.y + 0.4));',
      '  float cy1 = uCss.y * (0.5 + 0.12 * sin(uP.y) + 0.08 * sin(uP.z + 1.1));',
      '  vec2 d1 = p - vec2(cx1, cy1);',
      '  float r1 = length(d1);',
      '  float pull1 = (18.0 + 10.0 * sin(uP.z)) * exp(-r1 / 180.0);',
      '  vec2 src = p;',
      '  if(r1 > 0.0001) src += (d1 / r1) * pull1;',
      '  float cx2 = uCss.x * (0.5 + 0.10 * cos(uP.z + 0.8) + 0.05 * cos(uP.w));',
      '  float cy2 = uCss.y * (0.5 + 0.08 * sin(uP.w + 1.4) + 0.04 * sin(uP.x + 2.2));',
      '  vec2 d2 = p - vec2(cx2, cy2);',
      '  float r2 = length(d2);',
      '  float pull2 = (6.0 + 3.0 * sin(uP.w + 0.6)) * exp(-r2 / 180.0);',
      '  if(r2 > 0.0001) src += (d2 / r2) * pull2;',
      '  src.x += 6.0 * sin(p.y / 55.0 + uP.x) + 4.0 * sin(p.y / 55.0 + uP.y);',
      '  src.y += 5.0 * sin(p.x / 70.0 - uP.z) + 3.0 * sin(p.x / 70.0 - uP.w);',
      '  return src;',
      '}',
      'void main(){',
      '  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uCss;',
      '  vec2 s = warp(p);',
      '  float fr = 0.5 + 0.5 * sin(s.x / 200.0 + s.y / 280.0);',
      '  float fg = 0.5 + 0.5 * cos(s.x / 240.0 - s.y / 180.0);',
      '  float fb = 0.5 + 0.5 * sin(s.y / 220.0 + s.x / 320.0);',
      '  vec3 pastelL = vec3(1.0) - vec3(0.10, 0.07, 0.03) * vec3(fr, fg, fb);',
      '  vec3 pastelD = vec3(0.035, 0.038, 0.048) + vec3(0.07, 0.055, 0.045) * vec3(fr, fg, fb);',
      '  vec3 pastel = mix(pastelL, pastelD, uDark);',
      '  vec2 cell = s / 32.0;',
      '  vec2 fw = abs(fract(cell) - 0.5);',
      '  float line = 1.0 - smoothstep(0.015, 0.038, min(fw.x, fw.y));',
      '  vec3 gridL = vec3(0.62, 0.66, 0.72);',
      '  vec3 gridD = vec3(0.48, 0.52, 0.60);',
      '  vec3 gridCol = mix(gridL, gridD, uDark);',
      '  pastel = mix(pastel, gridCol, line * uGrid);',
      '  vec2 uv = vec2(s.x / uCss.x, 1.0 - s.y / uCss.y);',
      '  vec4 scene = vec4(0.0);',
      '  if(uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0){',
      '    scene = texture2D(uScene, uv);',
      '  }',
      '  vec3 plate = mix(scene.rgb, clamp(scene.rgb * 1.18 + vec3(0.08), 0.0, 1.0), uDark);',
      '  float a = scene.a * uBreathe * mix(1.0, 1.2, uDark);',
      '  a = min(a, 0.85);',
      '  vec3 rgb = mix(pastel, plate, a);',
      '  gl_FragColor = vec4(rgb, 1.0);',
      '}'
    ].join('\n'));
    if(!vs || !fs){ start2D(freshCanvas(canvas)); return; }
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){ start2D(freshCanvas(canvas)); return; }
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uScene = gl.getUniformLocation(prog, 'uScene');
    var uCss = gl.getUniformLocation(prog, 'uCss');
    var uP = gl.getUniformLocation(prog, 'uP');
    var uBreathe = gl.getUniformLocation(prog, 'uBreathe');
    var uGrid = gl.getUniformLocation(prog, 'uGrid');
    var uDark = gl.getUniformLocation(prog, 'uDark');
    gl.uniform1i(uScene, 0);
    gl.uniform1f(uGrid, GRID_A);
    gl.uniform1f(uDark, 0.0);

    var tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // 1x1 white so the first frame is already a field
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255,255,255,0]));

    var comp = makeCompositor();
    var rw = 0, rh = 0;
    var texW = 0, texH = 0;
    var lastSig = null, lastComp = 0;
    var uCssW = 0, uCssH = 0;
    var fellBack = false;

    function fallBack2D(){
      if(fellBack) return;
      fellBack = true;
      start2D(freshCanvas(canvas));
    }

    canvas.addEventListener('webglcontextlost', function(ev){
      try{ ev.preventDefault(); }catch(e){}
      fallBack2D();
    }, false);
    canvas.addEventListener('webglcontextrestored', function(){
      if(!fellBack) fallBack2D();
    }, false);

    function sizeTo(){
      var cw = Math.max(2, window.innerWidth || 1280);
      var ch = Math.max(2, window.innerHeight || 720);
      var rs = renderSize(cw, ch);
      var resized = (canvas.width !== rs.w || canvas.height !== rs.h);
      if(resized){
        canvas.width = rs.w; canvas.height = rs.h;
        canvas.style.width = '100%'; canvas.style.height = '100%';
        gl.viewport(0, 0, rs.w, rs.h);
        texW = 0; lastComp = 0;
      }
      if(resized || uCssW !== cw || uCssH !== ch){
        gl.uniform2f(uCss, cw, ch);
        uCssW = cw; uCssH = ch;
      }
      rw = rs.w; rh = rs.h;
    }
    sizeTo();
    window.addEventListener('resize', sizeTo, {passive:true});

    function maybeCompose(ts){
      var sig = platesSig();
      var due = (lastComp === 0) || ((ts - lastComp) >= COMPOSE_MS) || (sig !== lastSig);
      if(!due) return;
      lastSig = sig;
      lastComp = ts;
      var scene = comp.draw(rw, rh);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      try{
        if(texW === scene.width && texH === scene.height && texW > 0){
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, scene);
        } else {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene);
          texW = scene.width; texH = scene.height;
        }
      }catch(e){}
    }

    var t0 = animNow();
    var lastDraw = 0;
    function tick(){
      if(fellBack) return;
      var tn = performance.now(); if(lastDraw && tn - lastDraw < DRAW_MS && tn >= lastDraw) return; lastDraw = tn;
      if(gl.isContextLost && gl.isContextLost()){ fallBack2D(); return; }
      var on = matchesLiveStage();
      canvas.style.display = on ? 'block' : 'none';
      if(!on) return;
      sizeTo();
      var ts = animNow();
      maybeCompose(ts);
      var ms = ts - t0;
      var dark = isDark();
      gl.uniform4f(uP, wrapPhase(ms, T1, PH1), wrapPhase(ms, T2, PH2), wrapPhase(ms, T3, PH3), wrapPhase(ms, T4, PH4));
      gl.uniform1f(uBreathe, breatheAmt(ms));
      gl.uniform1f(uGrid, dark ? GRID_A_DARK : GRID_A);
      gl.uniform1f(uDark, dark ? 1.0 : 0.0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    arm(tick);
  }

  // fallback: low-res 2D warp if WebGL is missing
  function start2D(canvas){
    var ctx = canvas.getContext('2d', {alpha:false});
    if(!ctx){
      canvas = freshCanvas(canvas);
      ctx = canvas.getContext('2d', {alpha:false});
      if(!ctx) return;
    }
    var comp = makeCompositor();
    var src = document.createElement('canvas');
    var sctx = src.getContext('2d', {willReadFrequently:true});
    var lastSig = null, lastComp = 0, cachedSrcd = null, outId = null;
    function sizeTo(){
      var css = cssSize();
      var rs = renderSize(css.w, css.h);
      if(canvas.width !== rs.w || canvas.height !== rs.h){
        canvas.width = rs.w; canvas.height = rs.h;
        canvas.style.width = '100%'; canvas.style.height = '100%';
        lastComp = 0;
      }
      if(src.width !== rs.w || src.height !== rs.h){ src.width = rs.w; src.height = rs.h; }
      return {css: css, rs: rs};
    }
    var t0 = animNow();
    function tick(){
      var on = matchesLiveStage();
      canvas.style.display = on ? 'block' : 'none';
      if(!on) return;
      var sz = sizeTo(), W = sz.rs.w, H = sz.rs.h, css = sz.css;
      var ts = animNow();
      var ms = ts - t0;
      var p1 = wrapPhase(ms, T1, PH1), p2 = wrapPhase(ms, T2, PH2);
      var p3 = wrapPhase(ms, T3, PH3), p4 = wrapPhase(ms, T4, PH4);
      var br = breatheAmt(ms);
      var sx = W / css.w, sy = H / css.h;
      var sig = platesSig();
      var due = (lastComp === 0) || ((ts - lastComp) >= COMPOSE_MS) || (sig !== lastSig);
      if(due){
        lastSig = sig;
        lastComp = ts;
        var scene = comp.draw(W, H);
        sctx.clearRect(0,0,W,H);
        try{ sctx.drawImage(scene, 0, 0); }catch(e){}
        var img = null;
        try{
          if(W > 0 && H > 0) img = sctx.getImageData(0, 0, W, H);
        }catch(e){ img = null; }
        cachedSrcd = img && img.data;
      }
      if(!outId || outId.width !== W || outId.height !== H){
        try{ outId = ctx.createImageData(W, H); }catch(e){ return; }
      }
      var dst = outId.data, srcd = cachedSrcd;
      for(var y = 0; y < H; y++){
        var py = (y + 0.5) / sy;
        for(var x = 0; x < W; x++){
          var px = (x + 0.5) / sx;
          var q = warpPoint(px, py, css.w, css.h, p1, p2, p3, p4);
          var qx = q.x, qy = q.y;
          var fr = 0.5 + 0.5 * Math.sin(qx / 200 + qy / 280);
          var fg = 0.5 + 0.5 * Math.cos(qx / 240 - qy / 180);
          var fb = 0.5 + 0.5 * Math.sin(qy / 220 + qx / 320);
          var dark = isDark();
          var R, G, B, gA;
          if(dark){
            R = 0.035 + 0.07 * fr; G = 0.038 + 0.055 * fg; B = 0.048 + 0.045 * fb;
            gA = GRID_A_DARK;
          } else {
            R = 1 - 0.10 * fr; G = 1 - 0.07 * fg; B = 1 - 0.03 * fb;
            gA = GRID_A;
          }
          var cellx = qx / 32, celly = qy / 32;
          var fx = Math.abs(cellx - Math.floor(cellx) - 0.5);
          var fy = Math.abs(celly - Math.floor(celly) - 0.5);
          var line = Math.min(fx, fy) < 0.03 ? gA : 0;
          if(line){
            if(dark){ R = R * (1-line) + 0.48 * line; G = G * (1-line) + 0.52 * line; B = B * (1-line) + 0.60 * line; }
            else { R = R * (1-line) + 0.62 * line; G = G * (1-line) + 0.66 * line; B = B * (1-line) + 0.72 * line; }
          }
          if(srcd){
            var ix = Math.round(qx * sx), iy = Math.round(qy * sy);
            if(ix >= 0 && iy >= 0 && ix < W && iy < H){
              var o = (iy * W + ix) * 4;
              var a = (srcd[o+3] / 255) * br * (dark ? 1.2 : 1);
              if(a > 0.85) a = 0.85;
              if(a > 0){
                var sr = srcd[o] / 255, sg = srcd[o+1] / 255, sb = srcd[o+2] / 255;
                if(dark){ sr = Math.min(1, sr * 1.18 + 0.08); sg = Math.min(1, sg * 1.18 + 0.08); sb = Math.min(1, sb * 1.18 + 0.08); }
                R = R * (1-a) + sr * a;
                G = G * (1-a) + sg * a;
                B = B * (1-a) + sb * a;
              }
            }
          }
          var p = (y * W + x) * 4;
          dst[p] = Math.max(0, Math.min(255, R * 255));
          dst[p+1] = Math.max(0, Math.min(255, G * 255));
          dst[p+2] = Math.max(0, Math.min(255, B * 255));
          dst[p+3] = 255;
        }
      }
      try{ ctx.putImageData(outId, 0, 0); }catch(e){}
    }
    arm(tick);
  }

  if(document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
