"""Unsplash search with hotlinking, download tracking and R2 fallbacks."""
from __future__ import annotations

import requests

import config

from . import util
from .budget import Budget, BudgetExceeded

API = "https://api.unsplash.com"
UTM = "utm_source=monomaxos&utm_medium=referral"


def _fallback(category_id: int, used: list[str]) -> dict:
    pool = (util.read_json(config.DATA_DIR / "fallback_images.json", {}) or {}).get("by_category", {}).get(str(category_id), [])
    choice = next((url for url in pool if url not in used), pool[0] if pool else None)
    return {"url": choice} if choice else {}


def pick_image(queries: list[str], alt: str, category_id: int, budget: Budget, *, dry_run: bool, session=None) -> tuple[dict, str | None, dict]:
    """Return (featured_image, unsplash_id or None, log info)."""
    key = config.env("UNSPLASH_ACCESS_KEY")
    used = (util.read_json(config.STATE_DIR / "used_images.json", {}) or {}).get("ids", [])
    http = session or requests.Session()
    info: dict = {"queries": queries[:3]}
    if key:
        headers = {"Authorization": f"Client-ID {key}", "Accept-Version": "v1"}
        for query in queries[:3]:
            try:
                budget.take("unsplash")
            except BudgetExceeded as exc:
                info["unsplash"] = str(exc)
                break
            try:
                res = http.get(
                    f"{API}/search/photos",
                    params={"query": query, "orientation": "landscape", "content_filter": "high", "per_page": 5},
                    headers=headers,
                    timeout=10,
                )
            except requests.RequestException as exc:
                info["unsplash"] = type(exc).__name__
                break
            if res.status_code in (403, 429):
                info["unsplash"] = f"HTTP {res.status_code}"
                break
            if res.status_code != 200:
                info["unsplash"] = f"HTTP {res.status_code}"
                continue
            for photo in res.json().get("results", []):
                if photo["id"] in used:
                    continue
                if not dry_run:
                    try:
                        budget.take("unsplash")
                        http.get(photo["links"]["download_location"], headers=headers, timeout=10)
                    except (BudgetExceeded, requests.RequestException):
                        pass
                width = 1080
                height = round(width * photo["height"] / photo["width"]) if photo.get("width") else None
                user = photo["user"]
                image = {
                    "url": photo["urls"]["regular"],
                    "alt": alt,
                    "width": width,
                    **({"height": height} if height else {}),
                    "credit": {"name": user["name"], "url": f"{user['links']['html']}?{UTM}"},
                }
                info["unsplash_id"] = photo["id"]
                return image, photo["id"], info
    else:
        info["unsplash"] = "no key"
    fb = _fallback(category_id, used)
    info["fallback"] = True
    return ({**fb, "alt": alt} if fb else {}), None, info


def remember(photo_id: str | None, fallback_url: str | None = None) -> None:
    path = config.STATE_DIR / "used_images.json"
    data = util.read_json(path, {}) or {}
    ids = data.setdefault("ids", [])
    for value in (photo_id, fallback_url):
        if value and value not in ids:
            ids.append(value)
    util.write_json(path, data)
