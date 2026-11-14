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
  const audios = [];
  const ls = {
    getItem(k){ return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v){ store[k] = String(v); },
    removeItem(k){ delete store[k]; },
  };
  const fakeIDBRequest = () => {
    const storeObj = {
      put(){},
      delete(){},
      getAll(){ return { result: [] }; },
    };
    const tx = { objectStore(){ return storeObj; }, oncomplete: null, onerror: null };
    const db = { transaction(){ return tx; } };
    const r = { result: db, onupgradeneeded: null, onsuccess: null, onerror: null };
    return r;
  };
  const ctx = {
    console, Date, Math, JSON, Promise, Object, Array, String, Number, Boolean, Error, TypeError,
    // Do not schedule real timers: extras starts a speech loop that would keep the test process alive.
    setTimeout(){ return 0; },
    clearTimeout(){},
    setInterval(){ return 0; },
    clearInterval(){},
    queueMicrotask(){},
    URLSearchParams, URL,
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
    Audio: class { constructor(src){ this.src = src || ''; this.paused = true; this.ev = {}; this.currentTime = 0; audios.push(this); }
      play(){ audioPlays.push(this.src); if(opts && opts.block){ const e = new Error('blocked'); e.name = 'NotAllowedError'; return Promise.reject(e); } this.paused = false; return Promise.resolve(); }
      pause(){ this.paused = true; } load(){} setAttribute(){} removeAttribute(k){ if(k === 'src') this.src = ''; } addEventListener(t, f){ this.ev[t] = f; } },
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
  return { ids, body, store, listeners, spoken, audioPlays, audios, ctx };
}

function fire(listeners, type, ev){
  for(const fn of (listeners[type] || [])) fn(ev || { stopPropagation(){}, preventDefault(){} });
}

const STREAM = 'https://stream.audiobookmanager.com/listen/lofi/radio.mp3';
const tick = () => new Promise(r => setImmediate(r));

test('page load shows audio off until the stream really plays, and saved off never plays', async () => {
  const { ids, body, audioPlays } = loadExtras({ store: { thryd_mute: '1' } });
  assert.equal(ids.mute.textContent, '🔇 audio off');
  await tick();
  assert.equal(audioPlays.length, 0, 'saved off: nothing plays');
  const gate = body.children.find(c => c.id === 'sndgate');
  assert.ok(gate && gate.classList.contains('off'), 'gate hidden');
});

test('no saved choice means sound stays off (default off)', async () => {
  const { ids, audioPlays } = loadExtras({ store: { thryd_mute: undefined } });
  await tick(); assert.equal(audioPlays.length, 0);
  assert.equal(ids.mute.textContent, '🔇 audio off');
});

test('saved on: a reload resumes the lofi stream when the browser allows it', async () => {
  const { ids, audioPlays } = loadExtras({ store: { thryd_mute: '0' } });
  assert.equal(ids.mute.textContent, '🔇 audio off', 'off until it plays');
  await tick(); await tick();
  assert.equal(audioPlays[0], STREAM);
  assert.equal(ids.mute.textContent, '🔊 audio on');
});

test('saved on but autoplay blocked: stays off, then the next tap anywhere resumes', async () => {
  const L = loadExtras({ store: { thryd_mute: '0' }, block: true });
  await tick(); await tick();
  assert.equal(L.ids.mute.textContent, '🔇 audio off');
  const gate = L.body.children.find(c => c.id === 'sndgate');
  assert.equal(gate.classList.contains('off'), false, 'a quiet hint to tap');
  const n = L.audioPlays.length;
  fire(L.listeners, 'pointerdown', { target: {}, stopPropagation(){} });
  assert.equal(L.audioPlays.length, n + 1, 'the tap retries play');
  assert.equal(L.store.thryd_mute, '0', 'a background tap does not rewrite the saved choice');
});

test('a background tap never turns on sound that was saved off', async () => {
  const { ids, store, listeners, audioPlays } = loadExtras({ store: { thryd_mute: '1' } });
  fire(listeners, 'pointerdown', { target: {}, stopPropagation(){} });
  fire(listeners, 'keydown', { target: {}, stopPropagation(){} });
  await tick();
  assert.equal(audioPlays.length, 0);
  assert.equal(ids.mute.textContent, '🔇 audio off');
  assert.equal(store.thryd_mute, '1');
});

test('the sound button plays the ABM Lofi stream, saves the choice, and stops it', async () => {
  const { ids, store, audios, audioPlays, body } = loadExtras({ store: { thryd_mute: '1' } });
  ids.mute.onclick({ stopPropagation(){} });
  assert.equal(ids.mute.textContent, '🔊 audio on');
  assert.equal(store.thryd_mute, '0');
  assert.equal(audioPlays[0], STREAM);
  await tick();
  const credit = body.children.find(c => c.id === 'lofi_credit');
  assert.ok(credit && credit.textContent === 'ABM Lofi · CC-licensed' && credit.href === 'https://radio.audiobookmanager.com/');
  ids.mute.onclick({ stopPropagation(){} });
  assert.equal(ids.mute.textContent, '🔇 audio off');
  assert.equal(store.thryd_mute, '1');
  assert.equal(audios[0].paused, true);
  assert.equal(audios[0].src, '', 'the stream connection is dropped');
  assert.equal(audios.length, 1, 'one audio element, never two streams');
});

test('spoken lines stay off by default (they would talk over the music)', async () => {
  const { ids, spoken } = loadExtras({ store: { thryd_mute: '1' } });
  ids.mute.onclick({ stopPropagation(){} });
  await tick();
  assert.equal(spoken.filter(x => typeof x === 'object').length, 0);
});
