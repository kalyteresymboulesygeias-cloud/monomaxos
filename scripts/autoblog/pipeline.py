"""Orchestrates one run: plan -> generate -> checks -> validator -> image -> publish -> commit -> log."""
from __future__ import annotations

import json
import subprocess
import tempfile
from datetime import date, datetime, timedelta

import config

from . import checks, linking, namedays, render, sources, unsplash, util
from .budget import Budget, BudgetExceeded
from .content import ContentIndex
from .gemini import Article, Gemini, GenerationError, Verdict
from .openai_llm import OpenAIWriter
from .prompts import STYLE, TYPE_RULES, VALIDATOR

VALIDATED = {"news", "lifestyle", "gossip", "health", "nutrition"}
NEWS = {"news", "lifestyle", "gossip"}


class Skip(Exception):
    pass


class Runner:
    def __init__(self, day: date, *, dry_run: bool, commit: bool, gemini=None, fetcher=None, http=None, log=print):
        self.day = day
        self.dry = dry_run
        self.commit = commit and not dry_run
        self.ctx = ContentIndex(config.CONTENT_DIR)
        self.budget = Budget(day.isoformat(), persist=not dry_run)
        self._gemini = gemini
        self.fetcher = fetcher
        self.http = http
        self.log = log
        self.blocked = util.read_json(config.DATA_DIR / "blocked_terms.json")
        self.consecutive = 0
        self.records: list[dict] = []

    @property
    def gemini(self) -> Gemini | OpenAIWriter:
        if self._gemini is None:
            provider = config.env("AI_PROVIDER").lower() or ("openai" if config.env("OPENAI_API_KEY") else "gemini")
            if provider not in ("openai", "gemini"):
                raise SystemExit("AI_PROVIDER must be openai or gemini")
            self._gemini = OpenAIWriter(self.budget) if provider == "openai" else Gemini(self.budget)
        return self._gemini

    # ---------- planning ----------
    def published_today(self, kind: str) -> int:
        if kind in ("eortologio", "zodia"):
            return 0
        rows = [json.loads(l) for l in (config.STATE_DIR / "runs.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()] if (config.STATE_DIR / "runs.jsonl").exists() else []
        return sum(1 for r in rows if r.get("type") == kind and r.get("date") == self.day.isoformat() and r.get("status") == "PASS")

    def plan(self, kind: str, slot: int) -> dict:
        plan: dict = {"type": kind, "category": config.CATEGORY_BY_TYPE[kind], "slug": None, "update": False, "context": "", "source_texts": [], "sources": []}
        when = datetime.fromisoformat(f"{self.day.isoformat()}T{config.PUBLISH_TIME[kind]}:00") + timedelta(hours=2 * slot)
        plan["date"] = util.stamp(when)
        today = util.greek_date(self.day)
        if kind == "eortologio":
            if config.env("AUTO_BLOG_ENABLED_EORTOLOGIO") != "true" and not self.dry:
                raise Skip("AUTO_BLOG_ENABLED_EORTOLOGIO δεν είναι true (τα δεδομένα εορτολογίου θέλουν έλεγχο)")
            if self.ctx.on_date(406, self.day):
                raise Skip("υπάρχει ήδη άρθρο εορτολογίου για σήμερα")
            data = namedays.for_day(self.day)
            if not data["names"]:
                raise Skip("δεν υπάρχουν ονόματα για σήμερα στα δεδομένα")
            month = util.GREEK_MONTHS_GEN[self.day.month - 1]
            plan["slug"] = "eortologio-" + util.node_slugify(f"{self.day.day} {month}")
            existing = next((i for i in self.ctx.index if i["slug"] == plan["slug"]), None)
            if existing and (existing.get("modified") or existing["date"])[:10] == self.day.isoformat():
                raise Skip("το μόνιμο άρθρο εορτολογίου ενημερώθηκε ήδη σήμερα")
            plan["update"] = bool(existing)
            plan["names"] = set(data["names"])
            plan["topic"] = f"Εορτολόγιο {self.day.day} {month}"
            plan["context"] = f"Ημέρα: {today}.\nΓιορτές: {', '.join(data['feasts']) or 'μόνο σταθερές γιορτές'}.\nΟμάδες ονομάτων: " + json.dumps(data["groups"], ensure_ascii=False)
        elif kind == "zodia":
            if self.ctx.on_date(407, self.day):
                raise Skip("υπάρχουν ήδη ζώδια για σήμερα")
            plan["slug"] = util.node_slugify(f"Ζώδια σήμερα {today}")
            prev = self.ctx.recent({407}, 7, self.day)
            plan["previous"] = [self.ctx.body_text(i["slug"]) for i in prev]
            plan["topic"] = f"Ζώδια {today}"
            plan["context"] = f"Ημέρα: {today}."
        elif kind in ("health", "nutrition"):
            pool = [t for t in util.read_json(config.DATA_DIR / "topic_pool.json")["topics"] if t["type"] == kind and self.day.month in t["months"]]
            covered = [t["topic"] for t in (util.read_json(config.STATE_DIR / "topics.json", {}) or {}).get("topics", []) if t["date"] >= (self.day - timedelta(days=config.TOPIC_WINDOW_DAYS)).isoformat()]
            covered += [i["title"] for i in self.ctx.recent(None, config.TOPIC_WINDOW_DAYS, self.day)]
            fresh = [t for t in pool if not any(util.similarity(t["topic"], c) > 0.6 for c in covered)]
            if not fresh:
                raise Skip("δεν υπάρχει ακάλυπτο εποχικό θέμα στο topic_pool")
            choice = fresh[(self.day.toordinal() + slot) % len(fresh)]
            plan["topic"] = choice["topic"]
            plan["category"] = config.HEALTH_SUBCATEGORIES[choice["subcategory"]] if kind == "health" else 19
            plan["context"] = f"Θέμα: {choice['topic']}.\nΠροτεινόμενη subcategory: {choice['subcategory']}.\nΣημερινή ημερομηνία: {today}."
        else:
            group = util.read_json(config.SCRIPTS / "sources.json")["news" if kind == "news" else "lifestyle"]
            if not group:
                raise Skip(f"δεν έχουν οριστεί πηγές για {kind} στο scripts/sources.json")
            fetcher = self.fetcher or sources.Fetcher()
            max_age = config.SOURCE_MAX_AGE_HOURS_BY_TYPE.get(kind, config.SOURCE_MAX_AGE_HOURS)
            items, problems = sources.discover(fetcher, group, util.now_athens(), max_age)
            if not items:
                raise sources.SourceError("καμία πηγή δεν απάντησε: " + "; ".join(problems[:3]))
            covered = [i["title"] for i in self.ctx.recent({config.CATEGORY_BY_TYPE[kind]}, config.NEWS_TOPIC_WINDOW_DAYS, self.day)]
            covered += [t["topic"] for t in (util.read_json(config.STATE_DIR / "topics.json", {}) or {}).get("topics", [])]
            skip_roots = [util.fold(r) for r in self.blocked["roots"]] + ["ζωδι"]
            groups = [
                g for g in sources.cluster(items, covered)
                if len({i["site"] for i in g}) >= 2 and not any(r in util.fold(g[0]["title"]) for r in skip_roots)
            ]
            if len(groups) <= slot:
                raise Skip("κανένα θέμα δεν καλύπτεται από ≥2 διαφορετικά sites")
            chosen = groups[slot]
            texts, used, dates = [], [], []
            cutoff = util.now_athens() - timedelta(hours=max_age)
            lead = chosen[0]["title"]
            by_site: dict[str, list[dict]] = {}
            for i in sorted(chosen, key=lambda i: -util.similarity(i["title"], lead)):
                by_site.setdefault(i["site"], []).append(i)
            for candidates in by_site.values():
                for item in candidates:
                    try:
                        text, published = sources.article_text(fetcher, item["url"])
                    except sources.SourceError:
                        continue
                    known = [d for d in (item["date"], published) if d]
                    when = min(known) if known else None
                    if when is None or when < cutoff:
                        continue
                    texts.append(text)
                    used.append(item["url"])
                    dates.append(when.astimezone(util.ATHENS).date().isoformat())
                    break
            if len(texts) < 2:
                raise sources.SourceError("δεν κατέβηκαν κείμενα από ≥2 sites")
            plan["topic"] = chosen[0]["title"]
            plan["source_texts"] = texts
            plan["sources"] = used
            plan["source_basis"] = f"Σημερινή ημερομηνία: {today}.\n" + "\n\n".join(f"[{u}] (δημοσίευση: {d})\n{t[:5000]}" for u, d, t in zip(used, dates, texts))
            plan["context"] = (
                f"Σημερινή ημερομηνία: {today}. Αν η είδηση είναι παλαιότερη, μην τη γράψεις σαν σημερινή.\n"
                "Κείμενα πηγών (μόνο για ενημέρωση, ΜΗΝ τα αντιγράψεις):\n"
                + "\n\n".join(f"[{u}] (δημοσίευση: {d})\n{t[:5000]}" for u, d, t in zip(used, dates, texts))
            )
        return plan

    # ---------- generation ----------
    def check(self, kind: str, plan: dict, article: Article) -> tuple[list[str], str, str]:
        slug = plan["slug"] or util.node_slugify(article.title)
        html = render.markdown_to_html(article.body_markdown)
        html, links = render.fix_links(html, kind=kind, known_slugs=self.ctx.slugs, self_slug=slug)
        fails = checks.common(article, html, kind=kind, slug=slug, ctx=self.ctx, self_slug=slug if plan["update"] else None)
        if links["internal"] < 1:
            fails.append("χρειάζεται τουλάχιστον ένας έγκυρος εσωτερικός σύνδεσμος από τη λίστα")
        if kind == "eortologio":
            fails += checks.eortologio_names(html, plan["names"])
        if kind == "zodia":
            fails += checks.zodia_structure(html) + checks.repetition(html, plan.get("previous", []))
        if kind in ("health", "nutrition"):
            fails += checks.health_claims(html, self.blocked)
            if kind == "health" and article.subcategory not in config.HEALTH_SUBCATEGORIES:
                fails.append("subcategory εκτός λίστας")
        if kind in NEWS:
            official = any(s.official for s in (article.sources or []))
            fails += checks.blocked_claims(html, self.blocked, official) + checks.source_overlap(html, plan["source_texts"])
        return fails, html, slug

    def write(self, kind: str, plan: dict) -> tuple[Article, str, str]:
        cands = linking.candidates(self.ctx, plan["category"], plan["topic"], exclude=plan["slug"])
        prompt = f"{TYPE_RULES[kind]}\n\n{plan['context']}\n\nΥποψήφιοι εσωτερικοί σύνδεσμοι:\n" + "\n".join(f"- {c['title']}: {config.SITE}/{c['slug']}/" for c in cands)
        feedback: list[str] = []
        for _ in range(config.VALIDATION_RETRIES + 1):
            text = prompt + ("\n\nΗ προηγούμενη εκδοχή απορρίφθηκε για: " + "; ".join(feedback) + ". Διόρθωσέ τα." if feedback else "")
            article = self.gemini.generate(STYLE, text, Article)
            feedback, html, slug = self.check(kind, plan, article)
            if not feedback:
                return article, html, slug
        raise GenerationError("απέτυχαν οι έλεγχοι: " + "; ".join(feedback))

    def review(self, kind: str, plan: dict, article: Article, html: str) -> list[str]:
        if kind not in VALIDATED:
            return []
        basis = "Κείμενα πηγών:\n" + plan.get("source_basis", "\n\n".join(t[:5000] for t in plan["source_texts"])) if kind in NEWS else "Βάση: γενικά αποδεκτή ιατρική γνώση."
        verdict = self.gemini.generate(VALIDATOR, f"Τύπος: {kind}\nΤίτλος: {article.title}\n\nΚείμενο:\n{util.html_text(html)}\n\n{basis}", Verdict)
        return [] if verdict.verdict == "PASS" else ["AI ελεγκτής: " + "; ".join(verdict.reasons or ["FAIL"])]

    # ---------- publishing ----------
    def publish(self, plan: dict, payload: dict) -> dict:
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False)
        cmd = ["node", str(config.PUBLISHER), "--file", fh.name, "--content", str(config.CONTENT_DIR)]
        if plan["update"]:
            cmd += ["--update", "--slug", plan["slug"]]
        if self.dry:
            cmd.append("--dry-run")
        out = subprocess.run(cmd, capture_output=True, text=True)
        if out.returncode:
            raise GenerationError("publisher: " + out.stderr.strip()[:300])
        return json.loads(out.stdout)

    def git_commit(self, message: str) -> None:
        subprocess.run(["git", "add", str(config.CONTENT_DIR), str(config.STATE_DIR)], check=True, cwd=config.ROOT)
        if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=config.ROOT).returncode:
            subprocess.run(["git", "commit", "-q", "-m", message], check=True, cwd=config.ROOT)

    def one(self, kind: str, slot: int) -> dict:
        record = {"ts": util.stamp(util.now_athens()), "date": self.day.isoformat(), "type": kind, "topic": None, "status": "FAIL", "reasons": [], "slug": None}
        before = dict(self.budget.run)
        try:
            plan = self.plan(kind, slot)
            record["topic"] = plan["topic"]
            if plan["sources"]:
                record["sources"] = plan["sources"]
            article, html, slug = self.write(kind, plan)
            reasons = self.review(kind, plan, article, html)
            if reasons:
                raise GenerationError("; ".join(reasons))
            category = config.HEALTH_SUBCATEGORIES.get(article.subcategory or "", plan["category"]) if kind == "health" else plan["category"]
            alt = (article.image_alts or [article.title])[0]
            image, photo_id, info = unsplash.pick_image(article.image_queries, alt, category, self.budget, dry_run=self.dry, session=self.http)
            record["image"] = info
            if not image.get("url"):
                raise GenerationError("δεν βρέθηκε εικόνα")
            payload = {
                "original": True,
                "title": article.title,
                "slug": slug,
                "content": html,
                "excerpt": article.excerpt,
                "category_id": category,
                "meta_description": article.meta_description,
                "featured_image": image,
                "date": plan["date"],
                "disclaimer": config.DISCLAIMER_BY_TYPE[kind],
            }
            result = self.publish(plan, payload)
            record.update(status="PASS", slug=result["slug"], updated=plan["update"])
            if self.dry:
                shown = {**payload, "content": html[:300] + "…"}
                self.log(json.dumps(shown, ensure_ascii=False, indent=1))
                self.log("\n".join(render.paragraphs(html, 2)))
                util.write_json(config.DRY_RUN_DIR / f"{kind}-{result['slug']}.json", payload)
            else:
                unsplash.remember(photo_id, None if photo_id else image["url"])
                topics = util.read_json(config.STATE_DIR / "topics.json", {"topics": []}) or {"topics": []}
                topics["topics"] = [t for t in topics["topics"] if t["date"] >= (self.day - timedelta(days=90)).isoformat()]
                topics["topics"].append({"date": self.day.isoformat(), "type": kind, "topic": plan["topic"], "title": article.title, "slug": result["slug"]})
                util.write_json(config.STATE_DIR / "topics.json", topics)
                self.ctx = ContentIndex(config.CONTENT_DIR)
        except Skip as exc:
            record.update(status="SKIP", reasons=[str(exc)])
        except (GenerationError, sources.SourceError) as exc:
            record["reasons"] = [str(exc)]
        record["api_calls"] = {k: self.budget.run[k] - before[k] for k in before}
        if not self.dry:
            with (config.STATE_DIR / "runs.jsonl").open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(record, ensure_ascii=False) + "\n")
            if record["status"] == "PASS" and self.commit:
                self.git_commit(f"Δημοσίευση: {article.title}")
        return record

    def note_health_period(self) -> None:
        meta = util.read_json(config.STATE_DIR / "meta.json", {}) or {}
        first = meta.setdefault("health_first_run", self.day.isoformat())
        if config.env("PUBLISH_MODE_HEALTH", "pr") == "pr" and not meta.get("health_pr_notice") and (self.day - date.fromisoformat(first)).days >= config.HEALTH_PR_DAYS:
            meta["health_pr_notice"] = self.day.isoformat()
            with (config.STATE_DIR / "runs.jsonl").open("a", encoding="utf-8") as fh:
                fh.write(json.dumps({"ts": util.stamp(util.now_athens()), "type": "notice", "message": "Συμπληρώθηκαν 7 ημέρες σε PR mode. Αλλάξτε PUBLISH_MODE_HEALTH σε direct."}, ensure_ascii=False) + "\n")
        util.write_json(config.STATE_DIR / "meta.json", meta)

    def run(self, kind: str, count: int) -> int:
        limit = config.DAILY_LIMIT[config.phase()][kind]
        allowed = max(0, min(count, limit - self.published_today(kind)))
        if allowed < count:
            self.log(f"{kind}: όριο ημέρας {limit}, θα γραφτούν {allowed}")
        try:
            for slot in range(allowed):
                record = self.one(kind, slot)
                self.records.append(record)
                self.log(f"[{record['status']}] {kind} {record.get('slug') or record.get('topic')}: {'; '.join(record['reasons'])}")
                self.consecutive = self.consecutive + 1 if record["status"] == "FAIL" else 0
                if self.consecutive > config.CIRCUIT_BREAKER:
                    self.log("circuit breaker: σταματάω μετά από συνεχόμενες αποτυχίες")
                    break
        except BudgetExceeded as exc:
            self.log(f"όριο API: {exc}")
        finally:
            if not self.dry:
                self.budget.save()
                if kind in ("health", "nutrition"):
                    self.note_health_period()
                if self.commit:
                    self.git_commit(f"Auto-blog: ημερολόγιο εκτέλεσης {self.day.isoformat()} ({kind})")
        return 0
