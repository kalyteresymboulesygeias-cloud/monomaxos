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
from autoblog import openai_llm  # noqa: E402

BLOCKED = util.read_json(config.DATA_DIR / "blocked_terms.json")
SIGNS = ["Κριός", "Ταύρος", "Δίδυμοι", "Καρκίνος", "Λέων", "Παρθένος", "Ζυγός", "Σκορπιός", "Τοξότης", "Αιγόκερως", "Υδροχόος", "Ιχθύες"]
VOCAB = "ήρεμη ματιά πάνω σε μικρές συνήθειες της ημέρας όπου κάθε βήμα μετρά λίγο διαφορετικά ανάλογα με τη διάθεση το φως και τον ρυθμό σας".split()


def filler(seed: int, n: int) -> str:
    return " ".join(VOCAB[(seed * 7 + i * (seed % 5 + 3)) % len(VOCAB)] + ("." if i % 12 == 11 else "") for i in range(n))


def zodia_article(link_slug: str) -> Article:
    signs = "".join(f"<tr><td>{sign}</td><td>μικρή καθημερινή ιδέα</td></tr>" for sign in SIGNS)
    questions = "".join(f"<h3>Ερώτηση {i} για τα ζώδια σήμερα;</h3><p>{filler(50 + i, 55)}</p>" for i in range(1, 6))
    sections = "".join(
        f"<h2>Ζώδια σήμερα, ενότητα {i}</h2><p>{filler(10 + i, 160)}</p>" for i in range(1, 5)
    )
    body = f"""
<p>Στην αρχαία παράδοση ο ζωδιακός κύκλος μοίραζε τον χρόνο σε δώδεκα τόξα. Ζώδια σήμερα, λοιπόν, διαβάζονται ως παιχνίδι της ημέρας και όχι ως οδηγία. {filler(1, 70)}</p>
<ul>
<li><strong>Διαβάζεις για ευχαρίστηση.</strong> Δεν είναι πρόβλεψη.</li>
<li><strong>Κρατάς ό,τι σου ταιριάζει.</strong> Αφήνεις τα υπόλοιπα.</li>
<li><strong>Δεν αλλάζεις απόφαση.</strong> Η μέρα σου μένει δική σου.</li>
<li><strong>Κοιτάς και τα δώδεκα.</strong> Κάθε ζώδιο έχει τη δική του γραμμή.</li>
</ul>
{sections}
<table><thead><tr><th>Ζώδιο</th><th>Σημείωση</th></tr></thead><tbody>{signs}</tbody></table>
<ol><li>Διάβασε το δικό σου ζώδιο.</li><li>Κράτα μία ιδέα.</li><li>Συνέχισε τη μέρα σου.</li></ol>
{questions}
<h2>Τι Κάνεις Τώρα</h2>
<p>Δες και τον <a href="{config.SITE}/{link_slug}/">οδηγό</a>. {filler(80, 40)}</p>
<p><em>Αποποίηση ευθύνης: Το άρθρο αυτό έχει αποκλειστικά ψυχαγωγικό και ενημερωτικό χαρακτήρα. Η αστρολογία δεν αποτελεί επιστήμη και δεν πρέπει να χρησιμοποιείται ως βάση για σημαντικές αποφάσεις. Οι πληροφορίες προέρχονται από την αστρολογική παράδοση και τις δημοφιλείς ερμηνείες.</em></p>
"""
    return Article(
        title="Ζώδια σήμερα: μια ήρεμη Δευτέρα για όλους",
        meta_description="Τα ζώδια σήμερα για Κριό έως Ιχθύες, με ψυχαγωγική ματιά και μικρές ιδέες για μια ήρεμη Δευτέρα χωρίς υπερβολές και χωρίς απόλυτες προβλέψεις για κανέναν.",
        focus_keyword="Ζώδια σήμερα",
        excerpt="Ψυχαγωγική ματιά στα ζώδια της ημέρας.",
        body_markdown=body,
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

    def test_nameday_block_lists_data_names_and_un_days(self):
        from autoblog import namedays

        data = namedays.for_day(date(2026, 11, 16))
        block = render.nameday_block(date(2026, 11, 16), data["groups"], data["world_days"])
        self.assertIn("<h2>16 Νοεμβρίου 2026</h2>", block)
        self.assertIn("<p>Ιφιγένεια,<br>Ματθαίος,<br>Μαθαίος,<br>Μαθιός,<br>Ματθούλα,<br>Μαθούλα.</p>", block)
        self.assertIn("Επίσης σήμερα είναι η Διεθνής Ημέρα Ανεκτικότητας και η Διεθνής Ημέρα Μεσογειακής Διατροφής.", block)

    def test_saint_section_must_be_in_orthodox_synaxarion(self):
        from autoblog import namedays

        saints = namedays.for_day(date(2026, 11, 17))["saints"]
        good = "<h2>17 Νοεμβρίου 2026</h2><h2>Ο Γρηγόριος ο Θαυματουργός στην παράδοση της 17 Νοεμβρίου 2026</h2>"
        bad = "<h2>17 Νοεμβρίου 2026</h2><h2>Η αγία Χίλντα στην παράδοση της 17 Νοεμβρίου 2026</h2>"
        self.assertEqual(checks.eortologio_saint(good, saints), [])
        self.assertTrue(checks.eortologio_saint(bad, saints))
        self.assertNotIn("Χίλντα", namedays.for_day(date(2026, 11, 17))["names"])

    def test_movable_feast_saint_passes(self):
        from autoblog import namedays

        saints = namedays.for_day(date(2026, 4, 4))["saints"]
        html = "<h2>4 Απριλίου 2026</h2><h2>Ο Λάζαρος στην παράδοση της 4 Απριλίου 2026</h2>"
        self.assertEqual(checks.eortologio_saint(html, saints), [])

    def test_third_declension_saint_passes(self):
        saints = ["Λέοντος πάπα Ρώμης"]
        html = "<h2>18 Φεβρουαρίου 2026</h2><h2>Ο Λέων στην παράδοση της 18 Φεβρουαρίου 2026</h2>"
        self.assertEqual(checks.eortologio_saint(html, saints), [])

    def test_nameday_block_has_calendar_note(self):
        block = render.nameday_block(date(2026, 11, 17), [["Γεννάδιος"]], [])
        self.assertIn("Για αλλαγή της ημερομηνίας στο παλαιό ημερολόγιο (Ιουλιανό) αφαιρέστε 13 ημέρες", block)

    def test_nameday_block_without_un_day(self):
        block = render.nameday_block(date(2026, 11, 17), [["Γρηγόριος", "Γρηγόρης"]], [])
        self.assertNotIn("Επίσης", block)
        self.assertIn("<p>Γρηγόριος,<br>Γρηγόρης.</p>", block)

    def test_eortologio_structure(self):
        body = (
            "<p>Το τελώνιο βρίσκεται στην αρχή της αφήγησης.</p><h3>Τι Πρέπει να Θυμάσαι</h3>"
            "<ul><li><strong>Α:</strong> ένα</li><li><strong>Β:</strong> δύο</li><li><strong>Γ:</strong> τρία</li><li><strong>Δ:</strong> τέσσερα</li></ul>"
            "<h2>Ο Ματθαίος στην παράδοση</h2><p>Κείμενο.</p>"
            "<p><em>Αποποίηση ευθύνης: Δεν αποτελούν θεολογική ερμηνεία ή επίσημη θέση της Εκκλησίας.</em></p>"
        )
        html = render.insert_after_takeaways(body, render.nameday_block(date(2026, 11, 16), [["Ιφιγένεια"]], []))
        self.assertLess(html.index("</ul>"), html.index("<h2>16 Νοεμβρίου 2026</h2>"))
        self.assertLess(html.index("<h2>16 Νοεμβρίου 2026</h2>"), html.index("Ο Ματθαίος στην παράδοση"))
        self.assertEqual(checks.eortologio_structure(None, html), [])
        faq = html.replace("<p><em>", "<h3>Ερώτηση;</h3><h3>Άλλη;</h3><table><tr><td>x</td></tr></table><p><em>")
        self.assertTrue(checks.eortologio_structure(None, faq))
        extra = html.replace("<p><em>", "<h2>Πώς να ευχηθείς</h2><p>Ευχές.</p><p><em>")
        self.assertTrue(checks.eortologio_structure(None, extra))

    def test_invalid_internal_link_removed(self):
        html, stats = render.fix_links('<p><a href="https://monomaxos.gr/den-yparxei-pote/">x</a></p>', kind="health", known_slugs={"allo"}, self_slug=None)
        self.assertNotIn("<a", html)
        self.assertEqual((stats["internal"], stats["removed_internal"]), (0, 1))

    def test_external_link_in_lifestyle_removed(self):
        html, stats = render.fix_links('<p><a href="https://www.okmag.gr/x">κείμενο</a></p>', kind="lifestyle", known_slugs=set(), self_slug=None)
        self.assertEqual(html, "<p>κείμενο</p>")
        self.assertEqual(stats["removed_external"], 1)

    def test_official_link_kept_in_lifestyle(self):
        html, stats = render.fix_links('<p><a href="https://www.who.int/news">ΠΟΥ</a></p>', kind="lifestyle", known_slugs=set(), self_slug=None)
        self.assertIn("who.int", html)
        self.assertEqual(stats["official"], 1)

    def test_official_link_kept_in_health(self):
        html, _ = render.fix_links('<p><a href="https://eody.gov.gr/a">ΕΟΔΥ</a></p>', kind="health", known_slugs=set(), self_slug=None)
        self.assertIn("eody.gov.gr", html)

    def test_choris_is_not_a_divorce_claim(self):
        html = "<p>Συμφώνησε τη διάθεση: Ρώτησε αν προτιμά κουβέντα, χωρίς να οργανώσεις πολλές επιλογές.</p>"
        self.assertEqual(checks.blocked_claims(html, BLOCKED, official_sources=False), [])

    def test_divorce_claim_still_fails(self):
        html = "<p>Φήμες λένε ότι η Μαρία Παπαδοπούλου χώρισε τον σύντροφό της.</p>"
        self.assertTrue(checks.blocked_claims(html, BLOCKED, official_sources=False))
        html = "<p>Η Μαρία Παπαδοπούλου μίλησε για τον χωρισμό της.</p>"
        self.assertTrue(checks.blocked_claims(html, BLOCKED, official_sources=False))
        html = "<p>Η Μαρία Παπαδοπούλου χωρίστηκε από τον σύντροφό της.</p>"
        self.assertTrue(checks.blocked_claims(html, BLOCKED, official_sources=False))
        html = "<p>Λέγεται ότι η Μαρία Παπαδοπούλου θα χωριστεί σύντομα.</p>"
        self.assertTrue(checks.blocked_claims(html, BLOCKED, official_sources=False))

    def test_augmented_death_still_fails(self):
        html = "<p>Φήμες λένε ότι η Μαρία Παπαδοπούλου απέθανε ξαφνικά.</p>"
        self.assertTrue(checks.blocked_claims(html, BLOCKED, official_sources=False))
        html = "<p>Η Μαρία Παπαδοπούλου αποχωρίστηκε από τον σύντροφό της.</p>"
        self.assertTrue(checks.blocked_claims(html, BLOCKED, official_sources=False))

    def test_repeated_private_claims_still_fail(self):
        for sentence in (
            "Φήμες λένε ότι η Μαρία Παπαδοπούλου ξανασυνελήφθη χθες.",
            "Ο Νίκος Παπαδόπουλος επαναπροφυλακίστηκε μετά την απόφαση.",
            "Η Μαρία Παπαδοπούλου ξανανοσηλεύτηκε την ίδια εβδομάδα.",
            "Η Μαρία Παπαδοπούλου επανενοσηλεύτηκε την ίδια εβδομάδα.",
            "Ο Νίκος Παπαδόπουλος ξαναχρεοκόπησε μέσα στη χρονιά.",
        ):
            html = f"<p>{sentence}</p>"
            self.assertTrue(checks.blocked_claims(html, BLOCKED, official_sources=False), sentence)

    def test_register_and_immortalize_are_not_private_claims(self):
        html = "<p>Η Μαρία Παπαδοπούλου καταχώρισε το νέο της σήμα.</p>"
        self.assertEqual(checks.blocked_claims(html, BLOCKED, official_sources=False), [])
        html = "<p>Ο Νίκος Παπαδόπουλος καταχωρίζει κάθε εμφάνιση στο αρχείο.</p>"
        self.assertEqual(checks.blocked_claims(html, BLOCKED, official_sources=False), [])
        html = "<p>Η Μαρία Παπαδοπούλου αποθανάτισε τη βραδιά με μια φωτογραφία.</p>"
        self.assertEqual(checks.blocked_claims(html, BLOCKED, official_sources=False), [])
        html = "<p>Η Μαρία Παπαδοπούλου μίλησε για την επανάσταση του 1821.</p>"
        self.assertEqual(checks.blocked_claims(html, BLOCKED, official_sources=False), [])

    def test_athanatos_is_not_a_death_claim(self):
        html = "<p>Η Μαρία Παπαδοπούλου μένει αθάνατη στη μνήμη του κοινού.</p>"
        self.assertEqual(checks.blocked_claims(html, BLOCKED, official_sources=False), [])

    def test_xexorizei_is_not_a_divorce_claim(self):
        html = "<p>Η Μαρία Παπαδοπούλου ξεχωρίζει για τη δουλειά της στη σκηνή.</p>"
        self.assertEqual(checks.blocked_claims(html, BLOCKED, official_sources=False), [])
        html = "<p>Η Μαρία Παπαδοπούλου ξεχώρισε στην παράσταση της Αθήνας.</p>"
        self.assertEqual(checks.blocked_claims(html, BLOCKED, official_sources=False), [])

    def test_zodia_disclaimer_is_not_repetition(self):
        disclaimer = (
            "Αποποίηση ευθύνης: Το άρθρο αυτό έχει αποκλειστικά ψυχαγωγικό και ενημερωτικό χαρακτήρα. "
            "Η αστρολογία δεν αποτελεί επιστήμη και δεν πρέπει να χρησιμοποιείται ως βάση για σημαντικές αποφάσεις. "
            "Οι πληροφορίες προέρχονται από την αστρολογική παράδοση και τις δημοφιλείς ερμηνείες."
        )
        html = f"<h2>Συχνές ερωτήσεις για τα ζώδια της ημέρας</h2><p>Νέα πρόβλεψη για τον Κριό σήμερα.</p><p><em>{disclaimer}</em></p>"
        previous = [disclaimer + " Συχνές ερωτήσεις για τα ζώδια της ημέρας 2026 αξιολόγησε την με βάση τη δική σου εμπειρία"]
        self.assertEqual(checks.zodia_repetition(html, previous), [])

    def test_zodia_copied_sentence_still_fails(self):
        sentence = "η πρωινή βόλτα μένει σύντομη και χωρίς βιασύνη όταν ο καιρός είναι βαρύς στην πόλη"
        html = f"<p>{sentence}</p>"
        self.assertTrue(checks.zodia_repetition(html, [sentence]))

    def test_daily_zodia_title_is_not_a_duplicate(self):
        ctx = ContentIndex(config.CONTENT_DIR)
        title = "Ζώδια σήμερα: Ο οδηγός σου για τις 17 Νοεμβρίου 2026"
        self.assertIsNotNone(ctx.similar_title(title, config.SIMILARITY_REJECT))
        self.assertIsNone(ctx.similar_title(title, config.SIMILARITY_REJECT, {407}))

    def test_daily_eortologio_title_is_not_a_duplicate(self):
        ctx = ContentIndex(config.CONTENT_DIR)
        title = "Εορτολόγιο 22 Νοεμβρίου: Ποιοι γιορτάζουν το 2026"
        self.assertIsNotNone(ctx.similar_title(title, config.SIMILARITY_REJECT))
        self.assertIsNone(ctx.similar_title(title, config.SIMILARITY_REJECT, {config.CATEGORY_BY_TYPE["eortologio"]}))

    def test_lifestyle_does_not_need_takeaways_or_plan(self):
        article = zodia_article("kapoio-arthro").model_copy(update={"focus_keyword": "Θέμα", "title": "Θέμα που μένει μέσα στο όριο τίτλου"})
        html = (
            "<p>Εισαγωγή για το θέμα, χωρίς λίστα από κάτω.</p>"
            "<h2>Θέμα στην πρώτη ενότητα</h2><p>Κείμενο ενότητας.</p>"
            "<h2>Θέμα στη δεύτερη ενότητα</h2><p>Κείμενο ενότητας.</p>"
            "<h2>Θέμα στην τρίτη ενότητα</h2><p>Κείμενο ενότητας.</p>"
            "<h2>Θέμα στην τέταρτη ενότητα</h2><p>Κείμενο ενότητας.</p>"
            "<p><em>Αποποίηση ευθύνης: Οι αναφορές βασίζονται σε δημόσια γνωστές πληροφορίες.</em></p>"
        )
        fails = checks.editorial_structure(
            article, html,
            disclaimer=("αποποίηση ευθύνης", "δημόσια γνωστές πληροφορίες"),
            h2_range=(4, 6),
            require_closing=False,
            require_takeaways=False,
            require_steps=False,
        )
        self.assertEqual(fails, [])
        still_required = checks.editorial_structure(article, html, require_closing=False)
        self.assertTrue(any("Θυμάσαι" in item for item in still_required))
        self.assertTrue(any("πλάνο" in item for item in still_required))

    def test_lifestyle_meta_near_miss_passes(self):
        ctx = ContentIndex(config.CONTENT_DIR)
        article = zodia_article("kapoio-arthro")
        article = article.model_copy(update={"meta_description": "α" * 166, "title": "Ένας εντελώς νέος τίτλος lifestyle για το τεστ"})
        fails = checks.common(
            article,
            "<p>" + ("λέξη " * 200) + "</p>",
            kind="lifestyle",
            slug="neo-slug-pou-den-yparxei-pote",
            ctx=ctx,
        )
        self.assertFalse(any(item.startswith("meta ") for item in fails), fails)

    def test_zodia_and_lifestyle_publish_without_checks(self):
        article = Article(
            title="μικρό",
            meta_description="κοντό",
            focus_keyword="άλλο",
            excerpt="σύντομο",
            body_markdown="<p>Η Μαρία Παπαδοπούλου χώρισε, χωρίς άλλη λίστα και χωρίς αποποίηση.</p>",
            image_queries=["a table", "a room", "a street"],
            image_alts=["τραπέζι"],
        )
        runner = Runner(date(2027, 11, 18), dry_run=True, commit=False, log=lambda *_: None)
        base = {
            "slug": "dokimi-pou-den-yparxei",
            "topic": "δοκιμή",
            "update": False,
            "previous": ["η πρωινή βόλτα μένει σύντομη και χωρίς βιασύνη όταν ο καιρός είναι βαρύς στην πόλη"],
            "source_texts": ["Η Μαρία Παπαδοπούλου χώρισε, χωρίς άλλη λίστα και χωρίς αποποίηση από την πηγή"],
        }
        zodia_fails, _, _ = runner.check("zodia", {**base, "category": 407}, article)
        lifestyle_fails, _, _ = runner.check("lifestyle", {**base, "category": 408}, article)
        self.assertEqual(zodia_fails, [])
        self.assertEqual(lifestyle_fails, [])

    def test_zodia_missing_link_is_inserted(self):
        ctx = ContentIndex(config.CONTENT_DIR)
        link = next(item["slug"] for item in ctx.index if 19 in item["categories"])
        article = zodia_article(link)
        article = article.model_copy(update={"body_markdown": article.body_markdown.replace(f'<a href="{config.SITE}/{link}/">οδηγό</a>', "οδηγό")})
        runner = Runner(date(2027, 11, 9), dry_run=True, commit=False, log=lambda *_: None)
        plan = runner.plan("zodia", 0)
        fails, html, _slug = runner.check("zodia", plan, article)
        self.assertNotIn("<a href=", article.body_markdown)
        self.assertIn("<a href=", html)
        self.assertFalse(any("σύνδεσμο" in item for item in fails), fails)

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
        self.assertFalse(same_site("https://www.okmag.gr:99999/a", base))
        self.assertFalse(same_site("http://[::1/a", base))


class EndToEnd(unittest.TestCase):
    def test_switch_off_does_nothing(self):
        os.environ["AUTO_BLOG_ENABLED"] = "false"
        before = (TMP / "content" / "posts-index.json").read_text(encoding="utf-8")
        self.assertEqual(generate_articles.main(["--type", "zodia", "--no-commit"]), 0)
        self.assertEqual((TMP / "content" / "posts-index.json").read_text(encoding="utf-8"), before)

    def test_zodia_publish_then_idempotent(self):
        ctx = ContentIndex(config.CONTENT_DIR)
        link = next(i["slug"] for i in ctx.index if 19 in i["categories"])
        day = date(2027, 11, 8)
        fake = FakeGemini(zodia_article(link))
        first = Runner(day, dry_run=False, commit=False, gemini=fake, log=lambda *_: None)
        first.run("zodia", 1)
        self.assertEqual(first.records[0]["status"], "PASS", first.records[0]["reasons"])
        slug = first.records[0]["slug"]
        self.assertEqual(slug, "zodia-simera-deytera-8-noemvrioy-2027")
        post = ContentIndex(config.CONTENT_DIR).posts[slug]
        self.assertIn("ψυχαγωγικό και ενημερωτικό χαρακτήρα", post["content"]["rendered"])
        self.assertIn("δεν αποτελεί επιστήμη", post["content"]["rendered"])
        second = Runner(day, dry_run=False, commit=False, gemini=fake, log=lambda *_: None)
        second.run("zodia", 1)
        self.assertEqual(second.records[0]["status"], "SKIP")
        self.assertEqual(fake.calls, 1)


class OpenAIWriterTests(unittest.TestCase):
    def setUp(self):
        import httpx2
        from unittest import mock
        self.httpx = httpx2
        os.environ["OPENAI_MODEL"] = "gpt-main"
        os.environ["OPENAI_FALLBACK_MODEL"] = "gpt-backup"
        patcher = mock.patch.object(openai_llm.time, "sleep", lambda *_: None)
        patcher.start()
        self.addCleanup(patcher.stop)

    def error(self, cls, status, body=None):
        response = self.httpx.Response(status, request=self.httpx.Request("POST", "https://api.openai.com/v1/responses"))
        return cls("boom", response=response, body=body)

    def writer(self, replies):
        from types import SimpleNamespace
        calls = []

        def create(**kw):
            calls.append(kw["model"])
            reply = replies.pop(0)
            if isinstance(reply, Exception):
                raise reply
            return reply

        client = SimpleNamespace(responses=SimpleNamespace(create=create))
        return openai_llm.OpenAIWriter(openai_llm.Budget("2026-11-09", persist=False), client=client), calls

    @staticmethod
    def ok(text, status="completed", content_type="output_text"):
        from types import SimpleNamespace
        part = SimpleNamespace(type=content_type, text=text)
        return SimpleNamespace(status=status, incomplete_details=None, output=[SimpleNamespace(type="message", content=[part])], output_text=text)

    def test_model_list_error_skips_check(self):
        import openai
        from types import SimpleNamespace

        def fail():
            raise openai.APIConnectionError(request=self.httpx.Request("GET", "https://api.openai.com/v1/models"))

        writer, _ = self.writer([])
        writer._check_models(SimpleNamespace(models=SimpleNamespace(list=fail)))
        self.assertEqual(writer.fallback, "gpt-backup")

    def test_strict_schema_has_no_defaults(self):
        schema = openai_llm.strict_schema(Verdict)
        self.assertNotIn("default", str(schema))
        self.assertEqual(sorted(schema["required"]), ["reasons", "verdict"])

    def test_retries_server_error_then_parses(self):
        import openai
        writer, calls = self.writer([self.error(openai.InternalServerError, 500), self.ok('{"verdict": "PASS", "reasons": []}')])
        self.assertEqual(writer.generate("s", "p", Verdict).verdict, "PASS")
        self.assertEqual(calls, ["gpt-main", "gpt-main"])

    def test_insufficient_quota_goes_to_fallback(self):
        import openai
        for code in ("insufficient_quota", "credit_balance_exhausted"):
            quota = self.error(openai.RateLimitError, 429, {"code": code})
            writer, calls = self.writer([quota, self.ok('{"verdict": "FAIL", "reasons": ["x"]}')])
            self.assertEqual(writer.generate("s", "p", Verdict).verdict, "FAIL")
            self.assertEqual(calls, ["gpt-main", "gpt-backup"])

    def test_bad_request_is_not_retried(self):
        import openai
        writer, calls = self.writer([self.error(openai.BadRequestError, 400)])
        with self.assertRaises(openai_llm.GenerationError):
            writer.generate("s", "p", Verdict)
        self.assertEqual(calls, ["gpt-main"])

    def test_refusal_and_incomplete_fail(self):
        writer, _ = self.writer([self.ok("no", content_type="refusal"), self.ok("{", status="incomplete")])
        for _ in range(2):
            with self.assertRaises(openai_llm.GenerationError):
                writer.generate("s", "p", Verdict)


if __name__ == "__main__":
    unittest.main()
