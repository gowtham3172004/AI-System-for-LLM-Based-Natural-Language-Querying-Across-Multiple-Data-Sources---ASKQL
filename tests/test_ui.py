"""Headless Streamlit tests (no network, no LLM). A real-browser walkthrough lives in scripts/ui_shots.py."""
import sys

import pytest
from streamlit.testing.v1 import AppTest

from conftest import ROOT

sys.path.insert(0, str(ROOT / "app"))


@pytest.fixture
def app(monkeypatch, tmp_path):
    for k in ("GROQ_API_KEYS", "GROQ_API_KEY", "GEMINI_API_KEYS", "GEMINI_API_KEY", "OLLAMA_BASE_URL"):
        monkeypatch.setenv(k, "")
    monkeypatch.setenv("HISTORY_DB_URL", f"sqlite:///{tmp_path / 'ui.db'}")
    monkeypatch.chdir(ROOT)
    from askql.config import get_settings

    get_settings.cache_clear()
    return AppTest.from_file(str(ROOT / "app" / "streamlit_app.py"), default_timeout=60)


def test_landing_then_demo_then_missing_llm_is_handled(app):
    at = app.run()
    assert not at.exception
    assert any("No AI model is configured" in w.value for w in at.warning)  # landing explains what to do
    assert any("no model configured" in m.value for m in at.sidebar.markdown)
    assert not at.chat_input  # nothing to ask until a source is connected

    at.button(key="demo_main").click().run()
    assert not at.exception
    assert any("Demo shop" in m.value for m in at.markdown)
    assert len(at.chat_input) == 1

    at.chat_input[0].set_value("how many orders?").run()
    assert not at.exception
    assert any("No LLM configured" in e.value for e in at.error)
    assert at.session_state["messages"] == []  # the unanswered question is not left dangling


def test_suggestions_come_from_the_real_schema(app):
    from ui import suggest_questions

    from askql.data import FileSource

    src = FileSource("sales")
    src.add_file("sales.csv", b"region,revenue,order_date,customer_id\nN,10,2024-01-01,1\nS,20,2024-02-01,2\n")
    qs = suggest_questions(src)
    assert any("revenue" in q and "region" in q for q in qs)
    assert any("by month" in q for q in qs)
    assert not any("customer id" in q for q in qs)  # id-like columns are never suggested as measures
    assert len(set(qs)) == len(qs) <= 4


def test_number_formatting_handles_numpy_types():
    import numpy as np

    from ui import fmt

    assert fmt(np.int64(1500)) == "1,500" and fmt(1500) == "1,500"
    assert fmt(np.float64(2.0)) == "2" and fmt(1234.5678) == "1,234.57" and fmt(np.float32(0.5)) == "0.50"
    assert fmt(None) == "None" and fmt(True) == "True" and fmt("x") == "x" and fmt(float("nan")) == "nan"


def test_ui_module_escapes_html():
    from ui import esc, pill

    assert "<script>" not in pill("<script>alert(1)</script>")
    assert esc("a&b") == "a&amp;b"
