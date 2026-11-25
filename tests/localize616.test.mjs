// v616: currency localization on the stage (assets/localize.js, the browser twin of thryd-db/localize.py).
// Shares tests/localize_cases.json with thryd-db/test_localize.py: both must give the same text for the same inputs.
import test from 'node:test';
import assert from 'node:assert';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const here = new URL('..', import.meta.url);
const rd = p => readFileSync(new URL(p, here), 'utf8');
const src = rd('assets/localize.js'), html = rd('index.html'), ver = JSON.parse(rd('data/version.json')), proj = rd('assets/projector.js'), stage = rd('assets/stage.js');
const cases = JSON.parse(rd('tests/localize_cases.json'));

function make({search = '', lang = 'en-US', tz = 'America/New_York', rates = null, fetchImpl = null, store = {}} = {}){
  const win = {location: {search}, navigator: {language: lang}, __thrydFxLoc: 'en-US', Intl: Object.assign(Object.create(Intl), {DateTimeFormat: () => ({resolvedOptions: () => ({timeZone: tz})})}),
    localStorage: {getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; }}, fetch: fetchImpl, document: fetchImpl ? {} : undefined, console};
  win.window = win; win.globalThis = win; vm.createContext(win); vm.runInContext(src, win);
  if(rates) win.ThrydLocalize._setRates({rates});
  return win;
}
const R = {USD: 1, NGN: 1500, GBP: 0.8, EUR: 0.9};

test('same answers as the python module on every shared case', () => {
  assert.ok(cases.length >= 50);
  for(const c of cases){ const w = make({search: '?cur=' + c.to, rates: c.rates}); assert.equal(w.ThrydLocalize.annotate(c.text), c.out, c.text); }
});
test('no rate -> text unchanged, never invented', () => {
  const w = make({search: '?cur=NGN'}); assert.equal(w.ThrydLocalize.annotate('The $36 is here'), 'The $36 is here'); assert.equal(w.ThrydLocalize.ready(), false);
  const w2 = make({search: '?cur=NGN', rates: {USD: 1, GBP: 0.8}}); assert.equal(w2.ThrydLocalize.annotate('The $36 is here'), 'The $36 is here');
});
test('?cur=XXX overrides, ?cur=off turns it off', () => {
  assert.equal(make({search: '?cur=gbp', rates: R}).ThrydLocalize.annotate('$36'), '$36 (≈£28.80)');
  assert.equal(make({search: '?x=1&cur=EUR', rates: R}).ThrydLocalize.annotate('$36'), '$36 (≈€32.40)');
  assert.equal(make({search: '?cur=off', rates: R}).ThrydLocalize.annotate('$36'), '$36');
  assert.equal(make({search: '?cur=none', rates: R}).ThrydLocalize.cur(), null);
});
test('the viewer locale picks the currency through Intl: region, then time zone, then NGN', () => {
  assert.equal(make({lang: 'en-NG'}).ThrydLocalize.cur(), 'NGN');
  assert.equal(make({lang: 'en-GB'}).ThrydLocalize.cur(), 'GBP');
  assert.equal(make({lang: 'fr-FR'}).ThrydLocalize.cur(), 'EUR');
  assert.equal(make({lang: 'en-US'}).ThrydLocalize.cur(), 'USD');
  assert.equal(make({lang: 'en', tz: 'Africa/Accra'}).ThrydLocalize.cur(), 'GHS');
  assert.equal(make({lang: 'en', tz: 'Mars/Base'}).ThrydLocalize.cur(), 'NGN');
  assert.equal(make({lang: 'yo-NG'}).ThrydLocalize.annotate === undefined, false);
});
test('a US viewer sees dollars as they are (no note); a Lagos viewer sees naira', () => {
  assert.equal(make({lang: 'en-US', rates: R}).ThrydLocalize.annotate('The $36 is here'), 'The $36 is here');
  assert.equal(make({lang: 'en-NG', rates: R}).ThrydLocalize.annotate('The $36 is here'), 'The $36 (≈₦54,000) is here');
  assert.equal(make({lang: 'en-GB', rates: R}).ThrydLocalize.annotate('The $36 is here'), 'The $36 (≈£28.80) is here');
});
test('notes() returns only the note, so a verbatim tweet line can stay a text node', () => {
  const w = make({search: '?cur=NGN', rates: R});
  assert.deepEqual(w.ThrydLocalize.notes('#oyinboman — $36 sent for icecream?!'), ['$36 ≈ ₦54,000']);
  assert.deepEqual(w.ThrydLocalize.notes('nothing here'), []);
  assert.deepEqual(w.ThrydLocalize.notes('the line «$36 exact»'), []);
});
test('rates come from data/fx.json when fresh, and from open.er-api.com when it is old or missing', async () => {
  const urls = [], store = {};
  const fresh = {rates: {USD: 1, NGN: 1400}, date: '2026-11-25', fetched: new Date().toISOString(), source: 'open.er-api.com'};
  const f1 = u => { urls.push(u); return Promise.resolve({ok: true, json: () => Promise.resolve(fresh)}); };
  const w = make({search: '?cur=NGN', fetchImpl: f1, store}); await new Promise(r => setTimeout(r, 20));
  assert.equal(w.ThrydLocalize.ready(), true); assert.equal(w.ThrydLocalize.annotate('$10'), '$10 (≈₦14,000)'); assert.equal(urls.length, 1); assert.match(urls[0], /^data\/fx\.json/);
  const old = {...fresh, fetched: new Date(Date.now() - 40 * 3600e3).toISOString()}, urls2 = [];
  const f2 = u => { urls2.push(u); return Promise.resolve({ok: true, json: () => Promise.resolve(/er-api/.test(u) ? {result: 'success', rates: {USD: 1, NGN: 1366.83}} : old)}); };
  const w2 = make({search: '?cur=NGN', fetchImpl: f2, store: {}}); await new Promise(r => setTimeout(r, 20));
  assert.ok(urls2.some(u => /open\.er-api\.com/.test(u))); assert.equal(w2.ThrydLocalize.annotate('$10'), '$10 (≈₦13,668)');
  const f3 = () => Promise.reject(new Error('offline'));
  const w3 = make({search: '?cur=NGN', fetchImpl: f3, store: {}}); await new Promise(r => setTimeout(r, 20));
  assert.equal(w3.ThrydLocalize.annotate('$10'), '$10');
});
test('a cached browser table (< 12 h) is used with no network at all', async () => {
  const urls = [], store = {thryd_fx_v1: JSON.stringify({rates: {USD: 1, NGN: 1000}, at: Date.now() - 3600e3, date: '2026-11-25'})};
  const w = make({search: '?cur=NGN', fetchImpl: u => { urls.push(u); return Promise.reject(new Error('x')); }, store}); await new Promise(r => setTimeout(r, 10));
  assert.equal(urls.length, 0); assert.equal(w.ThrydLocalize.annotate('$2'), '$2 (≈₦2,000)');
});
test('wiring: loader, ticker and tweet popup use it; versions bumped; the tweet line stays a verbatim text node', () => {
  assert.match(html, /'localize\.js\?v=1'/); assert.match(html, /stage\.js\?v=\d+/);
  assert.ok(ver.v >= 616); assert.match(html, new RegExp('VER=' + ver.v + ','));
  assert.match(proj, /const fxA=/); assert.match(proj, /\$\('world'\)\.textContent=fxA\(world\)/);
  assert.match(stage, /fxNote\(q, tw\.text\)/); assert.match(stage, /createTextNode\('\\u00ab' \+ tw\.text \+ '\\u00bb '\)/);
  assert.doesNotMatch(stage, /tw\.text \+ ' \('/);
});
test('the module is inert without a rate and cheap: one fetch at load, no timers, no observers', () => {
  assert.doesNotMatch(src, /setInterval|MutationObserver|requestAnimationFrame/);
});
