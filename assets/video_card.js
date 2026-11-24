/* v600 video card, tap-to-play (Jesuye 23 Nov 8:27 PM ET: play only when touched, to cut phone heat).
   Newest Draw a story scene from data/videos.json (muted, playsinline, no autoplay, no loop, preload=metadata).
   Still frame until tap (poster, or ~0.1 s). Tap plays once; a second tap pauses; ended returns to the still.
   Pauses when low-heat goes idle or the page is hidden. A new scene swaps the source and does not autoplay.
   Drag only moves it (a moved pointer is not a tap). "open ↗" opens /videos/ in a new tab.
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
    '#videocard .vw{position:relative;display:block;width:100%}'+
    '#videocard video,#videocard .po{display:block;width:100%;aspect-ratio:1440/900;object-fit:cover;border-radius:5px;background:#111;pointer-events:none}'+
    '#videocard .po{position:absolute;inset:0;height:100%}'+
    '#videocard .ph{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:22px;height:22px;border-radius:50%;'+
    'background:#000a;color:#fff;font:700 11px/22px system-ui,-apple-system,sans-serif;text-align:center;pointer-events:none;padding-left:2px}'+
    '#videocard.playing .ph,#videocard.playing .po{display:none}'+
    '#videocard .jb{font-weight:700;white-space:nowrap}'+
    '#videocard .sl{display:flex;justify-content:space-between;align-items:center;gap:4px;margin-top:4px;pointer-events:none}'+
    '#videocard .go{font-size:10px;color:#0b5cad;white-space:nowrap;pointer-events:auto;cursor:pointer;text-decoration:none}'+
    '@media (max-width:640px){#videocard{width:100px;font-size:10px;padding:4px}#videocard .go{display:none}}';
  document.head.appendChild(css);

  var a=document.createElement('div'); a.id='videocard';
  a.title='🎬 scene video: tap to play'; a.setAttribute('aria-label','🎬 scene video: tap to play');
  a.setAttribute('role','group'); a.draggable=false; a.hidden=true;
  a.innerHTML='<div class="vw"><video muted playsinline preload="metadata" aria-hidden="true"></video><img class="po" alt="" hidden><span class="ph" aria-hidden="true">▶</span></div><span class="sl"><span>🎬 <span class="jb">scene</span></span><a class="go" href="'+URL_+'" target="_blank" rel="noopener">open ↗</a></span>';
  var vid=a.querySelector('video'), jb=a.querySelector('.jb'), po=a.querySelector('.po'), go=a.querySelector('.go');
  vid.muted=true; vid.defaultMuted=true; vid.autoplay=false; vid.loop=false; vid.playsInline=true; vid.preload='metadata';
  vid.setAttribute('muted',''); vid.setAttribute('playsinline',''); vid.setAttribute('webkit-playsinline',''); vid.setAttribute('preload','metadata');
  vid.removeAttribute('autoplay'); vid.removeAttribute('loop');

  var want=false, curSrc='';
  function still(){
    want=false;
    try{vid.pause();}catch(e){}
    a.classList.remove('playing');
    if(po&&po.getAttribute('src')){po.hidden=false;}
    else armStillFrame();
  }
  function armStillFrame(){
    if(want||(po&&po.getAttribute('src')))return;
    if(vid.readyState<1)return;
    var t=0.1;
    if(isFinite(vid.duration)&&vid.duration>0)t=Math.min(0.1,vid.duration);
    try{if(Math.abs((vid.currentTime||0)-t)>0.04)vid.currentTime=t;}catch(e){}
  }
  function playScene(){
    want=true;
    a.classList.add('playing');
    if(po)po.hidden=true;
    var p=vid.play();
    if(p&&p.catch)p.catch(function(){if(want)still();});
  }
  function toggle(){if(want&&!vid.paused)still();else playScene();}
  vid.addEventListener('ended',function(){still();});
  vid.addEventListener('play',function(){if(!want){try{vid.pause();}catch(e){}}});
  vid.addEventListener('loadedmetadata',function(){if(!want)armStillFrame();});

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
    st=null;a.classList.remove('drag');if(dragged){save();a.dataset.dragged=String(Date.now());}}
  a.addEventListener('pointerup',end);a.addEventListener('pointercancel',end);
  a.addEventListener('click',function(ev){ev.stopPropagation();
    var open=ev.target&&ev.target.closest&&ev.target.closest('a.go,.go');
    if(dragged){ev.preventDefault();dragged=false;return;}
    if(open)return;
    ev.preventDefault();toggle();});
  a.addEventListener('dragstart',function(ev){ev.preventDefault();});
  ['touchstart','touchmove','wheel','dblclick','contextmenu'].forEach(function(t){a.addEventListener(t,function(ev){ev.stopPropagation();if(t==='contextmenu')ev.preventDefault();},{passive:t!=='contextmenu'});});

  function rel(u){return !u?'':/^https?:/.test(u)?u:u;}
  function apply(row){
    if(!row||!row.video)return false;
    var src=rel(row.card_video||row.video), poster=row.poster?rel(row.poster):'';
    var job=row.j||'scene', placeN=row.place||'';
    jb.textContent=job+(placeN?(' · '+placeN):'');
    a.title='🎬 '+job+(placeN?(' · '+placeN):'')+' — tap to play';
    a.setAttribute('aria-label','🎬 '+(job)+' scene video: tap to play');
    if(go){go.href=URL_;go.title='Open the scene videos · '+job+(placeN?(' · '+placeN):'');}
    a.hidden=false;
    if(src===curSrc){
      if(poster){vid.poster=poster;if(po){po.src=poster;if(!want)po.hidden=false;}}
      return true;
    }
    curSrc=src;
    still();
    vid.src=src;
    if(poster){
      vid.poster=poster;
      if(po){po.src=poster;po.hidden=false;}
    }else{
      vid.removeAttribute('poster');vid.poster='';
      if(po){po.removeAttribute('src');po.hidden=true;}
      armStillFrame();
    }
    return true;
  }
  function mount(){if(!a.parentNode)document.body.appendChild(a);restore();}
  fetch('data/videos.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(doc){
    var vs=(doc&&doc.videos)||[];
    var row=vs.filter(function(x){return x&&x.run==='story-draw-120';})[0]||vs[0];
    if(!apply(row))return;
    if(document.body)mount();else addEventListener('DOMContentLoaded',mount);
  }).catch(function(){});
  addEventListener('resize',function(){if(a.parentNode)place(a.offsetLeft,a.offsetTop);});
  function heatStop(){if(want||!vid.paused)still();}
  document.addEventListener('visibilitychange',function(){if(document.hidden)heatStop();});
  if(window.LH&&typeof LH.on==='function')LH.on(function(s){if(s==='idle'||s==='hidden')heatStop();});

  window.thrydVideoCard={el:a,url:URL_,
    home:function(){try{localStorage.removeItem(KEY);}catch(e){}home();},
    moveTo:function(x,y){place(x,y);},
    apply:apply,
    video:function(){return {src:vid.currentSrc||vid.src,poster:vid.poster,muted:vid.muted,loop:vid.loop,autoplay:vid.autoplay,paused:vid.paused,time:vid.currentTime,ready:vid.readyState,job:jb.textContent,want:want,preload:vid.preload};}};
})();
