import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = fs.readFileSync(path.join(root, 'assets/stage.js'), 'utf8');
const jsonPath = path.join(root, 'data/live_views.json');

test('stage.js keeps a 4× live-view dwell (v646, was 2.5×) and a 45s poll', () => {
  assert.match(src, /const LIVE_DWELL_K = 4;/);
  assert.match(src, /const LIVE_POLL_MS = 45000/);
  assert.match(src, /const LIVE_KEEP = 3/);
  assert.match(src, /data\/live_views\.json/);
  assert.match(src, /setInterval\(pollLiveViews, LIVE_POLL_MS\)/);
  assert.match(src, /row\.live_view \? LIVE_DWELL_K : \(\(L\.hasAnim \|\| L\.animated\) \? ANIM_DWELL_K : 1\)/);
  assert.match(src, /const ANIM_DWELL_K = 3\.5;/);
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

test('data/live_views.json is newest-first, names are clean, and the active run leads', () => {
  const d = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  assert.ok(d.active_run && typeof d.active_run === 'string');
  assert.ok(Array.isArray(d.views) && d.views.length >= 3);
  const ids = d.views.map(v => v.run + '/' + v.card);
  // historical photoreal finals still in the mixed archive
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
  // the newest view of the active agenda is listed first among that run (the file may mix older agendas)
  const ofActive = d.views.filter(v => v.run === d.active_run && /^j\d+$/.test(v.card));
  assert.ok(ofActive.length >= 1);
  const newest = ofActive.slice().sort((a, b) => (b.mtime || 0) - (a.mtime || 0))[0];
  assert.equal(ofActive[0].id, 'live:' + d.active_run + ':' + ofActive[0].card);
  assert.equal(ofActive[0].id, newest.id);
  assert.equal(d.views[0].id, newest.id);
});

test('stage.js always centres the newest active live view, with no walk-in, and never mixes older agendas at its expense', () => {
  assert.match(src, /function newestLive\(\)/);
  assert.match(src, /function isNewestId\(/);
  assert.match(src, /if\(isNewestId\(id\)\) return false/);
  assert.match(src, /!isNewestGroup\(g\)/);
  assert.match(src, /opts && opts.center/);
  assert.match(src, /newest active live view appears in place \(no off-screen walk-in\)/);
  assert.match(src, /mixing never delays or replaces it/);
  assert.match(src, /if\(newest && !liveOn\(liveId\(newest\)\)\)\{ S\.bad\.ok\(liveId\(newest\)\); return newest; \}/);
  assert.match(src, /if\(newest && liveOn\(liveId\(newest\)\) && Math\.random\(\) < 0\.35\)/);
  assert.match(src, /isNewestId\(id\) && \(why === 'cap' \|\| S\.bad\.isNet\(why\) \|\| why === 'live_view_fetch'\)/);
  assert.match(src, /if\(newest\) enqueueLive\(newest, true\)/);
  assert.match(src, /if\(newest && !liveOn\(liveId\(newest\)\)\) enqueueLive\(newest, true\)/);
});

test('a bad or empty live_views payload, a fetch error, or a held network must not empty the stage', () => {
  assert.match(src, /empty payload ignored/);
  assert.match(src, /if\(isNewestId\(id\)\){ note\('live view keep'/);
  assert.match(src, /isNewestId\(id\) && \(why === 'cap' \|\| S\.bad\.isNet\(why\) \|\| why === 'live_view_fetch'\)/);
  assert.match(src, /if\(isNewestGroup\(g\) \|\| netHeld\(\)\) g\.offSince = 0/);
  assert.match(src, /else if\(!netHeld\(\) && now - g\.born > g\.life/);
  assert.match(src, /keep the last good bank; a malformed export must not wipe it/);
});
