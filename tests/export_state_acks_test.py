"""The box export_state.py patch attaches same-run acks and invents none."""
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FIXTURE = os.path.join(ROOT, "tests", "fixtures", "box_source", "export_state.py")
PATCH = os.path.join(ROOT, "patches", "export_state_acks.patch")
HELPER = os.path.join(ROOT, "tools", "movement_acks_export.py")


def apply_patched(dest_dir):
    os.makedirs(dest_dir, exist_ok=True)
    shutil.copy(FIXTURE, os.path.join(dest_dir, "export_state.py"))
    with open(PATCH, encoding="utf-8") as fh:
        subprocess.check_call(["patch", "-p1"], cwd=dest_dir, stdin=fh)


def load_module(path, run_dir):
    sys.modules.pop("movement_acks_export", None)
    os.environ["THRYD_RUN"] = run_dir
    name = "export_state_patched_" + str(abs(hash(path)))
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class ExportStateAcksTest(unittest.TestCase):
    def test_patch_keeps_same_run_ids_and_drops_foreign_ones(self):
        with tempfile.TemporaryDirectory() as tmp:
            proj = os.path.join(tmp, "projector")
            apply_patched(proj)
            tools = os.path.join(proj, "tools")
            os.makedirs(tools)
            shutil.copy(HELPER, os.path.join(tools, "movement_acks_export.py"))
            run_dir = os.path.join(tmp, "run-2eb42d")
            os.makedirs(os.path.join(run_dir, "run"))
            ack_path = os.path.join(run_dir, "run", "movement_acks.json")
            with open(ack_path, "w", encoding="utf-8") as fh:
                json.dump({"run": "run-2eb42d", "movement_acks": ["e1", "e2"]}, fh)
            mod = load_module(os.path.join(proj, "export_state.py"), run_dir)
            same = mod._movement_acks({"run": "run-2eb42d"})
            self.assertEqual(same["movement_acks"], {"run": "run-2eb42d", "movement_acks": ["e1", "e2"]})
            with open(ack_path, "w", encoding="utf-8") as fh:
                json.dump({"run": "run-5a58c4", "movement_acks": ["foreign"]}, fh)
            foreign = mod._movement_acks({"run": "run-2eb42d"})
            self.assertEqual(foreign["movement_acks"], {"run": "run-2eb42d", "movement_acks": []})
            os.remove(ack_path)
            missing = mod._movement_acks({"run": "run-2eb42d"})
            self.assertEqual(missing["movement_acks"]["movement_acks"], [])

    def test_broken_helper_adds_no_ids(self):
        with tempfile.TemporaryDirectory() as tmp:
            proj = os.path.join(tmp, "projector")
            apply_patched(proj)
            tools = os.path.join(proj, "tools")
            os.makedirs(tools)
            with open(os.path.join(tools, "movement_acks_export.py"), "w", encoding="utf-8") as fh:
                fh.write("raise RuntimeError('helper unavailable')\n")
            run_dir = os.path.join(tmp, "run-2eb42d")
            os.makedirs(os.path.join(run_dir, "run"))
            with open(os.path.join(run_dir, "run", "movement_acks.json"), "w", encoding="utf-8") as fh:
                json.dump({"run": "run-2eb42d", "movement_acks": ["must-not-leak"]}, fh)
            mod = load_module(os.path.join(proj, "export_state.py"), run_dir)
            out = mod._movement_acks({"run": "run-2eb42d"})
            self.assertEqual(out["movement_acks"], {"run": "run-2eb42d", "movement_acks": []})

    def test_write_calls_the_helper_and_does_not_name_another_run(self):
        with open(PATCH, encoding="utf-8") as fh:
            text = fh.read()
        self.assertIn("load_movement_acks", text)
        self.assertIn('f"{R}/run/movement_acks.json"', text)
        self.assertNotIn("run-5a58c4", text)
        self.assertIn("d=_movement_acks(export())", text)


if __name__ == "__main__":
    unittest.main()
