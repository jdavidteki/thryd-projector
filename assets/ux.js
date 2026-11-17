/* control bar UX (Jesuye 17 Nov 2026 1:03 PM ET "remove the reset, resume, medium1 buttons. and put some space between buttons. also come
   up with some user experience improvement and implement"). Small and additive: names every control for screen readers and tooltips,
   keyboard shortcuts with a hint (? to show), the bar wakes on a touch or when a control gets keyboard focus, and pressing a control
   doesn't also toggle fullscreen. Sound dropdown logic is not touched. */
(function(){
  var NAMES = {live: 'Live stage', replay: 'Replay a run', cerebro: 'Cerebro view', lovemap: 'Love map'};
  var KEYS = {'1': 'live', '2': 'replay', '3': 'lovemap', '4': 'cerebro'};
  function label(){
    document.querySelectorAll('#modes [data-m]').forEach(function(b){ var m = b.getAttribute('data-m'), n = NAMES[m] || m;
      var k = Object.keys(KEYS).filter(function(x){ return KEYS[x] === m; })[0]; if(!b.title) b.title = n + (k ? ' (key ' + k + ')' : '');
      if(!b.getAttribute('aria-label')) b.setAttribute('aria-label', n); });
    var named = {rpause: 'Pause or play scene updates (Space)', slide: 'GIF slide speed', mute: 'Sound on or off',
      sound: 'Sound source', bgmode: 'Black or white stage background', pick: 'Choose a run to replay'};
    Object.keys(named).forEach(function(id){ var e = document.getElementById(id); if(!e) return; if(!e.title) e.title = named[id]; if(!e.getAttribute('aria-label')) e.setAttribute('aria-label', e.title || named[id]); });
    document.querySelectorAll('#zoomui button, #modes button, #modes select').forEach(function(b){ if(!b.getAttribute('aria-label') && b.title) b.setAttribute('aria-label', b.title); });
    var t = document.getElementById('title'); if(t && !t.title) t.title = 'Keys: 1 live · 2 replay · 3 love map · Space pause · F fullscreen · ? help';
  }
  var hintEl = null, hintT = 0;
  function hint(){
    if(!hintEl){ hintEl = document.createElement('div'); hintEl.id = 'uxhint'; hintEl.setAttribute('role', 'status'); document.body.appendChild(hintEl); }
    hintEl.innerHTML = '<b>Keys</b> 1 live \u00b7 2 replay \u00b7 3 love map \u00b7 Space pause \u00b7 F fullscreen \u00b7 ? this help';
    hintEl.classList.add('on'); clearTimeout(hintT); hintT = setTimeout(function(){ hintEl.classList.remove('on'); }, 4500);
  }
  function typing(e){ var t = e.target; return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); }
  addEventListener('keydown', function(e){
    if(e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
    if(e.key === '?'){ hint(); return; }
    if(KEYS[e.key]){ var b = document.querySelector('#modes [data-m="' + KEYS[e.key] + '"]'); if(b && b.getClientRects().length){ b.click(); } return; }
    if(e.key === ' ' || e.code === 'Space'){ var p = document.getElementById('rpause'); if(p && p.getClientRects().length && getComputedStyle(p).display !== 'none'){ e.preventDefault(); p.click(); } }
  });
  // a touch or keyboard focus wakes the bar the same way a mouse move does (projector.js clears body.idle on mousemove / keydown)
  function wake(){ try{ dispatchEvent(new MouseEvent('mousemove')); }catch(err){} }
  addEventListener('touchstart', wake, {passive: true});
  document.addEventListener('focusin', function(e){ if(e.target && e.target.closest && e.target.closest('#bar, #zoomui')) wake(); });
  // pressing a control should only do that control's job, not also toggle fullscreen (document click handler)
  // (bubble phase on the bar itself, so each control's own handler still runs first)
  function guard(){ ['modes', 'zoomui'].forEach(function(id){ var el = document.getElementById(id); if(!el || el._uxGuard) return; el._uxGuard = 1;
    el.addEventListener('click', function(e){ if(e.target && e.target.closest && e.target.closest('button, select')) e.stopPropagation(); }); }); }
  function init(){ label(); guard(); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  setTimeout(init, 3000); setTimeout(init, 9000); // buttons added later by stage.js / extras.js (bgmode, sound)
  var first = false; try{ first = !localStorage.getItem('thryd_ux_hint'); if(first) localStorage.setItem('thryd_ux_hint', '1'); }catch(err){}
  if(first) setTimeout(hint, 2500);
})();
