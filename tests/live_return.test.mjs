import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const Live = require(path.join(root, 'assets/live_return.js'));
const Pin = require(path.join(root, 'assets/mlib_pin.js'));

function run(opts){
  const cycle = Live.create(10);
  const pin = Pin.create();
  let poolI = 0;
  let shown = null;
  const log = [];
  function backdrop(set){
    if(!pin.allow(set)) return false;
    shown = set;
    log.push(set.id);
    return true;
  }
  return {
    cycle, pin, log,
    get shown(){ return shown; },
    tick(){
      const moved = Live.step(cycle, {
        pool: opts.pool, poolI, mode: opts.mode || 'live',
        newest: opts.newest
      });
      poolI = moved.poolI;
      if(moved.action === 'idle') return moved;
      backdrop(moved.set);
      return moved;
    }
  };
}

test('ten slideshow steps then the newest at that moment, then the count restarts', () => {
  let current = {id: 'old', dir: 'a'};
  const pool = [current, {id: 'b', dir: 'b'}, {id: 'c', dir: 'c'}, {id: 'd', dir: 'd'}];
  const s = run({pool, newest: () => current});
  const kinds = [];
  for(let i = 0; i < 10; i++) kinds.push(s.tick().action);
  assert.deepEqual(kinds, Array(10).fill('advance'));
  assert.equal(s.cycle.count(), 10);
  current = {id: 'new', dir: 'e'};
  pool.push(current);
  const back = s.tick();
  assert.equal(back.action, 'live');
  assert.equal(back.set, current);
  assert.equal(s.shown, current);
  assert.equal(s.cycle.count(), 0);
  const again = [];
  for(let i = 0; i < 10; i++) again.push(s.tick().action);
  assert.deepEqual(again, Array(10).fill('advance'));
  assert.equal(s.tick().action, 'live');
  assert.equal(s.shown.id, 'new');
});

test('an explicit library pin is not replaced, and leaving that mode resets the count', () => {
  const agenda = {id: 'agenda', dir: 'agenda'};
  const qa5 = {id: 'qa5', dir: 'medium/qa5'};
  const pool = [agenda, {id: 'b', dir: 'b'}, {id: 'c', dir: 'c'}];
  const s = run({pool, newest: () => agenda});
  s.pin.hold(qa5);
  for(let i = 0; i < 10; i++) s.tick();
  const back = s.tick();
  assert.equal(back.action, 'live');
  assert.equal(back.set, agenda);
  assert.equal(s.shown, null);
  s.pin.clear();
  s.cycle.reset();
  assert.equal(s.cycle.count(), 0);
  assert.equal(s.tick().action, 'advance');
  assert.equal(s.cycle.count(), 1);
  assert.notEqual(s.shown, null);
});

function walk(pool, newest, cursor, poolI){
  const cycle = Live.create(10);
  let state = {poolI: poolI || 0, cursor: cursor || ''};
  function tick(extra){
    const moved = Live.step(cycle, Object.assign({
      pool, poolI: state.poolI, cursor: state.cursor, newest
    }, extra || {}));
    state = {poolI: moved.poolI, cursor: moved.cursor};
    return moved;
  }
  return {cycle, tick, state: () => state};
}

test('ten other items, then the current newest, then the next unseen items, twice', () => {
  const anchor = {id: 'N0', dir: 'd0'};
  const others = Array.from({length: 29}, (_, i) => ({id: 'i' + (i + 1), dir: 'd' + (i + 1)}));
  const pool = [anchor, ...others];
  let latest = anchor;
  const w = walk(pool, () => latest, anchor.dir, 0);
  const first = [];
  for(let i = 0; i < 10; i++) first.push(w.tick());
  assert.deepEqual(first.map(m => m.set.dir), others.slice(0, 10).map(s => s.dir));
  latest = {id: 'N1', dir: 'd0'};
  const back = w.tick();
  assert.equal(back.action, 'live');
  assert.equal(back.set, latest);
  assert.equal(back.cursor, 'd10');
  const second = [];
  for(let i = 0; i < 10; i++) second.push(w.tick());
  assert.deepEqual(second.map(m => m.set.dir), others.slice(10, 20).map(s => s.dir));
  const again = w.tick();
  assert.equal(again.action, 'live');
  assert.equal(again.set, latest);
  const third = [];
  for(let i = 0; i < 9; i++) third.push(w.tick());
  assert.deepEqual(third.map(m => m.set.dir), others.slice(20).map(s => s.dir));
  const dirs = [...first, ...second, ...third].map(m => m.set.dir);
  assert.equal(dirs.length, 29);
  assert.equal(new Set(dirs).size, 29);
  assert.ok(!dirs.includes('d0'));
});

test('a rebuilt pool resumes by identity, including when the newest object is new', () => {
  const anchor = {id: 'N0', dir: 'd0'};
  const others = Array.from({length: 12}, (_, i) => ({id: 'i' + (i + 1), dir: 'd' + (i + 1)}));
  let pool = [anchor, ...others];
  const cycle = Live.create(10);
  let poolI = 0;
  let cursor = 'd0';
  let newest = () => ({id: 'fresh', dir: 'd0'});
  function tick(){
    const moved = Live.step(cycle, {pool, poolI, cursor, newest});
    poolI = moved.poolI;
    cursor = moved.cursor;
    return moved;
  }
  assert.deepEqual([tick(), tick(), tick()].map(m => m.set.dir), ['d1', 'd2', 'd3']);
  pool = [{id: 'NEW', dir: 'dNew'}, ...pool.map(s => ({id: s.id + 'b', dir: s.dir}))];
  newest = () => pool[0];
  assert.equal(tick().set.dir, 'd4');
  assert.deepEqual([tick(), tick(), tick(), tick(), tick(), tick()].map(m => m.set.dir), ['d5', 'd6', 'd7', 'd8', 'd9', 'd10']);
  const back = tick();
  assert.equal(back.action, 'live');
  assert.equal(back.set.dir, 'dNew');
  assert.equal(back.cursor, 'd10');
  assert.equal(tick().set.dir, 'd11');
});

test('a held pin does not burn the count, and a mode exit starts a walk that still resumes', () => {
  const anchor = {id: 'N', dir: 'd0'};
  const others = Array.from({length: 25}, (_, i) => ({id: 'i' + (i + 1), dir: 'd' + (i + 1)}));
  const pool = [anchor, ...others];
  const w = walk(pool, () => anchor, anchor.dir, 0);
  for(let i = 0; i < 4; i++) assert.equal(w.tick().set.dir, 'd' + (i + 1));
  const held = w.tick({hold: true});
  assert.equal(held.action, 'hold');
  assert.equal(held.cursor, 'd4');
  assert.equal(w.cycle.count(), 4);
  assert.equal(w.tick().set.dir, 'd5');
  w.cycle.reset();
  assert.equal(w.cycle.count(), 0);
  assert.equal(w.tick().set.dir, 'd6');
  const fresh = walk(pool, () => anchor, '', 0);
  const restarted = [];
  for(let i = 0; i < 10; i++) restarted.push(fresh.tick().set.dir);
  assert.deepEqual(restarted, others.slice(0, 10).map(s => s.dir));
  assert.equal(fresh.tick().set.dir, 'd0');
  assert.deepEqual([fresh.tick().set.dir, fresh.tick().set.dir], ['d11', 'd12']);
});
