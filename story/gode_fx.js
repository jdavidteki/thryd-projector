/* v582 magic for "painted by gode" (Jesuye 19 Nov 2026 7:37 PM ET: "add everything to make the page feel magical").
   On a half-resolution overlay canvas (#fx, 720x450, pointer-events none) so the diagram stays readable and it stays 60fps on phones:
   drifting dust in agenda colours, a breathing light on the building, a comet pulse along the newest job's edge, a shimmer ring
   (+ optional soft chime, muted by default) each time a stroke lands. Hover/tap/focus an agenda or edge in the "painted by gode" key
   to light up its strokes and dim the rest. Gentle parallax from the cursor (and tilt where the browser allows it).
   Edge labels ink-write in (CSS). prefers-reduced-motion: no dust, no pulse, no parallax, no ink animation; highlight still works. */
(function(){
  var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fx=document.getElementById('fx'),fig=document.getElementById('fig'),sec=document.getElementById('gode'),flo=document.getElementById('floaters');
  var chimeBtn=document.getElementById('chime');
  if(!fx||!fx.getContext)return;
  var c=fx.getContext('2d'),SC=0.5,W=fx.width,H=fx.height,mob=innerWidth<640;
  var ft=0,dust=[],rings=[],current=null,hl=null,frames=0,run=false,raf=0,lt=0,center=[W*0.45,H*0.55],rad=W*0.33;
  function G(){return window.thrydGode&&thrydGode._i;}
  function hexA(h,a){var n=parseInt((h||'#7c3aed').slice(1),16);return 'rgba('+(n>>16&255)+','+(n>>8&255)+','+(n&255)+','+a+')';}
  function cols(){var g=G(),m=g&&g.man();return m?m.layers.map(function(L){return L.hex;}):['#7c3aed','#ca8a04','#2563eb'];}
  function seedDust(){var cs=cols(),n=mob?22:40;dust=[];for(var i=0;i<n;i++)dust.push({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*4,vy:-2-Math.random()*5,r:.6+Math.random()*1.5,c:cs[i%cs.length],ph:Math.random()*6.283,a:.18+Math.random()*.3});}
  function geom(){var g=G(),m=g&&g.man();if(!m)return;var x0=1e9,y0=1e9,x1=0,y1=0;m.layers.forEach(function(L){if(L.kind==='agenda'){x0=Math.min(x0,L.x);y0=Math.min(y0,L.y);x1=Math.max(x1,L.x+L.w*0.75);y1=Math.max(y1,L.y+L.h);}});
    if(x1>x0){center=[(x0+x1)/2*SC,(y0+y1)/2*SC];rad=Math.max(x1-x0,y1-y0)*SC*0.6;}}
  // ---- chime (WebAudio, off by default; the toggle is the user gesture that starts audio)
  var ac=null,chimeOn=false,lastChime=0,NOTES=[523.25,587.33,659.25,783.99,880,1046.5];
  function chime(i){if(!chimeOn||!ac)return;var t=ac.currentTime;if(t-lastChime<0.12)return;lastChime=t;
    var o=ac.createOscillator(),g=ac.createGain(),f=NOTES[i%NOTES.length]*(Math.random()<.5?1:2);o.type='sine';o.frequency.value=f;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.05,t+0.015);g.gain.exponentialRampToValueAtTime(0.0001,t+0.9);o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+0.95);}
  if(chimeBtn)chimeBtn.addEventListener('click',function(){chimeOn=!chimeOn;chimeBtn.setAttribute('aria-pressed',String(chimeOn));chimeBtn.textContent=(chimeOn?'🔔':'🔇')+' chime';
    if(chimeOn&&!ac){try{ac=new (window.AudioContext||window.webkitAudioContext)();}catch(e){ac=null;}}if(ac&&ac.state==='suspended')ac.resume();if(chimeOn)chime(2);});
  // ---- stroke landing: shimmer ring + chime
  var layerIdx={};
  function land(L,p){if(!(L.key in layerIdx))layerIdx[L.key]=Object.keys(layerIdx).length;chime(layerIdx[L.key]);if(RM)return;
    rings.push({x:p[0]*SC,y:p[1]*SC,t:0,c:L.hex});if(rings.length>24)rings.shift();kick();}
  // ---- highlight one agenda/edge in the key: redraw the paint canvas with the others dimmed
  function drawHL(){var g=G();if(!g||!g.base())return;var m=g.man(),x=g.ctx;
    if(!hl){if(!g.busy()){x.clearRect(0,0,g.cv.width,g.cv.height);x.drawImage(g.done,0,0);}return;}
    if(g.busy())return;x.clearRect(0,0,g.cv.width,g.cv.height);x.drawImage(g.base(),0,0);
    m.layers.forEach(function(L){if(L.g){x.globalAlpha=(L.e.job===hl||L.e.run===hl)?1:0.12;L.g.draw(x,1);return;}var im=g.imgs[L.key];if(!im)return;x.globalAlpha=(L.key===hl)?1:0.12;x.drawImage(im,L.x,L.y);});x.globalAlpha=1;}
  function setHL(k){hl=k||null;if(window.thrydGode&&thrydGode.setHold)thrydGode.setHold(!!hl);document.querySelectorAll('#gode [data-key]').forEach(function(e){e.classList.toggle('hl',!!hl&&e.dataset.key===hl);});
    sec&&sec.classList.toggle('hlon',!!hl);drawHL();if(hl){var L=lay(hl);if(L&&!RM){var p=G().front(L,1);rings.push({x:p[0]*SC,y:p[1]*SC,t:0,c:L.hex});kick();}}}
  function lay(k){var g=G(),m=g&&g.man();if(!m)return null;if(m.graph){var u=m.layers.filter(function(L){return L.e&&(L.e.job===k||L.e.run===k);});u=u[u.length-1];return u?{hex:u.hex,pts:[0,.25,.5,.75,1].map(function(t){return u.g.at(t);})}:null;}return m.layers.filter(function(L){return L.key===k;})[0];}
  function keyOf(t){var e=t&&t.closest&&t.closest('#gode [data-key]');return e&&e.dataset.key;}
  if(sec){
    sec.addEventListener('pointerover',function(ev){if(ev.pointerType==='mouse'){var k=keyOf(ev.target);if(k&&k!==hl)setHL(k);}});
    sec.addEventListener('pointerleave',function(ev){if(ev.pointerType==='mouse')setHL(null);});
    sec.addEventListener('click',function(ev){var k=keyOf(ev.target);if(k)setHL(k===hl&&ev.pointerType!=='mouse'?null:k);});
    var lastPD=0;sec.addEventListener('pointerdown',function(){lastPD=Date.now();},true);
    sec.addEventListener('focusin',function(ev){if(Date.now()-lastPD<600)return;var k=keyOf(ev.target);if(k)setHL(k);});
    sec.addEventListener('keydown',function(ev){if(ev.key==='Escape')setHL(null);});
  }
  document.addEventListener('click',function(ev){if(hl&&!keyOf(ev.target)&&!(ev.target.closest&&ev.target.closest('#ctl')))setHL(null);});
  // ---- parallax (cursor; tilt where allowed without a prompt)
  var px=0,py=0,tx=0,ty=0,pRaf=0;
  function applyPar(){pRaf=0;fig.style.transform='perspective(1400px) rotateX('+(-py*1.1).toFixed(3)+'deg) rotateY('+(px*1.4).toFixed(3)+'deg) translate3d('+(px*4).toFixed(2)+'px,'+(py*3).toFixed(2)+'px,0)';
    if(flo)flo.style.transform='translate3d('+(-px*12).toFixed(2)+'px,'+(-py*9).toFixed(2)+'px,0)';}
  function par(x,y){px=Math.max(-1,Math.min(1,x));py=Math.max(-1,Math.min(1,y));if(!pRaf)pRaf=requestAnimationFrame(applyPar);}
  if(!RM){addEventListener('pointermove',function(ev){if(ev.pointerType==='mouse')par(ev.clientX/innerWidth*2-1,ev.clientY/innerHeight*2-1);},{passive:true});
    addEventListener('deviceorientation',function(e){if(e.gamma==null)return;par(e.gamma/30,(e.beta-45)/30);},{passive:true});}
  // ---- newest job's edge
  document.addEventListener('gode:edges',function(e){var d=e.detail||{};current=(d.story&&d.story.current)||null;kick();});
  // v589: edges.json may have landed before this script loaded (slow network): pick up the current edge from the page
  if(window.thrydGodeEdges){var d0=window.thrydGodeEdges;current=(d0.story&&d0.story.current)||null;}
  // ---- loop
  function frame(t){raf=0;if(document.hidden){run=false;return;}var sp=(window.thrydGode&&thrydGode.speed)?thrydGode.speed():1;var dt=(lt?Math.min(0.05,(t-lt)/1000):0.016)*Math.sqrt(sp);lt=t;frames++;ft+=dt*1000;
    c.clearRect(0,0,W,H);
    // breathing light on the building
    var br=0.5+0.5*Math.sin(ft/1700);var g=c.createRadialGradient(center[0],center[1],rad*0.1,center[0],center[1],rad);
    g.addColorStop(0,'rgba(255,214,150,'+(0.05+0.06*br).toFixed(3)+')');g.addColorStop(1,'rgba(255,214,150,0)');c.fillStyle=g;c.fillRect(0,0,W,H);
    // dust
    for(var i=0;i<dust.length;i++){var p=dust[i];p.x+=(p.vx+Math.sin(ft/2200+p.ph)*3)*dt;p.y+=p.vy*dt;if(p.y<-4){p.y=H+4;p.x=Math.random()*W;}if(p.x<-4)p.x=W+4;if(p.x>W+4)p.x=-4;
      var tw=.6+.4*Math.sin(ft/600+p.ph*3);c.fillStyle=hexA(p.c,(p.a*tw).toFixed(3));c.beginPath();c.arc(p.x,p.y,p.r,0,7);c.fill();}
    // comet along the newest job's edge
    var L=current&&lay(current);
    if(L&&L.pts&&L.pts.length>1){var n=L.pts.length,u=(ft/2600)%1,f=u*(n-1),k=Math.floor(f),q=f-k,a=L.pts[k],b=L.pts[Math.min(n-1,k+1)];
      var x=(a[0]+(b[0]-a[0])*q)*SC,y=(a[1]+(b[1]-a[1])*q)*SC,pulse=.5+.5*Math.sin(ft/420);
      var cg=c.createRadialGradient(x,y,0,x,y,10+5*pulse);cg.addColorStop(0,'rgba(255,255,255,.9)');cg.addColorStop(.3,hexA(L.hex,.55));cg.addColorStop(1,hexA(L.hex,0));
      c.fillStyle=cg;c.beginPath();c.arc(x,y,10+5*pulse,0,7);c.fill();
      c.globalAlpha=.25+.2*pulse;c.strokeStyle=L.hex;c.lineWidth=2;c.setLineDash([3,4]);c.beginPath();L.pts.forEach(function(pt,j){j?c.lineTo(pt[0]*SC,pt[1]*SC):c.moveTo(pt[0]*SC,pt[1]*SC);});c.stroke();c.setLineDash([]);c.globalAlpha=1;}
    // shimmer rings where strokes land
    rings=rings.filter(function(r){r.t+=dt;var k=r.t/0.9;if(k>=1)return false;c.strokeStyle=hexA(r.c,(0.6*(1-k)).toFixed(3));c.lineWidth=1.4;c.beginPath();c.arc(r.x,r.y,3+k*16,0,7);c.stroke();
      c.fillStyle='rgba(255,255,255,'+(0.5*(1-k)).toFixed(3)+')';c.beginPath();c.arc(r.x,r.y,1.6*(1-k)+0.4,0,7);c.fill();return true;});
    raf=requestAnimationFrame(frame);run=true;}
  function kick(){if(RM)return;if(!raf&&!document.hidden){raf=requestAnimationFrame(frame);run=true;}}
  document.addEventListener('visibilitychange',function(){if(!document.hidden){lt=0;kick();}});
  function ready(){if(!G()||!G().man()){setTimeout(ready,300);return;}geom();seedDust();kick();}
  ready();
  window.thrydGodeFx={land:land,highlight:setHL,redraw:drawHL,state:function(){return {running:run&&!RM,frames:frames,dust:dust.length,current:current,hl:hl,chime:chimeOn,rm:RM,fig:fig.style.transform};}};
})();
