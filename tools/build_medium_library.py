#!/usr/bin/env python3
"""Append original Medium CDN images to data/live_extra.json.

Local frame sets already in the file are kept as-is. Remote rows use the
observed representative_url only. They are not split into webp frames.
run is safe-<medium id> so these rows are not the current agenda's NEWEST().
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAR = re.compile(r"^(\d)_(.+\.(?:gif|png|jpe?g))$", re.I)

def local_media_id(src):
    base = os.path.basename(src or "")
    m = STAR.match(base)
    if not m:
        return None
    return f"{m.group(1)}*{m.group(2)}"

def remote_set(item):
    mid = item["medium_image_id"]
    url = item["representative_url"]
    ext = item["extension"]
    safes = item.get("safes") or []
    return {
        "dir": "medium/" + mid,
        "how": "medium",
        "remote": True,
        "url": url,
        "medium_image_id": mid,
        "extension": ext,
        "animated": ext == "gif",
        "frames": 1,
        "label": mid,
        "run": "safe-" + mid,
        "card": None,
        "jN": None,
        "src": url,
        "provenance": {
            "representative_url": url,
            "in_prior_518_manifest": bool(item.get("in_prior_518_manifest")),
            "safe_ids": [s.get("safe_id") for s in safes if isinstance(s, dict) and s.get("safe_id")],
            "safe_titles": [s.get("title") for s in safes if isinstance(s, dict) and s.get("title")],
        },
    }

def merge(existing, media):
    by_id = {m.get("medium_image_id"): m for m in media}
    deduped = []
    for s in existing:
        if not str(s.get("run") or "").startswith("safe-"):
            continue
        mid = local_media_id(s.get("src"))
        if mid and mid in by_id and by_id[mid].get("representative_url"):
            deduped.append({"medium_image_id": mid, "dir": s.get("dir"), "src": s.get("src")})
    have = {d["medium_image_id"] for d in deduped}
    excluded, added = [], []
    for item in media:
        mid = item.get("medium_image_id")
        url = item.get("representative_url")
        ext = item.get("extension")
        if not url or not ext or not mid:
            excluded.append({"medium_image_id": mid, "reason": "no representative_url"})
            continue
        if not url.startswith("https://miro.medium.com/") or url.rstrip("/").split("/")[-1] != mid:
            raise SystemExit("url is not an observed miro url for " + mid)
        if mid in have:
            continue
        added.append(remote_set(item))
        have.add(mid)
    return existing + added, {"deduped_local": deduped, "excluded": excluded, "added": added}

def main():
    audit_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "data", "full_author_body_media.json")
    live_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "data", "live_extra.json")
    audit = json.load(open(audit_path, encoding="utf-8"))
    live = json.load(open(live_path, encoding="utf-8"))
    existing = live["sets"]
    merged, report = merge(existing, audit["media"])
    added = report["added"]
    out = {
        "note": live.get("note") or "Extra Live-loop backdrops.",
        "sets": merged,
    }
    # keep the original note and every pre-existing set object
    if merged[:len(existing)] != existing:
        raise SystemExit("existing sets were modified")
    json.dump(out, open(live_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    lib = {
        "note": "Original Medium CDN sets appended to live_extra. Local frame sets are not in this list.",
        "counts": {
            "audit_unique": len(audit["media"]),
            "excluded": len(report["excluded"]),
            "usable": len(audit["media"]) - len(report["excluded"]),
            "existing_local_sets": len(existing),
            "existing_safe_local": sum(1 for s in existing if str(s.get("run") or "").startswith("safe-")),
            "deduped_already_local": len(report["deduped_local"]),
            "added_remote": len(added),
            "added_remote_gif": sum(1 for s in added if s["extension"] == "gif"),
            "added_remote_stills": sum(1 for s in added if s["extension"] != "gif"),
            "live_extra_total": len(merged),
        },
        "excluded": report["excluded"],
        "deduped_local": report["deduped_local"],
        "sets": added,
    }
    lib_path = os.path.join(HERE, "data", "medium_library.json")
    json.dump(lib, open(lib_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(json.dumps(lib["counts"]))

if __name__ == "__main__":
    main()
