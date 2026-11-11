#!/bin/bash
# Builds a publish copy of the projector into /workspace/thryd-pages and pushes changes.
SRC=/workspace/thryd-projector; DST=/workspace/thryd-pages
build() {
  { pgrep -f /workspace/thryd-drag/server.py && pgrep -f /workspace/thryd-drag/relay.py; } >/dev/null || bash /workspace/thryd-drag/restart.sh >/dev/null 2>&1
  python3 "$SRC/export_state.py" >/dev/null 2>&1 || true
  python3 "$SRC/tools/export_live_extra.py" >/dev/null 2>&1 || true
  bash "$SRC/tools/autocut_new.sh" >/dev/null 2>&1 || true
  python3 "$SRC/tools/export_cerebro.py" >/dev/null 2>&1 || true
  python3 "$SRC/tools/export_lovemap.py" >/dev/null 2>&1 || true
  mkdir -p "$DST"
  find "$DST" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
  tar -C "$SRC" -cf - --exclude=./shots --exclude='*.log' --exclude='*.py' --exclude=./tools \
    --exclude='thryd.db*' --exclude='*.db' --exclude=./PAGES_PLAN.md --exclude=./sync_pages.sh --exclude='*.out' . | tar -C "$DST" -xf -
  touch "$DST/.nojekyll"
  python3 "$SRC/tools/export_code_feed.py" "$DST/data/code_feed.json" >/dev/null 2>&1 || true
  python3 - "$DST" <<'PY'
import json,os,shutil,sys,re
D=sys.argv[1]; p=os.path.join(D,'data/replays.json'); d=json.load(open(p))
for r in d['runs']:
  out=[]
  for g in r.get('gifs',[]):
    src=g   # publish originals (unblurred), per Jesuye
    rel=f"assets/replays/{r['run']}/"+os.path.basename(src)
    os.makedirs(os.path.dirname(os.path.join(D,rel)),exist_ok=True)
    if os.path.exists(src): shutil.copy2(src,os.path.join(D,rel)); out.append(rel)
  r['gifs']=out
  for k in ('events_path','answers_path'): r.pop(k,None)
json.dump(d,open(p,'w'),indent=1)
js=os.path.join(D,'assets/projector.js'); s=open(js).read()
RAW="https://raw.githubusercontent.com/jdavidteki/thryd-projector/main/data/state.json"
helper="const LIVE_STATE=async()=>{try{const r=await fetch('%s?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw 0;return await r.json();}catch(e){return J('data/state.json');}};\n"%RAW
s=s.replace("J('data/state.json')","LIVE_STATE()")
if 'LIVE_STATE=' not in s: s=helper+s
open(js,'w').write(s)
# code version: hash of shipped assets -> data/codever.json + cache-bust CSS/JS; open pages reload themselves when it changes
import hashlib,glob,re
h=hashlib.md5()
for f in sorted(glob.glob(os.path.join(D,'assets','*.js'))+glob.glob(os.path.join(D,'assets','*.css'))+glob.glob(os.path.join(D,'assets','*.html'))):
  h.update(open(f,'rb').read())
cv=h.hexdigest()[:10]
json.dump({'v':cv},open(os.path.join(D,'data','codever.json'),'w'))
ip=os.path.join(D,'index.html'); t=open(ip).read()
t=re.sub(r'(assets/[\w.-]+\.(?:css|js))\?v=[\w]+',lambda m:m.group(1)+'?v='+cv,t)
t=t.replace('__CODEVER__',cv)
open(ip,'w').write(t)
PY
}
push() {
  cd "$DST" || return
  git add -A
  git diff --cached --quiet || git commit -qm "sync $(date -Iseconds)"
  # a rejected push used to fail silently (-q) and strand every later sync; keep this build as truth and fast-forward over remote
  git push -q origin main 2>>/tmp/thryd-sync-push.err || { git fetch -q origin && git merge -q -s ours --no-edit origin/main && git push -q origin main 2>>/tmp/thryd-sync-push.err; }
}
if [ "$1" = once ]; then build; push; exit; fi
# no flock: the drag servers restarted inside build() inherited the lock fd and held it forever
while true; do bash "$0" once; sleep 180; done
