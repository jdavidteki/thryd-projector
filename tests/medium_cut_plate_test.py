import json
import os
import subprocess
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from medium_cut_batch import decode_gif, expand_masks, pack_mask, sha256_file, unpack_mask


def write_wall_gif(path):
    frames = []
    for i in range(6):
        im = Image.new("RGBA", (48, 48), (180, 180, 180, 255))
        px = im.load()
        x0 = 8 + i * 3
        for y in range(12, 32):
            for x in range(x0, x0 + 16):
                px[x, y] = (20, 20, 20, 255)
        frames.append(im)
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=100, loop=0, disposal=2)


class PlateCliTest(unittest.TestCase):
    def test_existing_masks_gain_a_plate_and_a_stub_is_skipped(self):
        with tempfile.TemporaryDirectory() as tmp:
            originals = os.path.join(tmp, "originals")
            packs = os.path.join(tmp, "packs")
            dest = os.path.join(tmp, "out")
            os.makedirs(originals)
            os.makedirs(packs)
            gif = os.path.join(originals, "1_wall.gif")
            write_wall_gif(gif)
            decoded = decode_gif(gif)
            masks = []
            for i, fr in enumerate(decoded["frames"]):
                dark = np.all(fr["rgba"][:, :, :3] == 20, axis=2).astype(np.uint8)
                masks.append(pack_mask(dark))
            before = [unpack_mask(spec, 48, 48) for spec in masks]
            raw = {
                "medium_image_id": "1*wall.gif",
                "kind": "gif",
                "status": "unreviewed",
                "reviewed": False,
                "source_sha256": sha256_file(gif),
                "frame_size": [48, 48],
                "delays_cs": [fr["delay_cs"] for fr in decoded["frames"]],
                "objects": [{"label": "cut1", "model_class": "person", "masks": masks}],
                "provenance": {"inpaint": False, "engine_id": None},
            }
            json.dump(raw, open(os.path.join(packs, "1_wall.gif.json"), "w"))
            stub = {"status": "budget_failed", "medium_image_id": "1*UQolGv9h9_i7sWsk3lDLCA.gif"}
            json.dump(stub, open(os.path.join(packs, "1_UQolGv9h9_i7sWsk3lDLCA.gif.json"), "w"))
            stub_before = open(os.path.join(packs, "1_UQolGv9h9_i7sWsk3lDLCA.gif.json"), "rb").read()
            proc = subprocess.run(
                [sys.executable, os.path.join(ROOT, "tools/medium_cut_plate.py"),
                 "--packs", packs, "--originals", originals, "--out", dest],
                cwd=ROOT, capture_output=True, text=True, check=False,
            )
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertFalse(os.path.exists(os.path.join(dest, "1_UQolGv9h9_i7sWsk3lDLCA.gif.json")))
            self.assertEqual(open(os.path.join(packs, "1_UQolGv9h9_i7sWsk3lDLCA.gif.json"), "rb").read(), stub_before)
            got = json.load(open(os.path.join(dest, "1_wall.gif.json")))
            self.assertEqual(got["status"], "unreviewed")
            self.assertFalse(got["reviewed"])
            self.assertEqual(got["delays_cs"], raw["delays_cs"])
            self.assertEqual(got["source_sha256"], raw["source_sha256"])
            self.assertFalse(got["provenance"]["inpaint"])
            self.assertIsNone(got["provenance"]["engine_id"])
            self.assertGreater(got["plate_known_hole_pixels"], 0)
            self.assertIn("plate_gzip_b64", got)
            back = expand_masks(got["objects"][0]["masks_deflate"], got["objects"][0]["mask_count"])
            after = [unpack_mask(spec, 48, 48) for spec in back]
            for a, b in zip(before, after):
                self.assertTrue(np.array_equal(a, b))
            summary = json.load(open(os.path.join(dest, "_plate_summary.json")))
            self.assertEqual(summary["written"], 1)
            self.assertEqual(summary["errors"], 0)
            self.assertEqual(summary["rows"][0]["action"], "skipped")


if __name__ == "__main__":
    unittest.main()
