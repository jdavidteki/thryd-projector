// control bar (Jesuye 17 Nov 2026 1:03 PM ET): no Reset / Resume / medium-id box, even spacing, ux.js loaded, ?mlib restore kept
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test('reset, resume and the medium id box are gone; the URL restore stays', () => {
  for(const f of ['index.html', 'phone.html']){ const h = read(f); assert.ok(!/id="kresume"|id="kreset"|id="mlib"/.test(h), f); assert.match(h, /'ux\.js\?v=1'/); }
  const js = read('assets/projector.js'); assert.ok(!/kresume|kreset|\$\('mlib'\)/.test(js)); assert.match(js, /stageChoice\(Q\.get\('mlib'\)/); assert.match(js, /if\(choice\.id\)\{ const hit=window\.thrydLibrary/);
  const css = read('assets/projector.css'); assert.match(css, /#modes\{gap:10px;flex-wrap:wrap/); assert.match(css, /#modes input\[type=file\]\{display:none!important\}/);
  const ux = read('assets/ux.js'); assert.match(ux, /aria-label/); assert.match(ux, /e\.key === '\?'/); assert.match(ux, /touchstart/);
});
