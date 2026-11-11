import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const Tw = require(path.join(root, 'assets/tweet_embed.js'));

function host(){
  const nodes = [];
  function el(name){
    const node = {
      name, id: '', className: '', href: '', textContent: '', hidden: false, children: [],
      classList: {
        _s: new Set(),
        add(c){ this._s.add(c); },
        remove(c){ this._s.delete(c); },
        contains(c){ return this._s.has(c); }
      },
      appendChild(c){ c.parentNode = node; node.children.push(c); return c; },
      get firstChild(){ return node.children[0] || null; },
      removeChild(c){ node.children = node.children.filter(x => x !== c); c.parentNode = null; },
      querySelector(sel){ return node.children.find(c => c.className === sel.slice(1)) || null; },
      addEventListener(){},
      remove(){ if(node.parentNode) node.parentNode.removeChild(node); }
    };
    nodes.push(node);
    return node;
  }
  const bubble = el('div');
  bubble.className = 'bubble';
  const who = el('div');
  who.className = 'who';
  who.textContent = 'speaker · tweet 2022';
  bubble.appendChild(who);
  const txt = el('div');
  txt.className = 'txt';
  txt.textContent = 'archive line';
  bubble.appendChild(txt);
  const doc = {
    head: el('head'),
    body: el('body'),
    getElementById(id){ return nodes.find(n => n.id === id) || null; },
    createElement: el
  };
  return {doc, bubble, who, txt};
}

function chromeHidden(h, hidden){
  assert.equal(h.who.hidden, hidden);
  assert.equal(h.txt.hidden, hidden);
}


function isHidden(h){
  assert.equal(h.bubble.classList.contains('on'), false, 'bubble must be hidden');
  assert.equal(h.bubble.classList.contains('embed-on'), false);
  assert.equal(h.bubble.classList.contains('embed-wait'), false);
  chromeHidden(h, true);
  assert.equal(h.who.textContent, '');
  assert.equal(h.txt.textContent, '');
  assert.equal(h.bubble.querySelector('.twlink'), null);
}

test('deck rows keep the archive line and only a decimal string id', () => {
  const row = Tw.deckRow({line: 'exact', src: 'tweet 2022', id: '1537852396017180673', purged: false, extra: 1});
  assert.equal(row.line, 'exact');
  assert.equal(row.src, 'tweet 2022');
  assert.equal(row.move, false);
  assert.equal(row.id, '1537852396017180673');
  assert.equal(typeof row.id, 'string');
  assert.equal(row.purged, undefined);
  const plain = Tw.deckRow({line: 'no id', src: 'tweet 2021'});
  assert.equal(plain.id, undefined);
  assert.equal(Tw.deckRow({line: 'x', src: 'tweet 2020', id: 20}).id, undefined);
  assert.equal(Tw.postUrl('20'), 'https://x.com/notnotnotnotyn/status/20');
  assert.equal(Tw.EMBED_WIDTH, 250);
});

test('no id and a purged id hide the bubble entirely and do not load the script', async () => {
  const h = host();
  h.bubble.classList.add('on');
  const api = Tw.create({document: h.doc, timeoutMs: 50, readMs: 1000});
  const none = await api.mount(h.bubble, {line: 'archive line'}, 4000);
  assert.equal(none.reason, 'no_id');
  isHidden(h);
  assert.equal(api.loadCount(), 0);
  h.bubble.classList.add('on');
  const purged = await api.mount(h.bubble, {id: '1537852396017180673', purged: true, line: 'archive line'}, 4000);
  assert.equal(purged.reason, 'purged');
  isHidden(h);
  assert.equal(api.loadCount(), 0);
});

test('a failed widget and a reply after close hide the bubble, no archive fallback', async () => {
  const h = host();
  const tw = {widgets: {createTweet(id, target){
    assert.equal(typeof id, 'string');
    assert.equal(target.name, 'div');
    return Promise.resolve(null);
  }}};
  const api = Tw.create({document: h.doc, twttr: tw, timeoutMs: 1000, readMs: 5000});
  const failed = await api.mount(h.bubble, {id: '20'}, 4000);
  assert.equal(failed.reason, 'unavailable');
  isHidden(h);
  let late = null;
  const hanging = {widgets: {createTweet(){ return new Promise(function(resolve){ late = resolve; }); }}};
  const api2 = Tw.create({document: h.doc, twttr: hanging, timeoutMs: 1000, readMs: 5000});
  const opened = api2.mount(h.bubble, {id: '1628307842821234689'}, 4000);
  assert.equal(h.bubble.classList.contains('embed-wait'), true);
  assert.equal(h.bubble.classList.contains('on'), false, 'not visible while loading');
  chromeHidden(h, true);
  await new Promise(function(resolve){ setTimeout(resolve, 0); });
  api2.dismiss(h.bubble);
  late(h.doc.createElement('iframe'));
  const closed = await opened;
  assert.equal(closed.reason, 'stale');
  assert.equal(h.bubble.querySelector('.twembed').children.length, 0);
  isHidden(h);
});

test('the widgets script is inserted once and a timeout hides the bubble', async () => {
  const h = host();
  const api = Tw.create({document: h.doc, timeoutMs: 20, readMs: 100});
  const first = api.mount(h.bubble, {id: '20'}, 4000);
  const second = api.mount(h.bubble, {id: '21'}, 4000);
  assert.equal(api.loadCount(), 1);
  assert.equal(h.doc.getElementById('twitter-wjs').src, Tw.WIDGETS);
  const a = await first;
  const b = await second;
  assert.equal(a.reason, 'stale');
  assert.equal(b.reason, 'timeout');
  isHidden(h);
});

test('default embed timeout is about 15s', () => {
  const src = fs.readFileSync(path.join(root, 'assets/tweet_embed.js'), 'utf8');
  assert.match(src, /deps\.timeoutMs == null \? 15000 :/);
});

test('a rendered post shows only the embed at width 250', async () => {
  const h = host();
  let calls = 0;
  const tw = {ready(fn){ fn(tw); }, widgets: {createTweet(id, target, opts){
    calls += 1;
    assert.equal(opts.dnt, true);
    assert.equal(opts.conversation, 'none');
    assert.equal(opts.cards, 'hidden');
    assert.equal(opts.width, 250);
    const frame = h.doc.createElement('iframe');
    target.appendChild(frame);
    return Promise.resolve(frame);
  }}};
  const api = Tw.create({document: h.doc, twttr: tw, timeoutMs: 1000, readMs: 5000});
  const pending = api.mount(h.bubble, {id: '1450727828719390723', line: 'archive line'}, 4000);
  assert.equal(h.bubble.classList.contains('embed-wait'), true);
  assert.equal(h.bubble.classList.contains('on'), false);
  chromeHidden(h, true);
  assert.equal(h.txt.textContent, '');
  assert.equal(h.who.textContent, '');
  const a = await pending;
  assert.equal(a.ok, true);
  assert.equal(h.bubble.classList.contains('on'), true);
  assert.equal(h.bubble.classList.contains('embed-on'), true);
  chromeHidden(h, true);
  assert.equal(h.txt.textContent, '');
  assert.equal(h.who.textContent, '');
  assert.equal(h.bubble.querySelector('.twlink'), null);
  const b = await api.mount(h.bubble, {id: '1450727828719390723'}, 4000);
  assert.equal(b.ok, true);
  assert.equal(calls, 2);
  assert.equal(api.loadCount(), 0);
  // a later failure replaces the embed with nothing (hidden), never with text
  const failApi = Tw.create({document: h.doc, twttr: {widgets:{createTweet(){ return Promise.resolve(null); }}}, timeoutMs: 1000, readMs: 5000});
  const fallback = await failApi.mount(h.bubble, {id: '20', line: 'archive line'}, 4000);
  assert.equal(fallback.ok, false);
  assert.equal(h.bubble.querySelector('.twembed').children.length, 0);
  isHidden(h);
});

test('the bubble is a small fixed 160x132 box in every state and never shows label, line or link', () => {
  const css = fs.readFileSync(path.join(root, 'assets/projector.css'), 'utf8');
  const base = css.match(/\.bubble\{[^}]*\}/)[0];
  for (const r of [/width:160px/, /height:132px/, /max-width:160px/, /max-height:132px/, /overflow:hidden/]) assert.match(base, r);
  assert.doesNotMatch(base, /\d(vw|vh)/, 'no viewport units on the bubble box, so full screen cannot grow it');
  assert.match(css, /\.bubble\.on\{opacity:\.82/);
  assert.match(css, /:fullscreen \.bubble[^{]*\{width:160px!important;height:132px!important/);
  assert.match(css, /\.bubble \.who,\.bubble \.txt,\.bubble \.twlink,\.bubble > :not\(\.twembed\)\{display:none!important\}/);
  assert.match(css, /\.bubble \.twembed\{[^}]*zoom:\.6;width:250px;height:203px;overflow-x:hidden;overflow-y:auto/);
  assert.doesNotMatch(css, /embed-wait,\.bubble\.embed-on\{width:min\(340px/);
});

test('projector keeps the popup out of the scene center half', () => {
  const js = fs.readFileSync(path.join(root, 'assets/projector.js'), 'utf8');
  assert.match(js, /const BW=160,BH=132,M=12;/);
  assert.match(js, /innerWidth\*\.75\+BW/);
  assert.match(js, /innerWidth\*\.25-BW/);
});

test('projector say() never writes the speaker label or archive line', () => {
  const js = fs.readFileSync(path.join(root, 'assets/projector.js'), 'utf8');
  const say = js.slice(js.indexOf('function say('), js.indexOf('const everyS='));
  assert.doesNotMatch(say, /\.who'\)\.textContent=who/);
  assert.doesNotMatch(say, /\.txt'\)\.textContent=L\.line/);
  assert.match(say, /\.who'\)\.textContent=''/);
  assert.match(say, /\.txt'\)\.textContent=''/);
  assert.doesNotMatch(say, /classList\.add\('on'\)/, 'only tweet_embed shows the bubble, after the embed renders');
});
