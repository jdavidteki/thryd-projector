import os
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PATCH = os.path.join(ROOT, "release", "tweet-embed", "tweet-embed.patch")


class TweetEmbedReleaseTest(unittest.TestCase):
    def test_patch_is_the_bubble_and_the_archive_ids_only(self):
        text = open(PATCH, encoding="utf-8", errors="replace").read()
        self.assertIn("diff -ruN a/assets/tweet_embed.js", text)
        self.assertIn("diff -ruN a/assets/projector.js", text)
        self.assertIn("diff -ruN a/data/tweets_all.json", text)
        self.assertNotIn("data/medium_cuts.json", text)
        self.assertNotIn("assets/medium_cuts/", text)
        notes = open(os.path.join(ROOT, "release/tweet-embed/APPLY.txt"), encoding="utf-8").read()
        self.assertIn("538a69e0", notes)
        self.assertIn("notnotnotnotyn", notes)
        self.assertIn("do not deploy", notes.lower())


if __name__ == "__main__":
    unittest.main()
