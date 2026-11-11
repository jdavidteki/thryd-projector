import hashlib
import json
import os
import subprocess
import tarfile
import tempfile
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PATCH = os.path.join(ROOT, "release", "next8-early", "next8-data.patch")
SUMS = os.path.join(ROOT, "release", "next8-early", "SHA256SUMS")
HELPER = os.environ.get(
    "NEXT8_HELPER_TAR",
    "/home/ubuntu/.cursor/projects/workspace/uploads/next8-packs-and-helpers.tar_624c.gz",
)
ORIGINALS = os.environ.get("NEXT8_ORIGINALS", "/tmp/next8/originals")
ROOM = 1073741824 - 791846092 - 41943040
IDS = [
    "1*u2biyOtr9ZlPhQXs9lBHlw.gif",
    "1*1KZ0RuyDgxOgfLDJes6pgw.gif",
    "1*ra3XWe8lZL5Fy2cCOXEpSg.gif",
    "1*c6w4Q9cimRqFJghd5HxSww.gif",
    "1*_567k2mm95I5IEWpl0nVrg.gif",
    "1*ubGNThBbHFM_0OLyVAfKYw.gif",
    "1*UmpEdNHIUE0PbFptnquSig.gif",
    "1*z6frToRs3rAs_p7nhPE0Ng.gif",
]


class Next8DataTest(unittest.TestCase):
    def test_patch_is_data_only(self):
        text = open(PATCH, encoding="utf-8", errors="replace").read()
        self.assertNotIn("--- a/index.html", text)
        self.assertNotIn("--- a/assets/projector.js", text)
        self.assertNotIn("--- a/assets/medium_cuts.js", text)
        self.assertNotIn("--- a/assets/thryd_keep.js", text)
        self.assertNotIn("--- a/assets/live_return.js", text)
        self.assertIn("--- a/data/medium_cuts.json", text)
        notes = open(os.path.join(ROOT, "release/next8-early/APPLY.txt"), encoding="utf-8").read()
        self.assertIn("ready 13", notes)
        self.assertIn("do not deploy", notes.lower())

    @unittest.skipUnless(os.path.isfile(HELPER), "next8 helper tar")
    def test_patch_adds_eight_ready_rows_and_keeps_the_first_five(self):
        with tempfile.TemporaryDirectory() as tmp:
            with tarfile.open(HELPER, "r:gz") as tar:
                member = tar.extractfile("helpers/current-source/data/medium_cuts.json").read()
            os.makedirs(os.path.join(tmp, "data"))
            open(os.path.join(tmp, "data/medium_cuts.json"), "wb").write(member)
            before = json.loads(member)
            self.assertEqual(before["counts"]["ready"], 5)
            subprocess.check_call(["patch", "-p1"], cwd=tmp, stdin=open(PATCH, "rb"))
            man = json.load(open(os.path.join(tmp, "data/medium_cuts.json"), encoding="utf-8"))
            self.assertEqual(man["assets"][:5], before["assets"])
            ready = [a for a in man["assets"] if a.get("status") == "ready"]
            self.assertEqual(len(ready), 13)
            self.assertEqual(man["counts"], {"assets": 13, "ready": 13, "not_in_this_file": 955})
            by = {a["medium_image_id"]: a for a in ready}
            total = 0
            for mid in IDS:
                row = by[mid]
                self.assertFalse(row["reviewed"])
                self.assertFalse(row["review"]["clean"])
                self.assertFalse(row["review"]["browser_verified"])
                self.assertTrue(row["review"]["rough_cut"])
                self.assertEqual(row["select"], "?mlib=" + mid.replace("*", "%2A"))
                self.assertEqual(row["url"], "https://miro.medium.com/" + mid)
                self.assertNotIn("object_id", row)
                self.assertNotIn("run", row)
                pack = json.load(open(os.path.join(tmp, row["pack"]), encoding="utf-8"))
                self.assertEqual(pack["status"], "unreviewed")
                self.assertFalse(pack["reviewed"])
                self.assertEqual(pack["source_sha256"], row["source_sha256"])
                self.assertEqual(pack["delays_cs"], row["delays_cs"])
                self.assertEqual(pack["objects"][0]["mask_count"], len(row["delays_cs"]))
                self.assertEqual(pack["objects"][0]["model_class"], "person")
                self.assertIsNone(pack["provenance"].get("engine_id"))
                self.assertFalse(pack["provenance"]["inpaint"])
                self.assertNotIn("object_id", pack)
                if os.path.isdir(ORIGINALS):
                    gif = os.path.join(ORIGINALS, mid.replace("*", "_"))
                    digest = hashlib.sha256(open(gif, "rb").read()).hexdigest()
                    self.assertEqual(digest, row["source_sha256"])
                total += os.path.getsize(os.path.join(tmp, row["pack"]))
            self.assertLess(total, ROOM)
            subprocess.check_call(["sha256sum", "-c", SUMS], cwd=tmp)
            if os.path.isdir(ORIGINALS):
                env = os.environ.copy()
                env["NEXT8_TREE"] = tmp
                env["NEXT8_ORIGINALS"] = ORIGINALS
                subprocess.check_call(
                    ["node", "--test", os.path.join(ROOT, "tests/next8_player.test.mjs")],
                    env=env,
                )


if __name__ == "__main__":
    unittest.main()
