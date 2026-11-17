"""Markdown -> sanitized HTML, link policy and section helpers."""
from __future__ import annotations

from html import escape
from urllib.parse import urlparse

import markdown as md
import nh3
from bs4 import BeautifulSoup

import config

from . import util

ALLOWED_TAGS = {
    "p", "h2", "h3", "ul", "ol", "li", "strong", "em", "a", "figure", "img", "figcaption", "blockquote",
    "table", "thead", "tbody", "tr", "th", "td",
}
ALLOWED_ATTRS = {"a": {"href"}, "img": {"src", "alt", "width", "height"}}
NEWS_TYPES = {"news", "lifestyle", "gossip"}


def _clean(raw: str) -> str:
    return nh3.clean(raw, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, link_rel=None, url_schemes={"https", "http", "mailto"}).strip()


def markdown_to_html(text: str) -> str:
    raw = md.markdown(text or "", extensions=["extra"], output_format="html")
    return _clean(raw)


def article_html(text: str) -> str:
    """Editorial articles are HTML. Eortologio and zodia stay Markdown."""
    raw = (text or "").strip()
    if raw.startswith("<") or "<h2" in raw[:400].lower() or "<p" in raw[:200].lower():
        return _clean(raw)
    return markdown_to_html(raw)


CALENDAR_NOTE = (
    "Οι αναφερόμενες ημερομηνίες είναι του τρέχοντος ημερολογίου (Γρηγοριανό) που τηρείται παγκοσμίως από όλες τις χώρες, "
    "περιλαμβανομένης και της Ελλάδος. Για αλλαγή της ημερομηνίας στο παλαιό ημερολόγιο (Ιουλιανό) αφαιρέστε 13 ημέρες "
    "από την ημερομηνία που αναγράφεται στο παρόν εορτολόγιο."
)


def nameday_block(day, groups: list[list[str]], world_days: list[str]) -> str:
    """The names of the day exactly as in the data, one per line, then the UN days."""
    names = list(dict.fromkeys(n for g in groups for n in g))
    lines = "<br>".join(f"{escape(n)}{'.' if i == len(names) - 1 else ','}" for i, n in enumerate(names))
    html = (
        f"<h2>{day.day} {util.GREEK_MONTHS_GEN[day.month - 1]} {day.year}</h2>"
        "<p>Τα ονόματα που γιορτάζουν σήμερα είναι τα εξής:</p>"
        f"<p>{lines}</p>"
    )
    if world_days:
        days = [f"η {escape(d)}" for d in world_days]
        joined = days[0] if len(days) == 1 else ", ".join(days[:-1]) + " και " + days[-1]
        html += f"<p>Επίσης σήμερα είναι {joined}.</p>"
    return html + f"<p><em>{CALENDAR_NOTE}</em></p>"


def insert_after_takeaways(html: str, block: str) -> str:
    """Place the block right after the first list (the takeaways box), or before the first H2."""
    soup = BeautifulSoup(html, "html.parser")
    anchor = soup.find("ul")
    fragment = BeautifulSoup(block, "html.parser")
    if anchor is not None:
        anchor.insert_after(fragment)
    elif soup.find("h2") is not None:
        soup.find("h2").insert_before(fragment)
    else:
        soup.append(fragment)
    return str(soup)


def _internal_slug(href: str) -> str | None:
    parsed = urlparse(href)
    host = parsed.netloc.lower()
    if host and host not in ("monomaxos.gr", "www.monomaxos.gr"):
        return None
    if not host and not href.startswith("/"):
        return None
    parts = [p for p in parsed.path.split("/") if p]
    return parts[0] if len(parts) == 1 else ""


def fix_links(html: str, *, kind: str, known_slugs: set[str], self_slug: str | None) -> tuple[str, dict]:
    soup = BeautifulSoup(html, "html.parser")
    stats = {"internal": 0, "official": 0, "removed_internal": 0, "removed_external": 0}
    for a in soup.find_all("a"):
        href = (a.get("href") or "").strip()
        slug = _internal_slug(href)
        if slug is not None:
            if slug and slug in known_slugs and slug != self_slug:
                a["href"] = f"{config.SITE}/{slug}/"
                stats["internal"] += 1
                continue
            stats["removed_internal"] += 1
            a.unwrap()
            continue
        host = urlparse(href).netloc.lower().removeprefix("www.")
        official = kind not in ("zodia", "eortologio") and any(host == d or host.endswith("." + d) for d in config.OFFICIAL_DOMAINS)
        if official and href.startswith("https://"):
            stats["official"] += 1
            continue
        stats["removed_external"] += 1
        a.unwrap()
    return str(soup), stats


def ensure_internal_link(html: str, slug: str, title: str) -> str:
    """Add one on-site link when the draft has none, just before the disclaimer."""
    soup = BeautifulSoup(html, "html.parser")
    paragraph = soup.new_tag("p")
    paragraph.append("Δες επίσης: ")
    anchor = soup.new_tag("a", href=f"{config.SITE}/{slug}/")
    anchor.string = title
    paragraph.append(anchor)
    paragraph.append(".")
    disclaimer = None
    for node in soup.find_all(["p", "em"]):
        if "αποποι" in util.fold(node.get_text(" ", strip=True)):
            disclaimer = node if node.name == "p" else (node.find_parent("p") or node)
            break
    if disclaimer is not None:
        disclaimer.insert_before(paragraph)
    else:
        soup.append(paragraph)
    body = soup.body
    return body.decode_contents() if body is not None else str(soup)


def word_count(html: str) -> int:
    return len(util.WORD_RE.findall(util.html_text(html)))


def paragraphs(html: str, n: int = 2) -> list[str]:
    return [p.get_text(" ", strip=True) for p in BeautifulSoup(html, "html.parser").find_all("p")[:n]]


def h2_titles(html: str) -> list[str]:
    return [h.get_text(" ", strip=True) for h in BeautifulSoup(html, "html.parser").find_all("h2")]


def section(html: str, heading: str) -> BeautifulSoup | None:
    """Elements between the H2 whose folded text contains `heading` and the next H2."""
    soup = BeautifulSoup(html, "html.parser")
    for h in soup.find_all("h2"):
        if util.fold(heading) in util.fold(h.get_text(" ", strip=True)):
            parts = []
            for sib in h.find_next_siblings():
                if sib.name == "h2":
                    break
                parts.append(str(sib))
            return BeautifulSoup("".join(parts), "html.parser")
    return None
