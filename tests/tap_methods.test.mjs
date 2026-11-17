// tap methods (16 Nov 2026): a tap opens glow/size/mood-or-brightness buttons; a click goes over the drag relay as {v:1,type:'call'}
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const src = fs.readFileSync(new URL('../assets/stage.js', import.meta.url), 'utf8');
test('tap opens methods, click sends a whitelisted call', () => {
  const blk = src.slice(src.indexOf('// ---------- tap methods'), src.indexOf('S.fireMethod = fireMethod;'));
  assert.ok(blk.length > 1000);
  for(const f of ["fn: 'glow'", "fn: 'grow'", "fn: 'shrink'", "fn: 'setmood'", "fn: 'dim'", "fn: 'brighten'"]) assert.ok(blk.includes(f), f);
  assert.match(blk, /type: 'call'/); assert.match(blk, /DG\.endpoint/); assert.match(blk, /closeMethods\(\); \}, \{capture: true, passive: true\}\)/);
  assert.ok(src.includes('try{ tapIntent(d.c); }')); // smart taps (17 Nov 2026 2:54 PM ET): the menu opens through tapIntent
});
// registry functions (17 Nov 2026): objects with their own seated code titles list only those; others keep the old methods
test('tap lists registry functions from data/object_methods.json, old methods only when none', () => {
  assert.ok(src.includes("fetch('data/object_methods.json"));
  const blk = src.slice(src.indexOf('// ---------- registry functions'), src.indexOf('S.fireMethod = fireMethod;'));
  assert.match(blk, /const fns = orderByPref\(c, funcsFor\(c\)/); assert.match(blk, /if\(!fns\.length && !env\.some/);
  assert.match(blk, /func: it\.id, title: it\.t\.title/); assert.match(blk, /popTweet\(c, it, tw\)/); assert.match(blk, /playGfx\(c, eff\.fx\)/);
  for(const v of ['fold', 'hide', 'tune', 'know', 'weigh']) assert.ok(new RegExp(v + ": '").test(blk), v);
  const om = JSON.parse(fs.readFileSync(new URL('../data/object_methods.json', import.meta.url), 'utf8'));
  assert.ok(Object.keys(om.functions).length > 0); assert.ok(om.objects.teo && om.objects.teo.includes('teo.fold'));
  for(const f of Object.values(om.functions)) for(const t of f.titles) for(const tw of t.tweets) assert.match(String(tw.year), /^\d{4}$/);
});
// scope inheritance (17 Nov 2026 11:11 AM ET): own functions, then labelled rows from the object's run and safe; old methods only if both empty
test('tap lists inherited functions from the run and the safe, logged with scope env', () => {
  const blk = src.slice(src.indexOf('// ---------- registry functions'), src.indexOf('S.fireMethod = fireMethod;'));
  assert.match(blk, /function envFor\(c, own\)/); assert.match(blk, /'from ' \+ r\.from : 'from the safe'/);
  assert.match(blk, /if\(!fns\.length && !env\.some\(r => r\.items\.length\)\) orderByPref\(c, methodsFor\(c\)/);
  assert.match(blk, /scope: it\.scope === 'env' \? 'env' : 'own'/); assert.match(blk, /env_scope: it\.env_scope, env_from: it\.env_from/);
  const om = JSON.parse(fs.readFileSync(new URL('../data/object_methods.json', import.meta.url), 'utf8'));
  for(const n of ['calla', 'marisol', 'dez']){ const rows = om.inherit[n] || []; assert.ok(rows.some(r => r.scope === 'run' && r.from === 'run-5a58c4' && r.funcs.includes('teo.fold')), n); }
  for(const [n, rows] of Object.entries(om.inherit)) for(const r of rows){ const own = om.objects[n] || []; for(const f of r.funcs){ assert.ok(om.functions[f], f); assert.ok(!own.includes(f), n + ' ' + f); } }
});
// typed arguments + dependency injection (17 Nov 2026 12:34 PM ET): signatures, classes, and a resolved call in the pop-up
test('functions carry typed signatures and resolve their arguments from the container', () => {
  const blk = src.slice(src.indexOf('// ---------- registry functions'), src.indexOf('S.fireMethod = fireMethod;'));
  assert.ok(src.includes("fetch('data/classes.json")); assert.match(blk, /function injectFor\(it, c\)/); assert.match(blk, /rv\.className = 'gtr'/);
  assert.match(blk, /codeLine\(m\.resolved \|\| m\.code \|\| code/);
  const om = JSON.parse(fs.readFileSync(new URL('../data/object_methods.json', import.meta.url), 'utf8'));
  const cl = JSON.parse(fs.readFileSync(new URL('../data/classes.json', import.meta.url), 'utf8'));
  assert.equal(om.functions['crime.know'].sig.text, 'know(when: Frequency)');
  assert.equal(om.functions['crime.know'].titles[0].resolved, 'crime.know(when=sometimes:Frequency) from j24');
  assert.equal(cl.instances.sometimes.class, 'Frequency'); assert.equal(cl.instances.sometimes.first_job, 'j24');
  for(const c of ['Frequency', 'Person', 'Manner', 'Place', 'Thing', 'Quantity', 'Feeling', 'Action']) assert.ok(cl.classes[c], c);
  for(const f of Object.values(om.functions)) for(const p of f.sig.params) assert.ok(cl.classes[p.class] && cl.instances[p.default], p.default);
});
// Phase A (17 Nov 2026 12:40 PM ET): inheritance, polymorphic effects, interfaces, observers
test('classes inherit from Thing, override verb effects, list interfaces, and ripple to listeners', () => {
  const blk = src.slice(src.indexOf('// ---------- registry functions'), src.indexOf('S.fireMethod = fireMethod;'));
  assert.match(blk, /function effectOf\(method, cl\)/); assert.match(blk, /function listenersOf\(c\)/); assert.match(blk, /'because ' \+ because/);
  assert.match(blk, /'implements ' \+ ifs\.join/); assert.match(blk, /chainOf\(classOf\(c\)\)\.join\(' : '\)/);
  for(const fx of ['bow', 'duck', 'nod', 'slump', 'quake', 'dimfx', 'shrinkfx']) assert.ok(src.includes('.gcut.gfx-' + fx + '{'), fx);
  const cl = JSON.parse(fs.readFileSync(new URL('../data/classes.json', import.meta.url), 'utf8'));
  assert.equal(cl.parent.Person, 'Thing'); assert.deepEqual(cl.classes.Person.chain, ['Person', 'Thing']); assert.equal(cl.overrides.Person.fold, 'bow');
  for(const i of ['Readable', 'Foldable', 'Watchable']) assert.ok(cl.interfaces[i] && cl.interfaces[i].verbs.length, i);
  assert.ok(cl.casts['run-5a58c4'].includes('teo') && cl.casts['run-5a58c4'].includes('calla'));
  for(const w of Object.keys(cl.instances)) assert.ok(!/sex|porn|nude|voyeur|daddy/i.test(w), w);
});
// Phase B (17 Nov 2026): recursion layers, #thryd's promises/exceptions as read-only exports
test('pop-up nests earlier definitions (depth 5), pending promises pulse, exceptions show in the menu', () => {
  const blk = src.slice(src.indexOf('// ---------- registry functions'), src.indexOf('S.fireMethod = fireMethod;'));
  assert.ok(src.includes("fetch('data/' + k + '.json")); assert.match(blk, /\['promises', 'exceptions'\]/);
  assert.match(blk, /slice\(0, 4\)\.map\(p => \(\{\.\.\.p, f: OM\.functions\[p\.id\]\}\)\)/); assert.match(blk, /host\.appendChild\(L\); host = L;/);
  assert.match(blk, /'\\u26a0 throws: '/); assert.match(blk, /m\.className = 'gprom'/); assert.match(blk, /p\.status === 'resolved'\) PR\.flash/);
  const om = JSON.parse(fs.readFileSync(new URL('../data/object_methods.json', import.meta.url), 'utf8'));
  for(const f of Object.values(om.functions)) assert.ok(Array.isArray(f.prior) && f.prior.length <= 4);
  assert.ok(om.functions['omo.fold'].prior.some(p => p.title === 'teo.fold(surgical)'));
  for(const k of ['promises', 'exceptions']){ const d = JSON.parse(fs.readFileSync(new URL('../data/' + k + '.json', import.meta.url), 'utf8')); assert.ok(Array.isArray(d[k])); assert.match(d.note, /only source of truth/); }
});
// Phase C (17 Nov 2026): world version control, faded functions, queued calls
test('world_log commits per pick, faded functions dim and revive on a call, queued calls are reported', () => {
  const blk = src.slice(src.indexOf('// ---------- registry functions'), src.indexOf('S.fireMethod = fireMethod;'));
  assert.ok(src.includes("fetch('data/world_log.json")); assert.match(blk, /classList\.toggle\('gfaded'/); assert.match(blk, /rec\.revived = true/); assert.match(blk, /m\.lock\.queued/);
  const wl = JSON.parse(fs.readFileSync(new URL('../data/world_log.json', import.meta.url), 'utf8'));
  const b = wl.branches['run-5a58c4']; assert.ok(b && b.commits.length > 5); assert.equal(b.head, b.commits[b.commits.length - 1].id);
  for(const br of Object.values(wl.branches)) br.commits.forEach((c, i) => assert.equal(c.parent, i ? br.commits[i - 1].id : null));
  const om = JSON.parse(fs.readFileSync(new URL('../data/object_methods.json', import.meta.url), 'utf8'));
  assert.ok(Object.values(om.functions).some(f => f.faded) && Object.values(om.functions).some(f => !f.faded)); assert.equal(om.gc.n, 2);
});
test('exceptions render by kind: genre_mismatch is a soft twist, anything else a hard throw', () => {
  const blk = src.slice(src.indexOf('// ---------- registry functions'), src.indexOf('S.fireMethod = fireMethod;'));
  const isSoft = eval(blk.match(/const isSoft = (e => \{[^\n]*\});/)[1]);
  assert.equal(isSoft({severity: 'soft', kind: 'fact_conflict'}), true); assert.equal(isSoft({severity: 'hard', kind: 'genre_mismatch'}), false);
  assert.equal(isSoft({severity: '', kind: 'genre_mismatch'}), false); assert.equal(isSoft({severity: 'weird'}), false); assert.equal(isSoft({kind: 'genre_mismatch'}), true); assert.equal(isSoft({kind: 'new_kind'}), false); assert.equal(isSoft({}), false);
  assert.match(blk, /'\\u21af twist: ' : '\\u26a0 throws: '/); assert.match(blk, /'\\u21af bends the scene: ' : '\\u26a0 caught: '/);
});
