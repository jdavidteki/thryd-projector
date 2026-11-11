// Keeps an explicit library choice on stage. Live boot, NEWEST, and the
// slideshow call backdrop with other sets; those must not replace a pin.
// A mode button clears it. No query and no manual choice: nothing is pinned.
(function(root){
  function create(){
    let pin = null;
    return {
      hold(set){ pin = set || null; return pin; },
      clear(){ pin = null; },
      pinned(){ return pin; },
      allow(set){ return !pin || set === pin; }
    };
  }
  const api = {create};
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ThrydMlibPin = api;
})(typeof window !== 'undefined' ? window : globalThis);
