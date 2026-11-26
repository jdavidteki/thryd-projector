/* v613: looping video card again (Jesuye 25 Nov 2026 1:56 PM ET: "now we can make the video card keep playing on its loop like before. shouldn't cause much heating").
   Newest scene from data/videos.json (any run, newest added/ts first; no hardcoded run) (muted, autoplay, looping, playsinline; 264p card_video when present, from v601).
   Plays on a continuous loop like v600/v601. Pauses only when the tab is hidden or the card is off-screen; stays looping while idle (the 23 Nov tap-to-play heat stop is removed; other v612 savings are unchanged).
   Drag only moves it (a moved pointer is not a click). "open ↗" opens /videos/ in a new tab.
   It lives outside the zoom canvas (body-level fixed, z-index 12), so it works the same at 1x and zoomed.
   First load: stacked just under #storycard on the right, so the two cards do not overlap.
   Position is kept per device in localStorage (thryd_videocard_pos). */
(function(){
  if(window.__thrydVideoCard) return; window.__thrydVideoCard=1;
  var URL_='https://jdavidteki.github.io/thryd-projector/videos/', KEY='thryd_videocard_pos', TH=6;

  var css=document.createElement('style');
  css.textContent='#videocard{position:fixed;z-index:12;display:flex;flex-direction:column;align-items:stretch;width:132px;padding:5px;'+
    'background:#fffffff2;color:#141414;border-radius:9px;box-shadow:0 4px 16px #0009;text-decoration:none;touch-action:none;'+
    'user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;cursor:grab;font:600 11px/1.25 system-ui,-apple-system,sans-serif;animation:thrydVideoBob 5.4s ease-in-out infinite;will-change:transform}'+
    '@keyframes thrydVideoBob{0%,100%{transform:translate(0,0)}25%{transform:translate(1px,-3px)}50%{transform:translate(0,-4px)}75%{transform:translate(-1px,-2px)}}'+
    '@media (prefers-reduced-motion:reduce){#videocard{animation:none}}'+
    '#videocard.drag{animation-play-state:paused;cursor:grabbing;box-shadow:0 0 0 2px #ffb648,0 10px 24px #000c}'+
    '#videocard video{display:block;width:100%;aspect-ratio:1440/900;object-fit:cover;border-radius:5px;background:#111;pointer-events:none}'+
    '#videocard .jb{font-weight:700;white-space:nowrap}'+
    '#videocard .sl{display:flex;justify-content:space-between;align-items:center;gap:4px;margin-top:4px;pointer-events:none}'+
    '#videocard .go{font-size:10px;color:#0b5cad;white-space:nowrap;pointer-events:auto;cursor:pointer;text-decoration:none}'+
    '@media (max-width:640px){#videocard{width:100px;font-size:10px;padding:4px}#videocard .go{display:none}}';
  document.head.appendChild(css);

  var a=document.createElement('div'); a.id='videocard';
  a.title='🎬 scene video'; a.setAttribute('aria-label','🎬 scene video, looping');
  a.setAttribute('role','group'); a.draggable=false; a.hidden=true;
  a.innerHTML='<video muted autoplay loop playsinline preload="auto" aria-hidden="true"></video><span class="sl"><span>🎬 <span class="jb">scene</span></span><a class="go" href="'+URL_+'" target="_blank" rel="noopener">open ↗</a></span>';
  var vid=a.querySelector('video'), jb=a.querySelector('.jb'), go=a.querySelector('.go');
  vid.muted=true; vid.defaultMuted=true; vid.autoplay=true; vid.loop=true; vid.playsInline=true; vid.preload='auto';
  vid.setAttribute('muted',''); vid.setAttribute('autoplay',''); vid.setAttribute('loop','');
  vid.setAttribute('playsinline',''); vid.setAttribute('webkit-playsinline',''); vid.setAttribute('preload','auto');

  function onScreen(){
    if(document.hidden || a.hidden || !a.parentNode) return false;
    var r=a.getBoundingClientRect(), w=window.innerWidth||0, h=window.innerHeight||0;
    return r.right>0 && r.bottom>0 && r.left<w && r.top<h && r.width>0 && r.height>0;
  }
  function tryPlay(){
    if(!onScreen()) return;
    var p=vid.play(); if(p&&p.catch)p.catch(function(){});
  }
  function park(){ try{vid.pause();}catch(e){} }
  function syncPlay(){ if(onScreen()) tryPlay(); else park(); }
  vid.addEventListener('loadeddata',tryPlay);
  vid.addEventListener('canplay',tryPlay);

  function clamp(x,y){var w=a.offsetWidth||132,h=a.offsetHeight||100;return [Math.max(4,Math.min(innerWidth-w-4,x)),Math.max(4,Math.min(innerHeight-h-4,y))];}
  function place(x,y){var p=clamp(x,y);a.style.left=p[0]+'px';a.style.top=p[1]+'px';a.style.right='auto';a.style.bottom='auto';}
  function storyBox(){var s=document.getElementById('storycard');return s&&s.getBoundingClientRect&&s.offsetParent!==null?s.getBoundingClientRect():null;}
  function overlaps(x,y,w,h,r,gap){if(!r)return false;return x<r.right+gap&&x+w>r.left-gap&&y<r.bottom+gap&&y+h>r.top-gap;}
  function home(){
    var bar=document.getElementById('bar');
    var top=Math.max(8,(bar?bar.getBoundingClientRect().bottom:0)+8);
    var w=a.offsetWidth||132,h=a.offsetHeight||100,gap=8,sb=storyBox();
    if(sb&&sb.width){
      var belowX=sb.right-w, belowY=sb.bottom+gap;
      if(belowY+h<=innerHeight-4&&!overlaps(belowX,belowY,w,h,sb,gap-1)){place(belowX,belowY);return;}
      var leftX=sb.left-w-gap, leftY=sb.top;
      if(leftX>=4){place(leftX,leftY);return;}
      var rightX=sb.right+gap;
      if(rightX+w<=innerWidth-4){place(rightX,sb.top);return;}
    }
    place(innerWidth-w-12, top+(sb&&sb.height?sb.height+gap:120));
  }
  function restore(){var s=null;try{s=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){}
    if(s&&isFinite(s.fx)&&isFinite(s.fy))place(s.fx*innerWidth,s.fy*innerHeight);else home();}
  function save(){try{localStorage.setItem(KEY,JSON.stringify({fx:+(a.offsetLeft/innerWidth).toFixed(4),fy:+(a.offsetTop/innerHeight).toFixed(4)}));}catch(e){}}

  var st=null, dragged=false;
  a.addEventListener('pointerdown',function(ev){ev.stopPropagation();if(ev.pointerType==='mouse'&&ev.button!==0)return;
    if(ev.target&&ev.target.closest&&ev.target.closest('a.go,.go'))return;
    st={id:ev.pointerId,x:ev.clientX,y:ev.clientY,l:a.offsetLeft,t:a.offsetTop};dragged=false;
    try{a.setPointerCapture(ev.pointerId);}catch(e){}});
  a.addEventListener('pointermove',function(ev){if(!st||ev.pointerId!==st.id)return;ev.stopPropagation();
    var dx=ev.clientX-st.x,dy=ev.clientY-st.y;if(!dragged&&dx*dx+dy*dy<TH*TH)return;
    dragged=true;a.classList.add('drag');ev.preventDefault();place(st.l+dx,st.t+dy);});
  function end(ev){if(!st||ev.pointerId!==st.id)return;ev.stopPropagation();try{a.releasePointerCapture(ev.pointerId);}catch(e){}
    st=null;a.classList.remove('drag');if(dragged){save();a.dataset.dragged=String(Date.now());}syncPlay();}
  a.addEventListener('pointerup',end);a.addEventListener('pointercancel',end);
  a.addEventListener('click',function(ev){ev.stopPropagation();
    var open=ev.target&&ev.target.closest&&ev.target.closest('a.go,.go');
    if(dragged){ev.preventDefault();dragged=false;return;}
    if(open)return;});
  a.addEventListener('dragstart',function(ev){ev.preventDefault();});
  ['touchstart','touchmove','wheel','dblclick','contextmenu'].forEach(function(t){a.addEventListener(t,function(ev){ev.stopPropagation();if(t==='contextmenu')ev.preventDefault();},{passive:t!=='contextmenu'});});

  var curSrc='';
  function rel(u){return !u?'':/^https?:/.test(u)?u:u;}
  function apply(row){
    if(!row||!row.video)return false;
    var src=rel(row.card_video||row.video), poster=row.poster?rel(row.poster):'';
    var job=row.j||'scene', placeN=row.place||'';
    jb.textContent=job+(placeN?(' · '+placeN):'');
    a.title='🎬 '+job+(placeN?(' · '+placeN):'')+' — looping';
    a.setAttribute('aria-label','🎬 '+(job)+' scene video, looping');
    if(go){go.href=URL_;go.title='Open the scene videos · '+job+(placeN?(' · '+placeN):'');}
    a.hidden=false;
    if(src===curSrc){ if(poster)vid.poster=poster; tryPlay(); return true; }
    curSrc=src;
    vid.src=src;
    if(poster){vid.poster=poster;}
    else{vid.removeAttribute('poster');vid.poster='';}
    tryPlay();
    return true;
  }
  var io=null;
  function watch(){
    if(io||typeof IntersectionObserver!=='function')return;
    try{ io=new IntersectionObserver(function(){syncPlay();},{root:null,threshold:0}); io.observe(a); }catch(e){ io=null; }
  }
  function mount(){if(!a.parentNode)document.body.appendChild(a);restore();watch();tryPlay();}
  function newest(vs){
    return (vs||[]).filter(function(x){return x&&x.video;}).slice().sort(function(a,b){
      return String(b.added||b.ts||'').localeCompare(String(a.added||a.ts||''));
    })[0];
  }
  fetch('data/videos.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(doc){
    var row=newest((doc&&doc.videos)||[]);
    if(!apply(row))return;
    if(document.body)mount();else addEventListener('DOMContentLoaded',mount);
  }).catch(function(){});
  addEventListener('resize',function(){if(a.parentNode){place(a.offsetLeft,a.offsetTop);syncPlay();}});
  document.addEventListener('visibilitychange',function(){syncPlay();});

  window.thrydVideoCard={el:a,url:URL_,
    home:function(){try{localStorage.removeItem(KEY);}catch(e){}home();syncPlay();},
    moveTo:function(x,y){place(x,y);syncPlay();},
    apply:apply,
    syncPlay:syncPlay,
    video:function(){return {src:vid.currentSrc||vid.src,poster:vid.poster,muted:vid.muted,loop:vid.loop,autoplay:vid.autoplay,paused:vid.paused,time:vid.currentTime,ready:vid.readyState,job:jb.textContent,preload:vid.preload,onScreen:onScreen()};}};
})();
