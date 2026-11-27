/* cut_animate.js — v636
   Ambient in-cut motion (people breathe / sway / blink; objects drift by kind)
   plus instant command-driven motion scripts (walk, approach, bounce, shake,
   spin, orbit, fade, nod). Deterministic verb map; no paid APIs.
   Fallback when a cut has no AI GIF (manifest field `anim`).
*/
(function(root){
  const PERSON = /^(person|man|woman|boy|girl|child|kid|people|human|figure|lady|guy|baby|walker|student|dancer|speaker|graduate|teacher|guest)$/i;
  const VERBS = {
    walk: 'walk', approach: 'walk', come: 'walk', go: 'walk',
    bounce: 'bounce', hop: 'bounce', jump: 'bounce',
    shake: 'shake', buzz: 'shake', rumble: 'shake',
    spin: 'spin', twirl: 'spin', turn: 'spin',
    orbit: 'orbit', circle: 'orbit',
    fade: 'fade', vanish: 'fade', hide: 'fade',
    nod: 'nod', bow: 'nod'
  };
  const DEFAULT_MS = {walk: 1600, bounce: 1200, shake: 800, spin: 1400, orbit: 1800, fade: 1400, nod: 1100};

  function hash(s){
    let h = 2166136261;
    const t = String(s || '');
    for(let i = 0; i < t.length; i++){ h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function seedOf(cut){
    if(cut && cut._animSeed != null) return cut._animSeed;
    const id = (cut && (cut.g && cut.g.mid) || '') + '|' + (cut && cut.label || '') + '|' + (cut && cut.i || 0);
    const s = hash(id) || 1;
    if(cut) cut._animSeed = s;
    return s;
  }
  function kindOf(klass, label, object){
    const k = String(klass || label || object || '').toLowerCase();
    if(PERSON.test(k.split(/[\s_]/)[0]) || PERSON.test(k)) return 'person';
    if(/lamp|lantern|light|candle/.test(k)) return 'lamp';
    if(/phone|mobile|cell/.test(k)) return 'phone';
    if(/cup|bowl|mug|glass|vessel|basin|stew/.test(k)) return 'cup';
    if(/cloth|flag|tie|robe|wrap|curtain|dress|agbada/.test(k)) return 'cloth';
    if(/tree|plant|leaf|branch/.test(k)) return 'tree';
    if(/clock|watch/.test(k)) return 'clock';
    if(/laptop|monitor|screen/.test(k)) return 'laptop';
    return 'object';
  }
  function phases(seed, n){
    const out = [];
    let x = seed || 1;
    for(let i = 0; i < n; i++){ x = (Math.imul(x, 1103515245) + 12345) >>> 0; out.push((x % 6283) / 1000); }
    return out;
  }

  // Sample the ambient pose at time t (ms). Returns strip offsets, not CSS on the whole cut.
  function sampleAmbient(cut, t, w, h){
    const seed = seedOf(cut);
    const kind = kindOf(cut && cut.klass, cut && cut.label, cut && cut.object);
    const P = phases(seed, 8);
    const tS = t / 1000;
    const rows = 6;
    const strips = [];
    // un-synced periods (seconds)
    const tBreath = 3.6 + (seed % 17) * 0.07;
    const tSway = 4.8 + (seed % 13) * 0.11;
    const tDrift = 6.2 + (seed % 19) * 0.09;
    const breath = Math.sin(tS * Math.PI * 2 / tBreath + P[0]);
    const sway = Math.sin(tS * Math.PI * 2 / tSway + P[1]);
    const drift = Math.sin(tS * Math.PI * 2 / tDrift + P[2]);
    const drift2 = Math.cos(tS * Math.PI * 2 / (tDrift * 1.17) + P[3]);

    // occasional blink / buzz windows, unique per cut
    const blinkPeriod = 4200 + (seed % 23) * 180;
    const blinkAt = (t + (seed % blinkPeriod)) % blinkPeriod;
    const blinking = kind === 'person' && blinkAt < 110;
    const blinkK = blinking ? Math.sin((blinkAt / 110) * Math.PI) : 0;
    const buzzPeriod = 7000 + (seed % 29) * 220;
    const buzzAt = (t + (seed % buzzPeriod)) % buzzPeriod;
    const buzzing = kind === 'phone' && buzzAt < 220;
    const buzz = buzzing ? Math.sin(tS * 48) : 0;

    for(let i = 0; i < rows; i++){
      const y0 = Math.round(h * i / rows), y1 = Math.round(h * (i + 1) / rows);
      const along = i / (rows - 1); // 0 = head, 1 = feet
      const ph = P[4] + i * (0.7 + (seed % 5) * 0.13);
      let dx = 0, dy = 0, sy = 1;
      if(kind === 'person'){
        // breathing: slight vertical scale around the feet
        sy = 1 + 0.014 * breath * (1 - along * 0.35);
        dy = -(h * (sy - 1)) * (1 - along); // keep feet planted
        // head and shoulder sway (stronger at the top)
        dx = w * 0.016 * sway * (1 - along * 0.75);
        if(blinking && along < 0.22){
          sy *= 1 - 0.55 * blinkK;
          dy += (y1 - y0) * 0.35 * blinkK;
        }
      } else if(kind === 'lamp'){
        sy = 1 + 0.02 * Math.abs(Math.sin(tS * 3.1 + ph));
        dx = w * 0.006 * drift;
      } else if(kind === 'phone'){
        dx = w * 0.004 * drift + w * 0.018 * buzz;
        dy = h * 0.003 * drift2 + h * 0.01 * buzz;
      } else if(kind === 'cup'){
        // steam shimmer on the top strips
        if(along < 0.35){ dy = -h * 0.012 * (0.5 + 0.5 * Math.sin(tS * 2.4 + ph)); dx = w * 0.01 * Math.sin(tS * 1.8 + ph); }
        else { dx = w * 0.005 * drift; }
      } else if(kind === 'cloth' || kind === 'tree'){
        dx = w * 0.022 * Math.sin(tS * Math.PI * 2 / tSway + ph) * (1 - along * 0.4);
        sy = 1 + 0.01 * Math.sin(tS * 1.6 + ph);
      } else if(kind === 'clock'){
        dx = w * 0.004 * Math.sin(tS * 1.1 + P[5]);
      } else if(kind === 'laptop'){
        dx = w * 0.004 * drift; dy = h * 0.003 * drift2;
      } else {
        // soft local mesh: un-synced gentle drift / wobble
        dx = w * 0.012 * Math.sin(tS * Math.PI * 2 / tDrift + ph);
        dy = h * 0.008 * Math.sin(tS * Math.PI * 2 / tSway + ph + P[6]);
        sy = 1 + 0.008 * Math.sin(tS * 1.3 + ph);
      }
      strips.push({y0, y1, dx, dy, sy});
    }
    return {kind, strips, breath, sway, blinking, buzzing};
  }

  function keepSrc(cut){
    if(!cut || !cut.el) return null;
    if(cut.srcCanvas && cut.srcCanvas.width === cut.el.width && cut.srcCanvas.height === cut.el.height) return cut.srcCanvas;
    const s = document.createElement('canvas');
    s.width = cut.el.width; s.height = cut.el.height;
    try{
      const x = s.getContext('2d');
      const fr = (cut.frames && cut.frames.length > 1) ? null : (cut.frames && cut.frames[0]);
      if(fr) x.drawImage(fr, 0, 0);
      else x.drawImage(cut.el, 0, 0);
    }catch(e){ return null; }
    cut.srcCanvas = s;
    return s;
  }

  function paintAmbient(cut, now, srcFrame){
    if(!cut || !cut.ctx || !cut.el) return false;
    const w = cut.el.width, h = cut.el.height;
    if(w < 4 || h < 4) return false;
    let src = srcFrame || null;
    if(!src){
      if(cut.frames && cut.frames.length > 1){
        // GIF / anim: caller should pass the current frame; fall back to last drawn
        src = cut._animFr || cut.frames[0];
      } else {
        src = keepSrc(cut);
      }
    }
    if(!src) return false;
    const pose = sampleAmbient(cut, now, w, h);
    const ctx = cut.ctx;
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    for(let i = 0; i < pose.strips.length; i++){
      const s = pose.strips[i];
      const sh = Math.max(1, s.y1 - s.y0);
      ctx.save();
      ctx.beginPath();
      ctx.rect(-2, s.y0 - 1, w + 4, sh + 2);
      ctx.clip();
      ctx.translate(s.dx, s.dy);
      if(s.sy !== 1){
        const feet = h;
        ctx.translate(0, feet);
        ctx.scale(1, s.sy);
        ctx.translate(0, -feet);
      }
      try{ ctx.drawImage(src, 0, 0, w, h); }catch(e){}
      ctx.restore();
    }
    ctx.restore();
    return true;
  }

  function makeScript(verb, duration, target){
    const v = VERBS[String(verb || '').toLowerCase()] || null;
    if(!v) return null;
    const ms = duration > 0 ? duration : DEFAULT_MS[v];
    return {verb: v, dur: ms, t0: 0, target: target || null};
  }

  // CSS/transform pose for a running script at local time u in 0..1
  function sampleScript(script, u, cut, target){
    const v = script.verb;
    const ease = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    const wiggle = Math.sin(u * Math.PI);
    let tx = 0, ty = 0, rot = 0, sc = 1, op = 1;
    if(v === 'walk'){
      let dx = 80, dy = 0;
      if(target && cut){
        dx = (target.left + target.w / 2) - (cut.left + cut.w / 2);
        dy = (target.top + target.h / 2) - (cut.top + cut.h / 2);
        const d = Math.hypot(dx, dy) || 1;
        const step = Math.min(d, Math.max(cut.w, cut.h) * 0.9 + 40);
        dx = dx / d * step; dy = dy / d * step;
      }
      const go = wiggle; // out and back so it loops into place
      tx = dx * go; ty = dy * go;
    } else if(v === 'bounce'){
      ty = -Math.abs(Math.sin(u * Math.PI * 2)) * 22;
    } else if(v === 'shake'){
      tx = Math.sin(u * Math.PI * 16) * 7;
      ty = Math.cos(u * Math.PI * 14) * 3;
    } else if(v === 'spin'){
      rot = u * 360;
    } else if(v === 'orbit'){
      const r = (cut && cut.w ? cut.w * 0.45 : 36);
      tx = Math.cos(u * Math.PI * 2) * r;
      ty = Math.sin(u * Math.PI * 2) * r * 0.6;
    } else if(v === 'fade'){
      op = 1 - 0.85 * wiggle;
    } else if(v === 'nod'){
      ty = Math.sin(u * Math.PI * 2) * 10;
      rot = Math.sin(u * Math.PI * 2) * 8;
    }
    return {tx, ty, rot, sc, op, ease};
  }

  function applyScript(cut, script, now){
    if(!cut || !cut.el || !script) return false;
    if(!script.t0) script.t0 = now;
    const u = Math.max(0, Math.min(1, (now - script.t0) / (script.dur || DEFAULT_MS[script.verb] || 1200)));
    const p = sampleScript(script, u, cut, script.target);
    cut.el.style.translate = p.tx.toFixed(1) + 'px ' + p.ty.toFixed(1) + 'px';
    cut.el.style.rotate = p.rot ? (p.rot.toFixed(1) + 'deg') : '';
    if(p.op !== 1) cut.el.style.opacity = String(p.op);
    if(u >= 1){
      cut.el.style.translate = '';
      cut.el.style.rotate = '';
      if(!cut.entering && !cut.leaving && (cut.el.style.opacity === String(p.op))) cut.el.style.opacity = '';
      return true; // done
    }
    return false;
  }

  const API = {
    PERSON, VERBS, DEFAULT_MS, ANIM_DWELL_K: 3.5,
    hash, seedOf, kindOf, phases, sampleAmbient, keepSrc, paintAmbient,
    makeScript, sampleScript, applyScript,
    verbOf: function(name){ return VERBS[String(name || '').toLowerCase()] || null; }
  };
  if(typeof module !== 'undefined' && module.exports) module.exports = API;
  if(root) root.ThrydCutAnimate = API;
  return API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
