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
  const fetches = [];
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
      hidden: !!(opts && opts.hidden),
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
    fetch: async (u) => { fetches.push(String(u));
      if(opts && opts.songs && /songs\.json/.test(String(u)) && !(opts.failFirst && /africariyoki\.com/.test(String(u)))) return { ok: true, json: async () => ({ songs: opts.songs }) };
      if(opts && opts.songs && /\.lrc$/.test(String(u))) return { ok: true, text: async () => '[00:00.00]first line\n[00:01.00]second line\n' };
      return { ok: false, json: async () => null, text: async () => '' }; },
    indexedDB: { open(){ return fakeIDBRequest(); } },
    addEventListener(type, fn, cap){ (listeners[type] = listeners[type] || []).push(fn); },
    window: {},
    history: { replaceState(){} },
    sessionStorage: opts && opts.session || null,
    navigator: { mediaSession: opts && opts.mediaSession || undefined },
    MediaMetadata: class { constructor(o){ Object.assign(this, o); } },
    ImageDecoder: undefined,
    AudioContext: opts && opts.AC,
  };
  ctx.sessionStorage = ctx.sessionStorage || {
    _s: Object.assign({}, (opts && opts.sessionInit) || {}),
    getItem(k){ return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
    setItem(k, v){ this._s[k] = String(v); },
    removeItem(k){ delete this._s[k]; },
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.runInNewContext(extrasSrc, ctx, { filename: 'extras.js' });
  return { ids, body, store, listeners, spoken, audioPlays, audios, fetches, ctx, contexts: (opts && opts.contexts) || [] };
}

function fire(listeners, type, ev){
  for(const fn of (listeners[type] || [])) fn(ev || { stopPropagation(){}, preventDefault(){} });
}

const STREAM = 'https://stream.audiobookmanager.com/listen/lofi/radio.mp3';
const SONGS = [{ id: 'a1', title: 'Song A', artist: 'Artist A', audio: 'https://storage.googleapis.com/x/music/a1.mp3', lrc: 'lrc/a1.lrc' },
               { id: 'b2', title: 'Song B', artist: 'Artist B', audio: 'https://storage.googleapis.com/x/music/b2.mp3', lrc: null }];
const tick = async (n = 4) => { for(let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };
const sel = L => L.body.children.find(c => c.id === 'sound') || null;

test('default is off: no saved choice, nothing plays, the old button is hidden', async () => {
  const L = loadExtras({ store: { thryd_mute: undefined } });
  await tick();
  assert.equal(L.audioPlays.length, 0);
  assert.equal(L.ids.mute.style.display, 'none');
  const gate = L.body.children.find(c => c.id === 'sndgate');
  assert.ok(gate && gate.classList.contains('off'));
});

test('saved off (thryd_mute 1) never plays, and a background tap does not turn it on', async () => {
  const L = loadExtras({ store: { thryd_mute: '1' } });
  fire(L.listeners, 'pointerdown', { target: {}, stopPropagation(){} });
  await tick();
  assert.equal(L.audioPlays.length, 0);
  assert.equal(L.store.thryd_mute, '1');
});

test('migration: thryd_mute 0 resumes lofi on reload when allowed', async () => {
  const L = loadExtras({ store: { thryd_mute: '0' } });
  await tick();
  assert.equal(L.audioPlays[0], STREAM);
  assert.equal(L.ctx.thrydSound.state().mode, 'lofi');
});

test('saved mode but autoplay blocked: waits, then the next tap anywhere resumes', async () => {
  const L = loadExtras({ store: { thryd_sound: 'lofi' }, block: true });
  await tick();
  const gate = L.body.children.find(c => c.id === 'sndgate');
  assert.equal(gate.classList.contains('off'), false);
  const n = L.audioPlays.length;
  fire(L.listeners, 'pointerdown', { target: {}, stopPropagation(){} });
  assert.equal(L.audioPlays.length, n + 1);
  assert.equal(L.store.thryd_sound, 'lofi', 'a background tap does not rewrite the choice');
});

test('picking lofi plays the ABM stream with its credit; off stops it and drops the connection', async () => {
  const L = loadExtras({ store: { thryd_mute: '1' } });
  await L.ctx.thrydSound.set('lofi'); await tick();
  assert.equal(L.audioPlays[0], STREAM);
  assert.equal(L.store.thryd_sound, 'lofi'); assert.equal(L.store.thryd_mute, '0');
  const credit = L.body.children.find(c => c.id === 'lofi_credit');
  assert.equal(credit.textContent, 'ABM Lofi · CC-licensed'); assert.equal(credit.href, 'https://radio.audiobookmanager.com/');
  await L.ctx.thrydSound.set('off');
  assert.equal(L.audios[0].paused, true); assert.equal(L.audios[0].src, '');
  assert.equal(L.store.thryd_sound, 'off'); assert.equal(L.store.thryd_mute, '1');
  assert.equal(L.audios.length, 1, 'one audio element, never two players');
});

test('picking yoki shuffles africariyoki songs from the API with a song credit and LRC', async () => {
  const L = loadExtras({ store: { thryd_mute: '1' }, songs: SONGS });
  await L.ctx.thrydSound.set('yoki'); await tick(8);
  assert.ok(L.fetches.some(u => u === 'https://www.africariyoki.com/api/songs.json'));
  assert.ok(SONGS.some(s => s.audio === L.audioPlays[0]), 'plays a song from the API');
  const st = L.ctx.thrydSound.state();
  const credit = L.body.children.find(c => c.id === 'lofi_credit');
  assert.ok(/ · africariyoki$/.test(credit.textContent) && credit.href === 'https://www.africariyoki.com/');
  assert.equal(L.store.thryd_sound, 'yoki');
  // ended -> next song
  L.audios[0].ev.ended(); await tick();
  assert.equal(L.audioPlays.length, 2);
  assert.ok(SONGS.some(s => s.audio === L.audioPlays[1]));
});

test('yoki falls back to the second songs URL when the first fails', async () => {
  const L = loadExtras({ store: { thryd_mute: '1' }, songs: SONGS, failFirst: true });
  await L.ctx.thrydSound.set('yoki'); await tick(8);
  assert.ok(L.fetches.some(u => /raw\.githubusercontent\.com/.test(u)));
  assert.ok(SONGS.some(s => s.audio === L.audioPlays[0]));
});

test('spoken lines stay off by default (they would talk over the music)', async () => {
  const L = loadExtras({ store: { thryd_mute: '1' } });
  await L.ctx.thrydSound.set('lofi'); await tick();
  assert.equal(L.spoken.filter(x => typeof x === 'object').length, 0);
});

// ---------- brown noise (Jesuye 15 Nov 2026 5:08 AM ET): generated with Web Audio, no network
function fakeAC({ block = false, worklet = false } = {}, contexts){
  const param = v => ({ value: v, ramps: [], cancelScheduledValues(){}, setValueAtTime(x){ this.value = x; }, linearRampToValueAtTime(x, t){ this.ramps.push([x, t]); this.value = x; } });
  const node = extra => Object.assign({ connected: [], connect(n){ this.connected.push(n); return n; }, disconnect(){} }, extra);
  return class {
    constructor(){ this.state = 'suspended'; this.currentTime = 10; this.destination = node({}); this.nodes = []; this.resumes = 0; contexts.push(this);
      if(worklet) this.audioWorklet = { addModule: async () => { throw new Error('no blob modules here'); } }; }
    createBiquadFilter(){ const n = node({ type: '', frequency: param(350), Q: param(1) }); this.nodes.push(n); return n; }
    createGain(){ const n = node({ gain: param(1) }); this.nodes.push(n); return n; }
    createOscillator(){ const n = node({ frequency: param(440), started: false, start(){ this.started = true; } }); this.nodes.push(n); return n; }
    createScriptProcessor(){ const n = node({ kind: 'script', onaudioprocess: null }); this.nodes.push(n); this.script = n; return n; }
    resume(){ this.resumes++; if(!block) this.state = 'running'; return Promise.resolve(); }
    suspend(){ this.state = 'suspended'; return Promise.resolve(); }
  };
}

test('brown noise: generated locally (no fetch, no audio element), fades in to about Lofi level, credit says generated live', async () => {
  const contexts = [];
  const L = loadExtras({ store: { thryd_mute: '1' }, AC: fakeAC({}, contexts), contexts });
  await L.ctx.thrydSound.set('brown'); await tick(8);
  assert.equal(contexts.length, 1);
  const c = contexts[0], st = L.ctx.thrydSound.state();
  assert.equal(c.state, 'running');
  assert.equal(L.fetches.length, 0, 'no network'); assert.equal(L.audioPlays.length, 0, 'no stream');
  assert.equal(st.mode, 'brown'); assert.equal(st.brown.on, true);
  const lp = c.nodes.find(n => n.type === 'lowpass'); assert.ok(lp && lp.frequency.value <= 800, 'gently low-passed');
  assert.ok(c.nodes.find(n => n.started), 'slow swell LFO running');
  const master = c.nodes.filter(n => n.gain).find(n => n.gain.ramps.length);
  assert.deepEqual(master.gain.ramps.at(-1), [0.32, 11.5], 'fades in over 1.5 s to 0.32');
  // the leaky integrator stays bounded and is not white noise
  const out = new Float32Array(48000), buf = { numberOfChannels: 1, getChannelData: () => out };
  c.script.onaudioprocess({ outputBuffer: buf });
  let mx = 0, diff = 0; for(let i = 1; i < out.length; i++){ mx = Math.max(mx, Math.abs(out[i])); diff += Math.abs(out[i] - out[i - 1]); }
  assert.ok(mx > 0.01 && mx <= 1, 'bounded: ' + mx); assert.ok(diff / out.length < 0.05, 'smooth (brown, not white)');
  const credit = L.body.children.find(x => x.id === 'lofi_credit');
  assert.equal(credit.textContent, 'brown noise · generated live'); assert.equal(credit.className, '');
  assert.equal(L.store.thryd_sound, 'brown'); assert.equal(L.store.thryd_mute, '0');
});

test('brown noise: off fades out over 1.5 s; switching to lofi plays the stream', async () => {
  const contexts = [];
  const L = loadExtras({ store: { thryd_mute: '1' }, AC: fakeAC({ worklet: true }, contexts), contexts });
  await L.ctx.thrydSound.set('brown'); await tick(8);
  assert.ok(contexts[0].script, 'falls back to a ScriptProcessor when the worklet module fails');
  await L.ctx.thrydSound.set('lofi'); await tick();
  const master = contexts[0].nodes.filter(n => n.gain).find(n => n.gain.ramps.length);
  assert.deepEqual(master.gain.ramps.at(-1), [0, 11.5]);
  assert.equal(L.audioPlays.at(-1), STREAM); assert.equal(L.ctx.thrydSound.state().brown.on, false);
  await L.ctx.thrydSound.set('brown'); await tick(8);
  assert.equal(contexts.length, 1, 'one audio context, reused');
  await L.ctx.thrydSound.set('off');
  assert.equal(L.store.thryd_sound, 'off'); assert.equal(L.ctx.thrydSound.state().brown.on, false);
});

test('brown noise: a saved choice the browser holds back waits for a tap, then resumes', async () => {
  const contexts = [];
  const L = loadExtras({ store: { thryd_sound: 'brown' }, AC: fakeAC({ block: true }, contexts), contexts });
  await tick(8);
  const gate = L.body.children.find(c => c.id === 'sndgate');
  assert.equal(L.ctx.thrydSound.state().waitTap, true); assert.equal(gate.classList.contains('off'), false);
  contexts[0].resume = function(){ this.resumes++; this.state = 'running'; return Promise.resolve(); };
  fire(L.listeners, 'pointerdown', { target: {}, stopPropagation(){} }); await tick(8);
  assert.equal(L.ctx.thrydSound.state().brown.on, true); assert.equal(L.ctx.thrydSound.state().waitTap, false);
});

test('brown noise without Web Audio stays quiet and does not retry forever', async () => {
  const L = loadExtras({ store: { thryd_mute: '1' } });
  await L.ctx.thrydSound.set('brown'); await tick(6);
  assert.equal(L.ctx.thrydSound.state().tries, 0); assert.equal(L.ctx.thrydSound.state().brown, null);
});

test('yoki resumes the same song and spot from sessionStorage after a reload', async () => {
  const sessionInit = { thryd_sound_pos: JSON.stringify({ id: 'b2', t: 42, at: Date.now() }) };
  const L = loadExtras({ store: { thryd_sound: 'yoki' }, songs: SONGS, sessionInit });
  await tick(8);
  assert.equal(L.audioPlays[0], SONGS[1].audio, 'resumes song b2, not a fresh shuffle');
  assert.equal(L.audios[0].currentTime, 42);
  const st = L.ctx.thrydSound.state();
  assert.equal(st.song.id, 'b2');
  assert.equal(st.t, 42);
});

test('yoki sets Media Session metadata and play/pause/next handlers', async () => {
  const handlers = {};
  const ms = {
    metadata: null, playbackState: 'none',
    setActionHandler(name, fn){ handlers[name] = fn; },
  };
  const L = loadExtras({ store: { thryd_mute: '1' }, songs: SONGS, mediaSession: ms });
  await L.ctx.thrydSound.set('yoki'); await tick(8);
  assert.ok(ms.metadata && /Song [AB]/.test(ms.metadata.title), ms.metadata && ms.metadata.title);
  assert.equal(ms.metadata.album, '#thryd projector');
  assert.equal(ms.playbackState, 'playing');
  assert.equal(typeof handlers.play, 'function');
  assert.equal(typeof handlers.pause, 'function');
  assert.equal(typeof handlers.nexttrack, 'function');
  const n = L.audioPlays.length;
  handlers.nexttrack(); await tick(4);
  assert.ok(L.audioPlays.length > n, 'lock-screen next skips to another song');
  handlers.pause();
  assert.equal(L.audios[0].paused, true);
});

test('a pagehide while yoki plays stores the current song and time', async () => {
  const L = loadExtras({ store: { thryd_mute: '1' }, songs: SONGS });
  await L.ctx.thrydSound.set('yoki'); await tick(8);
  L.audios[0].currentTime = 17;
  fire(L.listeners, 'pagehide', {});
  const raw = L.ctx.sessionStorage.getItem('thryd_sound_pos');
  const pos = JSON.parse(raw);
  assert.equal(pos.id, L.ctx.thrydSound.state().song.id);
  assert.equal(pos.t, 17);
});
