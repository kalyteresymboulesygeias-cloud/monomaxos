"""google-genai wrapper: structured output, bounded retries, fallback model, call accounting."""
from __future__ import annotations

import sys
import time
from typing import Literal, TypeVar

import httpx
from google import genai
from google.genai import errors, types
from pydantic import BaseModel, Field, ValidationError

import config

from .budget import Budget

T = TypeVar("T", bound=BaseModel)
BAD_FINISH = {"SAFETY", "MAX_TOKENS", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "OTHER"}


class GenerationError(RuntimeError):
    pass


class SourceRef(BaseModel):
    url: str
    official: bool = Field(description="true only for an official statement or announcement by the person or organisation")
    claim: str = ""


class Article(BaseModel):
    title: str
    meta_description: str
    focus_keyword: str
    excerpt: str
    body_markdown: str
    image_queries: list[str]
    image_alts: list[str]
    subcategory: str | None = None
    sources: list[SourceRef] | None = None


class Verdict(BaseModel):
    verdict: Literal["PASS", "FAIL"]
    reasons: list[str] = []


def check_model_name(name: str, label: str) -> None:
    if not name:
        raise SystemExit(f"{label} is empty. Set it as a GitHub Actions variable (a stable Gemini model name).")
    if any(tag in name for tag in ("-preview", "-exp", "-latest")):
        raise SystemExit(f"{label}={name} is not a stable model. Use a stable model name.")


def _stable_models_hint(client=None) -> str:
    """Names of stable models that support generateContent, to help pick GEMINI_MODEL."""
    try:
        client = client or genai.Client(api_key=config.env("GEMINI_API_KEY"))
        names = sorted(
            m.name.removeprefix("models/")
            for m in client.models.list()
            if "generateContent" in (m.supported_actions or [])
            and m.name.removeprefix("models/").startswith("gemini-")
            and not any(tag in m.name for tag in ("-preview", "-exp", "-latest"))
        )
    except Exception:
        return ""
    return "Stable models for this key: " + ", ".join(names) if names else ""


def _retryable(exc: Exception) -> bool:
    if isinstance(exc, errors.APIError):
        return exc.code == 429 or (exc.code or 0) >= 500
    return isinstance(exc, (httpx.TimeoutException, TimeoutError, httpx.TransportError))


def _describe(exc: Exception | None) -> str:
    if exc is None:
        return "unknown"
    code = getattr(exc, "code", "") or ""
    detail = " ".join(str(exc).split())[:900]
    return f"{type(exc).__name__} {code} {detail}".strip()


class Gemini:
    def __init__(self, budget: Budget, client=None):
        self.model = config.env("GEMINI_MODEL")
        self.fallback = config.env("GEMINI_FALLBACK_MODEL")
        if not self.model and client is None and config.env("GEMINI_API_KEY"):
            raise SystemExit(f"GEMINI_MODEL is empty. Set it as a GitHub Actions variable. {_stable_models_hint()}")
        check_model_name(self.model, "GEMINI_MODEL")
        if self.fallback:
            check_model_name(self.fallback, "GEMINI_FALLBACK_MODEL")
        level = config.env("GEMINI_THINKING_LEVEL").lower()
        if level and level not in ("low", "medium", "high"):
            raise SystemExit("GEMINI_THINKING_LEVEL must be low, medium or high")
        self.thinking = level
        self.budget = budget
        if client is None:
            key = config.env("GEMINI_API_KEY")
            if not key:
                raise SystemExit("GEMINI_API_KEY is not set")
            client = genai.Client(api_key=key, http_options=types.HttpOptions(timeout=config.GEMINI_TIMEOUT_MS))
            available = {m.name.removeprefix("models/") for m in client.models.list()}
            if self.model not in available:
                raise SystemExit(f"Gemini model {self.model} is not available for this API key. {_stable_models_hint(client)}")
            if self.fallback and self.fallback not in available:
                print(f"[gemini] fallback {self.fallback} is not available for this API key; running without it", file=sys.stderr)
                self.fallback = ""
        self.client = client

    def _config(self, system: str, schema) -> types.GenerateContentConfig:
        extra = {}
        if self.thinking:
            extra["thinking_config"] = types.ThinkingConfig(thinking_level=self.thinking.upper())
        return types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_schema=schema,
            temperature=0.7,
            **extra,
        )

    def _call(self, model: str, system: str, prompt: str, schema):
        last: Exception | None = None
        for attempt in range(config.GEMINI_ATTEMPTS):
            self.budget.take("gemini")
            try:
                return self.client.models.generate_content(model=model, contents=prompt, config=self._config(system, schema))
            except Exception as exc:  # noqa: BLE001
                if not _retryable(exc):
                    raise GenerationError(f"Gemini error: {type(exc).__name__} {getattr(exc, 'code', '')}") from None
                last = exc
                print(f"[gemini] {model} attempt {attempt + 1}: {_describe(exc)}", file=sys.stderr)
                if attempt + 1 < config.GEMINI_ATTEMPTS:
                    time.sleep(5 * 2**attempt)
        raise _Exhausted(_describe(last))

    def generate(self, system: str, prompt: str, schema: type[T]) -> T:
        try:
            response = self._call(self.model, system, prompt, schema)
        except _Exhausted as exc:
            if not self.fallback:
                raise GenerationError(f"Gemini unavailable after retries ({exc})") from None
            try:
                response = self._call(self.fallback, system, prompt, schema)
            except _Exhausted as exc2:
                raise GenerationError(f"Gemini and fallback unavailable ({exc2})") from None
        candidate = (response.candidates or [None])[0]
        finish = getattr(getattr(candidate, "finish_reason", None), "name", None) or str(getattr(candidate, "finish_reason", ""))
        if candidate is None or finish in BAD_FINISH:
            raise GenerationError(f"Gemini finish_reason={finish or 'NO_CANDIDATE'}")
        try:
            return schema.model_validate_json(response.text)
        except ValidationError as exc:
            raise GenerationError(f"invalid JSON from model: {exc.error_count()} errors") from None


class _Exhausted(Exception):
    pass
