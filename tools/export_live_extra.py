#!/usr/bin/env python3
"""Export original #thryd live-view GIFs from /workspace/*run*/ into data/live_extra.json (run by sync_pages.sh).
One set per (run, jN): prefer *_clean, then latest _vN, then newest. Frames = the src GIF verbatim (lossless webp, GIF durations); no clean-still/unblur re-rendering. Incremental: re-exports only when the chosen source changes.

Remote Medium originals (how=medium) are not local frames. They stay in the JSON across re-exports and are never deleted as missing frame directories.
"""
import json,os,glob,re,shutil,sys

OUT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); M=f"{OUT}/data/live_extra.json"
SKIP_RUNS=set(); SKIP_PAIRS={("run-5a58c4","j6"),("run-5a58c4","j12")}  # already main backdrops
NAME=re.compile(r"^(?:liveview_)?([jwm]\d+)(?:_live|_view|_takeshot_live)?(?:_v(\d+)|_real(_clean)?)?\.gif$")

def is_remote(s):
    return isinstance(s, dict) and (s.get("how")=="medium" or s.get("remote") is True) and s.get("url") and s.get("medium_image_id") and str(s.get("dir") or "").startswith("medium/")

def retain_remote(previous, local_sets):
    """Keep already-recorded Medium originals. Do not rewrite them and do not require frame files."""
    have={s.get("dir") for s in local_sets}
    kept=[]
    for s in previous or []:
        if is_remote(s) and s.get("dir") not in have:
            kept.append(s); have.add(s.get("dir"))
    return local_sets + kept

def gif_frames(g):
    # the requested live view, verbatim: every GIF frame in order, with its own duration. Never re-rendered/unblurred/composited.
    from PIL import Image,ImageSequence
    im=Image.open(g); fr,durs=[],[]
    for f in ImageSequence.Iterator(im):
        fr.append(f.convert("RGBA")); durs.append(int(f.info.get("duration",im.info.get("duration",100)) or 100))
    return fr,durs

def main():
    pick={}
    for g in glob.glob("/workspace/*run*/**/*.gif",recursive=True):
        run=g.split("/")[2]; b=os.path.basename(g); m=NAME.match(b)
        if not m or run in SKIP_RUNS or "_blur" in b or "/assets/" in g: continue
        k=(run,m.group(1))
        if k in SKIP_PAIRS: continue
        rank=(bool(m.group(3)),int(m.group(2) or 0),os.path.getmtime(g))
        if k not in pick or rank>pick[k][0]: pick[k]=(rank,g)
    D=json.load(open(M)) if os.path.exists(M) else {"sets":[]}
    old={s["dir"]:s for s in D["sets"]}; sets=[]; added=0
    items=[(f"assets/webp/live/{run}_{j}",run,j,rank,g) for (run,j),(rank,g) in sorted(pick.items())]
    # every other unique posted live-view GIF on the box (data/live_extra_inventory.json, deduped by sha256), one set each
    INV=f"{OUT}/data/live_extra_inventory.json"
    if os.path.exists(INV):
        used={g for *_,g in items}; dirs={i[0] for i in items}
        for x in json.load(open(INV))["gifs"]:
            if set(x["all_paths"])&used or (x["run"],x["card"]) in SKIP_PAIRS: continue
            g=next((p for p in x["all_paths"] if os.path.exists(p)),None)
            d=f"assets/webp/live/{x['run']}_{x['card']}"
            if d in dirs: d+="_"+x["hash"][:6]
            dirs.add(d)
            if g is None:  # source gone from box: keep the already-exported frames
                if d in old: sets.append(old[d])
                continue
            items.append((d,x["run"],x["card"],(False,0,os.path.getmtime(g)),g))
    for d,run,j,rank,g in items:
        o=old.get(d)
        if o and o.get("src")==g and o.get("mtime")==int(rank[2]) and o.get("how")=="gif" and "clean" not in o and os.path.exists(f"{OUT}/{d}/f000.webp"): o.setdefault("card",j); sets.append(o); continue
        try:
            fr,durs=gif_frames(g)
            shutil.rmtree(f"{OUT}/{d}",ignore_errors=True); os.makedirs(f"{OUT}/{d}")
            for k,f in enumerate(fr): f.save(f"{OUT}/{d}/f{k:03d}.webp",lossless=True,quality=100,method=4)
            sets.append(dict(dir=d,frames=len(fr),ms=round(sum(durs)/len(durs)),durs=durs,label=f"{run} · {j}",run=run,card=j,jN=j,src=g,how="gif",mtime=int(rank[2]))); added+=1
        except Exception as e: print("skip",g,e)
    sets=retain_remote(D.get("sets") or [], sets)
    keep={s["dir"] for s in sets}
    for p in glob.glob(f"{OUT}/assets/webp/live/*"):
        rel=os.path.relpath(p,OUT)
        if rel not in keep: shutil.rmtree(p)
    D={"note":D.get("note") or "Extra Live-loop backdrops: original #thryd live-view GIFs. Read by projector.js livePool().","sets":sets}
    json.dump(D,open(M,"w"),indent=1); print("live_extra: +%d local (total %d, remote kept %d)"%(added,len(sets),sum(1 for s in sets if is_remote(s))))

if __name__=="__main__":
    main()
