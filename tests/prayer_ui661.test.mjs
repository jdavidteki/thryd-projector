// v661 prayer UI: static checks on assets/job_card.js (behaviour is covered by the headless run in /workspace/ux_prayer)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const js = fs.readFileSync(new URL('../assets/job_card.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('v661: prayer answers are held (no pill, optimistic move to the back) and Send all is its own button', () => {
  assert.match(js, /function isPrayerAns\(v\)\{ return [\s\S]*?yes\|maybe\|no/);
  assert.match(js, /if\(isPrayerAns\(o\.value\)\)\{[^}]*prayerLocal\(o\)/);
  assert.match(js, /function prayerLocal\(o\)\{[\s\S]*s\.cards\.push\(c\); prayerRecount\(s\)/);
  assert.match(js, /className = 'psend'/);
  assert.match(js, /prayerHeader\(c\)\{ return '\\ud83d\\ude4f Prayer jobs \\u00b7 ' \+ c\.answered \+ ' answered \\u00b7 ' \+ c\.listed \+ ' listed'/);
});
test('v661: Yes/Maybe/No buttons are equal width; no Menu button is wired on prayer cards; prayer taps skip the 2-minute local drop', () => {
  assert.match(js, /#aisheet \.pcard \.popts button\{flex:1 1 0;min-width:0/);
  assert.match(js, /!isPrayerVal\(o\.value\) && menuRecent\(run, o\.value\)/);
});
test('v661: send-all and pager share one row on short screens; page is kept across re-pushes; nothing grows past the menu', () => {
  assert.match(js, /@media \(max-height:640px\)\{#aisheet \.psend small\{display:none\}#aisheet \.pbar\{flex-direction:row/);
  assert.match(js, /const id = 'prayers';/);
});
test('v661: loader and version', () => {
  assert.match(html, /job_card\.js\?v=25/);
  assert.match(html, /var VER=661/);
});
