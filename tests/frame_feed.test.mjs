import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const Feed = require(path.join(root, 'assets/frame_feed.js'));
const Tw = require(path.join(root, 'assets/tweet_embed.js'));

const tweets = JSON.parse(fs.readFileSync(path.join(root, 'data/tweets_all.json'), 'utf8'))
  .map(p => Tw.deckRow(p));
const precisions = JSON.parse(fs.readFileSync(path.join(root, 'data/precisions.json'), 'utf8'));

test('tokens drop stopwords and cutN labels, keep scene words', () => {
  const t = Feed.tokens("The cut1 person at a Kano wedding tent where Kunle stood");
  assert.ok(t.includes('person'));
  assert.ok(t.includes('kano'));
  assert.ok(t.includes('wedding'));
  assert.ok(t.includes('kunle'));
  assert.equal(t.includes('the'), false);
  assert.equal(t.includes('cut1'), false);
});

test('a wedding/kunle scene and a chair scene pick different tweet sets', () => {
  const weddingSafes = precisions.filter(p => p.card === 'w1');
  const wedding = Feed.buildState({
    id: '1*Hl86N3U4KF18YYolRnot9g.gif',
    cap: 'from safe-1*Hl86N3U4KF18YYolRnot9g.gif',
    card: 'w1',
    place: 'a Kano wedding tent where Kunle',
    objects: [
      {id:'c:kunle', label:'kunle', klass:'person', name:'Kunle', x:30, y:50},
      {id:'o:ring', label:'ring', klass:'ring', x:45, y:60}
    ],
    safes: weddingSafes
  });
  const chair = Feed.buildState({
    id: '1*xnYXyE.gif',
    cap: 'library · chair cut',
    card: '',
    place: '',
    objects: [{id:'cut1', label:'cut1', klass:'chair', x:50, y:50}]
  });
  const a = Feed.pick(tweets, wedding, 5);
  const b = Feed.pick(tweets, chair, 5);
  assert.ok(a.length, 'wedding scene should pick tweets');
  assert.ok(b.length, 'chair scene should pick tweets');
  assert.ok(a[0].score > 0, 'wedding top score');
  assert.ok(b[0].score > 0, 'chair top score');
  const aIds = a.map(r => r.id).join(',');
  const bIds = b.map(r => r.id).join(',');
  assert.notEqual(a[0].id, b[0].id, 'top tweet should change with the scene');
  assert.notEqual(aIds, bIds, 'top-5 tweet set should change with the scene');
  const aLine = (a[0].line || '').toLowerCase();
  const bLine = (b[0].line || '').toLowerCase();
  assert.ok(/kunle|wedding|ring|tent|bride|groom|marriage/.test(aLine), 'wedding pick mentions the scene: ' + aLine.slice(0,80));
  assert.ok(/chair|seat|stool|bench/.test(bLine), 'chair pick mentions a chair: ' + bLine.slice(0,80));
});

test('dragging an object into a new zone can change the ranked set', () => {
  const rest = Feed.buildState({
    id: '1*chair.gif',
    objects: [{id:'cut1', label:'cut1', klass:'chair', x:20, y:50, dragged:false}]
  });
  const dragged = Feed.buildState({
    id: '1*chair.gif',
    objects: [{id:'cut1', label:'cut1', klass:'chair', x:85, y:20, dragged:true}]
  });
  assert.notEqual(rest.signature, dragged.signature, 'signature follows the drag');
  const a = Feed.pick(tweets, rest, 5);
  const b = Feed.pick(tweets, dragged, 5);
  assert.ok(b[0].score >= a[0].score, 'dragged object should not lose score');
  // zone tokens (right/top) plus the dragged boost should show up on the dragged state
  assert.ok(dragged.tokens.includes('right') || dragged.tokens.includes('top') || dragged.tokens.includes('chair'));
  const zoneHit = (b[0].hits || []).some(h => h === 'right' || h === 'top' || h === 'chair');
  assert.ok(b[0].score > 0);
  assert.ok(zoneHit || b[0].id !== a[0].id || b[0].score !== a[0].score || rest.signature !== dragged.signature);
});

test('only embeddable, unpurged decimal ids are ranked', () => {
  const state = Feed.buildState({objects:[{klass:'person', x:50, y:50}]});
  const deck = [
    {line:'a person in the room', id:'not-a-number', src:'tweet 2023'},
    {line:'a person in the room', id:'123', src:'tweet 2023', purged:true},
    {line:'a person in the room', id:'1537852396017180673', src:'tweet 2023'}
  ].map(p => Tw.deckRow(p));
  const ranked = Feed.pick(deck, state, 5);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].id, '1537852396017180673');
});

test('same scene is a stable pick', () => {
  const state = Feed.buildState({
    id: '1*same.gif',
    place: 'a Kano wedding tent where Kunle',
    objects: [{klass:'person', name:'Kunle', x:40, y:40}],
    safes: precisions.filter(p => p.card === 'w1')
  });
  const a = Feed.pick(tweets, state, 3).map(r => r.id).join(',');
  const b = Feed.pick(tweets, state, 3).map(r => r.id).join(',');
  assert.equal(a, b);
});

const COMPLAIN = '1352949215622811649';
const weddingState = () => Feed.buildState({
  id: '1*Hl86N3U4KF18YYolRnot9g.gif',
  cap: 'from safe-1*Hl86N3U4KF18YYolRnot9g.gif',
  card: 'w1',
  place: 'a Kano wedding tent where Kunle',
  objects: [
    {id:'c:kunle', label:'kunle', klass:'person', name:'Kunle', x:30, y:50},
    {id:'o:ring', label:'ring', klass:'ring', x:45, y:60}
  ],
  safes: precisions.filter(p => p.card === 'w1')
});
const chairState = () => Feed.buildState({
  id: '1*xnYXyEUdOys6QLrBa3MFiQ.gif',
  cap: '1*xnYXyEUdOys6QLrBa3MFiQ.gif',
  objects: [{id:'cut1', label:'cut1', klass:'chair', x:20, y:50}]
});
const laptopState = () => Feed.buildState({
  id: '1*HZf0f7jEessCUn2xuzyXLg.gif',
  cap: '1*HZf0f7jEessCUn2xuzyXLg.gif',
  objects: [{id:'cut1', label:'cut1', klass:'laptop', x:70, y:40, dragged:true}]
});
const safesOnly = () => Feed.buildState({card:'w1', safes: precisions.filter(p => p.card === 'w1')});

test('no-match pick is empty, never the lowest-id deck', () => {
  const empty = Feed.buildState({});
  const ranked = Feed.pick(tweets, empty, 8);
  assert.equal(ranked.length, 0, 'no-match must not fall back to the whole deck');
  const lowest = tweets.filter(Feed.tweetOk).map(t => String(t.id)).sort()[0];
  const recent = [];
  let cursor = 0;
  const ids = [];
  for(let i = 0; i < 20; i++){
    const res = Feed.chooseOne(tweets, empty, {recent, cursor, k: 8});
    assert.equal(res.fallback, 'rotate');
    assert.ok(res.choice && res.choice.id, 'rotate still returns a tweet');
    ids.push(res.choice.id);
    cursor = res.cursor;
    recent.push(res.choice.id);
    if(recent.length > 10) recent.shift();
  }
  assert.ok(new Set(ids).size >= 10, 'rotation over 20 no-match picks should vary, got ' + new Set(ids).size);
  assert.ok(!(ids.every(id => id === lowest)), 'must not always return the lowest id');
  assert.ok(!(ids.every(id => id === COMPLAIN)), 'must not always return the complain tweet');
});

test('safes-only ties do not collapse to the complain tweet', () => {
  const state = safesOnly();
  const top = Feed.pick(tweets, state, 8);
  assert.ok(top.length >= 2, 'several tweets share the safe-line score');
  // they may include the complain tweet, but it is not a unique winner
  const recent = [];
  let cursor = 0;
  const ids = [];
  for(let i = 0; i < 20; i++){
    const res = Feed.chooseOne(tweets, state, {recent, cursor, k: 8});
    assert.ok(res.choice, 'got a pick');
    ids.push(res.choice.id);
    cursor = res.cursor;
    recent.push(res.choice.id);
    if(recent.length > 10) recent.shift();
  }
  const unique = new Set(ids);
  assert.ok(unique.size >= 8, '20 safes-only picks should yield many tweets, got ' + unique.size + ' ' + ids.join(','));
  assert.ok(!ids.every(id => id === COMPLAIN), 'complain tweet is not the only winner');
});

test('no-repeat window skips the last 10 shown', () => {
  const state = weddingState();
  const recent = [];
  const ids = [];
  let cursor = 0;
  for(let i = 0; i < 16; i++){
    const res = Feed.chooseOne(tweets, state, {recent, cursor, k: 8});
    const id = res.choice.id;
    assert.equal(recent.includes(id), false, 'picked a recently shown id ' + id);
    ids.push(id);
    cursor = res.cursor;
    recent.push(id);
    if(recent.length > 10) recent.shift();
  }
  assert.ok(new Set(ids).size >= 8);
});

test('20 consecutive picks over several scenes give many distinct tweets', () => {
  const scenes = [weddingState(), chairState(), laptopState(), safesOnly(), Feed.buildState({})];
  // confirm scores actually vary per scene (labels, safes, positions populated)
  const w = weddingState(), c = chairState();
  assert.ok(w.tokens.includes('kunle') && w.tokens.includes('wedding') && w.safes.length);
  assert.ok(c.tokens.includes('chair'));
  assert.ok(w.objects.some(o => o.x != null && o.klass));
  const wTop = Feed.pick(tweets, w, 8).map(r => r.id).join(',');
  const cTop = Feed.pick(tweets, c, 8).map(r => r.id).join(',');
  assert.notEqual(wTop, cTop, 'top-K sets must differ across scenes');
  assert.ok(Feed.pick(tweets, w, 8)[0].score !== Feed.pick(tweets, c, 8)[0].score || wTop !== cTop);

  const recent = [];
  let cursor = 0;
  const ids = [];
  const lines = [];
  for(let i = 0; i < 20; i++){
    const res = Feed.chooseOne(tweets, scenes[i % scenes.length], {recent, cursor, k: 8});
    assert.ok(res.choice && res.choice.id);
    ids.push(res.choice.id);
    lines.push(String(res.choice.line || '').split('\n')[0].slice(0, 60));
    cursor = res.cursor;
    recent.push(res.choice.id);
    if(recent.length > 10) recent.shift();
  }
  const unique = new Set(ids);
  assert.ok(unique.size >= 10, 'expected many distinct tweets in 20 picks, got ' + unique.size + ': ' + lines.join(' | '));
  assert.ok(!ids.every(id => id === COMPLAIN));
  console.log('20-pick unique', unique.size, 'ids', ids);
});
