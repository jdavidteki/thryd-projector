import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { parseSlide, createClock } = require('../assets/slide_clock.js');
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function harness(duration){
  let t = 0;
  const timers = [];
  let ticks = 0;
  const clock = createClock({
    duration,
    now: () => t,
    setTimer: (fn, ms) => {
      const rec = { fn, ms, at: t + ms, cleared: false };
      timers.push(rec);
      return rec;
    },
    clearTimer: (id) => { if (id) id.cleared = true; },
    onTick: () => { ticks++; },
  });
  const active = () => timers.filter(x => !x.cleared);
  return {
    clock, timers, active,
    get ticks(){ return ticks; },
    set t(v){ t = v; },
    get t(){ return t; },
  };
}

test('parseSlide accepts only 8, 30, and 60 seconds', () => {
  assert.equal(parseSlide('8', 30), 8);
  assert.equal(parseSlide(30, 8), 30);
  assert.equal(parseSlide('60', 8), 60);
  assert.equal(parseSlide('8s', 30), 30);
  assert.equal(parseSlide('', 30), 30);
  assert.equal(parseSlide(null, 8), 8);
  assert.equal(parseSlide(7, 8), 8);
  assert.equal(parseSlide(undefined, undefined), 8);
});

test('initial duration is the armed delay, including a stored 30s', () => {
  const h = harness(30);
  assert.equal(h.clock.getDuration(), 30);
  assert.equal(h.active().length, 1);
  assert.equal(h.active()[0].ms, 30000);
});

test('selecting 8s while a 30s wait is armed restarts at 8000ms', () => {
  const h = harness(30);
  h.t = 4000;
  const armed = h.clock.setDuration(8);
  assert.equal(armed, 8);
  assert.equal(h.clock.getDuration(), 8);
  const live = h.active();
  assert.equal(live.length, 1);
  assert.equal(live[0].ms, 8000);
  assert.equal(live[0].at, 12000);
  h.t = 11999;
  h.clock.poke();
  assert.equal(h.ticks, 0);
  h.t = 12000;
  h.clock.poke();
  assert.equal(h.ticks, 1);
  assert.equal(h.clock.getDuration(), 8);
  assert.equal(h.active()[0].ms, 8000);
});

test('a late 30s callback cannot advance after the duration changed', () => {
  const h = harness(30);
  const stale = h.active()[0];
  h.clock.setDuration(8);
  h.t = 8000;
  stale.fn();
  assert.equal(h.ticks, 0);
  h.clock.poke();
  assert.equal(h.ticks, 1);
  stale.fn();
  assert.equal(h.ticks, 1);
});

test('changing duration while running uses the new delay from now', () => {
  const h = harness(8);
  h.t = 3000;
  h.clock.setDuration(30);
  assert.equal(h.active()[0].ms, 30000);
  assert.equal(h.active()[0].at, 33000);
  h.t = 32999;
  h.clock.poke();
  assert.equal(h.ticks, 0);
  h.t = 33000;
  h.clock.poke();
  assert.equal(h.ticks, 1);
});

test('poke before the deadline does not skip ahead, and a hidden-style late timer fires once', () => {
  const h = harness(8);
  h.t = 1000;
  h.clock.poke();
  assert.equal(h.ticks, 0);
  const pending = h.active()[0];
  h.t = 30000;
  pending.fn();
  assert.equal(h.ticks, 1);
  pending.fn();
  assert.equal(h.ticks, 1);
  assert.equal(h.active()[0].ms, 8000);
  assert.equal(h.active()[0].at, 38000);
});

test('projector wires the slide control before media fetches and keeps newest-every-3', () => {
  const src = fs.readFileSync(path.join(root, 'assets/projector.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const wire = src.indexOf('function bindSlideControl');
  const fetch = src.indexOf("await J('data/media.json')");
  assert.ok(wire !== -1 && fetch !== -1 && wire < fetch, 'slide control must be bound before media fetches');
  assert.equal(src.includes('setInterval(()=>{if(POOL.length>1)'), false);
  assert.match(src, /slideN%3===0/);
  assert.match(src, /NEWEST\(\)/);
  assert.match(html, /slide_clock\.js/);
  assert.ok(html.indexOf('slide_clock.js') < html.indexOf('projector.js'));
});
