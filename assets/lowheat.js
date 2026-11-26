/* lowheat.js v4 (26 Nov 2026 6:00 PM ET, Jesuye: put the fun back — heat cuts that changed what viewers see are lifted).
   Loaded FIRST on the projector, /story/ and the lovemap so every later script's setInterval / requestAnimationFrame goes
   through one shared scheduler.
   States
     active / idle  the picture keeps running at the display's own frame rate while the tab is visible, even after 60 s with
                    no input (ticker, /story/ drift + painting, card spin, grain, bobs, pin pulse, LIVE blink, cut float).
                    Data polls stay slowed to 2-5 min (not on screen). ?cool=1 is a manual opt-in that drops frames and
                    shadows; the automatic cool governor is off.
     hidden  tab/app hidden: everything paused except audio and persistence; on return one refresh of every poll, then resume.
   ?lowheat=0 turns the scheduler off. ?lhidle=<ms> still changes the idle stamp (QA, no longer freezes the picture).
   prefers-reduced-motion still disables the cut-float CSS (stage.js). window.LH has the state + stats. */
(function(){
'use strict';
var W=window;if(W.LH)return;
var Q;try{Q=new URLSearchParams(location.search);}catch(e){Q={get:function(){return null;}};}
var nSI=W.setInterval.bind(W),nCI=W.clearInterval.bind(W),nST=W.setTimeout.bind(W),nCT=W.clearTimeout.bind(W);
var nRAF=W.requestAnimationFrame?W.requestAnimationFrame.bind(W):function(cb){return nST(function(){cb(performance.now());},16);};
var OFF=Q.get('lowheat')==='0';
var LH={v:4,off:OFF,state:'active',stats:{frames:0,runs:0}};
W.LH=LH;
if(OFF){LH.deco=nRAF;LH.keep=nSI;LH.slide=nSI;LH.decoEvery=nSI;LH.poll=nSI;LH.on=function(){};LH.poke=function(){};return;}
var IDLE_MS=Math.max(1000,+Q.get('lhidle')||60000),ACTIVE_FRAME=1000/30-3,IDLE_FRAME=100,IDLE_FAST=10000,MAXT=2147483000;
var now=function(){return Date.now();};
var RM=false;try{RM=!!(W.matchMedia&&W.matchMedia('(prefers-reduced-motion: reduce)').matches);}catch(e){}
LH.idleMs=IDLE_MS;LH.lastInput=RM?now()-IDLE_MS:now();LH.reducedMotion=RM;
var P=null;try{if(W.parent!==W&&W.parent.LH&&!W.parent.LH.off)P=W.parent.LH;}catch(e){P=null;}
LH.child=!!P;
function rethrow(err){nST(function(){throw err;},0);}

/* ---------- intervals: one native timer for all of them ---------- */
var recs=new Map(),seq=0,BASE=0x40000000,tmr=0,tmrAt=Infinity;
function pollMs(ms){if(ms>=300000)return ms;if(ms>=60000)return 180000;return 120000;}
function effMs(r,s){s=s||LH.state;
  if(s==='hidden')return r.kind==='keep'?r.ms:Infinity;
  if(r.kind==='keep'||r.kind==='slide'||r.kind==='deco')return r.ms;
  if(r.kind==='poll')return r.pms;
  return r.ms;} /* v635 funback: idle no longer freezes decorative loops or stretches fast timers */
function arm(){var m=Infinity;recs.forEach(function(r){if(r.due<m)m=r.due;});
  if(tmr&&m===tmrAt)return;if(tmr){nCT(tmr);tmr=0;}tmrAt=m;if(m===Infinity)return;
  tmr=nST(fire,Math.min(MAXT,Math.max(0,m-now())));}
function fire(){tmr=0;tmrAt=Infinity;var t=now(),list=[];
  recs.forEach(function(r){if(r.due<=t+4)list.push(r);});list.sort(function(a,b){return a.due-b.due;});
  for(var i=0;i<list.length;i++){var r=list[i];if(!recs.has(r.id))continue;r.last=t;r.n++;var e=effMs(r);r.due=e===Infinity?Infinity:t+e;
    LH.stats.runs++;try{r.fn.apply(W,r.args);}catch(err){rethrow(err);}}
  arm();}
function add(fn,ms,args,kind,pms){
  if(typeof fn!=='function'){var code=String(fn);fn=function(){(0,eval)(code);};}
  ms=Math.max(4,+ms||0);var id=BASE+(++seq);
  var r={id:id,fn:fn,args:args||[],ms:ms,kind:kind||(ms>=10000?'poll':'fast'),pms:pms||pollMs(ms),last:now(),due:0,n:0};
  var e=effMs(r);r.due=e===Infinity?Infinity:r.last+e;recs.set(id,r);arm();return id;}
function rest(a,k){return Array.prototype.slice.call(a,k);}
W.setInterval=function(fn,ms){return add(fn,ms,rest(arguments,2));};
W.clearInterval=function(id){if(recs.delete(+id)){arm();return;}nCI(id);};
W.clearTimeout=function(id){if(recs.delete(+id)){arm();return;}nCT(id);};
LH.keep=function(fn,ms){return add(fn,ms,rest(arguments,2),'keep');};     // audio, persistence: never touched
LH.slide=function(fn,ms){return add(fn,ms,rest(arguments,2),'slide');};   // slideshow / live GIF frames: own pace, paused only when hidden
LH.decoEvery=function(fn,ms){return add(fn,ms,rest(arguments,2),'deco');};// decorative: runs while visible, paused only when hidden
LH.poll=function(fn,ms,slowMs){return add(fn,ms,rest(arguments,3),'poll',slowMs);};
LH.intervals=function(){var o=[];recs.forEach(function(r){o.push({id:r.id,kind:r.kind,ms:r.ms,eff:effMs(r),runs:r.n,name:r.fn.name||''});});return o;};

/* ---------- animation frames: one native frame, batched ---------- */
var rq=new Map(),rseq=0,rnative=0,rtimer=0,lastFlush=0,ptrDown=false;
function rafReq(cb,deco){var id=++rseq;rq.set(id,{cb:cb,deco:deco});pump();return id;}
W.requestAnimationFrame=function(cb){return rafReq(cb,false);};
W.cancelAnimationFrame=function(id){rq.delete(id);};
LH.deco=function(cb){return rafReq(cb,true);};
function pump(){if(rnative||rtimer||!rq.size)return;var s=LH.state;if(s==='hidden')return;
  /* v635 funback: display-rate frames while visible. ?cool=1 may still pace frames; the automatic governor is off. */
  if(LH.cool&&!ptrDown&&lastFlush){var w=lastFlush+ACTIVE_FRAME-performance.now()-5;
    if(w>3){rtimer=nST(function(){rtimer=0;if(LH.state!=='hidden')rnative=nRAF(flush);},w);return;}}
  rnative=nRAF(flush);}
function flush(ts){rnative=0;var s=LH.state;if(s==='hidden')return;
  if(LH.cool&&!ptrDown&&lastFlush&&ts-lastFlush<ACTIVE_FRAME&&ts>=lastFlush){rnative=nRAF(flush);return;}
  lastFlush=ts;var batch=[];rq.forEach(function(r,id){batch.push(r);rq.delete(id);});
  LH.stats.frames++;for(var i=0;i<batch.length;i++){try{batch[i].cb(ts);}catch(err){rethrow(err);}}
  pump();}
LH.pending=function(){var d=0,o=0;rq.forEach(function(r){if(r.deco)d++;else o++;});return {deco:d,other:o};};

/* ---------- cool mode (v614, v635 funback) ----------
   Automatic cool-mode (dropping to ~20 fps, killing shadows and bobs when frames were slow) is off: it changed what viewers saw.
   ?cool=1 still forces it on (QA / a hot phone), ?cool=0 is a no-op now that the governor does not run. LH.cool / LH.coolWhy show it. */
var COOL_Q=Q.get('cool'),G={n:0,slow:0,bad:0,good:0};LH.cool=false;LH.coolTrips=0;LH.coolWhy='';
function setCool(on,why){if(LH.cool===on)return;LH.cool=on;LH.coolWhy=on?why:'';if(on)LH.coolTrips++;G.n=G.slow=G.bad=G.good=0;
  ACTIVE_FRAME=on?1000/20-3:1000/60-3;var h=document.documentElement;if(h&&h.classList)h.classList.toggle('lh-cool',on);}
LH.setCool=setCool;
function govern(gap){return;} /* v635: no automatic visual degradation */
if(COOL_Q==='1')setCool(true,'forced (?cool=1)');

/* ---------- state ---------- */
var blurred=false,listeners=[],pausedMedia=[];
function dragging(){var b=document.body;if(!b)return false;
  return b.classList.contains('dragmode')||!!document.querySelector('[data-dragging="1"],#objs .dob.lifting,#objs .dob[data-held="1"]');}
function compute(){if(document.visibilityState==='hidden')return 'hidden';
  if(P){try{var ps=P.state;return ps==='hidden'?'idle':ps;}catch(e){P=null;}}
  if(ptrDown||dragging())return 'active';if(blurred)return 'idle';
  return now()-LH.lastInput>=IDLE_MS?'idle':'active';}
function media(s){try{
  if(s==='hidden'){document.querySelectorAll('video').forEach(function(v){if(!v.paused&&(v.muted||v.loop)){try{v.pause();pausedMedia.push(v);}catch(e){}}});}
  else if(pausedMedia.length){var l=pausedMedia;pausedMedia=[];l.forEach(function(v){try{var p=v.play();if(p&&p.catch)p.catch(function(){});}catch(e){}});}
}catch(e){}}
function setState(s){var prev=LH.state;if(s===prev)return;LH.state=s;LH.since=now();
  var h=document.documentElement;if(h&&h.classList){h.classList.toggle('lh-idle',s==='idle');h.classList.toggle('lh-hidden',s==='hidden');}
  var t=now(),k=0;
  recs.forEach(function(r){var e=effMs(r,s);if(e===Infinity){r.due=Infinity;return;}
    var wasOff=effMs(r,prev)===Infinity;
    if(r.kind==='poll'&&(prev==='hidden'||(s==='active'&&t-r.last>=r.ms))){r.due=t+250*(k++);return;} // one refresh on return
    r.due=wasOff?Math.max(t,r.last+e):Math.max(t,r.last+e);});
  arm();if(s!=='hidden')pump();media(s);
  listeners.slice().forEach(function(f){try{f(s,prev);}catch(e){listeners.splice(listeners.indexOf(f),1);}});}
function update(){setState(compute());}
LH.on=function(f){listeners.push(f);return function(){var i=listeners.indexOf(f);if(i>=0)listeners.splice(i,1);};};
LH.poke=function(){LH.lastInput=now();if(LH.state!=='active')update();armIdle();};
LH.update=update;
var idleT=0;
function armIdle(){if(idleT)return;var w=Math.max(50,LH.lastInput+IDLE_MS-now());
  idleT=nST(function(){idleT=0;if(now()-LH.lastInput>=IDLE_MS){update();if(LH.state==='active')armIdle();}else armIdle();},w+20);}
function input(){LH.lastInput=now();if(P){try{P.poke();}catch(e){}}if(LH.state!=='active'||blurred){blurred=false;update();}armIdle();}
['pointermove','touchstart','touchmove','keydown','wheel'].forEach(function(ev){W.addEventListener(ev,input,{passive:true,capture:true});});
W.addEventListener('scroll',input,{passive:true,capture:true});
W.addEventListener('pointerdown',function(){ptrDown=true;input();},{passive:true,capture:true});
['pointerup','pointercancel'].forEach(function(ev){W.addEventListener(ev,function(){ptrDown=false;input();},{passive:true,capture:true});});
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')LH.lastInput=now();update();armIdle();});
W.addEventListener('blur',function(){nST(function(){var a=document.activeElement;if(a&&a.tagName==='IFRAME')return;if(document.hasFocus&&document.hasFocus())return;blurred=true;update();},0);});
W.addEventListener('focus',function(){blurred=false;LH.lastInput=now();update();armIdle();});
if(P){var off=P.on(function(){update();});W.addEventListener('pagehide',function(){try{off();}catch(e){}});}
LH.state=compute();if(LH.state!=='active'){var h0=document.documentElement;if(h0)h0.classList.add(LH.state==='idle'?'lh-idle':'lh-hidden');}
armIdle();
})();
