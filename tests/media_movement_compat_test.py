"""Apply the movement patch to the media-enabled source snapshot and check both stay intact."""
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FIX = os.path.join(ROOT, "tests", "fixtures", "media_source")
PATCH = os.path.join(ROOT, "patches", "movement-on-media.patch")


class MediaMovementCompatTest(unittest.TestCase):
    def test_patch_keeps_media_markers_and_loads_movement_first(self):
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, "assets"))
            shutil.copy(os.path.join(FIX, "index.html"), os.path.join(tmp, "index.html"))
            shutil.copy(os.path.join(FIX, "projector.js"), os.path.join(tmp, "assets", "projector.js"))
            shutil.copy(os.path.join(FIX, "projector.css"), os.path.join(tmp, "assets", "projector.css"))
            with open(PATCH, encoding="utf-8") as fh:
                subprocess.check_call(["patch", "-p1"], cwd=tmp, stdin=fh)
            index = Path(tmp, "index.html").read_text(encoding="utf-8")
            js = Path(tmp, "assets", "projector.js").read_text(encoding="utf-8")
            css = Path(tmp, "assets", "projector.css").read_text(encoding="utf-8")
            movement = Path(tmp, "assets", "movement.js").read_text(encoding="utf-8")
            self.assertIn("__CODEVER__", index)
            self.assertNotIn("c63cae2153", index)
            self.assertIn('id="mlib"', index)
            self.assertIn("['movement.js?v=1','projector.js?v=57','extras.js?v=50','alive.js?v=50']", index)
            self.assertNotIn("slide_clock", index)
            self.assertLess(index.index("movement.js?v=1"), index.index("projector.js?v=57"))
            for needle in ("function remoteSet", "window.thrydLibrary", "$('mlib')", "how==='medium'",
                           "thrydMoves.observeState", "ThrydMovement.attach({bridge:{enabled:false}})"):
                self.assertIn(needle, js)
            self.assertIn("#mlib", css)
            self.assertIn("#mvstatus", css)
            self.assertIn("Bridge stays off", movement)
            self.assertIn("opts.bridge&&opts.bridge.enabled", movement)
            subprocess.check_call(["node", "--check", os.path.join(tmp, "assets", "movement.js")])
            subprocess.check_call(["node", "--check", os.path.join(tmp, "assets", "projector.js")])


if __name__ == "__main__":
    unittest.main()
