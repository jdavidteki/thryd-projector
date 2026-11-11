#!/usr/bin/env python3
"""Dump the live state of the NEWEST agenda run (newest /workspace/run-* with run/cards_posted.json; was hardcoded run-5a58c4) into data/state.json for the projector page.
READ-ONLY on thryd.db (sqlite mode=ro) and on the run files. Usage: export_state.py [--loop SECONDS] [--out PATH]"""
import json, os, re, sqlite3, sys, time, datetime, argparse
import glob
def _has_w(d):
    # a run with no posted scene card (wN) has nothing to show yet; keep the previous run live until it does
    try: return any(re.fullmatch(r"w\d+",k) for k in json.load(open(f"{d}/run/cards_posted.json")))
    except Exception: return False
def _seated(d):
    # runs without cards_posted.json still count once a w card is seated in answers.json
    if os.path.isfile(f"{d}/run/cards_posted.json"): return False
    try: return any(e.get("seated") for e in json.load(open(f"{d}/answers.json")).get("entries",[]))
    except Exception: return False
def newest_run():
    c=[d for d in glob.glob("/workspace/run-*") if re.fullmatch(r"run-[0-9a-z-]+",os.path.basename(d)) and (_has_w(d) or _seated(d))]
    act=lambda d:max(os.path.getmtime(f) for f in [f"{d}/run/cards_posted.json",f"{d}/events.jsonl",f"{d}/answers.json"] if os.path.exists(f))
    return os.path.basename(max(c,key=act)) if c else "run-5a58c4"
_E=os.environ.get("THRYD_RUN") or newest_run(); RUN=os.path.basename(_E.rstrip("/")); R=_E if os.path.isabs(_E) else f"/workspace/{RUN}";  # absolute THRYD_RUN = test copy
DB="/workspace/thryd-db/thryd.db"; TICK="/workspace/thryd-db/ticker.log"
HERE=os.path.dirname(os.path.abspath(__file__))
CAST={"marisol_5a58c4":"Marisol","teo_5a58c4":"Teo","calla_5a58c4":"Calla","dez_5a58c4":"Dez"}
# objects shown on the wall: (label, thryd.db id or None, regex used to find it in card prompts, default place)
OBJS=[("dress","dress_marisol_5a58c4",r"\bdress\b"),("logbook",None,r"\blogbook\b"),("cabin lamp",None,r"cabin lamp"),
      ("phone",None,r"\bphone\b"),("Calla's light",None,r"Calla'?s (light|lamp|window)"),("cabin door",None,r"cabin door"),
      ("sandal",None,r"\bsandals?\b"),("hose",None,r"\bhose\b"),("wet street",None,r"wet street|street (is|was) wet|rain")]
def rj(p,d=None):
    try: return json.load(open(p))
    except Exception: return d
def wn(c): m=re.match(r"[wj](\d+)$",c or ""); return int(m.group(1)) if m else None
def export():
    c=sqlite3.connect(f"file:{DB}?mode=ro",uri=True,timeout=10)
    cards=c.execute("select card,world_ts from card_ts where run=? order by world_ts",(RUN,)).fetchall()
    if not cards or RUN!="run-5a58c4": return export_files(c)
    cur=max((wn(k) or 0) for k,_ in cards) if cards else 0
    story_ts=max((t for _,t in cards),default=None)
    st={k:json.loads(v) for k,v in c.execute("select id,state from objects where id in (%s)"%",".join("?"*len(CAST)+",?"*0),list(CAST))}
    # walk the posted cards up to the current one; last known place per character / object
    who={n:{"place":None,"note":None,"card":None} for n in CAST.values()}; obj={o[0]:{"place":None,"card":None} for o in OBJS}
    scenes=[]
    for n in range(1,cur+1):
        job=rj(f"{R}/jobs/w{n}.json",{}) or {}; s=job.get("_story") or {}
        place=s.get("place"); prompt=job.get("prompt","")
        if not place:
            m=re.search(r"\n[^,\n]*?(?:am|pm)[^,\n]*,[^,\n]*,\s*([^,\n]+(?:,[^,\n]+)?)",prompt)
            place=m.group(1).strip() if m else None
        if place: place=re.split(r",\s*where\b",place)[0].strip()
        if not place or place.startswith("and the reality"): continue
        scenes.append({"card":f"w{n}","place":place,"world_time":s.get("world_time")})
        for e in s.get("cast") or job.get("_returning") and [] or []:
            name=e.split()[0] if isinstance(e,str) else None
            name=CAST.get(name,name)
            if name in who:
                note=re.search(r"\((.*)\)",e); note=note.group(1) if note else None
                p=place
                if note and re.search(r"by (phone|text)|offstage|on the ",note):
                    p=(note.split(",")[-1].strip() if "," in note else "elsewhere")
                who[name]={"place":p,"note":note,"card":f"w{n}"}
        for lab,_,rx in OBJS:
            if re.search(rx,prompt,re.I): obj[lab]={"place":place,"card":f"w{n}"}
    byc={x["card"]:x["place"] for x in scenes}
    for lab,plate in (("Calla's light","w12"),("hose","w6"),("phone","w12"),("wet street","w12"),("cabin lamp","w6"),("cabin door","w6"),("sandal","w6")):
        if not obj[lab]["place"]: obj[lab]={"place":byc.get(plate),"card":plate,"from":"live view "+plate.replace("w","j")}
    # projector drags (setlocation via the drag endpoint) override the card-walk place
    for lab,oid,_ in OBJS:
        r=c.execute("select state from objects where id=?",(oid or re.sub(r"[^a-z0-9]+","",lab.lower())+"_5a58c4",)).fetchone()
        dp=json.loads(r[0]).get("drag_place") if r else None
        if dp: obj[lab]={"place":dp,"card":obj[lab].get("card"),"from":"projector-drag"}
    for k,v in CAST.items():
        dp=st.get(k,{}).get("drag_place")
        if dp: who[v]={"place":dp,"note":"moved on the projector","card":who[v].get("card")}
    cur_place=scenes[-1]["place"] if scenes else None
    chars=[{"id":k,"name":v,"role":st.get(k,{}).get("role"),**who[v]} for k,v in CAST.items()]
    objects=[]
    for lab,oid,_ in OBJS:
        o={"label":lab,"db_id":oid,**obj[lab]}
        if oid:
            row=c.execute("select state from objects where id=?",(oid,)).fetchone()
            if row: s=json.loads(row[0]); o.update(color=s.get("color"),last_seen=s.get("last_seen"),rumples=s.get("rumples"))
        objects.append(o)
    # [[move]]: main db state updates per card (command_log), with the card's seated precisions (exact archive lines)
    ans=rj(f"{R}/answers.json",{}) or {}
    seated={}
    for e in ans.get("entries",[]):
        k=wn(e.get("job")) or wn(e.get("card"))
        if k and e.get("pick") and e.get("safe"): seated.setdefault(f"w{k}",[]).append({"line":e["pick"],"safe":e.get("safe"),"seat":e.get("seat")})
    moves=[]
    for card,cmd,eff,ts in c.execute("select card,command,effects,world_ts from command_log where run=? order by n",(RUN,)):
        try: v=json.loads(eff or "{}").get("value") or {}
        except Exception: v={}
        res=None
        if isinstance(v,dict): res=v.get("resolved_to") or v.get("theme") or (v.get("effect") if isinstance(v.get("effect"),str) else None)
        moves.append({"card":card,"world_ts":ts,"move":f"{card} · {cmd}"+(f" → {res}" if res else ""),"precisions":seated.get(card,[])})
    ev=[]
    try:
        for l in open(f"{R}/events.jsonl").readlines()[-12:]:
            e=json.loads(l); ev.append({"t":e.get("t"),"ev":e.get("ev"),"card":e.get("card"),"status":e.get("status")})
    except Exception: pass
    tick=None
    try:
        last=open(TICK).readlines()[-1]; tick={"wall":last.split()[0],"line":last.strip()[:240]}
    except Exception: pass
    return {"run":RUN,"exported_at":datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
            "story_time":story_ts,"story_time_label":scenes[-1]["world_time"] if scenes and scenes[-1]["world_time"] else story_ts,
            "current_card":f"w{cur}","current_place":cur_place,"ticker":tick,"seated_count":ans.get("seated"),"seats":ans.get("seats"),
            "characters":chars,"objects":objects,"locations":sorted({s["place"] for s in scenes}|{x["place"] for x in chars if x["place"]}),
            "scenes":scenes,"latest_seat":(lambda es:{k:es[-1].get(k) for k in ("seat","card","pick","safe","at")} if es else None)([e for e in ans.get("entries",[]) if e.get("seat")]),"moves":moves,"recent_events":ev}
# props named in scene prompts / typed commands: (state label, regex). {owner} = the prop owner's name when the prompt says "<Name>'s <prop>" / "his <prop>"
FOBJS=[("{owner}jacket",r"\bjacket\b"),("podcast mic",r"podcast mic|\bmic\b|microphone"),("boat/cooler",r"\bcooler\b|charter boat|\bboat\b"),
 ("blender",r"\bblender\b"),("key card",r"key ?card"),("hotel elevator",r"\belevator\b"),("cafecito",r"cafecito|\bcoffee\b|espresso"),
 ("croquetas",r"croquetas?"),("car keys",r"car keys|\bkeys\b"),("phone/footage",r"\bphone\b|footage|\bfilm(?:s|ing)?\b|\bclip\b|\bcam\b|🎥"),
 ("love letter",r"\b(?:love )?letter\b"),("lifeguard tower",r"lifeguard tower"),("sunglasses",r"sunglasses"),("earbuds",r"earbuds"),
 ("bottle",r"\bbottle\b"),("speaker",r"\bspeaker\b"),("menu",r"\bmenu\b"),("lounger",r"\blounger\b"),("velvet couch",r"velvet couch"),
 ("candle",r"\bcandles?\b"),("piano",r"\bpiano\b"),("skylights",r"\bskylights?\b"),("ferry",r"\bferry\b"),("sheet music",r"sheet music|\bscore\b"),("guitar",r"\bguitar\b"),("umbrella",r"\bumbrella\b"),("ring",r"\bring\b"),("laptop",r"\blaptop\b"),("book",r"\bbook\b")]
NOTOBJ={"drake","michaeljackson","mj","beyonce","rihanna","wizkid","davido","burnaboy","tems","the sky"}  # real people / not props: never labels
def files_objects(cp,scenes,names):
    """Objects from the current run's own files: posted cards' scene prompts + typed commands. Last card mentioning each wins (that's what moves them)."""
    byc={x["card"]:x for x in scenes}; obj={}; order=[]
    def at(v):
        if isinstance(v,dict): return v.get("at")
        m=re.match(r"(\d{4}-\d\d-\d\d(?: \d\d:\d\d)?)",str(v)); return m.group(1) if m else (str(v).replace("posted","").strip() or None)
    srcs=[]
    for k,v in cp.items():
        n=wn(k)
        if re.fullmatch(r"w\d+",k) and f"w{n}" in byc: srcs.append((n,0,f"w{n}",(rj(f"{R}/jobs/w{n}.json",{}) or {}).get("prompt",""),at(v),"card"))
        m=re.fullmatch(r"j(\d+)_pick",k)
        if m:
            txt=v.get("typed") or v.get("line") or "" if isinstance(v,dict) else re.sub(r"^\d{4}-\d\d-\d\d(?: \d\d:\d\d)?\s*","",str(v))
            if txt and txt!="claimed":
                c=int(m.group(1))+1 if f"w{int(m.group(1))+1}" in byc else int(m.group(1))  # jN pick plays out on card w(N+1)
                srcs.append((c,1,f"w{c}",txt,at(v),"typed"))
    low={x.lower() for x in names}
    for n,_,card,txt,ts,how in sorted(srcs):
        sc=byc.get(card)
        if not sc: continue
        if how=="typed": txt=re.sub(r"#?(?:thryd\.)?miracle\.target\(.*?assert\(.*?\)\s*\)","",txt,flags=re.I)  # a prophecy never moves its own object
        hits=[(lab,rx) for lab,rx in FOBJS if re.search(rx,txt,re.I)]
        if how=="typed":
            for x,meth in re.findall(r"\b([a-z]\w*)\.(set\w+)\(",txt,re.I):
                if x.lower() not in low and x.lower() not in NOTOBJ and x.lower()!="miracle": hits.append((x,None))
        for lab,rx in hits:
            if "{owner}" in lab:
                m=re.search(r"\b([A-Z][a-z]+)'s "+rx.strip("\\b"),txt)
                own=m.group(1) if m and m.group(1) in names else next((o["label"].split("'")[0] for o in obj.values() if o["label"].endswith("jacket")),None)
                lab=lab.replace("{owner}",f"{own}'s " if own else "")
            if lab not in obj: order.append(lab)
            prev=obj.get(lab)
            obj[lab]={"label":lab,"db_id":None,"place":sc["place"],"card":card,"world_time":sc.get("world_time"),"at":ts,"from":how,
                      "moves":(prev or {}).get("moves",0)+(1 if prev and prev["place"]!=sc["place"] else 0)}
    return [obj[l] for l in order]
def export_files(c=None):
    """DB lacks this run: build the same schema from the run's own files."""
    cp=rj(f"{R}/run/cards_posted.json",{}) or {}
    posted=sorted({wn(k) for k in cp if re.fullmatch(r"w\d+",k)}-{None})
    cur=posted[-1] if posted else 0
    if not cp:  # no cards_posted.json (e.g. run-0ae93c): last seated card + 1, if that card exists
        _a=[wn(e.get("card")) for e in (rj(f"{R}/answers.json",{}) or {}).get("entries",[]) if e.get("seated")]
        _a=max([x for x in _a if x] or [0]); cur=_a+1 if os.path.exists(f"{R}/jobs/w{_a+1}.json") else _a
    evs=[]
    try: evs=[json.loads(l) for l in open(f"{R}/events.jsonl") if l.strip()]
    except Exception: pass
    names=[]
    for e in reversed(evs):
        if e.get("ev")=="cardgen" and e.get("cast"): names=[x[0] if isinstance(x,list) else str(x).split()[0] for x in e["cast"]]; break
    if not names:  # cardgen events carry no cast (e.g. after #thryd.changereality): fall back to setup.json / the card's _returning
        names=(rj(f"{R}/setup.json",{}) or {}).get("cast_names") or (rj(f"{R}/jobs/w{cur}.json",{}) or {}).get("_returning") or []
    names=list(dict.fromkeys(names+((rj(f"{R}/setup.json",{}) or {}).get("cast_names") or [])))  # the whole setup cast, not only the last card's
    scenes=[]; cast_card={}
    rx=re.compile(r"^\s*(?:[jw]\d+:\s*)?(\d{1,2}(?::\d\d)?\s*[ap]m),\s*([^,\n]*\d{4}),\s*(.+?)(?:\.\s|\.$|$)",re.I|re.M)
    for n in range(1,cur+1):
        job=rj(f"{R}/jobs/w{n}.json",{}) or {}; pr=job.get("prompt","")
        m=rx.search(pr)
        if not m:  # no year in the opening ("7:40am, the same stop."): keep the last scene's date and, for "the same ...", its place
            m2=re.match(r"^\s*(?:[jw]\d+:\s*)?(\d{1,2}(?::\d\d)?\s*[ap]m),?\s*([^.\n]*)",pr,re.I)
            if not m2 or not scenes: continue
            prev=scenes[-1]; day=prev["world_time"].split(",",1)[1].strip() if "," in prev["world_time"] else ""
            rest=m2.group(2).strip()
            place=prev["place"] if (not rest or re.match(r"(?:the same|and |the lull|the first|the sun)",rest,re.I) or not re.match(r"(?:[A-Z]|the |a |an )",rest)) else re.split(r",\s*",rest)[0]
            scenes.append({"card":f"w{n}","place":place,"world_time":f"{m2.group(1)}, {day}".rstrip(", ")})
            for nm in names:
                if re.search(rf"\b(?:{re.escape(nm)}|{re.escape(nm.split()[0])})\b",pr): cast_card[nm]=(f"w{n}",place)
            continue
        rest=re.split(r",\s*(?:where|after|as|while)\b",m.group(3))[0].strip()
        parts=[x.strip() for x in rest.split(",")]
        keep=[]
        for x in parts:
            if keep and (" and " in x or not re.match(r"(?:[A-Z]|the |a |an )",x)): break
            keep.append(x)
        place=", ".join(keep[:3]) or rest
        scenes.append({"card":f"w{n}","place":place,"world_time":f"{m.group(1)}, {m.group(2).strip()}"})
        for nm in names:
            if re.search(rf"\b(?:{re.escape(nm)}|{re.escape(nm.split()[0])})\b",pr): cast_card[nm]=(f"w{n}",place)
    suf=RUN.split("-",1)[1]
    chars=[{"id":f"{nm.lower()}_{suf}","name":nm,"role":None,"place":cast_card.get(nm,(None,None))[1],"note":None,"card":cast_card.get(nm,(None,None))[0]} for nm in names]
    ans=rj(f"{R}/answers.json",{}) or {}
    seated={}
    for e in ans.get("entries",[]):
        k=wn(e.get("job")) or wn(e.get("card"))
        if k and e.get("pick") and e.get("safe"): seated.setdefault(f"w{k}",[]).append({"line":e["pick"],"safe":e.get("safe"),"seat":e.get("seat")})
    moves=[]
    for k,v in cp.items():
        m=re.fullmatch(r"j(\d+)_pick",k)
        if not m: continue
        n=int(m.group(1)); ts=None
        if isinstance(v,dict): ts=v.get("at"); txt=v.get("typed") or v.get("pick") or ""
        else:
            mm=re.match(r"(\d{4}-\d\d-\d\d(?: \d\d:\d\d)?)\s*(.*)",str(v)); ts,txt=(mm.group(1),mm.group(2)) if mm else (None,str(v))
        if not txt or txt=="claimed": continue
        job=rj(f"{R}/jobs/w{n}.json",{}) or {}
        labs=[o.get("label") for o in job.get("options",[]) if isinstance(o,dict) and o.get("label") and o["label"].split()[0] in txt]
        moves.append({"card":f"w{n}","world_ts":ts,"move":f"w{n} · {txt}"+(f" → {'; '.join(labs)}" if labs else ""),"precisions":seated.get(f"w{n}",[])})
    if not moves and not cp:  # no cards_posted.json: the seated picks in answers.json are the moves (exact lines, no 🎥)
        for e in ans.get("entries",[]):
            k=wn(e.get("card"))
            if not k or not e.get("seated"): continue
            for ln in [x for x in (e.get("picks") or []) if x and x!="🎥"]+(e.get("typed") or []):
                moves.append({"card":f"w{k}","world_ts":None,"move":f"w{k} · {ln}","precisions":[]})
    ev=[{"t":e.get("t"),"ev":e.get("ev"),"card":e.get("card"),"status":e.get("status")} for e in evs[-12:]]
    tick=None
    try: last=open(TICK).readlines()[-1]; tick={"wall":last.split()[0],"line":last.strip()[:240]}
    except Exception: pass
    sc=scenes[-1] if scenes else {}
    return {"run":RUN,"exported_at":datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
            "story_time":sc.get("world_time"),"story_time_label":sc.get("world_time"),
            "current_card":f"w{cur}","current_place":sc.get("place"),"ticker":tick,"seated_count":ans.get("seated"),"seats":ans.get("seats"),
            "characters":chars,"objects":(objs:=files_objects(cp,scenes,names)),"locations":sorted({s["place"] for s in scenes}|{o["place"] for o in objs}),"scenes":scenes,
            "latest_seat":(lambda es:{k:es[-1].get(k) for k in ("seat","card","pick","safe","at")} if es else None)([e for e in ans.get("entries",[]) if e.get("seat")]),
            "moves":moves,"recent_events":ev}
def foreshadows():
    """READ-ONLY view of <run>/foreshadows.json (owned by /workspace/thryd-db/foreshadow.py, which alone decides paid_off),
    plus the projector drop spot from run/miracle_targets.json and, for paid_off, the posted line that matched (looked up, never written)."""
    L=rj(f"{R}/foreshadows.json",[]) or []; drops=rj(f"{R}/run/miracle_targets.json",[]) or []
    names={n.lower():n for n in ((rj(f"{R}/setup.json",{}) or {}).get("cast_names") or [])}
    def evidence(f):
        n=wn(f.get("card")); texts=[]
        if n:
            for k in (f"w{n}",f"w{n+1}"):
                pr=(rj(f"{R}/jobs/{k}.json",{}) or {}).get("prompt","")
                if re.match(rf"\s*j{n}:",pr): texts.append(pr)
            for e in (rj(f"{R}/answers.json",{}) or {}).get("entries",[]):
                if wn(e.get("card"))==n: texts+= [x for x in (e.get("picks") or [])+(e.get("typed") or []) if isinstance(x,str)]
        for t in texts:
            for sent in re.split(r"(?<=[.!?])\s+",t):
                lo=sent.lower()
                if all(a in lo for a in f.get("actors",[])) and any(re.search(r"\b"+re.escape(w)+r"\b",lo) for w in f.get("words",[])): return sent.strip()[:300]
        return None
    out=[]
    for f in L:
        dr=next((x for x in reversed(drops) if (x.get("foreshadow") or {}).get("id")==f.get("id")),None)
        o={"id":f.get("id"),"actors":[names.get(a,a.title()) for a in f.get("actors",[])],"words":f.get("words"),"status":f.get("status"),"note":f.get("note"),
           "added":f.get("added"),"card":f.get("card"),"at":f.get("at"),
           "drop":{k:dr.get(k) for k in ("object","x","y","w","h","scene","scene_card","contact")} if dr else None}
        if f.get("status")=="paid_off": o["evidence"]=evidence(f)
        out.append(o)
    return {"source":"foreshadows.json (foreshadow.py)","open":[o for o in out if o["status"]=="open"],"paid_off":[o for o in out if o["status"]=="paid_off"]}
def write(out):
    d=export()
    try:  # prophecy targets (tools/miracles.py): open + fulfilled, from real state only
        sys.path.insert(0,os.path.join(HERE,"tools")); import miracles
        d["miracles"]=miracles.for_state(miracles.run(R,sys.modules[__name__]))
    except Exception as e: d["miracles"]={"open":[],"fulfilled":[],"targets":[],"error":str(e)[:200]}
    try: d["foreshadows"]=foreshadows()
    except Exception as e: d["foreshadows"]={"open":[],"paid_off":[],"error":str(e)[:200]}
    tmp=out+".tmp"; json.dump(d,open(tmp,"w"),indent=1,ensure_ascii=False); os.replace(tmp,out); return d
if __name__=="__main__":
    a=argparse.ArgumentParser(); a.add_argument("--loop",type=int,default=0); a.add_argument("--out",default=f"{HERE}/data/state.json"); a=a.parse_args()
    while True:
        try: d=write(a.out); print(d["exported_at"],d["current_card"],d["story_time"],flush=True)
        except Exception as e: print("export error:",e,flush=True)
        if not a.loop: break
        time.sleep(a.loop)
