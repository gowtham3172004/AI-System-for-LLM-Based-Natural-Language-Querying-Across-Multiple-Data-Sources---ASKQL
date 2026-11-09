"""Integration tests against REAL LLM providers.

Each test is skipped unless that provider's credentials are in the environment, so a skip is never a pass:
    GROQ_API_KEYS=gsk_...   GEMINI_API_KEYS=AIza...   OLLAMA_BASE_URL=http://localhost:11434
Answers are checked against pandas ground truth computed from the sample CSVs, not against the LLM's prose.
"""
import os

import pandas as pd
import pytest

from askql.agent import AskQLAgent
from askql.config import Settings
from askql.data import FileSource
from askql.llm import build_router

from conftest import ROOT

PROVIDERS = {
    "groq": dict(groq_api_keys=os.getenv("GROQ_API_KEYS", ""), llm_provider_order="groq"),
    "gemini": dict(gemini_api_keys=os.getenv("GEMINI_API_KEYS", ""), llm_provider_order="gemini"),
    "ollama": dict(ollama_base_url=os.getenv("OLLAMA_BASE_URL", ""), llm_provider_order="ollama"),
}
HAVE = {"groq": bool(os.getenv("GROQ_API_KEYS")), "gemini": bool(os.getenv("GEMINI_API_KEYS")),
        "ollama": bool(os.getenv("OLLAMA_BASE_URL"))}


@pytest.fixture(scope="module")
def shop():
    src = FileSource("shop")
    for n in ("customers.csv", "products.csv", "orders.csv"):
        src.add_file(n, (ROOT / "sample_data" / n).read_bytes())
    return src


def agent_for(**kw):
    s = Settings(_env_file=None, **kw)
    router = build_router(s)
    return AskQLAgent(router.runnable, s), router


@pytest.mark.parametrize("provider", PROVIDERS)
def test_real_llm_end_to_end_matches_pandas_truth(provider, shop):
    if not HAVE[provider]:
        pytest.skip(f"no {provider} credentials in environment - {provider} NOT tested")
    agent, _ = agent_for(**PROVIDERS[provider])
    r = agent.ask("What is the total revenue of completed orders, per region? Order by revenue descending.", shop)
    assert r.ok and r.sql and r.result is not None, r.error
    o = pd.read_csv(ROOT / "sample_data" / "orders.csv")
    c = pd.read_csv(ROOT / "sample_data" / "customers.csv")
    truth = (o[o.status == "completed"].merge(c, on="customer_id").groupby("region").total_amount.sum()
             .sort_values(ascending=False))
    df = r.result.df
    num = next(col for col in df.columns if pd.api.types.is_numeric_dtype(df[col]))
    assert [round(float(x), 1) for x in df[num]] == [round(float(x), 1) for x in truth.values]
    assert r.answer and not r.warnings, r.warnings  # prose numbers all traceable to the result


@pytest.mark.parametrize("provider", PROVIDERS)
def test_real_llm_followup_uses_prior_context(provider, shop):
    if not HAVE[provider]:
        pytest.skip(f"no {provider} credentials in environment - {provider} NOT tested")
    from askql.agent import Turn

    agent, _ = agent_for(**PROVIDERS[provider])
    first = agent.ask("How many orders are there per status?", shop)
    assert first.ok
    follow = agent.ask("and only for the Electronics category?", shop, [Turn(first.question, first.sql, first.answer)])
    assert follow.ok and "electronics" in follow.sql.lower() and "status" in follow.sql.lower()


def test_real_groq_dead_key_falls_over_to_valid_key(shop):
    keys = [k for k in os.getenv("GROQ_API_KEYS", "").split(",") if k.strip()]
    if not keys:
        pytest.skip("no groq credentials in environment - key rotation NOT tested live")
    agent, router = agent_for(groq_api_keys="gsk_" + "x" * 48 + "," + keys[0], llm_provider_order="groq")
    for _ in range(2):  # rotation order alternates which key is tried first; both orders must succeed
        assert agent.ask("How many customers are there?", shop).ok
