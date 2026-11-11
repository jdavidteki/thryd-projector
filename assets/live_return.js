// After ten slideshow steps, the next tick returns to whatever the newest
// live view is at that moment. That return is an interrupt: the library
// cursor stays on the last other item, and the following step resumes there.
// Ten means ten changes of the slideshow, not ten frames inside one GIF.
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
  function ident(set){
    return set && (set.dir || set.medium_image_id || '') || '';
  }
  function step(cycle, opts){
    opts = opts || {};
    const pool = opts.pool || [];
    let poolI = opts.poolI || 0;
    const cursor = opts.cursor || '';
    if(opts.hold) return {poolI: poolI, action: 'hold', set: null, cursor: cursor};
    if(pool.length <= 1) return {poolI: poolI, action: 'idle', set: pool[0] || null, cursor: ident(pool[0]) || cursor};
    const kind = cycle.tick();
    const newest = opts.newest ? opts.newest() : null;
    if(kind === 'live' && newest) return {poolI: poolI, action: 'live', set: newest, cursor: cursor};
    let start = poolI;
    if(cursor){
      const at = pool.findIndex(s => ident(s) === cursor);
      if(at >= 0) start = at;
    }
    if(start < 0 || start >= pool.length) start = 0;
    poolI = (start + 1) % pool.length;
    if(newest && pool.length > 2 && ident(pool[poolI]) && ident(pool[poolI]) === ident(newest)) poolI = (poolI + 1) % pool.length;
    return {poolI: poolI, action: 'advance', set: pool[poolI], cursor: ident(pool[poolI])};
  }
  const api = {create, step};
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ThrydLiveReturn = api;
})(typeof window !== 'undefined' ? window : globalThis);
