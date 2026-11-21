// genie return (v602): loader order, off switches, pure-overlay guarantees
import test from 'node:test';
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
const here = new URL('..', import.meta.url);
const js = readFileSync(new URL('assets/genie.js', here), 'utf8');
const html = readFileSync(new URL('index.html', here), 'utf8');
test('index.html loads genie.js last, after every existing script', ()=>{
  assert.match(html, /'video_card\.js\?v=2','genie\.js\?v=2'\]/);
});
test('off switches: ?genie=0, localStorage thryd_genie=0, data/genie.json on:false, reduced motion, phone.html', ()=>{
  assert.match(js, /genie=0/); assert.match(js, /thryd_genie/); assert.match(js, /j\.on === false/);
  assert.match(js, /prefers-reduced-motion/); assert.match(js, /phone\\\.html/);
});
test('never writes storage and never touches drag / offsets / slide timers of other scripts', ()=>{
  assert.doesNotMatch(js, /localStorage\.setItem|sessionStorage\.setItem/);
  assert.doesNotMatch(js, /\._off\b|\.style\.translate\s*=|\.style\.left\s*=\s*[^;]*c\.el|thryd_dpos|slideMs|thryd_keep/);
  assert.match(js, /pointer-events:none!important/);
});
test('keeps a few on screen: max_away and min_visible guard', ()=>{
  assert.match(js, /max_away: 2, min_visible: 2/);
  assert.match(js, /G\.away\.length < CFG\.max_away/);
});
test('slips into a DIFFERENT background when one is on screen', ()=>{
  assert.match(js, /g !== \(c\.cut && c\.cut\.g\)/);
  assert.match(js, /bgTarget\(c, c\.tgt && \(c\.tgt\.g \|\| c\.tgt\.el\)\)/);
});
