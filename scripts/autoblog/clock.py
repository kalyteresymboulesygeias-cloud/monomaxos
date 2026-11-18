"""When the daily articles are allowed to publish.

GitHub Actions starts a `schedule` event hours after the clock time we ask for.
The workflow therefore registers several daily crons for each slot: the real
Athens hour, and the same hour 6–10 hours earlier. A run that starts too early
does nothing. The first run that starts shortly before the slot waits, then
publishes. An early cron only publishes in the 90 minutes after the slot, so
one that starts on time in the evening does not publish the morning articles.
The original three crons stay as the catch-up if the earlier ones never land.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

ATHENS = ZoneInfo("Europe/Athens")

# How early a run may be and still wait for the slot. The job timeout is 90
# minutes and generation needs the rest, so this stays under 40 minutes.
EARLY_WINDOW = timedelta(minutes=40)
# How late an early cron may be and still publish. Wider than that is the
# evening, and those runs must not publish today's slot.
LATE_WINDOW = timedelta(minutes=90)

# Offsets that match the delays seen on this repo (about 6–10 hours).
DELAY_OFFSETS_H = (6, 7, 8, 9, 10)

SLOTS = {
    # Zodia and lifestyle go out at 07:00. Eortologio rides the same run.
    "morning": {"hour": 7, "minute": 0, "types": ("eortologio", "zodia", "lifestyle"), "cron_minute": 7},
    "midday": {"hour": 9, "minute": 0, "types": ("health", "nutrition"), "cron_minute": 17},
    "afternoon": {"hour": 13, "minute": 0, "types": ("news", "gossip"), "cron_minute": 27},
}

# The original three crons. They are late, and they stay as the catch-up if the
# earlier ones are dropped. 05:00 UTC is 07:00 in Athens in winter.
LEGACY_CRONS = (
    ("0 5 * * *", "morning"),
    ("0 7 * * *", "midday"),
    ("0 11 * * *", "afternoon"),
)


def _utc_hours(slot_hour: int) -> list[int]:
    hours: set[int] = set()
    for utc_offset in (2, 3):  # Athens standard time, Athens summer time
        target = (slot_hour - utc_offset) % 24
        hours.add(target)
        for offset in DELAY_OFFSETS_H:
            hours.add((target - offset) % 24)
    return sorted(hours)


def cron_expressions() -> list[tuple[str, str]]:
    rows = list(LEGACY_CRONS)
    for name, slot in SLOTS.items():
        minute = slot["cron_minute"]
        for hour in _utc_hours(slot["hour"]):
            rows.append((f"{minute} {hour} * * *", name))
    return rows


SLOT_BY_CRON = {expr: name for expr, name in cron_expressions()}
CATCH_UP_CRONS = {expr for expr, _name in LEGACY_CRONS}


def slot_target(now: datetime, slot: str) -> datetime:
    spec = SLOTS[slot]
    return now.replace(hour=spec["hour"], minute=spec["minute"], second=0, microsecond=0)


def satisfied(records: list[dict], day, slot: str, limits: dict[str, int]) -> bool:
    """True when every type this phase actually publishes already has a record today."""
    for kind in SLOTS[slot]["types"]:
        limit = limits.get(kind, 0)
        if limit <= 0:
            continue
        seen = sum(
            1
            for row in records
            if row.get("date") == day.isoformat()
            and row.get("type") == kind
            and row.get("status") in {"PASS", "SKIP", "FAIL"}
        )
        if seen < limit:
            return False
    return True


def decide(now: datetime, slot: str, done: bool, *, catch_up: bool = False) -> tuple[bool, int, str]:
    """Return (publish, seconds to wait, reason). `now` is Athens local time.

    `catch_up` is only for the original three crons. The earlier ones publish
    inside a window around the slot, so an on-time evening start does nothing.
    """
    if now.tzinfo is None:
        now = now.replace(tzinfo=ATHENS)
    if done:
        return False, 0, f"{slot}: ήδη έγινε σήμερα"
    target = slot_target(now, slot)
    early = target - now
    if early > EARLY_WINDOW:
        minutes = int(early.total_seconds() // 60)
        return False, 0, f"{slot}: νωρίς κατά {minutes} λεπτά"
    if early.total_seconds() > 0:
        return True, int(early.total_seconds()), f"{slot}: αναμονή ως {target.strftime('%H:%M')}"
    late = now - target
    if catch_up or late <= LATE_WINDOW:
        return True, 0, f"{slot}: ώρα δημοσίευσης"
    minutes = int(late.total_seconds() // 60)
    return False, 0, f"{slot}: {minutes} λεπτά μετά το παράθυρο"
