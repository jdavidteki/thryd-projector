import json
import os
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def pack(mid, delays):
    return {
        "medium_image_id": mid,
        "kind": "gif",
        "status": "unreviewed",
        "reviewed": False,
        "source_sha256": "abc",
        "frame_size": [4, 4],
        "delays_cs": delays,
        "objects": [{"label": "cut1", "model_class": "person", "mask_count": len(delays), "masks_deflate": "e30="}],
        "provenance": {"inpaint": False, "engine_id": None},
    }


class ManifestCliTest(unittest.TestCase):
    def test_parent_rows_stay_and_no_original_is_required(self):
        with tempfile.TemporaryDirectory() as tmp:
            parent = {
                "version": 1,
                "release": "ready5",
                "note": "kept",
                "counts": {"assets": 1, "ready": 1, "not_in_this_file": 967},
                "assets": [{
                    "medium_image_id": "1*old.gif",
                    "status": "ready",
                    "reviewed": True,
                    "source_sha256": "old",
                }],
            }
            ppath = os.path.join(tmp, "parent.json")
            json.dump(parent, open(ppath, "w"))
            packs = os.path.join(tmp, "packs")
            os.makedirs(packs)
            json.dump(pack("1*new.gif", [10, 10]), open(os.path.join(packs, "1_new.gif.json"), "w"))
            json.dump({"status": "budget_failed", "medium_image_id": "1*UQolGv9h9_i7sWsk3lDLCA.gif"}, open(os.path.join(packs, "1_UQolGv9h9_i7sWsk3lDLCA.gif.json"), "w"))
            dest = os.path.join(tmp, "out.json")
            proc = subprocess.run(
                [sys.executable, os.path.join(ROOT, "tools/medium_cut_manifest.py"),
                 "--parent", ppath, "--packs", packs, "--out", dest],
                cwd=ROOT, capture_output=True, text=True, check=False,
            )
            self.assertEqual(proc.returncode, 0, proc.stderr + proc.stdout)
            self.assertFalse(os.path.exists(os.path.join(tmp, "originals")))
            doc = json.load(open(dest))
            self.assertEqual(doc["assets"][0], parent["assets"][0])
            self.assertEqual(doc["release"], "ready5")
            self.assertEqual(doc["counts"], {"assets": 2, "ready": 2, "not_in_this_file": 966})
            row = doc["assets"][1]
            self.assertEqual(row["status"], "ready")
            self.assertFalse(row["reviewed"])
            self.assertFalse(row["review"]["clean"])
            self.assertFalse(row["review"]["browser_verified"])
            self.assertEqual(row["url"], "https://miro.medium.com/1*new.gif")
            self.assertEqual(row["select"], "?mlib=1%2Anew.gif")
            self.assertNotIn("1*UQolGv9h9_i7sWsk3lDLCA.gif", [a["medium_image_id"] for a in doc["assets"]])
            bad = pack("1*bad.gif", [10])
            bad["objects"][0]["mask_count"] = 2
            json.dump(bad, open(os.path.join(packs, "1_bad.gif.json"), "w"))
            chk = subprocess.run(
                [sys.executable, os.path.join(ROOT, "tools/medium_cut_manifest.py"),
                 "--parent", ppath, "--packs", packs, "--check"],
                cwd=ROOT, capture_output=True, text=True, check=False,
            )
            self.assertEqual(chk.returncode, 1)
            self.assertIn("mask_count", chk.stdout)


if __name__ == "__main__":
    unittest.main()
