/* v616 (25 Nov 2026, Jesuye 5:21 PM ET: "localization should be coded in. $36 should automatically be converted to naira. or whatever currency").
   Mirror of /workspace/thryd-db/localize.py for the stage. Money in a DISPLAYED line gets an added note, "$36 (≈₦49,206)"; the line itself is never edited
   (an amount inside a "quoted" line keeps the quote and the note follows it; «» lines are never touched).
   Currency = the VIEWER's: ?cur=XXX wins ("?cur=off" turns it off), else the region of the browser locale (Intl.Locale), else the time zone's country, else NGN.
   Rates: data/fx.json (same site, written by localize.py export-fx from the box's cached open.er-api.com table, with its date); when that file is missing or
   older than 36 h the page reads open.er-api.com itself (kept in localStorage 12 h). No rate -> no note: a rate is never invented.
   API: window.ThrydLocalize = {cur(), annotate(text), notes(text), find(text), ready(), _setRates(r), _fmt(v, cur)} */
(function(root){
  'use strict';
  if(root.ThrydLocalize) return;
  var DAY36 = 36 * 3600e3, TTL = 12 * 3600e3, KEY = 'thryd_fx_v1';
  var CODES = 'USD NGN GBP EUR GHS ZAR KES CAD AUD NZD INR JPY CNY BRL MXN AED XOF XAF CHF SEK NOK DKK PLN TRY EGP MAD TZS UGX RWF SGD HKD KRW'.split(' ');
  var CODESET = {}; CODES.forEach(function(c){ CODESET[c] = 1; });
  var LOWER_OK = {usd: 1, ngn: 1, gbp: 1, eur: 1};
  var WORD = {dollar: 'USD', dollars: 'USD', buck: 'USD', bucks: 'USD', naira: 'NGN', euro: 'EUR', euros: 'EUR', cedi: 'GHS', cedis: 'GHS', rand: 'ZAR', quid: 'GBP',
    'pounds sterling': 'GBP', 'pound sterling': 'GBP', rupees: 'INR', rupee: 'INR'};
  var PREFIX = {'$': 'USD', 'US$': 'USD', '£': 'GBP', '€': 'EUR', '₦': 'NGN', '₹': 'INR', N: 'NGN'};
  var SCALE = {k: 1e3, thousand: 1e3, grand: 1e3, m: 1e6, mil: 1e6, million: 1e6, bn: 1e9, billion: 1e9};
  var ZERO_DEC = {NGN: 1, JPY: 1, KRW: 1, VND: 1, XOF: 1, XAF: 1, IDR: 1, CLP: 1, UGX: 1, RWF: 1, TZS: 1};
  var REGION = {NG: 'NGN', US: 'USD', GB: 'GBP', GH: 'GHS', ZA: 'ZAR', KE: 'KES', CA: 'CAD', AU: 'AUD', NZ: 'NZD', IN: 'INR', JP: 'JPY', CN: 'CNY', BR: 'BRL', MX: 'MXN',
    AE: 'AED', SN: 'XOF', CI: 'XOF', CM: 'XAF', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', TR: 'TRY', EG: 'EGP', MA: 'MAD', TZ: 'TZS', UG: 'UGX', RW: 'RWF',
    SG: 'SGD', HK: 'HKD', KR: 'KRW', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', IE: 'EUR', PT: 'EUR', BE: 'EUR', AT: 'EUR', FI: 'EUR', GR: 'EUR', LU: 'EUR'};
  var TZ = {'Africa/Lagos': 'NG', 'Africa/Accra': 'GH', 'Africa/Johannesburg': 'ZA', 'Africa/Nairobi': 'KE', 'Europe/London': 'GB', 'America/New_York': 'US',
    'America/Chicago': 'US', 'America/Los_Angeles': 'US', 'America/Denver': 'US', 'America/Toronto': 'CA', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE', 'Asia/Dubai': 'AE'};
  var NUM = '(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)', SC = '(?:[km]|\\s(?:thousand|grand|million|mil|billion|bn))', NOWORD = '(?![A-Za-z0-9])';
  var CODES_RE = CODES.slice().sort(function(a, b){ return b.length - a.length; }).join('|');
  var WORDS_RE = Object.keys(WORD).sort(function(a, b){ return b.length - a.length; }).join('|');
  var PATS = null;
  function pats(){
    if(PATS) return PATS;
    PATS = [
      ['sym', new RegExp('(?<![A-Za-z0-9$£€₦₹])(?<sym>US\\$|[$£€₦₹])\\s?(?<num>' + NUM + ')(?:(?<sc>' + SC + ')' + NOWORD + ')?(?![\\d,]*\\d)(?!\\.\\d)', 'gi')],
      ['nn', new RegExp('(?<![A-Za-z0-9])(?<sym>N)(?<num>\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d{3,}(?:\\.\\d+)?)(?:(?<sc>[kK]|[mM])' + NOWORD + ')?(?!\\d)', 'g')],
      ['iso_pre', new RegExp('(?<![A-Za-z0-9])(?<code>' + CODES_RE + '|usd|ngn|gbp|eur)\\s?(?<num>' + NUM + ')(?:(?<sc>' + SC + ')' + NOWORD + ')?(?![\\d,]*\\d)(?!\\.\\d)', 'g')],
      ['post', new RegExp('(?<![A-Za-z0-9$£€₦₹.,])(?<num>' + NUM + ')(?:(?<sc>' + SC + '))?\\s(?<code>' + CODES_RE + '|usd|ngn|gbp|eur|' + WORDS_RE + ')' + NOWORD, 'gi')]
    ];
    return PATS;
  }
  function curOfCode(tok){
    if(CODESET[tok]) return tok;
    if(LOWER_OK[tok] && tok === tok.toLowerCase()) return tok.toUpperCase();
    return WORD[tok.toLowerCase()] || null;
  }
  function find(text){
    var out = [];
    pats().forEach(function(p){
      var kind = p[0], rx = p[1]; rx.lastIndex = 0; var m;
      while((m = rx.exec(text))){
        var g = m.groups, cur;
        if(kind === 'sym' || kind === 'nn') cur = PREFIX[g.sym.toUpperCase() === 'US$' ? 'US$' : g.sym];
        else if(kind === 'iso_pre') cur = curOfCode(g.code);
        else { var t = g.code; cur = (CODESET[t] ? t : (LOWER_OK[t] ? t.toUpperCase() : WORD[t.toLowerCase()])) || null; }
        if(!cur) { if(m[0].length === 0) rx.lastIndex++; continue; }
        var amt = parseFloat(g.num.replace(/,/g, ''));
        if(isNaN(amt)) continue;
        if(g.sc) amt *= SCALE[g.sc.trim().toLowerCase()];
        out.push({start: m.index, end: m.index + m[0].length, raw: m[0], amount: amt, cur: cur});
      }
    });
    out.sort(function(a, b){ return a.start - b.start || (b.end - b.start) - (a.end - a.start); });
    var res = [], last = -1;
    out.forEach(function(x){ if(x.start >= last){ res.push(x); last = x.end; } });
    return res;
  }
  var RATES = null;   // {rates:{USD:1,...}, date}
  function setRates(r){ if(r && r.rates && r.rates.USD === 1) RATES = r; return !!RATES; }
  function fmt(v, cur){
    var dec = (ZERO_DEC[cur] || v >= 1000) ? 0 : 2, loc;
    try { loc = root.__thrydFxLoc || (root.navigator && root.navigator.language) || 'en-US'; } catch(e){ loc = 'en-US'; }
    try { return new Intl.NumberFormat(loc, {style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol', minimumFractionDigits: dec, maximumFractionDigits: dec}).format(v); }
    catch(e){ return cur + ' ' + v.toFixed(dec); }
  }
  function spans(text){
    var sp = [], m, r1 = /«[^»]*»/g, r2 = /“[^”]*”/g; while((m = r1.exec(text))) sp.push(['exact', m.index, m.index + m[0].length]);
    while((m = r2.exec(text))) sp.push(['quote', m.index, m.index + m[0].length]);
    var idx = []; for(var i = 0; i < text.length; i++) if(text[i] === '"') idx.push(i);
    for(var k = 0; k + 1 < idx.length; k += 2) sp.push(['quote', idx[k], idx[k + 1] + 1]);
    return sp;
  }
  function cur(){
    try {
      var q = (root.location && root.location.search || '').match(/[?&]cur=([A-Za-z]+)/);
      if(q){ var v = q[1].toUpperCase(); if(v === 'OFF' || v === 'NONE') return null; if(/^[A-Z]{3}$/.test(v)) return v; }
    } catch(e){}
    try {
      var lang = root.navigator && root.navigator.language, reg = null;
      var mm = lang && lang.match(/-([A-Za-z]{2})(?:-|$)/); if(mm) reg = mm[1].toUpperCase();      // an explicit region only; a bare 'en' says nothing
      if(reg && REGION[reg]) return REGION[reg];
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if(tz && TZ[tz] && REGION[TZ[tz]]) return REGION[TZ[tz]];
    } catch(e){}
    return 'NGN';
  }
  function conv(a, from, to){ var r = RATES && RATES.rates; if(!r || !r[from] || !r[to]) return null; return a / r[from] * r[to]; }
  /* [{pos, kind:'inline'|'quote', raw, shown}] for a text and a target currency */
  function plan(text, to){
    if(!text || !to || !RATES) return [];
    var ms = find(text); if(!ms.length) return [];
    var sp = spans(text), notes = [], nrx = /\((?:[^()]*≈[^()]*)\)/g, m, masked = [];
    while((m = nrx.exec(text))) masked.push([m.index, m.index + m[0].length]);
    var out = [];
    ms.forEach(function(x){
      if(masked.some(function(s){ return s[0] <= x.start && x.start < s[1]; })) return;
      if(x.cur === to) return;
      if(sp.some(function(s){ return s[0] === 'exact' && s[1] <= x.start && x.start < s[2]; })) return;
      var q = null; sp.forEach(function(s){ if(q === null && s[0] === 'quote' && s[1] <= x.start && x.start < s[2]) q = s[2]; });
      if(/^\s?\([^()]*≈/.test(text.slice(q !== null ? q : x.end))) return;
      var v = conv(x.amount, x.cur, to); if(v === null) return;
      out.push({pos: q !== null ? q : x.end, quote: q !== null, raw: x.raw.trim(), shown: fmt(v, to)});
    });
    return out;
  }
  function annotate(text){
    try {
      var to = cur(); var p = plan(text, to); if(!p.length) return text;
      var by = {}; p.forEach(function(n){ var d = by[n.pos] || (by[n.pos] = {i: '', q: []}); if(n.quote) d.q.push(n.raw + ' ≈ ' + n.shown); else d.i = ' (≈' + n.shown + ')'; });
      var out = text; Object.keys(by).map(Number).sort(function(a, b){ return b - a; }).forEach(function(pos){
        var d = by[pos], piece = d.i + (d.q.length ? ' (' + d.q.join('; ') + ')' : ''); out = out.slice(0, pos) + piece + out.slice(pos); });
      return out;
    } catch(e){ return text; }
  }
  /* just the notes, for lines that must stay a verbatim text node:  ['$36 ≈ ₦49,206'] */
  function notes(text){
    try { return plan(text, cur()).map(function(n){ return n.raw + ' ≈ ' + n.shown; }); } catch(e){ return []; }
  }
  function load(){
    var to = cur(); if(!to) return;
    var now = Date.now();
    try { var c = JSON.parse(root.localStorage.getItem(KEY) || 'null'); if(c && c.rates && now - c.at < TTL) { setRates(c); return; } } catch(e){}
    function live(){
      root.fetch('https://open.er-api.com/v6/latest/USD', {cache: 'no-store'}).then(function(r){ return r.ok ? r.json() : null; }).then(function(d){
        if(d && d.result === 'success' && d.rates && d.rates.USD === 1){
          var r = {rates: d.rates, date: new Date().toISOString().slice(0, 10), at: Date.now(), src: 'open.er-api.com'};
          if(setRates(r)) try { root.localStorage.setItem(KEY, JSON.stringify(r)); } catch(e){}
        }
      }).catch(function(){});
    }
    root.fetch('data/fx.json?t=' + Math.floor(now / 3600e3), {cache: 'no-store'}).then(function(r){ return r.ok ? r.json() : null; }).then(function(d){
      var at = d && d.fetched ? Date.parse(d.fetched) : 0;
      if(d && d.rates && d.rates.USD === 1 && at && now - at < DAY36){ setRates({rates: d.rates, date: d.date, at: at, src: d.source}); }
      else { if(d && d.rates && d.rates.USD === 1) setRates({rates: d.rates, date: d.date, at: at, src: d.source, stale: true}); live(); }
    }).catch(function(){ live(); });
  }
  root.ThrydLocalize = {cur: cur, annotate: annotate, notes: notes, find: find, ready: function(){ return !!RATES; }, rates: function(){ return RATES; }, _setRates: setRates, _fmt: fmt, _plan: plan};
  if(root.fetch && root.document) load();
})(typeof window !== 'undefined' ? window : globalThis);
