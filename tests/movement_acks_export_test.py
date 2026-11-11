import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
from movement_acks_export import load_movement_acks, movement_acks_for_state


class AcksExportTest(unittest.TestCase):
    def test_matching_run_keeps_ids(self):
        doc = {"run": "run-5a58c4", "movement_acks": ["e1", "e2"]}
        self.assertEqual(movement_acks_for_state("run-5a58c4", doc)["movement_acks"], ["e1", "e2"])

    def test_other_run_contributes_nothing(self):
        doc = {"run": "run-5a58c4", "movement_acks": ["e1"]}
        out = movement_acks_for_state("run-2eb42d", doc)
        self.assertEqual(out, {"run": "run-2eb42d", "movement_acks": []})

    def test_bare_list_and_missing_file(self):
        self.assertEqual(movement_acks_for_state("run-2eb42d", ["e1"])["movement_acks"], [])
        self.assertEqual(load_movement_acks("run-2eb42d", None)["movement_acks"], [])

    def test_load_refuses_foreign_file(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "movement_acks.json")
            with open(path, "w", encoding="utf-8") as f:
                json.dump({"run": "run-5a58c4", "movement_acks": ["foreign"]}, f)
            out = load_movement_acks("run-2eb42d", path)
            self.assertEqual(out["movement_acks"], [])
            same = load_movement_acks("run-5a58c4", path)
            self.assertEqual(same["movement_acks"], ["foreign"])


if __name__ == "__main__":
    unittest.main()
