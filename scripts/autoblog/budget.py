"""Daily and per-run API call caps, persisted in scripts/state/meta.json."""
from __future__ import annotations

import config

from . import util


class BudgetExceeded(RuntimeError):
    pass


class Budget:
    def __init__(self, day: str, persist: bool = True):
        self.path = config.STATE_DIR / "meta.json"
        self.day = day
        self.persist = persist
        self.run = {"gemini": 0, "unsplash": 0}
        meta = util.read_json(self.path, {}) or {}
        self.today = dict((meta.get("usage") or {}).get(day, {}))

    def take(self, api: str) -> None:
        if self.run[api] >= config.RUN_API_LIMIT[api]:
            raise BudgetExceeded(f"όριο κλήσεων {api} ανά run ({config.RUN_API_LIMIT[api]})")
        if self.today.get(api, 0) >= config.DAILY_API_LIMIT[api]:
            raise BudgetExceeded(f"ημερήσιο όριο κλήσεων {api} ({config.DAILY_API_LIMIT[api]})")
        self.run[api] += 1
        self.today[api] = self.today.get(api, 0) + 1

    def save(self) -> None:
        if not self.persist:
            return
        meta = util.read_json(self.path, {}) or {}
        usage = {k: v for k, v in (meta.get("usage") or {}).items() if k >= self.day[:8]}
        usage[self.day] = self.today
        meta["usage"] = dict(sorted(usage.items())[-14:])
        util.write_json(self.path, meta)
