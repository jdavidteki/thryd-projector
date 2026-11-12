// Scene state feeds the tweet popups. The current GIF/frame, cut objects
// (labels and classes from data/medium_cuts.json and the packs), object
// positions or drags, and the safe lines already linked to the scene's card
// are scored against the existing tweet deck. A steady tick and every drag
// end re-evaluate so these functions keep firing. The 160x132 bubble still
// only ever shows the official embed (no names). Nothing is posted.
(function(root){
  var TICK_MS = 4000;
  var TOP_N = 5;
  var BUBBLE_W = 160;
  var BUBBLE_H = 132;
  var STOP = {
    the:1, and:1, that:1, this:1, with:1, from:1, have:1, for:1, are:1, was:1,
    were:1, you:1, your:1, but:1, not:1, all:1, can:1, its:1, they:1,
    them:1, their:1, what:1, when:1, who:1, how:1, why:1, will:1, just:1,
    about:1, into:1, than:1, then:1, also:1, some:1, more:1, been:1, has:1,
    had:1, our:1, out:1, now:1, one:1, two:1, new:1, any:1, still:1, even:1,
    over:1, only:1, very:1, like:1, get:1, got:1, don:1, dont:1, did:1,
    didn:1, does:1, his:1, her:1, she:1, him:1, here:1, there:1, too:1,
    via:1, http:1, https:1, www:1, com:1, gif:1, src:1, safe:1
  };
  // light class/place expansions so a "person" cut can match "people"/"man"
  var SYN = {
    person:['person','people','man','men','woman','women','child','children','boy','girl','crowd'],
    chair:['chair','seat','stool','bench'],
    bowl:['bowl','plate','dish'],
    laptop:['laptop','computer','screen'],
    cup:['cup','glass','drink'],
    clock:['clock','time','watch'],
    umbrella:['umbrella','rain'],
    ring:['ring','wedding','bride','groom','marriage'],
    wedding:['wedding','bride','groom','ring','marriage'],
    tent:['tent','canopy']
  };

  function words(s){
    if(!s) return [];
    return String(s).toLowerCase().replace(/[#@]/g, ' ').match(/[a-z0-9']{3,}/g) || [];
  }
  function tokens(s){
    var out = [], seen = Object.create(null), i, w;
    var list = Array.isArray(s) ? s : words(s);
    for(i = 0; i < list.length; i++){
      w = String(list[i] || '').toLowerCase().replace(/'+/g, "'").replace(/^'+|'+$/g, '');
      if(!w || w.length < 3 || STOP[w] || /^cut\d+$/.test(w) || /^\d+$/.test(w)) continue;
      if(seen[w]) continue;
      seen[w] = 1;
      out.push(w);
    }
    return out;
  }
  function addTok(bag, list, weight){
    var i, w, t = tokens(list);
    for(i = 0; i < t.length; i++){
      w = t[i];
      bag[w] = (bag[w] || 0) + (weight || 1);
      if(SYN[w]){
        SYN[w].forEach(function(x){ if(x !== w) bag[x] = (bag[x] || 0) + (weight || 1) * 0.6; });
      }
    }
    return bag;
  }
  function zoneOf(x, y){
    var zx = x < 33 ? 'left' : (x > 66 ? 'right' : 'center');
    var zy = y < 33 ? 'top' : (y > 66 ? 'bottom' : 'middle');
    return {x: zx, y: zy, token: zx + '-' + zy};
  }
  function pct(v){
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  // Build a comparable scene snapshot from a plain object (tests) or live DOM.
  function buildState(input){
    input = input || {};
    var objects = (input.objects || []).map(function(o, i){
      var x = o.x == null ? 50 : +o.x, y = o.y == null ? 50 : +o.y;
      var z = zoneOf(x, y);
      return {
        id: o.id || o.label || ('obj-' + i),
        label: o.label || '',
        klass: o.klass || o.model_class || o.class || '',
        name: o.name || '',
        x: +x.toFixed(2),
        y: +y.toFixed(2),
        zone: z.token,
        dragged: !!o.dragged
      };
    });
    var frame = {
      id: input.id || input.medium_image_id || '',
      url: input.url || '',
      cap: input.cap || '',
      dir: input.dir || '',
      card: input.card || '',
      place: input.place || ''
    };
    var safes = (input.safes || []).map(function(s){
      return {line: s.line || s, card: s.card || frame.card || '', src: s.src || 'safe'};
    }).filter(function(s){ return s.line; });
    var bag = Object.create(null);
    addTok(bag, [frame.card, frame.place, frame.cap], 2);
    objects.forEach(function(o){
      var w = o.dragged ? 4 : 2;
      addTok(bag, [o.klass, o.label, o.name], w);
      addTok(bag, [o.zone.split('-')[0], o.zone.split('-')[1]], o.dragged ? 2 : 1);
    });
    safes.forEach(function(s){ addTok(bag, s.line, 3); });
    if(input.extra) addTok(bag, input.extra, 2);
    var tokList = Object.keys(bag);
    var sig = [frame.id || frame.dir || frame.cap || '', frame.card || '', frame.place || '']
      .concat(objects.map(function(o){ return [o.id, o.klass, o.zone, o.dragged ? 'd' : 's', Math.round(o.x/10), Math.round(o.y/10)].join(':'); }))
      .concat(safes.map(function(s){ return 'safe:' + String(s.line).slice(0, 40); }))
      .join('|');
    return {frame: frame, objects: objects, safes: safes, card: frame.card || '', tokens: tokList, weights: bag, signature: sig};
  }

  function tweetOk(t){
    if(!t) return false;
    if(t.purged) return false;
    var id = t.id == null ? '' : String(t.id);
    if(!/^\d{1,22}$/.test(id)) return false;
    return true;
  }

  function score(tweet, state){
    if(!tweetOk(tweet) || !state) return 0;
    var line = tweet.line || '';
    var tw = tokens(line);
    var i, w, s = 0, hits = [];
    var bag = state.weights || {};
    for(i = 0; i < tw.length; i++){
      w = tw[i];
      if(bag[w]){ s += bag[w]; hits.push(w); }
    }
    if(tweet.card && state.card && String(tweet.card) === String(state.card)) s += 5;
    // bonus: a dragged object class or zone still matching
    if(state.objects){
      state.objects.forEach(function(o){
        if(!o.dragged) return;
        var k = tokens([o.klass, o.label, o.name, o.zone]);
        k.forEach(function(tok){ if(bag[tok] && tw.indexOf(tok) >= 0) s += 2; });
      });
    }
    return {score: Math.round(s * 100) / 100, hits: hits};
  }

  function pick(tweets, state, n){
    n = n || TOP_N;
    var ranked = (tweets || []).filter(tweetOk).map(function(t){
      var r = score(t, state);
      return {id: String(t.id), score: r.score, hits: r.hits, line: t.line, src: t.src, purged: !!t.purged, card: t.card || null, tweet: t};
    });
    ranked.sort(function(a, b){
      if(b.score !== a.score) return b.score - a.score;
      return String(a.id) < String(b.id) ? -1 : 1;
    });
    // if nothing overlapped, keep a stable fallback so a popup can still appear
    var top = ranked.filter(function(r){ return r.score > 0; });
    if(!top.length) top = ranked;
    return top.slice(0, n);
  }

  var api = {TICK_MS: TICK_MS, TOP_N: TOP_N, BUBBLE_W: BUBBLE_W, BUBBLE_H: BUBBLE_H, tokens: tokens, score: score, pick: pick, buildState: buildState, tweetOk: tweetOk, zoneOf: zoneOf};
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ThrydFrameFeed = api;

  if(typeof document === 'undefined') return;

  var tweets = [];
  var safesAll = [];
  var cutsManifest = null;
  var packMeta = {}; // medium_image_id -> {labels, klasses}
  var lastSig = '';
  var lastPick = null;
  var rawMount = null;
  var timer = null;
  var started = false;
  var log = [];

  function feedObj(){
    var f = root.__THRYD_FEED;
    if(!f || !Array.isArray(f.decisions)){
      f = {decisions: log, latest: null};
      root.__THRYD_FEED = f;
    }
    f.decisions = log;
    return f;
  }

  function record(row){
    log.push(row);
    if(log.length > 80) log.splice(0, log.length - 80);
    var f = feedObj();
    f.latest = row;
    f.decisions = log;
    try{
      if(typeof root.thrydDebug === 'function'){
        var d = root.thrydDebug();
        if(d) d.feed = row;
      }
    }catch(e){}
    try{ console.info('[thryd-feed]', row.reason, row.changed, row.picked && row.picked[0] && row.picked[0].id, row.scene && row.scene.signature); }catch(e){}
    return row;
  }

  function metaCard(){
    var meta = (document.getElementById('meta') || {}).textContent || '';
    var m = meta.match(/\b([wj]\d+)\b/i);
    if(m) return m[1].toLowerCase();
    var cap = (document.getElementById('cap') || {}).textContent || '';
    m = cap.match(/(?:^|[\/_\s·.-])([wj]\d+)(?:\b|[\/_.-]|$)/i);
    return m ? m[1].toLowerCase() : '';
  }

  function gifFrom(text){
    var s = String(text || '');
    var m = s.match(/1\*[A-Za-z0-9_-]+\.(?:gif|webp|png)/);
    if(m) return m[0];
    m = s.match(/[A-Za-z0-9_*-]{8,}\.(?:gif|webp|png)/);
    return m ? m[0] : '';
  }

  function readCuts(){
    var out = [];
    var layer = document.getElementById('mcut');
    if(layer && layer.querySelectorAll){
      var sprites = layer.querySelectorAll('canvas.sprite');
      var offs = layer._off || [];
      var labels = layer._labels || [];
      var klasses = layer._klasses || [];
      sprites.forEach(function(node, i){
        var idx = node.dataset.i != null ? +node.dataset.i : i;
        var off = offs[idx] || {x:0, y:0};
        var box = layer._box || {width: layer.clientWidth || 1, height: layer.clientHeight || 1, left:0, top:0};
        var xpx = (parseFloat(node.style.left) || 0) - (box.left || 0);
        var ypx = (parseFloat(node.style.top) || 0) - (box.top || 0);
        var x = box.width ? (xpx / box.width) * 100 : 50;
        var y = box.height ? (ypx / box.height) * 100 : 50;
        var dragged = !!(off && (Math.abs(off.x) > 2 || Math.abs(off.y) > 2));
        out.push({
          id: labels[idx] || node.dataset.label || ('cut' + (idx + 1)),
          label: labels[idx] || node.dataset.label || ('cut' + (idx + 1)),
          klass: klasses[idx] || node.dataset.klass || '',
          name: node.dataset.name || '',
          x: x, y: y, dragged: dragged
        });
      });
    }
    var objs = document.getElementById('objs');
    if(objs){
      objs.querySelectorAll('.dob, .ob:not(.dpatch)').forEach(function(b){
        if(b.classList.contains('dpatch')) return;
        out.push({
          id: b.dataset.id || b.dataset.label || '',
          label: b.dataset.label || '',
          klass: (b.dataset.id || '').indexOf('c:') === 0 ? 'person' : (b.dataset.klass || 'object'),
          name: b.dataset.name || '',
          x: pct(b.style.left),
          y: pct(b.style.top),
          dragged: b.dataset.dp === '1' || b.classList.contains('away') || b.classList.contains('lifting')
        });
      });
    }
    return out;
  }

  function readChars(){
    var names = [];
    try{
      var C = root.CUR || {};
      (C.speakers || []).forEach(function(n){ if(n) names.push(n); });
    }catch(e){}
    try{
      var ctx = root.thrydCtx && root.thrydCtx();
      var m = ctx && ctx.lastM;
      if(m && m.chars) m.chars.forEach(function(c){ if(c && c.name) names.push(c.name); });
      if(m && m.objs) m.objs.forEach(function(o){ if(o && o.label) names.push(o.label); });
    }catch(e){}
    document.querySelectorAll('#ents .chip, #map .ph').forEach(function(e){
      var n = e.title || e.dataset.name || (e.querySelector && e.querySelector('.lab') && e.querySelector('.lab').textContent) || e.textContent;
      if(n) names.push(String(n).trim());
    });
    return names;
  }

  function liveState(){
    var dbg = {};
    try{ dbg = (root.thrydDebug && root.thrydDebug()) || {}; }catch(e){ dbg = {}; }
    var cap = (dbg.cap) || ((document.getElementById('cap') || {}).textContent || '');
    var url = dbg.url || '';
    var id = gifFrom(url) || gifFrom(cap) || gifFrom(dbg.bg || '');
    var card = metaCard();
    var place = '';
    var world = (document.getElementById('world') || {}).textContent || '';
    if(world && !/^from /i.test(world) && world !== '—') place = world;
    var extra = readChars();
    var safes = safesAll.filter(function(s){ return !card || String(s.card || '').toLowerCase() === card; });
    try{
      (root.CUR && root.CUR.lines || []).forEach(function(l){
        if(l && l.line) safes.push({line: l.line, card: l.card || card, src: l.src || 'cur'});
      });
    }catch(e){}
    return buildState({
      id: id,
      url: url,
      cap: cap,
      dir: dbg.bg || '',
      card: card,
      place: place,
      objects: readCuts(),
      safes: safes,
      extra: extra
    });
  }

  function applyPackMeta(mid){
    var layer = document.getElementById('mcut');
    var meta = mid && packMeta[mid];
    if(!layer || !meta) return meta || null;
    layer._labels = meta.labels || [];
    layer._klasses = meta.klasses || [];
    return meta;
  }
  function rememberCutMeta(){
    var dbg = {};
    try{ dbg = (root.thrydDebug && root.thrydDebug()) || {}; }catch(e){}
    var mid = gifFrom(dbg.url || '') || gifFrom(dbg.cap || '') || gifFrom((document.getElementById('cap') || {}).textContent || '');
    if(!mid) return;
    if(packMeta[mid]){ applyPackMeta(mid); return; }
    var man = cutsManifest;
    if(!man || !man.assets){
      if(root.ThrydMediumCuts && typeof ThrydMediumCuts.loadManifest === 'function'){
        ThrydMediumCuts.loadManifest().then(function(m){ cutsManifest = m; rememberCutMeta(); });
      }
      return;
    }
    var row = (man.assets || []).find(function(a){ return a && (a.medium_image_id === mid || gifFrom(a.medium_image_id) === mid); });
    if(!row){ packMeta[mid] = {labels:[], klasses:[]}; return; }
    if(row.objects && row.objects.length){
      packMeta[mid] = {
        labels: row.objects.map(function(o){ return (o && o.label) || ''; }),
        klasses: row.objects.map(function(o){ return (o && (o.model_class || o.class)) || ''; })
      };
      applyPackMeta(mid);
      return;
    }
    if(!row.pack){ packMeta[mid] = {labels:[], klasses:[]}; return; }
    packMeta[mid] = {labels:[], klasses:[], pending:true};
    loadJson(row.pack).then(function(pack){
      var objects = (pack && pack.objects) || [];
      packMeta[mid] = {
        labels: objects.map(function(o){ return (o && o.label) || ''; }),
        klasses: objects.map(function(o){ return (o && (o.model_class || o.class)) || ''; })
      };
      applyPackMeta(mid);
    });
  }

  function showPick(choice, baseMs){
    var b = document.getElementById('bubble');
    if(!b || !choice || !root.ThrydTweet || !rawMount) return;
    var who = null;
    try{
      var speakers = (root.CUR && root.CUR.speakers) || [];
      var i;
      for(i = 0; i < speakers.length; i++){
        var e = document.querySelector('#ents .chip[data-id="c:' + CSS.escape(speakers[i]) + '"], #ents [data-id="c:' + CSS.escape(speakers[i]) + '"]');
        if(e){ who = e; break; }
      }
      if(!who) who = document.querySelector('#ents .chip, #ents [data-id^="c:"]');
    }catch(e){}
    var r = who ? who.getBoundingClientRect() : {left: 12, right: 12, top: 80, height: 20};
    var right = who && who.classList.contains('r');
    var M = 12, BW = BUBBLE_W, BH = BUBBLE_H;
    if(b.querySelector('.who')) b.querySelector('.who').textContent = '';
    if(b.querySelector('.txt')) b.querySelector('.txt').textContent = '';
    b.classList.toggle('r', !!right);
    var x = right ? r.left - 6 : r.right + 6;
    x = right ? Math.max(BW + M, Math.min(innerWidth - M, x)) : Math.max(M, Math.min(innerWidth - BW - M, x));
    // keep the box out of the scene's center half when we have no speaker
    if(!who) x = M;
    b.style.left = x + 'px';
    b.style.top = Math.min(innerHeight - BH / 2 - M, Math.max(BH / 2 + M, (r.top + r.height / 2) || (innerHeight * 0.25))) + 'px';
    var item = choice.tweet || {id: choice.id, line: choice.line, src: choice.src, purged: choice.purged};
    rawMount(b, item, baseMs == null ? 5000 : baseMs);
  }

  function evaluate(reason){
    if(!tweets.length) return null;
    rememberCutMeta();
    var state = liveState();
    var ranked = pick(tweets, state, TOP_N);
    var top = ranked[0] || null;
    var changed = !!(top && (!lastPick || lastPick.id !== top.id || lastSig !== state.signature));
    var row = {
      at: new Date().toISOString(),
      reason: reason || 'tick',
      changed: changed,
      scene: {
        id: state.frame.id,
        cap: state.frame.cap,
        card: state.card,
        place: state.frame.place,
        objects: state.objects.map(function(o){ return {id: o.id, label: o.label, klass: o.klass, x: o.x, y: o.y, zone: o.zone, dragged: o.dragged}; }),
        tokens: state.tokens.slice(0, 24),
        signature: state.signature
      },
      picked: ranked.map(function(r){ return {id: r.id, score: r.score, hits: r.hits.slice(0, 8), line: String(r.line || '').slice(0, 80)}; })
    };
    record(row);
    if(top && (changed || reason === 'drag' || reason === 'start')){
      lastPick = top;
      lastSig = state.signature;
      try{ showPick(top); }catch(e){}
    }else if(top){
      lastPick = top;
      lastSig = state.signature;
    }
    return row;
  }

  function hookMount(){
    if(!root.ThrydTweet || typeof root.ThrydTweet.mount !== 'function') return;
    if(root.ThrydTweet._feedHooked) return;
    rawMount = root.ThrydTweet.mount.bind(root.ThrydTweet);
    root.ThrydTweet.mount = function(host, item, baseMs){
      // #bubble always shows the scene-scored tweet; other hosts pass through
      if(host && host.id === 'bubble' && lastPick && lastPick.tweet){
        return rawMount(host, lastPick.tweet, baseMs);
      }
      if(host && host.id === 'bubble' && tweets.length){
        var ranked = pick(tweets, liveState(), 1);
        if(ranked[0]) return rawMount(host, ranked[0].tweet, baseMs);
      }
      return rawMount(host, item, baseMs);
    };
    root.ThrydTweet._feedHooked = true;
  }

  function hookChoose(){
    if(typeof root.thrydChoose !== 'function' || root.thrydChoose._feedHooked) return;
    var prev = root.thrydChoose;
    root.thrydChoose = function(lines){
      if(lastPick && lastPick.tweet) return lastPick.tweet;
      var ranked = tweets.length ? pick(tweets, liveState(), 1) : [];
      if(ranked[0]) return ranked[0].tweet;
      return prev(lines);
    };
    root.thrydChoose._feedHooked = true;
  }

  function hookDebug(){
    if(typeof root.thrydDebug !== 'function' || root.thrydDebug._feedHooked) return;
    var prev = root.thrydDebug;
    root.thrydDebug = function(){
      var d = {};
      try{ d = prev() || {}; }catch(e){ d = {}; }
      d.feed = (root.__THRYD_FEED && root.__THRYD_FEED.latest) || null;
      return d;
    };
    root.thrydDebug._feedHooked = true;
  }

  function onPointerUp(ev){
    var layer = document.getElementById('mcut');
    var dragging = document.body.classList.contains('dragmode')
      || (layer && layer._drag)
      || document.querySelector('#objs .dob[data-held="1"], #objs .dob.lifting, #mcut canvas.sprite');
    // only fire as a drag when a drag was actually in progress
    var wasDrag = document.body.classList.contains('dragmode') || (layer && layer._drag)
      || document.querySelector('#objs .dob[data-held="1"], #objs .dob.lifting');
    if(!wasDrag) return;
    setTimeout(function(){ evaluate('drag'); }, 30);
  }

  function loadJson(path){
    return fetch(path + (path.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now(), {cache: 'no-store'})
      .then(function(r){ return r.ok ? r.json() : []; })
      .catch(function(){ return []; });
  }

  function ingestTweets(rows){
    tweets = (rows || []).map(function(p){
      return root.ThrydTweet && ThrydTweet.deckRow ? ThrydTweet.deckRow(p) : {line: p.line, src: p.src, move: !!p.move, id: p.id, purged: p.purged, card: p.card};
    }).filter(tweetOk);
  }

  function start(){
    if(started) return;
    started = true;
    feedObj();
    hookMount(); hookChoose(); hookDebug();
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerUp, true);
    Promise.all([loadJson('data/tweets_all.json'), loadJson('data/precisions.json'), loadJson('data/medium_cuts.json')]).then(function(pair){
      ingestTweets(pair[0]);
      safesAll = Array.isArray(pair[1]) ? pair[1] : [];
      cutsManifest = pair[2] || {assets:[]};
      hookMount(); hookChoose(); hookDebug();
      rememberCutMeta();
      evaluate('start');
    });
    timer = setInterval(function(){
      hookMount(); hookChoose(); hookDebug();
      rememberCutMeta();
      evaluate('tick');
    }, TICK_MS);
  }

  api.evaluate = function(reason){ return evaluate(reason || 'api'); };
  api.liveState = liveState;
  api.start = start;
  api._setDeck = function(rows, safes){ ingestTweets(rows); if(safes) safesAll = safes; };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(typeof window !== 'undefined' ? window : globalThis);
