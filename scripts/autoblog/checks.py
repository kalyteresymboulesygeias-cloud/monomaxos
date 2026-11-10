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
    if len(render.h2_titles(html)) < 3:
        fails.append("λιγότερα από 3 H2")
    if "<h1" in html.lower() or re.search(r"^# ", article.body_markdown, re.M):
        fails.append("υπάρχει H1")
    if not 25 <= len(article.title) <= 60:
        fails.append(f"τίτλος {len(article.title)} χαρακτήρες, ζητούνται 25-60")
    if not 140 <= len(article.meta_description) <= 160:
        fails.append(f"meta {len(article.meta_description)} χαρακτήρες, ζητούνται 140-160")
    key = util.fold(article.focus_keyword).strip()
    if not key or key not in util.fold(article.title):
        fails.append("το focus keyword λείπει από τον τίτλο")
    first = " ".join(util.html_text(html).split()[:110])
    if key and key not in util.fold(first):
        fails.append("το focus keyword λείπει από τις πρώτες 100 λέξεις")
    everything = " ".join([article.title, article.meta_description, article.excerpt, util.html_text(html)])
    dashes = everything.count("\u2014")
    if kind in ("health", "nutrition", "news", "lifestyle", "gossip"):
        if dashes > 2:
            fails.append(f"em dash (—) {dashes} φορές, μέγιστο 2")
    elif dashes:
        fails.append("υπάρχει em dash (—)")
    if PLACEHOLDERS.search(everything):
        fails.append("υπάρχει placeholder ([, ], TODO, lorem, XX)")
    for phrase in CLICHES:
        if phrase in util.fold(everything):
            fails.append(f"κλισέ φράση: {phrase}")
    if slug in ctx.slugs and slug != self_slug:
        fails.append(f"το slug {slug} υπάρχει ήδη")
    clash = None if self_slug else ctx.similar_title(article.title, config.SIMILARITY_REJECT)
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


def blocked_claims(html: str, blocked: dict, official_sources: bool) -> list[str]:
    fails = []
    roots = [util.fold(r) for r in blocked["roots"]]
    markers = [util.fold(m) for m in blocked["official_markers"]]
    for sentence in SENTENCE_SPLIT.split(util.html_text(html)):
        folded = util.fold(sentence)
        hit = next((r for r in roots if r in folded), None)
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


def editorial_structure(article, html: str) -> list[str]:
    """The house template for every article except eortologio and zodia."""
    from bs4 import BeautifulSoup

    fails: list[str] = []
    soup = BeautifulSoup(html, "html.parser")
    text = util.html_text(html)
    folded = util.fold(text)
    padded = f" {folded} "
    start = util.fold(" ".join(text.split()[:8]))
    if any(start.startswith(util.fold(opener)) for opener in OPENERS):
        fails.append("απαγορευμένη εκκίνηση εισαγωγής")
    bullets = soup.find("ul")
    if bullets is None or len(bullets.find_all("li")) < 4 or bullets.find("strong") is None:
        fails.append("λείπει το πλαίσιο «Τι Πρέπει να Θυμάσαι» με 4-5 έντονα bullets")
    if soup.find("ol") is None:
        fails.append("λείπει αριθμημένη λίστα ή πρακτικό πλάνο")
    h2s = render.h2_titles(html)
    if not 5 <= len(h2s) <= 8:
        fails.append(f"{len(h2s)} ενότητες H2, ζητούνται 4-6 στο σώμα συν το κλείσιμο")
    titles = [util.fold(h) for h in h2s]
    endings = [util.fold(title) for title in CONCLUSION_TITLES]
    if not any(title == wanted or title.startswith(wanted) for title in titles for wanted in endings):
        fails.append("το κλείσιμο πρέπει να είναι «Το Τελικό Συμπέρασμα», «Η Επόμενη Κίνησή σου» ή «Τι Κάνεις Τώρα»")
    if "συμπερασμα" in titles:
        fails.append("μην τιτλοφορείς το κλείσιμο σκέτο «Συμπέρασμα»")
    if len(soup.find_all("h3")) < 5:
        fails.append("οι συχνές ερωτήσεις χρειάζονται 5 ερωτήσεις σε H3")
    if util.fold("αποποίηση ευθύνης") not in folded or util.fold("δεν αποτελεί ιατρική συμβουλή") not in folded:
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
    for phrase in EDITORIAL_CLICHES:
        if f" {util.fold(phrase)} " in padded:
            fails.append(f"κλισέ λέξη: {phrase}")
            break
    return fails


def source_overlap(html: str, source_texts: list[str]) -> list[str]:
    shared = util.shared_phrases(util.html_text(html), source_texts, 8)
    return [f"κοινή ακολουθία 8+ λέξεων με πηγή: «{s}»" for s in shared]


def eortologio_names(html: str, allowed: set[str]) -> list[str]:
    part = render.section(html, "Ποιοι γιορτάζουν")
    if part is None:
        return ["λείπει η ενότητα «Ποιοι γιορτάζουν σήμερα»"]
    ok = {util.fold(n) for n in allowed}
    fails = []
    for li in part.find_all("li") or part.find_all("p"):
        for name in CAPITALIZED.findall(li.get_text(" ", strip=True)):
            if util.fold(name) not in ok and util.fold(name) not in {"και", "σημερα", "οι", "η", "ο"}:
                fails.append(f"άγνωστο όνομα στο εορτολόγιο: {name}")
    return fails


def zodia_structure(html: str) -> list[str]:
    titles = [util.fold(t) for t in render.h2_titles(html)]
    expected = [util.fold(z) for z in ZODIA_ORDER] + [util.fold("Πώς να τα διαβάσετε"), util.fold("Σύντομες ερωτήσεις")]
    found = [t for t in titles if any(e in t for e in expected)]
    if len(found) != 14 or any(e not in f for e, f in zip(expected, found)):
        return ["τα ζώδια χρειάζονται 12 H2 με σειρά Κριός έως Ιχθύες, μετά «Πώς να τα διαβάσετε» και «Σύντομες ερωτήσεις»"]
    intro = util.fold(" ".join(render.paragraphs(html, 2)))
    if "ψυχαγωγ" not in intro:
        return ["η εισαγωγή πρέπει να δηλώνει ότι τα ζώδια είναι ψυχαγωγικό περιεχόμενο"]
    return []


def repetition(html: str, previous: list[str]) -> list[str]:
    shared = util.shared_phrases(util.html_text(html), previous, 8)
    return [f"επανάληψη φράσης από προηγούμενες ημέρες: «{s}»" for s in shared]
