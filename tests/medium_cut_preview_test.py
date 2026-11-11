import base64
import json
import os
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
GIF = os.path.join(ROOT, "tests", "fixtures", "cut_two.gif")
TOOL = os.path.join(ROOT, "tools", "medium_cut_preview.py")


def boot_script(html):
    start = html.index('<script id="preview-boot">')
    end = html.index("</script>", start)
    return html[start:end]


class PreviewHtmlTest(unittest.TestCase):
    def test_page_inlines_bytes_and_does_not_touch_the_pack(self):
        source = open(GIF, "rb").read()
        pack = {
            "medium_image_id": "1*cut.gif",
            "kind": "gif",
            "status": "unreviewed",
            "reviewed": False,
            "frame_size": [8, 8],
            "delays_cs": [10, 20],
            "provenance": {"source_url": "https://example.invalid/original.gif"},
            "objects": [{"label": "cut1", "masks": [[0, 1]]}],
        }
        with tempfile.TemporaryDirectory() as tmp:
            pack_path = os.path.join(tmp, "pack.json")
            out = os.path.join(tmp, "preview.html")
            raw = json.dumps(pack).encode("utf-8")
            open(pack_path, "wb").write(raw)
            subprocess.check_call([sys.executable, TOOL, "--source", GIF, "--pack", pack_path, "--out", out])
            self.assertEqual(open(pack_path, "rb").read(), raw)
            self.assertIn("https://example.invalid/original.gif", open(pack_path, encoding="utf-8").read())
            html = open(out, encoding="utf-8").read()
        self.assertIn("PREVIEW ONLY", html)
        self.assertIn("not published", html)
        self.assertIn("reviewed false", html)
        self.assertNotIn("http://", html)
        self.assertNotIn("https://", html)
        self.assertNotIn("<script src", html.lower())
        self.assertNotIn("<link ", html.lower())
        self.assertNotIn("url(", html)
        self.assertNotIn("@import", html)
        boot = boot_script(html)
        self.assertNotIn("fetch(", boot)
        self.assertIn("ThrydMediumPreview.mount", boot)
        self.assertIn('"status":"unreviewed"', html)
        self.assertIn("function decodeGif", html)
        self.assertIn("function compose", html)
        self.assertIn("function attach", html)
        encoded = html.split('b64ToBytes("', 1)[1].split('")', 1)[0]
        self.assertEqual(base64.b64decode(encoded), source)


if __name__ == "__main__":
    unittest.main()
