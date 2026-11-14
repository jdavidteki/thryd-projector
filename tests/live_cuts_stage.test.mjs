import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = fs.readFileSync(path.join(root, 'assets/stage.js'), 'utf8');
const wk = fs.readFileSync(path.join(root, 'assets/stage_worker.js'), 'utf8');
const pj = fs.readFileSync(path.join(root, 'assets/projector.js'), 'utf8');
test('live views load as cutouts from their pack, whole frame as fallback', () => {
  assert.match(src, /async function loadLiveCut\(v, fresh\)/);
  assert.match(src, /loadGroup\(mrow, \{assets: \[mrow\]\}, \{live: true, fresh\}\)/);
  assert.match(src, /return loadLiveFrame\(v, fresh\)/);
  assert.ok(src.includes('.cut\\.json$/.test(String(c.pack))'));
});
test('fresh live plates are sharper and stronger; normal plates unchanged', () => {
  assert.match(src, /BG_NORMAL = \{A: 0\.34, solid: 0\.45/);
  assert.match(src, /BG_FRESH = \{A: 0\.80, solid: 0\.70/);
  assert.match(wk, /A0 > 0 && A0 <= 1 \? A0 : 0\.34/);
});
test('panel shows meetings, never cutN', () => {
  assert.match(src, /function meetTick\(\)/);
  assert.match(src, /arrivesat/);
  assert.match(src, /\/\^cut\\d\*\$\/i\.test\(lab\)/);
  assert.match(pj, /window\.thrydMeet=/);
  assert.match(pj, /put\('kind','meet'\)/);
});
test('live cut groups do not use the Medium GIF slots, and a live view cools down after it leaves', () => {
  assert.match(src, /g\.kind === 'gif' && !g\.live/);
  assert.match(src, /LIVE_COOL_MS = \(PHONE \? 120 : 150\) \* 1000/);
  assert.match(src, /if\(g\.live\)\{ try\{ LV\.left\[g\.mid\] = Date\.now\(\); \}catch\(e\)\{\} \}/);
  assert.match(src, /!cooling\(liveId\(v\)\)/);
});
test('name tags are hidden until a plain tap toggles one (drags untouched)', () => {
  assert.match(src, /data\/frame_objects\.json/);
  assert.match(src, /#gnames \.gn\{position:absolute;left:0;top:0;pointer-events:none/);
  assert.match(src, /text-shadow:0 0 2px #000/);
  assert.match(src, /function tagName\(c\)/);
  assert.match(src, /function frameName\(g\)/);
  const tags = src.slice(src.indexOf('// ---------- name tags'), src.indexOf('// ---------- tweets'));
  // tap-to-toggle only: passive listeners, never preventDefault / stopPropagation, no hover, no menus, no engine calls
  assert.doesNotMatch(tags, /preventDefault|stopPropagation|onclick|mouseenter|:hover|contextmenu|thrydMeet|ntfy|fetch\('(?!data\/frame_objects)/);
  for(const m of tags.matchAll(/addEventListener\('(\w+)'[^\n]*\{capture: true, passive: true\}/g)) assert.ok(['pointerdown','pointermove','pointerup','pointercancel'].includes(m[1]));
  assert.ok(tags.includes('toggleTag(d.c)') && /TAG_MS = 3000/.test(tags) && /function toggleTag\(c\)\{ SHOWN.set\(c, Date.now\(\)\)/.test(tags));
  assert.ok(/>= 6/.test(tags) && />= 300/.test(tags));
});
test('a regenerated version keeps its name with a ·N marker', () => {
  assert.ok(src.includes("n.replace(/\\u00b7\\d+$/, '')"));
});
