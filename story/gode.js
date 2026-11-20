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
  function dur(L){return Math.min(7,1.4+0.012*L.n)*1000;}
  function frontPt(L,s){var p=L.pts;if(!p||!p.length)return [L.x+L.w*s,L.y+L.h/2];var f=s*(p.length-1),i=Math.floor(f),t=f-i,a=p[i],b=p[Math.min(p.length-1,i+1)];return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
  function drawPartial(L,s){
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
  function commit(L){dctx.drawImage(imgs[L.key],L.x,L.y);shown[L.key]={hash:L.hash,n:L.n};}
  // loop (Jesuye 7:41 PM ET: "the painting should be on a loop, and sliders should direct the speed"):
  // paint everything in -> hold -> wash back to white -> repaint. Every phase advances by dt*speed(), read each frame,
  // so dragging the slider changes the rate at once without restarting. A key highlight holds the loop on the painted picture.
  var phase='paint',ph=0,cycle=0,HOLD=2600,WASH=1500,hold=false,prog=0;
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
      if(w>=1){cycle++;phase='paint';reset();man.layers.forEach(function(L){if(imgs[L.key])queue.push({L:L,s0:0});});}
    }
    if(!hold||phase==='paint')drawSparks(dt);
    cv.dataset.state=phase==='paint'?(active?('painting '+active.L.key):'queued'):phase;
    cv.dataset.cycle=String(cycle);
    if(!RM)raf=requestAnimationFrame(frame);else last=0;
  }
  function kick(){if(!raf&&!RM)raf=requestAnimationFrame(frame);}
  function reset(){dctx.clearRect(0,0,done.width,done.height);dctx.drawImage(base,0,0);shown={};}
  function playAll(){queue=[];active=null;sparks=[];reset();phase='paint';ph=0;
    if(RM){man.layers.forEach(function(L){if(imgs[L.key])commit(L);});ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(done,0,0);cv.dataset.state='done';return;}
    man.layers.forEach(function(L){if(imgs[L.key])queue.push({L:L,s0:0});});kick();}
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
  function poll(){fetch('layers.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(n){if(n&&man&&n.v!==man.v)apply(n);}).catch(function(){});}
  function boot(m){
    man=m;cv.width=done.width=work.width=m.w;cv.height=done.height=work.height=m.h;dctx=done.getContext('2d');wctx=work.getContext('2d');
    Promise.all([load(m.base+'?v='+m.v)].concat(m.layers.map(function(L){return load(L.src+'?v='+m.v).then(function(i){imgs[L.key]=i;});}))).then(function(r){
      base=r[0];if(!base)return;fig.classList.add('live');ctx.drawImage(base,0,0);playAll();
      setInterval(poll,60000);
    });
  }
  fetch('layers.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(m){if(m&&m.layers)boot(m);}).catch(function(){});
  window.thrydGode={speed:speed,state:function(){return {state:cv.dataset.state,cycle:cycle,phase:phase,progress:Math.round(prog),queue:queue.length,active:active&&active.L.key,shown:Object.keys(shown),speed:speed(),rm:RM,layers:man?man.layers.length:0};},poll:poll,setHold:function(b){hold=!!b;if(!b)kick();},
    _i:{man:function(){return man},imgs:imgs,base:function(){return base},done:done,ctx:ctx,cv:cv,busy:function(){return !!(active||queue.length)},front:frontPt}};

  // ---------------- floaters: story objects + characters drifting around the page, never over the diagram
  var box=document.getElementById('floaters'),F=[],ex=null,fr=0,lt=0;
  function exRect(){var r=window.thrydView?thrydView.rect():(function(b){return {l:b.left,t:b.top,r:b.right,b:b.bottom};})(fig.getBoundingClientRect()),m=26;ex={l:r.l-m,t:r.t-m,r:r.r+m,b:r.b+m};} // follows the panned/zoomed building
  function inEx(x,y,w,h){return ex&&x<ex.r&&x+w>ex.l&&y<ex.b&&y+h>ex.t;}
  function spot(w,h){var W=innerWidth,H=innerHeight;for(var k=0;k<60;k++){var x=Math.random()*(W-w),y=Math.random()*(H-h);if(!inEx(x,y,w,h))return [x,y];}return [Math.random()*(W-w),Math.random()<.5?Math.max(0,ex.t-h-4):Math.min(H-h,ex.b+4)];}
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
      if(inEx(f.x,f.y,f.w,f.h)){ // push out along the shallowest side and bounce
        var dl=f.x+f.w-ex.l,dr=ex.r-f.x,dtp=f.y+f.h-ex.t,db=ex.b-f.y,mn=Math.min(dl,dr,dtp,db);
        if(mn===dl){f.x=ex.l-f.w;f.vx=-Math.abs(f.vx);}else if(mn===dr){f.x=ex.r;f.vx=Math.abs(f.vx);}
        else if(mn===dtp){f.y=ex.t-f.h;f.vy=-Math.abs(f.vy);}else{f.y=ex.b;f.vy=Math.abs(f.vy);}
        if(inEx(f.x,f.y,f.w,f.h)||f.x<0||f.x+f.w>W||f.y<0||f.y+f.h>H){var p=spot(f.w,f.h);f.x=p[0];f.y=p[1];}
      }
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
