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
from autoblog.content import ContentIndex  # noqa: E402
from autoblog.pipeline import Runner  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--type", choices=config.TYPES)
    parser.add_argument("--rewrite", metavar="SLUG", help="write a fresh text for an existing post (same slug, date, category). Without --dry-run, publish it with --update")
    parser.add_argument("--count", type=int, default=1)
    parser.add_argument("--date", type=date.fromisoformat, default=None, help="YYYY-MM-DD (default: today in Europe/Athens)")
    parser.add_argument("--dry-run", action="store_true", help="generate and validate, write nothing")
    parser.add_argument("--no-commit", action="store_true", help="publish to content/ but do not git commit")
    args = parser.parse_args(argv)
    if args.rewrite:
        return rewrite(args.rewrite, dry_run=args.dry_run, commit=not args.dry_run and not args.no_commit)
    if not args.type:
        parser.error("--type is required")
    if config.env("AUTO_BLOG_ENABLED") != "true" and not args.dry_run:
        print("AUTO_BLOG_ENABLED is not 'true': nothing to do.")
        return 0
    day = args.date or util.now_athens().date()
    runner = Runner(day, dry_run=args.dry_run, commit=not args.no_commit)
    return runner.run(args.type, max(0, args.count))


def rewrite(slug: str, *, dry_run: bool = True, commit: bool = False) -> int:
    post = next((i for i in ContentIndex(config.CONTENT_DIR).index if i["slug"] == slug), None)
    if post is None:
        print(f"[FAIL] rewrite {slug}: δεν υπάρχει")
        return 1
    category = post["categories"][0]
    if category == config.LIFESTYLE_CATEGORY_ID:
        print(f"[FAIL] rewrite {slug}: τα lifestyle βασίζονται σε πηγές και δεν ξαναγράφονται")
        return 1
    kind = {406: "eortologio", 407: "zodia"}.get(category, "health")
    day = date.fromisoformat(post["date"][:10]) if kind in ("eortologio", "zodia") else util.now_athens().date()
    runner = Runner(day, dry_run=dry_run, commit=commit, rewrite=post)
    record = runner.one(kind, 0)
    print(f"[{record['status']}] rewrite {kind} {slug}: {'; '.join(record['reasons'])}")
    return 0 if record["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
