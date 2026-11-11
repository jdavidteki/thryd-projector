// Slide-duration clock. The armed wait is always the current selection.
// A visible page checks the deadline on animation frames, so a delayed
// setTimeout (background timer throttling) cannot hold a shown slide past
// the selected duration. Hidden pages are left to the browser.
(function(root){
  const ALLOWED=[8,30,60];
  function parseSlide(raw, fallback){
    const n=+raw;
    if(ALLOWED.includes(n)) return n;
    const fb=fallback==null?8:+fallback;
    return ALLOWED.includes(fb)?fb:8;
  }
  function createClock(opts){
    const now=opts.now||function(){return performance.now();};
    const setTimer=opts.setTimer||function(fn,ms){return setTimeout(fn,ms);};
    const clearTimer=opts.clearTimer||function(id){clearTimeout(id);};
    let duration=parseSlide(opts.duration,8);
    let pending=null, token=0, deadline=Infinity;
    function arm(base){
      const my=++token;
      if(pending!=null){clearTimer(pending); pending=null;}
      const ms=duration*1000;
      const start=base==null?now():base;
      deadline=start+ms;
      const delay=Math.max(0, deadline-now());
      pending=setTimer(function(){if(my!==token)return; due();}, delay);
    }
    function due(){
      const my=++token;
      if(pending!=null){clearTimer(pending); pending=null;}
      deadline=Infinity;
      try{ if(opts.onTick) opts.onTick(); }
      finally{ if(my===token) arm(now()); }
    }
    function setDuration(raw){
      duration=parseSlide(raw, duration);
      arm(now());
      return duration;
    }
    function poke(){ if(now()>=deadline) due(); }
    function stop(){ token++; if(pending!=null){clearTimer(pending); pending=null;} deadline=Infinity; }
    arm(now());
    return {setDuration:setDuration, getDuration:function(){return duration;}, poke:poke, stop:stop};
  }
  const api={ALLOWED:ALLOWED, parseSlide:parseSlide, createClock:createClock};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  root.ThrydSlideClock=api;
})(typeof window!=='undefined'?window:globalThis);
