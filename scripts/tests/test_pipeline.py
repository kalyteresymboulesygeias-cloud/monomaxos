"""Offline tests for the auto-blog pipeline (no network, fake Gemini). Run: python -m unittest discover scripts/tests"""
from __future__ import annotations

import os
import shutil
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TMP = Path(tempfile.mkdtemp(prefix="autoblog-test-"))
shutil.copytree(ROOT / "content", TMP / "content")
shutil.copytree(ROOT / "scripts" / "state", TMP / "state", ignore=shutil.ignore_patterns("cache"))
os.environ["AUTO_BLOG_CONTENT_DIR"] = str(TMP / "content")
os.environ["AUTO_BLOG_STATE_DIR"] = str(TMP / "state")
os.environ.pop("UNSPLASH_ACCESS_KEY", None)
sys.path.insert(0, str(ROOT / "scripts"))

import config  # noqa: E402
import generate_articles  # noqa: E402
from autoblog import checks, render, util  # noqa: E402
from autoblog.content import ContentIndex  # noqa: E402
from autoblog.gemini import Article, Verdict  # noqa: E402
from autoblog.pipeline import Runner  # noqa: E402

BLOCKED = util.read_json(config.DATA_DIR / "blocked_terms.json")
SIGNS = ["Κριός", "Ταύρος", "Δίδυμοι", "Καρκίνος", "Λέων", "Παρθένος", "Ζυγός", "Σκορπιός", "Τοξότης", "Αιγόκερως", "Υδροχόος", "Ιχθύες"]
VOCAB = "ήρεμη ματιά πάνω σε μικρές συνήθειες της ημέρας όπου κάθε βήμα μετρά λίγο διαφορετικά ανάλογα με τη διάθεση το φως και τον ρυθμό σας".split()


def filler(seed: int, n: int) -> str:
    return " ".join(VOCAB[(seed * 7 + i * (seed % 5 + 3)) % len(VOCAB)] + ("." if i % 12 == 11 else "") for i in range(n))


def zodia_article(link_slug: str) -> Article:
    parts = [
        "Τα ζώδια σήμερα είναι ψυχαγωγικό περιεχόμενο για μια ήσυχη Δευτέρα. " + filler(1, 40),
        f"Δείτε και τον [οδηγό μας]({config.SITE}/{link_slug}/). " + filler(2, 20),
    ]
    for i, sign in enumerate(SIGNS):
        parts.append(f"## {sign}\n\n" + filler(i + 3, 55))
    parts.append("## Πώς να τα διαβάσετε\n\n" + filler(40, 40))
    parts.append("## Σύντομες ερωτήσεις\n\n### Είναι πρόβλεψη;\n\n" + filler(41, 30))
    return Article(
        title="Ζώδια σήμερα: μια ήρεμη Δευτέρα για όλους",
        meta_description="Τα ζώδια σήμερα για Κριό έως Ιχθύες, με ψυχαγωγική ματιά και μικρές ιδέες για μια ήρεμη Δευτέρα χωρίς υπερβολές και χωρίς απόλυτες προβλέψεις για κανέναν.",
        focus_keyword="Ζώδια σήμερα",
        excerpt="Ψυχαγωγική ματιά στα ζώδια της ημέρας.",
        body_markdown="\n\n".join(parts),
        image_queries=["calm morning sky", "notebook on table", "city at dawn"],
        image_alts=["Ήρεμος πρωινός ουρανός"],
    )


class FakeGemini:
    def __init__(self, article: Article):
        self.article = article
        self.calls = 0

    def generate(self, system, prompt, schema):
        self.calls += 1
        return Verdict(verdict="PASS", reasons=[]) if schema is Verdict else self.article


class NegativeChecks(unittest.TestCase):
    def test_gossip_pregnancy_speculation_fails(self):
        html = "<p>Φήμες λένε ότι η Μαρία Παπαδοπούλου είναι έγκυος στο δεύτερο παιδί της.</p>"
        self.assertTrue(checks.blocked_claims(html, BLOCKED, official_sources=False))

    def test_official_statement_passes(self):
        html = "<p>Η Μαρία Παπαδοπούλου ανακοίνωσε η ίδια σε επίσημη ανακοίνωση ότι είναι έγκυος.</p>"
        self.assertEqual(checks.blocked_claims(html, BLOCKED, official_sources=True), [])

    def test_health_dosage_fails(self):
        html = "<p>Πάρτε 500 mg βιταμίνης C κάθε πρωί.</p><h2>Πότε να μιλήσετε με γιατρό</h2><p>Πάντα.</p>"
        self.assertTrue(any("500 mg" in f for f in checks.health_claims(html, BLOCKED)))

    def test_eight_word_source_overlap_fails(self):
        source = "ο γνωστός ηθοποιός παρουσίασε χθες το βράδυ τη νέα του παράσταση στην Αθήνα"
        html = "<p>Όπως έγινε γνωστό, ο γνωστός ηθοποιός παρουσίασε χθες το βράδυ τη νέα του παράσταση.</p>"
        self.assertTrue(checks.source_overlap(html, [source]))

    def test_unknown_eortologio_name_fails(self):
        html = "<h2>Ποιοι γιορτάζουν σήμερα</h2><ul><li>Μιχαήλ, Μιχάλης, Κλεάνθης</li></ul><h2>Ευχές</h2>"
        fails = checks.eortologio_names(html, {"Μιχαήλ", "Μιχάλης"})
        self.assertEqual(fails, ["άγνωστο όνομα στο εορτολόγιο: Κλεάνθης"])

    def test_invalid_internal_link_removed(self):
        html, stats = render.fix_links('<p><a href="https://monomaxos.gr/den-yparxei-pote/">x</a></p>', kind="health", known_slugs={"allo"}, self_slug=None)
        self.assertNotIn("<a", html)
        self.assertEqual((stats["internal"], stats["removed_internal"]), (0, 1))

    def test_external_link_in_lifestyle_removed(self):
        html, stats = render.fix_links('<p><a href="https://www.okmag.gr/x">κείμενο</a></p>', kind="lifestyle", known_slugs=set(), self_slug=None)
        self.assertEqual(html, "<p>κείμενο</p>")
        self.assertEqual(stats["removed_external"], 1)

    def test_official_link_kept_in_health(self):
        html, _ = render.fix_links('<p><a href="https://eody.gov.gr/a">ΕΟΔΥ</a></p>', kind="health", known_slugs=set(), self_slug=None)
        self.assertIn("eody.gov.gr", html)

    def test_sanitizer_drops_scripts_and_h1(self):
        html = render.markdown_to_html("# Τίτλος\n\n<script>alert(1)</script>\n\nκείμενο")
        self.assertNotIn("<script", html)
        self.assertNotIn("<h1", html)


class SourceUrls(unittest.TestCase):
    def test_only_source_domain_is_followed(self):
        from autoblog.sources import same_site
        base = "https://www.okmag.gr/lifestyle/"
        self.assertTrue(same_site("https://www.okmag.gr/a/b", base))
        self.assertTrue(same_site("https://m.okmag.gr/a", base))
        self.assertFalse(same_site("http://169.254.169.254/latest/meta-data", base))
        self.assertFalse(same_site("https://okmag.gr.evil.com/a", base))
        self.assertFalse(same_site("file:///etc/passwd", base))
        self.assertFalse(same_site("https://www.okmag.gr:8080/a", base))


class EndToEnd(unittest.TestCase):
    def test_switch_off_does_nothing(self):
        os.environ["AUTO_BLOG_ENABLED"] = "false"
        before = (TMP / "content" / "posts-index.json").read_text(encoding="utf-8")
        self.assertEqual(generate_articles.main(["--type", "zodia", "--no-commit"]), 0)
        self.assertEqual((TMP / "content" / "posts-index.json").read_text(encoding="utf-8"), before)

    def test_zodia_publish_then_idempotent(self):
        ctx = ContentIndex(config.CONTENT_DIR)
        link = next(i["slug"] for i in ctx.index if 19 in i["categories"])
        day = date(2026, 11, 9)
        fake = FakeGemini(zodia_article(link))
        first = Runner(day, dry_run=False, commit=False, gemini=fake, log=lambda *_: None)
        first.run("zodia", 1)
        self.assertEqual(first.records[0]["status"], "PASS", first.records[0]["reasons"])
        slug = first.records[0]["slug"]
        self.assertEqual(slug, "zodia-simera-deytera-9-noemvrioy-2026")
        post = ContentIndex(config.CONTENT_DIR).posts[slug]
        self.assertIn("ψυχαγωγικό χαρακτήρα", post["content"]["rendered"])
        self.assertNotIn("Αποποίηση ευθύνης", post["content"]["rendered"])
        second = Runner(day, dry_run=False, commit=False, gemini=fake, log=lambda *_: None)
        second.run("zodia", 1)
        self.assertEqual(second.records[0]["status"], "SKIP")
        self.assertEqual(fake.calls, 1)


if __name__ == "__main__":
    unittest.main()
