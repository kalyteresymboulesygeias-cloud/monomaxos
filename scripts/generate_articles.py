#!/usr/bin/env python3
"""Autonomous article generator for monomaxos.gr. Writes only through scripts/publish-post.mjs."""
from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import config  # noqa: E402
from autoblog import util  # noqa: E402
from autoblog.pipeline import Runner  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--type", required=True, choices=config.TYPES)
    parser.add_argument("--count", type=int, default=1)
    parser.add_argument("--date", type=date.fromisoformat, default=None, help="YYYY-MM-DD (default: today in Europe/Athens)")
    parser.add_argument("--dry-run", action="store_true", help="generate and validate, write nothing")
    parser.add_argument("--no-commit", action="store_true", help="publish to content/ but do not git commit")
    args = parser.parse_args(argv)
    if config.env("AUTO_BLOG_ENABLED") != "true" and not args.dry_run:
        print("AUTO_BLOG_ENABLED is not 'true': nothing to do.")
        return 0
    day = args.date or util.now_athens().date()
    runner = Runner(day, dry_run=args.dry_run, commit=not args.no_commit)
    return runner.run(args.type, max(0, args.count))


if __name__ == "__main__":
    sys.exit(main())
