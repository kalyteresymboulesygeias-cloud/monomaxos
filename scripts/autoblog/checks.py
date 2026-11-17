"""Deterministic checks. Each returns a list of failure reasons (empty = pass)."""
from __future__ import annotations

import re

import config

from . import render, util

PLACEHOLDERS = re.compile(r"\[|\]|\bTODO\b|lorem|\bXX\b", re.IGNORECASE)
CLICHES = ("στον σημερινό κόσμο", "σε έναν κόσμο που", "στη σημερινή εποχή", "δεν είναι μυστικό ότι", "θαυματουργ")
ZODIA_ORDER = ["Κριός", "Ταύρος", "Δίδυμοι", "Καρκίνος", "Λέων", "Παρθένος", "Ζυγός", "Σκορπιός", "Τοξότης", "Αιγόκερως", "Υδροχόος", "Ιχθύες"]
SENTENCE_SPLIT = re.compile(r"(?<=[.!;;])\s+")
CAPITALIZED = re.compile(r"\b[A-ZΑ-ΩΆ-Ώ][a-zα-ωά-ώϊϋΐΰ]+")


def common(article, html: str, *, kind: str, slug: str, ctx, self_slug: str | None = None) -> list[str]:
    fails: list[str] = []
    low, high = config.WORD_RANGE[kind]
    count = render.word_count(html)
    if not low <= count <= high:
        fails.append(f"μήκος {count} λέξεις, ζητούνται {low}-{high}")
    min_h2 = config.MIN_H2.get(kind, 3)
    if len(render.h2_titles(html)) < min_h2:
        fails.append(f"λιγότερα από {min_h2} H2")
    if "<h1" in html.lower() or re.search(r"^# ", article.body_markdown, re.M):
        fails.append("υπάρχει H1")
    if not 25 <= len(article.title) <= 60:
        fails.append(f"τίτλος {len(article.title)} χαρακτήρες, ζητούνται 25-60")
    # Daily zodia and lifestyle titles/descriptions land a few characters
    # outside the ideal SEO band. That is not a reason to drop the article.
    meta_low, meta_high = (120, 170) if kind in ("zodia", "lifestyle") else (140, 160)
    if not meta_low <= len(article.meta_description) <= meta_high:
        fails.append(f"meta {len(article.meta_description)} χαρακτήρες, ζητούνται {meta_low}-{meta_high}")
    key = util.fold(article.focus_keyword).strip()
    if not key or key not in util.fold(article.title):
        fails.append("το focus keyword λείπει από τον τίτλο")
    first = " ".join(util.html_text(html).split()[:110])
    if key and key not in util.fold(first):
        fails.append("το focus keyword λείπει από τις πρώτες 100 λέξεις")
    everything = " ".join([article.title, article.meta_description, article.excerpt, util.html_text(html)])
    dashes = everything.count("\u2014")
    if dashes > 2:
        fails.append(f"em dash (—) {dashes} φορές, μέγιστο 2")
    if PLACEHOLDERS.search(everything):
        fails.append("υπάρχει placeholder ([, ], TODO, lorem, XX)")
    for phrase in CLICHES:
        if phrase in util.fold(everything):
            fails.append(f"κλισέ φράση: {phrase}")
    if slug in ctx.slugs and slug != self_slug:
        fails.append(f"το slug {slug} υπάρχει ήδη")
    # Every day's horoscope is titled «Ζώδια σήμερα …». That series is not a duplicate.
    skip_categories = {config.CATEGORY_BY_TYPE["zodia"]} if kind == "zodia" else None
    clash = None if self_slug else ctx.similar_title(article.title, config.SIMILARITY_REJECT, skip_categories)
    if clash:
        fails.append(f"ο τίτλος μοιάζει με υπάρχοντα: {clash}")
    meta_key = " ".join(util.words(article.meta_description))
    own_meta = ""
    if self_slug:
        own_meta = " ".join(util.words((ctx.posts.get(self_slug) or {}).get("meta_description") or ""))
    if meta_key in ctx.metas and meta_key != own_meta:
        fails.append("η meta description υπάρχει ήδη")
    return fails


def _named_person(sentence: str) -> bool:
    caps = CAPITALIZED.findall(sentence)
    return len(caps) > 1 or bool(caps and not sentence.strip().startswith(caps[0]))


# One-letter past augment, only for verb stems. «αθάνατος» must not match «θανατ».
_VERBAL_AUGMENT = ("α", "ε")
_AUGMENTED_ROOTS = {"πεθαν", "πεθαιν"}
# Only divorce stems take these prefixes. «καταχωρίζει» is not a breakup, and «αποθανάτισε» is not a death.
_DIVORCE_ROOTS = {
    "χωρισμ", "χωρισε", "χωρισαν", "χωρισαμ", "χωρισατ",
    "χωρισουν", "χωριστηκ", "χωριστε", "χωριστου", "χωριζ",
}
_DIVORCE_PREFIXES = ("απο", "ξανα")


def _stem_in_token(token: str, root: str) -> bool:
    if token.startswith(root):
        return True
    if root in _AUGMENTED_ROOTS and any(token.startswith(mark + root) for mark in _VERBAL_AUGMENT):
        return True
    if root in _DIVORCE_ROOTS:
        return any(token.startswith(prefix + root) for prefix in _DIVORCE_PREFIXES)
    return False


def _root_hit(folded: str, roots: list[str]) -> str | None:
    """Match a stem at the start of a word, after a past augment, or after a real prefix.

    «απέθανε» counts as «πεθαν». «ξεχωρίζει» does not count as «χωρίζει», and «χωρίς» is not «χωρισμός».
    """
    tokens = util.words(folded)
    for root in roots:
        if " " in root:
            if root in folded:
                return root
            continue
        if any(_stem_in_token(token, root) for token in tokens):
            return root
    return None


def blocked_claims(html: str, blocked: dict, official_sources: bool) -> list[str]:
    fails = []
    roots = [util.fold(r) for r in blocked["roots"]]
    markers = [util.fold(m) for m in blocked["official_markers"]]
    for sentence in SENTENCE_SPLIT.split(util.html_text(html)):
        folded = util.fold(sentence)
        hit = _root_hit(folded, roots)
        if not hit or not _named_person(sentence):
            continue
        if official_sources and any(m in folded for m in markers):
            continue
        fails.append(f"απαγορευμένος ισχυρισμός για πρόσωπο ({hit}): {sentence[:120]}")
    return fails


def health_claims(html: str, blocked: dict) -> list[str]:
    text = util.html_text(html)
    fails = []
    for pattern in blocked["health_patterns"]:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            fails.append(f"μη επιτρεπτή ιατρική διατύπωση: {match.group(0)}")
    return fails


CONCLUSION_TITLES = ("Το Τελικό Συμπέρασμα", "Η Επόμενη Κίνησή σου", "Τι Κάνεις Τώρα")
OPENERS = ("Σε έναν κόσμο", "Στη σύγχρονη εποχή", "Καλώς ήρθατε", "Είναι γνωστό ότι", "Όλοι γνωρίζουμε")
EDITORIAL_CLICHES = (
    "αναμφίβολα", "εντυπωσιακός", "εντυπωσιακή", "εντυπωσιακό",
    "αξιοσημείωτος", "αξιοσημείωτη", "αξιοσημείωτο", "ουσιαστικός", "ουσιαστική", "ουσιαστικό",
)


def editorial_structure(
    article,
    html: str,
    *,
    disclaimer: tuple[str, ...] = ("αποποίηση ευθύνης", "δεν αποτελεί ιατρική συμβουλή"),
    extra_cliches: tuple[str, ...] = (),
    h2_range: tuple[int, int] = (5, 8),
    require_closing: bool = True,
    require_takeaways: bool = True,
    require_steps: bool = True,
) -> list[str]:
    """House template: sections, disclaimer, and, where the type asks for them, takeaways and a plan."""
    from bs4 import BeautifulSoup

    fails: list[str] = []
    soup = BeautifulSoup(html, "html.parser")
    text = util.html_text(html)
    folded = util.fold(text)
    padded = f" {folded} "
    start = util.fold(" ".join(text.split()[:8]))
    if any(start.startswith(util.fold(opener)) for opener in OPENERS):
        fails.append("απαγορευμένη εκκίνηση εισαγωγής")
    if require_takeaways:
        bullets = soup.find("ul")
        if bullets is None or len(bullets.find_all("li")) < 4 or bullets.find("strong") is None:
            fails.append("λείπει το πλαίσιο «Τι Πρέπει να Θυμάσαι» με 4-5 έντονα bullets")
    if require_steps and soup.find("ol") is None:
        fails.append("λείπει αριθμημένη λίστα ή πρακτικό πλάνο")
    h2s = render.h2_titles(html)
    low_h2, high_h2 = h2_range
    if not low_h2 <= len(h2s) <= high_h2:
        fails.append(f"{len(h2s)} ενότητες H2, ζητούνται {low_h2}-{high_h2}")
    titles = [util.fold(h) for h in h2s]
    if require_closing:
        endings = [util.fold(title) for title in CONCLUSION_TITLES]
        if not any(title == wanted or title.startswith(wanted) for title in titles for wanted in endings):
            fails.append("το κλείσιμο πρέπει να είναι «Το Τελικό Συμπέρασμα», «Η Επόμενη Κίνησή σου» ή «Τι Κάνεις Τώρα»")
        if "συμπερασμα" in titles:
            fails.append("μην τιτλοφορείς το κλείσιμο σκέτο «Συμπέρασμα»")
        if len(soup.find_all("h3")) < 5:
            fails.append("οι συχνές ερωτήσεις χρειάζονται 5 ερωτήσεις σε H3")
    if any(util.fold(mark) not in folded for mark in disclaimer):
        fails.append("λείπει η αποποίηση ευθύνης στο τέλος")
    key = util.fold(article.focus_keyword).strip()
    if key and sum(key in title for title in titles) < 2:
        fails.append("η λέξη-κλειδί λείπει από δύο H2")
    first_h2 = soup.find("h2")
    if first_h2 is not None:
        before = []
        for sib in first_h2.previous_siblings:
            before.append(sib.get_text(" ", strip=True) if hasattr(sib, "get_text") else str(sib))
        if len(" ".join(reversed(before)).split()) > 220:
            fails.append("το πρώτο H2 είναι μετά τις πρώτες 200 λέξεις")
    for phrase in (*EDITORIAL_CLICHES, *extra_cliches):
        if f" {util.fold(phrase)} " in padded:
            fails.append(f"κλισέ λέξη: {phrase}")
            break
    return fails


def source_overlap(html: str, source_texts: list[str]) -> list[str]:
    shared = util.shared_phrases(util.html_text(html), source_texts, 8)
    return [f"κοινή ακολουθία 8+ λέξεων με πηγή: «{s}»" for s in shared]


def eortologio_structure(article, html: str) -> list[str]:
    """Intro, takeaways, the generated names block, one saint section, disclaimer last."""
    from bs4 import BeautifulSoup

    fails: list[str] = []
    soup = BeautifulSoup(html, "html.parser")
    text = util.html_text(html)
    start = util.fold(" ".join(text.split()[:8]))
    if any(start.startswith(util.fold(opener)) for opener in OPENERS):
        fails.append("απαγορευμένη εκκίνηση εισαγωγής")
    bullets = soup.find("ul")
    if bullets is None or len(bullets.find_all("li")) < 4 or bullets.find("strong") is None:
        fails.append("λείπει το πλαίσιο «Τι Πρέπει να Θυμάσαι» με 4-5 έντονα bullets")
    if len(soup.find_all("ul")) > 1 or soup.find(["ol", "table"]) is not None:
        fails.append("μόνο το πλαίσιο «Τι Πρέπει να Θυμάσαι» ως λίστα, χωρίς πίνακα ή αριθμημένη λίστα")
    h2s = render.h2_titles(html)
    if len(h2s) != 2:
        fails.append(f"{len(h2s)} ενότητες H2, ζητείται μία ενότητα για τον άγιο")
    if len(soup.find_all("h3")) > 1:
        fails.append("χωρίς υποενότητες ή συχνές ερωτήσεις σε H3")
    last = soup.find_all("p")[-1:]
    if not last or not all(util.fold(m) in util.fold(last[0].get_text(" ", strip=True)) for m in ("αποποίηση ευθύνης", "δεν αποτελούν θεολογική ερμηνεία")):
        fails.append("το άρθρο πρέπει να τελειώνει με την αποποίηση ευθύνης")
    padded = f" {util.fold(text)} "
    for phrase in EDITORIAL_CLICHES:
        if f" {util.fold(phrase)} " in padded:
            fails.append(f"κλισέ λέξη: {phrase}")
            break
    return fails


NAME_WORDS = {"και", "σημερα", "οι", "η", "ο", "αγιοσ", "αγια", "αγιου", "αγιασ", "αγιοι", "οσιοσ", "οσια"}


def eortologio_names(html: str, allowed: set[str]) -> list[str]:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    cells = soup.find_all(["li", "td"])
    if not cells:
        return ["λείπει λίστα ή πίνακας με τα ονόματα της ημέρας"]
    ok = {util.fold(n) for n in allowed}
    calendar = {util.fold(w) for w in (*util.GREEK_DAYS, *util.GREEK_MONTHS_GEN, "χρόνια", "πολλά")}
    fails = []
    saw_name = False
    for cell in cells:
        text = cell.get_text(" ", strip=True)
        words = text.split()
        # Instruction bullets are sentences. Name cells are short lists.
        if len(words) > 8:
            continue
        caps = CAPITALIZED.findall(text)
        if not caps or len(caps) * 2 < len(words):
            continue
        for name in caps:
            folded = util.fold(name)
            if folded in ok:
                saw_name = True
            elif folded not in NAME_WORDS and folded not in calendar:
                fails.append(f"άγνωστο όνομα στο εορτολόγιο: {name}")
    if not saw_name and not any(util.fold(n) in util.fold(soup.get_text(" ", strip=True)) for n in allowed):
        fails.append("δεν εμφανίζεται κανένα όνομα από το εορτολόγιο της ημέρας")
    return fails


def eortologio_saint(html: str, saints: list[str]) -> list[str]:
    """The saint section heading must name someone in the Orthodox synaxarion of the day."""
    h2s = render.h2_titles(html)
    if len(h2s) < 2:
        return []
    calendar = {util.fold(w) for w in (*util.GREEK_DAYS, *util.GREEK_MONTHS_GEN)} | NAME_WORDS
    names = [util.fold(w) for w in CAPITALIZED.findall(h2s[-1])]
    # Λέων/Λέοντος, Σίμων/Σίμωνος: compare with ω folded to ο.
    names = [n.replace("ω", "ο") for n in names if n not in calendar and len(n) > 2]
    tokens = {t.replace("ω", "ο") for t in util.words(" ".join(saints))}
    if not names or not any(any(t.startswith(n[: max(3, len(n) - 2)]) for t in tokens) for n in names):
        return [f"η ενότητα «{h2s[-1]}» δεν αφορά άγιο του ορθόδοξου συναξαριού της ημέρας"]
    return []


def zodia_signs(html: str) -> list[str]:
    folded = util.fold(util.html_text(html))
    missing = [sign for sign in ZODIA_ORDER if util.fold(sign) not in folded]
    if missing:
        return ["λείπουν ζώδια: " + ", ".join(missing)]
    return []


# The daily template repeats these on purpose. They are not copied predictions.
ZODIA_FIXED_MARKERS = (
    "αποποιηση ευθυνησ",
    "δεν αποτελει επιστημη",
    "ψυχαγωγικο και ενημερωτικο",
    "τι πρεπει να θυμασαι",
    "συχνεσ ερωτησεισ",
    "το τελικο συμπερασμα",
    "η επομενη κινηση σου",
    "τι κανεισ τωρα",
)


def _zodia_prediction_text(html: str) -> str:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    doomed = []
    for tag in soup.find_all(["p", "em", "li", "h2", "h3"]):
        folded = util.fold(tag.get_text(" ", strip=True))
        if any(marker in folded for marker in ZODIA_FIXED_MARKERS):
            doomed.append(tag)
    for tag in doomed:
        if tag.parent is not None:
            tag.decompose()
    return util.html_text(str(soup))


def repetition(html: str, previous: list[str]) -> list[str]:
    shared = util.shared_phrases(util.html_text(html), previous, 8)
    return [f"επανάληψη φράσης από προηγούμενες ημέρες: «{s}»" for s in shared]


def zodia_repetition(html: str, previous: list[str]) -> list[str]:
    """Flag a copied prediction, not the disclaimer or the standing headings.

    Twelve words is a sentence copied from an earlier day. Shorter lines of
    everyday advice recur naturally and must not block the daily post.
    """
    shared = util.shared_phrases(_zodia_prediction_text(html), previous, 12)
    return [f"επανάληψη φράσης από προηγούμενες ημέρες: «{s}»" for s in shared]
