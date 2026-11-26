// medium cut-object code: lazy sharded loader, card hook, schema/validator (26 Nov 2026)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const here = new URL('..', import.meta.url);
const rd = p => fs.readFileSync(new URL(p, here), 'utf8');
const st = rd('assets/stage.js');
const card = rd('assets/story_card.js');
const html = rd('index.html');
const man = JSON.parse(rd('data/medium_cuts_code.json'));
const tools = '/workspace/thryd-projector/tools';

test('manifest is tiny, version 1, and has no entries catalog', () => {
  assert.equal(man.v, 1);
  assert.equal(man.hash, 'fnv1a32');
  assert.equal(man.mod, 8);
  assert.ok(man.shard_pattern.includes('{NN}'));
  assert.ok(!('entries' in man));
  const bytes = fs.statSync(new URL('data/medium_cuts_code.json', here)).size;
  assert.ok(bytes < 1024, 'manifest should stay under 1 KB, got ' + bytes);
});

test('stage loads cut code only on first Medium-cut tap, never at page start, with no timers', () => {
  const pre = st.slice(0, st.indexOf('// ---------- medium cut code'));
  assert.ok(pre.length > 1000);
  assert.equal(pre.includes("fetch('data/medium_cuts_code.json"), false);
  assert.match(st, /function loadMccManifest\(\)/);
  assert.match(st, /function loadMccShard\(mid\)/);
  assert.match(st, /return loadMccManifest\(\)\.then\(man =>/);
  assert.match(st, /mccEnsure\(c, items =>/);
  assert.match(st, /if\(M\.cut !== c \|\| M\.el !== box \|\| !items\.length\) return;/);
  assert.match(st, /paintMcc\(box, c, name, items\)/);
  assert.match(st, /no scene re-render/);
  assert.doesNotMatch(st, /setInterval\(loadMcc/);
  assert.doesNotMatch(st, /setInterval\(mcc/);
  assert.doesNotMatch(st, /requestAnimationFrame\(loadMcc/);
  assert.doesNotMatch(st, /loadMccManifest\(\);\s*$/m);
  // index does not add a new always-on script for this data
  assert.doesNotMatch(html, /medium_cuts_code/);
});

test('tap menu keeps today\'s methods when a cut has no cached entry, and cards get a lazy hook', () => {
  assert.match(st, /if\(!fns\.length && !mccNow\.length && !env\.some/);
  assert.match(st, /root\.thrydCutCode = cutCodeApi/);
  assert.match(st, /S\.cutCode = cutCodeApi/);
  assert.match(st, /forCut:\s*\(mid, cut\)/);
  assert.match(card, /cutCode:cardCutCode,loadCutCode:cardLoadCutCode/);
  assert.match(card, /cards call these only when they need a line, never on load/);
  assert.doesNotMatch(card, /fetch\('data\/medium_cuts_code/);
});

test('validator accepts a partial tree and packs a fixture batch into the right shard', () => {
  const v = spawnSync('python3', [path.join(tools, 'validate_medium_cuts_code.py'), '--root', new URL('.', here).pathname], {encoding: 'utf8'});
  assert.equal(v.status, 0, v.stderr || v.stdout);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcc-'));
  const data = path.join(tmp, 'data');
  fs.mkdirSync(path.join(data, 'medium_cuts_code.batches'), {recursive: true});
  fs.mkdirSync(path.join(data, 'medium_cuts_code'), {recursive: true});
  fs.copyFileSync(new URL('data/medium_cuts_code.json', here), path.join(data, 'medium_cuts_code.json'));
  fs.copyFileSync(new URL('data/medium_cuts.json', here), path.join(data, 'medium_cuts.json'));
  fs.copyFileSync(new URL('data/object_methods.json', here), path.join(data, 'object_methods.json'));
  fs.copyFileSync(new URL('tests/fixtures/medium_cuts_code.batches/example.json', here), path.join(data, 'medium_cuts_code.batches', 'example.json'));
  const pack = spawnSync('python3', [path.join(tools, 'pack_medium_cuts_code.py'), '--root', tmp], {encoding: 'utf8'});
  assert.equal(pack.status, 0, pack.stderr || pack.stdout);
  assert.match(pack.stdout, /s00\.json/);
  const shard = JSON.parse(fs.readFileSync(path.join(data, 'medium_cuts_code', 's00.json'), 'utf8'));
  assert.equal(shard.shard, 's00');
  assert.equal(shard.entries[0].title, 'cap.fist()');
  assert.equal(shard.entries[0].medium_image_id, '1*UQolGv9h9_i7sWsk3lDLCA.gif');
  // a mid placed in the wrong shard is rejected
  fs.writeFileSync(path.join(data, 'medium_cuts_code', 's01.json'), JSON.stringify({v: 1, shard: 's01', entries: [shard.entries[0]]}));
  const bad = spawnSync('python3', [path.join(tools, 'validate_medium_cuts_code.py'), '--root', tmp], {encoding: 'utf8'});
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /belongs in s00\.json/);
});

test('schema file is at stretchy/site/data and in the live repo', () => {
  const a = '/workspace/stretchy/site/data/medium_cuts_code.SCHEMA.md';
  const b = new URL('data/medium_cuts_code.SCHEMA.md', here);
  assert.ok(fs.existsSync(a));
  assert.ok(fs.existsSync(b));
  const body = fs.readFileSync(a, 'utf8');
  assert.match(body, /fnv1a32/);
  assert.match(body, /window\.thrydCutCode/);
  assert.match(body, /partial batches/i);
});
