#!/usr/bin/env python3
"""Write one offline HTML file that plays a cut pack.

  python3 tools/medium_cut_preview.py \
    --source /path/to/original.gif \
    --pack /path/to/pack.json \
    --out /path/to/preview.html

The page inlines the GIF bytes, the pack JSON, the cut player, and the
cut CSS. It does not fetch. Opening it does not change the pack file.
The page copies the pack in memory and sets status to ready so the
official player will mount; reviewed stays false, and the banner says
the file is a preview, not a publication.
"""
import argparse
import base64
import json
import os
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
PLAYER = ROOT / "assets" / "medium_cuts.js"
BOOT = ROOT / "assets" / "medium_cut_preview.js"
# The four cut rules from assets/projector.css. No url() and no @import.
CUT_CSS = """
#mcut{position:absolute;inset:0;z-index:2;pointer-events:none}
#stage:has(#mcut) > img{opacity:0!important;transition:none!important}
#mcut canvas.plate{position:absolute;pointer-events:none}
#mcut canvas.sprite{position:absolute;pointer-events:auto;touch-action:none;cursor:grab}
body.cerebro #mcut,body.lovemap #mcut{display:none}
#stage{position:relative;width:100vw;height:calc(100vh - 4.2rem);background:#1a1a1a;overflow:hidden}
#stage img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#banner{box-sizing:border-box;min-height:4.2rem;padding:.6rem 1rem;background:#3a2200;color:#ffe7b0;font:600 14px/1.35 ui-sans-serif,sans-serif}
"""


def _offline_copy(value):
    """Drop URL strings from the inlined copy. The pack file is not edited."""
    if isinstance(value, str):
        if value.startswith("http://") or value.startswith("https://"):
            return ""
        return value
    if isinstance(value, list):
        return [_offline_copy(v) for v in value]
    if isinstance(value, dict):
        return {k: _offline_copy(v) for k, v in value.items()}
    return value


def build_html(source, pack, player_js, boot_js):
    gif_b64 = base64.b64encode(source).decode("ascii")
    pack_json = json.dumps(_offline_copy(pack), separators=(",", ":"), ensure_ascii=True)
    banner = (
        "PREVIEW ONLY — not published. The pack file on disk is unchanged "
        "(reviewed false, status %s). This page copies it in memory and sets "
        "status to ready so the official player can mount. Do not publish this file."
        % (pack.get("status") or "unreviewed",)
    )
    html = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Cut preview — not published</title>
<style>__CSS__</style>
</head>
<body>
<p id="banner">__BANNER__</p>
<div id="stage"><img id="pic" alt=""></div>
<script id="cut-player">__PLAYER__</script>
<script id="preview-boot">__BOOT__
(function(){
  var pack = __PACK__;
  var bytes = ThrydMediumPreview.b64ToBytes("__GIF__");
  ThrydMediumPreview.mount({
    pack: pack,
    bytes: bytes,
    stage: document.getElementById("stage"),
    image: document.getElementById("pic")
  }).then(function(res){
    var note = document.getElementById("banner");
    if(!res || !res.ok) note.textContent += " Mount failed: " + ((res && res.reason) || "unavailable") + ".";
  });
})();
</script>
</body>
</html>
"""
    return (html
            .replace("__CSS__", CUT_CSS)
            .replace("__BANNER__", banner)
            .replace("__PLAYER__", player_js)
            .replace("__BOOT__", boot_js)
            .replace("__PACK__", pack_json)
            .replace("__GIF__", gif_b64))


def main(argv=None):
    ap = argparse.ArgumentParser(description="Build a self-contained cut preview HTML file.")
    ap.add_argument("--source", required=True)
    ap.add_argument("--pack", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args(argv)
    with open(args.pack, "rb") as fh:
        before = fh.read()
    pack = json.loads(before.decode("utf-8"))
    with open(args.source, "rb") as fh:
        source = fh.read()
    html = build_html(source, pack, PLAYER.read_text(encoding="utf-8"), BOOT.read_text(encoding="utf-8"))
    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(html)
    with open(args.pack, "rb") as fh:
        after = fh.read()
    if after != before:
        raise SystemExit("pack file changed")
    print(json.dumps({"out": os.path.abspath(args.out), "bytes": len(html.encode("utf-8")), "pack_unchanged": True}))


if __name__ == "__main__":
    main()
