"""Settings for scripts/generate_articles.py. Secrets come only from the environment."""
from __future__ import annotations

import os
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parent
CONTENT_DIR = Path(os.environ.get("AUTO_BLOG_CONTENT_DIR", ROOT / "content"))
DATA_DIR = SCRIPTS / "data"
STATE_DIR = Path(os.environ.get("AUTO_BLOG_STATE_DIR", SCRIPTS / "state"))
CACHE_DIR = STATE_DIR / "cache"
PUBLISHER = SCRIPTS / "publish-post.mjs"
SITE = "https://monomaxos.gr"

TYPES = ("eortologio", "zodia", "health", "nutrition", "news", "lifestyle", "gossip")

LIFESTYLE_CATEGORY_ID = 408
# Closed list the model chooses from for health articles.
HEALTH_SUBCATEGORIES = {
    "ygeia-diatrofi": 19,
    "eyexia-psychiki-isorropia": 405,
    "omorfia-ygeia": 20,
    "psixiki-ygeia": 21,
}
CATEGORY_BY_TYPE = {
    "eortologio": 406,
    "zodia": 407,
    "health": None,  # from HEALTH_SUBCATEGORIES
    "nutrition": 19,
    "news": 23,
    "lifestyle": LIFESTYLE_CATEGORY_ID,
    "gossip": LIFESTYLE_CATEGORY_ID,
}
DISCLAIMER_BY_TYPE = {
    "health": "medical",
    "nutrition": "medical",
    "zodia": "entertainment",
    "eortologio": "none",
    "news": "none",
    "lifestyle": "none",
    "gossip": "none",
}
WORD_RANGE = {
    "eortologio": (400, 700),
    "zodia": (800, 1200),
    "health": (800, 1200),
    "nutrition": (800, 1200),
    "news": (800, 1200),
    "lifestyle": (800, 1200),
    "gossip": (800, 1200),
}
# Athens wall-clock publish time; extra articles of the same type go +2h each.
PUBLISH_TIME = {
    "eortologio": "06:00",
    "zodia": "06:05",
    "health": "09:00",
    "nutrition": "09:30",
    "news": "12:00",
    "lifestyle": "13:00",
    "gossip": "13:30",
}
# Per-type daily maxima. Phase 1: first two weeks (4/day overall). Phase 2: 6-7/day.
DAILY_LIMIT = {
    "1": {"eortologio": 1, "zodia": 1, "health": 1, "nutrition": 0, "news": 0, "lifestyle": 1, "gossip": 0},
    "2": {"eortologio": 1, "zodia": 1, "health": 2, "nutrition": 1, "news": 1, "lifestyle": 1, "gossip": 1},
}
DAILY_API_LIMIT = {"gemini": 60, "unsplash": 40}
RUN_API_LIMIT = {"gemini": 25, "unsplash": 20}
VALIDATION_RETRIES = 2
CIRCUIT_BREAKER = 2  # stop after more than this many consecutive failures
TOPIC_WINDOW_DAYS = 60
NEWS_TOPIC_WINDOW_DAYS = 30
SIMILARITY_REJECT = 0.85
SOURCE_MAX_AGE_HOURS = 48
GEMINI_TIMEOUT_MS = 120_000
OFFICIAL_DOMAINS = (
    "eody.gov.gr",
    "who.int",
    "moh.gov.gr",
    "efet.gr",
    "eof.gr",
    "ecdc.europa.eu",
    "efsa.europa.eu",
)
USER_AGENT = "MonomaxosBot/1.0 (+https://monomaxos.gr/epikoinonia/; sv8pkj@gmail.com)"
HEALTH_PR_DAYS = 7


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def phase() -> str:
    value = env("AUTO_BLOG_PHASE", "1")
    return value if value in DAILY_LIMIT else "1"
