// #thryd phone prototype (phone.html only). Never loaded by index.html.
// Tiny tap hook: a quick tap (<8px, <300ms) on a cut opens that character's
// Nokia-3310-style phone. A press-and-move stays a drag exactly as before:
// these listeners are passive, capture-phase, and never preventDefault.
// The phone UI (phone3310_ui.js + phone3310.css) loads lazily on the first tap.
(function(root){
  'use strict';
  if(root.__thrydPhoneHook) return;
  var TAP_PX = 8, TAP_MS = 300, V = '1';
  var down = null, uiP = null;

  function inPhone(el){ return !!(el && el.closest && el.closest('#p3310, #p3310wap')); }
  function targetOf(el){
    if(!el || !el.closest || inPhone(el)) return null;
    var sp = el.closest('#mcut canvas.sprite');
    if(sp){
      var layer = sp.closest('#mcut');
      return {kind:'mcut', node:sp, scene:String((layer && layer._mid) || ''), i:+sp.dataset.i || 0,
        frame:(layer && typeof layer._shown === 'number') ? layer._shown : null};
    }
    var ob = el.closest('#objs .ob');
    if(ob && !ob.classList.contains('dpatch')){
      var L = ob.closest('#objs');
      var all = L ? [].slice.call(L.querySelectorAll('.ob:not(.dpatch)')) : [ob];
      return {kind:'objs', node:ob, scene:String((L && L.dataset.key) || ''), i:Math.max(0, all.indexOf(ob)),
        label:ob.dataset.label || '', frame:null};
    }
    return null;
  }
  function loadUi(){
    if(uiP) return uiP;
    uiP = new Promise(function(resolve, reject){
      var css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = 'assets/phone3310.css?v=' + V;
      document.head.appendChild(css);
      var s = document.createElement('script');
      s.src = 'assets/phone3310_ui.js?v=' + V;
      s.onload = function(){ root.ThrydPhone3310 ? resolve(root.ThrydPhone3310) : reject(new Error('phone_ui')); };
      s.onerror = function(){ uiP = null; reject(new Error('phone_ui')); };
      document.body.appendChild(s);
    });
    return uiP;
  }
  function open(t){
    return loadUi().then(function(ui){ ui.open(t); return ui; }).catch(function(e){ try{ console.warn('[thryd-phone]', e && e.message); }catch(_){} });
  }
  document.addEventListener('pointerdown', function(e){
    if(e.button > 0){ down = null; return; }
    var t = targetOf(e.target);
    down = t ? {t:t, id:e.pointerId, x:e.clientX, y:e.clientY, at:Date.now(), far:false} : null;
  }, {capture:true, passive:true});
  document.addEventListener('pointermove', function(e){
    if(!down || e.pointerId !== down.id || down.far) return;
    var dx = e.clientX - down.x, dy = e.clientY - down.y;
    if(dx * dx + dy * dy >= TAP_PX * TAP_PX) down.far = true;
  }, {capture:true, passive:true});
  document.addEventListener('pointerup', function(e){
    var d = down; down = null;
    if(!d || e.pointerId !== d.id || d.far) return;
    var dx = e.clientX - d.x, dy = e.clientY - d.y;
    if(dx * dx + dy * dy >= TAP_PX * TAP_PX || Date.now() - d.at >= TAP_MS) return;
    setTimeout(function(){ open(d.t); }, 0);
  }, {capture:true, passive:true});
  document.addEventListener('pointercancel', function(){ down = null; }, {capture:true, passive:true});

  root.__thrydPhoneHook = {open:open, targetOf:targetOf, loaded:function(){ return !!root.ThrydPhone3310; }};
})(window);
