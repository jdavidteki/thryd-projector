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
