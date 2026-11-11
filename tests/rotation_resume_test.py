import os
import subprocess
import tempfile
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PATCH = os.path.join(ROOT, "release", "rotation-resume", "rotation-resume.patch")
SUMS = os.path.join(ROOT, "release", "rotation-resume", "SHA256SUMS")
BASE = os.environ.get("ROTATION_BASE", "/tmp/rel-live2")


class RotationResumeTest(unittest.TestCase):
    def test_patch_is_only_the_return_and_the_player(self):
        text = open(PATCH, encoding="utf-8", errors="replace").read()
        self.assertIn("diff -ruN a/assets/live_return.js", text)
        self.assertIn("diff -ruN a/assets/projector.js", text)
        self.assertNotIn("data/medium_cuts.json", text)
        self.assertNotIn("index.html", text)
        self.assertNotIn("movement_acks", text)
        self.assertIn("cursor:slideCursor", text)
        self.assertIn("hold:libPin.pinned()", text)
        self.assertIn("SLIDE*1000", text)
        self.assertNotIn("slideN%3", text)
        notes = open(os.path.join(ROOT, "release/rotation-resume/APPLY.txt"), encoding="utf-8").read()
        self.assertIn("e34208e6", notes)
        self.assertIn("next4", notes)

    @unittest.skipUnless(os.path.isdir(BASE), "public e34208e6 tree")
    def test_patch_applies_to_the_public_tree_and_keeps_the_pack(self):
        with tempfile.TemporaryDirectory() as tmp:
            subprocess.check_call(["cp", "-a", BASE, os.path.join(tmp, "tree")])
            tree = os.path.join(tmp, "tree")
            before = open(os.path.join(tree, "data/medium_cuts.json"), "rb").read()
            pack = open(os.path.join(tree, "assets/medium_cuts/1_UQolGv9h9_i7sWsk3lDLCA.gif.json"), "rb").read()
            subprocess.check_call(["patch", "-p1"], cwd=tree, stdin=open(PATCH, "rb"))
            self.assertEqual(open(os.path.join(tree, "data/medium_cuts.json"), "rb").read(), before)
            self.assertEqual(open(os.path.join(tree, "assets/medium_cuts/1_UQolGv9h9_i7sWsk3lDLCA.gif.json"), "rb").read(), pack)
            js = open(os.path.join(tree, "assets/projector.js"), encoding="utf-8").read()
            self.assertIn("SLIDE*1000", js)
            self.assertNotIn("slideN%3", js)
            self.assertIn("const NEWEST=", js)
            self.assertIn("libPin.allow(set)", js)
            refresh = js.split("live_extra.json?t=", 1)[1]
            self.assertNotIn("poolI=Math.max(0,POOL.indexOf(nw))", refresh)
            subprocess.check_call(["sha256sum", "-c", SUMS], cwd=tree)


if __name__ == "__main__":
    unittest.main()
