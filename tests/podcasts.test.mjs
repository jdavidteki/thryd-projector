// podcasts page (17 Nov 2026 3:19 PM ET): episodes are JSON rows, files live on GitHub Releases, never in the repo
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import { execSync } from 'node:child_process';
const doc = JSON.parse(fs.readFileSync(new URL('../data/podcasts.json', import.meta.url), 'utf8'));
const js = fs.readFileSync(new URL('../podcasts/podcasts.js', import.meta.url), 'utf8');
test('every episode row points at release assets and a transcript in the repo', () => {
  assert.ok(doc.episodes.length >= 1);
  for(const e of doc.episodes){ for(const k of ['id', 'title', 'date', 'length', 'video', 'cover', 'transcript', 'release']) assert.ok(e[k], e.id + ' ' + k);
    assert.match(e.video, /^https:\/\/github\.com\/jdavidteki\/thryd-projector\/releases\/download\//); assert.ok(fs.existsSync(new URL('../' + e.cover, import.meta.url)), e.cover); assert.match(e.cover_release, /\/releases\/download\//);
    assert.ok(fs.existsSync(new URL('../' + e.transcript, import.meta.url)), e.transcript); }
  assert.ok(doc.episodes.filter(e => e.featured).length <= 1);
});
test('no video files are committed', () => { const ls = execSync('git ls-files', {cwd: new URL('..', import.meta.url)}).toString(); assert.doesNotMatch(ls, /\.(mp4|mov|webm|mkv)$/m); });
test('the player falls back to a direct link and the transcript renders as text only', () => {
  assert.match(js, /addEventListener\('error', \(\) => \{ fb\.classList\.add\('on'\)/); assert.doesNotMatch(js, /innerHTML/);
});
