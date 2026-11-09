"""Security helpers: secret redaction, untrusted-markdown sanitising, rate limiting."""
from __future__ import annotations

import logging
import re
import threading
import time
from collections import defaultdict, deque

# ---------------------------------------------------------------- redaction
_secrets: set[str] = set()
_factory_installed = False


def register_secrets(values: list[str]) -> None:
    """Remember secrets so they are scrubbed from every log line and error message."""
    _secrets.update(v for v in values if v and len(v) >= 6)


def redact(text: str, extra: list[str] | None = None) -> str:
    for s in sorted(_secrets | set(extra or []), key=len, reverse=True):
        if s:
            text = text.replace(s, "***")
    # key-shaped tokens and URL credentials, even if never registered
    text = re.sub(r"(gsk_|AIza)[A-Za-z0-9_\-]{12,}", "***", text)
    text = re.sub(r"(?<=://)([^/\s:@]+):([^@\s/]+)@", r"\1:***@", text)
    return text


def install_log_redaction() -> None:
    """Scrub secrets from all log records, whatever logger/handler emits them."""
    global _factory_installed
    if _factory_installed:
        return
    old = logging.getLogRecordFactory()

    def factory(*a, **kw):
        record = old(*a, **kw)
        try:
            record.msg = redact(record.getMessage())
            record.args = ()
        except Exception:  # never break logging
            pass
        return record

    logging.setLogRecordFactory(factory)
    # httpx logs full request URLs at INFO
    logging.getLogger("httpx").setLevel(logging.WARNING)
    _factory_installed = True


def safe_error(exc: BaseException, extra_secrets: list[str] | None = None, limit: int = 300) -> str:
    """First line of an exception, with credentials removed - safe to show to users."""
    inner = getattr(exc, "orig", exc)
    line = (str(inner).strip().splitlines() or [type(inner).__name__])[0]
    return redact(line, extra_secrets)[:limit]


# ---------------------------------------------------------------- untrusted LLM text
_IMG = re.compile(r"!\[[^\]]*\]\([^)]*\)|!\[[^\]]*\]\[[^\]]*\]", re.S)
_LINK = re.compile(r"\[([^\]]*)\]\((?:[^)]*)\)")
_REF_DEF = re.compile(r"^\s*\[[^\]]+\]:\s*\S+.*$", re.M)
_HTML = re.compile(r"</?[a-zA-Z][^>]*>")


def sanitize_markdown(text: str) -> str:
    """LLM output can be steered by data inside uploaded files (prompt injection).

    A markdown image/link pointing at an attacker's URL could leak data the moment it is
    rendered, so images, link targets, reference definitions and raw HTML are removed.
    """
    text = _IMG.sub("", text or "")
    text = _LINK.sub(r"\1", text)
    text = _REF_DEF.sub("", text)
    return _HTML.sub("", text).strip()


# ---------------------------------------------------------------- rate limiting
class RateLimitError(Exception):
    pass


class SlidingWindowLimiter:
    def __init__(self, limit: int, window: float = 60.0):
        self.limit, self.window = limit, window
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, key: str) -> bool:
        """Record a hit; return False when over the limit (hit is not recorded)."""
        now = time.monotonic()
        with self._lock:
            if len(self._hits) > 5000:  # drop idle keys so random ids can't grow memory unbounded
                for k in [k for k, q in self._hits.items() if not q or now - q[-1] > self.window]:
                    del self._hits[k]
            q = self._hits[key]
            while q and now - q[0] > self.window:
                q.popleft()
            if len(q) >= self.limit:
                return False
            q.append(now)
            return True
