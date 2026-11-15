// Media starvation (Jesuye 15 Nov 2026 11:56 AM ET): a failed GIF / image load only cools the item down; it is never blacklisted for
// good, so a wifi drop or laptop sleep cannot leave the stage with text chips only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../assets/stage.js', import.meta.url), 'utf8');
const grab = name => { const i = src.indexOf('function ' + name + '('); assert.ok(i >= 0, name); let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}' && --d === 0) break; } return src.slice(i, j + 1); };
function mk(){ let now = 1e12; const D = {now: () => now}; const C = new Function('Date', grab('Cooldown') + '; return Cooldown();')(D); return {C, at: t => { now = t; }, now: () => now}; }

test('a network failure cools an item for 1 min, doubling, capped at 15 min; then it is offered again', () => {
  const {C, at, now} = mk(), t0 = now();
  assert.equal(C.add('a', 'fetch'), true); assert.equal(C.has('a'), true); assert.equal(C.size, 1);
  at(t0 + 61e3); assert.equal(C.has('a'), false); assert.equal(C.size, 0);
  C.add('a', 'TypeError: Failed to fetch'); at(t0 + 61e3 + 119e3); assert.equal(C.has('a'), true); at(t0 + 61e3 + 121e3); assert.equal(C.has('a'), false);
  for(let i = 0; i < 20; i++) C.add('a', 'fetch'); at(now() + 15 * 60e3 + 1); assert.equal(C.has('a'), false, 'never more than 15 min for network errors');
});

test('other errors cool longer (10 min doubling, at most 6 h) but never forever; success clears; release lifts all waits', () => {
  const {C, at, now} = mk();
  C.add('b', 'mask_size'); at(now() + 9 * 60e3); assert.equal(C.has('b'), true); at(now() + 2 * 60e3); assert.equal(C.has('b'), false);
  for(let i = 0; i < 30; i++) C.add('b', 'decode'); at(now() + 6 * 3600e3 + 1); assert.equal(C.has('b'), false, 'capped at 6 h');
  C.add('c', 'plan'); C.ok('c'); assert.equal(C.has('c'), false);
  C.add('d', 'plan'); C.add('e', 'fetch'); assert.equal(C.size, 2); assert.equal(C.release(), 2); assert.equal(C.size, 0);
});

test('the stage wiring: no permanent Set, breaker, worker timeout, starvation guard, manifest retry', () => {
  assert.ok(!/bad:\s*new Set\(\)/.test(src), 'S.bad is not a permanent Set any more');
  assert.ok(/function netFail\(\)/.test(src) && /netHeld\(\)\s*\?\s*null\s*:\s*wantLive\(\)/.test(src));
  assert.ok(/worker_timeout/.test(src) && /90000/.test(src));
  assert.ok(/starve guard: released/.test(src) && /240000/.test(src));
  assert.ok(/manifest failed, retrying'\); spawner\(\)/.test(src));
  assert.ok(!/S\.bad\.add\(row\.medium_image_id\)/.test(src) && !/S\.bad\.add\(id\)/.test(src), 'every failure goes through failed()');
});
