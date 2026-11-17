// tap methods (16 Nov 2026): a tap opens glow/size/mood-or-brightness buttons; a click goes over the drag relay as {v:1,type:'call'}
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const src = fs.readFileSync(new URL('../assets/stage.js', import.meta.url), 'utf8');
test('tap opens methods, click sends a whitelisted call', () => {
  const blk = src.slice(src.indexOf('// ---------- tap methods'), src.indexOf('S.fireMethod = fireMethod;'));
  assert.ok(blk.length > 1000);
  for(const f of ["fn: 'glow'", "fn: 'grow'", "fn: 'shrink'", "fn: 'setmood'", "fn: 'dim'", "fn: 'brighten'"]) assert.ok(blk.includes(f), f);
  assert.match(blk, /type: 'call'/); assert.match(blk, /DG\.endpoint/); assert.match(blk, /closeMethods\(\); \}, \{capture: true, passive: true\}\)/);
  assert.ok(src.includes('try{ openMethods(d.c); }'));
});
// registry functions (17 Nov 2026): objects with their own seated code titles list only those; others keep the old methods
test('tap lists registry functions from data/object_methods.json, old methods only when none', () => {
  assert.ok(src.includes("fetch('data/object_methods.json"));
  const blk = src.slice(src.indexOf('// ---------- registry functions'), src.indexOf('S.fireMethod = fireMethod;'));
  assert.match(blk, /const fns = funcsFor\(c\);/); assert.match(blk, /if\(!fns\.length && !env\.some/);
  assert.match(blk, /func: it\.id, title: it\.t\.title/); assert.match(blk, /popTweet\(c, it, tw\)/); assert.match(blk, /playGfx\(c, gfxOf\(f\.method\)\)/);
  for(const v of ['fold', 'hide', 'tune', 'know', 'weigh']) assert.ok(new RegExp(v + ": '").test(blk), v);
  const om = JSON.parse(fs.readFileSync(new URL('../data/object_methods.json', import.meta.url), 'utf8'));
  assert.ok(Object.keys(om.functions).length > 0); assert.ok(om.objects.teo && om.objects.teo.includes('teo.fold'));
  for(const f of Object.values(om.functions)) for(const t of f.titles) for(const tw of t.tweets) assert.match(String(tw.year), /^\d{4}$/);
});
// scope inheritance (17 Nov 2026 11:11 AM ET): own functions, then labelled rows from the object's run and safe; old methods only if both empty
test('tap lists inherited functions from the run and the safe, logged with scope env', () => {
  const blk = src.slice(src.indexOf('// ---------- registry functions'), src.indexOf('S.fireMethod = fireMethod;'));
  assert.match(blk, /function envFor\(c, own\)/); assert.match(blk, /'from ' \+ r\.from : 'from the safe'/);
  assert.match(blk, /if\(!fns\.length && !env\.some\(r => r\.items\.length\)\) methodsFor\(c\)/);
  assert.match(blk, /scope: it\.scope === 'env' \? 'env' : 'own'/); assert.match(blk, /env_scope: it\.env_scope, env_from: it\.env_from/);
  const om = JSON.parse(fs.readFileSync(new URL('../data/object_methods.json', import.meta.url), 'utf8'));
  for(const n of ['calla', 'marisol', 'dez']){ const rows = om.inherit[n] || []; assert.ok(rows.some(r => r.scope === 'run' && r.from === 'run-5a58c4' && r.funcs.includes('teo.fold')), n); }
  for(const [n, rows] of Object.entries(om.inherit)) for(const r of rows){ const own = om.objects[n] || []; for(const f of r.funcs){ assert.ok(om.functions[f], f); assert.ok(!own.includes(f), n + ' ' + f); } }
});
