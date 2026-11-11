#!/usr/bin/env python3
"""Convert finished raw JSON packs to the gzip mask and gzip plate form.

This does not segment, and it does not read or write the running batch's
state file. --full on medium_cut_batch.py still skips a valid raw pack and
does not convert it. Run this only after that batch has finished, and write
to a different directory.

  python3 tools/medium_cut_reconcile.py \
    --in /workspace/medium-object-extraction-20261111/packs \
    --out /workspace/medium-object-extraction-20261111/packs-compact

source_sha256, delays_cs, frame count, mask pixels, status, and reviewed
are kept. A zlib plate (header 78 da) becomes plate_gzip_b64. The printed
compact_bytes value is the full file, plate included.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from medium_cut_batch import reconcile_dir


def main(argv=None):
    ap = argparse.ArgumentParser(description="Reconcile raw cut packs to gzip without resegmenting.")
    ap.add_argument("--in", dest="src", required=True)
    ap.add_argument("--out", dest="dest", required=True)
    args = ap.parse_args(argv)
    rows = reconcile_dir(args.src, args.dest)
    total_in = sum(r["orig_bytes"] for r in rows)
    total_out = sum(r["compact_bytes"] for r in rows)
    summary = {"packs": len(rows), "orig_bytes": total_in, "compact_bytes": total_out, "rows": rows}
    json.dump(summary, open(os.path.join(args.dest, "_reconcile_summary.json"), "w"), indent=1)
    print(json.dumps({"packs": len(rows), "orig_bytes": total_in, "compact_bytes": total_out}))


if __name__ == "__main__":
    main()
