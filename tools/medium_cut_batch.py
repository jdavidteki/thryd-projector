#!/usr/bin/env python3
"""Per-frame Medium cut packs from original pixels.

Box worker (do not pass --full on a machine that should not redo the batch):

  /workspace/.segenv/bin/python tools/medium_cut_batch.py \\
    --joblist /workspace/medium-object-extraction-20261111/converter_input/joblist_968.json \\
    --out /workspace/medium-object-extraction-20261111/packs \\
    --state /workspace/medium-object-extraction-20261111/packs/state.json \\
    --full

One id, local file instead of the box path:

  python3 tools/medium_cut_batch.py --joblist joblist_968.json --out packs --state packs/state.json \\
    --only '1*example.gif' --local '1*example.gif=/path/to/file.gif'

CPU only. Prefers yolov8n-seg instance masks when ultralytics is installed.
Otherwise rembg u2net_human_seg connected components, via onnxruntime
CPUExecutionProvider. A file on disk is unreviewed, not ready. Telea inpaint
is not used. A GIF gets one mask per displayed frame. Delays are the file's
graphic-control centiseconds.
"""
import argparse
import base64
import hashlib
import json
import os
import sys
import time
import urllib.request

import numpy as np
from PIL import Image

CAP = 1073741824
PUBLISHED = 791846092
RESERVE = 41943040
ROOM = CAP - PUBLISHED - RESERVE
TERMINAL = {"unreviewed", "no_object", "unusable_near_full", "unstable"}
KEEP_YOLO = {
    "person", "bicycle", "car", "motorcycle", "bus", "truck", "bottle", "cup",
    "fork", "knife", "spoon", "bowl", "chair", "couch", "bed", "laptop",
    "cell phone", "book", "clock", "backpack", "umbrella", "handbag", "tie",
    "suitcase", "sports ball",
}


def room_bytes():
    return ROOM


def admit(measured, already=0):
    if measured is None or measured < 0:
        return {"ok": False, "reason": "unmeasured", "room": ROOM - already}
    if already + measured > ROOM:
        return {"ok": False, "reason": "budget_failed", "room": ROOM - already, "bytes": measured}
    return {"ok": True, "room": ROOM - already - measured, "bytes": measured}


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _lzw(min_code_size, data):
    clear = 1 << min_code_size
    eoi = clear + 1
    code_size = min_code_size + 1
    next_code = eoi + 1
    table = {i: [i] for i in range(clear)}
    bits = 0
    nbits = 0
    ip = 0
    out = []
    prev = None

    def read():
        nonlocal bits, nbits, ip
        while nbits < code_size:
            if ip >= len(data):
                return None
            bits |= int(data[ip]) << nbits
            ip += 1
            nbits += 8
        code = bits & ((1 << code_size) - 1)
        bits >>= code_size
        nbits -= code_size
        return code

    while True:
        code = read()
        if code is None or code == eoi:
            break
        if code == clear:
            code_size = min_code_size + 1
            next_code = eoi + 1
            table = {i: [i] for i in range(clear)}
            prev = None
            continue
        if code in table:
            entry = table[code]
        elif code == next_code and prev is not None:
            entry = prev + [prev[0]]
        else:
            break
        out.extend(entry)
        if prev is not None:
            table[next_code] = prev + [entry[0]]
            next_code += 1
            if next_code == (1 << code_size) and code_size < 12:
                code_size += 1
        prev = entry
    return out


def _rows_interlace(h):
    rows = list(range(0, h, 8)) + list(range(4, h, 8)) + list(range(2, h, 4)) + list(range(1, h, 2))
    return rows


def decode_gif(path):
    """Displayed frames and exact GCE delays. Disposal is applied. No invented delay."""
    with open(path, "rb") as fh:
        data = np.frombuffer(fh.read(), dtype=np.uint8).copy()
    if bytes(data[:6]) not in (b"GIF87a", b"GIF89a"):
        raise ValueError("not_gif")
    w = int(data[6]) | (int(data[7]) << 8)
    h = int(data[8]) | (int(data[9]) << 8)
    packed = int(data[10])
    p = 13
    gct = None
    if packed & 0x80:
        n = 1 << ((packed & 7) + 1)
        gct = data[p:p + n * 3]
        p += n * 3
    canvas = np.zeros((h, w, 4), np.uint8)
    frames = []
    delay = 0
    trans = -1
    dispose = 0
    while p < len(data):
        b = int(data[p]); p += 1
        if b == 0x3B:
            break
        if b == 0x21:
            label = int(data[p]); p += 1
            if label == 0xF9:
                p += 1
                gp = int(data[p]); p += 1
                delay = int(data[p]) | (int(data[p + 1]) << 8); p += 2
                ti = int(data[p]); p += 1
                dispose = (gp >> 2) & 7
                trans = ti if (gp & 1) else -1
                p += 1
            else:
                sz = int(data[p]); p += 1
                while sz:
                    p += sz
                    sz = int(data[p]); p += 1
            continue
        if b != 0x2C:
            raise ValueError("bad_block")
        left = int(data[p]) | (int(data[p + 1]) << 8); p += 2
        top = int(data[p]) | (int(data[p + 1]) << 8); p += 2
        fw = int(data[p]) | (int(data[p + 1]) << 8); p += 2
        fh = int(data[p]) | (int(data[p + 1]) << 8); p += 2
        ipacked = int(data[p]); p += 1
        ct = gct
        if ipacked & 0x80:
            n = 1 << ((ipacked & 7) + 1)
            ct = data[p:p + n * 3]
            p += n * 3
        snapshot = canvas.copy() if dispose == 3 else None
        min_size = int(data[p]); p += 1
        comp = []
        sz = int(data[p]); p += 1
        while sz:
            comp.extend(int(x) for x in data[p:p + sz])
            p += sz
            sz = int(data[p]); p += 1
        idx = _lzw(min_size, comp)
        order = _rows_interlace(fh) if (ipacked & 0x40) else None
        for i, ci in enumerate(idx[:fw * fh]):
            lx = i % fw
            ly = order[i // fw] if order else i // fw
            if ci == trans or ct is None:
                continue
            x = left + lx
            y = top + ly
            if x < 0 or y < 0 or x >= w or y >= h:
                continue
            c = ci * 3
            canvas[y, x, 0] = ct[c]
            canvas[y, x, 1] = ct[c + 1]
            canvas[y, x, 2] = ct[c + 2]
            canvas[y, x, 3] = 255
        frames.append({"rgba": canvas.copy(), "delay_cs": delay})
        if dispose == 2:
            canvas[top:top + fh, left:left + fw] = 0
        elif dispose == 3 and snapshot is not None:
            canvas[:, :] = snapshot
        delay = 0
        trans = -1
        dispose = 0
    return {"width": w, "height": h, "frames": frames}


def decode_still(path):
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    return {"width": im.size[0], "height": im.size[1], "frames": [{"rgba": arr, "delay_cs": 0}]}


def pack_mask(mask):
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        return None
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    crop = mask[y0:y1, x0:x1]
    bh, bw = crop.shape
    stride = (bw + 7) // 8
    raw = bytearray(bh * stride)
    for y in range(bh):
        for x in range(bw):
            if crop[y, x]:
                raw[y * stride + (x // 8)] |= 0x80 >> (x & 7)
    return {"x": x0, "y": y0, "w": bw, "h": bh, "bits": base64.b64encode(raw).decode("ascii")}


def compact_masks(masks):
    """Lossless bbox 1-bit masks. gzip, not a new image. Same pixels and frame count."""
    import gzip
    import struct
    parts = []
    for m in masks:
        raw = base64.b64decode(m["bits"])
        parts.append(struct.pack("<HHHHI", m["x"], m["y"], m["w"], m["h"], len(raw)) + raw)
    blob = gzip.compress(b"".join(parts), compresslevel=9)
    return base64.b64encode(blob).decode("ascii"), len(masks)


def expand_masks(b64, count):
    import gzip
    import struct
    data = gzip.decompress(base64.b64decode(b64))
    out = []
    p = 0
    for _ in range(count):
        x, y, w, h, n = struct.unpack_from("<HHHHI", data, p)
        p += 12
        raw = data[p:p + n]
        p += n
        out.append({"x": x, "y": y, "w": w, "h": h, "bits": base64.b64encode(raw).decode("ascii")})
    if p != len(data):
        raise ValueError("mask blob length")
    return out


def store_compact(objects):
    for obj in objects:
        if not obj.get("masks"):
            continue
        blob, n = compact_masks(obj["masks"])
        obj["masks_deflate"] = blob
        obj["mask_count"] = n
        obj["masks_encoding"] = "bbox1bit-gzip-v1"
        del obj["masks"]
    return objects


def unpack_mask(spec, w, h):
    bw, bh, x0, y0 = spec["w"], spec["h"], spec["x"], spec["y"]
    raw = base64.b64decode(spec["bits"])
    stride = (bw + 7) // 8
    mask = np.zeros((h, w), np.uint8)
    for y in range(bh):
        for x in range(bw):
            if raw[y * stride + (x // 8)] & (0x80 >> (x & 7)):
                mask[y0 + y, x0 + x] = 1
    return mask


def iou(a, b):
    inter = np.logical_and(a, b).sum()
    union = np.logical_or(a, b).sum()
    return float(inter) / float(union) if union else 0.0


def observed_plate(frames, unions):
    """Background color only where the same pixel is unmasked in this file."""
    h, w = frames[0].shape[:2]
    known = np.zeros((h, w), np.uint8)
    plate = np.zeros((h, w, 4), np.uint8)
    for rgba, union in zip(frames, unions):
        see = union == 0
        take = see & (known == 0)
        plate[take] = rgba[take]
        known[take] = 1
    # A hole pixel is known only if some frame did not cover it.
    hole = np.zeros((h, w), np.uint8)
    for union in unions:
        hole |= union
    known_hole = (known == 1) & (hole == 1)
    return plate, known_hole


def _frac(mask):
    return float(mask.mean()) if mask.size else 0.0


class YoloSeg:
    name = "yolov8n-seg"

    def __init__(self):
        from ultralytics import YOLO
        self.model = YOLO(os.environ.get("MEDIUM_CUT_YOLO", "yolov8n-seg.pt"))

    def instances(self, rgb):
        import cv2
        h, w = rgb.shape[:2]
        t0 = time.perf_counter()
        result = self.model.predict(Image.fromarray(np.ascontiguousarray(rgb[:, :, :3])), imgsz=640, device="cpu", verbose=False, conf=0.35)[0]
        sec = time.perf_counter() - t0
        out = []
        if result.masks is None or result.boxes is None:
            return out, sec
        for i, cls in enumerate(result.boxes.cls.tolist()):
            label = self.model.names[int(cls)]
            if label not in KEEP_YOLO:
                continue
            poly = result.masks.xy[i]
            if len(poly) < 3:
                continue
            mask = np.zeros((h, w), np.uint8)
            cv2.fillPoly(mask, [np.round(poly).astype(np.int32)], 1)
            frac = _frac(mask)
            if frac < 0.008 or frac >= 0.85:
                continue
            if mask.sum() < 12 * 12:
                continue
            out.append({"mask": mask, "model_class": label, "conf": float(result.boxes.conf[i]), "near_full": False})
        return out, sec


class RembgHuman:
    name = "rembg-u2net-human-seg"

    def __init__(self):
        import onnxruntime as ort
        from rembg import new_session
        os.environ["ONNXRUNTIME_EXECUTION_PROVIDERS"] = "CPUExecutionProvider"
        self.session = new_session("u2net_human_seg", providers=["CPUExecutionProvider"])
        self._ort = ort

    def instances(self, rgb):
        import cv2
        from rembg import remove
        h, w = rgb.shape[:2]
        t0 = time.perf_counter()
        im = Image.fromarray(rgb[:, :, :3])
        raw = np.array(remove(im, session=self.session, only_mask=True))
        sec = time.perf_counter() - t0
        binary = (raw > 110).astype(np.uint8)
        n, lab, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
        out = []
        area = h * w
        for i in range(1, n):
            x, y, bw, bh, a = stats[i]
            frac = a / area
            if frac < 0.01 or frac >= 0.85 or bw < 12 or bh < 12:
                continue
            mask = (lab == i).astype(np.uint8)
            out.append({"mask": mask, "model_class": "person", "conf": None, "near_full": False})
        return out, sec


def load_segmenter():
    choice = os.environ.get("MEDIUM_CUT_SEGMENTER", "auto")
    if choice in ("auto", "yolo"):
        try:
            return YoloSeg()
        except Exception:
            if choice == "yolo":
                raise
    return RembgHuman()


def track_instances(per_frame):
    tracks = []
    for frame_i, found in enumerate(per_frame):
        used = set()
        for tr in tracks:
            best = None
            for j, inst in enumerate(found):
                if j in used:
                    continue
                score = iou(tr["last"], inst["mask"])
                if best is None or score > best[0]:
                    best = (score, j)
            if best and best[0] >= 0.2:
                inst = found[best[1]]
                used.add(best[1])
                tr["masks"].append(inst["mask"])
                tr["last"] = inst["mask"]
                tr["present"] += 1
            else:
                tr["masks"].append(None)
        for j, inst in enumerate(found):
            if j in used:
                continue
            masks = [None] * frame_i + [inst["mask"]]
            tracks.append({"last": inst["mask"], "masks": masks, "present": 1, "model_class": inst["model_class"], "conf": inst["conf"]})
    n = len(per_frame)
    stable, unstable = [], []
    for tr in tracks:
        if tr["present"] != n or any(m is None for m in tr["masks"]):
            unstable.append(tr)
            continue
        inks = [int(m.sum()) for m in tr["masks"] if m is not None]
        if inks and min(inks) > 0 and max(inks) / min(inks) > 4:
            unstable.append(tr)
            continue
        stable.append(tr)
    return stable, unstable


def build_pack(path, job, segmenter, proof_dir=None):
    kind = "gif" if path.lower().endswith(".gif") else "still"
    decoded = decode_gif(path) if kind == "gif" else decode_still(path)
    w, h = decoded["width"], decoded["height"]
    delays = [fr["delay_cs"] for fr in decoded["frames"]]
    if job and job.get("delays_cs") and kind == "gif" and list(job["delays_cs"]) != delays:
        return {"status": "failed", "reason": "delay_mismatch", "delays_cs": delays, "job_delays_cs": job["delays_cs"]}
    if job and job.get("displayed_frame_count") and job["displayed_frame_count"] != len(delays):
        return {"status": "failed", "reason": "frame_count_mismatch", "frames": len(delays)}
    per = []
    seconds = []
    near = 0
    for fr in decoded["frames"]:
        rgb = fr["rgba"][:, :, :3]
        found, sec = segmenter.instances(rgb)
        seconds.append(sec)
        per.append(found)
        del fr["rgba"]
    # second decode for plate pixels, after masks exist. Re-decode so RGBA is not all held during segmentation of later frames... 
    # The frames were deleted. Decode again for the plate pass only one frame at a time.
    decoded2 = decode_gif(path) if kind == "gif" else decode_still(path)
    stable, unstable = track_instances(per)
    if not stable and not unstable and not any(per):
        return _empty(kind, w, h, delays, seconds, "no_object", job, path, segmenter.name)
    if not stable and any(per) and not unstable:
        return _empty(kind, w, h, delays, seconds, "unusable_near_full", job, path, segmenter.name)
    if not stable and unstable:
        pack = _empty(kind, w, h, delays, seconds, "unstable", job, path, segmenter.name)
        pack["unstable_tracks"] = len(unstable)
        pack["frames_with_mask"] = [i for i, m in enumerate(unstable[0]["masks"]) if m is not None]
        if proof_dir:
            _write_track_proof(proof_dir, path, kind, unstable[0]["masks"])
        return pack
    objects = []
    unions = []
    for frame_i in range(len(per)):
        union = np.zeros((h, w), np.uint8)
        for tr in stable:
            m = tr["masks"][frame_i] if frame_i < len(tr["masks"]) else None
            if m is not None:
                union |= m
        unions.append(union)
    plate = np.zeros((h, w, 4), np.uint8)
    known_hole = np.zeros((h, w), np.uint8)
    hole = np.zeros((h, w), np.uint8)
    for union in unions:
        hole |= union
    known = np.zeros((h, w), np.uint8)
    for fr, union in zip(decoded2["frames"], unions):
        see = union == 0
        take = see & (known == 0)
        plate[take] = fr["rgba"][take]
        known[take] = 1
        del fr["rgba"]
    known_hole = (known == 1) & (hole == 1)
    for n, tr in enumerate(stable, 1):
        masks = []
        for m in tr["masks"]:
            packed = pack_mask(m)
            if packed is None:
                return {"status": "unstable", "reviewed": False, "reason": "empty_track_frame", "medium_image_id": job.get("medium_image_id") if job else None, "objects": []}
            masks.append(packed)
        obj = {"label": "cut%d" % n, "model_class": tr["model_class"], "masks": masks}
        objects.append(obj)
    store_compact(objects)
    pack = {
        "medium_image_id": job.get("medium_image_id") if job else os.path.basename(path),
        "kind": kind,
        "status": "unreviewed",
        "reviewed": False,
        "frame_size": [w, h],
        "delays_cs": delays if kind == "gif" else None,
        "objects": objects,
        "plate_known_hole_pixels": int(known_hole.sum()),
        "unknown_hole_pixels": int((hole == 1).sum() - known_hole.sum()),
        "seconds_per_frame": [round(s, 4) for s in seconds],
        "seconds_per_frame_mean": round(sum(seconds) / len(seconds), 4) if seconds else None,
        "model": segmenter.name,
        "source_sha256": sha256_file(path),
        "job_source_sha256": (job or {}).get("source_sha256"),
        "provenance": {
            "medium_image_id": job.get("medium_image_id") if job else None,
            "source_url": (job or {}).get("unsized_body_url") or (job or {}).get("representative_url"),
            "pipeline": "medium_cut_batch.py %s per displayed frame" % segmenter.name,
            "plate": "same-pixel observed in another moment of this file, else unknown",
            "inpaint": False,
            "engine_id": None,
        },
    }
    if kind == "still":
        pack.pop("delays_cs")
    if proof_dir and int(known_hole.sum()):
        # store only the known-hole colors, zlib, so the loader can fill those pixels
        import zlib
        raw = np.ascontiguousarray(plate).tobytes()
        known_bits = _pack_full(known_hole)
        pack["plate_deflate_b64"] = base64.b64encode(zlib.compress(raw, 9)).decode("ascii")
        pack["plate_known_bits"] = known_bits
    if proof_dir:
        _write_proof(proof_dir, decoded_path=path, kind=kind, unions=unions, plate=plate, known_hole=known_hole, objects_masks=[tr["masks"] for tr in stable])
    return pack


def _pack_full(mask):
    h, w = mask.shape
    stride = (w + 7) // 8
    raw = bytearray(h * stride)
    for y in range(h):
        for x in range(w):
            if mask[y, x]:
                raw[y * stride + (x // 8)] |= 0x80 >> (x & 7)
    return {"w": w, "h": h, "x": 0, "y": 0, "bits": base64.b64encode(raw).decode("ascii")}


def _write_track_proof(proof_dir, path, kind, masks):
    os.makedirs(proof_dir, exist_ok=True)
    decoded = decode_gif(path) if kind == "gif" else decode_still(path)
    present = [i for i, m in enumerate(masks) if m is not None]
    for fi in present[:2]:
        rgba = decoded["frames"][fi]["rgba"]
        union = masks[fi]
        Image.fromarray(rgba[:, :, :3]).save(os.path.join(proof_dir, "frame%d_original.png" % fi))
        rest = np.zeros_like(rgba)
        rest[union == 0] = rgba[union == 0]
        rest[union == 1] = rgba[union == 1]
        Image.fromarray(rest[:, :, :3]).save(os.path.join(proof_dir, "frame%d_at_rest.png" % fi))
        dragged = np.zeros_like(rgba)
        dragged[:, :] = (255, 0, 255, 255)
        dragged[union == 0] = rgba[union == 0]
        ys, xs = np.nonzero(union)
        shift = 40
        for y, x in zip(ys.tolist(), xs.tolist()):
            nx = x + shift
            if 0 <= nx < rgba.shape[1]:
                dragged[y, nx] = rgba[y, x]
        Image.fromarray(dragged[:, :, :3]).save(os.path.join(proof_dir, "frame%d_dragged.png" % fi))


def _empty(kind, w, h, delays, seconds, status, job, path, model):
    pack = {
        "medium_image_id": job.get("medium_image_id") if job else os.path.basename(path),
        "kind": kind,
        "status": status,
        "reviewed": False,
        "frame_size": [w, h],
        "objects": [],
        "seconds_per_frame": [round(s, 4) for s in seconds],
        "seconds_per_frame_mean": round(sum(seconds) / len(seconds), 4) if seconds else None,
        "model": model,
        "source_sha256": sha256_file(path),
        "provenance": {"pipeline": "medium_cut_batch.py", "engine_id": None, "inpaint": False},
    }
    if kind == "gif":
        pack["delays_cs"] = delays
    return pack


def _write_proof(proof_dir, decoded_path, kind, unions, plate, known_hole, objects_masks):
    os.makedirs(proof_dir, exist_ok=True)
    decoded = decode_gif(decoded_path) if kind == "gif" else decode_still(decoded_path)
    indexes = [0]
    if len(decoded["frames"]) > 1:
        indexes.append(len(decoded["frames"]) // 2)
    for fi in indexes:
        rgba = decoded["frames"][fi]["rgba"]
        Image.fromarray(rgba[:, :, :3]).save(os.path.join(proof_dir, "frame%d_original.png" % fi))
        union = unions[fi]
        rest = np.zeros_like(rgba)
        rest[union == 0] = rgba[union == 0]
        rest[union == 1] = rgba[union == 1]
        Image.fromarray(rest[:, :, :3]).save(os.path.join(proof_dir, "frame%d_at_rest.png" % fi))
        dragged = np.zeros_like(rgba)
        dragged[:, :] = (255, 0, 255, 255)
        keep = union == 0
        dragged[keep] = rgba[keep]
        # observed plate where known
        fill = known_hole & (union == 1)
        dragged[fill] = plate[fill]
        # sprite shifted right by 24px, clipped
        ys, xs = np.nonzero(union)
        if len(xs):
            shift = 40
            for y, x in zip(ys.tolist(), xs.tolist()):
                nx = x + shift
                if 0 <= nx < rgba.shape[1]:
                    dragged[y, nx] = rgba[y, x]
        Image.fromarray(dragged[:, :, :3]).save(os.path.join(proof_dir, "frame%d_dragged.png" % fi))
    for fr in decoded["frames"]:
        fr.pop("rgba", None)


def pack_is_skippable(pack, source_sha):
    if not isinstance(pack, dict):
        return False
    if pack.get("source_sha256") != source_sha:
        return False
    status = pack.get("status")
    if status in ("failed", "partial", "budget_failed"):
        return False
    if status == "ready":
        return pack.get("reviewed") is True
    if status not in TERMINAL:
        return False
    if status == "unreviewed" and not pack.get("objects"):
        return False
    if status == "unreviewed" and pack.get("kind") == "gif":
        n = len(pack.get("delays_cs") or [])
        if n < 1:
            return False
        for obj in pack.get("objects") or []:
            have = obj.get("mask_count") if obj.get("masks_deflate") else len(obj.get("masks") or [])
            if have != n:
                return False
    return True


def _safe_name(mid):
    return mid.replace("*", "_").replace("/", "_")


def _resolve_source(job, local_map, fetch_missing, cache):
    mid = job["medium_image_id"]
    if mid in local_map and os.path.isfile(local_map[mid]):
        return local_map[mid]
    src = job.get("source_path")
    if src and os.path.isfile(src):
        return src
    if fetch_missing:
        os.makedirs(cache, exist_ok=True)
        dest = os.path.join(cache, _safe_name(mid))
        if not os.path.isfile(dest):
            url = job.get("unsized_body_url") or job.get("representative_url")
            if not url:
                return None
            urllib.request.urlretrieve(url, dest)
        return dest
    return None


def run_jobs(jobs, out_dir, state_path, local_map, only, fetch_missing, full, proof_root):
    if not full and not only:
        raise SystemExit("refusing a full 968 run without --full; pass --only for samples")
    os.makedirs(out_dir, exist_ok=True)
    state = {"version": 1, "admitted_bytes": 0, "room_bytes": ROOM, "items": {}}
    if os.path.isfile(state_path):
        state = json.load(open(state_path))
        state.setdefault("items", {})
        state.setdefault("admitted_bytes", 0)
    segmenter = None
    cache = os.path.join(out_dir, "_fetch")
    done = 0
    for job in jobs:
        mid = job["medium_image_id"]
        if only and mid not in only:
            continue
        path = _resolve_source(job, local_map, fetch_missing, cache)
        if not path:
            state["items"][mid] = {"status": "partial", "reason": "source_missing", "valid": False}
            _save_state(state_path, state)
            continue
        digest = sha256_file(path)
        prev = state["items"].get(mid) or {}
        prev_pack = None
        pack_path = os.path.join(out_dir, _safe_name(mid) + ".json")
        if os.path.isfile(pack_path):
            try:
                prev_pack = json.load(open(pack_path))
            except Exception:
                prev_pack = None
        if pack_is_skippable(prev_pack, digest):
            done += 1
            continue
        if segmenter is None:
            segmenter = load_segmenter()
        proof = os.path.join(proof_root, _safe_name(mid)) if proof_root else None
        try:
            pack = build_pack(path, job, segmenter, proof_dir=proof)
        except Exception as exc:
            state["items"][mid] = {"status": "failed", "reason": str(exc)[:200], "valid": False, "source_sha256": digest}
            _save_state(state_path, state)
            continue
        raw = json.dumps(pack).encode("utf-8")
        gate = admit(len(raw), state["admitted_bytes"])
        if pack.get("status") == "unreviewed" and not gate["ok"]:
            pack = {"medium_image_id": mid, "status": "budget_failed", "reviewed": False, "bytes": len(raw), "source_sha256": digest, "objects": []}
            raw = json.dumps(pack).encode("utf-8")
        elif pack.get("status") in TERMINAL and pack.get("status") != "budget_failed":
            state["admitted_bytes"] += len(raw)
        json.dump(pack, open(pack_path, "w"))
        state["items"][mid] = {
            "status": pack.get("status"),
            "valid": pack_is_skippable(pack, digest),
            "source_sha256": digest,
            "bytes": len(raw),
            "pack": pack_path,
        }
        state["room_bytes"] = ROOM - state["admitted_bytes"]
        _save_state(state_path, state)
        done += 1
        print(mid, pack.get("status"), "bytes", len(raw), "sec/frame", pack.get("seconds_per_frame_mean"), flush=True)
    return state


def _save_state(path, state):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    tmp = path + ".tmp"
    json.dump(state, open(tmp, "w"))
    os.replace(tmp, path)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Build per-frame Medium cut packs. Automatic output is unreviewed.")
    ap.add_argument("--joblist", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--state", required=True)
    ap.add_argument("--only", default="", help="comma-separated medium ids")
    ap.add_argument("--local", action="append", default=[], help="medium_image_id=filepath")
    ap.add_argument("--fetch-missing", action="store_true")
    ap.add_argument("--full", action="store_true", help="process every job. Omit this for a sample.")
    ap.add_argument("--proof", default="")
    args = ap.parse_args(argv)
    doc = json.load(open(args.joblist))
    jobs = doc["jobs"] if isinstance(doc, dict) else doc
    local = {}
    for item in args.local:
        mid, path = item.split("=", 1)
        local[mid] = path
    only = {x for x in args.only.split(",") if x} or None
    run_jobs(jobs, args.out, args.state, local, only, args.fetch_missing, args.full, args.proof or None)


if __name__ == "__main__":
    main()
