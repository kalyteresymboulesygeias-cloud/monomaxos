"""When the daily articles are allowed to publish.

GitHub Actions starts a `schedule` event hours after the clock time we ask for,
and some days it never starts the cron that sits on the slot itself. The
workflow therefore registers several daily crons for each slot: the real Athens
hour, and the same hour 6–10 hours earlier.

A run looks at every slot, not only the cron that woke it. Within three hours
before a slot it waits, then publishes at that hour. After the hour has passed,
any run later the same day publishes whatever is still missing. A run in the
middle of the night is more than three hours early, so it does nothing and
does not publish the next morning's articles ahead of time.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

ATHENS = ZoneInfo("Europe/Athens")

# How early a run may be and still wait for the slot. The job timeout is 6
# hours; generation, tests and the install need the rest, so the wait stays
# inside three hours. On 19 Nov 2026 the closest run started 53 minutes early
# and the old 40-minute window told it to exit, so the morning articles never
# went out.
EARLY_WINDOW = timedelta(hours=3)

# Offsets that match the delays seen on this repo (about 6–10 hours).
DELAY_OFFSETS_H = (6, 7, 8, 9, 10)

SLOTS = {
    # Zodia and lifestyle go out at 07:00. Eortologio rides the same run.
    "morning": {"hour": 7, "minute": 0, "types": ("eortologio", "zodia", "lifestyle"), "cron_minute": 7},
    "midday": {"hour": 9, "minute": 0, "types": ("health", "nutrition"), "cron_minute": 17},
    "afternoon": {"hour": 13, "minute": 0, "types": ("news", "gossip"), "cron_minute": 27},
}

# The original three crons. 05:00 UTC is 07:00 in Athens in winter. Any run
# after a slot's hour now catches up, so these are no longer the only net.
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
SLOT_ORDER = ("morning", "midday", "afternoon")


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


def decide(now: datetime, slot: str, done: bool) -> tuple[bool, int, str]:
    """Return (publish, seconds to wait, reason). `now` is Athens local time.

    After the slot's hour, any later run on the same day publishes. The only
    runs that exit are the ones that are still more than three hours early.
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
    return True, 0, f"{slot}: ώρα δημοσίευσης"


def plan(now: datetime, records: list[dict], limits: dict[str, int]) -> tuple[list[str], int, str]:
    """Slots to publish on this run, how long to wait first, and why.

    A missed morning slot is published by whatever run shows up afterwards,
    including the midday one. A slot that is merely close is waited for only
    when nothing earlier is already overdue, so a late morning is not held
    back until 09:00.
    """
    if now.tzinfo is None:
        now = now.replace(tzinfo=ATHENS)
    day = now.date()
    chosen: list[str] = []
    sleep = 0
    notes: list[str] = []
    for name in SLOT_ORDER:
        proceed, slot_sleep, reason = decide(now, name, satisfied(records, day, name, limits))
        if not proceed:
            notes.append(reason)
            continue
        if slot_sleep > 0:
            if chosen:
                notes.append(f"{name}: μένει για την επόμενη εκτέλεση")
                break
            sleep = slot_sleep
            chosen.append(name)
            notes.append(reason)
            break
        chosen.append(name)
        notes.append(reason)
    return chosen, sleep, "; ".join(notes)
