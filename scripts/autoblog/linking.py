"""Internal link candidates by category family and title/meta word overlap (no tags)."""
from __future__ import annotations

from . import util

STOP = {"και", "για", "τον", "την", "της", "του", "των", "τα", "το", "τι", "πως", "με", "σε", "στο", "στη", "στην", "στις", "στους", "απο", "οι", "η", "ο", "να", "που", "ειναι", "μια", "ενα"}


def _terms(text: str) -> set[str]:
    return {w for w in util.words(text) if len(w) > 3 and w not in STOP}


def candidates(ctx, category_id: int, text: str, k: int = 8, exclude: str | None = None) -> list[dict]:
    family = ctx.family(category_id)
    want = _terms(text)
    scored = []
    for item in ctx.index[:1500]:
        if item["slug"] == exclude:
            continue
        post = ctx.posts.get(item["slug"]) or {}
        overlap = len(want & _terms(item["title"] + " " + (post.get("meta_description") or "")))
        same = 2 if set(item["categories"]) & family else 0
        if overlap or same:
            scored.append((overlap * 3 + same, item["date"], item))
    scored.sort(key=lambda row: (row[0], row[1]), reverse=True)
    return [{"slug": item["slug"], "title": item["title"]} for _, _, item in scored[:k]]
