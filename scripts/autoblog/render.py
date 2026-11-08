"""Markdown -> sanitized HTML, link policy and section helpers."""
from __future__ import annotations

from urllib.parse import urlparse

import markdown as md
import nh3
from bs4 import BeautifulSoup

import config

from . import util

ALLOWED_TAGS = {"p", "h2", "h3", "ul", "ol", "li", "strong", "em", "a", "figure", "img", "figcaption", "blockquote"}
ALLOWED_ATTRS = {"a": {"href"}, "img": {"src", "alt", "width", "height"}}
NEWS_TYPES = {"news", "lifestyle", "gossip"}


def markdown_to_html(text: str) -> str:
    raw = md.markdown(text or "", extensions=["extra"], output_format="html")
    return nh3.clean(raw, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, link_rel=None, url_schemes={"https", "http", "mailto"}).strip()


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
    stats = {"internal": 0, "removed_internal": 0, "removed_external": 0}
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
        host = urlparse(href).netloc.lower()
        official = kind in ("health", "nutrition") and any(host == d or host.endswith("." + d) for d in config.OFFICIAL_DOMAINS)
        if official and href.startswith("https://"):
            continue
        stats["removed_external"] += 1
        a.unwrap()
    return str(soup), stats


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
