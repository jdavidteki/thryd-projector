// Scene state feeds the tweet popups. The current GIF/frame, cut objects
// (labels and classes from data/medium_cuts.json and the packs), object
// positions or drags, and the safe lines already linked to the scene's card
// are scored against the existing tweet deck. A steady tick and every drag
// end re-evaluate so these functions keep firing. The 160x132 bubble still
// only ever shows the official embed (no names). Nothing is posted.
(function(root){
  var TICK_MS = 4000;            // quiet re-check interval
  var POP_HOLD_MS = TICK_MS + 3000; // a popped tweet now stays 7000 ms (was replaced by the next 4000 ms tick) before anything replaces it
  var FEED_DEBUG = false;
  try{ FEED_DEBUG = /(?:^|[?&])debug=1(?:&|$)/.test(String((typeof location!=='undefined'&&location.search)||'')); }catch(e){}
  function feedLog(){ if(!FEED_DEBUG) return; try{ console.info.apply(console, ['[thryd-feed]'].concat([].slice.call(arguments))); }catch(e){} }

  var TOP_N = 8;
  var TOP_K = 8;
  var NO_REPEAT = 10;    // a page visit never repeats a tweet; only after a scene's whole genuine pool was shown may one come back, and never one of the last 10
  var POOL_K = 24;       // random, weighted pick among up to 24 genuine matches (not the top-1)
  var ELIG_CAP = 6;      // a tweet that is a genuine match in more than 6 different scenes of one visit is a generic matcher and leaves the pool
  var SCENE_DF_MAX = 0.08; // a scene term found in more than 8% of known scenes can raise a match but never make one on its own
  var SCENE_DF_FULL = 0.01; // terms in at most 1% of scenes count in full; between, they count less (IDF over scenes)
  var MIN_SCORE = 6;     // a genuine match needs at least this much object/attribute/theme overlap
  var FALLBACK_MIN = 40; // the live local matcher (scenes with no archive row) pops only on a strong overlap; quiet otherwise
  // Scene document frequency: how many known scenes carry each term (scene_context.json rows
  // plus every scene seen during the visit). Built at runtime; empty means no down-weighting.
  var sceneDf = Object.create(null), sceneDfN = 0, sceneDfSeen = Object.create(null);
  function addSceneTerms(key, terms){
    if(!key || sceneDfSeen[key]) return false;
    sceneDfSeen[key] = 1; sceneDfN++;
    var seen = Object.create(null);
    (terms || []).forEach(function(w){ [w, stem(w)].forEach(function(k){ if(k && !seen[k]){ seen[k] = 1; sceneDf[k] = (sceneDf[k] || 0) + 1; } }); });
    return true;
  }
  function resetSceneDf(){ sceneDf = Object.create(null); sceneDfN = 0; sceneDfSeen = Object.create(null); }
  // 1 for a rare scene term, 0 for one in more than SCENE_DF_MAX of scenes, log-scaled between.
  function sceneFactor(w){
    if(sceneDfN < 20) return 1;
    var df = Math.max(sceneDf[w] || 0, sceneDf[stem(w)] || 0);
    if(!df) return 1;
    var r = df / sceneDfN;
    if(r > SCENE_DF_MAX) return 0;
    if(r <= SCENE_DF_FULL) return 1;
    return Math.log(SCENE_DF_MAX / r) / Math.log(SCENE_DF_MAX / SCENE_DF_FULL);
  }
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
  // Terms that never make a match on their own: frame zones, motion and size words, and the
  // generic person family (almost every frame has a person). They can add to a real match's score.
  var WEAK = {
    left:1, right:1, center:1, centre:1, top:1, middle:1, bottom:1, moving:1, motion:1,
    large:1, small:1, medium:1, tiny:1, big:1, huge:1,
    person:1, people:1, crowd:1, someone:1, body:1, figure:1, foreground:1, object:1,
    man:1, men:1, woman:1, women:1, guest:1, friend:1, stranger:1, guy:1,
    want:1, know:1, think:1, said:1, come:1, take:1, need:1, look:1, thing:1, things:1, time:1, good:1, really:1
  };
  function weakTerm(w){ return !!(WEAK[w] || WEAK[stem(w)]); }
  function isDirect(q, w){ var d = q && q.__direct; return !!(d && (d[w] || d[stem(w)])); }

  function words(s){
    if(!s) return [];
    return String(s).toLowerCase().replace(/[#@\[\]]/g, ' ').match(/[a-z0-9']{3,}/g) || [];
  }
  var TOKC = Object.create(null), TOKN = 0;
  function tokens(s){
    if(typeof s !== 'string') return tokens0(s);
    var r = TOKC[s]; if(r) return r.slice();
    if(++TOKN > 20000){ TOKC = Object.create(null); TOKN = 1; }
    r = TOKC[s] = tokens0(s); return r.slice();
  }
  function tokens0(s){
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
  // memoised (11-13, stage smoothness): the feed re-scores the same words thousands of times per focus change; a profile showed
  // stem/tokens as the main cause of ~1 s main-thread stalls. Pure functions, so results are identical.
  var STEMC = Object.create(null), STEMN = 0;
  function stem(w){
    var k = String(w || ''), r = STEMC[k]; if(r !== undefined) return r;
    if(++STEMN > 60000){ STEMC = Object.create(null); STEMN = 1; }
    return (STEMC[k] = stem0(k));
  }
  function stem0(w){
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
    var shared = input.shared || {};
    var safes = (input.safes || []).map(function(s){
      return {line: s.line || s, card: s.card || frame.card || '', src: s.src || 'safe'};
    }).concat((shared.safes || []).map(function(s){
      return {line: s.line || s, card: s.card || frame.card || '', src: s.src || 'shared', shared: true};
    })).filter(function(s){ return s.line; });
    var bag = Object.create(null);
    addTok(bag, [frame.card, input.placeShared ? '' : frame.place, frame.cap, input.theme, input.title], 2);
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
    // this scene's own terms (frame, objects, theme, title, related); used for the scene-frequency table
    var own = Object.keys(bag).filter(function(k){ return !/^(?:left|right|center|centre|top|middle|bottom|moving|motion)$/.test(k); });
    var ownSet = Object.create(null);
    Object.keys(bag).forEach(function(k){ expand(k).forEach(function(ex){ if(ex.note !== 'related') ownSet[ex.term] = 1; }); });
    // agenda-wide words (story place, cast names): identical on every scene, so they rank but never make a match
    var sharedTerms = [].concat(shared.terms || [], input.placeShared && frame.place ? [frame.place] : []);
    if(sharedTerms.length) addTok(bag, sharedTerms, 2);
    var sharedOnly = Object.create(null);
    Object.keys(bag).forEach(function(k){ expand(k).forEach(function(ex){ if(ex.note !== 'related' && !ownSet[ex.term]) sharedOnly[ex.term] = 1; }); });
    // words that only come from the card's safe lines (not the frame, its objects or its theme)
    var sceneTerms = Object.create(null);
    Object.keys(bag).forEach(function(k){ expand(k).forEach(function(ex){ if(ex.note !== 'related') sceneTerms[ex.term] = 1; }); });
    safes.forEach(function(s){ addTok(bag, s.line, 1.2); });
    var lineOnly = Object.create(null);
    Object.keys(bag).forEach(function(k){ expand(k).forEach(function(ex){ if(ex.note !== 'related' && !sceneTerms[ex.term]) lineOnly[ex.term] = 1; }); });
    var tokList = Object.keys(bag);
    var sig = [frame.id || frame.dir || frame.cap || '', frame.card || '', frame.place || '']
      .concat(objects.map(function(o){ return [o.id, o.klass, o.zone, o.dragged ? 'd' : 's', Math.round(o.x/10), Math.round(o.y/10)].join(':'); }))
      .concat(safes.map(function(s){ return 'safe:' + String(s.line).slice(0, 40); }))
      .join('|');
    return {frame: frame, objects: objects, safes: safes, card: frame.card || '', tokens: tokList, weights: bag, lineOnly: lineOnly, sharedOnly: sharedOnly, own: own, signature: sig};
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
    var direct = Object.create(null); // the scene's own terms (exact or stem), not related-map neighbours
    Object.defineProperty(q, '__direct', {value: direct, enumerable: false});
    function put(term, weight, src){
      if(!term) return;
      tokens(term).forEach(function(w){
        expand(w).forEach(function(ex){
          var factor = ex.note === 'exact' ? 1 : (ex.note === 'stem' ? 0.8 : 0.55);
          var wt = (weight || 1) * factor;
          if(!q[ex.term] || q[ex.term].weight < wt) q[ex.term] = {weight: wt, src: src || 'scene', how: ex.note};
          if(ex.note !== 'related') direct[ex.term] = 1;
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
    var i, w, s = 0, hits = [], seen = Object.create(null), content = 0, terms = [], seenT = Object.create(null);
    for(i = 0; i < tw.length; i++){
      w = tw[i];
      var hit = lookupQuery(state.query, w);
      if(!hit) continue;
      var add = hit.weight * idfOf(w);
      s += add;
      if(!seen[w]){ seen[w] = 1; hits.push(w); }
      // genuine overlap: the tweet uses one of the scene's own object, attribute or theme terms
      // (exact or stem). Related-map neighbours, prefix partials and zone/motion/size/person-family
      // words can raise a real match's rank but never make a match on their own.
      var lo = state.lineOnly || {};
      var fromLines = !!(lo[w] || (lo[stem(w)] && !(state.weights && state.weights[w] && !lo[w])));
      var so = state.sharedOnly || {};
      var fromShared = !!(so[w] || (so[stem(w)] && !so[w] && !(state.weights && state.weights[w] && !so[w])));
      // words found only in the card's lines count through the 2+ shared-words line check below, never alone;
      // agenda-wide words count nowhere toward a match, and words common to many scenes count less (or not at all)
      var sf = sceneFactor(w);
      if(hit.how !== 'partial' && hit.how !== 'related' && isDirect(state.query, w) && !weakTerm(w) && !fromLines && !fromShared && sf > 0){
        content += add * sf;
        if(!seenT[w]){ seenT[w] = 1; terms.push(w); }
      }
    }
    if(tweet.card && state.card && String(tweet.card) === String(state.card)) s += 5;
    if(state.safes && state.safes.length){
      var safeScore = 0, ownSafe = 0, twS = Object.create(null); for(i = 0; i < tw.length; i++) twS[tw[i]] = 1;
      state.safes.forEach(function(safe){
        var st = tokens(safe.line).filter(function(x){ return x.length >= 5; });
        var n = 0, k;
        for(k = 0; k < st.length; k++){ if(twS[st[k]] || twS[stem(st[k])]) n++; }
        if(n >= 2){ safeScore += 2 * n; if(!safe.shared) ownSafe += 2 * n; if(!seen['safe']){ seen['safe'] = 1; hits.push('safe:' + n); } }
      });
      if(safeScore > 8) safeScore = 8;
      s += safeScore;
      // 2+ distinctive words shared with one of the card's lines is a real theme match
      // (only this scene's own lines: the agenda's card lines are the same on every scene)
      if(ownSafe > 8) ownSafe = 8;
      if(ownSafe > 0){ content += Math.max(ownSafe, MIN_SCORE); terms.push('safe'); }
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
    return {score: Math.round(s * 100) / 100, hits: hits, content: Math.round(content * 100) / 100, terms: terms};
  }

  function rowOf(t, r){
    return {id: String(t.id), score: r.score, content: r.content || 0, terms: r.terms || [], hits: r.hits, line: t.line, src: t.src, purged: !!t.purged, card: t.card || null, tweet: t};
  }
  // A genuine scene match: real object/attribute/theme overlap with a sensible minimum score.
  function qualifies(r, minScore){
    var min = minScore == null ? MIN_SCORE : minScore;
    return !!(r && r.terms && r.terms.length && r.content >= min && r.score >= min);
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
  // No quota and no widening: only genuine matches qualify, anything among the last 3 popped
  // is skipped, and when nothing is left the feed stays quiet (choice null) for this tick.
  // Long-term memory: every popped id with the time it popped, kept in localStorage across visits.
  // A tweet can only pop again 30 days after it last popped; the store keeps the newest 3000 ids.
  var COOLDOWN_MS = 30 * 24 * 3600 * 1000;
  var STORE_KEY = 'thryd.feed.shown.v1';
  var STORE_MAX = 3000;
  var OLDEST_K = 5; // past cooldown: random among the 5 shown longest ago
  function loadStore(){
    try{
      var ls = root.localStorage; if(!ls) return {};
      var o = JSON.parse(ls.getItem(STORE_KEY) || '{}');
      var out = Object.create(null);
      if(o && typeof o === 'object') Object.keys(o).forEach(function(k){ var t = +o[k]; if(/^\d{1,22}$/.test(k) && isFinite(t) && t > 0) out[k] = t; });
      return out;
    }catch(e){ return {}; }
  }
  function capStore(m){
    var ids = Object.keys(m);
    if(ids.length <= STORE_MAX) return m;
    ids.sort(function(a, b){ return m[a] - m[b]; });
    ids.slice(0, ids.length - STORE_MAX).forEach(function(k){ delete m[k]; });
    return m;
  }
  function saveStore(m){
    try{ var ls = root.localStorage; if(!ls) return false; capStore(m); ls.setItem(STORE_KEY, JSON.stringify(m)); return true; }catch(e){ return false; }
  }
  // One page visit, seeded with the long-term store: id -> last time it popped.
  function newSession(opts){
    opts = opts || {};
    var shown = Object.create(null), st = opts.store || {};
    Object.keys(st).forEach(function(k){ shown[k] = +st[k]; });
    return {shown: shown, order: [], elig: Object.create(null), eligScenes: Object.create(null), resets: 0,
      now: typeof opts.now === 'function' ? opts.now : function(){ return Date.now(); }, persist: !!opts.persist};
  }
  function markShown(sess, id){
    if(!sess || id == null) return;
    id = String(id);
    sess.shown[id] = sess.now(); sess.order.push(id);
    if(sess.order.length > 400) sess.order.splice(0, sess.order.length - 400);
    capStore(sess.shown);
    if(sess.persist) saveStore(sess.shown);
  }
  // From a scene's genuine matches: random among never-shown first; then only those past the
  // 30-day cooldown, the ones shown longest ago; if every match is still cooling down, quiet.
  function freshPool(items, sess, recent){
    var last = (sess ? sess.order : []).slice(-NO_REPEAT).concat(recent || []);
    var notLast = (items || []).filter(function(r){ return last.indexOf(String(r.id)) < 0; });
    if(!sess) return {pool: notLast, reset: false};
    var unseen = notLast.filter(function(r){ return !sess.shown[String(r.id)]; });
    if(unseen.length) return {pool: unseen, reset: false};
    var now = sess.now();
    var cooled = notLast.filter(function(r){ return now - sess.shown[String(r.id)] >= COOLDOWN_MS; });
    cooled.sort(function(a, b){ return sess.shown[String(a.id)] - sess.shown[String(b.id)]; });
    return {pool: cooled.slice(0, OLDEST_K), reset: cooled.length > 0};
  }
  function chooseOne(list, state, opts){
    opts = opts || {};
    var sess = opts.session || null;
    var recent = (opts.recent || []).map(String).slice(-NO_REPEAT);
    var k = opts.k || (sess ? POOL_K : TOP_K);
    var rng = opts.rng || Math.random;
    var ranked = opts.ranked || rankTweets(list, state);
    var excl = opts.exclude || null;
    var genuine = ranked.matched.filter(function(r){ return qualifies(r, opts.minScore) && !(excl && excl[String(r.id)]); });
    if(sess){
      // a tweet that matches scene after scene is a generic matcher: after ELIG_CAP scenes it leaves the pool
      var key = (state && state.frame && (state.frame.id || state.frame.cap)) || (state && state.signature) || '';
      genuine.forEach(function(r){
        var m = sess.eligScenes[r.id] || (sess.eligScenes[r.id] = Object.create(null));
        if(!m[key]){ m[key] = 1; sess.elig[r.id] = (sess.elig[r.id] || 0) + 1; }
      });
      genuine = genuine.filter(function(r){ return sess.elig[r.id] <= ELIG_CAP; });
      genuine = genuine.slice().sort(function(a, b){ return (b.content || 0) - (a.content || 0); });
      var fp = freshPool(genuine, sess, recent);
      var spool = fp.pool.slice(0, k);
      if(!spool.length) return {choice: null, quiet: true, cooling: genuine.length > 0, pool: [], genuine: genuine.length, matched: ranked.matched, fallback: false, cursor: 0, terms: []};
      if(fp.reset) sess.resets++;
      // weighted random (not the top-1): sqrt of the match strength, split by how widely the tweet matches
      var wts = spool.map(function(r){ return {r: r, score: Math.sqrt(Math.max(r.content || 0, 1)) / Math.sqrt(sess.elig[r.id] || 1)}; });
      var got = weightedPick(wts, rng);
      var ch = got && got.r;
      return {choice: ch, quiet: false, pool: spool, genuine: genuine.length, matched: ranked.matched, fallback: false, reset: fp.reset, cursor: 0, terms: (ch && (ch.terms && ch.terms.length ? ch.terms : ch.hits)) || []};
    }
    var pool = notRecent(genuine, recent).slice(0, k);
    if(!pool.length) return {choice: null, quiet: true, pool: [], genuine: genuine.length, matched: ranked.matched, fallback: false, cursor: opts.cursor || 0, terms: []};
    var chosen = weightedPick(pool, rng);
    return {choice: chosen, quiet: false, pool: pool, genuine: genuine.length, matched: ranked.matched, fallback: false, cursor: opts.cursor || 0, terms: (chosen && (chosen.terms && chosen.terms.length ? chosen.terms : chosen.hits)) || []};
  }

  // Archive hits for a scene (data/scene_tweets.json, built on the box by searching the account
  // with 2-4 of the frame's keywords). Random among the scene's ids, never one shown this visit.
  function chooseArchive(ids, sess, rng, recent){
    rng = rng || Math.random;
    var items = (ids || []).map(function(id){ return {id: String(id)}; }).filter(function(r){ return /^\d{1,22}$/.test(r.id); });
    if(!items.length) return {choice: null, quiet: true, pool: [], archive: true};
    var fp = freshPool(items, sess, recent);
    if(!fp.pool.length) return {choice: null, quiet: true, pool: [], archive: true};
    if(fp.reset && sess) sess.resets++;
    var r = fp.pool[Math.floor(rng() * fp.pool.length)] || fp.pool[0];
    var choice = {id: r.id, score: 1, content: 1, terms: ['archive'], hits: ['archive'], line: '', src: 'archive', tweet: {id: r.id, line: '', src: 'archive', move: false}};
    return {choice: choice, quiet: false, pool: fp.pool, archive: true, reset: fp.reset, genuine: items.length, matched: [], terms: ['archive']};
  }

  // Quiet is the normal state. An archive scene carries p (0..1): how strongly its keywords match
  // its tweets (rare, scene-specific words found in the tweet text). Each tick pops with chance p;
  // strong scenes (p = 1) always pop, weak ones (p = 0) stay quiet. Rows without p keep the old behaviour.
  function archiveGate(row, rng){
    if(!row || typeof row.p !== 'number' || !isFinite(row.p)) return true;
    var p = Math.max(0, Math.min(1, row.p));
    if(p >= 1) return true;
    if(p <= 0) return false;
    return (rng || Math.random)() < p;
  }
  function chooseScene(row, list, state, opts){
    opts = opts || {};
    if(row){
      if(!archiveGate(row, opts.rng)) return {choice: null, quiet: true, gated: true, pool: [], archive: true, p: row.p};
      return chooseArchive(row.ids || [], opts.session, opts.rng, opts.recent);
    }
    return chooseOne(list, state, {session: opts.session, recent: opts.recent, cursor: opts.cursor, rng: opts.rng,
      minScore: opts.minScore == null ? FALLBACK_MIN : opts.minScore, exclude: opts.exclude, ranked: opts.ranked});
  }

  var api = {TICK_MS: TICK_MS, POP_HOLD_MS: POP_HOLD_MS, TOP_N: TOP_N, TOP_K: TOP_K, NO_REPEAT: NO_REPEAT, MIN_SCORE: MIN_SCORE, BUBBLE_W: BUBBLE_W, BUBBLE_H: BUBBLE_H, tokens: tokens, stem: stem, expand: expand, score: score, pick: pick, rankTweets: rankTweets, weightedPick: weightedPick, chooseOne: chooseOne, qualifies: qualifies, weakTerm: weakTerm, buildState: buildState, buildIdf: buildIdf, tweetOk: tweetOk, zoneOf: zoneOf, POOL_K: POOL_K, ELIG_CAP: ELIG_CAP, SCENE_DF_MAX: SCENE_DF_MAX, newSession: newSession, markShown: markShown, loadStore: loadStore, saveStore: saveStore, COOLDOWN_MS: COOLDOWN_MS, STORE_KEY: STORE_KEY, STORE_MAX: STORE_MAX, chooseArchive: chooseArchive, archiveGate: archiveGate, chooseScene: chooseScene, FALLBACK_MIN: FALLBACK_MIN, addSceneTerms: addSceneTerms, resetSceneDf: resetSceneDf, sceneFactor: sceneFactor};
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
  var session = newSession({store: loadStore(), persist: true}); // this visit + every earlier visit on this device (30-day cooldown)
  var sceneTweets = null;     // data/scene_tweets.json: medium id -> {ids:[...], p} from the archive search
  var fallbackBroad = null;   // local-deck ids that match more than 5% of scenes: never popped by the local matcher
  var shownAt = 0;          // when the current popup was mounted
  var pendingChoice = null; // a pick handed to the projector's say(); mounted as-is
  var nextTimer = null;
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
    try{ feedLog(row.reason, row.changed, row.picked && row.picked[0] && row.picked[0].id, row.scene && row.scene.signature); }catch(e){}
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

  function mcutMid(){ var l = document.getElementById('mcut'); return (l && l._mid) || ''; }
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
    var key = midKey(mid);
    if(!mid || !key) return;
    var meta = packMeta[key] || packMeta[mid];
    if(meta && meta.sidecarTried) return;
    packMeta[key] = meta || {labels:[], klasses:[]};
    packMeta[mid] = packMeta[key];
    packMeta[key].sidecarTried = true;
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
    // ?stage=1 (assets/stage.js): the story group in focus on the shared stage stands in for the single scene
    var SF = null;
    try{ if(typeof root.thrydStageFocus === 'function') SF = root.thrydStageFocus() || {id: '', title: '', objects: []}; }catch(e){ SF = null; }
    var cap = SF ? (SF.title || '') : ((dbg.cap) || ((document.getElementById('cap') || {}).textContent || ''));
    var url = SF ? '' : (dbg.url || '');
    var id = SF ? (SF.id || '') : (gifFrom(url) || gifFrom(cap) || gifFrom(dbg.bg || '') || mcutMid());
    var card = metaCard();
    var place = '';
    var world = (document.getElementById('world') || {}).textContent || '';
    if(world && !/^from /i.test(world) && world !== '—' && !/\d{1,2}:\d{2}\s*(am|pm)/i.test(world) && !/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(world)) place = world;
    var sharedNames = readChars();
    var extra = [];
    if(story && story.current_card && !card) card = String(story.current_card).toLowerCase();
    if(story && story.current_place && !place) place = story.current_place;
    var placeFromCtx = false;
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
    var objects = SF ? (SF.objects || []).slice() : readCuts();
    fetchSidecars(id);
    var ctx = mergeContext(objects, id);
    var ownSafes = [];
    (ctx.lines || []).forEach(function(l){
      var line = typeof l === 'string' ? l : (l && l.line);
      if(line) ownSafes.push({line: line, card: (l && l.card) || card, src: 'context'});
    });
    extra = extra.concat(tokens(ctx.theme), tokens(ctx.title), tokens(ctx.related));
    if(ctx.theme && !place){ place = ctx.theme; placeFromCtx = true; }
    return buildState({
      id: id,
      url: url,
      cap: cap,
      dir: dbg.bg || '',
      card: card,
      place: place,
      objects: objects,
      safes: ownSafes,
      // the agenda's card lines, place and cast are the same on every scene: they rank, never make a match
      shared: {terms: sharedNames, safes: safes},
      placeShared: !placeFromCtx,
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
    var mid = gifFrom(dbg.url || '') || gifFrom(dbg.cap || '') || gifFrom((document.getElementById('cap') || {}).textContent || '') || mcutMid();
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
    var SB = null;
    try{ if(typeof root.thrydStageBubble === 'function') SB = root.thrydStageBubble(); }catch(e){ SB = null; }
    if(SB) who = null;
    var r = SB ? SB : (who ? who.getBoundingClientRect() : {left: 12, right: 12, top: 80, height: 20});
    var right = SB ? !!SB.r : (who && who.classList.contains('r'));
    var M = 12, BW = BUBBLE_W, BH = BUBBLE_H;
    if(b.querySelector('.who')) b.querySelector('.who').textContent = '';
    if(b.querySelector('.txt')) b.querySelector('.txt').textContent = '';
    b.classList.toggle('r', !!right);
    var x = right ? r.left - 6 : r.right + 6;
    x = right ? Math.max(BW + M, Math.min(innerWidth - M, x)) : Math.max(M, Math.min(innerWidth - BW - M, x));
    // keep the box out of the scene's center half when we have no speaker
    if(!who && !SB) x = M;
    b.style.left = x + 'px';
    b.style.top = Math.min(innerHeight - BH / 2 - M, Math.max(BH / 2 + M, (r.top + r.height / 2) || (innerHeight * 0.25))) + 'px';
    var item = choice.tweet || {id: choice.id, line: choice.line, src: choice.src, purged: choice.purged};
    shownAt = Date.now();
    rawMount(b, item, baseMs == null ? 8000 : baseMs); // was 5000; +3000 (nominal: the embed's own timer and POP_HOLD_MS set the stay)
  }
  // While a popup is up and younger than POP_HOLD_MS, nothing replaces it.
  function holdLeft(){
    var b = document.getElementById('bubble');
    if(!b || !shownAt) return 0;
    var up = b.classList.contains('on') || b.classList.contains('embed-wait');
    if(!up) return 0;
    var left = shownAt + POP_HOLD_MS - Date.now();
    return left > 0 ? left : 0;
  }

  function rememberShown(id){
    if(!id) return;
    markShown(session, id);
    recentIds.push(String(id));
    if(recentIds.length > NO_REPEAT) recentIds.splice(0, recentIds.length - NO_REPEAT);
  }
  // Fresh pick for this bubble: never reuse lastPick.
  function nextShown(reason){
    rememberCutMeta();
    var state = liveState();
    try{ if(state.frame && state.frame.id) addSceneTerms(state.frame.id, state.own); }catch(e){}
    var arch = sceneTweets && state.frame && state.frame.id ? rowForMid(sceneTweets, state.frame.id) : null;
    var res = chooseScene(arch, tweets, state, {session: session, recent: recentIds, cursor: rotateCursor, rng: Math.random, exclude: fallbackBroad});
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
    var held = holdLeft();
    if(held > 0){
      // the current tweet keeps its full stay; a drag re-checks the moment the stay ends
      if(reason === 'drag'){ clearTimeout(api._dragT); api._dragT = setTimeout(function(){ evaluate('drag-after-hold'); }, held + 30); }
      return record({at: new Date().toISOString(), reason: reason || 'tick', changed: false, quiet: false, held: true, hold_left_ms: held, picked: []});
    }
    var shown = nextShown(reason || 'tick');
    var state = shown.state;
    var res = shown.res;
    var top = shown.choice;
    var pool = (res.pool && res.pool.length) ? res.pool : (res.matched || []).slice(0, TOP_K);
    var row = {
      at: new Date().toISOString(),
      reason: reason || 'tick',
      changed: !!(top && true),
      quiet: !top,
      genuine: res.genuine || 0,
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
      picked: (top ? [top] : []).concat(pool.filter(function(r){ return !top || r.id !== top.id; })).slice(0, TOP_K).map(function(r){ return {id: r.id, score: r.score, content: r.content, terms: (r.terms || []).slice(0, 8), hits: (r.hits || []).slice(0, 8), line: String(r.line || '').slice(0, 80)}; })
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
      if(host && host.id === 'bubble'){
        // the scene feed owns the popup: a genuine match or nothing (no random deck fallback)
        var choice = (pendingChoice && Date.now() - pendingChoice.at < 2000) ? pendingChoice.choice : null; pendingChoice = null;
        if(!choice){
          if(holdLeft() > 0) return Promise.resolve({ok: false, reason: 'hold'});
          var shown = tweets.length ? nextShown('bubble') : null;
          choice = shown && shown.choice;
          if(shown) record({at: new Date().toISOString(), reason: 'bubble', changed: !!choice, quiet: !choice, picked: choice ? [{id: choice.id, score: choice.score, terms: choice.terms}] : []});
        }
        if(choice && choice.tweet){ shownAt = Date.now(); return rawMount(host, choice.tweet, baseMs); }
        return Promise.resolve({ok: false, reason: 'quiet'});
      }
      return rawMount(host, item, baseMs);
    };
    root.ThrydTweet._feedHooked = true;
  }

  function hookChoose(){
    if(typeof root.thrydChoose !== 'function' || root.thrydChoose._feedHooked) return;
    var prev = root.thrydChoose;
    root.thrydChoose = function(lines){
      // quiet unless the scene has a genuine, not-recent match; never the shuffled deck
      if(!tweets.length || holdLeft() > 0) return null;
      var shown = nextShown('choose');
      if(shown.choice && shown.choice.tweet){ pendingChoice = {choice: shown.choice, at: Date.now()}; return shown.choice.tweet; }
      return null;
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

  var jsonMemo = Object.create(null);
  var jsonMiss = Object.create(null);
  function loadJson(path){
    var key = String(path || '').split('?')[0];
    if(!key) return Promise.resolve(null);
    if(jsonMiss[key]) return Promise.resolve(null);
    if(jsonMemo[key]) return jsonMemo[key];
    jsonMemo[key] = fetch(key, {cache: 'default'})
      .then(function(r){
        if(!r.ok){ jsonMiss[key] = 1; return null; }
        return r.json();
      })
      .catch(function(){ jsonMiss[key] = 1; return null; });
    return jsonMemo[key];
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
      loadJson('data/objects.json'),
      loadJson('data/scene_tweets.json')
    ]).then(function(pair){
      ingestTweets(pair[0] || []);
      safesAll = Array.isArray(pair[1]) ? pair[1] : [];
      cutsManifest = pair[2] || {assets:[]};
      story = pair[3] && !Array.isArray(pair[3]) ? pair[3] : null;
      sceneContext = pair[4] && typeof pair[4] === 'object' ? pair[4] : null;
      objectsIndex = pair[5] && typeof pair[5] === 'object' ? pair[5] : null;
      sceneTweets = pair[6] && pair[6].scenes && typeof pair[6].scenes === 'object' ? pair[6].scenes : null;
      fallbackBroad = null;
      if(pair[6] && Array.isArray(pair[6].fallback_broad)){ fallbackBroad = Object.create(null); pair[6].fallback_broad.forEach(function(id){ fallbackBroad[String(id)] = 1; }); }
      // scene frequency table from every scene_context row (more scenes join as the visit sees them)
      try{
        if(sceneContext) Object.keys(sceneContext).forEach(function(k){
          var row = sceneContext[k];
          if(!row || typeof row !== 'object' || !/\.(?:gif|webp|png)$/.test(k)) return;
          var st = buildState({objects: row.objects || [], theme: row.theme || '', title: row.title || '', related: row.related || []});
          addSceneTerms(k, st.own);
        });
      }catch(e){}
      hookMount(); hookChoose(); hookDebug();
      rememberCutMeta();
      evaluate('start');
    });
    // quiet ticks re-check every TICK_MS; after a pop the next check waits the full POP_HOLD_MS
    function loop(){
      var wait = TICK_MS;
      try{
        hookMount(); hookChoose(); hookDebug();
        rememberCutMeta();
        if(!document.body.classList.contains('dragmode')){
          var row = evaluate('tick');
          if(row && row.held) wait = Math.max(250, row.hold_left_ms + 30);
          else if(row && row.changed) wait = POP_HOLD_MS;
        }
      }catch(e){}
      timer = setTimeout(loop, wait);
    }
    timer = setTimeout(loop, TICK_MS);
  }

  api.evaluate = function(reason){ return evaluate(reason || 'api'); };
  api.liveState = liveState;
  api.start = start;
  api._setDeck = function(rows, safes){ ingestTweets(rows); if(safes) safesAll = safes; };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(typeof window !== 'undefined' ? window : globalThis);
