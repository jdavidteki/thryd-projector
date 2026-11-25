// video card loops continuously again (Jesuye 25 Nov 1:56 PM ET); pauses only when hidden or off-screen
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = fs.readFileSync(path.join(root, 'assets/video_card.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const SCENE = {
  id: 'story-draw-120-j47',
  run: 'story-draw-120',
  j: 'j47',
  place: 'Ikorodu Town Hall',
  video: 'videos/media/scene.mp4',
  card_video: 'videos/media/scene-card.mp4',
  poster: 'videos/media/scene.jpg',
};

function matchSel(el, sel){
  if(!sel) return false;
  if(sel.includes(',')) return sel.split(',').some(s => matchSel(el, s.trim()));
  const m = String(sel).trim().match(/^([a-zA-Z][\w-]*)?(?:#([\w-]+))?(?:\.([\w-]+))?$/);
  if(!m) return false;
  if(m[1] && el.tagName !== m[1].toUpperCase()) return false;
  if(m[2] && el.id !== m[2]) return false;
  if(m[3] && !el.classList.contains(m[3])) return false;
  return true;
}
function qs(root, sel){
  for(const c of root.children || []){
    if(matchSel(c, sel)) return c;
    const f = qs(c, sel);
    if(f) return f;
  }
  return null;
}

function makeEl(tag, hooks){
  const attrs = {};
  const children = [];
  const listeners = {};
  const classes = new Set();
  const style = {};
  const dataset = {};
  let hidden = false;
  hooks = hooks || {};
  const el = {
    tagName: String(tag).toUpperCase(),
    children, style, dataset, parentNode: null, offsetWidth: 132, offsetHeight: 100,
    _left: 0, _top: 0, id: '', className: '', title: '', href: '', target: '', rel: '',
    src: '', poster: '', alt: '', textContent: '', _html: '',
    muted: false, defaultMuted: false, autoplay: false, loop: false, playsInline: false,
    preload: '', paused: true, currentTime: 0, duration: NaN, readyState: 0, currentSrc: '',
    draggable: false, offsetParent: {}, _plays: null, _pauses: null,
    get hidden(){ return hidden; },
    set hidden(v){ hidden = !!v; },
    get offsetLeft(){ return parseFloat(style.left) || el._left || 0; },
    get offsetTop(){ return parseFloat(style.top) || el._top || 0; },
    classList: {
      add(c){ classes.add(c); el.className = [...classes].join(' '); },
      remove(c){ classes.delete(c); el.className = [...classes].join(' '); },
      contains(c){ return classes.has(c); },
      toggle(c, on){ if(on === undefined ? !classes.has(c) : on) el.classList.add(c); else el.classList.remove(c); },
    },
    setAttribute(k, v){
      const val = v == null ? '' : String(v);
      attrs[k] = val;
      if(k === 'id') el.id = val;
      if(k === 'href') el.href = val;
      if(k === 'target') el.target = val;
      if(k === 'rel') el.rel = val;
      if(k === 'src'){ el.src = val; el.currentSrc = val; }
      if(k === 'poster') el.poster = val;
      if(k === 'alt') el.alt = val;
      if(k === 'title') el.title = val;
      if(k === 'preload') el.preload = val;
      if(k === 'muted') el.muted = true;
      if(k === 'autoplay') el.autoplay = true;
      if(k === 'loop') el.loop = true;
      if(k === 'playsinline' || k === 'webkit-playsinline') el.playsInline = true;
      if(k === 'hidden') hidden = true;
      if(k === 'draggable') el.draggable = val === 'true';
    },
    getAttribute(k){
      if(k === 'src') return el.src || attrs.src || null;
      if(k === 'poster') return el.poster || attrs.poster || null;
      if(k === 'id') return el.id || null;
      if(k === 'href') return el.href || attrs.href || null;
      return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null;
    },
    removeAttribute(k){
      delete attrs[k];
      if(k === 'src'){ el.src = ''; el.currentSrc = ''; }
      if(k === 'poster') el.poster = '';
      if(k === 'autoplay') el.autoplay = false;
      if(k === 'loop') el.loop = false;
      if(k === 'hidden') hidden = false;
    },
    appendChild(c){ children.push(c); c.parentNode = el; return c; },
    addEventListener(t, fn){ (listeners[t] = listeners[t] || []).push(fn); },
    querySelector(sel){ return qs(el, sel); },
    closest(sel){ let n = el; while(n){ if(matchSel(n, sel)) return n; n = n.parentNode; } return null; },
    getBoundingClientRect(){ return {left: el.offsetLeft, top: el.offsetTop, right: el.offsetLeft + 132, bottom: el.offsetTop + 100, width: 132, height: 100}; },
    setPointerCapture(){},
    releasePointerCapture(){},
    play(){ if(hooks.play) hooks.play(el); el.paused = false; fire(el, 'play'); return Promise.resolve(); },
    pause(){ if(hooks.pause) hooks.pause(el); el.paused = true; },
    _listeners: listeners,
  };
  Object.defineProperty(el, 'innerHTML', {
    get(){ return el._html; },
    set(html){ el._html = String(html); hydrate(el, el._html, hooks); },
  });
  return el;
}

const VOID = new Set(['VIDEO','IMG','SOURCE','BR','HR','INPUT','META','LINK']);
function hydrate(parent, html, hooks){
  parent.children.length = 0;
  parent.textContent = '';
  const tokens = String(html).split(/(<[^>]+>)/).filter(s => s !== '');
  const stack = [parent];
  for(const t of tokens){
    if(t.startsWith('</')){ if(stack.length > 1) stack.pop(); continue; }
    if(t.startsWith('<')){
      const m = t.match(/^<([a-zA-Z][\w-]*)([^>]*)\/?\s*>$/);
      if(!m) continue;
      const child = makeEl(m[1], hooks);
      if(child.tagName === 'VIDEO'){ child.duration = 30; child.readyState = 2; }
      const raw = m[2] || '';
      raw.replace(/([^\s=]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g, (_, k, v1, v2, v3) => {
        child.setAttribute(k, v1 ?? v2 ?? v3 ?? '');
        if(k === 'class') String(v1 ?? v2 ?? v3 ?? '').split(/\s+/).filter(Boolean).forEach(c => child.classList.add(c));
        return '';
      });
      stack[stack.length - 1].appendChild(child);
      const self = t.endsWith('/>') || VOID.has(child.tagName);
      if(!self) stack.push(child);
      continue;
    }
    const cur = stack[stack.length - 1];
    cur.textContent = (cur.textContent || '') + t;
  }
}

function fire(el, type, ev){
  const evObj = Object.assign({
    type, pointerId: 1, pointerType: 'mouse', button: 0, clientX: 10, clientY: 10,
    target: el, currentTarget: el, defaultPrevented: false,
    stopPropagation(){}, preventDefault(){ evObj.defaultPrevented = true; },
  }, ev || {});
  if(!evObj.target) evObj.target = el;
  for(const fn of (el._listeners[type] || [])) fn(evObj);
  return evObj;
}

function load(opts = {}){
  const plays = [];
  const pauses = [];
  const store = Object.assign({}, opts.store);
  const created = [];
  const hooks = {
    play(el){ plays.push({src: el.src, t: el.currentTime}); },
    pause(el){ pauses.push({src: el.src, t: el.currentTime}); },
  };
  const head = makeEl('head', hooks);
  const body = makeEl('body', hooks);
  const docListeners = {};
  const winListeners = {};
  const lhListeners = [];
  let hidden = false;
  const videos = opts.videos || [SCENE];
  const ctx = {
    Date, Math, JSON, Promise, Object, Array, String, Number, Boolean, Error, isFinite,
    setTimeout(){ return 0; }, clearTimeout(){}, setInterval(){ return 0; }, clearInterval(){},
    innerWidth: 800, innerHeight: 600,
    location: { search: '' },
    localStorage: {
      getItem(k){ return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem(k, v){ store[k] = String(v); },
      removeItem(k){ delete store[k]; },
    },
    document: {
      hidden,
      get head(){ return head; },
      get body(){ return body; },
      createElement(name){
        const el = makeEl(name, hooks);
        created.push(el);
        if(name === 'video'){ el.duration = 30; el.readyState = 2; }
        return el;
      },
      getElementById(id){ return (id === 'storycard' || id === 'bar') ? null : (qs(body, '#' + id)); },
      addEventListener(t, fn){ (docListeners[t] = docListeners[t] || []).push(fn); },
    },
    fetch: async (u) => {
      if(String(u).startsWith('data/videos.json')) return {ok: true, json: async () => ({videos})};
      return {ok: false, json: async () => null};
    },
    addEventListener(t, fn){ (winListeners[t] = winListeners[t] || []).push(fn); },
    LH: opts.lh === false ? undefined : {on(fn){ lhListeners.push(fn); return () => {}; }},
    IntersectionObserver: function(cb){
      const inst = {cb, el: null, observe(el){ inst.el = el; }, unobserve(){}, disconnect(){}};
      ctx.__io = inst;
      return inst;
    },
  };
  Object.defineProperty(ctx.document, 'hidden', {get(){ return hidden; }, set(v){ hidden = !!v; }});
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return {
    ctx, body, store, plays, pauses, created, docListeners, winListeners, lhListeners,
    card: () => ctx.thrydVideoCard,
    vid(){ return qs(ctx.thrydVideoCard.el, 'video'); },
    go(){ return qs(ctx.thrydVideoCard.el, 'a.go'); },
    setHidden(v){ hidden = !!v; ctx.document.hidden = hidden; },
    fireIO(){ if(ctx.__io && ctx.__io.cb) ctx.__io.cb([]); },
  };
}
const tick = async (n = 6) => { for(let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };

test('index.html cache-bumps video_card.js and the script autoplays on a loop', () => {
  assert.match(html, /video_card\.js\?v=4/);
  assert.doesNotMatch(html, /video_card\.js\?v=3(?:\D|$)/);
  assert.match(src, /preload=["']auto["']/);
  assert.match(src, /<video[^>]*\bautoplay\b/);
  assert.match(src, /<video[^>]*\bloop\b/);
  assert.match(src, /vid\.autoplay=true/);
  assert.match(src, /vid\.loop=true/);
  assert.match(src, /preload='auto'/);
  assert.doesNotMatch(src, /s==='idle'\|\|s==='hidden'/);
  assert.doesNotMatch(src, /heatStop/);
  assert.match(src, /open ↗/);
  assert.match(src, /TH=6/);
  assert.match(src, /IntersectionObserver/);
  assert.match(html, /var VER=613,/);
});

test('the card starts looping on its own, without a tap', async () => {
  const L = load();
  await tick();
  const C = L.card();
  assert.ok(C && C.el && C.el.id === 'videocard');
  const vid = L.vid();
  assert.equal(vid.autoplay, true);
  assert.equal(vid.loop, true);
  assert.equal(vid.preload, 'auto');
  assert.equal(vid.muted, true);
  assert.ok(L.plays.length >= 1);
  assert.equal(vid.paused, false);
  assert.equal(vid.src, SCENE.card_video);
  assert.equal(L.go().href, C.url);
  assert.equal(L.go().target, '_blank');
  const n = L.plays.length;
  fire(C.el, 'click', {clientX: 40, clientY: 40, target: vid});
  assert.equal(vid.paused, false);
  assert.equal(L.plays.length, n);
});

test('a drag does not pause the loop, and the card still moves', async () => {
  const L = load();
  await tick();
  const C = L.card();
  const vid = L.vid();
  C.moveTo(200, 200);
  const startLeft = C.el.offsetLeft;
  const startTop = C.el.offsetTop;
  assert.equal(startLeft, 200);
  assert.equal(startTop, 200);
  assert.equal(vid.paused, false);
  fire(C.el, 'pointerdown', {pointerId: 7, clientX: 100, clientY: 100, target: C.el});
  fire(C.el, 'pointermove', {pointerId: 7, clientX: 104, clientY: 100, target: C.el});
  assert.equal(C.el.offsetLeft, startLeft);
  fire(C.el, 'pointermove', {pointerId: 7, clientX: 120, clientY: 115, target: C.el});
  assert.ok(C.el.classList.contains('drag'));
  assert.equal(C.el.offsetLeft, startLeft + 20);
  assert.equal(C.el.offsetTop, startTop + 15);
  fire(C.el, 'pointerup', {pointerId: 7, clientX: 120, clientY: 115, target: C.el});
  const ev = fire(C.el, 'click', {clientX: 120, clientY: 115, target: C.el});
  assert.equal(ev.defaultPrevented, true);
  assert.equal(vid.paused, false);
  assert.ok(L.store.thryd_videocard_pos);
});

test('a new scene swaps the source and keeps looping', async () => {
  const L = load();
  await tick();
  const C = L.card();
  const vid = L.vid();
  assert.equal(vid.src, SCENE.card_video);
  const n = L.plays.length;
  const ok = C.apply({j: 'j48', place: 'Safehouse', video: 'videos/media/next.mp4', poster: 'videos/media/next.jpg'});
  assert.equal(ok, true);
  assert.equal(vid.src, 'videos/media/next.mp4');
  assert.equal(vid.paused, false);
  assert.ok(L.plays.length > n);
  fire(vid, 'ended');
  assert.equal(vid.loop, true);
  assert.equal(vid.paused, false);
});

test('a hidden tab pauses the loop; coming back starts it; idle does not pause it', async () => {
  const L = load();
  await tick();
  const C = L.card();
  assert.equal(L.vid().paused, false);
  assert.equal(L.lhListeners.length, 0);
  L.setHidden(true);
  for(const fn of L.docListeners.visibilitychange || []) fn();
  assert.equal(L.vid().paused, true);
  L.setHidden(false);
  for(const fn of L.docListeners.visibilitychange || []) fn();
  assert.equal(L.vid().paused, false);
});

test('an off-screen card pauses; on-screen it plays again', async () => {
  const L = load();
  await tick();
  const C = L.card();
  assert.equal(L.vid().paused, false);
  C.el.getBoundingClientRect = () => ({left: -400, top: -400, right: -268, bottom: -300, width: 132, height: 100});
  C.syncPlay();
  assert.equal(L.vid().paused, true);
  assert.equal(C.video().onScreen, false);
  C.el.getBoundingClientRect = () => ({left: 200, top: 200, right: 332, bottom: 300, width: 132, height: 100});
  C.syncPlay();
  assert.equal(L.vid().paused, false);
  assert.equal(C.video().onScreen, true);
});
