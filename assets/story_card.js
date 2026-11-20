/* v578 story card (Jesuye 19 Nov 6:48 PM ET: "a small floating card object on the projector that can link you to a story";
   6:59 PM: "make it have the smallest z index, if it can be smaller, and floating").
   A tiny card (thumbnail of story/story_painted_3d.png + "📐 story"). Tap = opens /story/ in a new tab (real <a target=_blank>);
   a drag only moves it (a moved pointer cancels the click).
   Lowest layer: it lives inside the stage world (#gworld) right after the backgrounds (#gbgs) and before every cut (#gcuts),
   so every stage object, label, the code panel and the bar sit above it; it still gets taps wherever nothing covers it.
   Replay stage fallback: inside #stage under #objs. It moves and zooms with the stage like other stage objects.
   Floating: a slow 5 s bob of a few px (CSS transform on the inner box), paused while dragged, off for prefers-reduced-motion.
   First load: top-right of the view under the bar. Position kept per device in localStorage (thryd_storycard_pos, world fractions). */
(function(){
  if(window.__thrydStoryCard) return; window.__thrydStoryCard=1;
  var URL_='https://jdavidteki.github.io/thryd-projector/story/', KEY='thryd_storycard_pos', TH=6;
  var css=document.createElement('style');
  css.textContent='#storycard{position:absolute;z-index:0;display:block;width:66px;text-decoration:none;touch-action:none;pointer-events:auto;'+
    'user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;cursor:grab;color:#141414}'+
    '#storycard .sb{display:flex;flex-direction:column;padding:3px;background:#fffffff0;border-radius:6px;box-shadow:0 2px 8px #0008;'+
    'font:600 9.5px/1.2 system-ui,-apple-system,sans-serif;animation:thrydStoryBob 5s ease-in-out infinite;will-change:transform}'+
    '#storycard.drag{cursor:grabbing}#storycard.drag .sb{animation-play-state:paused;box-shadow:0 0 0 2px #ffb648,0 6px 16px #000c}'+
    '#storycard img{display:block;width:100%;aspect-ratio:1440/900;object-fit:cover;border-radius:3px;background:#fff;pointer-events:none}'+
    '#storycard .sl{display:block;margin-top:2px;text-align:center;white-space:nowrap;pointer-events:none}'+
    '@keyframes thrydStoryBob{0%,100%{transform:translate(0,0)}25%{transform:translate(1px,-3px)}50%{transform:translate(0,-4px)}75%{transform:translate(-1px,-2px)}}'+
    '@media (prefers-reduced-motion:reduce){#storycard .sb{animation:none}}'+
    '@media (max-width:640px){#storycard{width:60px}}';
  document.head.appendChild(css);
  var a=document.createElement('a'); a.id='storycard'; a.href=URL_; a.target='_blank'; a.rel='noopener'; a.draggable=false;
  a.title='Open the story so far (painted by code)'; a.setAttribute('aria-label','📐 story: open the story diagram in a new tab');
  a.innerHTML='<span class="sb"><img alt="" src="story/story_painted_3d.png"><span class="sl">📐 story</span></span>';
  var img=a.querySelector('img');
  fetch('story/story.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(j){if(j&&j.v)img.src='story/story_painted_3d.png?v='+j.v;}).catch(function(){});
  function host(){
    var gs=document.getElementById('gstage'),gw=document.getElementById('gworld'),gc=document.getElementById('gcuts');
    if(gs&&gw&&getComputedStyle(gs).display!=='none')return {p:gw,before:gc&&gc.parentNode===gw?gc:null};
    var st=document.getElementById('stage');if(st)return {p:st,before:document.getElementById('objs')};
    return {p:document.body,before:null};
  }
  function scale(p){var r=p.getBoundingClientRect();return (p.offsetWidth?r.width/p.offsetWidth:1)||1;}
  function toLocal(p,cx,cy){var r=p.getBoundingClientRect(),s=scale(p);return [(cx-r.left)/s,(cy-r.top)/s];}
  function clampLocal(p,x,y){var w=p.offsetWidth||innerWidth,h=p.offsetHeight||innerHeight;return [Math.max(0,Math.min(w-a.offsetWidth,x)),Math.max(0,Math.min(h-a.offsetHeight,y))];}
  function setLocal(x,y){var p=a.parentNode;if(!p)return;var q=clampLocal(p,x,y);a.style.left=q[0]+'px';a.style.top=q[1]+'px';}
  function home(){var p=a.parentNode;if(!p)return;var bar=document.getElementById('bar');var top=Math.max(8,(bar?bar.getBoundingClientRect().bottom:0)+10);
    var s=scale(p);var q=toLocal(p,innerWidth-a.offsetWidth*s-14,top);setLocal(q[0],q[1]);}
  function restore(){var p=a.parentNode,s=null;try{s=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){}
    if(p&&s&&s.v===2&&isFinite(s.fx)&&isFinite(s.fy))setLocal(s.fx*(p.offsetWidth||innerWidth),s.fy*(p.offsetHeight||innerHeight));else home();}
  function save(){var p=a.parentNode;if(!p)return;try{localStorage.setItem(KEY,JSON.stringify({v:2,fx:+(a.offsetLeft/(p.offsetWidth||innerWidth)).toFixed(4),fy:+(a.offsetTop/(p.offsetHeight||innerHeight)).toFixed(4)}));}catch(e){}}
  var st=null, dragged=false;
  a.addEventListener('pointerdown',function(ev){ev.stopPropagation();if(ev.pointerType==='mouse'&&ev.button!==0)return;
    st={id:ev.pointerId,x:ev.clientX,y:ev.clientY,l:a.offsetLeft,t:a.offsetTop,s:scale(a.parentNode)};dragged=false;
    try{a.setPointerCapture(ev.pointerId);}catch(e){}});
  a.addEventListener('pointermove',function(ev){if(!st||ev.pointerId!==st.id)return;ev.stopPropagation();
    var dx=ev.clientX-st.x,dy=ev.clientY-st.y;if(!dragged&&dx*dx+dy*dy<TH*TH)return;
    dragged=true;a.classList.add('drag');ev.preventDefault();setLocal(st.l+dx/st.s,st.t+dy/st.s);});
  function end(ev){if(!st||ev.pointerId!==st.id)return;ev.stopPropagation();try{a.releasePointerCapture(ev.pointerId);}catch(e){}
    st=null;a.classList.remove('drag');if(dragged){save();a.dataset.dragged=String(Date.now());}}
  a.addEventListener('pointerup',end);a.addEventListener('pointercancel',end);
  a.addEventListener('click',function(ev){ev.stopPropagation();if(dragged){ev.preventDefault();dragged=false;}});
  a.addEventListener('dragstart',function(ev){ev.preventDefault();});
  ['touchstart','touchmove','touchend','mousedown','mouseup','wheel','dblclick','contextmenu'].forEach(function(t){a.addEventListener(t,function(ev){ev.stopPropagation();if(t==='contextmenu')ev.preventDefault();},{passive:t!=='contextmenu'});});
  var placed=false;
  function mount(){var h=host();if(a.parentNode!==h.p||(h.before&&a.nextSibling!==h.before)){
      if(h.before)h.p.insertBefore(a,h.before);else h.p.insertBefore(a,h.p.firstChild?h.p.firstChild.nextSibling:null);
      if(h.p===document.body){a.style.position='fixed';a.style.zIndex='1';}else{a.style.position='';a.style.zIndex='';}
      placed=false;}
    if(!placed&&a.offsetWidth){restore();placed=true;}}
  function boot(){mount();setInterval(function(){if(!st)mount();},2000);}
  if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot);else boot();
  setTimeout(mount,1200);setTimeout(mount,4000);
  addEventListener('resize',function(){if(a.parentNode)setLocal(a.offsetLeft,a.offsetTop);});
  window.thrydStoryCard={el:a,url:URL_,home:function(){try{localStorage.removeItem(KEY);}catch(e){}home();},mount:mount,
    moveTo:function(cx,cy){var p=a.parentNode;if(!p)return;var q=toLocal(p,cx,cy);setLocal(q[0],q[1]);save();}};
})();
