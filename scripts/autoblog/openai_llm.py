"""OpenAI Responses API wrapper with the same generate() contract as the Gemini wrapper."""
from __future__ import annotations

import sys
import time
from typing import Any, TypeVar

import openai
from openai.lib._pydantic import to_strict_json_schema
from pydantic import BaseModel, ValidationError

import config

from .budget import Budget
from .gemini import GenerationError

T = TypeVar("T", bound=BaseModel)


def strict_schema(schema: type[BaseModel]) -> dict[str, Any]:
    """Strict JSON schema without `default` keys (every field is required in strict mode)."""

    def strip(node: Any) -> Any:
        if isinstance(node, dict):
            return {k: strip(v) for k, v in node.items() if k != "default"}
        if isinstance(node, list):
            return [strip(v) for v in node]
        return node

    return strip(to_strict_json_schema(schema))


def _quota(exc: Exception) -> bool:
    return isinstance(exc, openai.RateLimitError) and getattr(exc, "code", None) == "insufficient_quota"


def _retryable(exc: Exception) -> bool:
    if isinstance(exc, openai.APIConnectionError):
        return True
    if isinstance(exc, openai.APIStatusError):
        return exc.status_code in (408, 409, 429) or exc.status_code >= 500
    return False


def _describe(exc: Exception | None) -> str:
    if exc is None:
        return "unknown"
    status = getattr(exc, "status_code", "") or ""
    code = getattr(exc, "code", "") or ""
    detail = " ".join(str(exc).split())[:900]
    return f"{type(exc).__name__} {status} {code} {detail}".strip()


class _Exhausted(Exception):
    pass


class OpenAIWriter:
    def __init__(self, budget: Budget, client=None):
        self.model = config.env("OPENAI_MODEL")
        self.fallback = config.env("OPENAI_FALLBACK_MODEL")
        if not self.model:
            raise SystemExit("OPENAI_MODEL is empty. Set it as a GitHub Actions variable.")
        effort = config.env("OPENAI_REASONING_EFFORT").lower()
        if effort and effort not in ("minimal", "low", "medium", "high"):
            raise SystemExit("OPENAI_REASONING_EFFORT must be minimal, low, medium or high")
        self.effort = effort
        self.budget = budget
        if client is None:
            key = config.env("OPENAI_API_KEY")
            if not key:
                raise SystemExit("OPENAI_API_KEY is not set")
            client = openai.OpenAI(api_key=key, timeout=config.LLM_TIMEOUT_S, max_retries=0)
            available = {m.id for m in client.models.list()}
            hint = "Models for this key: " + ", ".join(sorted(m for m in available if m.startswith(("gpt-", "o"))))
            if self.model not in available:
                raise SystemExit(f"OpenAI model {self.model} is not available for this API key. {hint}")
            print(f"[openai] using {self.model}. {hint}", file=sys.stderr)
            if self.fallback and self.fallback not in available:
                print(f"[openai] fallback {self.fallback} is not available for this API key; running without it", file=sys.stderr)
                self.fallback = ""
        self.client = client

    def _call(self, model: str, system: str, prompt: str, schema: type[BaseModel]):
        extra: dict[str, Any] = {"reasoning": {"effort": self.effort}} if self.effort else {}
        fmt = {"type": "json_schema", "name": schema.__name__, "schema": strict_schema(schema), "strict": True}
        last: Exception | None = None
        for attempt in range(config.LLM_ATTEMPTS):
            self.budget.take("gemini")
            try:
                return self.client.responses.create(
                    model=model, instructions=system, input=prompt, text={"format": fmt}, store=False, **extra
                )
            except Exception as exc:  # noqa: BLE001
                if not _retryable(exc):
                    raise GenerationError(f"OpenAI error: {_describe(exc)[:300]}") from None
                last = exc
                print(f"[openai] {model} attempt {attempt + 1}: {_describe(exc)}", file=sys.stderr)
                if _quota(exc):
                    break
                if attempt + 1 < config.LLM_ATTEMPTS:
                    time.sleep(5 * 2**attempt)
        raise _Exhausted(_describe(last))

    def generate(self, system: str, prompt: str, schema: type[T]) -> T:
        try:
            response = self._call(self.model, system, prompt, schema)
        except _Exhausted as exc:
            if not self.fallback:
                raise GenerationError(f"OpenAI unavailable after retries ({exc})") from None
            try:
                response = self._call(self.fallback, system, prompt, schema)
            except _Exhausted as exc2:
                raise GenerationError(f"OpenAI and fallback unavailable ({exc2})") from None
        if response.status != "completed":
            reason = getattr(response.incomplete_details, "reason", None)
            raise GenerationError(f"OpenAI status={response.status} {reason or ''}".strip())
        for item in response.output or []:
            for part in getattr(item, "content", None) or []:
                if getattr(part, "type", "") == "refusal":
                    raise GenerationError("OpenAI refusal")
        try:
            return schema.model_validate_json(response.output_text)
        except ValidationError as exc:
            raise GenerationError(f"invalid JSON from model: {exc.error_count()} errors") from None
