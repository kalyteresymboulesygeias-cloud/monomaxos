"""Read-only view of content/ for duplicate checks, idempotency and internal links."""
from __future__ import annotations

from datetime import date, timedelta
from functools import cached_property
from pathlib import Path

from . import util


class ContentIndex:
    def __init__(self, content_dir: Path):
        self.dir = Path(content_dir)
        self.index: list[dict] = util.read_json(self.dir / "posts-index.json", [])
        self.slugs = {item["slug"] for item in self.index}
        self.slugs |= {page["slug"] for page in util.read_json(self.dir / "pages.json", [])}
        self.categories: list[dict] = util.read_json(self.dir / "categories.json", [])

    @cached_property
    def posts(self) -> dict[str, dict]:
        out: dict[str, dict] = {}
        for shard in sorted((self.dir / "posts").glob("posts-*.json")):
            for post in util.read_json(shard, []):
                out[post["slug"]] = post
        return out

    @cached_property
    def metas(self) -> set[str]:
        return {" ".join(util.words(p.get("meta_description") or "")) for p in self.posts.values()}

    def family(self, category_id: int) -> set[int]:
        parent = next((c.get("parent", 0) for c in self.categories if c["id"] == category_id), 0)
        ids = {category_id}
        if parent:
            ids.add(parent)
        ids |= {c["id"] for c in self.categories if c.get("parent") == category_id}
        return ids

    def recent(self, category_ids: set[int] | None, days: int, ref: date) -> list[dict]:
        start = (ref - timedelta(days=days)).isoformat()
        return [
            item
            for item in self.index
            if item["date"][:10] >= start and (category_ids is None or set(item["categories"]) & category_ids)
        ]

    def on_date(self, category_id: int, day: date) -> list[dict]:
        key = day.isoformat()
        return [item for item in self.index if item["date"][:10] == key and category_id in item["categories"]]

    def similar_title(self, title: str, threshold: float) -> str | None:
        for item in self.index:
            if util.similarity(title, item["title"]) > threshold:
                return item["title"]
        return None

    def body_text(self, slug: str) -> str:
        post = self.posts.get(slug)
        return util.html_text(post["content"]["rendered"]) if post else ""
