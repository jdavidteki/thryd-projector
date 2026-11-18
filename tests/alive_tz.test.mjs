import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = fs.readFileSync(path.join(root, 'assets/alive.js'), 'utf8');
test('LIVE clock ignores an unknown place or non-IANA tz instead of throwing', () => {
  assert.match(src, /const validTz=tz=>/);
  assert.match(src, /const z=validTz\(lt\.tz\);if\(z\)storyTz=z/);
  assert.match(src, /const tz=validTz\(storyTz\)\|\|'Africa\/Lagos'/);
  assert.match(src, /function tick\(\)\{const tz=validTz\(storyTz\)\|\|'Africa\/Lagos';try\{/);
});
test('a bad news item or a failed live_time load does not stop the badge or the ticker', () => {
  assert.match(src, /try\{return bulletin\(i\);\}catch\(e\)\{return null;\}/);
  assert.match(src, /catch\(e\)\{try\{tick\(\);\}catch\(e2\)\{\}\}/);
});
