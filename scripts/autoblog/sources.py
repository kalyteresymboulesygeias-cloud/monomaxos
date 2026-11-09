"""Topic discovery from source sites: robots.txt, rate limit, cache, RSS or list parsing.

Full article text is only held in memory (overlap checks and model context) and never written.
"""
from __future__ import annotations

import hashlib
import time
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import feedparser
import requests
from bs4 import BeautifulSoup

import config

from . import util


class SourceError(RuntimeError):
    pass


class Fetcher:
    def __init__(self, session=None, cache_minutes: int = 30):
        self.http = session or requests.Session()
        self.http.headers["User-Agent"] = config.USER_AGENT
        self.robots: dict[str, RobotFileParser] = {}
        self.last: dict[str, float] = {}
        self.cache_minutes = cache_minutes

    def _wait(self, host: str) -> None:
        delta = time.monotonic() - self.last.get(host, 0)
        if delta < 1:
            time.sleep(1 - delta)
        self.last[host] = time.monotonic()

    def allowed(self, url: str) -> bool:
        parts = urlparse(url)
        host = f"{parts.scheme}://{parts.netloc}"
        if host not in self.robots:
            parser = RobotFileParser()
            try:
                self._wait(parts.netloc)
                res = self.http.get(f"{host}/robots.txt", timeout=10)
                parser.parse(res.text.splitlines() if res.status_code == 200 else [])
            except requests.RequestException:
                parser.parse(["User-agent: *", "Disallow: /"])
            self.robots[host] = parser
        return self.robots[host].can_fetch(config.USER_AGENT, url)

    def get(self, url: str, *, cache: bool = True) -> str:
        path = config.CACHE_DIR / (hashlib.sha256(url.encode()).hexdigest() + ".html")
        if cache and path.exists() and time.time() - path.stat().st_mtime < self.cache_minutes * 60:
            return path.read_text(encoding="utf-8")
        if not self.allowed(url):
            raise SourceError(f"robots.txt disallows {url}")
        self._wait(urlparse(url).netloc)
        try:
            res = self.http.get(url, timeout=10)
        except requests.RequestException as exc:
            raise SourceError(f"{type(exc).__name__} for {url}") from None
        if res.status_code != 200:
            raise SourceError(f"HTTP {res.status_code} for {url}")
        if cache:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(res.text, encoding="utf-8")
        return res.text


def _when(value) -> datetime | None:
    if not value:
        return None
    try:
        dt = parsedate_to_datetime(value) if isinstance(value, str) and not value[:4].isdigit() else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def same_site(url: str, base: str) -> bool:
    """Only follow http(s) links on the source's own domain (no internal hosts, no redirects elsewhere)."""
    try:
        parts, root = urlparse(url), urlparse(base).netloc.lower().removeprefix("www.")
        host = (parts.hostname or "").lower()
        return parts.scheme in ("http", "https") and parts.port is None and (host == root or host.endswith("." + root))
    except ValueError:
        return False


def discover(fetcher: Fetcher, sources: list[dict], now: datetime, max_age_hours: int = config.SOURCE_MAX_AGE_HOURS) -> tuple[list[dict], list[str]]:
    """Return (items newer than max_age_hours, source errors)."""
    cutoff = now - timedelta(hours=max_age_hours)
    items, problems = [], []
    for source in sources:
        try:
            found = []
            if source.get("rss"):
                try:
                    feed = feedparser.parse(fetcher.get(source["rss"]))
                    for entry in feed.entries[:100]:
                        found.append({
                            "site": source["name"],
                            "title": entry.get("title", "").strip(),
                            "url": entry.get("link", ""),
                            "date": _when(entry.get("published") or entry.get("updated")),
                            "summary": util.html_text(entry.get("summary", ""))[:400],
                        })
                except SourceError:
                    found = []
            if not found:
                soup = BeautifulSoup(fetcher.get(source["list_url"]), "html.parser")
                for a in soup.select("article a[href], h2 a[href], h3 a[href]")[:40]:
                    title = a.get_text(" ", strip=True)
                    if len(title) > 25:
                        found.append({"site": source["name"], "title": title, "url": urljoin(source["list_url"], a["href"]), "date": None, "summary": ""})
            items += [i for i in found if i["url"] and same_site(i["url"], source["list_url"]) and (i["date"] is None or i["date"] >= cutoff)]
        except SourceError as exc:
            problems.append(str(exc))
    return items, problems


def cluster(items: list[dict], covered_titles: list[str], threshold: float = 0.45) -> list[list[dict]]:
    """Group similar headlines; clusters seen on >=2 sites first; drop topics already covered."""
    groups: list[list[dict]] = []
    for item in items:
        for group in groups:
            if util.similarity(item["title"], group[0]["title"]) >= threshold:
                group.append(item)
                break
        else:
            groups.append([item])
    fresh = [g for g in groups if not any(util.similarity(g[0]["title"], t) >= 0.6 for t in covered_titles)]
    return sorted(fresh, key=lambda g: (-len({i["site"] for i in g}), -len(g)))


def article_text(fetcher: Fetcher, url: str) -> tuple[str, datetime | None]:
    """Paragraph text (memory only) and the page's published time, if it declares one."""
    soup = BeautifulSoup(fetcher.get(url, cache=False), "html.parser")
    meta = soup.find("meta", attrs={"property": "article:published_time"}) or soup.find("meta", attrs={"itemprop": "datePublished"})
    published = _when(meta.get("content")) if meta else None
    for tag in soup(["script", "style", "nav", "header", "footer", "aside", "form"]):
        tag.decompose()
    article = soup.find("article")
    if published is None and article and (tag := article.find("time", attrs={"datetime": True})):
        published = _when(tag["datetime"])
    body = article or soup.body or soup
    return " ".join(p.get_text(" ", strip=True) for p in body.find_all("p"))[:12000], published
