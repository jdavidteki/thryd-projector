// The stage's #time line (Jesuye 15 Nov 2026 2:38 / 2:40 AM ET): precomputed by_scene time first, else the same stable
// FNV-1a placeholder the exporter writes (06:00-23:55, 5 min steps). Never random per tap.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../assets/stage.js', import.meta.url), 'utf8');
const grab = name => { const i = src.indexOf('function ' + name + '('); assert.ok(i >= 0, name); let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}' && --d === 0) break; } return src.slice(i, j + 1); };
const env = new Function('FO', grab('fnv1a') + grab('placeholderTime') + grab('timeOf') + '; return {placeholderTime, timeOf};');

test('placeholder matches the exporter and is stable', () => {
  const {placeholderTime} = env({by: {}});
  assert.equal(placeholderTime('1*UQolGv9h9_i7sWsk3lDLCA.gif'), '12:00');
  assert.equal(placeholderTime('1*RsUH6hRZMu8g1gDOm4UE_w.gif'), '06:25');
  for(let i = 0; i < 300; i++){ const t = placeholderTime('scene' + i); assert.equal(t, placeholderTime('scene' + i)); assert.ok(t >= '06:00' && t <= '23:55' && +t.slice(3) % 5 === 0, t); }
});

test('timeOf uses the precomputed scene time, else the placeholder, and caches per cut', () => {
  const FO = {by: {'live:run-9e3e84:j6': {time: '07:40', time_src: 'card'}}};
  const {timeOf, placeholderTime} = env(FO);
  assert.equal(timeOf({home: {mid: 'live:run-9e3e84:j6'}}), '07:40');
  assert.equal(timeOf({home: {mid: 'unknown-scene'}}), placeholderTime('unknown-scene'));
  assert.equal(timeOf({}), null);
  const c = {home: {mid: 'live:run-9e3e84:j6'}}; timeOf(c); FO.by['live:run-9e3e84:j6'].time = '09:00'; assert.equal(timeOf(c), '07:40');
});

test('tapped tag text is the name plus a #time line', () => {
  assert.ok(/t: tm \? n \+ '\\n#time: ' \+ tm : n/.test(src));
  assert.ok(/\.gn\.gt\{white-space:pre/.test(src));
});
