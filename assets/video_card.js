/* v600: a floating video card the same size and style as #storycard (Jesuye 20 Nov 5:17 PM ET:
   "maybe a video card floating on projector, size of story card").
   Plays the newest Draw a story scene from data/videos.json (muted, autoplay, looping, playsinline).
   Tap opens /videos/ in a new tab. Drag only moves it (a moved pointer cancels the click).
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
    '#videocard .go{font-size:10px;color:#0b5cad;white-space:nowrap}'+
    '@media (max-width:640px){#videocard{width:100px;font-size:10px;padding:4px}#videocard .go{display:none}}';
  document.head.appendChild(css);

  var a=document.createElement('a'); a.id='videocard'; a.href=URL_; a.target='_blank'; a.rel='noopener';
  a.title='Open the scene videos'; a.setAttribute('aria-label','🎬 scene video: open the videos page in a new tab');
  a.draggable=false; a.hidden=true;
  a.innerHTML='<video muted autoplay loop playsinline preload="auto" aria-hidden="true"></video><span class="sl"><span>🎬 <span class="jb">scene</span></span><span class="go">open ↗</span></span>';
  var vid=a.querySelector('video'), jb=a.querySelector('.jb');
  vid.muted=true; vid.defaultMuted=true; vid.autoplay=true; vid.loop=true; vid.playsInline=true;
  vid.setAttribute('muted',''); vid.setAttribute('autoplay',''); vid.setAttribute('loop','');
  vid.setAttribute('playsinline',''); vid.setAttribute('webkit-playsinline','');
  function tryPlay(){ var p=vid.play(); if(p&&p.catch)p.catch(function(){}); }
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
    st={id:ev.pointerId,x:ev.clientX,y:ev.clientY,l:a.offsetLeft,t:a.offsetTop};dragged=false;
    try{a.setPointerCapture(ev.pointerId);}catch(e){}});
  a.addEventListener('pointermove',function(ev){if(!st||ev.pointerId!==st.id)return;ev.stopPropagation();
    var dx=ev.clientX-st.x,dy=ev.clientY-st.y;if(!dragged&&dx*dx+dy*dy<TH*TH)return;
    dragged=true;a.classList.add('drag');ev.preventDefault();place(st.l+dx,st.t+dy);});
  function end(ev){if(!st||ev.pointerId!==st.id)return;ev.stopPropagation();try{a.releasePointerCapture(ev.pointerId);}catch(e){}
    st=null;a.classList.remove('drag');if(dragged){save();a.dataset.dragged=String(Date.now());}}
  a.addEventListener('pointerup',end);a.addEventListener('pointercancel',end);
  a.addEventListener('click',function(ev){ev.stopPropagation();if(dragged){ev.preventDefault();dragged=false;}});
  a.addEventListener('dragstart',function(ev){ev.preventDefault();});
  ['touchstart','touchmove','wheel','dblclick','contextmenu'].forEach(function(t){a.addEventListener(t,function(ev){ev.stopPropagation();if(t==='contextmenu')ev.preventDefault();},{passive:t!=='contextmenu'});});

  function rel(u){return !u?'':/^https?:/.test(u)?u:u;}
  function apply(row){
    if(!row||!row.video)return false;
    vid.src=rel(row.card_video||row.video);
    if(row.poster)vid.poster=rel(row.poster);
    var job=row.j||'scene', place=row.place||'';
    jb.textContent=job+(place?(' · '+place):'');
    a.title='Open the scene videos · '+job+(place?(' · '+place):'');
    a.setAttribute('aria-label','🎬 '+(job)+' scene video: open the videos page in a new tab');
    a.hidden=false;
    tryPlay();
    return true;
  }
  function mount(){if(!a.parentNode)document.body.appendChild(a);restore();tryPlay();}
  fetch('data/videos.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(doc){
    var vs=(doc&&doc.videos)||[];
    var row=vs.filter(function(x){return x&&x.run==='story-draw-120';})[0]||vs[0];
    if(!apply(row))return;
    if(document.body)mount();else addEventListener('DOMContentLoaded',mount);
  }).catch(function(){});
  addEventListener('resize',function(){if(a.parentNode)place(a.offsetLeft,a.offsetTop);});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)tryPlay();});

  window.thrydVideoCard={el:a,url:URL_,
    home:function(){try{localStorage.removeItem(KEY);}catch(e){}home();},
    moveTo:function(x,y){place(x,y);},
    video:function(){return {src:vid.currentSrc||vid.src,poster:vid.poster,muted:vid.muted,loop:vid.loop,paused:vid.paused,time:vid.currentTime,ready:vid.readyState,job:jb.textContent};}};
})();
