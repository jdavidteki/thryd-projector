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
