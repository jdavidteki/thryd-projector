import json
import os
import re
import unittest
from collections import defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FLAT = os.path.join(ROOT, "data", "tweets_all.json")
SOURCE = os.environ.get(
    "TWEETS_SOURCE",
    "/home/ubuntu/.cursor/projects/workspace/uploads/tweets_22e3.json",
)
ORIGINAL = os.environ.get(
    "TWEETS_FLAT_ORIGINAL",
    "/home/ubuntu/.cursor/projects/workspace/uploads/tweets_all_60de.json",
)


def map_ids(flat, source):
    by = defaultdict(list)
    for sid, rec in source.items():
        if not isinstance(sid, str) or not sid.isdigit():
            continue
        flagged = isinstance(rec.get("purged"), list) and len(rec["purged"]) > 0
        by[rec["text"]].append((sid, rec["year"], flagged))
    out = []
    for rec in flat:
        chosen = None
        rows = by.get(rec["line"], [])
        if len(rows) == 1:
            chosen = rows[0]
        else:
            year = re.fullmatch(r"tweet (\d{4})", rec.get("src") or "")
            if year:
                same = [row for row in rows if row[1] == int(year.group(1))]
                if len(same) == 1:
                    chosen = same[0]
        out.append(chosen)
    return out


class TweetIdTest(unittest.TestCase):
    def test_published_lines_keep_order_and_only_exact_ids(self):
        flat = json.load(open(FLAT, encoding="utf-8"))
        self.assertEqual(len(flat), 3617)
        self.assertEqual([rec["src"][:5] for rec in flat].count("tweet"), 3617)
        ids = [rec.get("id") for rec in flat if rec.get("id")]
        self.assertEqual(len(ids), 3564)
        self.assertEqual(sum(1 for rec in flat if not rec.get("id")), 53)
        self.assertTrue(all(isinstance(i, str) and i.isdigit() for i in ids))
        self.assertEqual(len(set(ids)), len(ids))
        by_line = {rec["line"]: rec for rec in flat}
        mental = "grown ass nigerian men walking around who won't admit that mental health is a real thing that needs to be paid attention to! i wan cry."
        self.assertEqual(by_line[mental]["id"], "1537852396017180673")
        self.assertEqual(by_line[mental]["src"], "tweet 2022")
        if os.path.isfile(SOURCE):
            source = json.load(open(SOURCE, encoding="utf-8"))
            self.assertEqual(len(source), 3958)
            queen = source["1628307842821234689"]["text"]
            endsars = source["1450727828719390723"]["text"]
            self.assertEqual(by_line[queen]["id"], "1628307842821234689")
            self.assertEqual(by_line[queen]["src"], "tweet 2023")
            self.assertEqual(by_line[endsars]["id"], "1450727828719390723")
            self.assertEqual(by_line[endsars]["src"], "tweet 2021")
            chosen = map_ids(flat, source)
            self.assertEqual(sum(1 for row in chosen if row), 3564)
            self.assertEqual(sum(1 for row in chosen if not row), 53)
            self.assertEqual(sum(1 for row in chosen if row and row[2]), 244)
            original = json.load(open(ORIGINAL, encoding="utf-8")) if os.path.isfile(ORIGINAL) else None
            for rec, row in zip(flat, chosen):
                if row:
                    self.assertEqual(rec.get("id"), row[0])
                    self.assertEqual(rec.get("purged", False), row[2])
                else:
                    self.assertNotIn("id", rec)
            if original:
                self.assertEqual(
                    [(r["line"], r["card"], r["src"], r["move"]) for r in flat],
                    [(r["line"], r["card"], r["src"], r["move"]) for r in original],
                )


if __name__ == "__main__":
    unittest.main()
