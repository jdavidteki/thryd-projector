import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const extrasSrc = fs.readFileSync(path.join(root, 'assets/extras.js'), 'utf8');

function el(id, name){
  const classes = new Set();
  const node = {
    id: id || '', name: name || 'div', textContent: '', className: '',
    children: [], style: {},
    classList: {
      add(c){ classes.add(c); node.className = [...classes].join(' '); },
      remove(c){ classes.delete(c); node.className = [...classes].join(' '); },
      contains(c){ return classes.has(c); },
    },
    appendChild(c){ node.children.push(c); c.parent = node; return c; },
    addEventListener(){},
    onclick: null,
    onchange: null,
    onkeydown: null,
    onblur: null,
  };
  return node;
}

function loadExtras(opts){
  const store = Object.assign({'thryd_mute': '0'}, opts && opts.store);
  const ids = {
    mute: el('mute', 'button'),
    gifin: el('gifin', 'input'),
    addgif: el('addgif', 'button'),
    user: el('user', 'div'),
    run: el('run', 'div'),
  };
  const body = el('', 'body');
  const listeners = {};
  const spoken = [];
  const audioPlays = [];
  const ls = {
    getItem(k){ return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v){ store[k] = String(v); },
    removeItem(k){ delete store[k]; },
  };
  const fakeIDBRequest = () => {
    const store = {
      put(){},
      delete(){},
      getAll(){ return { result: [] }; },
    };
    const tx = { objectStore(){ return store; }, oncomplete: null, onerror: null };
    const db = { transaction(){ return tx; } };
    const r = { result: db, onupgradeneeded: null, onsuccess: null, onerror: null };
    queueMicrotask(() => { if(r.onsuccess) r.onsuccess(); });
    return r;
  };
  const ctx = {
    console, Date, Math, JSON, Promise, Object, Array, String, Number, Boolean, Error, TypeError, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, URLSearchParams, URL,
    location: { search: (opts && opts.search) || '' },
    document: {
      getElementById(id){ return ids[id] || null; },
      createElement(name){ return el('', name); },
      body,
    },
    localStorage: ls,
    speechSynthesis: {
      speaking: false,
      cancel(){ spoken.push('cancel'); },
      resume(){},
      speak(u){ spoken.push(u); },
      getVoices(){ return []; },
      addEventListener(){},
    },
    SpeechSynthesisUtterance: class { constructor(t){ this.text = t; this.volume = 1; this.lang = ''; this.rate = 1; this.pitch = 1; } },
    Audio: class { constructor(src){ this.src = src; } play(){ audioPlays.push(this.src); return Promise.resolve(); } },
    fetch: async () => ({ ok: false, json: async () => null }),
    indexedDB: { open(){ return fakeIDBRequest(); } },
    addEventListener(type, fn, cap){ (listeners[type] = listeners[type] || []).push(fn); },
    window: {},
    history: { replaceState(){} },
    ImageDecoder: undefined,
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.runInNewContext(extrasSrc, ctx, { filename: 'extras.js' });
  return { ids, body, store, listeners, spoken, audioPlays, ctx };
}

function fire(listeners, type, ev){
  for(const fn of (listeners[type] || [])) fn(ev || { stopPropagation(){}, preventDefault(){} });
}

test('page load starts muted even when a saved setting says unmuted', () => {
  const { ids, body, store } = loadExtras({ store: { thryd_mute: '0' } });
  assert.equal(store.thryd_mute, '0', 'saved unmute preference is left in storage');
  assert.equal(ids.mute.textContent, '🔇 audio off');
  const gate = body.children.find(c => c.id === 'sndgate');
  assert.ok(gate, 'sound gate exists');
  assert.equal(gate.classList.contains('off'), true, 'gate stays hidden while muted at load');
});

test('saved muted preference also starts muted with the off button', () => {
  const { ids } = loadExtras({ store: { thryd_mute: '1' } });
  assert.equal(ids.mute.textContent, '🔇 audio off');
});

test('a first pointerdown does not unmute a muted load', () => {
  const { ids, store, listeners } = loadExtras({ store: { thryd_mute: '0' } });
  fire(listeners, 'pointerdown', { stopPropagation(){} });
  fire(listeners, 'keydown', { stopPropagation(){} });
  assert.equal(ids.mute.textContent, '🔇 audio off');
  assert.equal(store.thryd_mute, '0', 'saved on-preference is not rewritten by a background click');
});

test('the sound button unmutes for the session and still saves the preference', () => {
  const { ids, store } = loadExtras({ store: { thryd_mute: '1' } });
  assert.equal(ids.mute.textContent, '🔇 audio off');
  ids.mute.onclick({ stopPropagation(){} });
  assert.equal(ids.mute.textContent, '🔊 audio on');
  assert.equal(store.thryd_mute, '0');
  ids.mute.onclick({ stopPropagation(){} });
  assert.equal(ids.mute.textContent, '🔇 audio off');
  assert.equal(store.thryd_mute, '1');
});

test('a later page load stays muted after a session unmute was saved', () => {
  const first = loadExtras({ store: { thryd_mute: '0' } });
  first.ids.mute.onclick({ stopPropagation(){} });
  assert.equal(first.store.thryd_mute, '0');
  const second = loadExtras({ store: { thryd_mute: first.store.thryd_mute } });
  assert.equal(second.ids.mute.textContent, '🔇 audio off');
});
