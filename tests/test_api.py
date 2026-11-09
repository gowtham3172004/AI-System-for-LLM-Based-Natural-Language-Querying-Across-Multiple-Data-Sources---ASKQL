from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from askql.api.app import create_app
from askql.config import Settings
from askql.history import HistoryStore
from askql.llm import LLMRouter
from askql.service import AskQLService

from conftest import ROOT, ScriptedLLM

H = {"X-Session-Id": "header-session-0123456789"}
ANALYSIS = {"answer": "ok", "insights": [], "chart": {"type": "none"}, "followups": []}


@pytest.fixture
def api(settings, tmp_path):
    llm = ScriptedLLM([])
    svc = AskQLService(settings, history=HistoryStore(f"sqlite:///{tmp_path / 'h.db'}"))
    from askql.agent import AskQLAgent

    svc._agent = AskQLAgent(llm, settings)
    svc._router = object()  # so llm_status works without keys
    svc.llm_status = lambda: {"configured": True, "candidates": ["scripted"]}
    return TestClient(create_app(svc)), llm, svc


SID = "session-one-0123456789"


def upload(client, sid=SID):
    files = [("files", (n, (ROOT / "sample_data" / n).read_bytes(), "text/csv")) for n in ("customers.csv", "orders.csv")]
    return client.post("/api/sources/files", files=files, headers={"X-Session-Id": sid})


def test_health(api):
    r = api[0].get("/health")
    assert r.status_code == 200 and r.json() == {"status": "ok", "version": r.json()["version"], "llm_configured": True}


def test_upload_ask_history_flow(api):
    client, llm, _ = api
    src = upload(client).json()
    assert {t["name"] for t in src["tables"]} == {"customers", "orders"}
    llm.replies += ['{"intent":"sql","sql":"SELECT COUNT(*) AS n FROM orders"}', __import__("json").dumps(ANALYSIS)]
    r = client.post("/api/ask", json={"question": "how many orders?", "source_id": src["id"]}, headers={"X-Session-Id": SID})
    body = r.json()
    assert r.status_code == 200 and body["rows"] == [{"n": 1500}] and body["sql"].startswith("SELECT")
    h = client.get("/api/history", headers={"X-Session-Id": SID}).json()
    assert h["stats"]["total"] == 1 and h["items"][0]["status"] == "success"
    assert client.get("/api/history", headers={"X-Session-Id": "other-session-0123456789"}).json()["stats"]["total"] == 0


def test_sources_are_isolated_between_sessions(api):
    client, _, _ = api
    src = upload(client, "owner-session-0123456789").json()
    r = client.post("/api/ask", json={"question": "x", "source_id": src["id"]}, headers={"X-Session-Id": "intruder-session-0123456789"})
    assert r.status_code == 404
    assert client.get("/api/sources", headers={"X-Session-Id": "intruder-session-0123456789"}).json() == []


def test_bad_upload_rejected(api):
    r = api[0].post("/api/sources/files", files=[("files", ("evil.exe", b"MZ", "application/octet-stream"))], headers=H)
    assert r.status_code == 400


def test_database_connect_and_bad_connect(api):
    client, _, _ = api
    ok = client.post("/api/sources/database", json={"url": f"sqlite:///{ROOT / 'sample_data' / 'shop.db'}"}, headers=H)
    assert ok.status_code == 200 and ok.json()["dialect"] == "sqlite"
    bad = client.post("/api/sources/database", json={"type": "postgres", "host": "127.0.0.1", "port": 1,
                                                     "username": "u", "password": "p", "database": "d"}, headers=H)
    assert bad.status_code == 400 and "p@" not in bad.text


def test_api_key_enforced(tmp_path):
    svc = AskQLService(Settings(_env_file=None, askql_api_key="s3cret"), history=HistoryStore(f"sqlite:///{tmp_path / 'h2.db'}"))
    svc.llm_status = lambda: {"configured": False}
    c = TestClient(create_app(svc))
    assert c.get("/api/sources", headers=H).status_code == 401
    assert c.get("/api/sources", headers={**H, "X-API-Key": "wrong"}).status_code == 401
    assert c.get("/api/sources", headers={**H, "X-API-Key": "s3cret"}).status_code == 200
    assert c.get("/health").status_code == 200  # probes need no key


def test_rate_limit(api):
    client, llm, svc = api
    svc._session_limit.limit = 5
    llm.replies += ['{"intent":"chat","reply":"hi"}'] * 5
    h = {"X-Session-Id": "ratelimited-session-0123"}
    for _ in range(5):
        assert client.post("/api/ask", json={"question": "hi"}, headers=h).status_code == 200
    r = client.post("/api/ask", json={"question": "hi"}, headers=h)
    assert r.status_code == 429 and r.headers["Retry-After"]


def test_missing_llm_config_gives_503(settings, tmp_path):
    svc = AskQLService(settings, history=HistoryStore(f"sqlite:///{tmp_path / 'h3.db'}"))
    r = TestClient(create_app(svc)).post("/api/ask", json={"question": "hi"}, headers=H)
    assert r.status_code == 503 and "GROQ_API_KEYS" in r.json()["detail"]
