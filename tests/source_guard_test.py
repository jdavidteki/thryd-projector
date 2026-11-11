"""Restart hold is checked in restart.sh, which the running sync calls by path.

These tests never execute pkill, cloudflared, or a drag.json write.
"""
import os
import shutil
import subprocess
import tempfile
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FIX = os.path.join(ROOT, "tests", "fixtures", "box_source")


def apply_all(dest):
    os.makedirs(dest, exist_ok=True)
    for name in ("sync_pages.sh", "restart.sh"):
        shutil.copy(os.path.join(FIX, name), os.path.join(dest, name))
    for patch in ("sync_pages_maintenance.patch", "restart_maintenance.patch"):
        with open(os.path.join(ROOT, "patches", patch), encoding="utf-8") as fh:
            subprocess.check_call(["patch", "-p1"], cwd=dest, stdin=fh)


class RestartHoldTest(unittest.TestCase):
    def test_hold_file_stops_before_pkill_and_absence_reaches_the_body(self):
        with tempfile.TemporaryDirectory() as tmp:
            apply_all(tmp)
            with open(os.path.join(tmp, "restart.sh"), encoding="utf-8") as fh:
                script = fh.read()
            body = script.index('D=/workspace/thryd-drag; cd $D')
            self.assertLess(script.index("exit 0"), body)
            self.assertLess(body, script.index("pkill -f"))
            neutered = script[:body] + "echo REACHED_BODY\n"
            path = os.path.join(tmp, "restart_neutered.sh")
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(neutered)
            os.chmod(path, 0o755)
            hold = os.path.join(tmp, "RESTART_HOLD")
            open(hold, "w").close()
            env = dict(os.environ)
            env["THRYD_DRAG_RESTART_HOLD"] = hold
            held = subprocess.run(["bash", path], capture_output=True, text=True, env=env, check=False)
            self.assertEqual(held.returncode, 0)
            self.assertIn("restart skipped", held.stderr)
            self.assertNotIn("REACHED_BODY", held.stdout)
            env.pop("THRYD_DRAG_RESTART_HOLD", None)
            # The default hold path must not exist in this test, or the body would be skipped.
            self.assertFalse(os.path.exists("/workspace/thryd-drag/RESTART_HOLD"))
            open_body = subprocess.run(["bash", path], capture_output=True, text=True, env=env, check=False)
            self.assertEqual(open_body.returncode, 0)
            self.assertIn("REACHED_BODY", open_body.stdout)
            self.assertNotIn("restart skipped", open_body.stderr)

    def test_sync_still_publishes_and_only_the_restart_line_is_gated(self):
        with tempfile.TemporaryDirectory() as tmp:
            apply_all(tmp)
            with open(os.path.join(tmp, "sync_pages.sh"), encoding="utf-8") as fh:
                text = fh.read()
            subprocess.check_call(["bash", "-n", os.path.join(tmp, "sync_pages.sh")])
            hold = text.index('THRYD_DRAG_RESTART_HOLD:-/workspace/thryd-drag/RESTART_HOLD')
            pgrep = text.index("pgrep -f /workspace/thryd-drag/server.py")
            export = text.index('python3 "$SRC/export_state.py"')
            tar = text.index("tar -C \"$SRC\"")
            push = text.index("git push -q origin main")
            self.assertLess(hold, pgrep)
            self.assertLess(pgrep, export)
            self.assertLess(export, tar)
            self.assertLess(tar, push)
            self.assertIn('bash "$0" once', text)
            # publishing commands stay outside the hold conditional
            self.assertIn("export_live_extra.py", text)
            self.assertNotIn("cloudflared", text)


if __name__ == "__main__":
    unittest.main()
