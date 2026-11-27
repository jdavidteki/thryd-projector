/* v10 (20 Nov 1:05 AM ET): source-agenda strokes thicker, live blue fainter.
   v586: the card now shows a live mini painting (see 'v586 live mini painting' below).
   v579 story card = v577 card (same size, body-level fixed) + a gentle float. z-index 13 sits above #videocard (12) so the outline count stays visible.
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
  css.textContent='#storycard{position:fixed;z-index:13;display:flex;flex-direction:column;align-items:stretch;width:132px;padding:5px;'+
    'background:#fffffff2;color:#141414;border-radius:9px;box-shadow:0 4px 16px #0009;text-decoration:none;touch-action:none;'+
    'user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;cursor:grab;font:600 11px/1.25 system-ui,-apple-system,sans-serif;animation:thrydStoryBob 5s ease-in-out infinite;will-change:transform}'+
    '@keyframes thrydStoryBob{0%,100%{transform:translate(0,0)}25%{transform:translate(1px,-3px)}50%{transform:translate(0,-4px)}75%{transform:translate(-1px,-2px)}}'+
    '@media (prefers-reduced-motion:reduce){#storycard{animation:none}}'+
    '#storycard.drag{animation-play-state:paused;cursor:grabbing;box-shadow:0 0 0 2px #ffb648,0 10px 24px #000c}'+
    '#storycard canvas{display:none;width:100%;aspect-ratio:1440/900;border-radius:5px;background:#fff;pointer-events:none}#storycard.mini canvas{display:block}#storycard.mini img{display:none}'+
    '#storycard .jb{font-weight:700;white-space:nowrap}'+
    '#storycard img{display:block;width:100%;aspect-ratio:1440/900;object-fit:cover;border-radius:5px;background:#fff;pointer-events:none}'+
    '#storycard .sl{display:flex;justify-content:space-between;align-items:center;gap:4px;margin-top:4px;pointer-events:none;white-space:nowrap;font-size:9px}'+
    '#storycard .sl>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
    '#storycard .go{display:none}'+
    '#storycard .oc{display:block;margin-top:3px;font:700 8px/1.25 system-ui,-apple-system,sans-serif;color:#222;pointer-events:none;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
    '@media (max-width:640px){#storycard{width:100px;font-size:10px;padding:4px}#storycard .go{display:none}#storycard .sl{font-size:8px}#storycard .oc{font-size:7px}}';
  document.head.appendChild(css);
  var a=document.createElement('a'); a.id='storycard'; a.href=URL_; a.target='_blank'; a.rel='noopener';
  a.title='Open the story so far (painted by code)'; a.setAttribute('aria-label','📐 the story so far: open the story diagram in a new tab');
  a.draggable=false;
  a.innerHTML='<canvas width="264" height="165" aria-hidden="true"></canvas><img alt="" src="story/story_painted_3d.png"><span class="sl"><span>📐 the story <span class="jb"></span></span><span class="go">open ↗</span></span><span class="oc" aria-live="polite">0 coloured · 0/319</span>';
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
  /* card spin (Jesuye 22 Nov 2026 5:29 PM ET): same yaw-then-iso as /story/ gode.js, on this 264x165 canvas.
     One turn / 18 s, ~25 fps, paused when hidden. Drag still only moves the card. Labels stay off while turning. */
  var view={yaw:0,pitch:0,ox:576.79375,oy:343.60156,S:21.13212,cx:0,cy:0,cz:0,C:Math.cos(Math.PI/6),H:0.5,spin:true,rate:Math.PI*2/18000};
  function solve3(m,b){function D(a,b,c,d,e,f,g,h,i){return a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);}var d=D(m[0],m[1],m[2],m[3],m[4],m[5],m[6],m[7],m[8]);if(!d)return null;return[D(b[0],m[1],m[2],b[1],m[4],m[5],b[2],m[7],m[8])/d,D(m[0],b[0],m[2],m[3],b[1],m[5],m[6],b[2],m[8])/d,D(m[0],m[1],b[0],m[3],m[4],b[1],m[6],m[7],b[2])/d];}
  function fitView(d){
    var pts=[],C=view.C,H=view.H;
    function add(a,p){if(a&&p&&a.length>=3&&p.length>=2)pts.push({a:a,p:p});}
    (d.strokes||[]).forEach(function(s){add(s.a,s.pa);add(s.b,s.pb);});
    (d.edges||[]).forEach(function(e){add(e.a,e.pa);add(e.b,e.pb);});
    if(!pts.length)return;
    var cx=0,cy=0,cz=0,n=pts.length,i,a,p,u,v;
    for(i=0;i<n;i++){a=pts[i].a;cx+=a[0];cy+=a[1];cz+=a[2];}
    view.cx=cx/n;view.cy=cy/n;view.cz=cz/n;
    var A13=0,A23=0,A33=0,b1=0,b2=0,b3=0;
    for(i=0;i<n;i++){a=pts[i].a;p=pts[i].p;u=(a[0]-a[2])*C;v=(a[0]+a[2])*H-a[1];A13+=u;A23+=v;A33+=u*u+v*v;b1+=p[0];b2+=p[1];b3+=u*p[0]+v*p[1];}
    var sol=solve3([n,0,A13,0,n,A23,A13,A23,A33],[b1,b2,b3]);
    if(sol&&isFinite(sol[0])&&isFinite(sol[1])&&isFinite(sol[2])&&sol[2]>0){view.ox=sol[0];view.oy=sol[1];view.S=sol[2];}
  }
  function sk(){return MW/(mm&&mm.w||1440);}
  function pr3(p){
    if(!p||p.length<3)return null;
    var k=sk(),x=p[0]-view.cx,y=p[1]-view.cy,z=p[2]-view.cz,c=Math.cos(view.yaw),s=Math.sin(view.yaw);
    var x1=x*c-z*s,z1=x*s+z*c,cp=Math.cos(view.pitch),sp=Math.sin(view.pitch);
    var y1=y*cp-z1*sp,z2=y*sp+z1*cp;
    x1+=view.cx;y1+=view.cy;z2+=view.cz;
    return [(view.ox+(x1-z2)*view.C*view.S)*k,(view.oy+(x1+z2)*view.H*view.S-y1*view.S)*k];
  }
  function inkPts(s){var a=s.a?pr3(s.a):null,b=s.b?pr3(s.b):null;if(a&&b)return[a,b];var k=sk();return (s.pa&&s.pb)?[[s.pa[0]*k,s.pa[1]*k],[s.pb[0]*k,s.pb[1]*k]]:null;}
  function tickView(dt){if(view.spin&&!RMc&&!document.hidden)view.yaw+=dt*view.rate;}
  function liveMesh(){return !RMc&&a.classList.contains('drawing')&&!!mdrawing;}
  function drawMesh(x){
    if(!x||!mdrawing)return;
    x.fillStyle='rgb(247,245,239)';x.fillRect(0,0,MW,MH);
    (mdrawing.edges||[]).forEach(function(e){
      var pq=inkPts(e);if(!pq)return;
      x.save();x.lineCap='round';x.lineJoin='round';
      x.strokeStyle=e.style==='solid'?'rgb(118,116,112)':'rgb(168,166,160)';
      x.lineWidth=e.style==='solid'?0.9:0.6;
      if(e.style!=='solid')x.setLineDash([3,2]);
      x.beginPath();x.moveTo(pq[0][0],pq[0][1]);x.lineTo(pq[1][0],pq[1][1]);x.stroke();x.restore();
    });
    if(mbase&&mbase.width){
      var k=sk();
      function stamp(sx,sy,sw,sh){if(sw>0&&sh>0)x.drawImage(mbase,sx*k,sy*k,sw*k,sh*k,sx*k,sy*k,sw*k,sh*k);}
      stamp(12,12,400,40);stamp(1358,8,82,72);stamp(20,736,170,140);
      var tb=mtitleBlock();if(tb&&tb.x!=null)stamp(tb.x,tb.y,tb.w,tb.h);
    }
  }
  function mrebuild(){
    if(!md)return;
    if(liveMesh()){var n=(mph==='hold'||mph==='wash'||RMc)?mlay.length:mi;drawMesh(md);for(var i=0;i<n;i++)if(mlay[i]&&mlay[i].gd)mlay[i].gd(md,1);}
    else{md.clearRect(0,0,MW,MH);if(mbase)md.drawImage(mbase,0,0);}
  }
  function shrink(im,w,h){var c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));c.getContext('2d').drawImage(im,0,0,c.width,c.height);return c;}
  function li(src){return new Promise(function(r){var i=new Image();i.onload=function(){r(i)};i.onerror=function(){r(null)};i.src=src;});}
  function mreset(){if(liveMesh()){drawMesh(md);}else{md.clearRect(0,0,MW,MH);if(mbase)md.drawImage(mbase,0,0);}}
  function mtitleBlock(){
    var d=mdrawing; if(!d)return null;
    if(d.title_block&&d.title_block.count)return d.title_block;
    var tw=420, path=String(d.coherence||''), approx=Math.max(2, Math.ceil(path.length/54));
    var th=168+12*approx, x0=(d.w||1440)-tw-18, y0=(d.h||900)-th-16;
    return {n_outline:d.n_edges||0,paper:[242,240,234],fill:[36,36,38],
      count:{x:x0+12,y:y0+65,w:tw-24,h:15,size:11,prefix:'outline coloured  ',suffix:' of '+(d.n_edges||0)}};
  }
  function moutlineNow(){
    if(!mdrawing)return 0;
    var seen={}, n=0, i, from=0, to=0;
    function add(s){if(s&&s.kind==='outline'&&s.edge!=null&&seen[s.edge]==null){seen[s.edge]=1;n++;}}
    if(RMc){for(i=0;i<mlay.length;i++)add(mlay[i]);return n;}
    if(mph==='mesh')return 0;
    to=(mph==='hold'||mph==='wash')?mlay.length:mi;
    for(i=0;i<to;i++)add(mlay[i]);
    if(mph==='paint'||mph==='hold'||mph==='wash')add(mlay[mi]);
    return n;
  }
  function mstrokesNow(){
    if(!mdrawing)return 0;
    if(RMc)return mlay.length;
    if(mph==='mesh')return 0;
    if(mph==='hold'||mph==='wash')return mlay.length;
    return mi+(mlay[mi]?1:0);
  }
  function fmtCount(n){n=Math.max(0,Math.floor(+n||0));return String(n).replace(/\B(?=(\d{3})+(?!\d))/g,',');}
  function countLine(){
    var outline=moutlineNow(), nOutline=(mdrawing&&((mdrawing.title_block&&mdrawing.title_block.n_outline)||mdrawing.n_edges))||0;
    return fmtCount(mstrokesNow())+' coloured · '+outline+'/'+nOutline+' outline';
  }
  function mpaintOutlineCount(x){
    var tb=mtitleBlock()||{}, c=tb.count, n=moutlineNow(), total=tb.n_outline||(mdrawing&&mdrawing.n_edges)||0;
    var line=countLine();
    var lab=a.querySelector('.oc');
    if(lab)lab.textContent=fmtCount(mstrokesNow())+' coloured · '+moutlineNow()+'/'+(tb.n_outline||(mdrawing&&mdrawing.n_edges)||0);
    a.dataset.outline=n+'/'+total;
    a.dataset.coloured=String(mstrokesNow());
    if(!c||!x||!mm)return;
    var k=MW/(mm.w||1440), paper=tb.paper||[242,240,234], ink=tb.fill||[36,36,38];
    x.save();
    x.fillStyle='rgb('+paper[0]+','+paper[1]+','+paper[2]+')';
    x.fillRect(c.x*k-1,c.y*k-1,(c.w||396)*k+2,(c.h||15)*k+2);
    x.fillStyle='rgb('+ink[0]+','+ink[1]+','+ink[2]+')';
    x.font=Math.max(3,(c.size||11)*k)+'px "Nimbus Roman","Times New Roman",Times,serif';
    x.textAlign='left';x.textBaseline='top';
    x.fillText(line, c.x*k, c.y*k);
    x.restore();
  }
  function mframe(t){mraf=0;if(document.hidden||!mm){mlast=0;return;}
    var step=liveMesh()?40:30,dt=mlast?Math.min(80,t-mlast):33;if(mlast&&t-mlast<step){mraf=(window.LH?LH.deco:requestAnimationFrame)(mframe);return;}mlast=t;
    if(liveMesh())tickView(dt);
    var k=MW/mm.w,L=mlay[mi];
    if(liveMesh())mrebuild();
    if(mph==='mesh'){cx.clearRect(0,0,MW,MH);if(liveMesh())drawMesh(cx);else if(mbase)cx.drawImage(mbase,0,0);mt+=dt;if(mt>=MESH_HOLD){mph='paint';mt=0;mi=0;}}
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
    else if(mph==='wash'){mt+=dt;var w=Math.min(1,mt/1100);cx.clearRect(0,0,MW,MH);if(liveMesh())drawMesh(cx);else if(mbase)cx.drawImage(mbase,0,0);cx.globalAlpha=1-w;cx.drawImage(mdone,0,0);cx.globalAlpha=1;
      if(w>=1){mph=(a.classList.contains('drawing')?'mesh':'paint');mi=0;mt=0;mcyc++;mreset();}}
    if(a.classList.contains('drawing'))mpaintOutlineCount(cx);
    a.dataset.mini=mph+':'+mcyc;mraf=(window.LH?LH.deco:requestAnimationFrame)(mframe);}
  function mkick(){if(!mraf&&!RMc)mraf=(window.LH?LH.deco:requestAnimationFrame)(mframe);}
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
          if(RMc){mlay.forEach(function(L){L.gd(md,1);});cx.clearRect(0,0,MW,MH);cx.drawImage(mdone,0,0);if(a.classList.contains('drawing'))mpaintOutlineCount(cx);a.dataset.mini='done:0';return;}mph='paint';mi=0;mt=0;mkick();});return;}
      mloadL(m);});});}
  function mloadL(m){if(mv===m.v)return;var v=m.v;
    Promise.all([li('story/'+m.base+'?v='+v)].concat(m.layers.map(function(L){return li('story/'+L.src+'?v='+v);}))).then(function(r){
      if(!r[0])return;var k=MW/m.w;mm=m;mv=v;mbase=shrink(r[0],MW,MH);
      mlay=m.layers.map(function(L,j){return r[j+1]?{c:shrink(r[j+1],L.w*k,L.h*k),x:L.x,y:L.y,n:L.n,pmin:L.pmin,pmax:L.pmax,key:L.key}:null;}).filter(Boolean);
      a.classList.add('mini');a.dataset.layersV=String(v);mreset();
      if(RMc){mlay.forEach(function(L){md.drawImage(L.c,L.x*k,L.y*k);});cx.clearRect(0,0,MW,MH);cx.drawImage(mdone,0,0);if(a.classList.contains('drawing'))mpaintOutlineCount(cx);a.dataset.mini='done:0';return;}
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
        var oa=a.kind==='outline'?0:1, ob=b.kind==='outline'?0:1;
        return (oa-ob)||((a.index-b.index)||((a.subord||0)-(b.subord||0))||((a.i||0)-(b.i||0)));
      });
      src.forEach(function(s,j){
        if(!(s.a&&s.b)&&(!s.pa||!s.pb))return;
        /* v647: a seated returning (hook) line keeps its own colour (data/role_colors.json, carried as s.color) */
        var hex=(s.role==='hook'&&/^#[0-9a-f]{6}$/i.test(s.color||''))?s.color:(s.hex||'#2563eb'),conn=s.kind==='connection',story=(s.edge_k!=null&&s.edge_k!=='')||s.role==='hook',srcA=!story&&hex.toLowerCase()!=='#2563eb';
        out.push({T:story?700:(srcA?320:120),key:'s'+j,hash:[s.index,s.call,hex,s.kind].join(':'),kind:s.kind,edge:s.edge,gd:function(x,sv){
          var pq=inkPts(s);if(!pq)return;var a=pq[0],b=pq[1];
          x.save();x.lineCap='round';x.strokeStyle=hex;
          /* v10 (Jesuye 20 Nov 1:01 AM ET "still one colour on thr projector"): live blue recedes, source agendas and
             story edges carry the colour so 5+ inks read at 264x165 */
          x.lineWidth=story?(s.style==='solid'?3.2:2.8):(srcA?1.5:(conn?0.7:0.8));x.globalAlpha=story?1:(srcA?0.9:0.32);
          if(s.style!=='solid'||(!story&&conn))x.setLineDash(story?[5,3]:(srcA?[5,2]:[3,3]));
          x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(a[0]+(b[0]-a[0])*sv,a[1]+(b[1]-a[1])*sv);x.stroke();x.restore();}});
      });
      return out;
    }
    (d.fills||[]).forEach(function(f,j){
      var e=d.edges[f.edge];if(!e)return;var hex=f.hex||'#7c3aed';
      out.push({T:480,key:'f'+j,hash:String(f.index)+':'+f.edge+':'+hex,gd:function(x,sv){
        var pq=inkPts(e);if(!pq)return;var a=pq[0],b=pq[1];
        x.save();x.lineCap='round';x.strokeStyle=hex;x.lineWidth=e.hidden?1.2:1.8;x.globalAlpha=e.hidden?0.78:1;
        if(e.style!=='solid'||e.hidden)x.setLineDash([4,3]);
        x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(a[0]+(b[0]-a[0])*sv,a[1]+(b[1]-a[1])*sv);x.stroke();x.restore();}});
    });
    return out;
  }
  function mloadD(m,d){mdrawing=d;fitView(d);var gv='d'+(d.v||d.sig||d.n_edges);if(mv===gv)return;
    li('story/'+(d.base||'drawing_base.png')+'?v='+(d.v||m.v)).then(function(b){if(!b)return;var k=MW/(d.w||m.w||1440);
      mm=m;mv=gv;mbase=shrink(b,MW,MH);mlay=dunits(d,k);a.classList.add('mini');a.classList.add('drawing');a.dataset.layersV=gv;mreset();
      if(RMc){mlay.forEach(function(L){L.gd(md,1);});cx.clearRect(0,0,MW,MH);cx.drawImage(mdone,0,0);if(a.classList.contains('drawing'))mpaintOutlineCount(cx);a.dataset.mini='done:0';applySeatedChip();return;}
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
  // cut object code is lazy: cards call these only when they need a line, never on load (data/medium_cuts_code.json).
  function cardCutCode(mid,cut){var A=window.thrydCutCode;return A&&A.forCut?A.forCut(mid,cut):[];}
  function cardLoadCutCode(mid){var A=window.thrydCutCode;return A&&A.load?A.load(mid):Promise.resolve([]);}  
  function cardCutHops(mid,cut){var A=window.thrydCutCode;return A&&A.hops?A.hops(mid,cut):[];}
  window.thrydStoryCard={el:a,url:URL_,home:function(){try{localStorage.removeItem(KEY);}catch(e){}home();},poll:mpoll,cutCode:cardCutCode,loadCutCode:cardLoadCutCode,hops:cardCutHops,
    mini:function(){return {state:a.dataset.mini||'',job:a.dataset.job||'',label:jb.textContent,layersV:a.dataset.layersV||'',live:a.classList.contains('mini'),outline:a.dataset.outline||'',coloured:a.dataset.coloured||'',oc:(a.querySelector('.oc')||{}).textContent||'',yaw:view.yaw,pitch:view.pitch,spin:view.spin,rate:view.rate};},view:function(){return {yaw:view.yaw,pitch:view.pitch,spin:view.spin,rate:view.rate,ox:view.ox,oy:view.oy,S:view.S,cx:view.cx,cy:view.cy,cz:view.cz};},setView:function(o){if(!o)return;if(o.yaw!=null)view.yaw=+o.yaw;if(o.pitch!=null)view.pitch=+o.pitch;if(o.spin!=null)view.spin=!!o.spin;if(o.rate!=null&&isFinite(+o.rate))view.rate=+o.rate;}};
})();
