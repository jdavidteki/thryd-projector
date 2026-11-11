import json, os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
from build_medium_library import local_media_id, merge, remote_set
from export_live_extra import is_remote, retain_remote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class LibraryTest(unittest.TestCase):
    def test_merge_keeps_local_and_skips_exact_id(self):
        existing = [{"dir": "assets/webp/live/safe-abc_m1", "run": "safe-abc", "how": "gif", "frames": 18, "src": "/box/1_Aa.gif", "card": "m1", "jN": "m1"}]
        media = [
            {"medium_image_id": "1*Aa.gif", "extension": "gif", "representative_url": "https://miro.medium.com/1*Aa.gif", "in_prior_518_manifest": True, "safes": [{"safe_id": "s1", "title": "t"}]},
            {"medium_image_id": "1*Bb.jpeg", "extension": "jpeg", "representative_url": "https://miro.medium.com/v2/resize:fit:1400/1*Bb.jpeg", "in_prior_518_manifest": False, "safes": []},
            {"medium_image_id": "0*A-2jZPa3uxhAL2AC", "extension": None, "representative_url": None, "safes": []},
        ]
        merged, report = merge(existing, media)
        self.assertEqual(merged[0], existing[0])
        self.assertEqual(len(report["deduped_local"]), 1)
        self.assertEqual(len(report["added"]), 1)
        self.assertEqual(report["added"][0]["url"], "https://miro.medium.com/v2/resize:fit:1400/1*Bb.jpeg")
        self.assertEqual(report["added"][0]["run"], "safe-1*Bb.jpeg")
        self.assertIsNone(report["added"][0]["jN"])
        self.assertEqual(report["excluded"][0]["medium_image_id"], "0*A-2jZPa3uxhAL2AC")
        self.assertEqual(local_media_id(existing[0]["src"]), "1*Aa.gif")

    def test_exporter_keeps_remote_without_frames(self):
        local = [{"dir": "assets/webp/live/run-2eb42d_j1", "how": "gif", "frames": 4}]
        remote = {"dir": "medium/1*Bb.jpeg", "how": "medium", "remote": True, "url": "https://miro.medium.com/1*Bb.jpeg", "medium_image_id": "1*Bb.jpeg"}
        out = retain_remote([local[0], remote], local)
        self.assertEqual(out, [local[0], remote])
        self.assertTrue(is_remote(remote))
        self.assertFalse(is_remote(local[0]))

    def test_committed_library_counts(self):
        live = json.load(open(os.path.join(ROOT, "data", "live_extra.json"), encoding="utf-8"))
        lib = json.load(open(os.path.join(ROOT, "data", "medium_library.json"), encoding="utf-8"))
        sets = live["sets"]
        self.assertEqual(lib["counts"]["existing_local_sets"], 134)
        self.assertEqual(lib["counts"]["existing_safe_local"], 9)
        self.assertEqual(lib["counts"]["deduped_already_local"], 9)
        self.assertEqual(lib["counts"]["added_remote_gif"], 651)
        self.assertEqual(lib["counts"]["added_remote_stills"], 317)
        self.assertEqual(lib["counts"]["added_remote"], 968)
        self.assertEqual(lib["counts"]["usable"], 977)
        self.assertEqual(lib["counts"]["excluded"], 1)
        self.assertEqual(len(sets), 1102)
        local, remote = sets[:134], sets[134:]
        self.assertTrue(all(s.get("how") == "gif" and s.get("frames", 0) > 1 for s in local))
        self.assertEqual(len(remote), 968)
        ids = [s["medium_image_id"] for s in remote]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertNotIn("0*A-2jZPa3uxhAL2AC", ids)
        deduped = {d["medium_image_id"] for d in lib["deduped_local"]}
        self.assertEqual(len(deduped), 9)
        self.assertTrue(deduped.isdisjoint(ids))
        for s in remote:
            self.assertTrue(s["run"].startswith("safe-"))
            self.assertNotEqual(s["run"][:4], "run-")
            self.assertIsNone(s["jN"])
            self.assertEqual(s["url"], s["provenance"]["representative_url"])
            self.assertTrue(s["url"].startswith("https://miro.medium.com/"))
            self.assertEqual(s["url"].rstrip("/").split("/")[-1], s["medium_image_id"])
            self.assertTrue(s["dir"].startswith("medium/"))
            self.assertNotIn("durs", s)
        self.assertEqual(sum(1 for s in remote if s["extension"] == "gif"), 651)
        self.assertEqual(sum(1 for s in remote if s["extension"] in ("jpeg", "png")), 317)
        # the nine local safe sources are the deduped originals
        safe = [s for s in local if str(s.get("run", "")).startswith("safe-")]
        self.assertEqual({local_media_id(s["src"]) for s in safe}, deduped)

if __name__ == "__main__":
    unittest.main()
