"""Service-level behaviour: follow-up context, rate limits, caps, failure handling, API hardening."""
import pytest
from fastapi.testclient import TestClient

from askql.agent import AskQLAgent, Turn
from askql.api.app import create_app
from askql.config import Settings
from askql.history import HistoryStore
from askql.security import RateLimitError
from askql.service import MAX_SOURCES_PER_OWNER, AskQLService

from conftest import ROOT, ScriptedLLM

ANALYSIS = {"answer": "Done.", "insights": [], "chart": {"type": "none"}, "followups": []}
CSV = (b"a\n1\n2\n", "t.csv")


def make_service(tmp_path, replies=(), **kw):
    settings = Settings(_env_file=None, allow_local_databases=True, **kw)
    svc = AskQLService(settings, history=HistoryStore(f"sqlite:///{tmp_path / 'h.db'}"))
    llm = ScriptedLLM(list(replies))
    svc._agent = AskQLAgent(llm, settings)
    svc._router = object()
    return svc, llm


def plan(sql):
    return {"intent": "sql", "sql": sql}


def test_followup_context_comes_from_same_source_and_successful_turns_only(tmp_path):
    svc, llm = make_service(tmp_path, [plan("SELECT a FROM t"), ANALYSIS, plan("SELECT COUNT(*) AS n FROM t"), ANALYSIS,
                                       plan("SELECT 1 AS x FROM t2"), ANALYSIS])
    s1 = svc.create_file_source("owner", [("t.csv", CSV[0])])
    s2 = svc.create_file_source("owner", [("t2.csv", b"b\n9\n")])
    svc.ask("owner", "list a", s1)
    svc.ask("owner", "how many?", s1)
    turns = svc.turns_from_history("owner", s1)
    assert [t.question for t in turns] == ["list a", "how many?"]
    assert svc.turns_from_history("owner", s2) == []  # different source -> no bleed-through
    svc.ask("owner", "other source question", s2)
    assert "list a" not in llm.calls[-2]  # prompt for s2 carries no s1 context


def test_failed_turns_are_not_used_as_context(tmp_path):
    svc, _ = make_service(tmp_path, [plan("SELECT nope FROM t")] * 3 + [plan("SELECT a FROM t"), ANALYSIS],
                          max_repair_attempts=2)
    s = svc.create_file_source("o", [("t.csv", CSV[0])])
    assert not svc.ask("o", "broken", s).ok
    assert svc.turns_from_history("o", s) == []


def test_conversation_resolves_followup_with_prior_sql(tmp_path):
    svc, llm = make_service(tmp_path, [plan("SELECT a FROM t WHERE a > 1"), ANALYSIS])
    s = svc.create_file_source("o", [("t.csv", CSV[0])])
    svc.ask("o", "and only above 1?", s, turns=[Turn("show a", "SELECT a FROM t", "ok")])
    assert "show a" in llm.calls[0] and "SELECT a FROM t" in llm.calls[0]


def test_llm_outage_returns_generic_error_and_leaks_nothing(tmp_path, caplog):
    svc, _ = make_service(tmp_path)

    class Boom:
        def __call__(self):
            from langchain_core.runnables import RunnableLambda

            def f(_):
                raise RuntimeError("401 invalid api key gsk_SUPERSECRETKEY0123456789 for https://api.groq.com")

            return RunnableLambda(f)

    svc._agent = AskQLAgent(Boom(), svc.settings)
    s = svc.create_file_source("o", [("t.csv", CSV[0])])
    r = svc.ask("o", "hello", s)
    assert r.error_code == "llm_unavailable"
    assert not r.ok and "SUPERSECRET" not in r.answer and "groq" not in r.answer.lower()
    assert "SUPERSECRET" not in caplog.text


def test_rate_limits_per_session_ip_and_global(tmp_path):
    svc, _ = make_service(tmp_path, [{"intent": "chat", "reply": "hi"}] * 50, rate_limit_per_minute=2,
                          ip_rate_limit_per_minute=3, global_rate_limit_per_minute=100)
    svc.ask("s1", "hi", None)
    svc.ask("s1", "hi", None)
    with pytest.raises(RateLimitError):
        svc.ask("s1", "hi", None)
    # rotating the session id does NOT dodge the per-IP limit
    svc2, _ = make_service(tmp_path, [{"intent": "chat", "reply": "hi"}] * 50, rate_limit_per_minute=100,
                           ip_rate_limit_per_minute=3, global_rate_limit_per_minute=100)
    for i in range(3):
        svc2.ask(f"rotating-{i}", "hi", None, client_ip="1.2.3.4")
    with pytest.raises(RateLimitError):
        svc2.ask("rotating-new", "hi", None, client_ip="1.2.3.4")
    # ...and the global cap protects the quota even against many IPs
    svc3, _ = make_service(tmp_path, [{"intent": "chat", "reply": "hi"}] * 50, global_rate_limit_per_minute=2)
    svc3.ask("a", "hi", None, client_ip="1.1.1.1")
    svc3.ask("b", "hi", None, client_ip="2.2.2.2")
    with pytest.raises(RateLimitError):
        svc3.ask("c", "hi", None, client_ip="3.3.3.3")


def test_empty_and_oversized_questions(tmp_path):
    svc, llm = make_service(tmp_path, [{"intent": "chat", "reply": "ok"}])
    with pytest.raises(ValueError):
        svc.ask("s", "   ", None)
    svc.ask("s", "x" * 50000, None)
    assert len(llm.calls[0]) < 20000  # clamped before reaching the model


def test_sources_capped_per_owner_and_closed(tmp_path):
    svc, _ = make_service(tmp_path)
    made = [svc.create_file_source("o", [(f"t{i}.csv", CSV[0])]) for i in range(MAX_SOURCES_PER_OWNER + 2)]
    alive = svc.list_sources("o")
    assert len(alive) == MAX_SOURCES_PER_OWNER and made[0] not in alive
    assert svc.get_source(made[0].id, "o") is None
    svc.close_all()
    assert svc.list_sources("o") == []


def test_upload_limits(tmp_path):
    svc, _ = make_service(tmp_path, max_upload_mb=1, max_files_per_upload=2)
    with pytest.raises(ValueError, match="MB"):
        svc.create_file_source("o", [("big.csv", b"a\n" + b"1\n" * 700_000)])
    with pytest.raises(ValueError, match="At most"):
        svc.create_file_source("o", [(f"{i}.csv", b"a\n1\n") for i in range(3)])
    with pytest.raises(ValueError):
        svc.create_file_source("o", [])


def test_old_history_db_is_migrated(tmp_path):
    import sqlalchemy as sa

    url = f"sqlite:///{tmp_path / 'old.db'}"
    eng = sa.create_engine(url)
    with eng.begin() as c:
        c.exec_driver_sql("CREATE TABLE query_history (id INTEGER PRIMARY KEY, session_id VARCHAR(64) NOT NULL, "
                          "source_name VARCHAR(200), question TEXT NOT NULL, sql TEXT, answer TEXT, status VARCHAR(16) "
                          "NOT NULL, row_count INTEGER, elapsed_ms FLOAT, created_at DATETIME)")
    assert HistoryStore(url).list("x") == []


# ---------------------------------------------------------------- API hardening
@pytest.fixture
def client(tmp_path):
    svc, llm = make_service(tmp_path, max_upload_mb=1, max_files_per_upload=2)
    return TestClient(create_app(svc)), svc, llm


GOOD = {"X-Session-Id": "good-session-0123456789"}


@pytest.mark.parametrize("hdr", [{}, {"X-Session-Id": "short"}, {"X-Session-Id": "anonymous"},
                                 {"X-Session-Id": "has spaces and !!! 0123456789"}, {"X-Session-Id": "x" * 65}])
def test_api_rejects_weak_or_missing_session_ids(client, hdr):
    assert client[0].get("/api/sources", headers=hdr).status_code == 400


def test_api_upload_limits(client):
    c = client[0]
    many = [("files", (f"{i}.csv", b"a\n1\n", "text/csv")) for i in range(3)]
    assert c.post("/api/sources/files", files=many, headers=GOOD).status_code == 400
    big = [("files", ("big.csv", b"a\n" + b"1\n" * 900_000, "text/csv"))]
    assert c.post("/api/sources/files", files=big, headers=GOOD).status_code == 413
    assert c.post("/api/sources/files", files=[("files", ("n.exe", b"x", "application/x"))], headers=GOOD).status_code == 400


def test_api_public_policy_blocks_local_db_and_hides_credentials(tmp_path):
    svc = AskQLService(Settings(_env_file=None), history=HistoryStore(f"sqlite:///{tmp_path / 'p.db'}"))  # defaults
    c = TestClient(create_app(svc))
    r = c.post("/api/sources/database", json={"url": f"sqlite:///{ROOT / 'sample_data' / 'shop.db'}"}, headers=GOOD)
    assert r.status_code == 403
    r = c.post("/api/sources/database", json={"url": "postgresql://admin:hunter2@127.0.0.1:5432/x"}, headers=GOOD)
    assert r.status_code == 403 and "hunter2" not in r.text
    r = c.post("/api/sources/database", json={"url": "not a url with pass hunter2"}, headers=GOOD)
    assert r.status_code in (400, 403) and "hunter2" not in r.text


def test_api_source_ids_unguessable_and_delete_scoped(client):
    c = client[0]
    files = [("files", ("t.csv", b"a\n1\n", "text/csv"))]
    sid = c.post("/api/sources/files", files=files, headers=GOOD).json()["id"]
    assert len(sid) == 32
    other = {"X-Session-Id": "other-session-0123456789"}
    assert c.delete(f"/api/sources/{sid}", headers=other).status_code == 404
    assert c.delete(f"/api/sources/{sid}", headers=GOOD).status_code == 200


def test_api_question_validation_and_llm_outage_status(client):
    c, svc, _ = client
    assert c.post("/api/ask", json={"question": ""}, headers=GOOD).status_code == 422
    assert c.post("/api/ask", json={"question": "x" * 2001}, headers=GOOD).status_code == 422
    assert c.post("/api/ask", json={"question": "hi", "source_id": "nope"}, headers=GOOD).status_code == 404


def test_api_health_leaks_nothing(client):
    client[1]._router = type("R", (), {"labels": ["groq:model (key 1)"]})()
    body = client[0].get("/health").text
    assert "gsk" not in body and "groq" not in body.lower() and "key" not in body.lower()


def test_unwritable_history_db_degrades_to_memory_instead_of_crashing(tmp_path):
    store = HistoryStore("sqlite:////definitely/not/writable/dir/h.db")
    assert store.persistent is False
    from askql.agent import AskResult

    store.add("s", None, None, AskResult(question="q", answer="a"))
    assert [r["question"] for r in store.list("s")] == ["q"]
    assert HistoryStore(f"sqlite:///{tmp_path / 'ok.db'}").persistent is True


def test_api_maps_llm_outage_to_503_but_sql_errors_to_200(tmp_path):
    from langchain_core.runnables import RunnableLambda

    svc, llm = make_service(tmp_path, [plan("SELECT nope FROM t")] * 3, max_repair_attempts=2)
    c = TestClient(create_app(svc))
    sid = c.post("/api/sources/files", files=[("files", ("t.csv", b"a\n1\n", "text/csv"))], headers=GOOD).json()["id"]
    r = c.post("/api/ask", json={"question": "q", "source_id": sid}, headers=GOOD)
    assert r.status_code == 200 and r.json()["error"] and r.json()["error_code"] is None  # bad SQL: a normal answer
    svc._agent = AskQLAgent(lambda: RunnableLambda(lambda _: (_ for _ in ()).throw(RuntimeError("down"))), svc.settings)
    r = c.post("/api/ask", json={"question": "q2", "source_id": sid}, headers=GOOD)
    assert r.status_code == 503 and r.json()["error_code"] == "llm_unavailable"


def test_outage_result_carries_safe_per_model_reasons(tmp_path):
    from langchain_core.runnables import RunnableLambda

    from askql.llm import LLMRouter
    from askql.llm.factory import Candidate

    def dead(_):
        raise RuntimeError("404 model no longer available sk-whatever")

    router = LLMRouter([Candidate("gemini", "gemini:m (key 1)", lambda: RunnableLambda(dead))])
    svc, _ = make_service(tmp_path)
    svc._router = router
    svc._agent = AskQLAgent(lambda: router.runnable(), svc.settings)
    s = svc.create_file_source("o", [("t.csv", CSV[0])])
    r = svc.ask("o", "hello", s)
    assert r.error_code == "llm_unavailable"
    assert r.error_detail == ["gemini:m (key 1): model not available - change GEMINI_MODEL in your settings"]
