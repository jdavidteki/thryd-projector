/* painted by gode: the story building paints itself in, agenda by agenda, stroke by stroke (Jesuye 19 Nov 2026 7:28 PM ET:
   "make the coloring more animated. make it colour in slowly instead of once. in fact, put a speed slider. it should be magical.")
   + the agenda's objects and characters float around the page but never over the diagram (7:29 PM ET).
   Data: layers.json (base.png + one RGBA layer per agenda / story edge, story order) and edges.json (floaters), both cache-busted,
   re-fetched every 60 s; only new or changed strokes animate in. One canvas, transforms/opacity only for the floaters.
   prefers-reduced-motion: fully painted at once, floaters still. Speed 0.25x-4x kept in localStorage (thryd_gode_speed). */
(function(){
  var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var KEY='thryd_gode_speed';
  var cv=document.getElementById('paint'),img=document.getElementById('story'),fig=document.getElementById('fig');
  var rng=document.getElementById('speed'),out=document.getElementById('speedv');
  if(!cv||!cv.getContext)return;
  var ctx=cv.getContext('2d'),man=null,base=null,imgs={},done=document.createElement('canvas'),dctx,work=document.createElement('canvas'),wctx;
  var queue=[],active=null,shown={},sparks=[],raf=0,last=0;
  function speed(){return Math.pow(2,parseFloat(rng.value)||0);}
  function fmt(v){return String(+(Math.round(v*100)/100).toFixed(2))+'×';}
  try{var sv=parseFloat(localStorage.getItem(KEY));if(isFinite(sv)&&sv>=0.25&&sv<=4)rng.value=String(Math.log2(sv));}catch(e){}
  out.textContent=fmt(speed());
  rng.addEventListener('input',function(){out.textContent=fmt(speed());try{localStorage.setItem(KEY,String(Math.round(speed()*100)/100));}catch(e){}});
  function load(src){return new Promise(function(res){var i=new Image();i.decoding='async';i.onload=function(){res(i)};i.onerror=function(){res(null)};i.src=src;});}
  function ease(u){return u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;}
  function hexA(h,a){var n=parseInt(h.slice(1),16);return 'rgba('+(n>>16&255)+','+(n>>8&255)+','+(n&255)+','+a+')';}
  function dur(L){if(L.g)return L.g.dur;return Math.min(7,1.4+0.012*L.n)*1000;}
  function frontPt(L,s){if(L.g)return L.g.at(s);var p=L.pts;if(!p||!p.length)return [L.x+L.w*s,L.y+L.h/2];var f=s*(p.length-1),i=Math.floor(f),t=f-i,a=p[i],b=p[Math.min(p.length-1,i+1)];return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
  function drawPartial(L,s){
    if(L.g){L.g.draw(ctx,s);return;}
    var im=imgs[L.key];if(!im)return;var ax=man.axis,F=56,span=L.pmax-L.pmin+F,pos=L.pmin+s*span;
    wctx.globalCompositeOperation='source-over';wctx.clearRect(0,0,work.width,work.height);wctx.drawImage(im,L.x,L.y);
    wctx.globalCompositeOperation='destination-in';
    var g=wctx.createLinearGradient(ax[0]*(pos-F),ax[1]*(pos-F),ax[0]*pos,ax[1]*pos);
    g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.55,'rgba(0,0,0,.55)');g.addColorStop(1,'rgba(0,0,0,0)');
    wctx.fillStyle=g;wctx.fillRect(L.x,L.y,L.w,L.h);wctx.globalCompositeOperation='source-over';
    ctx.drawImage(work,0,0);
  }
  function glow(L,s,t){
    var p=frontPt(L,Math.min(1,s)),r=34+8*Math.sin(t/140);
    ctx.save();ctx.globalCompositeOperation='lighter';
    var g=ctx.createRadialGradient(p[0],p[1],0,p[0],p[1],r);g.addColorStop(0,'rgba(255,255,255,.55)');g.addColorStop(.35,hexA(L.hex,.35));g.addColorStop(1,hexA(L.hex,0));
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(p[0],p[1],r,0,7);ctx.fill();ctx.restore();
  }
  function sparkAt(L,s){var p=frontPt(L,s);if(window.thrydGodeFx)try{thrydGodeFx.land(L,p);}catch(e){}for(var i=0;i<5;i++){var a=Math.random()*6.283,v=.03+Math.random()*.07;sparks.push({x:p[0],y:p[1],vx:Math.cos(a)*v,vy:Math.sin(a)*v-.03,life:0,max:600+Math.random()*500,c:L.hex,r:1.5+Math.random()*2.2});}}
  function drawSparks(dt){
    if(!sparks.length)return;ctx.save();ctx.globalCompositeOperation='lighter';
    sparks=sparks.filter(function(p){p.life+=dt;if(p.life>p.max)return false;p.x+=p.vx*dt;p.y+=p.vy*dt;var a=1-p.life/p.max;
      ctx.fillStyle=hexA(p.c,.8*a);ctx.beginPath();ctx.arc(p.x,p.y,p.r*(0.6+a),0,7);ctx.fill();ctx.fillStyle='rgba(255,255,255,'+(.7*a)+')';ctx.beginPath();ctx.arc(p.x,p.y,p.r*.45,0,7);ctx.fill();return true;});
    ctx.restore();
  }
  function commit(L){if(L.g){L.g.draw(dctx,1);L.g.verts(dctx);shown[L.key]={hash:L.hash,n:1};return;}dctx.drawImage(imgs[L.key],L.x,L.y);shown[L.key]={hash:L.hash,n:L.n};}
  // loop (Jesuye 7:41 PM ET: "the painting should be on a loop, and sliders should direct the speed"):
  // paint everything in -> hold -> wash back to white -> repaint. Every phase advances by dt*speed(), read each frame,
  // so dragging the slider changes the rate at once without restarting. A key highlight holds the loop on the painted picture.
  var phase='paint',ph=0,cycle=0,HOLD=2600,WASH=1500,MESH_HOLD=1400,hold=false,prog=0;
  function frame(t){
    raf=0;var dt=last?Math.min(64,t-last):16;last=t;var sp=speed(),sdt=dt*sp;
    if(phase==='paint'){
      if(!active&&queue.length){active=queue.shift();active.t=0;active.step=-1;}
      ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(done,0,0);
      if(active){
        var L=active.L;active.t+=sdt;prog+=sdt;
        var T=dur(L)*(1-active.s0),u=Math.min(1,active.t/T),k=Math.max(1,Math.min(L.n,60)),q=u*k,i=Math.floor(q),s=active.s0+(1-active.s0)*Math.min(1,(i+ease(q-i))/k);
        if(i!==active.step&&i<k){active.step=i;sparkAt(L,s);}
        drawPartial(L,s);glow(L,s,t);
        if(u>=1){commit(L);sparkAt(L,1);active=null;ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(done,0,0);}
      }
      if(!active&&!queue.length){phase='hold';ph=0;if(hold&&window.thrydGodeFx)thrydGodeFx.redraw();}
    } else if(phase==='hold'){
      if(!hold){ph+=sdt;prog+=sdt;}
      if(!hold){ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(done,0,0);}
      if(ph>=HOLD&&!hold&&!RM){phase='wash';ph=0;}
    } else if(phase==='wash'){
      ph+=sdt;prog+=sdt;var w=Math.min(1,ph/WASH);
      ctx.clearRect(0,0,cv.width,cv.height);ctx.globalAlpha=1;ctx.drawImage(base,0,0);
      ctx.globalAlpha=1-ease(w);ctx.drawImage(done,0,0);ctx.globalAlpha=1;
      ctx.fillStyle='rgba(255,255,255,'+(0.35*Math.sin(Math.PI*w)).toFixed(3)+')';ctx.fillRect(0,0,cv.width,cv.height);
      if(w>=1){cycle++;reset();ph=0;if(man&&man.drawing){phase='mesh';}else{phase='paint';man.layers.forEach(function(L){if(imgs[L.key])queue.push({L:L,s0:0});});}}
    } else if(phase==='mesh'){
      ph+=sdt;prog+=sdt;
      ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(base,0,0);
      if(ph>=MESH_HOLD&&!hold){phase='paint';ph=0;man.layers.forEach(function(L){if(imgs[L.key])queue.push({L:L,s0:0});});}
    }
    if(!hold||phase==='paint')drawSparks(dt);
    if(man&&man.drawing)paintOutlineCount(ctx);
    cv.dataset.state=phase==='paint'?(active?('painting '+active.L.key):'queued'):phase;
    cv.dataset.cycle=String(cycle);
    if(!RM)raf=requestAnimationFrame(frame);else last=0;
  }
  function kick(){if(!raf&&!RM)raf=requestAnimationFrame(frame);}
  function reset(){dctx.clearRect(0,0,done.width,done.height);dctx.drawImage(base,0,0);shown={};if(typeof graphReset==='function')graphReset();}
  function playAll(){queue=[];active=null;sparks=[];reset();ph=0;
    if(RM){man.layers.forEach(function(L){if(imgs[L.key])commit(L);});ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(done,0,0);if(man&&man.drawing)paintOutlineCount(ctx);cv.dataset.state='done';return;}
    if(man&&man.drawing){phase='mesh';kick();return;}
    phase='paint';man.layers.forEach(function(L){if(imgs[L.key])queue.push({L:L,s0:0});});kick();}
  document.addEventListener('visibilitychange',function(){last=0;});
  function apply(m,fresh){
    // only new strokes: a layer whose hash we already show stays; a grown live layer paints on from where it was
    var changed=m.layers.filter(function(L){var o=shown[L.key];return !o||o.hash!==L.hash;});
    if(!changed.length)return;
    Promise.all(changed.map(function(L){return load(L.src+'?v='+m.v).then(function(i){imgs[L.key]=i;});})).then(function(){
      var keep={};m.layers.forEach(function(L){keep[L.key]=1;});
      man=m;reset();
      m.layers.forEach(function(L){var o=prev[L.key];if(o&&o.hash===L.hash&&imgs[L.key])commit(L);});
      if(RM){changed.forEach(function(L){if(imgs[L.key])commit(L);});ctx.drawImage(done,0,0);cv.dataset.state='done';return;}
      changed.forEach(function(L){var o=prev[L.key];var s0=(o&&o.n&&L.n>o.n)?Math.min(.98,o.n/L.n):0;queue.push({L:L,s0:s0});});
      phase='paint';ph=0;kick();
    });
    var prev=shown;
  }
  function poll(){if(GM){pollGraph();return;}fetch('layers.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(n){if(n&&man&&n.v!==man.v)apply(n);}).catch(function(){});}

  // ---------------- object-to-object graph mode (story/graph.json, exported from story_paint.py as story_graph.json)
  // Vertices = objects, characters and methods at fixed, data-derived places in the building; edges = one per call
  // (subject -> argument object or method), numbered by call order, coloured by agenda, painted in index order.
  // Until graph.json exists the stroke layers above stay the fallback.
  var GM=null;
  function P2(o,w){var v=o&&(o[w+'_px']||o[w+'_screen']||(o.px&&o.px[w])||(o.screen&&o.screen[w])||o[w+'_xyz']);if(v&&!Array.isArray(v)&&v.px!=null)return [+v.px,+v.py];if(!v)return null;return Array.isArray(v)?[+v[0],+v[1]]:[+v.x,+v.y];}
  function VP(v){if(typeof v.px==='number')return [v.px,v.py];var p=v.px||v.screen||(v.x!=null?[v.x,v.y]:null);if(!p)return null;return Array.isArray(p)?[+p[0],+p[1]]:[+p.x,+p.y];}
  function graphUnits(g){
    var V={},vl=g.vertices||g.nodes||[];if(!Array.isArray(vl))vl=Object.keys(vl).map(function(k){var o=vl[k];if(o.id==null)o.id=k;return o;});vl.forEach(function(v){var id=String(v.id||v.key||v.name);var p=VP(v);if(p)V[id]={id:id,p:p,label:v.label||v.name||id,kind:v.kind||'',on:false};});
    var E=(g.edges||[]).slice().map(function(e,k){return {e:e,i:(e.index!=null?+e.index:(e.i!=null?+e.i:k))};}).sort(function(a,b){return a.i-b.i;});
    var n=E.length,per=Math.max(25,Math.min(400,22000/Math.max(1,n))),rep={},newest=(g.newest_job||null),units=[];
    if(!newest&&n){newest=E[n-1].e.job;}
    E.forEach(function(o,j){var e=o.e,a=P2(e,'from'),b=P2(e,'to');
      var fa=String(e.from),tb=String(e.to);if(!a&&V[fa])a=V[fa].p;if(!b&&V[tb])b=V[tb].p;if(!a||!b)return;
      if(!V[fa])V[fa]={id:fa,p:a,label:fa,kind:'',on:false};if(!V[tb])V[tb]={id:tb,p:b,label:tb,kind:'',on:false};
      var pk=fa<tb?fa+'|'+tb:tb+'|'+fa,r=rep[pk]=(rep[pk]||0)+1,dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),self=len<2;
      var off=(self?0:Math.min(16,8+2*Math.floor((r-1)/2))*((r%2)?1:-1)*(fa<tb?1:-1)),nx=self?0:-dy/len,ny=self?0:dx/len;
      var c=[(a[0]+b[0])/2+nx*off,(a[1]+b[1])/2+ny*off];
      function at(t){if(self){var ang=t*6.283,rr=9+3*((r-1)%4);return [a[0]+rr*Math.sin(ang),a[1]-rr+rr*Math.cos(ang)];}var u=1-t;return [u*u*a[0]+2*u*t*c[0]+t*t*b[0],u*u*a[1]+2*u*t*c[1]+t*t*b[1]];}
      var num=(n<=120||o.i%10===0||e.job===newest),hex=e.hex||'#7c3aed';
      function draw(x,sv){var N=self?18:14,m=Math.max(1,Math.ceil(N*sv));x.save();x.lineCap='round';x.lineJoin='round';
        x.strokeStyle=hex;x.globalAlpha=0.85;x.lineWidth=e.run===undefined||e.run==='run-2eb42d'?1.3:1.7;x.beginPath();var p0=at(0);x.moveTo(p0[0],p0[1]);
        for(var k=1;k<=m;k++){var q=at(Math.min(sv,k/N));x.lineTo(q[0],q[1]);}x.stroke();
        if(sv>=1&&!self){var q1=at(0.92),q2=at(1),an=Math.atan2(q2[1]-q1[1],q2[0]-q1[0]);x.globalAlpha=0.9;x.fillStyle=hex;x.beginPath();x.moveTo(q2[0],q2[1]);
          x.lineTo(q2[0]-6*Math.cos(an-0.45),q2[1]-6*Math.sin(an-0.45));x.lineTo(q2[0]-6*Math.cos(an+0.45),q2[1]-6*Math.sin(an+0.45));x.closePath();x.fill();}
        if(sv>=1&&num){var mq=at(0.5);x.globalAlpha=1;x.font='600 8.5px ui-monospace,Menlo,Consolas,monospace';x.textAlign='center';x.textBaseline='middle';
          x.lineWidth=3;x.strokeStyle='rgba(255,255,255,.95)';x.strokeText(String(o.i),mq[0],mq[1]);x.fillStyle=hex;x.fillText(String(o.i),mq[0],mq[1]);}
        x.restore();}
      function verts(x){[V[fa],V[tb]].forEach(function(v){if(!v||v.on)return;v.on=true;drawV(x,v);});}
      units.push({key:'e'+j,kind:'gedge',n:1,hex:hex,hash:String(o.i)+':'+(e.call||'')+':'+hex,i:o.i,e:e,a:a,b:b,
        g:{dur:per,at:at,draw:draw,verts:verts},label:'#'+o.i+' · '+(e.label||((e.job||'')+' · '+fa+' → '+tb))});
    });
    return {units:units,V:V,newest:newest};
  }
  function drawV(x,v){if(GM&&GM.baked){x.save();x.lineWidth=1.6;x.strokeStyle='rgba(30,30,30,.75)';x.beginPath();x.arc(v.p[0],v.p[1],5.5,0,7);x.stroke();x.restore();return;}x.save();var p=v.p,k=v.kind;x.lineWidth=1.4;x.strokeStyle='#555';x.fillStyle=k==='person'||k==='character'?'#333':'#fff';
    x.beginPath();if(k==='method'){x.moveTo(p[0],p[1]-5);x.lineTo(p[0]+5,p[1]);x.lineTo(p[0],p[1]+5);x.lineTo(p[0]-5,p[1]);x.closePath();}else x.arc(p[0],p[1],4.2,0,7);x.fill();x.stroke();
    x.font='600 10px ui-monospace,Menlo,Consolas,monospace';x.textAlign='left';x.textBaseline='middle';x.lineWidth=3.2;x.strokeStyle='rgba(255,255,255,.95)';
    x.strokeText(v.label,p[0]+7,p[1]-1);x.fillStyle='#222';x.fillText(v.label,p[0]+7,p[1]-1);x.restore();}
  function graphReset(){if(!GM)return;Object.keys(GM.V).forEach(function(k){GM.V[k].on=false;});}
  function bootGraph(g,b){
    var gu=graphUnits(g);if(!gu.units.length)return false;GM=gu;GM.baked=(g.schema_version>=2);GM.v=g.stroke_hash?String(g.stroke_hash).slice(0,12):(g.v||g.hash||gu.units.length);
    man={v:'g'+GM.v,w:1440,h:900,axis:[1,0],layers:gu.units,strokes:gu.units.map(function(u){return {k:u.i,kind:'call',call:u.e.call||'',job:u.e.job,run:u.e.run,label:u.label,hex:u.hex,x:u.g.at(0.5)[0],y:u.g.at(0.5)[1],actor:String(u.e.from),floor:''};}),stroke_hash:g.stroke_hash||g.hash||g.edge_hash||null,graph:true};
    gu.units.forEach(function(u){imgs[u.key]=1;});
    cv.width=done.width=work.width=1440;cv.height=done.height=work.height=900;dctx=done.getContext('2d');wctx=work.getContext('2d');
    base=b;fig.classList.add('live');fig.classList.add('graph');ctx.drawImage(base,0,0);playAll();
    setInterval(pollGraph,60000);return true;}
  function pollGraph(){fetch('graph.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(g){
    if(!g||!g.edges||!GM)return;var gu=graphUnits(g);var have={};man.layers.forEach(function(u){have[u.key]=u.hash;});
    var add=gu.units.filter(function(u){return have[u.key]!==u.hash;});if(!add.length)return;
    // new jobs only append: the old edges keep their place; only the new ones paint in
    GM.V=gu.V;GM.newest=gu.newest;GM.baked=(g.schema_version>=2);man.layers=gu.units;man.strokes=gu.units.map(function(u){return {k:u.i,kind:'call',call:u.e.call||'',job:u.e.job,run:u.e.run,label:u.label,hex:u.hex,x:u.g.at(0.5)[0],y:u.g.at(0.5)[1],actor:String(u.e.from),floor:''};});
    man.v='g'+(g.stroke_hash?String(g.stroke_hash).slice(0,12):(g.v||g.hash||gu.units.length));gu.units.forEach(function(u){imgs[u.key]=1;});
    reset();graphReset();man.layers.forEach(function(u){if(have[u.key]===u.hash)commit(u);});
    add.forEach(function(u){queue.push({L:u,s0:0});});phase='paint';ph=0;kick();}).catch(function(){});}
  function boot(m){
    man=m;cv.width=done.width=work.width=m.w;cv.height=done.height=work.height=m.h;dctx=done.getContext('2d');wctx=work.getContext('2d');
    Promise.all([load(m.base+'?v='+m.v)].concat(m.layers.map(function(L){return load(L.src+'?v='+m.v).then(function(i){imgs[L.key]=i;});}))).then(function(r){
      base=r[0];if(!base)return;fig.classList.add('live');ctx.drawImage(base,0,0);playAll();
      setInterval(poll,60000);
    });
  }
  // Colouring-book technical drawing (drawing.json) is the default story view.
  // Old building / object-to-object graph: ?building=1 or ?graph=1 (DRAW_BUILDING).
  var DRAW_BUILDING=/(?:^|[?&])(?:building|graph)=1(?:&|$)/.test(location.search);
  var DM=null;
  function inkEdge(x,e,col,sv){
    var a=e.pa,b=e.pb;if(!a||!b)return;
    x.save();x.lineCap='round';x.lineJoin='round';x.strokeStyle=col;x.lineWidth=e.hidden?2.2:3.0;x.globalAlpha=e.hidden?0.78:1;
    if(e.style!=='solid'||e.hidden)x.setLineDash([6,4]);
    x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(a[0]+(b[0]-a[0])*sv,a[1]+(b[1]-a[1])*sv);x.stroke();x.restore();
  }
  function inkStroke(x,s,sv){
    var a=s.pa,b=s.pb;if(!a||!b)return;
    var story=s.edge_k!=null&&s.edge_k!=='';
    var conn=s.kind==='connection';
    x.save();x.lineCap='round';x.lineJoin='round';x.strokeStyle=s.hex||'#2563eb';
    // church edges: thick, full colour, on top. live run strokes: thin and faded underneath.
    // v596: source agendas (any non-live ink off the story edges) read in their own colour; live blue recedes.
    var src=!story&&String(s.hex||'#2563eb').toLowerCase()!=='#2563eb';
    x.lineWidth=story?(s.style==='solid'?5.4:4.4):(src?2.6:(conn?1.1:1.3));
    x.globalAlpha=story?1:(src?0.9:0.32);
    if(s.style!=='solid'||(!story&&conn))x.setLineDash(story?[7,4]:(src?[8,3]:[5,4]));
    x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(a[0]+(b[0]-a[0])*sv,a[1]+(b[1]-a[1])*sv);x.stroke();x.restore();
  }
  function drawingUnits(d){
    var units=[];
    if(d.strokes&&d.strokes.length){
      // Colour the planned outline first so "outline coloured N of M" climbs as those lines ink,
      // then the extra connection strokes. Within each group, call order.
      var src=d.strokes.slice().sort(function(a,b){
        var oa=a.kind==='outline'?0:1, ob=b.kind==='outline'?0:1;
        return (oa-ob)||((a.index-b.index)||((a.subord||0)-(b.subord||0))||((a.i||0)-(b.i||0)));
      });
      src.forEach(function(s,j){
        if(!s.pa||!s.pb)return;
        function at(t){return [s.pa[0]+(s.pb[0]-s.pa[0])*t,s.pa[1]+(s.pb[1]-s.pa[1])*t];}
        function draw(x,sv){inkStroke(x,s,sv);}
        var story=s.edge_k!=null&&s.edge_k!=='';
        units.push({key:'s'+j,kind:'dink',n:story?24:16,hex:s.hex,hash:[s.index,s.call,s.hex,s.kind,s.edge].join(':'),i:s.index,e:s,
          g:{dur:story?820:200,at:at,draw:draw,verts:function(){}},
          label:(s.label||s.call||('#'+s.index))+' · '+(s.job||'')});
      });
      return units;
    }
    (d.fills||[]).forEach(function(f,j){
      var e=d.edges[f.edge];if(!e)return;var hex=f.hex||'#7c3aed';
      function at(t){return [e.pa[0]+(e.pb[0]-e.pa[0])*t,e.pa[1]+(e.pb[1]-e.pa[1])*t];}
      function draw(x,sv){inkEdge(x,e,hex,sv);}
      function verts(){}
      units.push({key:'f'+j,kind:'dink',n:1,hex:hex,hash:String(f.index)+':'+f.edge+':'+hex,i:f.index,e:f,
        g:{dur:480,at:at,draw:draw,verts:verts},
        label:(f.call||('#'+f.index))+' · '+(f.job||'')});
    });
    return units;
  }
  function titleBlock(d){
    if(d&&d.title_block&&d.title_block.count)return d.title_block;
    if(!d)return null;
    // fallback for older drawing.json: same layout as story_drawing.title_block_geom
    var tw=420, path=String(d.coherence||''), approx=Math.max(2, Math.ceil(path.length/54));
    var th=168+12*approx, x0=(d.w||1440)-tw-18, y0=(d.h||900)-th-16;
    return {x:x0,y:y0,w:tw,h:th,n_outline:d.n_edges||0,paper:[242,240,234],fill:[36,36,38],
      count:{x:x0+12,y:y0+65,w:tw-24,h:15,size:11,prefix:'outline coloured  ',suffix:' of '+(d.n_edges||0)}};
  }
  function outlineColouredNow(){
    if(!DM)return 0;
    if(phase==='mesh')return 0;
    var seen={}, n=0;
    function add(s){if(s&&s.kind==='outline'&&s.edge!=null&&seen[s.edge]==null){seen[s.edge]=1;n++;}}
    (man&&man.layers||[]).forEach(function(L){if(shown[L.key]&&L.e)add(L.e);});
    if(active&&active.L&&active.L.e)add(active.L.e);
    return n;
  }
  function paintOutlineCount(x){
    if(!DM||!x)return;
    var tb=titleBlock(DM), c=tb&&tb.count; if(!c)return;
    var n=outlineColouredNow();
    var paper=tb.paper||[242,240,234], ink=tb.fill||[36,36,38], total=tb.n_outline||DM.n_edges||0;
    x.save();
    x.fillStyle='rgb('+paper[0]+','+paper[1]+','+paper[2]+')';
    x.fillRect(c.x-1,c.y-1,(c.w||396)+2,(c.h||15)+2);
    x.fillStyle='rgb('+ink[0]+','+ink[1]+','+ink[2]+')';
    x.font=(c.size||11)+'px "Nimbus Roman","Times New Roman",Times,serif';
    x.textAlign='left';x.textBaseline='top';
    x.fillText((c.prefix||'outline coloured  ')+n+(c.suffix||(' of '+total)), c.x, c.y);
    x.restore();
  }
    function bootDrawing(d,b){
    var units=drawingUnits(d);DM=d;
    man={v:'d'+(d.v||d.sig||units.length),w:d.w||1440,h:d.h||900,axis:[1,0],layers:units,
      strokes:units.map(function(u){var q=u.g.at(0.5);return {k:u.i,kind:'call',call:(u.e&&u.e.call)||'',job:(u.e&&u.e.job)||'',run:'',label:u.label,hex:u.hex,x:q[0],y:q[1],actor:'',floor:''};}),
      stroke_hash:d.sig||null,graph:false,drawing:true,outline:d.edges||[]};
    units.forEach(function(u){imgs[u.key]=1;});
    cv.width=done.width=work.width=man.w;cv.height=done.height=work.height=man.h;dctx=done.getContext('2d');wctx=work.getContext('2d');
    base=b;fig.classList.add('live');fig.classList.add('drawing');ctx.drawImage(base,0,0);playAll();
    setInterval(pollDrawing,60000);return true;
  }
  function pollDrawing(){fetch('drawing.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(d){
    if(!d||!d.edges||!DM)return;if(String(d.v||d.sig)===String(DM.v||DM.sig))return;
    var units=drawingUnits(d),have={};man.layers.forEach(function(u){have[u.key]=u.hash;});
    var add=units.filter(function(u){return have[u.key]!==u.hash;});
    DM=d;man.layers=units;man.v='d'+(d.v||d.sig||units.length);man.stroke_hash=d.sig||null;man.outline=d.edges||[];man.drawing=true;
    man.strokes=units.map(function(u){var q=u.g.at(0.5);return {k:u.i,kind:'call',call:(u.e&&u.e.call)||'',job:(u.e&&u.e.job)||'',run:'',label:u.label,hex:u.hex,x:q[0],y:q[1],actor:'',floor:''};});
    units.forEach(function(u){imgs[u.key]=1;});
    reset();man.layers.forEach(function(u){if(have[u.key]===u.hash)commit(u);});
    add.forEach(function(u){queue.push({L:u,s0:0});});phase='paint';ph=0;kick();}).catch(function(){});}
  function bootFromLayers(m){
    fetch('graph.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).catch(function(){return null;}).then(function(g){
      if(g&&g.edges&&g.edges.length){load(m.base+'?v='+m.v).then(function(b){if(!(b&&bootGraph(g,b)))boot(m);});}else boot(m);});
  }
  fetch('layers.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(m){
    if(!m||!m.layers)return;
    if(DRAW_BUILDING){bootFromLayers(m);return;}
    fetch('drawing.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).catch(function(){return null;}).then(function(d){
      if(d&&d.edges&&d.edges.length){
        load((d.base||'drawing_base.png')+'?v='+(d.v||m.v)).then(function(b){if(!(b&&bootDrawing(d,b)))bootFromLayers(m);});
      }else bootFromLayers(m);
    });
  }).catch(function(){});

  // ---- tap / hover a stroke: its call (Jesuye 8:07 PM ET). Strokes come from layers.json (data only: call id, job, actor, method, floor).
  var tipEl=document.createElement('div');tipEl.id='stip';tipEl.setAttribute('role','status');fig.appendChild(tipEl);var grid=null,gridV=null;
  function buildGrid(){if(!man||!man.strokes)return;if(gridV===man.v)return;grid={};gridV=man.v;
    man.strokes.forEach(function(st){if(st.x==null)return;var k=Math.floor(st.x/16)+','+Math.floor(st.y/16);(grid[k]=grid[k]||[]).push(st);});}
  function hit(cx,cy){if(DM){var best=null,bd=12*12,list=(DM.edges||[]);
    list.forEach(function(e,i){var ax=e.pa[0],ay=e.pa[1],bx=e.pb[0],by=e.pb[1],dx=bx-ax,dy=by-ay,L=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((cx-ax)*dx+(cy-ay)*dy)/L)),qx=ax+t*dx,qy=ay+t*dy,dd=(qx-cx)*(qx-cx)+(qy-cy)*(qy-cy);
      if(dd<bd){bd=dd;best={call:(e.fill&&e.fill.call)||('edge '+i),label:(e.owner||'')+' · '+(e.style||'')+(e.fill?' · '+e.fill.call:''),hex:(e.fill&&e.fill.hex)||'#333',kind:'call',run:'',actor:'',floor:''};}});
    return best;}
    if(GM){var best=null,bd=10*10;man.layers.forEach(function(u){for(var t=0;t<=1.0001;t+=0.125){var q=u.g.at(t),d=(q[0]-cx)*(q[0]-cx)+(q[1]-cy)*(q[1]-cy);if(d<bd){bd=d;best=u;}}});return best?{call:best.e.call||best.key,label:best.label,hex:best.hex,kind:'call',run:best.e.run||'',actor:'',floor:''}:null;}
    buildGrid();if(!grid)return null;var best=null,bd=11*11,gx=Math.floor(cx/16),gy=Math.floor(cy/16);
    for(var i=-1;i<=1;i++)for(var j=-1;j<=1;j++){(grid[(gx+i)+','+(gy+j)]||[]).forEach(function(st){var d=(st.x-cx)*(st.x-cx)+(st.y-cy)*(st.y-cy);if(d<bd){bd=d;best=st;}});}
    if(best)return best;
    // story edge beams: nearest point on the edge layer's path
    var be=null,bd2=14*14;(man.layers||[]).forEach(function(L){if(L.kind!=='edge')return;(L.pts||[]).forEach(function(p){var d=(p[0]-cx)*(p[0]-cx)+(p[1]-cy)*(p[1]-cy);if(d<bd2){bd2=d;be=L;}});});
    if(be){var e=man.strokes.filter(function(st){return st.kind==='edge'&&st.job===be.key;})[0];return e||null;}return null;}
  function showTip(ev,pin){var r=cv.getBoundingClientRect();if(!r.width)return;var cx=(ev.clientX-r.left)*cv.width/r.width,cy=(ev.clientY-r.top)*cv.height/r.height;var st=hit(cx,cy);
    if(!st){if(!pin||tipEl.dataset.pin!=='1'||pin)hideTip();return;}
    tipEl.textContent=st.label+(st.actor&&st.kind==='call'?'  ·  '+st.run+' · '+st.floor+(st.dir?' · '+st.dir:''):(st.kind==='edge'?'  ·  story edge':''));
    tipEl.style.setProperty('--c',st.hex);tipEl.dataset.call=st.call||st.job;tipEl.dataset.pin=pin?'1':'';
    var fr=fig.getBoundingClientRect();tipEl.style.left=Math.max(4,Math.min(fr.width-260,ev.clientX-fr.left+12))+'px';tipEl.style.top=Math.max(4,ev.clientY-fr.top-34)+'px';tipEl.classList.add('on');}
  function hideTip(){tipEl.classList.remove('on');tipEl.dataset.pin='';tipEl.dataset.call='';}
  var tdown=null;
  cv.addEventListener('pointermove',function(ev){if(ev.pointerType==='mouse'&&tipEl.dataset.pin!=='1')showTip(ev,false);});
  cv.addEventListener('pointerleave',function(ev){if(ev.pointerType==='mouse'&&tipEl.dataset.pin!=='1')hideTip();});
  cv.addEventListener('pointerdown',function(ev){tdown=[ev.clientX,ev.clientY];});
  cv.addEventListener('pointerup',function(ev){if(tdown&&Math.abs(ev.clientX-tdown[0])+Math.abs(ev.clientY-tdown[1])<10)showTip(ev,true);tdown=null;});
  window.thrydGode={speed:speed,strokes:function(){return man&&man.strokes?{graph:!!man.graph,drawing:!!man.drawing,vertices:GM?Object.keys(GM.V).length:(DM&&DM.n_verts||0),n:man.drawing&&DM?DM.edges.length:man.strokes.length,calls:man.drawing?(DM&&(DM.n_strokes||DM.n_fills)||man.strokes.length):man.strokes.filter(function(x){return x.kind==='call'}).length,hash:man.stroke_hash,v:man.v}:null;},hit:function(x,y){return hit(x,y);},tip:function(){return {on:tipEl.classList.contains('on'),text:tipEl.textContent,call:tipEl.dataset.call};},state:function(){return {state:cv.dataset.state,cycle:cycle,phase:phase,progress:Math.round(prog),queue:queue.length,active:active&&active.L.key,shown:Object.keys(shown),speed:speed(),rm:RM,layers:man?man.layers.length:0,outlineColoured:outlineColouredNow(),nOutline:(DM&&(DM.title_block&&DM.title_block.n_outline||DM.n_edges))||0};},poll:poll,setHold:function(b){hold=!!b;if(!b)kick();},
    _i:{man:function(){return man},imgs:imgs,base:function(){return base},done:done,ctx:ctx,cv:cv,busy:function(){return !!(active||queue.length)},front:frontPt}};

  // ---------------- floaters: story objects + characters drifting around the page, never over the diagram
  var box=document.getElementById('floaters'),F=[],ex=null,fr=0,lt=0;
  function exRect(){var r=window.thrydView?thrydView.rect():(function(b){return {l:b.left,t:b.top,r:b.right,b:b.bottom};})(fig.getBoundingClientRect()),m=26;ex={l:r.l-m,t:r.t-m,r:r.r+m,b:r.b+m};} // follows the panned/zoomed building
  // exclude the actual title/caption/back ink, not the full-width header (that left no parking on desktop)
  function textBoxes(){
    var out=[], m=12;
    function add(n, maxw){if(!n)return;var z=n.getBoundingClientRect();var l=z.left,r=z.right;if(maxw&&z.width>maxw){var c=(z.left+z.right)/2;l=c-maxw/2;r=c+maxw/2;}out.push({l:l-m,t:z.top-m,r:r+m,b:z.bottom+m});}
    add(document.querySelector('header .back'));
    add(document.querySelector('header h1'), 720);
    add(document.getElementById('cap'), 900);
    return out;
  }
  function inBox(b,x,y,w,h){return b&&x<b.r&&x+w>b.l&&y<b.b&&y+h>b.t;}
  function inText(x,y,w,h){return textBoxes().some(function(b){return inBox(b,x,y,w,h);});}
  function inEx(x,y,w,h){return inBox(ex,x,y,w,h)||inText(x,y,w,h);}
  function pushOut(f,box){var dl=f.x+f.w-box.l,dr=box.r-f.x,dtp=f.y+f.h-box.t,db=box.b-f.y,mn=Math.min(dl,dr,dtp,db);
    if(mn===dl){f.x=box.l-f.w;f.vx=-Math.abs(f.vx);}else if(mn===dr){f.x=box.r;f.vx=Math.abs(f.vx);}
    else if(mn===dtp){f.y=box.t-f.h;f.vy=-Math.abs(f.vy);}else{f.y=box.b;f.vy=Math.abs(f.vy);}}
  function spot(w,h){var W=innerWidth,H=innerHeight;for(var k=0;k<80;k++){var x=Math.random()*(W-w),y=Math.random()*(H-h);if(!inEx(x,y,w,h))return [x,y];}
    // last resort: just below the diagram, or a top corner beside the title
    if(ex){var y=Math.min(H-h,Math.max(0,ex.b+4));if(!inEx(Math.max(0,(W-w)/2),y,w,h))return [Math.max(0,(W-w)/2),y];}
    return [4, Math.max(0, (ex&&ex.t>h+8)?4: (H-h))];}
  function makeFloaters(list){
    box.textContent='';F=[];var max=innerWidth<640?20:26;exRect();
    list.slice(0,max).forEach(function(o,i){
      var e=document.createElement('span');e.className='fl '+(o.kind==='person'?'pp':'th');e.style.setProperty('--c',o.hex||'#888');
      e.title=o.name+' · last touched by '+o.agenda;e.dataset.id=o.id;e.dataset.agenda=o.agenda;
      var em=document.createElement('b');em.textContent=o.emoji||'◆';e.appendChild(em);var lb=document.createElement('i');lb.textContent=o.name;e.appendChild(lb);
      box.appendChild(e);var w=e.offsetWidth||60,h=e.offsetHeight||26,p=spot(w,h),a=Math.random()*6.283,v=(innerWidth<640?7:10)+Math.random()*12;
      F.push({e:e,x:p[0],y:p[1],w:w,h:h,vx:Math.cos(a)*v,vy:Math.sin(a)*v,ph:Math.random()*6.283});
      e.style.transform='translate3d('+p[0].toFixed(1)+'px,'+p[1].toFixed(1)+'px,0)';
    });
    box.dataset.n=String(F.length);
    if(!RM&&!fr)fr=requestAnimationFrame(drift);
  }
  function drift(t){
    var dt=(lt?Math.min(0.05,(t-lt)/1000):0.016)*Math.sqrt(speed());lt=t;exRect();var W=innerWidth,H=innerHeight;
    for(var i=0;i<F.length;i++){var f=F[i];
      f.x+=f.vx*dt;f.y+=f.vy*dt+Math.sin(t/1800+f.ph)*0.12;
      if(f.x<0){f.x=0;f.vx=Math.abs(f.vx);}if(f.x+f.w>W){f.x=W-f.w;f.vx=-Math.abs(f.vx);}
      if(f.y<0){f.y=0;f.vy=Math.abs(f.vy);}if(f.y+f.h>H){f.y=H-f.h;f.vy=-Math.abs(f.vy);}
      if(inBox(ex,f.x,f.y,f.w,f.h)) pushOut(f,ex);
      textBoxes().forEach(function(b){if(inBox(b,f.x,f.y,f.w,f.h))pushOut(f,b);});
      if(inEx(f.x,f.y,f.w,f.h)||f.x<0||f.x+f.w>W||f.y<0||f.y+f.h>H){var p=spot(f.w,f.h);f.x=p[0];f.y=p[1];}
      f.e.style.transform='translate3d('+f.x.toFixed(1)+'px,'+f.y.toFixed(1)+'px,0)';
    }
    fr=requestAnimationFrame(drift);
  }
  window.thrydFloaters={rect:function(){exRect();return ex;},items:function(){return F.map(function(f){var r=f.e.getBoundingClientRect();return {id:f.e.dataset.id,x:r.left,y:r.top,w:r.width,h:r.height,c:getComputedStyle(f.e).borderColor};});}};
  var fl0='';
  function loadF(){fetch('edges.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(d){
    if(!d||!d.floaters)return;var k=JSON.stringify(d.floaters.map(function(o){return [o.id,o.hex]}));if(k===fl0)return;fl0=k;makeFloaters(d.floaters);}).catch(function(){});}
  // reduced motion: floaters stay still, but if a scroll or zoom brings the building under one, it is quietly re-placed (no animation)
  function settle(){if(!RM)return;exRect();F.forEach(function(f){if(inEx(f.x,f.y,f.w,f.h)){var p=spot(f.w,f.h);f.x=p[0];f.y=p[1];f.e.style.transform='translate3d('+f.x.toFixed(1)+'px,'+f.y.toFixed(1)+'px,0)';}});}
  var sq=0;function settleSoon(){if(!sq)sq=requestAnimationFrame(function(){sq=0;settle();});}
  if(box){loadF();setInterval(loadF,60000);addEventListener('resize',function(){exRect();settleSoon();});addEventListener('scroll',settleSoon,{passive:true});setInterval(settle,1000);}
})();
