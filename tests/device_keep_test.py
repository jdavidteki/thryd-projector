import json
import os
import subprocess
import tempfile
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PATCH = os.path.join(ROOT, "release", "device-keep", "device-keep.patch")
SUMS = os.path.join(ROOT, "release", "device-keep", "SHA256SUMS")
NEXT4 = os.path.join(ROOT, "release", "next4-early", "next4-data.patch")
BASE = os.environ.get("DEVICE_KEEP_BASE", "/tmp/rel-opt-base")


class DeviceKeepTest(unittest.TestCase):
    def test_patch_does_not_touch_the_manifest_or_the_rotation(self):
        text = open(PATCH, encoding="utf-8", errors="replace").read()
        self.assertIn("diff -ruN a/assets/thryd_keep.js", text)
        self.assertIn("diff -ruN a/assets/medium_cuts.js", text)
        self.assertIn("diff -ruN a/assets/projector.js", text)
        self.assertIn("diff -ruN a/index.html", text)
        self.assertNotIn("data/medium_cuts.json", text)
        self.assertNotIn("movement_acks", text)
        self.assertNotIn("slideN%3", text)
        self.assertNotIn("\n-  const moved=ThrydLiveReturn.step", text)
        self.assertIn("kresume", text)
        self.assertIn("kreset", text)
        self.assertIn("stageChoice", text)
        notes = open(os.path.join(ROOT, "release/device-keep/APPLY.txt"), encoding="utf-8").read()
        self.assertIn("5eb18e45", notes)
        self.assertIn("next4", notes)
        self.assertIn("e34208e6", notes)

    @unittest.skipUnless(os.path.isdir(BASE), "rotation public tree")
    def test_patch_applies_over_rotation_and_leaves_next4_ready(self):
        with tempfile.TemporaryDirectory() as tmp:
            tree = os.path.join(tmp, "tree")
            subprocess.check_call(["cp", "-a", BASE, tree])
            subprocess.check_call(["patch", "-p1"], cwd=tree, stdin=open(NEXT4, "rb"))
            before = open(os.path.join(tree, "data/medium_cuts.json"), "rb").read()
            man = json.loads(before)
            ready = [a for a in man["assets"] if a.get("status") == "ready"]
            self.assertEqual(len(ready), 5)
            self.assertEqual(man["counts"]["ready"], 5)
            packs = {a["pack"]: open(os.path.join(tree, a["pack"]), "rb").read() for a in ready}
            subprocess.check_call(["patch", "-p1"], cwd=tree, stdin=open(PATCH, "rb"))
            self.assertEqual(open(os.path.join(tree, "data/medium_cuts.json"), "rb").read(), before)
            for rel, raw in packs.items():
                self.assertEqual(open(os.path.join(tree, rel), "rb").read(), raw)
            js = open(os.path.join(tree, "assets/projector.js"), encoding="utf-8").read()
            self.assertIn("cursor:slideCursor", js)
            self.assertIn("hold:libPin.pinned()", js)
            self.assertIn("SLIDE*1000", js)
            self.assertNotIn("slideN%3", js)
            self.assertNotIn("poolI=Math.max(0,POOL.indexOf(nw))", js.split("live_extra.json?t=", 1)[1])
            html = open(os.path.join(tree, "index.html"), encoding="utf-8").read()
            self.assertIn("__CODEVER__", html)
            self.assertIn('id="mlib"', html)
            self.assertIn("thryd_keep.js?v=1", html)
            self.assertIn('id="kresume"', html)
            self.assertIn('id="kreset"', html)
            subprocess.check_call(["sha256sum", "-c", SUMS], cwd=tree)


if __name__ == "__main__":
    unittest.main()
