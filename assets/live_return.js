// After ten slideshow steps, the next tick returns to whatever the newest
// live view is at that moment. The count then starts over. Ten means ten
// changes of the slideshow, not ten frames inside one GIF.
(function(root){
  function create(limit){
    const every = limit == null ? 10 : limit;
    let n = 0;
    return {
      reset(){ n = 0; },
      count(){ return n; },
      tick(){
        if(n >= every){ n = 0; return 'live'; }
        n += 1;
        return 'advance';
      }
    };
  }
  function step(cycle, opts){
    const pool = opts.pool || [];
    let poolI = opts.poolI || 0;
    if(pool.length <= 1) return {poolI: poolI, action: 'idle', set: pool[0] || null};
    const kind = cycle.tick();
    if(kind === 'live'){
      const nw = opts.newest ? opts.newest() : null;
      if(nw){
        const at = pool.indexOf(nw);
        return {poolI: at < 0 ? poolI : at, action: 'live', set: nw};
      }
    }
    poolI = (poolI + 1) % pool.length;
    const nw = opts.newest ? opts.newest() : null;
    if(nw && pool[poolI] === nw && pool.length > 2) poolI = (poolI + 1) % pool.length;
    return {poolI: poolI, action: 'advance', set: pool[poolI]};
  }
  const api = {create, step};
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ThrydLiveReturn = api;
})(typeof window !== 'undefined' ? window : globalThis);
