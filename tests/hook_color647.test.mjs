// v647 (Jesuye 5:09 PM "it should have its own color"): the returning (hook) line has one shared colour
import test from 'node:test';
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
const here = new URL('..', import.meta.url);
const rd = p => readFileSync(new URL(p, here), 'utf8');
const js = rd('assets/job_card.js'), sc = rd('assets/story_card.js'), html = rd('index.html');
const roles = JSON.parse(rd('data/role_colors.json'));

test('one shared hook colour, not used by any agenda/edge colour', ()=>{
  assert.match(roles.hook.color, /^#[0-9a-f]{6}$/i);
  const edges = rd('story/edges.json') + rd('story/drawing.json');
  assert.ok(!edges.toLowerCase().includes(roles.hook.color.toLowerCase()));
});

test('panel option and seat line paint the hook colour from the payload', ()=>{
  assert.match(js, /o\.role === 'hook' \? ' hook' : ''/);
  assert.match(js, /setProperty\('--hook', o\.color\)/);
  assert.match(js, /\.aicopt\.hook\{border-left:3px solid var\(--hook/);
  assert.match(js, /ls\.hook_lines/);
  assert.match(js, /setProperty\('--hook', ls\.hook_color\)/);
});

test('story drawing stroke keeps the hook colour', ()=>{
  assert.match(sc, /s\.role==='hook'&&\/\^#\[0-9a-f\]\{6\}\$\/i\.test\(s\.color\|\|''\)\)\?s\.color/);
  assert.match(html, /story_card\.js\?v=21/);
  assert.match(html, /var VER=(6[4-9]\d),/);
});
