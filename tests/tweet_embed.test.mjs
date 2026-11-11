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
      name, id: '', className: '', href: '', textContent: '', children: [],
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
  return {doc, bubble, txt};
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
  assert.equal(Tw.EMBED_WIDTH, 340);
});

test('no id and a purged id leave the archive text and do not load the script', async () => {
  const h = host();
  const api = Tw.create({document: h.doc, timeoutMs: 50, readMs: 1000});
  const none = await api.mount(h.bubble, {line: 'archive line'}, 4000);
  assert.equal(none.reason, 'no_id');
  assert.equal(h.txt.textContent, 'archive line');
  assert.equal(h.bubble.classList.contains('embed-on'), false);
  assert.equal(h.bubble.classList.contains('embed-wait'), false);
  assert.equal(api.loadCount(), 0);
  const purged = await api.mount(h.bubble, {id: '1537852396017180673', purged: true, line: 'archive line'}, 4000);
  assert.equal(purged.reason, 'purged');
  assert.equal(h.bubble.querySelector('.twlink').textContent, 'https://x.com/notnotnotnotyn/status/1537852396017180673');
  assert.equal(h.bubble.classList.contains('embed-on'), false);
  assert.equal(h.bubble.classList.contains('embed-wait'), false);
  assert.equal(h.txt.textContent, 'archive line');
  assert.equal(api.loadCount(), 0);
});

test('a failed widget and a reply after close leave the archive line', async () => {
  const h = host();
  const tw = {widgets: {createTweet(id, target){
    assert.equal(typeof id, 'string');
    assert.equal(target.name, 'div');
    return Promise.resolve(null);
  }}};
  const api = Tw.create({document: h.doc, twttr: tw, timeoutMs: 1000, readMs: 5000});
  const failed = await api.mount(h.bubble, {id: '20'}, 4000);
  assert.equal(failed.reason, 'unavailable');
  assert.equal(h.txt.textContent, 'archive line');
  assert.equal(h.bubble.classList.contains('embed-on'), false);
  assert.equal(h.bubble.classList.contains('embed-wait'), false);
  let late = null;
  const hanging = {widgets: {createTweet(){ return new Promise(function(resolve){ late = resolve; }); }}};
  const api2 = Tw.create({document: h.doc, twttr: hanging, timeoutMs: 1000, readMs: 5000});
  const opened = api2.mount(h.bubble, {id: '1628307842821234689'}, 4000);
  assert.equal(h.bubble.classList.contains('embed-wait'), true);
  assert.equal(h.bubble.classList.contains('embed-on'), false);
  await new Promise(function(resolve){ setTimeout(resolve, 0); });
  api2.dismiss(h.bubble);
  late(h.doc.createElement('iframe'));
  const closed = await opened;
  assert.equal(closed.reason, 'stale');
  assert.equal(h.bubble.classList.contains('embed-on'), false);
  assert.equal(h.bubble.classList.contains('embed-wait'), false);
  assert.equal(h.bubble.querySelector('.twembed').children.length, 0);
  assert.equal(h.txt.textContent, 'archive line');
});

test('the widgets script is inserted once', async () => {
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
  assert.equal(h.txt.textContent, 'archive line');
  assert.equal(h.bubble.classList.contains('embed-on'), false);
  assert.equal(h.bubble.classList.contains('embed-wait'), false);
});

test('a rendered post hides the archive line and uses a fixed width', async () => {
  const h = host();
  let calls = 0;
  const tw = {ready(fn){ fn(tw); }, widgets: {createTweet(id, target, opts){
    calls += 1;
    assert.equal(opts.dnt, true);
    assert.equal(opts.conversation, 'none');
    assert.equal(opts.cards, 'hidden');
    assert.equal(opts.width, 340);
    const frame = h.doc.createElement('iframe');
    target.appendChild(frame);
    return Promise.resolve(frame);
  }}};
  const api = Tw.create({document: h.doc, twttr: tw, timeoutMs: 1000, readMs: 5000});
  const pending = api.mount(h.bubble, {id: '1450727828719390723'}, 4000);
  assert.equal(h.bubble.classList.contains('embed-wait'), true);
  assert.equal(h.bubble.classList.contains('embed-on'), false);
  assert.equal(h.txt.textContent, 'archive line');
  const a = await pending;
  const b = await api.mount(h.bubble, {id: '1450727828719390723'}, 4000);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(calls, 2);
  assert.equal(api.loadCount(), 0);
  assert.equal(h.txt.textContent, 'archive line');
  assert.equal(h.bubble.classList.contains('embed-on'), true);
  assert.equal(h.bubble.classList.contains('embed-wait'), false);
});

test('the bubble box is fixed and hides the archive line while an embed is up', () => {
  const css = fs.readFileSync(path.join(root, 'assets/projector.css'), 'utf8');
  assert.match(css, /\.bubble\.embed-wait,\.bubble\.embed-on\{[^}]*width:min\(340px,calc\(100vw - 24px\)\)/);
  assert.match(css, /\.bubble\.embed-wait,\.bubble\.embed-on\{[^}]*height:min\(300px,calc\(100vh - 24px\)\)/);
  assert.match(css, /\.bubble\.embed-wait,\.bubble\.embed-on\{[^}]*overflow:hidden/);
  assert.match(css, /\.bubble\.embed-wait \.txt,\.bubble\.embed-on \.txt\{display:none\}/);
  assert.match(css, /\.bubble\.embed-wait \.twembed,\.bubble\.embed-on \.twembed\{[^}]*overflow:auto/);
  assert.doesNotMatch(css, /\.bubble\.embed-on\{max-width:min\(280px,92vw\)/);
});
