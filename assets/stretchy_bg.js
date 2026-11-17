/* stretchy_bg.js — full-viewport rubber-sheet field that also warps
   the current scene / live-view plates. Foreground cuts, text and
   tweet popups stay in the DOM, unwarped. Preview copy only. */
(function(){
  'use strict';
  var STYLE_OK = 'body.stage-white:not(.stage-replay):not(.cerebro):not(.lovemap)';
  var WARP_MS = 2880;     // 48 frames × 60 ms, seamless
  var BREATHE_MS = 8000;  // slow ghostly fade, 15% ↔ 60%
  var GRID_A = 0.08;     // very faint; the stretched image carries the feel

  function matchesWhite(){
    try{
      var b = document.body;
      if(!b) return false;
      return b.classList.contains('stage-white')
        && !b.classList.contains('stage-replay')
        && !b.classList.contains('cerebro')
        && !b.classList.contains('lovemap');
    }catch(e){ return false; }
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
        'html body.stage-white:not(.stage-replay):not(.cerebro):not(.lovemap),',
        'html body.stage-white:not(.stage-replay):not(.cerebro):not(.lovemap) #gstage{background:transparent!important}',
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

  function renderSize(css){
    var k = 0.7;
    return {w: Math.max(2, Math.round(css.w * k)), h: Math.max(2, Math.round(css.h * k))};
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
      var nodes = document.querySelectorAll('#gbgs .gbg');
      for(var i = 0; i < nodes.length; i++){
        var el = nodes[i];
        if(!el.classList.contains('on')) continue;
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
        ctx.drawImage(tmp, x, y, pw, ph);
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
      'uniform float uT;',
      'uniform float uBreathe;',
      'uniform float uGrid;',
      'vec2 warp(vec2 p){',
      '  float cx = uCss.x * (0.5 + 0.25 * cos(uT));',
      '  float cy = uCss.y * (0.5 + 0.20 * sin(2.0 * uT));',
      '  vec2 d = p - vec2(cx, cy);',
      '  float r = length(d);',
      '  float pull = 28.0 * sin(2.0 * uT) * exp(-r / 180.0);',
      '  vec2 src = p;',
      '  if(r > 0.0001) src += (d / r) * pull;',
      '  src.x += 10.0 * sin(p.y / 55.0 + uT);',
      '  src.y +=  8.0 * sin(p.x / 70.0 - uT);',
      '  return src;',
      '}',
      'void main(){',
      '  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uCss;',
      '  vec2 s = warp(p);',
      '  float fr = 0.5 + 0.5 * sin(s.x / 200.0 + s.y / 280.0);',
      '  float fg = 0.5 + 0.5 * cos(s.x / 240.0 - s.y / 180.0);',
      '  float fb = 0.5 + 0.5 * sin(s.y / 220.0 + s.x / 320.0);',
      '  vec3 pastel = vec3(1.0) - vec3(0.10, 0.07, 0.03) * vec3(fr, fg, fb);',
      '  vec2 cell = s / 32.0;',
      '  vec2 fw = abs(fract(cell) - 0.5);',
      '  float line = 1.0 - smoothstep(0.015, 0.038, min(fw.x, fw.y));',
      '  vec3 gridCol = vec3(0.62, 0.66, 0.72);',
      '  pastel = mix(pastel, gridCol, line * uGrid);',
      '  vec2 uv = vec2(s.x / uCss.x, 1.0 - s.y / uCss.y);',
      '  vec4 scene = vec4(0.0);',
      '  if(uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0){',
      '    scene = texture2D(uScene, uv);',
      '  }',
      '  float a = scene.a * uBreathe;',
      '  vec3 rgb = mix(pastel, scene.rgb, a);',
      '  gl_FragColor = vec4(rgb, 1.0);',
      '}'
    ].join('\n'));
    if(!vs || !fs){ start2D(canvas); return; }
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){ start2D(canvas); return; }
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uScene = gl.getUniformLocation(prog, 'uScene');
    var uCss = gl.getUniformLocation(prog, 'uCss');
    var uT = gl.getUniformLocation(prog, 'uT');
    var uBreathe = gl.getUniformLocation(prog, 'uBreathe');
    var uGrid = gl.getUniformLocation(prog, 'uGrid');
    gl.uniform1i(uScene, 0);
    gl.uniform1f(uGrid, GRID_A);

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

    function sizeTo(){
      var css = cssSize();
      var rs = renderSize(css);
      if(canvas.width !== rs.w || canvas.height !== rs.h){
        canvas.width = rs.w; canvas.height = rs.h;
        canvas.style.width = '100%'; canvas.style.height = '100%';
        gl.viewport(0, 0, rs.w, rs.h);
      }
      gl.uniform2f(uCss, css.w, css.h);
      rw = rs.w; rh = rs.h;
    }
    sizeTo();
    window.addEventListener('resize', sizeTo, {passive:true});

    var t0 = performance.now();
    function tick(now){
      var on = matchesWhite();
      canvas.style.display = on ? 'block' : 'none';
      if(on){
        sizeTo();
        var scene = comp.draw(rw, rh);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        try{ gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene); }catch(e){}
        var t = ((now - t0) / WARP_MS) * Math.PI * 2;
        var br = 0.15 + 0.45 * (0.5 + 0.5 * Math.sin(((now - t0) / BREATHE_MS) * Math.PI * 2));
        gl.uniform1f(uT, t);
        gl.uniform1f(uBreathe, br);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // fallback: low-res 2D warp if WebGL is missing
  function start2D(canvas){
    var ctx = canvas.getContext('2d', {alpha:false});
    var comp = makeCompositor();
    var src = document.createElement('canvas');
    var sctx = src.getContext('2d');
    function sizeTo(){
      var css = cssSize();
      var rs = renderSize(css);
      if(canvas.width !== rs.w || canvas.height !== rs.h){
        canvas.width = rs.w; canvas.height = rs.h;
        canvas.style.width = '100%'; canvas.style.height = '100%';
      }
      if(src.width !== rs.w || src.height !== rs.h){ src.width = rs.w; src.height = rs.h; }
      return {css: css, rs: rs};
    }
    var t0 = performance.now();
    var STEP = 8;
    function tick(now){
      var on = matchesWhite();
      canvas.style.display = on ? 'block' : 'none';
      if(on){
        var sz = sizeTo(), W = sz.rs.w, H = sz.rs.h, css = sz.css;
        var t = ((now - t0) / WARP_MS) * Math.PI * 2;
        var br = 0.15 + 0.45 * (0.5 + 0.5 * Math.sin(((now - t0) / BREATHE_MS) * Math.PI * 2));
        var sx = W / css.w, sy = H / css.h;
        var cx = css.w * (0.5 + 0.25 * Math.cos(t));
        var cy = css.h * (0.5 + 0.20 * Math.sin(2 * t));
        var scene = comp.draw(W, H);
        sctx.clearRect(0,0,W,H);
        sctx.drawImage(scene, 0, 0);
        var img;
        try{ img = sctx.getImageData(0, 0, W, H); }catch(e){ img = null; }
        var id = ctx.createImageData(W, H);
        var dst = id.data, srcd = img && img.data;
        for(var y = 0; y < H; y++){
          var py = (y + 0.5) / sy;
          for(var x = 0; x < W; x++){
            var px = (x + 0.5) / sx;
            var dx = px - cx, dy = py - cy;
            var r = Math.sqrt(dx * dx + dy * dy);
            var pull = 28 * Math.sin(2 * t) * Math.exp(-r / 180);
            var qx = px, qy = py;
            if(r > 0.0001){ qx += (dx / r) * pull; qy += (dy / r) * pull; }
            qx += 10 * Math.sin(py / 55 + t);
            qy += 8 * Math.sin(px / 70 - t);
            var fr = 0.5 + 0.5 * Math.sin(qx / 200 + qy / 280);
            var fg = 0.5 + 0.5 * Math.cos(qx / 240 - qy / 180);
            var fb = 0.5 + 0.5 * Math.sin(qy / 220 + qx / 320);
            var R = 1 - 0.10 * fr, G = 1 - 0.07 * fg, B = 1 - 0.03 * fb;
            var cellx = qx / 32, celly = qy / 32;
            var fx = Math.abs(cellx - Math.floor(cellx) - 0.5);
            var fy = Math.abs(celly - Math.floor(celly) - 0.5);
            var line = Math.min(fx, fy) < 0.03 ? GRID_A : 0;
            if(line){ R = R * (1-line) + 0.62 * line; G = G * (1-line) + 0.66 * line; B = B * (1-line) + 0.72 * line; }
            if(srcd){
              var ix = Math.round(qx * sx), iy = Math.round(qy * sy);
              if(ix >= 0 && iy >= 0 && ix < W && iy < H){
                var o = (iy * W + ix) * 4;
                var a = (srcd[o+3] / 255) * br;
                if(a > 0){
                  R = R * (1-a) + (srcd[o] / 255) * a;
                  G = G * (1-a) + (srcd[o+1] / 255) * a;
                  B = B * (1-a) + (srcd[o+2] / 255) * a;
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
        ctx.putImageData(id, 0, 0);
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if(document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
