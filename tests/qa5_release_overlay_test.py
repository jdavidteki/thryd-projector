import hashlib
import json
import os
import shutil
import subprocess
import tarfile
import tempfile
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PATCH = os.path.join(ROOT, "release", "qa5-early", "qa5-on-source.patch")
SUMS = os.path.join(ROOT, "release", "qa5-early", "SHA256SUMS")
SOURCE_TAR = os.environ.get(
    "RELEASE_SOURCE_TAR",
    "/home/ubuntu/.cursor/projects/workspace/uploads/release-source-20261111-1239.tar_8312.gz",
)
PACK_TAR = os.environ.get(
    "RELEASE_QA5_TAR",
    "/home/ubuntu/.cursor/projects/workspace/uploads/release-qa5-20261111-1239.tar_ea4f.gz",
)
QA5 = "1*UQolGv9h9_i7sWsk3lDLCA.gif"
SHA = "2f57c9b45511072dd367237c13ac19c353e0be230285720904da5ee2e1bcfa2e"


class Qa5OverlayTest(unittest.TestCase):
    def test_patch_does_not_touch_inventory_and_keeps_codever(self):
        text = open(PATCH, encoding="utf-8", errors="replace").read()
        self.assertNotIn("--- a/data/live_extra.json", text)
        self.assertNotIn("--- a/data/medium_library.json", text)
        self.assertIn("medium_cuts.js?v=1", text)
        self.assertIn("__CODEVER__", open(os.path.join(ROOT, "release/qa5-early/APPLY.txt"), encoding="utf-8").read())

    @unittest.skipUnless(os.path.isfile(SOURCE_TAR) and os.path.isfile(PACK_TAR), "release tars")
    def test_patch_applies_to_the_attached_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            subprocess.check_call(["tar", "-xzf", SOURCE_TAR, "-C", tmp])
            before_live = open(os.path.join(tmp, "data/live_extra.json"), "rb").read()
            before_lib = open(os.path.join(tmp, "data/medium_library.json"), "rb").read()
            subprocess.check_call(["patch", "-p1"], cwd=tmp, stdin=open(PATCH, "rb"))
            self.assertEqual(open(os.path.join(tmp, "data/live_extra.json"), "rb").read(), before_live)
            self.assertEqual(open(os.path.join(tmp, "data/medium_library.json"), "rb").read(), before_lib)
            html = open(os.path.join(tmp, "index.html"), encoding="utf-8").read()
            self.assertIn("__CODEVER__", html)
            self.assertIn('id="mlib"', html)
            self.assertIn("medium_cuts.js?v=1','projector.js?v=57'", html)
            js = open(os.path.join(tmp, "assets/projector.js"), encoding="utf-8").read()
            self.assertIn("const NEWEST=", js)
            self.assertIn("ThrydMediumCuts.attach", js)
            self.assertIn("ThrydMediumCuts.detach", js)
            self.assertIn("on.src=set.url", js)
            self.assertNotIn("movement_acks", js)
            self.assertIn("Q.get('mlib')", js)
            live = json.load(open(os.path.join(tmp, "data/live_extra.json"), encoding="utf-8"))
            self.assertGreaterEqual(len(live["sets"]), 1103)
            man = json.load(open(os.path.join(tmp, "data/medium_cuts.json"), encoding="utf-8"))
            ready = [a for a in man["assets"] if a.get("status") == "ready"]
            self.assertEqual(len(ready), 1)
            row = ready[0]
            self.assertEqual(row["medium_image_id"], QA5)
            self.assertEqual(row["source_sha256"], SHA)
            self.assertEqual(row["delays_cs"], [10] * 18)
            self.assertTrue(row["reviewed"])
            self.assertFalse(row["review"]["clean"])
            self.assertFalse(row["review"]["browser_verified"])
            self.assertEqual(row["select"], "?mlib=1%2AUQolGv9h9_i7sWsk3lDLCA.gif")
            self.assertEqual(row["url"], "https://miro.medium.com/" + QA5)
            self.assertNotIn("run", row)
            self.assertNotIn("object_id", row)
            pack_path = os.path.join(tmp, row["pack"])
            pack = json.load(open(pack_path, encoding="utf-8"))
            self.assertEqual(pack["status"], "unreviewed")
            self.assertFalse(pack["reviewed"])
            self.assertEqual(pack["source_sha256"], SHA)
            self.assertEqual(pack["delays_cs"], [10] * 18)
            self.assertEqual(pack["model"], "rembg-u2net-human-seg")
            self.assertEqual(pack["objects"][0]["model_class"], "foreground")
            self.assertIsNone(pack["provenance"].get("engine_id"))
            with tarfile.open(PACK_TAR, "r:gz") as tar:
                member = tar.extractfile("1_UQolGv9h9_i7sWsk3lDLCA.gif.json").read()
            self.assertEqual(open(pack_path, "rb").read(), member)
            sums = subprocess.check_output(["sha256sum", "-c", SUMS], cwd=tmp, text=True)
            self.assertIn("index.html: OK", sums)
            self.assertIn("assets/medium_cuts/1_UQolGv9h9_i7sWsk3lDLCA.gif.json: OK", sums)


if __name__ == "__main__":
    unittest.main()
