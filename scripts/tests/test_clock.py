"""The publish clock: early runs wait or exit, late runs publish once."""
from __future__ import annotations

import sys
import unittest
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from autoblog import clock  # noqa: E402

LIMITS_PHASE_1 = {"eortologio": 1, "zodia": 1, "health": 1, "nutrition": 0, "news": 0, "lifestyle": 1, "gossip": 0}


def at(text: str) -> datetime:
    return datetime.fromisoformat(text).replace(tzinfo=clock.ATHENS)


class Clock(unittest.TestCase):
    def test_crons_are_unique_and_cover_both_seasons(self):
        rows = clock.cron_expressions()
        exprs = [expr for expr, _slot in rows]
        self.assertEqual(len(exprs), len(set(exprs)))
        morning = {expr for expr, slot in rows if slot == "morning"}
        self.assertIn("0 4 * * *", morning)  # 06:00 Athens in winter
        self.assertIn("7 3 * * *", morning)  # 06:07 Athens in summer
        self.assertIn("7 4 * * *", morning)  # 06:07 Athens in winter
        self.assertIn("7 20 * * *", morning)  # 8 hours before the winter slot

    def test_workflow_lists_the_same_crons(self):
        text = (ROOT / ".github" / "workflows" / "auto-blog.yml").read_text(encoding="utf-8")
        listed = []
        for line in text.splitlines():
            stripped = line.strip()
            if stripped.startswith('- cron: "'):
                listed.append(stripped.removeprefix('- cron: "').removesuffix('"'))
        self.assertEqual(sorted(listed), sorted(expr for expr, _slot in clock.cron_expressions()))

    def test_waits_when_the_slot_is_close(self):
        proceed, sleep, reason = clock.decide(at("2026-11-17T05:20:00"), "morning", False)
        self.assertTrue(proceed, reason)
        self.assertEqual(sleep, 40 * 60)

    def test_exits_when_far_too_early(self):
        proceed, sleep, _reason = clock.decide(at("2026-11-17T02:00:00"), "morning", False)
        self.assertFalse(proceed)
        self.assertEqual(sleep, 0)

    def test_publishes_immediately_once_the_slot_has_started(self):
        proceed, sleep, _reason = clock.decide(at("2026-11-17T06:34:00"), "morning", False)
        self.assertTrue(proceed)
        self.assertEqual(sleep, 0)

    def test_does_not_repeat_a_finished_slot(self):
        proceed, _sleep, reason = clock.decide(at("2026-11-17T06:05:00"), "morning", True)
        self.assertFalse(proceed)
        self.assertIn("ήδη", reason)

    def test_phase_1_midday_is_done_after_health_only(self):
        records = [{"date": "2026-11-17", "type": "health", "status": "PASS"}]
        self.assertTrue(clock.satisfied(records, at("2026-11-17T09:00:00").date(), "midday", LIMITS_PHASE_1))

    def test_a_failed_attempt_counts_so_the_ladder_does_not_retry_all_day(self):
        records = [
            {"date": "2026-11-17", "type": "eortologio", "status": "PASS"},
            {"date": "2026-11-17", "type": "zodia", "status": "FAIL"},
        ]
        self.assertTrue(clock.satisfied(records, at("2026-11-17T14:00:00").date(), "morning", LIMITS_PHASE_1))

    def test_phase_2_health_needs_two_records(self):
        limits = {**LIMITS_PHASE_1, "health": 2, "nutrition": 1}
        one = [{"date": "2026-11-17", "type": "health", "status": "PASS"}]
        self.assertFalse(clock.satisfied(one, at("2026-11-17T09:00:00").date(), "midday", limits))
        two = one + [
            {"date": "2026-11-17", "type": "health", "status": "PASS"},
            {"date": "2026-11-17", "type": "nutrition", "status": "SKIP"},
        ]
        self.assertTrue(clock.satisfied(two, at("2026-11-17T09:00:00").date(), "midday", limits))


if __name__ == "__main__":
    unittest.main()
