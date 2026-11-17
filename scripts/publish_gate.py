#!/usr/bin/env python3
"""Tell the auto-blog workflow whether this run should publish, and how long to wait.

Schedule runs exit immediately when they are more than 40 minutes early, so the
extra crons that GitHub starts on time (or many hours late) do not publish.
A manual workflow_dispatch always runs the requested type.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import config  # noqa: E402
from autoblog import clock  # noqa: E402


def load_records() -> list[dict]:
    """Prefer origin/main. A queued run checks out an older commit than the one that just published."""
    fetched = subprocess.run(
        ["git", "fetch", "origin", "main"],
        cwd=config.ROOT,
        capture_output=True,
        text=True,
    )
    text = ""
    if fetched.returncode == 0:
        shown = subprocess.run(
            ["git", "show", "origin/main:scripts/state/runs.jsonl"],
            cwd=config.ROOT,
            capture_output=True,
            text=True,
        )
        if shown.returncode == 0:
            text = shown.stdout
    if not text.strip():
        path = config.STATE_DIR / "runs.jsonl"
        text = path.read_text(encoding="utf-8") if path.exists() else ""
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def emit(values: dict[str, str]) -> None:
    for key, value in values.items():
        print(f"{key}={value}")
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8") as fh:
            for key, value in values.items():
                fh.write(f"{key}={value}\n")


def main() -> int:
    event = os.environ.get("GITHUB_EVENT_NAME", "schedule")
    if event == "workflow_dispatch":
        dry = "true" if os.environ.get("REWRITE") else (os.environ.get("INPUT_DRY") or "false")
        emit({
            "proceed": "true",
            "sleep": "0",
            "types": os.environ.get("INPUT_TYPE") or "",
            "count": os.environ.get("INPUT_COUNT") or "1",
            "dry": dry,
        })
        print("manual dispatch")
        return 0

    schedule = os.environ.get("SCHEDULE", "")
    slot = clock.SLOT_BY_CRON.get(schedule)
    now = datetime.now(clock.ATHENS)
    if slot is None:
        emit({"proceed": "false", "sleep": "0", "types": "", "count": "1", "dry": "false"})
        print(f"unknown schedule: {schedule!r}")
        return 0

    phase = config.phase()
    limits = config.DAILY_LIMIT[phase]
    done = clock.satisfied(load_records(), now.date(), slot, limits)
    proceed, sleep, reason = clock.decide(now, slot, done)
    print(reason)
    emit({
        "proceed": "true" if proceed else "false",
        "sleep": str(sleep),
        "types": " ".join(clock.SLOTS[slot]["types"]) if proceed else "",
        "count": "1",
        "dry": "false",
    })
    return 0


if __name__ == "__main__":
    sys.exit(main())
