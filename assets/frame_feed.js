// Scene state feeds the tweet popups. The current GIF/frame, cut objects
// (labels and classes from data/medium_cuts.json and the packs), object
// positions or drags, and the safe lines already linked to the scene's card
// are scored against the existing tweet deck. A steady tick and every drag
// end re-evaluate so these functions keep firing. The 160x132 bubble still
// only ever shows the official embed (no names). Nothing is posted.
(function(root){
  var TICK_MS = 4000;
  var TOP_N = 8;
  var TOP_K = 8;
  var NO_REPEAT = 10;
  var MIN_CANDIDATES = 5;
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
    via:1, http:1, https:1, www:1, com:1, gif:1, src:1, safe:1,
    say:1, because:1, where:1, pls:1, just:1, him:1, let:1, going:1,
    view:1, una:1, dey:1, wan:1, tok:1, make:1, see:1, na:1
  };
  // Related-word map (objects, themes, stems). Horse -> horses/riding/stable, chair -> seat/sit.
  var RELATED = {
    chair:['seat','sit','sitting','stool','bench','furniture'],
    seat:['chair','sit','sitting','stool','bench'],
    sit:['chair','seat','sitting','stool'],
    stool:['chair','seat','bench'],
    bench:['chair','seat','stool'],
    bowl:['plate','dish','food','eat','soup'],
    plate:['bowl','dish','food'],
    laptop:['computer','screen','keyboard','typing','tech'],
    computer:['laptop','screen','keyboard','typing'],
    cup:['glass','drink','tea','coffee','mug'],
    clock:['time','watch','hour','minute'],
    umbrella:['rain','wet','weather'],
    ring:['wedding','bride','groom','marriage','gold','finger'],
    wedding:['bride','groom','ring','marriage','tent','church','wife','husband'],
    tent:['canopy','camp','wedding','shelter'],
    horse:['horses','riding','ride','rider','stable','stallion','pony','mare'],
    horses:['horse','riding','ride','stable','pony'],
    riding:['horse','horses','rider','stable'],
    person:['people','crowd','someone','body','figure'],
    people:['person','crowd'],
    church:['chapel','prayer','pastor','altar','wedding'],
    nigeria:['nigerian','naija','9ja','lagos','kano','africa'],
    nigerian:['nigeria','naija','9ja','africa'],
    kano:['nigeria','nigerian','city','north'],
    phone:['mobile','call','screen','text'],
    car:['vehicle','road','drive','bus'],
    road:['roads','street','drive','car','travel'],
    table:['desk','furniture','eat'],
    book:['read','page','story'],
    child:['children','kid','kids','boy','girl'],
    children:['child','kid','kids'],
    rain:['umbrella','wet','water'],
    food:['eat','bowl','plate','rice'],
    money:['naira','rich','poor','pay'],
    protest:['endsars','sars','street','police'],
    police:['sars','endsars','officer']
  };
  var SYN = RELATED;

  function words(s){
    if(!s) return [];
    return String(s).toLowerCase().replace(/[#@\[\]]/g, ' ').match(/[a-z0-9']{3,}/g) || [];
  }
  function tokens(s){
    var out = [], seen = Object.create(null), i, j, parts, w;
    var list = Array.isArray(s) ? s : [s];
    for(i = 0; i < list.length; i++){
      parts = words(list[i]);
      for(j = 0; j < parts.length; j++){
        w = parts[j].replace(/'+/g, "'").replace(/^'+|'+$/g, '');
        if(!w || w.length < 3 || STOP[w] || /^cut\d+$/.test(w) || /^\d+$/.test(w)) continue;
        if(w.length > 14 && /\d/.test(w)) continue; // medium hashes, not scene words
        if(seen[w]) continue;
        seen[w] = 1;
        out.push(w);
      }
    }
    return out;
  }
  function stem(w){
    w = String(w || '').toLowerCase();
    if(w.length <= 3) return w;
    if(/ies$/.test(w) && w.length > 5) return w.slice(0, -3) + 'y';
    if(/ing$/.test(w) && w.length > 5){
      var b = w.slice(0, -3);
      if(b.length > 3 && b.charAt(b.length - 1) === b.charAt(b.length - 2)) return b.slice(0, -1);
      return b;
    }
    if(/ied$/.test(w) && w.length > 5) return w.slice(0, -3) + 'y';
    if(/ed$/.test(w) && w.length > 4){
      var e = w.slice(0, -2);
      if(e.length > 3 && e.charAt(e.length - 1) === e.charAt(e.length - 2)) return e.slice(0, -1);
      return e;
    }
    if(/(?:xes|zes|ches|shes)$/.test(w) && w.length > 4) return w.slice(0, -2);
    if(/s$/.test(w) && !/ss$/.test(w) && w.length > 4) return w.slice(0, -1);
    return w;
  }
  function relatedOf(w){
    var s = stem(w);
    return RELATED[w] || RELATED[s] || [];
  }
  function expand(term){
    var out = [], seen = Object.create(null);
    function add(x, note){ if(!x || seen[x] || STOP[x] || x.length < 3) return; seen[x] = 1; out.push({term: x, note: note || 'exact'}); }
    add(term, 'exact');
    add(stem(term), 'stem');
    relatedOf(term).forEach(function(x){ add(x, 'related'); add(stem(x), 'related'); });
    return out;
  }
  var idfMap = null, idfN = 0;
  function buildIdf(list){
    var df = Object.create(null), n = 0;
    (list || []).forEach(function(t){
      if(!tweetOk(t)) return;
      n++;
      var seen = Object.create(null);
      tokens(t.line).forEach(function(w){
        [w, stem(w)].forEach(function(k){ if(!seen[k]){ seen[k] = 1; df[k] = (df[k] || 0) + 1; } });
      });
    });
    idfMap = Object.create(null);
    idfN = n;
    Object.keys(df).forEach(function(k){ idfMap[k] = Math.log((n + 1) / (df[k] + 1)) + 1; });
  }
  function idfOf(w){ return (idfMap && (idfMap[w] || idfMap[stem(w)])) || 1; }
  function addTok(bag, list, weight){
    var i, w, t = tokens(list), ex;
    for(i = 0; i < t.length; i++){
      w = t[i];
      expand(w).forEach(function(ex){
        var factor = ex.note === 'exact' ? 1 : (ex.note === 'stem' ? 0.8 : 0.55);
        bag[ex.term] = (bag[ex.term] || 0) + (weight || 1) * factor;
      });
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
      var colors = o.colors || o.color || o.colour || '';
      if(Array.isArray(colors)) colors = colors.join(' ');
      return {
        id: o.id || o.label || ('obj-' + i),
        label: o.label || '',
        klass: o.klass || o.model_class || o.class || '',
        name: o.name || '',
        colors: colors,
        size: o.size || '',
        count: o.count,
        moving: !!(o.moving || o.dragged),
        related: o.related || o.words || o.scene_words || [],
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
    addTok(bag, [frame.card, frame.place, frame.cap, input.theme, input.title], 2);
    objects.forEach(function(o){
      var distinctive = o.klass && o.klass !== 'person' && o.klass !== 'foreground';
      var w = (o.dragged ? 8 : 6) + (distinctive ? 4 : 0);
      addTok(bag, [o.klass, o.label, o.name], w);
      addTok(bag, [o.colors, o.size, o.related, o.count ? String(o.count) : ''], Math.max(2, w * 0.5));
      addTok(bag, [o.zone.split('-')[0], o.zone.split('-')[1]], o.dragged ? 3 : 1);
      if(o.moving || o.dragged) addTok(bag, ['moving', 'motion'], 1);
    });
    if(input.extra) addTok(bag, input.extra, 2);
    if(input.related) addTok(bag, input.related, 2);
    if(input.theme) addTok(bag, input.theme, 3);
    safes.forEach(function(s){ addTok(bag, s.line, 1.2); });
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

  function lookupQuery(q, w){
    if(!q) return null;
    if(q[w]) return q[w];
    var st = stem(w);
    if(q[st]) return q[st];
    var rel = relatedOf(w), i;
    for(i = 0; i < rel.length; i++){ if(q[rel[i]]) return {weight: q[rel[i]].weight * 0.55, src: q[rel[i]].src, how: 'related'}; }
    if(w.length >= 4){
      var keys = Object.keys(q), k, ks;
      for(i = 0; i < keys.length; i++){
        k = keys[i]; ks = stem(k);
        if(k.length >= 4 && (w.indexOf(k) === 0 || k.indexOf(w) === 0 || st === ks || (st.length >= 4 && (ks.indexOf(st) === 0 || st.indexOf(ks) === 0))))
          return {weight: q[k].weight * 0.4, src: q[k].src, how: 'partial'};
      }
    }
    return null;
  }
  function compileQuery(state){
    var q = Object.create(null);
    function put(term, weight, src){
      if(!term) return;
      tokens(term).forEach(function(w){
        expand(w).forEach(function(ex){
          var factor = ex.note === 'exact' ? 1 : (ex.note === 'stem' ? 0.8 : 0.55);
          var wt = (weight || 1) * factor;
          if(!q[ex.term] || q[ex.term].weight < wt) q[ex.term] = {weight: wt, src: src || 'scene', how: ex.note};
        });
      });
    }
    var bag = (state && state.weights) || {};
    Object.keys(bag).forEach(function(k){ put(k, bag[k], 'bag'); });
    return q;
  }
  function score(tweet, state){
    if(!tweetOk(tweet) || !state) return {score: 0, hits: []};
    if(!state.query) state.query = compileQuery(state);
    var line = tweet.line || '';
    var tw = tokens(line);
    var i, w, s = 0, hits = [], seen = Object.create(null);
    for(i = 0; i < tw.length; i++){
      w = tw[i];
      var hit = lookupQuery(state.query, w);
      if(!hit) continue;
      var add = hit.weight * idfOf(w);
      s += add;
      if(!seen[w]){ seen[w] = 1; hits.push(w); }
    }
    if(tweet.card && state.card && String(tweet.card) === String(state.card)) s += 5;
    if(state.safes && state.safes.length){
      var safeScore = 0;
      state.safes.forEach(function(safe){
        var st = tokens(safe.line).filter(function(x){ return x.length >= 5; });
        var n = 0, k;
        for(k = 0; k < st.length; k++){ if(tw.indexOf(st[k]) >= 0 || tw.indexOf(stem(st[k])) >= 0) n++; }
        if(n >= 2){ safeScore += 2 * n; if(!seen['safe']){ seen['safe'] = 1; hits.push('safe:' + n); } }
      });
      if(safeScore > 8) safeScore = 8;
      s += safeScore;
    }
    // every object in the frame scores; a dragged one gets a bonus
    if(state.objects){
      state.objects.forEach(function(o){
        var bonus = o.dragged ? 3 : 1;
        var k = tokens([o.klass, o.label, o.name, o.colors, o.size, o.related, o.zone]);
        k.forEach(function(tok){
          var ok = tw.indexOf(tok) >= 0 || tw.indexOf(stem(tok)) >= 0;
          if(!ok){
            var rel = relatedOf(tok);
            ok = rel.some(function(r){ return tw.indexOf(r) >= 0 || tw.indexOf(stem(r)) >= 0; });
          }
          if(ok) s += bonus;
        });
      });
    }
    return {score: Math.round(s * 100) / 100, hits: hits};
  }

  function rowOf(t, r){
    return {id: String(t.id), score: r.score, hits: r.hits, line: t.line, src: t.src, purged: !!t.purged, card: t.card || null, tweet: t};
  }
  function rankTweets(list, state){
    if(!idfMap || idfN !== (list || []).filter(tweetOk).length) buildIdf(list);
    if(state) state.query = compileQuery(state);
    var ranked = (list || []).filter(tweetOk).map(function(t){ return rowOf(t, score(t, state)); });
    ranked.sort(function(a, b){
      if(b.score !== a.score) return b.score - a.score;
      return String(a.id) < String(b.id) ? -1 : 1;
    });
    return {ranked: ranked, matched: ranked.filter(function(r){ return r.score > 0; })};
  }
  // Ranked matches only (never the whole deck sorted by id). Empty when nothing scored.
  function pick(list, state, n){
    n = n || TOP_N;
    return rankTweets(list, state).matched.slice(0, n);
  }
  function weightedPick(items, rng){
    rng = rng || Math.random;
    if(!items || !items.length) return null;
    var i, sum = 0, w, r, weights = [];
    for(i = 0; i < items.length; i++){
      w = items[i].score > 0 ? items[i].score : 1;
      weights.push(w);
      sum += w;
    }
    r = rng() * sum;
    for(i = 0; i < items.length; i++){
      r -= weights[i];
      if(r <= 0) return items[i];
    }
    return items[items.length - 1];
  }
  function notRecent(items, recent){
    recent = recent || [];
    return (items || []).filter(function(r){ return recent.indexOf(String(r.id)) < 0; });
  }
  // Widen score tiers until at least MIN_CANDIDATES connected tweets remain.
  // Never return an unrelated (zero-score) tweet.
  function widen(matched, need){
    need = need || MIN_CANDIDATES;
    var floors = [6, 3, 1.5, 0.5, 0.0001];
    var i, pool = [];
    for(i = 0; i < floors.length; i++){
      pool = (matched || []).filter(function(r){ return r.score >= floors[i]; });
      if(pool.length >= need) return pool;
    }
    return (matched || []).filter(function(r){ return r.score > 0; });
  }
  function chooseOne(list, state, opts){
    opts = opts || {};
    var recent = (opts.recent || []).map(String);
    var k = opts.k || TOP_K;
    var need = opts.min || MIN_CANDIDATES;
    var rng = opts.rng || Math.random;
    var ranked = rankTweets(list, state);
    var connected = widen(ranked.matched, need);
    var pool = notRecent(connected, recent);
    if(pool.length > k) pool = pool.slice(0, Math.max(k, need));
    if(!pool.length) pool = notRecent(ranked.matched, recent);
    if(!pool.length) pool = connected.slice(0, Math.max(k, need)); // all recent: still a connected tweet, never a zero-score fallback
    if(!pool.length) return {choice: null, pool: [], matched: ranked.matched, fallback: false, cursor: opts.cursor || 0};
    var chosen = weightedPick(pool, rng);
    return {choice: chosen, pool: pool, matched: ranked.matched, fallback: false, cursor: opts.cursor || 0, terms: (chosen && chosen.hits) || []};
  }

  var api = {TICK_MS: TICK_MS, TOP_N: TOP_N, TOP_K: TOP_K, NO_REPEAT: NO_REPEAT, MIN_CANDIDATES: MIN_CANDIDATES, BUBBLE_W: BUBBLE_W, BUBBLE_H: BUBBLE_H, tokens: tokens, stem: stem, expand: expand, score: score, pick: pick, rankTweets: rankTweets, weightedPick: weightedPick, chooseOne: chooseOne, widen: widen, buildState: buildState, buildIdf: buildIdf, tweetOk: tweetOk, zoneOf: zoneOf};
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ThrydFrameFeed = api;

  if(typeof document === 'undefined') return;

  var tweets = [];
  var safesAll = [];
  var story = null;
  var cutsManifest = null;
  var sceneContext = null; // optional data/scene_context.json, keyed by medium id
  var objectsIndex = null; // optional data/objects.json or per-id sidecars
  var packMeta = {}; // medium_image_id -> {labels, klasses, colors, related, ...}
  var lastSig = '';
  var lastPick = null;
  var recentIds = [];
  var rotateCursor = 0;
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
    try{
      if(story && Array.isArray(story.characters)) story.characters.forEach(function(c){ if(c && c.name) names.push(c.name); });
      if(story && Array.isArray(story.objects)) story.objects.forEach(function(o){ if(o && o.label) names.push(o.label); });
    }catch(e){}
    return names;
  }

  function midKey(id){
    return String(id || '').replace(/\*/g, '_');
  }
  function rowForMid(store, mid){
    if(!store || !mid) return null;
    if(Array.isArray(store)){
      return store.find(function(r){ return r && (r.medium_image_id === mid || r.id === mid || midKey(r.medium_image_id||r.id||'') === midKey(mid)); }) || null;
    }
    return store[mid] || store[midKey(mid)] || store[gifFrom(mid)] || null;
  }
  function contextFor(mid){
    var row = rowForMid(sceneContext, mid) || rowForMid(objectsIndex, mid) || (packMeta[mid] && packMeta[mid].context) || null;
    if(!row) return {objects: [], theme: '', title: '', related: [], lines: []};
    var objects = row.objects || row.cuts || [];
    return {
      objects: objects,
      theme: row.theme || row.place || (row.seed && (row.seed.theme || row.seed.d || row.seed.s)) || '',
      title: row.title || row.caption || row.medium_title || '',
      related: row.related || row.words || [],
      lines: row.lines || row.picked_card_lines || row.card_lines || row.safes || []
    };
  }
  function mergeContext(objects, mid){
    var ctx = contextFor(mid);
    (ctx.objects || []).forEach(function(src, i){
      var dst = null, lab = (src.label || src.id || '').toLowerCase();
      if(lab) dst = objects.find(function(o){ return String(o.label||'').toLowerCase() === lab || String(o.id||'').toLowerCase() === lab; });
      if(!dst) dst = objects[i];
      if(!dst){
        objects.push({
          id: src.label || src.id || ('ctx-'+i),
          label: src.label || '',
          klass: src.klass || src.model_class || src.class || '',
          name: src.name || '',
          colors: Array.isArray(src.colors) ? src.colors.join(' ') : (src.colors || src.color || ''),
          size: src.size || '',
          count: src.count,
          related: src.related || src.words || src.scene_words || [],
          x: src.x, y: src.y, dragged: !!src.dragged, moving: !!src.moving
        });
        return;
      }
      if(!dst.klass) dst.klass = src.klass || src.model_class || src.class || dst.klass;
      if(!dst.colors) dst.colors = Array.isArray(src.colors) ? src.colors.join(' ') : (src.colors || src.color || '');
      if(!dst.size) dst.size = src.size || dst.size;
      if(dst.count == null) dst.count = src.count;
      dst.related = [].concat(dst.related || [], src.related || src.words || src.scene_words || []);
      if(src.moving) dst.moving = true;
    });
    return ctx;
  }
  function fetchSidecars(mid){
    if(!mid || (packMeta[mid] && packMeta[mid].sidecarTried)) return;
    packMeta[mid] = packMeta[mid] || {labels:[], klasses:[]};
    packMeta[mid].sidecarTried = true;
    var key = midKey(mid);
    var paths = [
      'assets/medium_cuts/' + key + '.objects.json',
      'assets/medium_cuts/' + key.replace(/\.gif$/,'') + '.objects.json',
      'data/objects/' + key + '.json'
    ];
    var pack = cutsManifest && (cutsManifest.assets||[]).find(function(a){ return a && (a.medium_image_id === mid || midKey(a.medium_image_id||'') === key); });
    if(pack && pack.pack){
      paths.push(pack.pack.replace(/\.json$/i, '.objects.json'));
      paths.push(pack.pack.replace(/[^/]+$/, 'objects.json'));
    }
    paths.forEach(function(path){
      loadJson(path).then(function(j){
        if(!j) return;
        packMeta[mid] = packMeta[mid] || {};
        packMeta[mid].context = Object.assign({}, packMeta[mid].context || {}, Array.isArray(j) ? {objects:j} : j);
      });
    });
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
    if(world && !/^from /i.test(world) && world !== '—' && !/\d{1,2}:\d{2}\s*(am|pm)/i.test(world) && !/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(world)) place = world;
    var extra = readChars();
    if(story && story.current_card && !card) card = String(story.current_card).toLowerCase();
    if(story && story.current_place && !place) place = story.current_place;
    var safes = safesAll.filter(function(s){ return !card || String(s.card || '').toLowerCase() === card; });
    try{
      (root.CUR && root.CUR.lines || []).forEach(function(l){
        if(l && l.line) safes.push({line: l.line, card: l.card || card, src: l.src || 'cur'});
      });
    }catch(e){}
    var seenSafe = Object.create(null);
    safes = safes.filter(function(s){
      var k = String(s.line || '').replace(/\s+/g, ' ').trim();
      if(!k || seenSafe[k]) return false;
      seenSafe[k] = 1;
      return true;
    });
    var objects = readCuts();
    fetchSidecars(id);
    var ctx = mergeContext(objects, id);
    (ctx.lines || []).forEach(function(l){
      var line = typeof l === 'string' ? l : (l && l.line);
      if(line) safes.push({line: line, card: (l && l.card) || card, src: 'context'});
    });
    extra = extra.concat(tokens(ctx.theme), tokens(ctx.title), tokens(ctx.related));
    if(ctx.theme && !place) place = ctx.theme;
    return buildState({
      id: id,
      url: url,
      cap: cap,
      dir: dbg.bg || '',
      card: card,
      place: place,
      objects: objects,
      safes: safes,
      extra: extra,
      theme: ctx.theme,
      title: ctx.title,
      related: ctx.related
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
    if(packMeta[mid] && !packMeta[mid].pending){ applyPackMeta(mid); return; }
    if(packMeta[mid] && packMeta[mid].pending) return;
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

  function rememberShown(id){
    if(!id) return;
    recentIds.push(String(id));
    if(recentIds.length > NO_REPEAT) recentIds.splice(0, recentIds.length - NO_REPEAT);
  }
  // Fresh pick for this bubble: never reuse lastPick.
  function nextShown(reason){
    rememberCutMeta();
    var state = liveState();
    var res = chooseOne(tweets, state, {recent: recentIds, cursor: rotateCursor, k: TOP_K});
    if(res.fallback === 'rotate') rotateCursor = res.cursor;
    if(res.choice){
      lastPick = res.choice;
      lastSig = state.signature;
      rememberShown(res.choice.id);
    }
    return {choice: res.choice, state: state, res: res, reason: reason || 'bubble'};
  }
  function evaluate(reason){
    if(!tweets.length) return null;
    var shown = nextShown(reason || 'tick');
    var state = shown.state;
    var res = shown.res;
    var top = shown.choice;
    var pool = (res.pool && res.pool.length) ? res.pool : (res.matched || []).slice(0, TOP_K);
    var row = {
      at: new Date().toISOString(),
      reason: reason || 'tick',
      changed: !!(top && true),
      fallback: false,
      matched_terms: (top && top.hits) || res.terms || [],
      populated: {
        labels: state.objects.some(function(o){ return !!(o.label && !/^cut\d+$/.test(o.label)); }),
        klasses: state.objects.some(function(o){ return !!o.klass; }),
        positions: state.objects.some(function(o){ return o.x != null && o.y != null; }),
        safes: !!(state.safes && state.safes.length),
        place: !!(state.frame && state.frame.place),
        card: !!state.card
      },
      scene: {
        id: state.frame.id,
        cap: state.frame.cap,
        card: state.card,
        place: state.frame.place,
        objects: state.objects.map(function(o){ return {id: o.id, label: o.label, klass: o.klass, colors: o.colors, size: o.size, x: o.x, y: o.y, zone: o.zone, dragged: o.dragged}; }),
        theme: state.frame && state.frame.place,
        tokens: state.tokens.slice(0, 24),
        signature: state.signature
      },
      picked: (top ? [top] : []).concat(pool.filter(function(r){ return !top || r.id !== top.id; })).slice(0, TOP_K).map(function(r){ return {id: r.id, score: r.score, hits: (r.hits || []).slice(0, 8), line: String(r.line || '').slice(0, 80)}; })
    };
    record(row);
    if(top){
      try{ showPick(top); }catch(e){}
    }
    return row;
  }

  function hookMount(){
    if(!root.ThrydTweet || typeof root.ThrydTweet.mount !== 'function') return;
    if(root.ThrydTweet._feedHooked) return;
    rawMount = root.ThrydTweet.mount.bind(root.ThrydTweet);
    root.ThrydTweet.mount = function(host, item, baseMs){
      if(host && host.id === 'bubble' && tweets.length){
        var shown = nextShown('bubble');
        if(shown.choice && shown.choice.tweet) return rawMount(host, shown.choice.tweet, baseMs);
      }
      return rawMount(host, item, baseMs);
    };
    root.ThrydTweet._feedHooked = true;
  }

  function hookChoose(){
    if(typeof root.thrydChoose !== 'function' || root.thrydChoose._feedHooked) return;
    var prev = root.thrydChoose;
    root.thrydChoose = function(lines){
      if(tweets.length){
        var shown = nextShown('choose');
        if(shown.choice && shown.choice.tweet && shown.choice.score > 0) return shown.choice.tweet;
      }
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
      .then(function(r){ return r.ok ? r.json() : null; })
      .catch(function(){ return null; });
  }

  function ingestTweets(rows){
    tweets = (rows || []).map(function(p){
      return root.ThrydTweet && ThrydTweet.deckRow ? ThrydTweet.deckRow(p) : {line: p.line, src: p.src, move: !!p.move, id: p.id, purged: p.purged, card: p.card};
    }).filter(tweetOk);
    buildIdf(tweets);
  }

  function start(){
    if(started) return;
    started = true;
    feedObj();
    hookMount(); hookChoose(); hookDebug();
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerUp, true);
    Promise.all([
      loadJson('data/tweets_all.json'),
      loadJson('data/precisions.json'),
      loadJson('data/medium_cuts.json'),
      loadJson('data/state.json'),
      loadJson('data/scene_context.json'),
      loadJson('data/objects.json')
    ]).then(function(pair){
      ingestTweets(pair[0] || []);
      safesAll = Array.isArray(pair[1]) ? pair[1] : [];
      cutsManifest = pair[2] || {assets:[]};
      story = pair[3] && !Array.isArray(pair[3]) ? pair[3] : null;
      sceneContext = pair[4] && typeof pair[4] === 'object' ? pair[4] : null;
      objectsIndex = pair[5] && typeof pair[5] === 'object' ? pair[5] : null;
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
