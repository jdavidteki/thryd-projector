#!/usr/bin/env python3
"""Observed plate from masks that already exist, then gzip compact.

This does not segment, does not grow a mask, and does not read or write
the published manifest. A budget_failed stub is skipped. Write to a
different directory from the raw packs.

  python3 tools/medium_cut_plate.py \
    --packs RAW_PACKS \
    --originals ORIGINALS \
    --out DEST

python3 tools/medium_cut_reconcile.py --in SRC --out DEST only gzip-compacts
a pack. It does not create a missing plate. Use this command for that.
"""
import argparse
import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from medium_cut_batch import (
    _pack_full,
    decode_gif,
    decode_still,
    expand_masks,
    reconcile_pack,
    repeated_plate,
    sha256_file,
    suppress_plate_islands,
    unpack_mask,
    wall_reference,
)


def original_path(originals, pack, filename):
    names = []
    mid = pack.get("medium_image_id") or ""
    if isinstance(mid, str) and mid:
        names.append(mid.replace("*", "_"))
    if filename.endswith(".json"):
        names.append(filename[:-5])
    for name in names:
        path = os.path.join(originals, name)
        if os.path.isfile(path):
            return path
    return None


def mask_specs(obj):
    if obj.get("masks"):
        return obj["masks"]
    if obj.get("masks_deflate"):
        return expand_masks(obj["masks_deflate"], obj.get("mask_count") or 0)
    return None


def plate_one(pack, path):
    kind = pack.get("kind")
    decoded = decode_gif(path) if kind == "gif" else decode_still(path)
    frames = [fr["rgba"] for fr in decoded["frames"]]
    h, w = decoded["height"], decoded["width"]
    if pack.get("frame_size") and list(pack["frame_size"]) != [w, h]:
        raise ValueError("frame_size")
    file_sha = sha256_file(path)
    if pack.get("source_sha256") and pack["source_sha256"] != file_sha:
        raise ValueError("source_sha256")
    if kind == "gif":
        delays = [fr["delay_cs"] for fr in decoded["frames"]]
        if pack.get("delays_cs") != delays:
            raise ValueError("delays_cs")
    objects = pack.get("objects") or []
    spec_rows = []
    for obj in objects:
        specs = mask_specs(obj)
        if not specs:
            raise ValueError("no_masks")
        spec_rows.append(specs)
    n = len(frames)
    if any(len(specs) != n for specs in spec_rows):
        raise ValueError("mask_count")
    unions = []
    for i in range(n):
        union = np.zeros((h, w), np.uint8)
        for specs in spec_rows:
            union |= unpack_mask(specs[i], w, h)
        unions.append(union)
        rest = np.zeros_like(frames[i])
        rest[union == 0] = frames[i][union == 0]
        rest[union == 1] = frames[i][union == 1]
        if int(np.abs(rest.astype(np.int16) - frames[i].astype(np.int16)).max()) != 0:
            raise ValueError("pixels")
    ref = wall_reference(frames, unions)
    if ref is None:
        known = np.zeros((h, w), np.uint8)
        plate = np.zeros((h, w, 4), np.uint8)
    else:
        plate, known, _need = repeated_plate(frames, ref)
    hole = np.zeros((h, w), np.uint8)
    for union in unions:
        hole |= union
    known_hole = suppress_plate_islands(known, hole)
    out = json.loads(json.dumps(pack))
    out["source_sha256"] = file_sha
    out["plate_known_hole_pixels"] = int(known_hole.sum())
    out["unknown_hole_pixels"] = int(int(hole.sum()) - int(known_hole.sum()))
    prov = out.get("provenance") if isinstance(out.get("provenance"), dict) else {}
    prov["plate"] = "official observed plate from the existing masks and this file; no resegmentation"
    prov["inpaint"] = False
    prov["engine_id"] = None
    out["provenance"] = prov
    for key in ("plate_gzip_b64", "plate_deflate_b64", "plate_known_bits", "plate_encoding"):
        out.pop(key, None)
    if int(known_hole.sum()):
        import base64
        import gzip
        raw = np.ascontiguousarray(plate).tobytes()
        out["plate_gzip_b64"] = base64.b64encode(gzip.compress(raw, 9)).decode("ascii")
        out["plate_known_bits"] = _pack_full(known_hole)
        out["plate_encoding"] = "gzip-rgba-v1"
    got = reconcile_pack(out)
    for src, obj in zip(spec_rows, got.get("objects") or []):
        back = expand_masks(obj["masks_deflate"], obj["mask_count"])
        if back != src:
            raise ValueError("mask pixel mismatch")
    return got


def skip_reason(pack):
    status = pack.get("status")
    if status in ("budget_failed", "failed", "partial"):
        return status
    if not pack.get("objects"):
        return "no_object"
    return None


def plate_dir(packs, originals, dest):
    os.makedirs(dest, exist_ok=True)
    rows = []
    errors = 0
    for name in sorted(os.listdir(packs)):
        if not name.endswith(".json") or name.startswith("_") or name == "state.json":
            continue
        src = os.path.join(packs, name)
        pack = json.load(open(src))
        why = skip_reason(pack)
        if why:
            rows.append({"file": name, "action": "skipped", "reason": why})
            continue
        path = original_path(originals, pack, name)
        if not path:
            rows.append({"file": name, "action": "error", "reason": "original_missing"})
            errors += 1
            continue
        try:
            got = plate_one(pack, path)
        except Exception as exc:
            rows.append({"file": name, "action": "error", "reason": str(exc)})
            errors += 1
            continue
        json.dump(got, open(os.path.join(dest, name), "w"))
        rows.append({
            "file": name,
            "action": "written",
            "bytes": os.path.getsize(os.path.join(dest, name)),
            "has_plate": bool(got.get("plate_gzip_b64")),
            "plate_known_hole_pixels": got.get("plate_known_hole_pixels"),
            "source_sha256": got.get("source_sha256"),
        })
    summary = {"written": sum(1 for r in rows if r["action"] == "written"), "errors": errors, "rows": rows}
    json.dump(summary, open(os.path.join(dest, "_plate_summary.json"), "w"), indent=1)
    return summary


def main(argv=None):
    ap = argparse.ArgumentParser(description="Plate and compact existing masks. No segmentation.")
    ap.add_argument("--packs", required=True)
    ap.add_argument("--originals", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args(argv)
    summary = plate_dir(args.packs, args.originals, args.out)
    print(json.dumps({"written": summary["written"], "errors": summary["errors"]}))
    return 1 if summary["errors"] else 0


if __name__ == "__main__":
    sys.exit(main())
