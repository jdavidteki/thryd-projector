import json, os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
from bind_cast_ids import bind_authored_tags, state_id_for_cut

FIX = os.path.join(os.path.dirname(__file__), "fixtures")

class BindTest(unittest.TestCase):
    def setUp(self):
        self.cast = json.load(open(os.path.join(FIX, "cast_objects_run-2eb42d.json"), encoding="utf-8"))
        self.spec = json.load(open(os.path.join(FIX, "j1_spec_tags.json"), encoding="utf-8"))

    def test_unique_authored_tags_bind_with_provenance(self):
        out = bind_authored_tags(self.spec, self.cast)
        got = {b["tag"]: b["object_id"] for b in out["bindings"]}
        self.assertEqual(got, {
            "Ronke": "cast1_2eb42d",
            "Mama Ronke": "cast3_2eb42d",
            "Kazeem": "cast2_2eb42d",
        })
        ronke = next(b for b in out["bindings"] if b["tag"] == "Ronke")
        self.assertEqual(ronke["provenance"]["source"], "authored_spec_tag")
        self.assertEqual(ronke["provenance"]["cast_field"], "cast_names")
        self.assertEqual(ronke["provenance"]["setup_sha256"], self.cast["setup_sha256"])
        unmapped = {u["tag"] for u in out["unmapped_tags"]}
        self.assertEqual(unmapped, {"the lamp", "the cap", "the cooler"})

    def test_detector_and_hints_and_spelling_stay_unmapped(self):
        out = bind_authored_tags(self.spec, self.cast)
        self.assertIsNone(state_id_for_cut("person1", out))
        self.assertIsNone(state_id_for_cut("lamp", out))
        self.assertIsNone(state_id_for_cut("the lamp", out))
        self.assertIsNone(state_id_for_cut("ronke", out))
        self.assertIsNone(state_id_for_cut("Kazeem ", out))
        self.assertEqual(state_id_for_cut("Kazeem", out), "cast2_2eb42d")

    def test_duplicate_tag_or_cast_name_does_not_bind(self):
        spec = {"card": "j1", "tags": [
            [0, 0, 1, 1, "Ronke", "r"],
            [0, 0, 1, 1, "Ronke", "r"],
        ]}
        out = bind_authored_tags(spec, self.cast)
        self.assertEqual(out["bindings"], [])
        self.assertEqual(out["unmapped_tags"][0]["reason"], "tag_not_unique")
        cast = json.loads(json.dumps(self.cast))
        cast["cast"].append(dict(cast["cast"][0]))
        one = {"card": "j1", "tags": [[0, 0, 1, 1, "Ronke", "r"]]}
        out = bind_authored_tags(one, cast)
        self.assertEqual(out["bindings"], [])
        self.assertEqual(out["unmapped_tags"][0]["reason"], "no_unique_cast_entry")

    def test_missing_provenance_is_not_a_cast_entry(self):
        cast = {"run": "run-2eb42d", "cast": [{"index": 1, "cast_name": "Ronke", "object_id": "cast1_2eb42d", "provenance": {"field": "display", "name": "Ronke"}}]}
        out = bind_authored_tags({"card": "j1", "tags": [[0, 0, 1, 1, "Ronke", "r"]]}, cast)
        self.assertEqual(out["bindings"], [])

    def test_geometry_is_not_an_input(self):
        # The overlap note is not consulted. A person1 box cannot become Kazeem.
        out = bind_authored_tags({"card": "j1", "tags": [[744, 108, 1124, 720, "person1", "l"]]}, self.cast)
        self.assertEqual(out["bindings"], [])
        self.assertEqual(out["unmapped_tags"][0]["reason"], "detector_label")


if __name__ == "__main__":
    unittest.main()
