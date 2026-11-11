#!/usr/bin/env python3
"""Append converted packs to an existing cut manifest. No original files.

The parent manifest is read, not rewritten by hand. Packs stay unreviewed.
This marks manifest rows ready only in the output file. A budget_failed
stub is skipped and is not published.

  python3 tools/medium_cut_manifest.py \
    --parent data/medium_cuts.json \
    --packs CONVERTED \
    --out /tmp/medium_cuts.json

  python3 tools/medium_cut_manifest.py --parent PARENT --packs CONVERTED --check
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from medium_cut_batch import assert_plate_bytes

SKIP = ("budget_failed", "failed", "partial")


def validate_pack(pack):
    status = pack.get("status")
    if status in SKIP:
        return "skip", status
    if status != "unreviewed" or pack.get("reviewed") is not False:
        raise ValueError("status")
    if pack.get("object_id") or pack.get("state_id") or pack.get("run") or pack.get("card"):
        raise ValueError("agenda")
    prov = pack.get("provenance") if isinstance(pack.get("provenance"), dict) else {}
    if prov.get("engine_id") is not None or prov.get("inpaint") is not False:
        raise ValueError("provenance")
    mid = pack.get("medium_image_id")
    if not isinstance(mid, str) or not mid or not pack.get("source_sha256"):
        raise ValueError("identity")
    kind = pack.get("kind")
    if kind == "gif":
        delays = pack.get("delays_cs") or []
        if len(delays) < 1:
            raise ValueError("delays")
        objects = pack.get("objects") or []
        if not objects:
            raise ValueError("no_object")
        for obj in objects:
            if obj.get("object_id") or obj.get("state_id"):
                raise ValueError("object id")
            count = obj.get("mask_count") if obj.get("masks_deflate") else len(obj.get("masks") or [])
            if count != len(delays):
                raise ValueError("mask_count")
    elif kind != "still":
        raise ValueError("kind")
    assert_plate_bytes(pack)
    return "ok", None


def row_for(pack, filename):
    mid = pack["medium_image_id"]
    return {
        "medium_image_id": mid,
        "kind": pack.get("kind"),
        "status": "ready",
        "reviewed": False,
        "review": {
            "provisional": True,
            "clean": False,
            "browser_verified": False,
            "rough_cut": True,
            "holes_ok": True,
            "frame_identity_checked": True,
            "pixels_at_rest_checked": True,
            "timing_checked": True,
            "note": "Provisional rough cut. Existing masks kept. Plate is only observed background, otherwise transparent. Not publicly browser-verified yet.",
        },
        "source_sha256": pack["source_sha256"],
        "frame_size": pack.get("frame_size"),
        "delays_cs": pack.get("delays_cs"),
        "pack": "assets/medium_cuts/" + filename,
        "mlib": mid,
        "select": "?mlib=" + mid.replace("*", "%2A"),
        "url": "https://miro.medium.com/" + mid,
    }


def build(parent, packs_dir):
    out = json.loads(json.dumps(parent))
    have = {a.get("medium_image_id") for a in out.get("assets") or []}
    added = []
    skipped = []
    for name in sorted(os.listdir(packs_dir)):
        if not name.endswith(".json") or name.startswith("_") or name == "state.json":
            continue
        pack = json.load(open(os.path.join(packs_dir, name)))
        action, why = validate_pack(pack)
        if action == "skip":
            skipped.append({"file": name, "reason": why})
            continue
        mid = pack["medium_image_id"]
        if mid in have:
            raise ValueError("already listed: " + mid)
        out.setdefault("assets", []).append(row_for(pack, name))
        have.add(mid)
        added.append(name)
    counts = dict(out.get("counts") or {})
    if "not_in_this_file" not in counts:
        raise ValueError("parent counts")
    counts["assets"] = len(out["assets"])
    counts["ready"] = sum(1 for a in out["assets"] if a.get("status") == "ready")
    counts["not_in_this_file"] = counts["not_in_this_file"] - len(added)
    if counts["not_in_this_file"] < 0:
        raise ValueError("not_in_this_file")
    out["counts"] = counts
    return out, {"added": added, "skipped": skipped, "ready": counts["ready"]}


def main(argv=None):
    ap = argparse.ArgumentParser(description="Build a cut manifest from converted packs. No originals.")
    ap.add_argument("--parent", required=True)
    ap.add_argument("--packs", required=True)
    ap.add_argument("--out")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args(argv)
    parent = json.load(open(args.parent))
    try:
        doc, summary = build(parent, args.packs)
    except ValueError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        return 1
    print(json.dumps({"ok": True, "ready": summary["ready"], "added": len(summary["added"]), "skipped": len(summary["skipped"])}))
    if args.check:
        return 0
    if not args.out:
        print("pass --out or --check", file=sys.stderr)
        return 2
    json.dump(doc, open(args.out, "w"), indent=1)
    open(args.out, "a").write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
