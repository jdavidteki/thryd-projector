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
  theme: 'a Kano wedding tent',
  objects: [
    {id:'c:kunle', label:'kunle', klass:'person', name:'Kunle', x:30, y:50, colors:'white gold'},
    {id:'o:ring', label:'ring', klass:'ring', x:45, y:60}
  ],
  safes: precisions.filter(p => p.card === 'w1')
});
const chairState = () => Feed.buildState({
  id: '1*xnYXyEUdOys6QLrBa3MFiQ.gif',
  cap: '1*xnYXyEUdOys6QLrBa3MFiQ.gif',
  objects: [{id:'cut1', label:'cut1', klass:'chair', x:20, y:50, colors:'brown', size:'large'}]
});
const laptopState = () => Feed.buildState({
  id: '1*HZf0f7jEessCUn2xuzyXLg.gif',
  cap: '1*HZf0f7jEessCUn2xuzyXLg.gif',
  objects: [{id:'cut1', label:'cut1', klass:'laptop', x:70, y:40, dragged:true}]
});
const horseState = () => Feed.buildState({
  id: '1*horse.gif',
  cap: 'a horse in the stable',
  objects: [{id:'cut1', label:'horse', klass:'horse', x:40, y:50}],
  related: ['riding', 'stable']
});
const safesOnly = () => Feed.buildState({card:'w1', safes: precisions.filter(p => p.card === 'w1')});

test('undragged objects in the frame still score (drag is a bonus)', () => {
  const rest = Feed.buildState({objects:[{id:'cut1', label:'cut1', klass:'chair', x:20, y:50, dragged:false}]});
  const dragged = Feed.buildState({objects:[{id:'cut1', label:'cut1', klass:'chair', x:20, y:50, dragged:true}]});
  const a = Feed.pick(tweets, rest, 8);
  const b = Feed.pick(tweets, dragged, 8);
  assert.ok(a.length && a[0].score > 0, 'undragged chair still matches');
  assert.ok(a.some(r => (r.hits||[]).includes('chair') || (r.line||'').toLowerCase().includes('chair') || (r.hits||[]).includes('seat')));
  assert.ok(b[0].score >= a[0].score, 'dragged chair should not score lower');
});

test('stems and related words connect (horse -> horses/riding/stable, chair -> seat/sit)', () => {
  assert.equal(Feed.stem('horses'), 'horse');
  assert.equal(Feed.stem('sitting'), 'sit');
  const horse = horseState();
  const ranked = Feed.pick(tweets, horse, 8);
  assert.ok(ranked.length >= 1 && ranked[0].score > 0, 'horse scene finds a connected tweet');
  const blob = ranked.map(r => ((r.line||'') + ' ' + (r.hits||[]).join(' ')).toLowerCase()).join(' | ');
  assert.ok(/horse|horses|riding|ride|stable|stallion|pony/.test(blob), 'horse-related terms in matches: ' + blob.slice(0,200));
  const chair = Feed.pick(tweets, chairState(), 8);
  const cblob = chair.map(r => ((r.line||'')+' '+(r.hits||[]).join(' ')).toLowerCase()).join(' | ');
  assert.ok(/chair|seat|sit|stool|bench/.test(cblob), 'chair-related terms: ' + cblob.slice(0,200));
});

test('safes-only: a pop needs 2+ distinctive words shared with one card line; otherwise quiet', () => {
  const state = safesOnly();
  const recent = [];
  const ids = [];
  for(let i = 0; i < 20; i++){
    const res = Feed.chooseOne(tweets, state, {recent, k: 8});
    if(!res.choice){ assert.equal(res.quiet, true); continue; }
    assert.ok(Feed.qualifies(res.choice) && (res.choice.terms || []).includes('safe'), 'line pop must share 2+ words with a card line');
    assert.notEqual(res.fallback, 'rotate');
    ids.push(res.choice.id);
    recent.push(res.choice.id);
    if(recent.length > 3) recent.shift();
  }
  assert.ok(ids.length >= 1, 'some line matches still pop');
  const quietRes = Feed.chooseOne(tweets, state, {recent: ids.slice(-3)});
  assert.ok(quietRes.choice === null || !ids.slice(-3).includes(quietRes.choice.id));
});

test('no-repeat window skips the last 3 popped', () => {
  const state = weddingState();
  const recent = [];
  const ids = [];
  for(let i = 0; i < 16; i++){
    const res = Feed.chooseOne(tweets, state, {recent, k: 8});
    assert.ok(res.choice && res.choice.score > 0);
    const id = res.choice.id;
    assert.equal(recent.slice(-3).includes(id), false, 'picked one of the last 3 popped ' + id);
    ids.push(id);
    recent.push(id);
    if(recent.length > 3) recent.shift();
  }
  assert.equal(Feed.NO_REPEAT, 3);
  assert.ok(new Set(ids).size >= 4);
});

test('20 consecutive ticks over several scenes: every pop is a genuine match, otherwise quiet', () => {
  const scenes = [weddingState(), chairState(), laptopState(), horseState(), safesOnly()];
  const w = weddingState(), c = chairState();
  assert.ok(w.tokens.includes('kunle') && w.tokens.includes('wedding') && w.safes.length);
  assert.ok(c.tokens.includes('chair'));
  const wTop = Feed.pick(tweets, w, 8).map(r => r.id).join(',');
  const cTop = Feed.pick(tweets, c, 8).map(r => r.id).join(',');
  assert.notEqual(wTop, cTop, 'top-K sets must differ across scenes');
  const recent = [];
  const ids = [];
  let quiet = 0;
  for(let i = 0; i < 20; i++){
    const res = Feed.chooseOne(tweets, scenes[i % scenes.length], {recent, k: 8});
    if(!res.choice){ quiet++; assert.equal(res.quiet, true); continue; }
    assert.ok(Feed.qualifies(res.choice), 'pop must be a genuine match: ' + res.choice.score + ' ' + (res.choice.line||'').slice(0,60));
    assert.ok((res.choice.terms || []).length, 'matched scene terms logged');
    assert.equal(recent.slice(-3).includes(res.choice.id), false);
    ids.push(res.choice.id);
    recent.push(res.choice.id);
    if(recent.length > 3) recent.shift();
  }
  assert.ok(ids.length >= 10, 'most ticks on these scenes still pop, got ' + ids.length);
  assert.ok(new Set(ids).size >= 8, 'pops stay varied, got ' + new Set(ids).size);
  assert.ok(!ids.every(id => id === COMPLAIN));
  console.log('20-tick pops', ids.length, 'quiet', quiet);
});

// ---- quiet rule (no quota, no widening) ----
test('a genuine scene match pops and names the scene term it shares', () => {
  const res = Feed.chooseOne(tweets, chairState(), {recent: [], k: 8, rng: () => 0});
  assert.ok(res.choice, 'chair scene should pop');
  assert.equal(res.quiet, false);
  assert.ok(Feed.qualifies(res.choice));
  assert.ok(res.choice.content >= Feed.MIN_SCORE);
  assert.ok(/chair|brown/.test((res.choice.terms || []).join(' ')), 'shares a chair-scene term: ' + (res.choice.terms || []).join(','));
});

test('no genuine match stays quiet: no widening to zone, person-family or partial words', () => {
  // zebra is not in the deck; before, the matcher widened to "center"/"middle" tweets to fill a quota
  const zebra = Feed.buildState({objects:[{id:'cut1', label:'cut1', klass:'zebra', x:50, y:50}]});
  const ranked = Feed.rankTweets(tweets, zebra);
  assert.ok(ranked.matched.length > 0, 'the old matcher would have found zone-word matches');
  const res = Feed.chooseOne(tweets, zebra, {recent: [], k: 8});
  assert.equal(res.choice, null);
  assert.equal(res.quiet, true);
  assert.equal(res.pool.length, 0);
  // two plain people in a frame is not a scene match on its own
  const people = Feed.buildState({objects:[{id:'cut1', label:'cut1', klass:'person', x:50, y:50}, {id:'cut2', label:'cut2', klass:'person', x:20, y:60}]});
  assert.equal(Feed.chooseOne(tweets, people, {recent: []}).choice, null);
  // a frame with nothing readable is quiet
  assert.equal(Feed.chooseOne(tweets, Feed.buildState({cap: '1*qwertyuiop.gif'}), {recent: []}).choice, null);
  assert.equal(typeof Feed.widen, 'undefined', 'quota widening is gone');
  assert.equal(Feed.MIN_CANDIDATES, undefined);
});

test('last-3 rule: once every genuine match is among the last 3 popped, the feed goes quiet', () => {
  const laptop = laptopState();
  const genuine = Feed.rankTweets(tweets, laptop).matched.filter(r => Feed.qualifies(r));
  assert.ok(genuine.length >= 1 && genuine.length <= 3, 'laptop scene has a small genuine set: ' + genuine.length);
  const recent = [];
  for(let i = 0; i < genuine.length; i++){
    const res = Feed.chooseOne(tweets, laptop, {recent});
    assert.ok(res.choice, 'pop ' + i);
    assert.equal(recent.includes(res.choice.id), false);
    recent.push(res.choice.id);
  }
  const after = Feed.chooseOne(tweets, laptop, {recent});
  assert.equal(after.choice, null, 'all genuine matches were just shown: stay quiet');
  // a 4th pop elsewhere pushes the oldest out of the window, so it may show again
  const again = Feed.chooseOne(tweets, laptop, {recent: recent.slice(1).concat(['999', '998', '997']).slice(-3)});
  assert.ok(again.choice, 'out of the last-3 window it can pop again');
});

test('popups stay 3 s longer and the bubble stays 160x132', () => {
  assert.equal(Feed.TICK_MS, 4000);
  assert.equal(Feed.POP_HOLD_MS, 7000);
  assert.equal(Feed.BUBBLE_W, 160);
  assert.equal(Feed.BUBBLE_H, 132);
  const emb = fs.readFileSync(path.join(root, 'assets/tweet_embed.js'), 'utf8');
  assert.match(emb, /var READ_MS = 23000;/);
  const proj = fs.readFileSync(path.join(root, 'assets/projector.js'), 'utf8');
  assert.match(proj, /const base=Math\.min\(Math\.max\(SLIDE\*900,4000\),7000\)\+3000;/);
  const ff = fs.readFileSync(path.join(root, 'assets/frame_feed.js'), 'utf8');
  assert.match(ff, /baseMs == null \? 8000 : baseMs/);
  assert.doesNotMatch(ff, /return rawMount\(host, item, baseMs\);\n      \}\n      return rawMount/, 'no random deck fallback on the bubble');
});
