from __future__ import annotations

import difflib
import json
import re
import subprocess
import unicodedata
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup

import config

ATHENS = ZoneInfo("Europe/Athens")
WORD_RE = re.compile(r"[0-9A-Za-z\u0370-\u03ff\u1f00-\u1fff]+")


def now_athens() -> datetime:
    return datetime.now(ATHENS)


def stamp(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def read_json(path: Path, default=None):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


def write_json(path: Path, value) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def fold(text: str) -> str:
    text = unicodedata.normalize("NFD", text or "")
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return text.lower().replace("ς", "σ")


def words(text: str) -> list[str]:
    return WORD_RE.findall(fold(text))


def similarity(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, " ".join(words(a)), " ".join(words(b))).ratio()


def ngrams(tokens: list[str], n: int = 8) -> set[tuple[str, ...]]:
    return {tuple(tokens[i : i + n]) for i in range(len(tokens) - n + 1)}


def shared_phrases(text: str, others: list[str], n: int = 8) -> list[str]:
    mine = ngrams(words(text), n)
    found: set[tuple[str, ...]] = set()
    for other in others:
        found |= mine & ngrams(words(other), n)
    return [" ".join(gram) for gram in sorted(found)][:5]


def html_text(html: str) -> str:
    return BeautifulSoup(html or "", "html.parser").get_text(" ", strip=True)


def node_slugify(text: str) -> str:
    out = subprocess.run(
        ["node", str(config.PUBLISHER), "--slugify", text], check=True, capture_output=True, text=True
    )
    return out.stdout.strip()


GREEK_DAYS = ["Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο", "Κυριακή"]
GREEK_MONTHS_GEN = [
    "Ιανουαρίου", "Φεβρουαρίου", "Μαρτίου", "Απριλίου", "Μαΐου", "Ιουνίου",
    "Ιουλίου", "Αυγούστου", "Σεπτεμβρίου", "Οκτωβρίου", "Νοεμβρίου", "Δεκεμβρίου",
]


def greek_date(day) -> str:
    return f"{GREEK_DAYS[day.weekday()]} {day.day} {GREEK_MONTHS_GEN[day.month - 1]} {day.year}"
