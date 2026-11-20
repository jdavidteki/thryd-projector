/* v579 story card = v577 card (same size, same layer: body-level fixed, z-index 12) + a gentle float.
   Float (Jesuye 19 Nov 7:09 PM ET: "revert this change and just make it float"): slow 5 s bob of a few px (CSS transform),
   paused while dragged, off for prefers-reduced-motion. The v578 lowest-layer/half-size change is reverted.
   v577 card (Jesuye 19 Nov 6:48 PM ET, church: "a small floating card object on the projector that can link you to a story").
   A small floating card with a thumbnail of story/story_painted_3d.png and "📐 the story so far".
   Tap = opens https://jdavidteki.github.io/thryd-projector/story/ in a new tab (it is a real <a target=_blank>).
   Drag = only moves it (a moved pointer cancels the click). It lives outside the zoom canvas, so it works the same at 1x
   and zoomed, and the global pan/pinch/tap handlers ignore it (it is an <a>; its pointer events stop at the card).
   First load: top-right under the bar (off the stage centre). Position is kept per device in localStorage (thryd_storycard_pos). */
(function(){
  if(window.__thrydStoryCard) return; window.__thrydStoryCard=1;
  var URL_='https://jdavidteki.github.io/thryd-projector/story/', KEY='thryd_storycard_pos', TH=6;
  var css=document.createElement('style');
  css.textContent='#storycard{position:fixed;z-index:12;display:flex;flex-direction:column;align-items:stretch;width:132px;padding:5px;'+
    'background:#fffffff2;color:#141414;border-radius:9px;box-shadow:0 4px 16px #0009;text-decoration:none;touch-action:none;'+
    'user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;cursor:grab;font:600 11px/1.25 system-ui,-apple-system,sans-serif;animation:thrydStoryBob 5s ease-in-out infinite;will-change:transform}'+
    '@keyframes thrydStoryBob{0%,100%{transform:translate(0,0)}25%{transform:translate(1px,-3px)}50%{transform:translate(0,-4px)}75%{transform:translate(-1px,-2px)}}'+
    '@media (prefers-reduced-motion:reduce){#storycard{animation:none}}'+
    '#storycard.drag{animation-play-state:paused;cursor:grabbing;box-shadow:0 0 0 2px #ffb648,0 10px 24px #000c}'+
    '#storycard img{display:block;width:100%;aspect-ratio:1440/900;object-fit:cover;border-radius:5px;background:#fff;pointer-events:none}'+
    '#storycard .sl{display:flex;justify-content:space-between;align-items:center;gap:4px;margin-top:4px;pointer-events:none}'+
    '#storycard .go{font-size:10px;color:#0b5cad;white-space:nowrap}'+
    '@media (max-width:640px){#storycard{width:100px;font-size:10px;padding:4px}#storycard .go{display:none}}';
  document.head.appendChild(css);
  var a=document.createElement('a'); a.id='storycard'; a.href=URL_; a.target='_blank'; a.rel='noopener';
  a.title='Open the story so far (painted by code)'; a.setAttribute('aria-label','📐 the story so far: open the story diagram in a new tab');
  a.draggable=false;
  a.innerHTML='<img alt="" src="story/story_painted_3d.png"><span class="sl"><span>📐 the story so far</span><span class="go">open ↗</span></span>';
  var img=a.querySelector('img');
  fetch('story/story.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(j){if(j&&j.v)img.src='story/story_painted_3d.png?v='+j.v;}).catch(function(){});
  function clamp(x,y){var w=a.offsetWidth||132,h=a.offsetHeight||100;return [Math.max(4,Math.min(innerWidth-w-4,x)),Math.max(4,Math.min(innerHeight-h-4,y))];}
  function place(x,y){var p=clamp(x,y);a.style.left=p[0]+'px';a.style.top=p[1]+'px';a.style.right='auto';a.style.bottom='auto';}
  function home(){var bar=document.getElementById('bar');var top=Math.max(8,(bar?bar.getBoundingClientRect().bottom:0)+8);place(innerWidth-(a.offsetWidth||132)-12,top);}
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
  function mount(){document.body.appendChild(a);restore();}
  if(document.body)mount();else addEventListener('DOMContentLoaded',mount);
  addEventListener('resize',function(){place(a.offsetLeft,a.offsetTop);});
  window.thrydStoryCard={el:a,url:URL_,home:function(){try{localStorage.removeItem(KEY);}catch(e){}home();}};
})();
