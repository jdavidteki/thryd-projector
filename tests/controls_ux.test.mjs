// control bar (Jesuye 17 Nov 2026 1:03 PM ET): no Reset / Resume / medium-id box, even spacing, ux.js loaded, ?mlib restore kept
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test('reset, resume and the medium id box are gone; the URL restore stays', () => {
  for(const f of ['index.html', 'phone.html']){ const h = read(f); assert.ok(!/id="kresume"|id="kreset"|id="mlib"|id="addgif"|id="gifin"/.test(h), f); assert.match(h, /'ux\.js\?v=1'/); assert.match(h, /projector\.css\?v=ux3/); }
  const js = read('assets/projector.js'); assert.ok(!/kresume|kreset|\$\('mlib'\)/.test(js)); assert.match(js, /stageChoice\(Q\.get\('mlib'\)/); assert.match(js, /if\(choice\.id\)\{ const hit=window\.thrydLibrary/);
  const css = read('assets/projector.css'); assert.match(css, /#modes\{gap:10px;flex-wrap:wrap/); assert.match(css, /#modes input\[type=file\]\{display:none!important\}/);
  const ux = read('assets/ux.js'); assert.match(ux, /aria-label/); assert.match(ux, /e\.key === '\?'/); assert.match(ux, /touchstart/);
});
test('africariyoki lyric and credit are dark on a light pill in both stage colours', () => {
  const css = read('assets/projector.css');
  assert.match(css, /body\.stage-white #yoki_line,body\.stage-white #lofi_credit\{color:#111!important;background:rgba\(255,255,255,\.78\)/);
  assert.match(css, /#yoki_line\{opacity:\.95!important/);
});
test('the + GIF button and its handler are gone; saved GIFs still mount', () => {
  const x = read('assets/extras.js'); assert.ok(!/\$\('addgif'\)|\$\('gifin'\)/.test(x)); assert.match(x, /all\(\)\.then\(gs=>gs\.forEach\(mount\)\)/);
});
