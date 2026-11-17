#!/usr/bin/env python3
"""Add a #thryd podcast episode: video files go on a GitHub Release of jdavidteki/thryd-projector (never in the repo);
the episode is one row in data/podcasts.json plus its transcript at data/podcasts/<id>.md.

  python3 tools/add_podcast.py RUN VIDEO TEASER COVER TRANSCRIPT [--title T] [--date YYYY-MM-DD] [--featured] [--tag TAG] [--publish]

TEASER may be '-' for none. COVER may be a .png/.jpg (a non-jpg is converted to a 1280-wide jpg).
Creates the release (or uploads/replaces assets on an existing one) with box `gh`, then appends or replaces the row.
--publish commits the two data files and pushes under the publish lock (data only, no version bump; never a force push).
"""
import argparse, datetime, json, os, re, shutil, struct, subprocess, sys, tempfile
REPO = 'jdavidteki/thryd-projector'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data', 'podcasts.json')
LOCK = '/workspace/thryd-projector/tools/data_publish.lock'

def sh(*a, check=True, **k):
    r = subprocess.run(list(a), capture_output=True, text=True, **k)
    if check and r.returncode: sys.exit('failed: %s\n%s%s' % (' '.join(a), r.stdout, r.stderr))
    return r

def slug(s): return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def duration(p):
    return float(sh('ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', p).stdout.strip())

def atoms(p):
    out = []
    with open(p, 'rb') as f:
        while True:
            h = f.read(8)
            if len(h) < 8: break
            n, t = struct.unpack('>I4s', h); out.append(t.decode('latin1'))
            if n == 1: n = struct.unpack('>Q', f.read(8))[0]; f.seek(n - 16, 1)
            elif n == 0: break
            else: f.seek(n - 8, 1)
    return out

def streamable(p, tmp, name):
    """inline <video> streaming needs the moov atom before mdat; remux (copy, no re-encode) when it isn't"""
    a = atoms(p)
    if 'moov' in a and 'mdat' in a and a.index('moov') < a.index('mdat'):
        if os.path.basename(p) == name: return p
        q = os.path.join(tmp, name); shutil.copyfile(p, q); return q
    q = os.path.join(tmp, name); sh('ffmpeg', '-v', 'error', '-y', '-i', p, '-c', 'copy', '-movflags', '+faststart', q); return q

def mmss(s): s = int(round(s)); return '%d:%02d' % (s // 60, s % 60)

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for x in ('run', 'video', 'teaser', 'cover', 'transcript'): ap.add_argument(x)
    ap.add_argument('--title'); ap.add_argument('--date'); ap.add_argument('--tag'); ap.add_argument('--id')
    ap.add_argument('--featured', action='store_true'); ap.add_argument('--publish', action='store_true')
    ap.add_argument('--notes', default='')
    a = ap.parse_args()
    for p in (a.video, a.cover, a.transcript) + (() if a.teaser == '-' else (a.teaser,)):
        if not os.path.isfile(p): sys.exit('missing file: ' + p)
    stem = slug(os.path.splitext(os.path.basename(a.video))[0])
    eid = a.id or slug(a.run + '-' + stem); tag = a.tag or 'podcast-' + eid
    title = a.title or ('%s · %s' % (a.run, stem))
    date = a.date or datetime.datetime.fromtimestamp(os.path.getmtime(a.video)).astimezone().date().isoformat()
    tmp = tempfile.mkdtemp(prefix='add_podcast_')
    files = {'video': streamable(a.video, tmp, stem + '.mp4')}
    if a.teaser != '-': files['teaser'] = streamable(a.teaser, tmp, stem + '_teaser.mp4')
    cov = os.path.join(tmp, stem + '_cover.jpg')
    if a.cover.lower().endswith(('.jpg', '.jpeg')): shutil.copyfile(a.cover, cov)
    else: sh('ffmpeg', '-v', 'error', '-y', '-i', a.cover, '-vf', "scale='min(1280,iw)':-2", '-q:v', '3', cov)
    files['cover'] = cov
    # the release: create it, or replace same-named assets on an existing one
    if sh('gh', 'release', 'view', tag, '-R', REPO, check=False).returncode == 0:
        sh('gh', 'release', 'upload', tag, '-R', REPO, '--clobber', *files.values())
    else:
        notes = a.notes or ('#thryd podcast · %s · %s. Episode page: https://jdavidteki.github.io/thryd-projector/podcasts/#%s' % (title, mmss(duration(files['video'])), eid))
        sh('gh', 'release', 'create', tag, '-R', REPO, '--target', 'main', '--title', '#thryd podcast · ' + title, '--notes', notes, *files.values())
    base = 'https://github.com/%s/releases/download/%s/' % (REPO, tag)
    os.makedirs(os.path.join(ROOT, 'data', 'podcasts'), exist_ok=True)
    shutil.copyfile(a.transcript, os.path.join(ROOT, 'data', 'podcasts', eid + '.md'))
    row = {'id': eid, 'run': a.run, 'title': title, 'date': date, 'duration_s': round(duration(files['video']), 1),
           'length': mmss(duration(files['video'])), 'video': base + os.path.basename(files['video']),
           'teaser': base + os.path.basename(files['teaser']) if 'teaser' in files else None,
           'teaser_length': mmss(duration(files['teaser'])) if 'teaser' in files else None,
           'cover': base + os.path.basename(cov), 'transcript': 'data/podcasts/' + eid + '.md',
           'release': 'https://github.com/%s/releases/tag/%s' % (REPO, tag), 'featured': bool(a.featured),
           'added': datetime.datetime.now().astimezone().isoformat(timespec='seconds')}
    try: doc = json.load(open(DATA))
    except FileNotFoundError: doc = {'episodes': []}
    eps = [e for e in doc.get('episodes', []) if e.get('id') != eid]
    if a.featured:
        for e in eps: e['featured'] = False
    eps.append(row); eps.sort(key=lambda e: (e.get('date', ''), e.get('added', '')), reverse=True)
    doc['episodes'] = eps; doc['updated'] = row['added']
    with open(DATA, 'w') as f: json.dump(doc, f, ensure_ascii=False, indent=1); f.write('\n')
    shutil.rmtree(tmp, ignore_errors=True)
    print(json.dumps(row, ensure_ascii=False, indent=1))
    if a.publish:
        sh('git', 'add', 'data/podcasts.json', row['transcript'], cwd=ROOT)
        sh('git', 'commit', '-qm', 'data: podcast episode %s (release %s); data only, no version bump' % (eid, tag), cwd=ROOT)
        sh('flock', LOCK, '-c', 'git pull -q --rebase --autostash && git push -q origin HEAD:main', cwd=ROOT)
        print('published')

if __name__ == '__main__': main()
