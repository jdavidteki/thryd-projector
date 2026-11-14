import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = fs.readFileSync(path.join(root, 'assets/stage.js'), 'utf8');
const jsonPath = path.join(root, 'data/live_views.json');

test('stage.js keeps a 2.5× live-view dwell and a 45s poll', () => {
  assert.match(src, /const LIVE_DWELL_K = 2\.5/);
  assert.match(src, /const LIVE_POLL_MS = 45000/);
  assert.match(src, /const LIVE_KEEP = 3/);
  assert.match(src, /data\/live_views\.json/);
  assert.match(src, /setInterval\(pollLiveViews, LIVE_POLL_MS\)/);
  assert.match(src, /row\.live_view \? LIVE_DWELL_K : 1/);
});

test('live views jump the pending queue and do not write the no-repeat deck key', () => {
  assert.match(src, /newest live views go first/);
  assert.match(src, /thryd_seen_cuts_v1/);
  // enqueue / spawn live path never calls saveSeen or SEEN.add
  const liveBlock = src.slice(src.indexOf('// ---------- live views (data/live_views.json'), src.indexOf('async function spawnOne()'));
  assert.ok(liveBlock.length > 200);
  assert.doesNotMatch(liveBlock, /SEEN\.add|saveSeen\(/);
  assert.match(src, /if\(LV\.pending\.length\)/);
  assert.match(src, /enqueueLive\(v, true\)/);
  assert.match(src, /roomForLive\(/);
});

test('cartoon, preview, plate, src and diff views are refused', () => {
  assert.match(src, /cartoon\|preview\|plate\|_src\|_diff/);
  assert.match(src, /\^j\\d\+\$/);
});

test('data/live_views.json lists the photoreal run-9e3e84 finals and no rejected names', () => {
  const d = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  assert.equal(d.active_run, 'run-b9b963');
  assert.ok(Array.isArray(d.views) && d.views.length >= 3);
  const ids = d.views.map(v => v.run + '/' + v.card);
  assert.ok(ids.includes('run-9e3e84/j2'));
  assert.ok(ids.includes('run-9e3e84/j6'));
  assert.ok(ids.includes('run-9e3e84/j8'));
  for (const v of d.views) {
    assert.match(v.card, /^j\d+$/);
    assert.doesNotMatch(v.url, /cartoon|preview|plate|_src|_diff/i);
    assert.ok(v.bytes > 0 && v.bytes <= (d.max_bytes || 3 * 1024 * 1024));
    const abs = path.join(root, v.url);
    assert.equal(fs.statSync(abs).size, v.bytes);
  }
  // newest first
  const times = d.views.map(v => v.mtime);
  assert.deepEqual(times, [...times].sort((a, b) => b - a));
});
