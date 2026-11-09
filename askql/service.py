"""Application service shared by the REST API and the Streamlit UI."""
from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field

from askql.agent import AskQLAgent, AskResult, Turn
from askql.config import Settings, get_settings
from askql.data import DatabaseSource, DataSource, FileSource
from askql.history import HistoryStore
from askql.llm import LLMRouter, NoLLMConfiguredError, build_router
from askql.llm.diagnostics import FAILURES
from askql.security import (RateLimitError, SlidingWindowLimiter, install_log_redaction, register_secrets,
                            safe_error)

log = logging.getLogger(__name__)

SOURCE_TTL_SECONDS = 2 * 3600
MAX_SOURCES = 20  # whole process
MAX_SOURCES_PER_OWNER = 3
MAX_QUESTION_CHARS = 2000


@dataclass
class _Entry:
    source: DataSource
    owner: str
    touched: float = field(default_factory=time.time)


class AskQLService:
    def __init__(self, settings: Settings | None = None, router: LLMRouter | None = None,
                 history: HistoryStore | None = None):
        self.settings = settings or get_settings()
        register_secrets(self.settings.groq_keys + self.settings.gemini_keys + [self.settings.askql_api_key])
        install_log_redaction()
        self._router = router
        self.history = history or HistoryStore()
        self._agent: AskQLAgent | None = None
        self._sources: dict[str, _Entry] = {}
        self._lock = threading.Lock()
        s = self.settings
        self._session_limit = SlidingWindowLimiter(s.rate_limit_per_minute)
        self._ip_limit = SlidingWindowLimiter(s.ip_rate_limit_per_minute)
        self._global_limit = SlidingWindowLimiter(s.global_rate_limit_per_minute)

    # -- LLM ------------------------------------------------------------
    @property
    def router(self) -> LLMRouter:
        if self._router is None:
            self._router = build_router(self.settings)  # raises NoLLMConfiguredError
        return self._router

    def llm_status(self) -> dict:
        try:
            return {"configured": True, "candidates": self.router.labels}
        except NoLLMConfiguredError as e:
            return {"configured": False, "candidates": [], "error": str(e)}

    def llm_check(self) -> list[dict]:
        """Live ping of every configured model endpoint (safe, classified results only)."""
        return self.router.check()

    @property
    def agent(self) -> AskQLAgent:
        if self._agent is None:
            self._agent = AskQLAgent(lambda: self.router.runnable(), self.settings)
        return self._agent

    # -- rate limits ----------------------------------------------------
    def enforce_rate_limit(self, session_id: str, client_ip: str | None = None) -> None:
        """Protects the (free-tier) LLM quota. Raises RateLimitError."""
        if not self._session_limit.hit(f"s:{session_id}"):
            raise RateLimitError("You're asking too fast - please wait a moment.")
        if client_ip and not self._ip_limit.hit(f"ip:{client_ip}"):
            raise RateLimitError("Too many requests from your network - please wait a moment.")
        if not self._global_limit.hit("global"):
            raise RateLimitError("The service is busy right now - please try again in a minute.")

    # -- sources --------------------------------------------------------
    def _register(self, source: DataSource, owner: str) -> DataSource:
        with self._lock:
            self._evict_expired()
            mine = [k for k, e in self._sources.items() if e.owner == owner]
            if len(mine) >= MAX_SOURCES_PER_OWNER:
                self._drop(min(mine, key=lambda k: self._sources[k].touched))
            while len(self._sources) >= MAX_SOURCES:
                self._drop(min(self._sources, key=lambda k: self._sources[k].touched))
            self._sources[source.id] = _Entry(source, owner)
        return source

    def _drop(self, sid: str) -> None:
        try:
            self._sources.pop(sid).source.close()
        except Exception:  # pragma: no cover
            log.debug("error closing source", exc_info=True)

    def _evict_expired(self) -> None:
        now = time.time()
        for sid in [k for k, e in self._sources.items() if now - e.touched > SOURCE_TTL_SECONDS]:
            self._drop(sid)

    def close_all(self) -> None:
        with self._lock:
            for sid in list(self._sources):
                self._drop(sid)

    def create_file_source(self, owner: str, files: list[tuple[str, bytes]], name: str | None = None) -> FileSource:
        s = self.settings
        if not files:
            raise ValueError("No files provided.")
        if len(files) > s.max_files_per_upload:
            raise ValueError(f"At most {s.max_files_per_upload} files per upload.")
        if sum(len(c) for _, c in files) > s.max_upload_mb * 1024 * 1024:
            raise ValueError(f"Upload exceeds {s.max_upload_mb} MB limit.")
        src = FileSource(name or ", ".join(f for f, _ in files)[:80], s.max_rows_per_file, s.duckdb_memory_limit)
        try:
            for fname, content in files:
                src.add_file(fname, content)
        except Exception:
            src.close()
            raise
        self._register(src, owner)
        return src

    def create_database_source(self, owner: str, url: str, name: str | None = None,
                               schema: str | None = None) -> DatabaseSource:
        src = DatabaseSource(
            url, name=name, schema=schema,
            allow_local=self.settings.allow_local_databases,
            statement_timeout=self.settings.query_timeout_seconds,
        )
        self._register(src, owner)
        return src

    def get_source(self, source_id: str, owner: str) -> DataSource | None:
        with self._lock:
            self._evict_expired()
            e = self._sources.get(source_id)
            if e and e.owner == owner:
                e.touched = time.time()
                return e.source
        return None

    def delete_source(self, source_id: str, owner: str) -> bool:
        with self._lock:
            e = self._sources.get(source_id)
            if not e or e.owner != owner:
                return False
            self._drop(source_id)
            return True

    def list_sources(self, owner: str) -> list[DataSource]:
        with self._lock:
            return [e.source for e in self._sources.values() if e.owner == owner]

    # -- asking ---------------------------------------------------------
    def ask(self, session_id: str, question: str, source: DataSource | None,
            turns: list[Turn] | None = None, on_step=None, record: bool = True,
            client_ip: str | None = None) -> AskResult:
        question = (question or "").strip()
        if not question:
            raise ValueError("Question is empty.")
        question = question[:MAX_QUESTION_CHARS]
        self.enforce_rate_limit(session_id, client_ip)
        if turns is None:
            turns = self.turns_from_history(session_id, source)
        failures: list[str] = []
        token = FAILURES.set(failures)
        try:
            result = self.agent.ask(question, source, turns, on_step)
        except NoLLMConfiguredError:
            raise
        except Exception as e:
            # LLM outage / every key rate-limited / unexpected bug: never leak provider internals to users.
            log.error("ask failed: %s: %s", type(e).__name__, safe_error(e))
            msg = "No AI model could answer right now."
            result = AskResult(question=question, error=msg, answer=msg, error_code="llm_unavailable",
                               error_detail=list(dict.fromkeys(failures)))
        finally:
            FAILURES.reset(token)
        if record:
            try:
                self.history.add(session_id, source.id if source else None, source.name if source else None, result)
            except Exception as e:  # history must never break answering
                log.warning("Could not save history: %s", type(e).__name__)
        return result

    def turns_from_history(self, session_id: str, source: DataSource | None, n: int = 6) -> list[Turn]:
        if source is None:
            return []
        rows = self.history.list(session_id, limit=n, source_id=source.id, only_success=True)
        return [Turn(r["question"], r["sql"], r["answer"]) for r in reversed(rows)]
