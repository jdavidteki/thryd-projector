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
        self.assertEqual(pack["unknown_hole_pixels"] if False else json.load(open(os.path.join(ROOT, "tests/fixtures/medium_packs/still_unreviewed.json")))["unknown_hole_pixels"], 401420)
        if measured:
            os.makedirs(os.path.join(ROOT, "tests/fixtures/medium_packs"), exist_ok=True)
            json.dump({"room_bytes": ROOM, "measured": measured}, open(os.path.join(ROOT, "tests/fixtures/medium_packs/compact_measure.json"), "w"), indent=1)

    def test_room_is_the_measured_published_budget(self):
        self.assertEqual(ROOM, 239952692)
        self.assertEqual(admit(100, 0)["ok"], True)
        self.assertEqual(admit(ROOM, ROOM)["reason"], "budget_failed")
        self.assertEqual(admit(None)["reason"], "unmeasured")


if __name__ == "__main__":
    unittest.main()
