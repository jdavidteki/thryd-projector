// podcasts page (17 Nov 2026): episodes are JSON rows; the player streams a same-origin 720p web copy under podcasts/media/
// (Pages serves video/mp4 with ranges, which iOS Safari plays inline); the GitHub Release keeps the full-quality file and is the fallback
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import { execSync } from 'node:child_process';
const doc = JSON.parse(fs.readFileSync(new URL('../data/podcasts.json', import.meta.url), 'utf8'));
const js = fs.readFileSync(new URL('../podcasts/podcasts.js', import.meta.url), 'utf8');
const here = p => new URL('../' + p, import.meta.url);
test('every episode plays a same-origin web copy and keeps the release as full quality', () => {
  assert.ok(doc.episodes.length >= 1);
  for(const e of doc.episodes){ for(const k of ['id', 'title', 'date', 'length', 'video', 'video_release', 'cover', 'transcript', 'release']) assert.ok(e[k], e.id + ' ' + k);
    assert.match(e.video, /^podcasts\/media\/[\w.-]+\.mp4$/); assert.ok(fs.statSync(here(e.video)).size < 50 * 1024 * 1024, e.video + ' under 50 MB');
    assert.match(e.video_release, /^https:\/\/github\.com\/jdavidteki\/thryd-projector\/releases\/download\//);
    if(e.teaser){ assert.match(e.teaser, /^podcasts\/media\//); assert.ok(fs.statSync(here(e.teaser)).size < 5 * 1024 * 1024); assert.match(e.teaser_release, /\/releases\/download\//); }
    assert.ok(fs.existsSync(here(e.cover)), e.cover); assert.ok(fs.existsSync(here(e.transcript)), e.transcript); }
  assert.ok(doc.episodes.filter(e => e.featured).length <= 1);
});
test('only web copies under podcasts/media/ are committed as video, each under 50 MB', () => {
  const ls = execSync('git ls-files', {cwd: new URL('..', import.meta.url)}).toString().split('\n').filter(f => /\.(mp4|mov|webm|mkv)$/.test(f));
  for(const f of ls){ assert.match(f, /^podcasts\/media\//, f); assert.ok(fs.statSync(here(f)).size < 50 * 1024 * 1024, f); }
});
test('player and teaser fall back to the release link; the transcript renders as text only', () => {
  assert.match(js, /addEventListener\('error', \(\) => \{ fb\.classList\.add\('on'\)/); assert.match(js, /const full = ep\.video_release \|\| rel\(ep\.video\)/);
  assert.match(js, /ta\.href = ep\.teaser_release \|\| rel\(ep\.teaser\)/); assert.ok(js.indexOf("tv.addEventListener('error'") < js.indexOf('tv.src = rel(ep.teaser)'));
  assert.doesNotMatch(js, /innerHTML/);
});
