/* v586: the card now shows a live mini painting (see 'v586 live mini painting' below).
   v579 story card = v577 card (same size, same layer: body-level fixed, z-index 12) + a gentle float.
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
    '#storycard canvas{display:none;width:100%;aspect-ratio:1440/900;border-radius:5px;background:#fff;pointer-events:none}#storycard.mini canvas{display:block}#storycard.mini img{display:none}'+
    '#storycard .jb{font-weight:700;white-space:nowrap}'+
    '#storycard img{display:block;width:100%;aspect-ratio:1440/900;object-fit:cover;border-radius:5px;background:#fff;pointer-events:none}'+
    '#storycard .sl{display:flex;justify-content:space-between;align-items:center;gap:4px;margin-top:4px;pointer-events:none}'+
    '#storycard .go{font-size:10px;color:#0b5cad;white-space:nowrap}'+
    '@media (max-width:640px){#storycard{width:100px;font-size:10px;padding:4px}#storycard .go{display:none}}';
  document.head.appendChild(css);
  var a=document.createElement('a'); a.id='storycard'; a.href=URL_; a.target='_blank'; a.rel='noopener';
  a.title='Open the story so far (painted by code)'; a.setAttribute('aria-label','📐 the story so far: open the story diagram in a new tab');
  a.draggable=false;
  a.innerHTML='<canvas width="264" height="165" aria-hidden="true"></canvas><img alt="" src="story/story_painted_3d.png"><span class="sl"><span>📐 the story so far <span class="jb"></span></span><span class="go">open ↗</span></span>';
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

  /* v586 live mini painting (Jesuye 19 Nov 7:59 PM ET: "will the story object in the main projector always update as we see painting?").
     Same per-job data as /story/: story/layers.json (+ base/layer PNGs) and story/edges.json, cache-busted, re-polled every 45 s.
     The same loop (paint in stroke by stroke -> hold -> wash -> repaint) at 264x165, ~30 fps, paused when the tab is hidden;
     reduced motion = the final picture. New job data (after every seat/jump publish) swaps in without a page reload. */
  var cv=a.querySelector('canvas'),cx=cv.getContext&&cv.getContext('2d'),jb=a.querySelector('.jb');
  var RMc=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MW=264,MH=165,mm=null,mbase=null,mlay=[],mdone=document.createElement('canvas'),mwork=document.createElement('canvas'),mph='mesh',mi=0,mt=0,mcyc=0,mlast=0,mraf=0,mcur=null,mv=null,MESH_HOLD=1200;
  mdone.width=mwork.width=MW;mdone.height=mwork.height=MH;var md=mdone.getContext('2d'),mw=mwork.getContext('2d');
  function shrink(im,w,h){var c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));c.getContext('2d').drawImage(im,0,0,c.width,c.height);return c;}
  function li(src){return new Promise(function(r){var i=new Image();i.onload=function(){r(i)};i.onerror=function(){r(null)};i.src=src;});}
  function mreset(){md.clearRect(0,0,MW,MH);if(mbase)md.drawImage(mbase,0,0);}
  function mframe(t){mraf=0;if(document.hidden||!mm){mlast=0;return;}
    var dt=mlast?Math.min(80,t-mlast):33;if(mlast&&t-mlast<30){mraf=requestAnimationFrame(mframe);return;}mlast=t;
    var k=MW/mm.w,L=mlay[mi];
    if(mph==='mesh'){cx.clearRect(0,0,MW,MH);if(mbase)cx.drawImage(mbase,0,0);mt+=dt;if(mt>=MESH_HOLD){mph='paint';mt=0;mi=0;}}
    else if(mph==='paint'){
      if(!L){mph='hold';mt=0;}
      else if(L.gd){mt+=dt;var gu=Math.min(1,mt/L.T);cx.clearRect(0,0,MW,MH);cx.drawImage(mdone,0,0);L.gd(cx,gu);
        while(gu>=1&&L&&L.gd){L.gd(md,1);mi++;mt-=L.T;L=mlay[mi];gu=L?Math.min(1,mt/L.T):0;}}
      else{mt+=dt;var T=Math.min(3200,700+6*L.n),u=Math.min(1,mt/T),st=Math.max(1,Math.min(L.n,24)),q=u*st,i=Math.floor(q),sv=Math.min(1,(i+(q-i))/st);
        var ax=mm.axis,F=30,span=(L.pmax-L.pmin)*k+F,pos=L.pmin*k+sv*span;
        cx.clearRect(0,0,MW,MH);cx.drawImage(mdone,0,0);
        mw.globalCompositeOperation='source-over';mw.clearRect(0,0,MW,MH);mw.drawImage(L.c,L.x*k,L.y*k);mw.globalCompositeOperation='destination-in';
        var g=mw.createLinearGradient(ax[0]*(pos-F),ax[1]*(pos-F),ax[0]*pos,ax[1]*pos);g.addColorStop(0,'#000');g.addColorStop(1,'rgba(0,0,0,0)');mw.fillStyle=g;mw.fillRect(0,0,MW,MH);
        cx.drawImage(mwork,0,0);
        if(u>=1){md.drawImage(L.c,L.x*k,L.y*k);mi++;mt=0;}}
    }
    if(mph==='hold'){mt+=dt;cx.clearRect(0,0,MW,MH);cx.drawImage(mdone,0,0);if(mt>2200){mph='wash';mt=0;}}
    else if(mph==='wash'){mt+=dt;var w=Math.min(1,mt/1100);cx.clearRect(0,0,MW,MH);cx.drawImage(mbase,0,0);cx.globalAlpha=1-w;cx.drawImage(mdone,0,0);cx.globalAlpha=1;
      if(w>=1){mph=(a.classList.contains('drawing')?'mesh':'paint');mi=0;mt=0;mcyc++;mreset();}}
    a.dataset.mini=mph+':'+mcyc;mraf=requestAnimationFrame(mframe);}
  function mkick(){if(!mraf&&!RMc)mraf=requestAnimationFrame(mframe);}
  document.addEventListener('visibilitychange',function(){if(!document.hidden)mkick();});
  /* v588 graph mode: when story/graph.json exists (objects/characters/methods as vertices, one edge per call, subject -> argument
     object or method, numbered by call order, coloured by agenda) the mini paints those edges in index order; else the strokes above. */
  function gp(o,w){var v=o&&(o[w+'_px']||o[w+'_screen']||(o.px&&o.px[w])||(o.screen&&o.screen[w])||o[w+'_xyz']);if(v&&!Array.isArray(v)&&v.px!=null)return [+v.px,+v.py];if(!v)return null;return Array.isArray(v)?[+v[0],+v[1]]:[+v.x,+v.y];}
  function gunits(g,k){var V={},vl=g.vertices||g.nodes||[];if(!Array.isArray(vl))vl=Object.keys(vl).map(function(q){var o=vl[q];if(o.id==null)o.id=q;return o;});vl.forEach(function(v){if(typeof v.px==='number'){V[String(v.id)]=[v.px,v.py];return;}var p=v.px||v.screen||(v.x!=null?[v.x,v.y]:null);if(p)V[String(v.id||v.key||v.name)]=Array.isArray(p)?[+p[0],+p[1]]:[+p.x,+p.y];});
    var E=(g.edges||[]).map(function(e,j){return {e:e,i:e.index!=null?+e.index:(e.i!=null?+e.i:j)};}).sort(function(x,y){return x.i-y.i;}),T=Math.max(10,Math.min(400,14000/Math.max(1,E.length))),rep={},out=[];
    E.forEach(function(o,j){var e=o.e,A=gp(e,'from')||V[String(e.from)],B=gp(e,'to')||V[String(e.to)];if(!A||!B)return;var fa=String(e.from),tb=String(e.to);
      var pk=fa<tb?fa+'|'+tb:tb+'|'+fa,r=rep[pk]=(rep[pk]||0)+1,a=[A[0]*k,A[1]*k],b=[B[0]*k,B[1]*k],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,
          off=(len<0.5?0:Math.min(16,8+2*Math.floor((r-1)/2))*((r%2)?1:-1)*(fa<tb?1:-1))*k,c=[(a[0]+b[0])/2-dy/len*off,(a[1]+b[1])/2+dx/len*off],hex=e.hex||'#7c3aed';
      out.push({T:T,key:'e'+j,gd:function(x,sv){var N=10,m=Math.max(1,Math.ceil(N*sv));x.save();x.strokeStyle=hex;x.globalAlpha=.85;x.lineWidth=1;x.lineCap='round';x.beginPath();x.moveTo(a[0],a[1]);
        for(var q=1;q<=m;q++){var t=Math.min(sv,q/N),u=1-t;x.lineTo(u*u*a[0]+2*u*t*c[0]+t*t*b[0],u*u*a[1]+2*u*t*c[1]+t*t*b[1]);}x.stroke();
        if(sv>=1){x.fillStyle='#444';x.globalAlpha=1;x.fillRect(a[0]-1,a[1]-1,2,2);x.fillRect(b[0]-1,b[1]-1,2,2);}x.restore();}});});
    return out;}
  function mload(m){if(!cx||!m||!m.layers)return;
    var DRAW_BUILDING=/(?:^|[?&])(?:building|graph)=1(?:&|$)/.test(location.search);
    fetch('story/drawing.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return !DRAW_BUILDING&&r.ok?r.json():null;}).catch(function(){return null;}).then(function(d){
      if(d&&d.edges&&d.edges.length){mloadD(m,d);return;}
    fetch('story/graph.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).catch(function(){return null;}).then(function(g){
      if(g&&g.edges&&g.edges.length){var gv='g'+(g.stroke_hash?String(g.stroke_hash).slice(0,12):(g.v||g.hash||g.edges.length))+':'+g.edges.length;if(mv===gv)return;
        li('story/'+m.base+'?v='+m.v).then(function(b){if(!b)return;var k=MW/m.w;mm=m;mv=gv;mbase=shrink(b,MW,MH);mlay=gunits(g,k);a.classList.add('mini');a.classList.add('graph');a.dataset.layersV=gv;mreset();
          if(RMc){mlay.forEach(function(L){L.gd(md,1);});cx.clearRect(0,0,MW,MH);cx.drawImage(mdone,0,0);a.dataset.mini='done:0';return;}mph='paint';mi=0;mt=0;mkick();});return;}
      mloadL(m);});});}
  function mloadL(m){if(mv===m.v)return;var v=m.v;
    Promise.all([li('story/'+m.base+'?v='+v)].concat(m.layers.map(function(L){return li('story/'+L.src+'?v='+v);}))).then(function(r){
      if(!r[0])return;var k=MW/m.w;mm=m;mv=v;mbase=shrink(r[0],MW,MH);
      mlay=m.layers.map(function(L,j){return r[j+1]?{c:shrink(r[j+1],L.w*k,L.h*k),x:L.x,y:L.y,n:L.n,pmin:L.pmin,pmax:L.pmax,key:L.key}:null;}).filter(Boolean);
      a.classList.add('mini');a.dataset.layersV=String(v);mreset();
      if(RMc){mlay.forEach(function(L){md.drawImage(L.c,L.x*k,L.y*k);});cx.clearRect(0,0,MW,MH);cx.drawImage(mdone,0,0);a.dataset.mini='done:0';return;}
      mph='paint';mi=0;mt=0;mkick();});}
  var mdrawing=null;
  var EDGE_DOTS={1:'🟪',2:'🟨',3:'🟫',4:'🟩',5:'⬛'};
  function edgeChip(job, drawing){
    if(!drawing||!drawing.edge_colours||!job)return null;
    for(var k in drawing.edge_colours){
      var r=drawing.edge_colours[k];
      if((r.jobs||[]).indexOf(job)>=0)return {job:job,hex:r.hex,dot:EDGE_DOTS[k]||'',k:+k};
    }
    return null;
  }
  function newestFromDrawing(d){
    if(d&&d.latest_seated)return d.latest_seated;
    if(!d||!d.edge_colours)return null;
    var best=null,n=-1;
    for(var k in d.edge_colours){
      (d.edge_colours[k].jobs||[]).forEach(function(j){
        var m=parseInt(String(j).replace(/^j/,''),10);
        if(isFinite(m)&&m>n){n=m;best=j;}
      });
    }
    return best;
  }
  function medges(d){if(!d||!d.edges)return;
    var seated=newestFromDrawing(mdrawing)||(d.story&&d.story.latest_seated)||d.latest_seated;
    var chip=edgeChip(seated,mdrawing);
    var e=chip||(seated?d.edges.filter(function(x){return x.job===seated;})[0]:null);
    if(seated&&!e)e={job:seated,dot:'',hex:''};
    if(!e)e=d.edges.filter(function(x){return x.status==='current';})[0];
    mcur=e?e.job:(seated||null);
    jb.textContent=e?('· '+e.job+(e.dot?(' '+e.dot):'')):'';if(e&&e.hex)jb.style.color=e.hex;a.dataset.job=mcur||'';a.dataset.edgesAt=d.at||'';}
  function dunits(d,k){
    var out=[];
    if(d.strokes&&d.strokes.length){
      var src=d.strokes.slice().sort(function(a,b){
        var sa=(a.edge_k!=null&&a.edge_k!=='')?1:0, sb=(b.edge_k!=null&&b.edge_k!=='')?1:0;
        return (sa-sb)||((a.index-b.index)||((a.subord||0)-(b.subord||0))||((a.i||0)-(b.i||0)));
      });
      src.forEach(function(s,j){
        if(!s.pa||!s.pb)return;
        var a=[s.pa[0]*k,s.pa[1]*k],b=[s.pb[0]*k,s.pb[1]*k],hex=s.hex||'#2563eb',conn=s.kind==='connection',story=s.edge_k!=null&&s.edge_k!=='';
        out.push({T:story?700:180,key:'s'+j,hash:[s.index,s.call,hex,s.kind].join(':'),gd:function(x,sv){
          x.save();x.lineCap='round';x.strokeStyle=hex;
          x.lineWidth=story?(s.style==='solid'?2.8:2.3):(conn?0.8:1.0);x.globalAlpha=story?1:0.40;
          if(s.style!=='solid'||(!story&&conn))x.setLineDash(story?[5,3]:[4,3]);
          x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(a[0]+(b[0]-a[0])*sv,a[1]+(b[1]-a[1])*sv);x.stroke();x.restore();}});
      });
      return out;
    }
    (d.fills||[]).forEach(function(f,j){
      var e=d.edges[f.edge];if(!e)return;var hex=f.hex||'#7c3aed';
      var a=[e.pa[0]*k,e.pa[1]*k],b=[e.pb[0]*k,e.pb[1]*k];
      out.push({T:480,key:'f'+j,hash:String(f.index)+':'+f.edge+':'+hex,gd:function(x,sv){
        x.save();x.lineCap='round';x.strokeStyle=hex;x.lineWidth=e.hidden?1.2:1.8;x.globalAlpha=e.hidden?0.78:1;
        if(e.style!=='solid'||e.hidden)x.setLineDash([4,3]);
        x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(a[0]+(b[0]-a[0])*sv,a[1]+(b[1]-a[1])*sv);x.stroke();x.restore();}});
    });
    return out;
  }
  function mloadD(m,d){mdrawing=d;var gv='d'+(d.v||d.sig||d.n_edges);if(mv===gv)return;
    li('story/'+(d.base||'drawing_base.png')+'?v='+(d.v||m.v)).then(function(b){if(!b)return;var k=MW/(d.w||m.w||1440);
      mm=m;mv=gv;mbase=shrink(b,MW,MH);mlay=dunits(d,k);a.classList.add('mini');a.classList.add('drawing');a.dataset.layersV=gv;mreset();
      if(RMc){mlay.forEach(function(L){L.gd(md,1);});cx.clearRect(0,0,MW,MH);cx.drawImage(mdone,0,0);a.dataset.mini='done:0';applySeatedChip();return;}
      mph='mesh';mi=0;mt=0;mkick();applySeatedChip();});}
  function applySeatedChip(){
    var job=newestFromDrawing(mdrawing)||mcur||a.dataset.job;
    var chip=edgeChip(job,mdrawing);
    if(!chip||!jb)return;
    mcur=chip.job;a.dataset.job=chip.job;
    jb.textContent='· '+chip.job+(chip.dot?(' '+chip.dot):'');
    jb.style.color=chip.hex;
  }
  function mpoll(){var t=Date.now();
    fetch('story/layers.json?t='+t,{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(mload).catch(function(){});
    fetch('story/edges.json?t='+t,{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(medges).catch(function(){});}
  mpoll();setInterval(mpoll,45000);
  window.thrydStoryCard={el:a,url:URL_,home:function(){try{localStorage.removeItem(KEY);}catch(e){}home();},poll:mpoll,
    mini:function(){return {state:a.dataset.mini||'',job:a.dataset.job||'',label:jb.textContent,layersV:a.dataset.layersV||'',live:a.classList.contains('mini')};}};
})();
