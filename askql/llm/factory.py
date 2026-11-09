"""LLM provider factory: Groq (multi-key), Gemini (multi-key) and Ollama.

Every configured key / endpoint becomes one candidate model. Candidates are
ordered by ``LLM_PROVIDER_ORDER``; keys within the leading provider are rotated
round-robin so load (and rate limits) spread across them. The resulting
runnable falls back to the next candidate on any error (rate limit, quota,
network, bad key), so one dead key never takes the app down.
"""
from __future__ import annotations

import itertools
import logging
import threading
from dataclasses import dataclass
from typing import Callable

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage
from langchain_core.runnables import Runnable, RunnableLambda

from askql.config import Settings, get_settings
from askql.security import register_secrets, safe_error

from .diagnostics import FAILURES, classify_error

log = logging.getLogger(__name__)


class NoLLMConfiguredError(RuntimeError):
    """Raised when no provider is configured in the environment."""


@dataclass
class Candidate:
    provider: str
    label: str  # safe to log/display (never contains the key)
    build: Callable[[], BaseChatModel]


def _groq(s: Settings, key: str) -> BaseChatModel:
    from langchain_groq import ChatGroq

    return ChatGroq(
        model=s.groq_model,
        api_key=key,
        temperature=s.llm_temperature,
        timeout=s.llm_timeout_seconds,
        max_retries=s.llm_max_retries,
    )


def _gemini(s: Settings, key: str) -> BaseChatModel:
    from langchain_google_genai import ChatGoogleGenerativeAI

    return ChatGoogleGenerativeAI(
        model=s.gemini_model,
        google_api_key=key,
        temperature=s.llm_temperature,
        timeout=s.llm_timeout_seconds,
        max_retries=s.llm_max_retries,
    )


def _ollama(s: Settings) -> BaseChatModel:
    from langchain_ollama import ChatOllama

    return ChatOllama(
        model=s.ollama_model,
        base_url=s.ollama_base_url,
        temperature=s.llm_temperature,
    )


def collect_candidates(s: Settings) -> list[Candidate]:
    per_provider: dict[str, list[Candidate]] = {
        "groq": [
            Candidate("groq", f"groq:{s.groq_model} (key {i})", lambda k=k: _groq(s, k))
            for i, k in enumerate(s.groq_keys, 1)
        ],
        "gemini": [
            Candidate("gemini", f"gemini:{s.gemini_model} (key {i})", lambda k=k: _gemini(s, k))
            for i, k in enumerate(s.gemini_keys, 1)
        ],
        "ollama": (
            [Candidate("ollama", f"ollama:{s.ollama_model}", lambda: _ollama(s))]
            if s.ollama_base_url
            else []
        ),
    }
    ordered: list[Candidate] = []
    for name in s.provider_order:
        if name not in per_provider:
            log.warning("Unknown or repeated provider %r in LLM_PROVIDER_ORDER - ignored", name)
            continue
        ordered.extend(per_provider.pop(name))
    # Providers configured but missing from the order go last.
    for rest in per_provider.values():
        ordered.extend(rest)
    return ordered


class LLMRouter:
    """Hands out a fallback-wrapped chat model, rotating the starting key."""

    def __init__(self, candidates: list[Candidate], tries_per_provider: int = 2):
        if not candidates:
            raise NoLLMConfiguredError(
                "No LLM configured. Set GROQ_API_KEYS, GEMINI_API_KEYS and/or OLLAMA_BASE_URL in .env"
            )
        self.candidates = candidates
        self.tries_per_provider = max(1, tries_per_provider)
        self._models: dict[int, BaseChatModel] = {}
        self._counter = itertools.count()
        self._lock = threading.Lock()

    @property
    def labels(self) -> list[str]:
        return [c.label for c in self.candidates]

    def _model(self, i: int) -> BaseChatModel:
        with self._lock:
            if i not in self._models:
                self._models[i] = self.candidates[i].build()
            return self._models[i]

    def _tracked(self, i: int) -> Runnable:
        """The model, but every failure is recorded (safe classification only) before fail-over continues."""
        cand, model = self.candidates[i], self._model(i)

        def run(x, config=None):
            try:
                return model.invoke(x, config)
            except Exception as e:
                reason = classify_error(e, cand.provider)
                log.warning("LLM candidate failed - %s: %s [%s]", cand.label, reason, safe_error(e, limit=160))
                sink = FAILURES.get()
                if sink is not None:
                    sink.append(f"{cand.label}: {reason}")
                raise

        return RunnableLambda(run)

    def check(self) -> list[dict]:
        """Ping every configured endpoint once. Used by the 'Test connections' button."""
        out = []
        for i, cand in enumerate(self.candidates):
            try:
                reply = self._model(i).invoke([HumanMessage(content="Reply with the single word: OK")])
                out.append({"label": cand.label, "ok": True, "detail": "working", "preview": str(reply.content)[:20]})
            except Exception as e:
                out.append({"label": cand.label, "ok": False, "detail": classify_error(e, cand.provider)})
        return out

    def _order(self) -> list[int]:
        """Rotate keys within the leading provider group; keep provider priority."""
        first = self.candidates[0].provider
        group = [i for i, c in enumerate(self.candidates) if c.provider == first]
        rest = [i for i in range(len(self.candidates)) if i not in group]
        shift = next(self._counter) % len(group)
        return group[shift:] + group[:shift] + rest

    def runnable(self) -> Runnable:
        """A chat model that transparently fails over across all candidates."""
        order, seen = [], {}
        for i in self._order():  # bound worst-case latency: at most N tries per provider, every provider reachable
            p = self.candidates[i].provider
            if seen.get(p, 0) < self.tries_per_provider:
                seen[p] = seen.get(p, 0) + 1
                order.append(i)
        primary = self._tracked(order[0])
        fallbacks = [self._tracked(i) for i in order[1:]]
        return primary.with_fallbacks(fallbacks) if fallbacks else primary


def build_router(settings: Settings | None = None) -> LLMRouter:
    s = settings or get_settings()
    register_secrets(s.groq_keys + s.gemini_keys + [s.askql_api_key])
    return LLMRouter(collect_candidates(s), s.llm_tries_per_provider)
