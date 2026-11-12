// #thryd phone prototype UI (loaded lazily by phone3310.js, phone.html only).
// A Nokia-3310-style phone for one cut-out character. Pure UI chrome: a 96x64
// 1-bit LCD drawn on a canvas, a keypad, and nothing generated in the scene.
// Rules kept here:
//  - no names: contacts are other cuts in the same scene, described generically;
//  - tweets only through the official X embed (Services/WAP), never as text;
//  - interactions go to localStorage 'thryd.phone.log.v1' only (no story bridge);
//  - sound follows the projector mute (only plays when thryd_mute is '0');
//  - the scene keeps running: the phone never touches cut timing or positions.
(function(root){
  'use strict';
  var FONT = {"A":[5,14,17,17,31,17,17,17,0],"B":[5,15,17,17,15,17,17,15,0],"C":[5,14,17,1,1,1,17,14,0],"D":[5,7,9,17,17,17,9,7,0],"E":[5,31,1,1,15,1,1,31,0],"F":[5,31,1,1,15,1,1,1,0],"G":[5,14,17,1,29,17,17,30,0],"H":[5,17,17,17,31,17,17,17,0],"I":[3,7,2,2,2,2,2,7,0],"J":[5,28,8,8,8,8,9,6,0],"K":[5,17,9,5,3,5,9,17,0],"L":[5,1,1,1,1,1,1,31,0],"M":[5,17,27,21,21,17,17,17,0],"N":[5,17,17,19,21,25,17,17,0],"O":[5,14,17,17,17,17,17,14,0],"P":[5,15,17,17,15,1,1,1,0],"Q":[5,14,17,17,17,21,9,22,0],"R":[5,15,17,17,15,5,9,17,0],"S":[5,30,1,1,14,16,16,15,0],"T":[5,31,4,4,4,4,4,4,0],"U":[5,17,17,17,17,17,17,14,0],"V":[5,17,17,17,17,17,10,4,0],"W":[5,17,17,17,21,21,21,10,0],"X":[5,17,17,10,4,10,17,17,0],"Y":[5,17,17,10,4,4,4,4,0],"Z":[5,31,16,8,4,2,1,31,0],"a":[4,0,0,6,8,14,9,14,0],"b":[4,1,1,7,9,9,9,7,0],"c":[4,0,0,14,1,1,1,14,0],"d":[4,8,8,14,9,9,9,14,0],"e":[4,0,0,6,9,15,1,14,0],"f":[4,12,2,7,2,2,2,2,0],"g":[4,0,0,14,9,9,14,8,6],"h":[4,1,1,7,9,9,9,9,0],"i":[2,2,0,3,2,2,2,3,0],"j":[3,4,0,6,4,4,4,4,3],"k":[4,1,1,9,5,3,5,9,0],"l":[3,3,2,2,2,2,2,7,0],"m":[5,0,0,11,21,21,21,21,0],"n":[4,0,0,7,9,9,9,9,0],"o":[4,0,0,6,9,9,9,6,0],"p":[4,0,0,7,9,9,7,1,1],"q":[4,0,0,14,9,9,14,8,8],"r":[4,0,0,13,3,1,1,1,0],"s":[4,0,0,14,1,6,8,7,0],"t":[4,2,2,7,2,2,2,12,0],"u":[4,0,0,9,9,9,9,14,0],"v":[4,0,0,9,9,9,6,6,0],"w":[5,0,0,17,21,21,21,10,0],"x":[4,0,0,9,6,6,6,9,0],"y":[4,0,0,9,9,9,14,8,6],"z":[4,0,0,15,4,2,1,15,0],"0":[5,14,17,25,21,19,17,14,0],"1":[3,2,3,2,2,2,2,7,0],"2":[5,14,17,16,8,4,2,31,0],"3":[5,15,16,16,14,16,16,15,0],"4":[5,8,12,10,9,31,8,8,0],"5":[5,31,1,15,16,16,17,14,0],"6":[5,14,1,1,15,17,17,14,0],"7":[5,31,16,8,4,2,2,2,0],"8":[5,14,17,17,14,17,17,14,0],"9":[5,14,17,17,30,16,16,14,0],"!":[1,1,1,1,1,1,0,1,0],"?":[5,14,17,16,8,4,0,4,0],".":[1,0,0,0,0,0,0,1,0],",":[2,0,0,0,0,0,2,2,1],":":[1,0,0,1,0,0,1,0,0],";":[2,0,0,2,0,0,2,2,1],"'":[1,1,1,0,0,0,0,0,0],"\"":[3,5,5,0,0,0,0,0,0],"-":[4,0,0,0,15,0,0,0,0],"+":[5,0,4,4,31,4,4,0,0],"=":[4,0,0,15,0,15,0,0,0],"/":[5,16,8,8,4,2,2,1,0],"(":[2,2,1,1,1,1,1,2,0],")":[2,1,2,2,2,2,2,1,0],"[":[2,3,1,1,1,1,1,3,0],"]":[2,3,2,2,2,2,2,3,0],"*":[5,0,21,14,31,14,21,0,0],"#":[5,10,10,31,10,31,10,10,0],"@":[5,14,17,29,21,29,1,14,0],"&":[5,6,9,5,2,21,9,22,0],"%":[5,19,19,8,4,2,25,25,0],"_":[4,0,0,0,0,0,0,0,15],"<":[4,8,4,2,1,2,4,8,0],">":[4,1,2,4,8,4,2,1,0],"~":[5,0,0,18,13,0,0,0,0],"|":[1,1,1,1,1,1,1,1,0],"$":[5,4,30,5,14,20,15,4,0],"^":[5,4,10,17,0,0,0,0,0]," ":[3,0,0,0,0,0,0,0,0]};
  var W = 96, H = 64, LH = 10;
  var LOG_KEY = 'thryd.phone.log.v1', LOG_MAX = 400;
  var SHOWN_KEY = 'thryd.feed.shown.v1', COOLDOWN_MS = 30 * 24 * 3600 * 1000;
  var doc = document;

  // ---------- small utils ----------
  function hash(s){ var h = 2166136261 >>> 0; for(var i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function rng(seed){ var a = seed >>> 0; return function(){ a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function pick(r, arr){ return arr[Math.floor(r() * arr.length) % arr.length]; }
  function cap(s){ s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function pad2(n){ return (n < 10 ? '0' : '') + n; }
  function clock(d){ d = d || new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  function ls(){ try{ return root.localStorage || null; }catch(e){ return null; } }
  function readJson(k, dflt){ try{ var s = ls(); var v = s && s.getItem(k); return v ? JSON.parse(v) : dflt; }catch(e){ return dflt; } }
  function writeJson(k, v){ try{ var s = ls(); if(s) s.setItem(k, JSON.stringify(v)); }catch(e){} }

  // ---------- interaction log (localStorage only) ----------
  function logRows(){ var a = readJson(LOG_KEY, []); return Array.isArray(a) ? a : []; }
  function log(ch, act, extra){
    var row = {at:new Date().toISOString(), scene:ch ? ch.scene : '', frame:ch ? ch.frame() : null, obj:ch ? ch.i : null, label:ch ? ch.label : '', act:act};
    if(extra) for(var k in extra) if(Object.prototype.hasOwnProperty.call(extra, k)) row[k] = extra[k];
    var a = logRows(); a.push(row); if(a.length > LOG_MAX) a = a.slice(-LOG_MAX);
    writeJson(LOG_KEY, a);
    return row;
  }
  function charLog(ch){ return logRows().filter(function(r){ return r.scene === ch.scene && r.obj === ch.i; }); }

  // ---------- sound (follows projector mute; muted unless thryd_mute === '0') ----------
  var actx = null;
  function soundOn(){ try{ var s = ls(); return !!(s && s.getItem('thryd_mute') === '0'); }catch(e){ return false; } }
  function tone(seq){
    if(!soundOn()) return;
    try{
      actx = actx || new (root.AudioContext || root.webkitAudioContext)();
      var t = actx.currentTime + 0.01;
      seq.forEach(function(n){
        if(n[0]){
          var o = actx.createOscillator(), g = actx.createGain();
          o.type = 'square'; o.frequency.value = n[0]; g.gain.value = 0.035;
          o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + n[1] / 1000);
        }
        t += (n[1] + (n[2] || 0)) / 1000;
      });
    }catch(e){}
  }
  function keyBeep(){ tone([[1760, 35]]); }
  function smsTone(){ var d = 70, D = 210, f = 1568; tone([[f,d,60],[f,d,60],[f,d,160],[f,D,60],[f,D,160],[f,d,60],[f,d,60],[f,d,0]]); } // ... -- ...
  function ringTone(){ tone([[1318,110,20],[1175,110,20],[740,220,20],[831,220,20],[1109,110,20],[988,110,20],[587,220,20],[659,220,20]]); }

  // ---------- LCD ----------
  function Lcd(canvas){
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d'), buf = new Uint8Array(W * H), img = ctx.createImageData(W, H);
    var me = {
      clear:function(){ buf.fill(0); },
      px:function(x, y, on){ x |= 0; y |= 0; if(x < 0 || y < 0 || x >= W || y >= H) return; buf[y * W + x] = on === false ? 0 : 1; },
      rect:function(x, y, w, h, on){ for(var j = 0; j < h; j++) for(var i = 0; i < w; i++) me.px(x + i, y + j, on); },
      frame:function(x, y, w, h){ me.rect(x, y, w, 1); me.rect(x, y + h - 1, w, 1); me.rect(x, y, 1, h); me.rect(x + w - 1, y, 1, h); },
      glyph:function(ch){ return FONT[ch] || FONT['?']; },
      width:function(s){ var w = 0; s = String(s); for(var i = 0; i < s.length; i++) w += me.glyph(s[i])[0] + 1; return w ? w - 1 : 0; },
      text:function(x, y, s, inv){
        s = String(s);
        for(var i = 0; i < s.length; i++){
          var g = me.glyph(s[i]), w = g[0];
          for(var r = 0; r < 8; r++){ var bits = g[r + 1]; for(var c = 0; c < w; c++) if(bits >> c & 1) me.px(x + c, y + r, !inv); }
          x += w + 1;
          if(x > W) break;
        }
        return x;
      },
      center:function(y, s, inv){ me.text(Math.max(0, (W - me.width(s)) >> 1), y, s, inv); },
      fit:function(s, maxW){ s = String(s); if(me.width(s) <= maxW) return s; while(s.length && me.width(s + '..') > maxW) s = s.slice(0, -1); return s + '..'; },
      wrap:function(s, maxW){
        var out = [], line = '';
        String(s).split(/\s+/).forEach(function(word){
          if(!word) return;
          var t = line ? line + ' ' + word : word;
          if(me.width(t) <= maxW){ line = t; return; }
          if(line) out.push(line);
          while(me.width(word) > maxW){ var k = word.length; while(k > 1 && me.width(word.slice(0, k)) > maxW) k--; out.push(word.slice(0, k)); word = word.slice(k); }
          line = word;
        });
        if(line) out.push(line);
        return out;
      },
      flush:function(){
        var d = img.data;
        for(var i = 0; i < buf.length; i++){ var o = i * 4; if(buf[i]){ d[o] = 22; d[o + 1] = 34; d[o + 2] = 14; d[o + 3] = 235; } else { d[o + 3] = 0; } }
        ctx.putImageData(img, 0, 0);
      }
    };
    return me;
  }
  // icons
  function signal(l, n){ for(var i = 0; i < 4; i++){ var h = 2 + i * 2; l.rect(1 + i * 3, 9 - h, 2, h, i < n); } }
  function battery(l, n){ l.frame(W - 13, 2, 11, 6); l.rect(W - 2, 4, 1, 2); for(var i = 0; i < 3; i++) if(i < n) l.rect(W - 11 + i * 3, 4, 2, 2); }
  function envelope(l, x, y){ l.frame(x, y, 9, 7); l.px(x + 1, y + 1); l.px(x + 2, y + 2); l.px(x + 3, y + 3); l.px(x + 4, y + 4); l.px(x + 5, y + 3); l.px(x + 6, y + 2); l.px(x + 7, y + 1); }
  function softkey(l, s){ l.center(H - 9, s); }

  // ---------- scene + character data ----------
  var sideCache = {}, tweetsP = null;
  function midKey(id){ return String(id || '').replace(/\*/g, '_'); }
  function loadJson(p){ return fetch(p, {cache:'no-store'}).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; }); }
  function sceneObjects(t){
    if(t.kind === 'objs'){
      var L = t.node.closest('#objs');
      var all = L ? [].slice.call(L.querySelectorAll('.ob:not(.dpatch)')) : [t.node];
      return Promise.resolve(all.map(function(b){ return {label:b.dataset.label || 'thing', klass:b.dataset.label || 'thing', node:b}; }));
    }
    var mid = t.scene;
    if(!sideCache[mid]){
      var mc = root.ThrydMediumCuts;
      var man = (mc && mc.loadManifest) ? mc.loadManifest().catch(function(){ return null; }) : Promise.resolve(null);
      sideCache[mid] = Promise.all([man, loadJson('assets/medium_cuts/' + midKey(mid) + '.objects.json')]).then(function(got){
        var row = got[0] && (got[0].assets || []).find(function(a){ return a && a.medium_image_id === mid; });
        var cuts = (row && row.objects) || [];
        var side = (got[1] && got[1].objects) || [];
        var n = Math.max(cuts.length, side.length);
        var out = [];
        for(var i = 0; i < n; i++){
          var c = cuts[i] || {}, s = side[i] || {};
          out.push({label:s.label || c.label || 'figure', klass:s.klass || c.model_class || s.label || c.label || 'figure', colors:s.colors || '', related:s.related || []});
        }
        return out;
      });
    }
    return sideCache[mid].then(function(list){
      var layer = doc.getElementById('mcut');
      return list.map(function(o, i){ var x = Object.assign({}, o); x.node = layer && layer._mid === mid ? layer.querySelector('canvas.sprite[data-i="' + i + '"]') : null; return x; });
    });
  }
  var NOUN_SKIP = {foreground:1, cut:1, object:1, thing:1, scene:1, front:1, stage:1, view:1, setting:1,
    man:1, woman:1, men:1, women:1, boy:1, girl:1, guy:1, lady:1, male:1, female:1, person:1, people:1}; // never gender anyone
  function nounFor(o, r){
    var k = String(o.klass || o.label || '').toLowerCase().replace(/[^a-z ]/g, '').trim();
    if(k === 'person'){
      // neutral words only: never skin, gender or anything identifying
      var rel = (o.related || []).filter(function(w){ return /^(guest|figure|stranger|friend|visitor|neighbour)$/.test(w); });
      return pick(r, rel.length ? rel : ['stranger', 'figure', 'guest']);
    }
    if(!k || NOUN_SKIP[k] || /^cut\d*$/.test(k)) return 'figure';
    return k.split(' ').slice(-1)[0];
  }
  var POS = ['far left', 'left', 'middle', 'right', 'far right'];
  function posOf(node){
    try{
      var layer = node && node.closest && node.closest('#mcut, #objs');
      if(!layer || !node.isConnected) return '';
      var plate = layer.querySelector('canvas.plate') || layer, b = plate.getBoundingClientRect(), r = node.getBoundingClientRect();
      if(!b.width) return '';
      var off = (layer._off && node.dataset && layer._off[+node.dataset.i]) || {x:0};
      var c = ((r.left + r.right) / 2 - (off.x || 0) - b.left) / b.width; // original spot, so dragging never renames anyone
      return POS[Math.max(0, Math.min(4, Math.floor(c * 5)))];
    }catch(e){ return ''; }
  }
  function describe(o, seed){
    var r = rng(seed), noun = nounFor(o, r), pos = posOf(o.node);
    var isPerson = String(o.klass || o.label || '').toLowerCase() === 'person';
    var col = isPerson ? '' : String(o.colors || '').split(/\s+/)[0];
    var base = cap(col && (col + ' ' + noun).length <= 11 ? col + ' ' + noun : noun);
    return pos ? base + ' (' + pos + ')' : base;
  }
  function sceneWords(objs){
    var w = [];
    objs.forEach(function(o){
      (o.related || []).forEach(function(x){ if(x && !NOUN_SKIP[x] && x.length < 11 && w.indexOf(x) < 0) w.push(x); });
      var k = String(o.klass || '').toLowerCase();
      if(k && !NOUN_SKIP[k] && k !== 'person' && k.length < 11 && w.indexOf(k) < 0) w.push(k);
    });
    return w.length ? w : ['light', 'crowd', 'noise', 'road'];
  }
  var SMS_T = [
    'where r u? the {w} is here', 'saw u near the {w}. call me', 'dont move. stay in frame',
    'who moved the {w}??', '{w} later? 8pm', 'u still in {c}?', 'battery low. txt me',
    'im right behind u', 'did u see the {w}?', 'tell them about the {w}', 'pls call. its about the {w}',
    'we are still looping', 'someone keeps dragging me', 'bring the {w} back', 'same place, same time',
    'ok. i saw everything', 'whos the {w} for?', 'ur not in this scene', 'pick up!!'
  ];
  var REPLIES = ['OK', 'On my way', 'Who is this?', 'Call me', 'Not now', 'Lol', 'Stay there'];
  var BACK = ['k', 'ok ok', '??', 'hurry', 'fine', 'u wish', 'dont be late', 'lol', 'stop moving me'];
  function fill(t, r, words, colors){ return t.replace(/\{w\}/g, function(){ return pick(r, words); }).replace(/\{c\}/g, function(){ return pick(r, colors.length ? colors : ['grey', 'black']); }); }

  function buildChar(t, objs){
    var key = t.scene + '|' + t.i + '|' + (t.label || (objs[t.i] && objs[t.i].label) || '');
    var seed = hash(key), r = rng(seed);
    var self = objs[t.i] || {label:t.label || 'figure'};
    var words = sceneWords(objs), colors = [];
    objs.forEach(function(o){ String(o.colors || '').split(/\s+/).forEach(function(c){ if(c && colors.indexOf(c) < 0) colors.push(c); }); });
    var names = {};
    var contacts = objs.map(function(o, i){
      var nm = describe(o, hash(t.scene + '|' + i));
      if(names[nm]){ names[nm]++; nm = nm + ' ' + names[nm]; } else names[nm] = 1;
      return {i:i, name:nm, node:o.node};
    });
    var me = contacts[t.i] || {name:describe(self, seed)};
    var others = contacts.filter(function(c){ return c.i !== t.i; });
    var senders = others.length ? others : [{i:-1, name:'Unknown no.'}, {i:-2, name:'Voicemail'}];
    if(others.length < 2) senders = senders.concat([{i:-1, name:'Unknown no.'}]);
    var now = Date.now(), inbox = [];
    var n = 3 + Math.floor(r() * 2);
    for(var k = 0; k < n; k++){
      var from = pick(r, senders);
      inbox.push({id:'m' + k, from:from.name, fromI:from.i, text:fill(pick(r, SMS_T), r, words, colors), at:now - (n - k) * (7 + Math.floor(r() * 50)) * 60000});
    }
    var calls = [];
    for(var c = 0; c < 4; c++){ var who = pick(r, senders); calls.push({type:pick(r, ['missed', 'received', 'dialled']), name:who.name, i:who.i, at:now - (c + 1) * (20 + Math.floor(r() * 90)) * 60000}); }
    return {
      scene:t.scene, i:t.i, kind:t.kind, label:self.label || t.label || '', seed:seed, node:t.node,
      frame:function(){ var l = doc.getElementById('mcut'); return t.kind === 'mcut' && l && l._mid === t.scene && typeof l._shown === 'number' ? l._shown : null; },
      owner:me.name, contacts:others, inbox:inbox, calls:calls, words:words, colors:colors,
      bars:1 + Math.floor(r() * 4), batt:1 + Math.floor(r() * 3), op:pick(r, ['thryd', 'THRYD NG', 'thryd net', 'LOOP GSM']),
      snakeBest:0
    };
  }
  function applyLog(ch){
    var rows = charLog(ch);
    ch.read = {};
    rows.forEach(function(r){
      if(r.act === 'read') ch.read[r.msg] = 1;
      if(r.act === 'reply') ch.inbox.push({id:'s' + r.at, from:'Me', out:true, to:r.to, text:r.text, at:Date.parse(r.at)});
      if(r.act === 'sms_in') ch.inbox.push({id:r.msg, from:r.from, fromI:r.fromI, text:r.text, at:Date.parse(r.at)});
      if(r.act === 'call') ch.calls.unshift({type:'dialled', name:r.to, i:r.toI, at:Date.parse(r.at)});
      if(r.act === 'snake' && r.score > ch.snakeBest) ch.snakeBest = r.score;
    });
    ch.inbox.sort(function(a, b){ return a.at - b.at; });
    ch.calls.sort(function(a, b){ return b.at - a.at; });
  }
  function unread(ch){ return ch.inbox.filter(function(m){ return !m.out && !ch.read[m.id] && m.id === ch.inbox.filter(function(x){ return !x.out; }).slice(-1)[0].id; }).length; }

  // ---------- tweets: official embed only ----------
  function sceneTweets(){ if(!tweetsP) tweetsP = loadJson('data/scene_tweets.json'); return tweetsP; }
  function shownStore(){ var o = readJson(SHOWN_KEY, {}); return (o && typeof o === 'object') ? o : {}; }
  function pickTweet(ch){
    return sceneTweets().then(function(j){
      var row = j && j.scenes && (j.scenes[ch.scene] || j.scenes[midKey(ch.scene)]);
      var ids = ((row && row.ids) || []).map(String).filter(function(id){ return /^\d{1,22}$/.test(id); });
      if(!ids.length) return {why:'none'};
      var st = shownStore(), now = Date.now();
      var fresh = ids.filter(function(id){ return !st[id] || now - st[id] >= COOLDOWN_MS; });
      if(!fresh.length) return {why:'cooling'};
      var start = ch.seed % fresh.length;
      var mine = fresh.filter(function(id){ return !st[id]; });
      return {id:(mine.length ? mine : fresh)[start % (mine.length || fresh.length)]};
    });
  }
  function markShown(id){ var st = shownStore(); st[id] = Date.now(); writeJson(SHOWN_KEY, st); }
  var widgetsP = null;
  // Reuse the projector's widgets.js when it is there; inject it only if nothing loads it.
  function widgets(){
    if(widgetsP) return widgetsP;
    widgetsP = new Promise(function(resolve){
      var t0 = Date.now(), injected = false;
      (function wait(){
        var tw = root.twttr;
        if(tw && tw.widgets && tw.widgets.createTweet) return resolve(tw);
        var waited = Date.now() - t0;
        if(!injected && waited > 1200 && !doc.getElementById('twitter-wjs')){
          injected = true;
          var s = doc.createElement('script');
          s.src = 'https://platform.twitter.com/widgets.js'; s.async = true; s.charset = 'utf-8';
          doc.head.appendChild(s);
        }
        if(waited > 12000) return resolve(null);
        setTimeout(wait, 100);
      })();
    });
    return widgetsP;
  }

  // ---------- phone DOM ----------
  var el = null, lcd = null, cur = null, stack = [], timers = [], tick = null, wap = null, hlNode = null, ringNodes = [];
  var KEYS = [['menu', 'Menu', 'navi'], ['c', 'C', 'c'], ['up', '\u25B2', 'arr up'], ['down', '\u25BC', 'arr dn']];
  var PAD = [['1', 'o_o'], ['2', 'abc'], ['3', 'def'], ['4', 'ghi'], ['5', 'jkl'], ['6', 'mno'], ['7', 'pqrs'], ['8', 'tuv'], ['9', 'wxyz'], ['*', '+'], ['0', '\u2423'], ['#', '\u21E7']];
  function build(){
    el = doc.createElement('div');
    el.id = 'p3310'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Character phone');
    var h = '<button class="p3310-x" type="button" aria-label="Close phone" data-k="close">\u00D7</button>' +
      '<div class="p3310-ear"></div><div class="p3310-brand">THRYD</div>' +
      '<div class="p3310-screen"><canvas aria-hidden="true"></canvas></div>' +
      '<div class="p3310-nav">';
    KEYS.forEach(function(k){ h += '<button type="button" class="p3310-k ' + k[2] + '" data-k="' + k[0] + '">' + k[1] + '</button>'; });
    h += '</div><div class="p3310-pad">';
    PAD.forEach(function(k){ h += '<button type="button" class="p3310-k num" data-k="' + k[0] + '"><b>' + k[0] + '</b><i>' + k[1] + '</i></button>'; });
    h += '</div>';
    el.innerHTML = h;
    lcd = Lcd(el.querySelector('canvas'));
    var stop = function(e){ e.stopPropagation(); };
    ['pointerdown', 'pointerup', 'click', 'dblclick', 'wheel', 'touchstart', 'touchend', 'mousedown', 'mouseup'].forEach(function(ev){ el.addEventListener(ev, stop); });
    var holdT = null;
    el.addEventListener('pointerdown', function(e){
      var b = e.target.closest('[data-k]'); if(!b) return;
      e.preventDefault();
      b.classList.add('down');
      if(b.dataset.k === 'c'){ clearTimeout(holdT); holdT = setTimeout(function(){ holdT = 'fired'; close('c_hold'); }, 700); }
    });
    el.addEventListener('pointerup', function(e){
      var b = e.target.closest('[data-k]');
      el.querySelectorAll('.down').forEach(function(n){ n.classList.remove('down'); });
      if(!b) return;
      if(b.dataset.k === 'c'){ if(holdT === 'fired'){ holdT = null; return; } clearTimeout(holdT); holdT = null; }
      press(b.dataset.k);
    });
    el.addEventListener('pointerleave', function(){ el.querySelectorAll('.down').forEach(function(n){ n.classList.remove('down'); }); if(holdT && holdT !== 'fired'){ clearTimeout(holdT); holdT = null; } });
    doc.body.appendChild(el);
  }
  function place(node){
    var vw = root.innerWidth, vh = root.innerHeight, pw = el.offsetWidth || 190, ph = el.offsetHeight || 420;
    var narrow = vw < 640;
    el.classList.toggle('narrow', narrow);
    if(narrow){ el.style.left = Math.max(4, (vw - pw) / 2) + 'px'; el.style.top = Math.max(4, vh - ph - 8) + 'px'; return; }
    var r = node && node.getBoundingClientRect ? node.getBoundingClientRect() : {left:vw / 2, right:vw / 2, top:vh / 2, height:0};
    var cx = (r.left + r.right) / 2;
    var x = cx < vw / 2 ? Math.min(vw - pw - 12, r.right + 24) : Math.max(12, r.left - pw - 24);
    x = Math.max(12, Math.min(vw - pw - 12, x));
    var y = Math.max(8, Math.min(vh - ph - 8, r.top + r.height / 2 - ph / 2));
    el.style.left = x + 'px'; el.style.top = y + 'px';
  }
  function buzz(){
    if(!el) return;
    el.classList.remove('buzz'); void el.offsetWidth; el.classList.add('buzz');
    try{ if(soundOn() && navigator.vibrate) navigator.vibrate([60, 40, 60]); }catch(e){}
    if(hlNode){ hlNode.classList.remove('p3310-ping'); void hlNode.offsetWidth; hlNode.classList.add('p3310-ping'); }
  }
  function later(fn, ms){ var t = setTimeout(function(){ timers = timers.filter(function(x){ return x !== t; }); fn(); }, ms); timers.push(t); return t; }
  function clearTimers(){ timers.forEach(clearTimeout); timers = []; if(tick){ clearInterval(tick); tick = null; } }
  function ring(node, on){
    if(!node) return;
    node.classList.toggle('p3310-ring', !!on);
    if(on) ringNodes.push(node); else ringNodes = ringNodes.filter(function(n){ return n !== node; });
  }

  // ---------- screens ----------
  function draw(){ if(!cur || !lcd) return; lcd.clear(); cur.draw(lcd); lcd.flush(); }
  function go(s){ if(cur && cur.leave) cur.leave(); stack.push(cur); cur = s; if(s.enter) s.enter(); draw(); }
  function back(){ if(cur && cur.leave) cur.leave(); cur = stack.pop() || null; if(!cur){ cur = Idle(); } if(cur.enter) cur.enter(); draw(); }
  function home(){ if(cur && cur.leave) cur.leave(); stack = []; cur = Idle(); cur.enter(); draw(); }
  function press(k){
    if(k === 'close'){ close('x'); return; }
    keyBeep();
    if(cur && cur.key && cur.key(k) !== false){ draw(); return; }
    if(k === 'c') back();
  }

  function List(title, items, soft){
    var s = {name:'list:' + title, sel:0, top:0, items:items};
    s.draw = function(l){
      l.center(0, l.fit(title, W - 2));
      l.rect(0, 9, W, 1);
      var vis = 4;
      if(s.sel < s.top) s.top = s.sel; if(s.sel >= s.top + vis) s.top = s.sel - vis + 1;
      for(var k = 0; k < vis; k++){
        var it = items[s.top + k]; if(!it) break;
        var y = 11 + k * LH, on = s.top + k === s.sel;
        if(on) l.rect(0, y - 1, W - 4, LH);
        l.text(2, y, l.fit(typeof it.text === 'function' ? it.text() : it.text, W - 8), on);
      }
      if(items.length > vis){ var sh = Math.max(4, Math.floor(40 * vis / items.length)), sy = 11 + Math.floor((40 - sh) * s.sel / Math.max(1, items.length - 1)); l.rect(W - 2, 11, 1, 40); l.rect(W - 3, sy, 3, sh); }
      if(!items.length) l.center(26, '(empty)');
      softkey(l, soft || 'Select');
    };
    s.key = function(k){
      if(k === 'up'){ s.sel = (s.sel - 1 + items.length) % Math.max(1, items.length); return; }
      if(k === 'down'){ s.sel = (s.sel + 1) % Math.max(1, items.length); return; }
      if(/^[1-9]$/.test(k) && items[+k - 1]){ s.sel = +k - 1; k = 'menu'; }
      if((k === 'menu' || k === 'right') && items[s.sel] && items[s.sel].go){ items[s.sel].go(); return; }
      return false;
    };
    return s;
  }
  function Note(lines, soft, after, ms){
    var s = {name:'note'};
    s.enter = function(){ if(ms) later(function(){ if(cur === s){ if(after) after(); else back(); } }, ms); };
    s.draw = function(l){ var y = Math.max(11, 30 - lines.length * 5); lines.forEach(function(t, k){ l.center(y + k * LH, l.fit(t, W)); }); if(soft) softkey(l, soft); };
    s.key = function(k){ if(k === 'menu' || k === 'c'){ if(after) after(); else back(); return; } };
    return s;
  }

  var ch = null;
  function Idle(){
    var s = {name:'idle'};
    s.enter = function(){ if(tick) clearInterval(tick); tick = setInterval(function(){ if(cur === s) draw(); }, 15000); };
    s.leave = function(){ if(tick){ clearInterval(tick); tick = null; } };
    s.draw = function(l){
      signal(l, ch.bars); battery(l, ch.batt);
      l.center(1, clock());
      l.center(14, ch.op);
      var u = unread(ch);
      if(u){ envelope(l, 4, 28); l.text(16, 28, '1 message'); l.text(16, 38, 'received'); softkey(l, 'Read'); }
      else { l.center(28, l.fit(ch.owner, W - 4)); l.center(38, l.fit(sceneTag(), W - 4)); softkey(l, 'Menu'); }
    };
    s.key = function(k){
      if(k === 'menu'){ if(unread(ch)) openInbox(true); else go(MainMenu()); return; }
      if(k === 'c'){ return; }
      if(k === 'up' || k === 'down'){ go(Contacts()); return; }
      if(/^[0-9#*]$/.test(k)){ go(Dial(k)); return; }
    };
    return s;
  }
  function sceneTag(){ var f = ch.frame(); return 'scene ' + (ch.scene ? ch.scene.replace(/^1\*/, '').slice(0, 5) : '?') + (f != null ? ' f' + f : ''); }
  function MainMenu(){
    return List('Menu', [
      {text:'1 Messages', go:function(){ go(MsgMenu()); }},
      {text:'2 Contacts', go:function(){ go(Contacts()); }},
      {text:'3 Call register', go:function(){ go(Register()); }},
      {text:'4 Services', go:function(){ go(Services()); }},
      {text:'5 Games', go:function(){ go(Games()); }},
      {text:'6 Profile', go:function(){ go(Profile()); }}
    ]);
  }
  function MsgMenu(){
    return List('Messages', [
      {text:function(){ return 'Inbox (' + ch.inbox.filter(function(m){ return !m.out; }).length + ')'; }, go:function(){ openInbox(false); }},
      {text:function(){ return 'Outbox (' + ch.inbox.filter(function(m){ return m.out; }).length + ')'; }, go:function(){ go(Outbox()); }},
      {text:'Write message', go:function(){ go(PickContact('Send to', function(c){ go(ReplyPick(c.name, c.i)); })); }}
    ]);
  }
  function openInbox(newest){
    var ins = ch.inbox.filter(function(m){ return !m.out; }).slice().reverse();
    var lst = List('Inbox', ins.map(function(m){ return {text:function(){ return (ch.read[m.id] ? '' : '*') + m.from; }, go:function(){ go(Read(m)); }}; }), 'Read');
    go(lst);
    if(newest && ins[0]) go(Read(ins[0]));
  }
  function Outbox(){
    var outs = ch.inbox.filter(function(m){ return m.out; }).slice().reverse();
    return List('Outbox', outs.map(function(m){ return {text:'To ' + (m.to || '?'), go:function(){ go(Read(m)); }}; }), 'Read');
  }
  function Read(m){
    var s = {name:'read', top:0};
    s.enter = function(){ if(!m.out && !ch.read[m.id]){ ch.read[m.id] = 1; log(ch, 'read', {msg:m.id, from:m.from}); } };
    s.draw = function(l){
      var lines = l.wrap(m.text, W - 3);
      l.text(0, 0, l.fit(m.out ? 'To ' + (m.to || '') : m.from, W - 30)); l.text(W - l.width(clock(new Date(m.at))), 0, clock(new Date(m.at)));
      l.rect(0, 9, W, 1);
      s.max = Math.max(0, lines.length - 4);
      for(var k = 0; k < 4; k++){ var t = lines[s.top + k]; if(t) l.text(1, 11 + k * LH, t); }
      softkey(l, m.out ? 'Back' : 'Options');
    };
    s.key = function(k){
      if(k === 'up'){ s.top = Math.max(0, s.top - 1); return; }
      if(k === 'down'){ s.top = Math.min(s.max || 0, s.top + 1); return; }
      if(k === 'menu'){
        if(m.out){ back(); return; }
        go(List('Options', [
          {text:'Reply', go:function(){ go(ReplyPick(m.from, m.fromI)); }},
          {text:'Call sender', go:function(){ go(Call(m.from, m.fromI)); }}
        ]));
        return;
      }
      return false;
    };
    return s;
  }
  function ReplyPick(to, toI){
    // T9-ish: canned words; digit keys jump like predictive text
    return List('T9: ' + to, REPLIES.map(function(t){
      return {text:t, go:function(){ send(to, toI, t); }};
    }), 'Send');
  }
  function send(to, toI, text){
    log(ch, 'reply', {to:to, toI:toI, text:text});
    ch.inbox.push({id:'s' + Date.now(), from:'Me', out:true, to:to, text:text, at:Date.now()});
    stack = [];
    cur = Note(['Sending', 'message', '>>>'], null, null, 0);
    draw();
    var dots = 0, s = cur;
    var pump = function(){ if(cur !== s) return; dots++; s.draw = function(l){ l.center(14, 'Sending'); l.center(24, 'message'); l.rect(14, 40, Math.min(68, dots * 12), 4); l.frame(13, 39, 70, 6); }; draw(); if(dots < 6) later(pump, 160); else { cur = Note(['Message', 'sent'], null, function(){ home(); }, 1100); cur.enter(); draw(); } };
    pump();
    // the character on the other end may answer
    var r = rng(hash(ch.seed + '|' + text + '|' + ch.inbox.length));
    if(toI !== -2 && r() < 0.75){
      later(function(){
        var t = pick(r, BACK), id = 'r' + Date.now();
        log(ch, 'sms_in', {msg:id, from:to, fromI:toI, text:t});
        ch.inbox.push({id:id, from:to, fromI:toI, text:t, at:Date.now()});
        smsTone(); buzz();
        var c = ch.contacts.filter(function(x){ return x.i === toI; })[0];
        if(c && c.node){ ring(c.node, true); later(function(){ ring(c.node, false); }, 1600); }
        if(cur && cur.name === 'idle') draw(); else if(cur && cur.name === 'note') home();
      }, 2600 + Math.floor(r() * 2500));
    }
  }
  function PickContact(title, fn){
    var list = ch.contacts.length ? ch.contacts : [{i:-1, name:'Unknown no.'}];
    return List(title, list.map(function(c){ return {text:c.name, go:function(){ fn(c); }}; }));
  }
  function Contacts(){
    return PickContact('Contacts', function(c){
      go(List(c.name, [
        {text:'Call', go:function(){ go(Call(c.name, c.i)); }},
        {text:'Send message', go:function(){ go(ReplyPick(c.name, c.i)); }}
      ]));
    });
  }
  function Call(name, i){
    var s = {name:'call', t:0, state:'calling'};
    var c = ch.contacts.filter(function(x){ return x.i === i; })[0];
    var r = rng(hash(ch.seed + '|call|' + name + '|' + Date.now()));
    var answers = r() < 0.4, started = 0;
    s.enter = function(){
      log(ch, 'call', {to:name, toI:i});
      ch.calls.unshift({type:'dialled', name:name, i:i, at:Date.now()});
      if(c && c.node) ring(c.node, true);
      ringTone();
      var step = function(){
        if(cur !== s) return;
        s.t++;
        if(s.state === 'calling' && s.t >= 8){ s.state = answers ? 'on' : 'noans'; started = Date.now(); if(c && c.node) ring(c.node, false); if(!answers){ later(function(){ if(cur === s) back(); }, 1500); } }
        draw();
        if(s.state !== 'noans') later(step, 450);
      };
      later(step, 450);
    };
    s.leave = function(){ if(c && c.node) ring(c.node, false); if(s.state === 'on') log(ch, 'call_end', {to:name, toI:i, secs:Math.round((Date.now() - started) / 1000)}); };
    s.draw = function(l){
      signal(l, ch.bars); battery(l, ch.batt);
      if(s.state === 'calling'){ l.center(14, 'Calling'); l.center(26, l.fit(name, W - 2)); l.center(38, '......'.slice(0, 1 + s.t % 6)); softkey(l, 'End'); }
      else if(s.state === 'on'){ var sec = Math.floor((Date.now() - started) / 1000); l.center(14, l.fit(name, W - 2)); l.center(26, '00:' + pad2(sec % 60)); l.center(38, sec % 4 < 2 ? '...hello?' : '(breathing)'); softkey(l, 'End'); }
      else { l.center(20, 'No answer'); l.center(32, l.fit(name, W - 2)); }
    };
    s.key = function(k){ if(k === 'menu' || k === 'c'){ back(); return; } };
    return s;
  }
  function Dial(first){
    var s = {name:'dial', num:first};
    s.draw = function(l){ l.text(W - l.width(s.num) - 1, 24, s.num.slice(-15)); softkey(l, 'Call'); };
    s.key = function(k){
      if(/^[0-9#*]$/.test(k)){ if(s.num.length < 20) s.num += k; return; }
      if(k === 'c'){ s.num = s.num.slice(0, -1); if(!s.num) back(); return; }
      if(k === 'menu'){ var n = s.num; cur = stack.pop() || Idle(); go(Call(n, -3)); return; }
      return false;
    };
    return s;
  }
  function Register(){
    var lab = {missed:'Missed', received:'Recvd', dialled:'Dialled'};
    return List('Call register', ch.calls.slice(0, 20).map(function(cl){
      return {text:lab[cl.type] + ' ' + cl.name, go:function(){ go(List(clock(new Date(cl.at)) + ' ' + lab[cl.type], [{text:'Call ' + cl.name, go:function(){ go(Call(cl.name, cl.i)); }}])); }};
    }), 'Details');
  }
  function Profile(){
    var s = {name:'profile'};
    s.draw = function(l){ l.center(0, 'Profile'); l.rect(0, 9, W, 1); l.text(1, 11, l.fit(ch.owner, W - 2)); l.text(1, 21, l.fit(sceneTag(), W - 2)); l.text(1, 31, 'Tones: ' + (soundOn() ? 'on' : 'muted')); l.text(1, 41, 'Snake best ' + ch.snakeBest); softkey(l, 'Back'); };
    s.key = function(k){ if(k === 'menu'){ back(); return; } return false; };
    return s;
  }

  // Services: a WAP page whose only content is the official embed of a post
  function Services(){
    var s = {name:'wap', state:'loading', t:0, id:null};
    s.enter = function(){
      log(ch, 'wap_open');
      var step = function(){ if(cur !== s || s.state !== 'loading') return; s.t++; draw(); later(step, 140); };
      later(step, 140);
      Promise.all([pickTweet(ch), new Promise(function(r){ later(r, 1000); })]).then(function(got){
        if(cur !== s) return;
        var p = got[0];
        if(!p || !p.id){ s.state = p && p.why === 'cooling' ? 'cooling' : 'none'; draw(); return; }
        s.id = p.id; s.state = 'opening'; draw();
        showEmbed(p.id).then(function(ok){
          if(cur !== s) return;
          s.state = ok ? 'shown' : 'failed';
          if(ok){ markShown(p.id); log(ch, 'wap_post', {post:p.id}); buzz(); } else closeWap();
          draw();
        });
      });
    };
    s.leave = function(){ closeWap(); };
    s.draw = function(l){
      l.center(0, 'thryd WAP'); l.rect(0, 9, W, 1);
      if(s.state === 'loading'){ l.center(18, 'Connecting'); l.frame(13, 32, 70, 6); l.rect(14, 33, Math.min(68, s.t * 9), 4); }
      else if(s.state === 'opening'){ l.center(22, 'Opening post'); l.center(32, '...'); }
      else if(s.state === 'shown'){ l.center(14, 'Post open'); l.center(24, 'on the big'); l.center(34, 'screen >>'); softkey(l, 'Back'); }
      else if(s.state === 'cooling'){ l.center(14, 'No new posts'); l.center(24, 'here today.'); l.center(34, 'Try later'); softkey(l, 'Back'); }
      else { l.center(14, 'No service'); l.center(24, 'in this'); l.center(34, 'scene'); softkey(l, 'Back'); }
    };
    s.key = function(k){ if(k === 'menu'){ back(); return; } return false; };
    return s;
  }
  function closeWap(){ if(wap){ wap.remove(); wap = null; } }
  function showEmbed(id){
    closeWap();
    wap = doc.createElement('div'); wap.id = 'p3310wap';
    wap.innerHTML = '<div class="p3310wap-bar"><span>WAP</span><button type="button" aria-label="Close post">\u00D7</button></div><div class="twembed"></div>';
    ['pointerdown', 'pointerup', 'click'].forEach(function(ev){ wap.addEventListener(ev, function(e){ e.stopPropagation(); }); });
    wap.querySelector('button').addEventListener('click', function(){ if(cur && cur.name === 'wap') back(); else closeWap(); });
    doc.body.appendChild(wap);
    var pr = el.getBoundingClientRect(), vw = root.innerWidth;
    if(vw < 640){ wap.style.left = Math.max(4, (vw - 270) / 2) + 'px'; wap.style.top = '8px'; }
    else { var x = pr.left > vw / 2 ? pr.left - 286 : pr.right + 16; wap.style.left = Math.max(8, Math.min(vw - 278, x)) + 'px'; wap.style.top = Math.max(8, pr.top) + 'px'; }
    var slot = wap.querySelector('.twembed'), mine = wap;
    return widgets().then(function(tw){
      if(!tw || !tw.widgets || !tw.widgets.createTweet || wap !== mine) return false;
      var to = new Promise(function(r){ setTimeout(function(){ r(null); }, 15000); });
      return Promise.race([tw.widgets.createTweet(id, slot, {width:260, dnt:true, conversation:'none', theme:'light'}), to]).then(function(node){
        if(wap !== mine) return false;
        if(!node){ return false; }
        mine.classList.add('on');
        return true;
      });
    }).catch(function(){ return false; });
  }

  // Games: Snake
  function Games(){ return List('Games', [{text:'1 Snake II', go:function(){ go(Snake()); }}]); }
  function Snake(){
    var C = 3, GW = 31, GH = 17, OX = 1, OY = 11;
    var s = {name:'snake', state:'ready', score:0};
    var body, dir, nextDir, food, loopT = null;
    function reset(){ body = [[8, 8], [7, 8], [6, 8], [5, 8]]; dir = [1, 0]; nextDir = dir; s.score = 0; place(); }
    function place(){ var r = Math.random; do { food = [Math.floor(r() * GW), Math.floor(r() * GH)]; } while(body.some(function(b){ return b[0] === food[0] && b[1] === food[1]; })); }
    function loop(){
      if(cur !== s || s.state !== 'run') return;
      dir = nextDir;
      var h = [(body[0][0] + dir[0] + GW) % GW, (body[0][1] + dir[1] + GH) % GH];
      if(body.some(function(b, k){ return k < body.length - 1 && b[0] === h[0] && b[1] === h[1]; })){
        s.state = 'over'; tone([[440, 120, 30], [330, 120, 30], [220, 260]]); buzz();
        if(s.score > ch.snakeBest) ch.snakeBest = s.score;
        log(ch, 'snake', {score:s.score}); draw(); return;
      }
      body.unshift(h);
      if(h[0] === food[0] && h[1] === food[1]){ s.score += 7; tone([[2093, 30]]); place(); } else body.pop();
      draw();
      loopT = later(loop, Math.max(70, 150 - body.length * 2));
    }
    s.enter = function(){ reset(); };
    s.leave = function(){ s.state = s.state === 'run' ? 'ready' : s.state; };
    s.draw = function(l){
      l.text(1, 0, String(s.score).padStart(4, '0')); l.text(W - l.width('best ' + ch.snakeBest) - 1, 0, 'best ' + ch.snakeBest);
      l.frame(0, OY - 1, W, H - OY + 1);
      body.forEach(function(b, k){ l.rect(OX + b[0] * C, OY + b[1] * C, C - (k ? 0 : 0), C - 0); });
      l.rect(OX + food[0] * C + 1, OY + food[1] * C, 1, 1); l.rect(OX + food[0] * C, OY + food[1] * C + 1, 3, 1); l.rect(OX + food[0] * C + 1, OY + food[1] * C + 2, 1, 1);
      if(s.state === 'ready'){ l.rect(18, 26, 60, 12, false); l.frame(18, 26, 60, 12); l.center(28, 'Press 5'); }
      if(s.state === 'over'){ l.rect(12, 20, 72, 24, false); l.frame(12, 20, 72, 24); l.center(23, 'Game over'); l.center(33, 'Score ' + s.score); }
    };
    s.key = function(k){
      var m = {up:[0, -1], '2':[0, -1], down:[0, 1], '8':[0, 1], left:[-1, 0], '4':[-1, 0], right:[1, 0], '6':[1, 0]}[k];
      if(m){ if(s.state === 'ready'){ s.state = 'run'; log(ch, 'snake_start'); loop(); } if(m[0] !== -dir[0] || m[1] !== -dir[1]) nextDir = m; return; }
      if(k === '5' || k === 'menu'){ if(s.state === 'over'){ reset(); s.state = 'ready'; return; } if(s.state === 'ready'){ s.state = 'run'; log(ch, 'snake_start'); loop(); return; } return; }
      if(k === 'c'){ if(s.state === 'run' && s.score) log(ch, 'snake', {score:s.score}); s.state = 'quit'; back(); return; }
      return false;
    };
    return s;
  }

  // ---------- keyboard (only while the phone is open) ----------
  var KB = {ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right', Enter:'menu', ' ':'menu', Backspace:'c', Escape:'esc'};
  function onKey(e){
    if(!el || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target; if(t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    var k = KB[e.key] || (/^[0-9#*]$/.test(e.key) ? e.key : null);
    if(!k) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if(k === 'esc'){ if(cur && cur.name === 'idle') close('esc'); else { keyBeep(); if(!(cur && cur.key && cur.key('c') !== false)) back(); else draw(); } return; }
    var b = el.querySelector('[data-k="' + (k === 'left' || k === 'right' ? '' : k) + '"]');
    if(b){ b.classList.add('down'); setTimeout(function(){ b.classList.remove('down'); }, 90); }
    press(k);
  }
  function onResize(){ if(el && ch) place(hlNode && hlNode.isConnected ? hlNode : null); }

  // ---------- open / close ----------
  var openSeq = 0;
  function open(t){
    if(!t) return Promise.resolve(null);
    var my = ++openSeq;
    return sceneObjects(t).then(function(objs){
      if(my !== openSeq) return null;
      var same = ch && el && ch.scene === t.scene && ch.i === t.i;
      if(same){ buzz(); return api.state(); }
      close('switch', true);
      ch = buildChar(t, objs);
      applyLog(ch);
      if(!el) build();
      el.classList.remove('off');
      hlNode = t.node; if(hlNode) hlNode.classList.add('p3310-me');
      place(t.node);
      el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
      stack = []; cur = Idle(); cur.enter(); draw();
      root.addEventListener('keydown', onKey, true);
      root.addEventListener('resize', onResize);
      log(ch, 'open', {owner:ch.owner});
      if(unread(ch)) later(function(){ smsTone(); buzz(); }, 450);
      return api.state();
    });
  }
  function close(why, quiet){
    if(!el || el.classList.contains('off')){ return; }
    if(cur && cur.leave) cur.leave();
    clearTimers(); closeWap();
    ringNodes.slice().forEach(function(n){ ring(n, false); });
    if(hlNode){ hlNode.classList.remove('p3310-me', 'p3310-ping'); hlNode = null; }
    root.removeEventListener('keydown', onKey, true);
    root.removeEventListener('resize', onResize);
    if(ch) log(ch, 'close', {why:why || ''});
    el.classList.add('off');
    cur = null; stack = []; if(!quiet) ch = null;
  }
  var api = {
    open:open, close:function(){ close('api'); }, press:press,
    state:function(){ return {open:!!(el && !el.classList.contains('off')), screen:cur ? cur.name : null, owner:ch ? ch.owner : null, scene:ch ? ch.scene : null, obj:ch ? ch.i : null, contacts:ch ? ch.contacts.map(function(c){ return c.name; }) : [], unread:ch ? unread(ch) : 0, wap:!!(wap && wap.classList.contains('on'))}; },
    log:logRows
  };
  root.ThrydPhone3310 = api;
})(window);
