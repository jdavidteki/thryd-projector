/* v584: the building is a canvas you can touch (Jesuye 19 Nov 2026 7:44 PM ET: "the building should feel more like a canvas so we can
   touch it and move it around, while the story is colouring").
   Drag / one finger = pan, pinch / wheel = zoom (about the pointer), a slight perspective tilt that follows the motion and eases back,
   momentum on release, double-tap / double-click = reset. Only CSS transforms on #view (the paint + fx canvases), so the paint loop
   keeps running untouched underneath. touch-action:none on the diagram so page scroll never fights the gesture.
   window.thrydView exposes the view for QA; floaters read the transformed bounds (gode.js exRect). */
(function(){
  var fig=document.getElementById('fig'),paint=document.getElementById('paint'),fx=document.getElementById('fx');
  if(!fig||!paint)return;
  var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var view=document.createElement('div');view.id='view';fig.insertBefore(view,paint);view.appendChild(paint);if(fx)view.appendChild(fx);
  var hint=document.createElement('div');hint.id='viewhint';hint.textContent='drag · pinch or scroll to zoom · double-tap to reset';fig.appendChild(hint);
  var s=1,x=0,y=0,rx=0,ry=0,vx=0,vy=0,raf=0,lt=0,ptr={},pinch=null,drag=null,moved=0,lastTap=0,resetA=null;
  var MIN=1,MAX=3;
  function W(){return fig.clientWidth;}function H(){return fig.clientHeight;}
  function clamp(){var w=W(),h=H(),keep=0.25;
    x=Math.min(w*(1-keep),Math.max(-(w*s-w*keep),x));y=Math.min(h*(1-keep),Math.max(-(h*s-h*keep),y));}
  function apply(){view.style.transform='translate3d('+x.toFixed(2)+'px,'+y.toFixed(2)+'px,0) scale('+s.toFixed(4)+') rotateX('+rx.toFixed(3)+'deg) rotateY('+ry.toFixed(3)+'deg)';
    fig.classList.toggle('moved',s!==1||Math.abs(x)>0.5||Math.abs(y)>0.5);}
  function zoomAt(px,py,f){var ns=Math.max(MIN,Math.min(MAX,s*f));f=ns/s;x=px-(px-x)*f;y=py-(py-y)*f;s=ns;clamp();}
  function loc(ev){var r=fig.getBoundingClientRect();return [ev.clientX-r.left,ev.clientY-r.top];}
  function tick(t){raf=0;var dt=lt?Math.min(0.05,(t-lt)/1000):0.016;lt=t;var go=false;
    if(resetA){var k=Math.min(1,(t-resetA.t0)/420),e=1-Math.pow(1-k,3);s=resetA.s+(1-resetA.s)*e;x=resetA.x*(1-e);y=resetA.y*(1-e);if(k<1)go=true;else resetA=null;}
    else if(!drag&&!pinch&&(Math.abs(vx)>5||Math.abs(vy)>5)){x+=vx*dt;y+=vy*dt;var fr=Math.pow(0.06,dt);vx*=fr;vy*=fr;clamp();go=true;}
    var trx=RM?0:Math.max(-7,Math.min(7,-vy*0.012)),tr_y=RM?0:Math.max(-9,Math.min(9,vx*0.012));
    if(drag||pinch){rx+=(trx-rx)*Math.min(1,dt*10);ry+=(tr_y-ry)*Math.min(1,dt*10);}else{rx*=Math.pow(0.02,dt);ry*=Math.pow(0.02,dt);}
    if(Math.abs(rx)>0.02||Math.abs(ry)>0.02)go=true;else if(!drag&&!pinch){rx=0;ry=0;}
    apply();if(go||drag||pinch)raf=requestAnimationFrame(tick);else lt=0;}
  function kick(){if(!raf)raf=requestAnimationFrame(tick);}
  function reset(){vx=vy=0;resetA={t0:performance.now(),s:s,x:x,y:y};if(RM){s=1;x=y=0;resetA=null;rx=ry=0;apply();return;}kick();}
  function two(){var k=Object.keys(ptr);if(k.length<2)return null;var a=ptr[k[0]],b=ptr[k[1]];return {mx:(a[0]+b[0])/2,my:(a[1]+b[1])/2,d:Math.hypot(a[0]-b[0],a[1]-b[1])||1};}
  fig.addEventListener('pointerdown',function(ev){if(ev.button&&ev.button!==0)return;ev.preventDefault();try{fig.setPointerCapture(ev.pointerId);}catch(e){}
    ptr[ev.pointerId]=loc(ev);resetA=null;vx=vy=0;
    var n=Object.keys(ptr).length;if(n===1){drag={x:ptr[ev.pointerId][0],y:ptr[ev.pointerId][1],t:performance.now()};moved=0;}else if(n===2){drag=null;pinch=two();}
    fig.classList.add('grab');kick();});
  fig.addEventListener('pointermove',function(ev){if(!(ev.pointerId in ptr))return;var p=loc(ev);ptr[ev.pointerId]=p;
    if(pinch){var q=two();if(!q)return;zoomAt(q.mx,q.my,q.d/pinch.d);x+=q.mx-pinch.mx;y+=q.my-pinch.my;clamp();pinch=q;moved+=10;}
    else if(drag){var now=performance.now(),dx=p[0]-drag.x,dy=p[1]-drag.y,dts=Math.max(1,now-drag.t)/1000;x+=dx;y+=dy;clamp();
      vx=vx*0.6+(dx/dts)*0.4;vy=vy*0.6+(dy/dts)*0.4;drag={x:p[0],y:p[1],t:now};moved+=Math.abs(dx)+Math.abs(dy);}
    apply();kick();});
  function up(ev){if(!(ev.pointerId in ptr))return;delete ptr[ev.pointerId];var n=Object.keys(ptr).length;
    if(n===0){if(drag&&performance.now()-drag.t>90){vx=vy=0;}drag=null;pinch=null;fig.classList.remove('grab');
      if(moved<8&&ev.type==='pointerup'){var now=performance.now();if(now-lastTap<320){reset();lastTap=0;}else lastTap=now;}
      if(RM){vx=vy=0;}kick();}
    else if(n===1){pinch=null;var k=Object.keys(ptr)[0];drag={x:ptr[k][0],y:ptr[k][1],t:performance.now()};}}
  fig.addEventListener('pointerup',up);fig.addEventListener('pointercancel',up);
  fig.addEventListener('wheel',function(ev){ev.preventDefault();var p=loc(ev);var f=Math.exp(-ev.deltaY*(ev.ctrlKey?0.01:0.0018));zoomAt(p[0],p[1],f);apply();},{passive:false});
  fig.addEventListener('dblclick',function(ev){ev.preventDefault();reset();});
  fig.addEventListener('contextmenu',function(ev){if(ev.pointerType!=='mouse')ev.preventDefault();});
  addEventListener('resize',function(){clamp();apply();});
  window.thrydView={get:function(){return {s:+s.toFixed(4),x:+x.toFixed(1),y:+y.toFixed(1),rx:+rx.toFixed(2),ry:+ry.toFixed(2)};},
    rect:function(){var a=view.getBoundingClientRect(),b=fig.getBoundingClientRect();return {l:Math.max(a.left,b.left),t:Math.max(a.top,b.top),r:Math.min(a.right,b.right),b:Math.min(a.bottom,b.bottom)};},reset:reset};
  apply();
})();
