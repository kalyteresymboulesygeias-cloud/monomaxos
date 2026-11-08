"""Fixed and Easter-relative namedays for a date (Orthodox Easter via dateutil)."""
from __future__ import annotations

from datetime import date, timedelta

from dateutil.easter import EASTER_ORTHODOX, easter

import config

from . import util


def for_day(day: date) -> dict:
    fixed = util.read_json(config.DATA_DIR / "namedays.json", {})["days"]
    movable = util.read_json(config.DATA_DIR / "movable_feasts.json", {})
    pascha = easter(day.year, EASTER_ORTHODOX)
    groups = [list(g) for g in fixed.get(day.strftime("%m-%d"), {}).get("groups", [])]
    feasts = []
    for rule in movable.get("relative", []):
        if pascha + timedelta(days=rule["offset"]) == day:
            feasts.append(rule["title"])
            if rule.get("names") and not rule.get("all_saints"):
                groups.append(rule["names"])
    for rule in movable.get("conditional", []):
        month, dom = map(int, rule["date"].split("-"))
        nominal = date(day.year, month, dom)
        actual = pascha + timedelta(days=rule["if_before_easter_offset"]) if nominal <= pascha else nominal
        if actual == day:
            feasts.append(rule["title"])
            groups.append(rule["names"])
    names = sorted({n for g in groups for n in g})
    return {"date": day.isoformat(), "easter": pascha.isoformat(), "feasts": feasts, "groups": groups, "names": names}
