"""Turn opaque provider failures into safe, actionable one-liners (never raw provider text)."""
from __future__ import annotations

from contextvars import ContextVar

# A per-request list that failing candidates append to (set by the service around each ask()).
FAILURES: ContextVar[list[str] | None] = ContextVar("askql_llm_failures", default=None)

_ENV = {"groq": "GROQ_MODEL", "gemini": "GEMINI_MODEL", "ollama": "OLLAMA_MODEL"}


def classify_error(exc: BaseException, provider: str) -> str:
    text = f"{type(exc).__name__} {exc}".lower()
    if any(k in text for k in ("not_found", "not found", "404", "no longer available", "decommission",
                               "does not exist", "model_not_found", "deprecated")):
        if provider == "ollama" and "pull" in text:
            return "model not installed - run `ollama pull <model>` or change OLLAMA_MODEL"
        return f"model not available - change {_ENV.get(provider, 'the model')} in your settings"
    if any(k in text for k in ("401", "403", "invalid api key", "invalid_api_key", "api key not valid", "api_key_invalid",
                               "unauthor", "permission", "authentication", "forbidden")):
        return "API key rejected (invalid, revoked or lacking access)"
    if any(k in text for k in ("429", "rate limit", "rate_limit", "quota", "resource_exhausted", "too many requests")):
        return "rate-limited or quota exhausted"
    if any(k in text for k in ("timeout", "timed out", "connect", "connection", "network", "dns", "unreachable",
                               "refused", "name resolution")):
        if provider == "ollama":
            return "cannot reach Ollama - is `ollama serve` running and OLLAMA_BASE_URL correct?"
        return "network/connection problem or timeout"
    if "safety" in text or "blocked" in text:
        return "response blocked by the provider's safety filter"
    return f"unexpected error ({type(exc).__name__})"
