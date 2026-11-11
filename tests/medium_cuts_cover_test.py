import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
from medium_cuts_cover import cover

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class CoverTest(unittest.TestCase):
    def test_cover_lists_every_remote_and_no_agenda_row(self):
        live = json.load(open(os.path.join(ROOT, "data", "live_extra.json"), encoding="utf-8"))
        doc = cover(live["sets"])
        self.assertEqual(doc["counts"], {
            "assets": 968, "gif": 651, "still": 317, "ready": 0, "awaiting_manifest": 968,
        })
        ids = [a["medium_image_id"] for a in doc["assets"]]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertTrue(all(a["status"] == "awaiting_manifest" for a in doc["assets"]))
        self.assertTrue(all("run" not in a and "jN" not in a and "object_id" not in a for a in doc["assets"]))
        local = [s for s in live["sets"] if s.get("how") != "medium"]
        self.assertEqual(len(local), 134)
        self.assertTrue(all(s.get("how") == "gif" for s in local))


if __name__ == "__main__":
    unittest.main()
