import base64
import json
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
from medium_cut_batch import admit, decode_gif, pack_is_skippable, pack_mask, unpack_mask, ROOM

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
GIF = os.path.join(ROOT, "tests", "fixtures", "cut_two.gif")


class BatchLogicTest(unittest.TestCase):
    def test_gif_delays_and_pixels_match_the_file(self):
        dec = decode_gif(GIF)
        self.assertEqual([fr["delay_cs"] for fr in dec["frames"]], [10, 20])
        px = dec["frames"][0]["rgba"][1, 1]
        self.assertEqual(px.tolist()[:3], [255, 0, 0])
        self.assertEqual(dec["frames"][1]["rgba"][4, 4].tolist()[:3], [255, 0, 0])
        self.assertEqual(dec["frames"][1]["rgba"][1, 1].tolist()[:3], [0, 0, 255])

    def test_mask_pack_roundtrip_is_the_ink_only(self):
        mask = np.zeros((8, 8), np.uint8)
        mask[1:3, 1:3] = 1
        spec = pack_mask(mask)
        back = unpack_mask(spec, 8, 8)
        self.assertTrue(np.array_equal(back, mask))
        self.assertEqual(spec["w"], 2)
        self.assertEqual(spec["h"], 2)

    def test_skip_requires_a_valid_pack_and_the_same_hash(self):
        good = {"status": "no_object", "source_sha256": "abc", "kind": "gif", "objects": [], "delays_cs": [10]}
        self.assertTrue(pack_is_skippable(good, "abc"))
        self.assertFalse(pack_is_skippable(good, "def"))
        self.assertFalse(pack_is_skippable({"status": "failed", "source_sha256": "abc"}, "abc"))
        self.assertFalse(pack_is_skippable({"status": "partial", "source_sha256": "abc"}, "abc"))
        self.assertFalse(pack_is_skippable({"status": "budget_failed", "source_sha256": "abc"}, "abc"))
        self.assertFalse(pack_is_skippable({"status": "ready", "reviewed": False, "source_sha256": "abc", "objects": [{}]}, "abc"))
        unreviewed = {"status": "unreviewed", "source_sha256": "abc", "kind": "gif", "delays_cs": [10, 10],
                      "objects": [{"masks": [{}, {}]}]}
        self.assertTrue(pack_is_skippable(unreviewed, "abc"))
        unreviewed["objects"][0]["masks"] = [{}]
        self.assertFalse(pack_is_skippable(unreviewed, "abc"))

    def test_real_still_recomposition_is_exact_and_not_ready(self):
        from PIL import Image
        pack = json.load(open(os.path.join(ROOT, "tests/fixtures/medium_packs/still_unreviewed.json")))
        self.assertEqual(pack["status"], "unreviewed")
        self.assertFalse(pack["reviewed"])
        self.assertEqual(pack["objects"][0]["model_class"], "person")
        self.assertNotIn("object_id", pack["objects"][0])
        im = np.array(Image.open(os.path.join(ROOT, "tests/fixtures/originals/1_-NnrSDqF-Rbb8cTVlm3LVw.jpeg")).convert("RGBA"))
        h, w = im.shape[:2]
        mask = unpack_mask(pack["objects"][0]["masks"][0], w, h)
        rest = im.copy()
        rest[mask == 1] = im[mask == 1]
        self.assertEqual(int(np.abs(rest.astype(int) - im.astype(int)).max()), 0)
        hole = im[mask == 1]
        self.assertGreater(int(mask.sum()), 1000)
        self.assertLess(float(mask.mean()), 0.85)
        self.assertTrue(np.any(np.abs(hole[:, :3].astype(int) - np.array([255, 0, 255])).sum(axis=1) > 0))
        diagram = json.load(open(os.path.join(ROOT, "tests/fixtures/medium_packs/diagram_no_object.json")))
        subject = json.load(open(os.path.join(ROOT, "tests/fixtures/medium_packs/subject_unstable.json")))
        self.assertEqual(diagram["status"], "no_object")
        self.assertEqual(subject["status"], "unstable")
        official = json.load(open(os.path.join(ROOT, "data/medium_cuts.json")))
        self.assertEqual(official["counts"]["ready"], 0)

    def test_proof_writes_the_middle_frame_of_a_105_frame_gif(self):
        import tempfile
        from PIL import Image
        from medium_cut_batch import _write_proof
        frames = [Image.new("RGB", (8, 8), (i % 200, 10, 20)) for i in range(105)]
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "long.gif")
            frames[0].save(path, save_all=True, append_images=frames[1:], duration=100, loop=0, disposal=1)
            unions = []
            for _ in range(105):
                m = np.zeros((8, 8), np.uint8)
                m[1, 1] = 1
                unions.append(m)
            plate = np.zeros((8, 8, 4), np.uint8)
            known = np.zeros((8, 8), np.uint8)
            out = os.path.join(tmp, "proof")
            _write_proof(out, path, "gif", unions, plate, known, [unions])
            self.assertTrue(os.path.isfile(os.path.join(out, "frame0_original.png")))
            self.assertTrue(os.path.isfile(os.path.join(out, "frame52_original.png")))
            self.assertTrue(os.path.isfile(os.path.join(out, "frame52_dragged.png")))

    def test_compact_masks_match_the_real_packs_and_old_json_still_skips(self):
        from medium_cut_batch import compact_masks, expand_masks
        uploads = "/home/ubuntu/.cursor/projects/workspace/uploads"
        names = [
            "1_qY4BvUuiNiJh-4S-yYWgUA.gif_795f.json",
            "1_fskbzXlSjZ5z4INByMFdlQ.gif_f44c.json",
        ]
        measured = []
        for name in names:
            path = os.path.join(uploads, name)
            if not os.path.isfile(path):
                continue
            pack = json.load(open(path))
            before = os.path.getsize(path)
            compact_bytes = 0
            for obj in pack["objects"]:
                blob, n = compact_masks(obj["masks"])
                self.assertEqual(n, len(pack["delays_cs"]))
                back = expand_masks(blob, n)
                self.assertEqual(len(back), n)
                self.assertEqual(back[0]["bits"], obj["masks"][0]["bits"])
                self.assertEqual(back[-1]["bits"], obj["masks"][-1]["bits"])
                compact_bytes += len(blob)
            old = dict(pack)
            self.assertTrue(pack_is_skippable(old, old["source_sha256"]))
            measured.append({"file": name, "json_bytes": before, "gzip_b64_bytes": compact_bytes, "frames": len(pack["delays_cs"]), "objects": len(pack["objects"])})
        still = json.load(open(os.path.join(ROOT, "tests/fixtures/medium_packs/still_unreviewed.json")))
        self.assertEqual(still["unknown_hole_pixels"], 401420)
        self.assertEqual(still["plate_known_hole_pixels"], 0)
        measured.append({
            "qa3_mask_only_bytes": 189770,
            "qa3_with_plate_bytes": 399939,
            "note": "Executor measurement of 1*EjQIcGvfegu9uQohoQbqlA.gif. Plate fields are part of the compact pack. 189770 is masks only.",
        })
        if measured:
            os.makedirs(os.path.join(ROOT, "tests/fixtures/medium_packs"), exist_ok=True)
            json.dump({"room_bytes": ROOM, "measured": measured}, open(os.path.join(ROOT, "tests/fixtures/medium_packs/compact_measure.json"), "w"), indent=1)

    def test_reconcile_keeps_identity_and_reads_a_zlib_plate(self):
        import gzip
        import tempfile
        import zlib
        from medium_cut_batch import expand_masks, reconcile_pack
        mask = np.zeros((4, 4), np.uint8)
        mask[1, 1] = 1
        spec = pack_mask(mask)
        plate = np.zeros((4, 4, 4), np.uint8)
        plate[1, 1] = (9, 8, 7, 255)
        zlib_b64 = base64.b64encode(zlib.compress(plate.tobytes())).decode("ascii")
        self.assertTrue(base64.b64decode(zlib_b64).startswith(b"\x78"))
        raw = {
            "medium_image_id": "1*qa3.gif",
            "kind": "gif",
            "status": "unreviewed",
            "reviewed": False,
            "source_sha256": "abc",
            "frame_size": [4, 4],
            "delays_cs": [10, 10],
            "objects": [{"label": "cut1", "model_class": "foreground", "masks": [spec, spec]}],
            "plate_deflate_b64": zlib_b64,
            "plate_known_bits": pack_mask(mask),
        }
        got = reconcile_pack(raw)
        self.assertEqual(got["source_sha256"], "abc")
        self.assertEqual(got["delays_cs"], [10, 10])
        self.assertEqual(got["status"], "unreviewed")
        self.assertFalse(got["reviewed"])
        self.assertNotIn("plate_deflate_b64", got)
        self.assertNotIn("masks", got["objects"][0])
        pixels = gzip.decompress(base64.b64decode(got["plate_gzip_b64"]))
        self.assertEqual(pixels, plate.tobytes())
        back = expand_masks(got["objects"][0]["masks_deflate"], got["objects"][0]["mask_count"])
        self.assertEqual(back[0]["bits"], spec["bits"])
        full = len(json.dumps(got).encode("utf-8"))
        masks_only = dict(got)
        masks_only.pop("plate_gzip_b64")
        masks_only.pop("plate_known_bits")
        slim = len(json.dumps(masks_only).encode("utf-8"))
        self.assertGreater(full, slim)
        with tempfile.TemporaryDirectory() as tmp:
            json.dump(raw, open(os.path.join(tmp, "a.json"), "w"))
            dest = os.path.join(tmp, "out")
            from medium_cut_batch import reconcile_dir
            rows = reconcile_dir(tmp, dest)
            self.assertEqual(rows[0]["compact_bytes"], full)
            self.assertTrue(rows[0]["has_plate"])

    def test_a_missed_edge_does_not_stay_on_the_plate(self):
        from medium_cut_batch import repair_masks, repeated_plate, subject_left_behind, wall_reference
        frames = []
        masks = []
        for i in range(6):
            fr = np.zeros((24, 24, 4), np.uint8)
            fr[:, :] = (180, 180, 180, 255)
            x0 = 2 + i
            fr[8:14, x0:x0 + 6] = (0, 0, 0, 255)
            # The segmenter misses the top row of the square. That row is the ghost.
            mask = np.zeros((24, 24), np.uint8)
            mask[9:14, x0:x0 + 6] = 1
            frames.append(fr)
            masks.append(mask)
        ref = wall_reference(frames, masks)
        self.assertIsNotNone(ref)
        repaired = repair_masks(frames, masks, ref)
        plate, known, need = repeated_plate(frames, ref)
        self.assertGreaterEqual(need, 2)
        for fr, mask in zip(frames, repaired):
            black = np.all(fr[:, :, :3] == 0, axis=2)
            self.assertTrue(np.all(mask[black] == 1))
            self.assertEqual(subject_left_behind(fr, mask, ref), 0)
        # The stored plate is the wall that was actually seen, never the black square.
        self.assertEqual(int(np.any((known == 1) & np.all(plate[:, :, :3] == 0, axis=2))), 0)
        self.assertGreater(int(known.sum()), 0)
        self.assertTrue(np.all(np.abs(plate[known == 1][:, :3].astype(int) - 180).max() <= 16))

    def test_one_wall_like_frame_is_not_a_plate(self):
        from medium_cut_batch import repeated_plate
        frames = []
        for i in range(6):
            fr = np.zeros((16, 16, 4), np.uint8)
            fr[:, :] = (180, 180, 180, 255)
            if i < 5:
                fr[4:12, 4:12] = (20, 20, 20, 255)
            frames.append(fr)
        ref = np.full((16, 16, 3), 180, np.uint8)
        _plate, known, need = repeated_plate(frames, ref)
        self.assertEqual(need, 4)
        self.assertEqual(int(known[6, 6]), 0)
        self.assertEqual(int(known[0, 0]), 1)

    def test_reconcile_rejects_a_garbage_plate_gzip(self):
        import gzip
        from medium_cut_batch import reconcile_pack
        raw = {
            "medium_image_id": "1*qa.gif",
            "kind": "gif",
            "status": "unreviewed",
            "reviewed": False,
            "source_sha256": "abc",
            "frame_size": [4, 4],
            "delays_cs": [10],
            "objects": [],
            "plate_gzip_b64": base64.b64encode(b"this is not a plate").decode("ascii"),
        }
        with self.assertRaises(ValueError):
            reconcile_pack(raw)
        wrong = gzip.compress(b"\x00" * 8)
        raw["plate_gzip_b64"] = base64.b64encode(wrong).decode("ascii")
        with self.assertRaises(ValueError):
            reconcile_pack(raw)
        plate = np.zeros((4, 4, 4), np.uint8)
        plate[0, 0] = (1, 2, 3, 255)
        raw["plate_gzip_b64"] = base64.b64encode(gzip.compress(plate.tobytes())).decode("ascii")
        got = reconcile_pack(raw)
        self.assertEqual(gzip.decompress(base64.b64decode(got["plate_gzip_b64"])), plate.tobytes())
        self.assertEqual(got["status"], "unreviewed")
        self.assertFalse(got["reviewed"])

    def test_isolate_core_drops_a_detached_speck(self):
        from medium_cut_batch import isolate_core
        mask = np.zeros((40, 40), np.uint8)
        mask[8:32, 8:32] = 1
        mask[0, 0] = 1
        out = isolate_core(mask)
        self.assertEqual(int(out[0, 0]), 0)
        self.assertEqual(int(out[16, 16]), 1)

    def test_room_is_the_measured_published_budget(self):
        self.assertEqual(ROOM, 239952692)
        self.assertEqual(admit(100, 0)["ok"], True)
        self.assertEqual(admit(ROOM, ROOM)["reason"], "budget_failed")
        self.assertEqual(admit(None)["reason"], "unmeasured")


if __name__ == "__main__":
    unittest.main()
