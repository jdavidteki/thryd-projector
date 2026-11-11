// Device-local settings, cut positions, and repeat-visit bytes.
// Live state, the agenda, and the cut manifest stay on the network.
// Positions are visual only. Nothing here is sent to the story engine.
(function(root){
  var SETTINGS = 'thryd_keep_v1';
  var PLACES = 'thryd_keep_pos_v1';
  var BUDGET = 40 * 1024 * 1024;
  var PLACE_CAP = 40;

  function defaults(){ return {slide: null, mute: null, lastGif: ''}; }

  function readJson(storage, key){
    try{
      var raw = storage.getItem(key);
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){ return null; }
  }

  function writeJson(storage, key, value){
    try{ storage.setItem(key, JSON.stringify(value)); return true; }
    catch(e){ return false; }
  }

  function settings(storage){
    var o = readJson(storage, SETTINGS) || {};
    var slide = [8, 30, 60].indexOf(+o.slide) >= 0 ? +o.slide : null;
    var mute = o.mute === 0 || o.mute === 1 ? o.mute : null;
    if(mute === null){
      try{ var old = storage.getItem('thryd_mute'); if(old === '0' || old === '1') mute = old === '1' ? 1 : 0; }catch(e){}
    }
    if(slide === null){
      try{ var s = +storage.getItem('thryd_slide'); if([8, 30, 60].indexOf(s) >= 0) slide = s; }catch(e){}
    }
    var lastGif = typeof o.lastGif === 'string' && o.lastGif.length > 0 && o.lastGif.length < 180 ? o.lastGif : '';
    return {slide: slide, mute: mute, lastGif: lastGif};
  }

  function saveSettings(storage, patch){
    var cur = settings(storage);
    if(patch.slide != null && [8, 30, 60].indexOf(+patch.slide) >= 0) cur.slide = +patch.slide;
    if(patch.mute === 0 || patch.mute === 1) cur.mute = patch.mute;
    if(typeof patch.lastGif === 'string') cur.lastGif = patch.lastGif.slice(0, 179);
    var ok = writeJson(storage, SETTINGS, {v: 1, slide: cur.slide, mute: cur.mute, lastGif: cur.lastGif});
    try{
      if(cur.slide != null) storage.setItem('thryd_slide', String(cur.slide));
      if(cur.mute != null) storage.setItem('thryd_mute', cur.mute ? '1' : '0');
    }catch(e){}
    return ok;
  }

  function placeKey(sha, label, version){
    return String(sha || '') + '|' + String(label || 'cut') + '|' + String(version || '1');
  }

  function loadPlaces(storage){
    var o = readJson(storage, PLACES);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  }

  function loadPlace(storage, key){
    var hit = loadPlaces(storage)[key];
    if(!hit || typeof hit.x !== 'number' || typeof hit.y !== 'number') return null;
    if(!isFinite(hit.x) || !isFinite(hit.y)) return null;
    return {x: hit.x, y: hit.y};
  }

  function savePlace(storage, key, xy){
    if(!key || !xy || typeof xy.x !== 'number' || typeof xy.y !== 'number') return false;
    var all = loadPlaces(storage);
    var keys = Object.keys(all);
    if(!all[key] && keys.length >= PLACE_CAP) delete all[keys[0]];
    all[key] = {x: xy.x, y: xy.y};
    if(writeJson(storage, PLACES, all)) return true;
    var left = Object.keys(all);
    if(left.length) delete all[left[0]];
    return writeJson(storage, PLACES, all);
  }

  function stageChoice(queryMlib, lastGif, explicitResume){
    if(queryMlib) return {id: String(queryMlib), why: 'query'};
    if(explicitResume && lastGif) return {id: String(lastGif), why: 'resume'};
    return {id: null, why: 'live'};
  }

  function mayCache(url){
    var u = String(url || '');
    if(/\/data\/|state\.json|live_extra\.json|medium_cuts\.json|codever\.json|timeline\.json|replays?\.json|drag\.json|movement/.test(u)) return false;
    return true;
  }

  function byteLength(buf){
    if(!buf) return 0;
    if(buf.byteLength != null) return buf.byteLength;
    return buf.length || 0;
  }

  async function trim(db, budget){
    var rows = await db.all();
    rows.sort(function(a, b){ return (a.at || 0) - (b.at || 0); });
    var total = 0;
    rows.forEach(function(r){ total += r.n || byteLength(r.bytes); });
    var i = 0;
    while(total > budget && i < rows.length){
      await db.del(rows[i].key);
      total -= rows[i].n || byteLength(rows[i].bytes);
      i++;
    }
  }

  function create(deps){
    deps = deps || {};
    var storage = deps.storage;
    var db = deps.db || null;
    var budget = deps.budget || BUDGET;
    var net = deps.fetch || (typeof fetch === 'function' ? fetch : null);
    return {
      settings: function(){ return storage ? settings(storage) : defaults(); },
      saveSettings: function(patch){ return storage ? saveSettings(storage, patch) : false; },
      rememberGif: function(id){ return storage ? saveSettings(storage, {lastGif: id || ''}) : false; },
      placeKey: placeKey,
      loadPlace: function(key){ return storage ? loadPlace(storage, key) : null; },
      savePlace: function(key, xy){ return storage ? savePlace(storage, key, xy) : false; },
      stageChoice: stageChoice,
      mayCache: mayCache,
      fetchCached: async function(url, init, key){
        if(!mayCache(url) || !key) return net(url, init);
        var hit = null;
        try{ if(db) hit = await db.get(key); }catch(e){ hit = null; }
        if(hit && hit.bytes){
          var copy = hit.bytes.slice ? hit.bytes.slice(0) : hit.bytes;
          var parsed = null, jsonOk = false;
          try{ parsed = JSON.parse(new TextDecoder().decode(copy)); jsonOk = true; }catch(e){}
          if(/\.json(\?|$)/.test(String(url)) && !jsonOk){
            try{ await db.del(key); }catch(e2){}
          }else{
            return {ok: true, status: 200, arrayBuffer: function(){ return Promise.resolve(copy); }, json: function(){ return jsonOk ? Promise.resolve(parsed) : Promise.reject(new Error('bad json')); }};
          }
        }
        var res = await net(url, init);
        if(!res || !res.ok || !db) return res;
        try{
          var buf = await res.arrayBuffer();
          var rec = {bytes: buf, at: Date.now(), n: byteLength(buf)};
          var putOk = false;
          try{ putOk = await db.put(key, rec); }catch(e){ putOk = false; }
          if(!putOk){
            try{ await trim(db, budget / 2); putOk = await db.put(key, rec); }catch(e2){}
          }
          try{ await trim(db, budget); }catch(e3){}
          return {ok: true, status: res.status, arrayBuffer: function(){ return Promise.resolve(buf); }, json: function(){ return Promise.resolve(JSON.parse(new TextDecoder().decode(buf))); }};
        }catch(e){ return res; }
      },
      resetLocal: async function(){
        if(storage){
          try{ storage.removeItem(PLACES); }catch(e){}
          saveSettings(storage, {lastGif: ''});
        }
        if(!db) return true;
        try{
          var rows = await db.all();
          for(var i = 0; i < rows.length; i++) await db.del(rows[i].key);
          return true;
        }catch(e){ return false; }
      }
    };
  }

  function browserDb(){
    if(typeof indexedDB === 'undefined') return null;
    var opened = new Promise(function(res){
      try{
        var r = indexedDB.open('thryd-keep', 1);
        r.onupgradeneeded = function(){ r.result.createObjectStore('blobs'); };
        r.onsuccess = function(){ res(r.result); };
        r.onerror = function(){ res(null); };
      }catch(e){ res(null); }
    });
    function run(mode, fn){
      return opened.then(function(db){
        if(!db) return null;
        return new Promise(function(res){
          try{
            var t = db.transaction('blobs', mode);
            var out = fn(t.objectStore('blobs'), res);
            t.oncomplete = function(){ if(out === undefined) res(null); };
            t.onerror = function(){ res(null); };
          }catch(e){ res(null); }
        });
      });
    }
    return {
      get: function(key){ return run('readonly', function(store, res){ var q = store.get(key); q.onsuccess = function(){ res(q.result || null); }; q.onerror = function(){ res(null); }; return q; }); },
      put: function(key, rec){ return run('readwrite', function(store, res){ var q = store.put(rec, key); q.onsuccess = function(){ res(true); }; q.onerror = function(){ res(null); }; return q; }); },
      del: function(key){ return run('readwrite', function(store, res){ var q = store.delete(key); q.onsuccess = function(){ res(true); }; q.onerror = function(){ res(null); }; return q; }); },
      all: function(){ return run('readonly', function(store, res){ var q = store.getAllKeys(); q.onsuccess = function(){
        var keys = q.result || [];
        if(!keys.length){ res([]); return; }
        var left = keys.length, rows = [];
        keys.forEach(function(k){
          var g = store.get(k);
          g.onsuccess = function(){ rows.push(Object.assign({key: k}, g.result || {})); if(--left === 0) res(rows); };
          g.onerror = function(){ if(--left === 0) res(rows); };
        });
      }; q.onerror = function(){ res([]); }; return q; }); }
    };
  }

  var api = {create: create, settings: settings, saveSettings: saveSettings, placeKey: placeKey, stageChoice: stageChoice, mayCache: mayCache, BUDGET: BUDGET};
  if(typeof localStorage !== 'undefined'){
    try{ root.ThrydKeep = create({storage: localStorage, db: browserDb()}); }
    catch(e){ root.ThrydKeep = create({storage: null, db: null}); }
  }
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
