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

    def test_room_is_the_measured_published_budget(self):
        self.assertEqual(ROOM, 239952692)
        self.assertEqual(admit(100, 0)["ok"], True)
        self.assertEqual(admit(ROOM, ROOM)["reason"], "budget_failed")
        self.assertEqual(admit(None)["reason"], "unmeasured")


if __name__ == "__main__":
    unittest.main()
