import hashlib
import json
import os
import subprocess
import tarfile
import tempfile
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PATCH = os.path.join(ROOT, "release", "next4-early", "next4-data.patch")
SUMS = os.path.join(ROOT, "release", "next4-early", "SHA256SUMS")
HELPER = os.environ.get(
    "NEXT4_HELPER_TAR",
    "/home/ubuntu/.cursor/projects/workspace/uploads/next4-packs-and-helpers.tar_24c0.gz",
)
ROOM = 1073741824 - 791846092 - 41943040
IDS = {
    "1*RsUH6hRZMu8g1gDOm4UE_w.gif": ("864661aa0a88eaab6e21cd6fd41ff3b8a4d465991e7dae8c2b98a3ed4b3664f7", 48),
    "1*mLI9DdjeK7bjQNUNI9SZ3A.gif": ("02fdcc87f648d3acc44e809cc9676991a6eb6bc615153d720ed8204b6e5b757f", 48),
    "1*u3S2J-ivnMgJ7O47y14ayQ.gif": ("f2cfc2a237e9bd45549a095dd6b3dbbaaf8f1e771771f20a8d708d8e1bdc9c97", 54),
    "1*7_tJmvly2Fh5nQh7LBY5WQ.gif": ("2cd2f1279645d52cad266b5c2e46b463883c36a26f23021adbdbfb0e3f12c9d8", 54),
}


class Next4DataTest(unittest.TestCase):
    def test_patch_is_data_only(self):
        text = open(PATCH, encoding="utf-8", errors="replace").read()
        self.assertNotIn("--- a/index.html", text)
        self.assertNotIn("--- a/assets/projector.js", text)
        self.assertNotIn("--- a/assets/medium_cuts.js", text)
        self.assertIn("--- a/data/medium_cuts.json", text)

    @unittest.skipUnless(os.path.isfile(HELPER), "next4 helper tar")
    def test_patch_adds_four_ready_rows_and_keeps_qa5(self):
        with tempfile.TemporaryDirectory() as tmp:
            with tarfile.open(HELPER, "r:gz") as tar:
                member = tar.extractfile("helpers/current-source/data/medium_cuts.json").read()
            os.makedirs(os.path.join(tmp, "data"))
            open(os.path.join(tmp, "data/medium_cuts.json"), "wb").write(member)
            before = json.loads(member)
            subprocess.check_call(["patch", "-p1"], cwd=tmp, stdin=open(PATCH, "rb"))
            man = json.load(open(os.path.join(tmp, "data/medium_cuts.json"), encoding="utf-8"))
            self.assertEqual(man["assets"][0], before["assets"][0])
            ready = [a for a in man["assets"] if a.get("status") == "ready"]
            self.assertEqual(len(ready), 5)
            self.assertEqual(man["counts"]["ready"], 5)
            self.assertEqual(man["counts"]["not_in_this_file"], 963)
            by = {a["medium_image_id"]: a for a in ready}
            self.assertIn("1*UQolGv9h9_i7sWsk3lDLCA.gif", by)
            total = 0
            for mid, (sha, n) in IDS.items():
                row = by[mid]
                self.assertFalse(row["reviewed"])
                self.assertFalse(row["review"]["clean"])
                self.assertFalse(row["review"]["browser_verified"])
                self.assertEqual(row["source_sha256"], sha)
                self.assertEqual(len(row["delays_cs"]), n)
                self.assertEqual(row["select"], "?mlib=" + mid.replace("*", "%2A"))
                self.assertEqual(row["url"], "https://miro.medium.com/" + mid)
                pack = json.load(open(os.path.join(tmp, row["pack"]), encoding="utf-8"))
                self.assertEqual(pack["status"], "unreviewed")
                self.assertFalse(pack["reviewed"])
                self.assertEqual(pack["source_sha256"], sha)
                self.assertEqual(pack["delays_cs"], row["delays_cs"])
                self.assertEqual(pack["objects"][0]["mask_count"], n)
                self.assertIsNone(pack["provenance"].get("engine_id"))
                self.assertFalse(pack["provenance"]["inpaint"])
                total += os.path.getsize(os.path.join(tmp, row["pack"]))
            self.assertLess(total, ROOM)
            subprocess.check_call(["sha256sum", "-c", SUMS], cwd=tmp)


if __name__ == "__main__":
    unittest.main()
