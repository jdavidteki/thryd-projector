import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const Pin = require(path.join(root, 'assets/mlib_pin.js'));

function stage(){
  const pin = Pin.create();
  let shown = null;
  function backdrop(set){
    if(!pin.allow(set)) return false;
    shown = set;
    return true;
  }
  return {pin, backdrop, get shown(){ return shown; }};
}

test('a library choice survives boot, the delayed newest tick, and slideshow', () => {
  const s = stage();
  const agenda = {dir: 'assets/webp/live/run-2eb42d_j11'};
  const qa5 = {dir: 'medium/1*UQolGv9h9_i7sWsk3lDLCA.gif'};
  // preset show, then setMode(live) first NEWEST, then the 2.5s timeout, then slide ticks
  s.pin.hold(qa5);
  assert.equal(s.backdrop(qa5), true);
  assert.equal(s.backdrop(agenda), false);
  assert.equal(s.backdrop(agenda), false);
  assert.equal(s.backdrop({dir: 'assets/webp/live/run-2eb42d_j4'}), false);
  assert.equal(s.shown, qa5);
  // a mode button returns the page to the normal live choice
  s.pin.clear();
  assert.equal(s.backdrop(agenda), true);
  assert.equal(s.shown, agenda);
});

test('no query leaves newest and the slideshow free to change the stage', () => {
  const s = stage();
  const agenda = {dir: 'agenda'};
  const next = {dir: 'next'};
  assert.equal(s.backdrop(agenda), true);
  assert.equal(s.backdrop(next), true);
  assert.equal(s.shown, next);
  const picked = {dir: 'medium/1*UQolGv9h9_i7sWsk3lDLCA.gif'};
  s.pin.hold(picked);
  assert.equal(s.backdrop(picked), true);
  assert.equal(s.backdrop(agenda), false);
  assert.equal(s.shown, picked);
});
