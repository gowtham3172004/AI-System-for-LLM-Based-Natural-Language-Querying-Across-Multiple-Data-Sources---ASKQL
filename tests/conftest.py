from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest
from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableLambda

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from askql.agent import AskQLAgent  # noqa: E402
from askql.config import Settings  # noqa: E402
from askql.data import DatabaseSource, FileSource  # noqa: E402


class ScriptedLLM:
    """Returns pre-baked replies in order and records the prompts it received."""

    def __init__(self, replies: list[str | dict]):
        self.replies = [r if isinstance(r, str) else json.dumps(r) for r in replies]
        self.calls: list[str] = []

    def __call__(self):
        def _invoke(messages):
            self.calls.append("\n".join(m.content for m in messages))
            if not self.replies:
                raise AssertionError("LLM called more times than scripted")
            return AIMessage(content=self.replies.pop(0))

        return RunnableLambda(_invoke)


@pytest.fixture
def settings() -> Settings:
    return Settings(_env_file=None, max_repair_attempts=2, max_result_rows=100, allow_local_databases=True,
                    rate_limit_per_minute=1000, ip_rate_limit_per_minute=1000, global_rate_limit_per_minute=1000)


@pytest.fixture
def files_source() -> FileSource:
    src = FileSource("shop")
    for name in ("customers.csv", "products.csv", "orders.csv"):
        src.add_file(name, (ROOT / "sample_data" / name).read_bytes())
    yield src
    src.close()


@pytest.fixture
def db_source() -> DatabaseSource:
    src = DatabaseSource(f"sqlite:///{ROOT / 'sample_data' / 'shop.db'}", allow_local=True)
    yield src
    src.close()


@pytest.fixture
def make_agent(settings):
    def _make(replies):
        llm = ScriptedLLM(replies)
        return AskQLAgent(llm, settings), llm

    return _make
