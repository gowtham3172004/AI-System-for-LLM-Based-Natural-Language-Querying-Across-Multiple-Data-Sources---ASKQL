import pytest

from askql.config import Settings
from askql.llm import LLMRouter, NoLLMConfiguredError, build_router
from askql.llm.factory import collect_candidates


def S(**kw) -> Settings:
    return Settings(_env_file=None, **kw)


def test_no_provider_configured_raises_clear_error():
    with pytest.raises(NoLLMConfiguredError):
        build_router(S())


def test_multiple_keys_all_providers_and_order():
    s = S(groq_api_keys="g1111, g2222", gemini_api_keys="m1111", ollama_base_url="http://localhost:11434",
          llm_provider_order="ollama,groq,gemini")
    labels = [c.label for c in collect_candidates(s)]
    assert labels[0].startswith("ollama:")
    assert [l.split(":")[0] for l in labels] == ["ollama", "groq", "groq", "gemini"]


def test_single_key_alias_and_dedupe():
    s = S(groq_api_key="same", groq_api_keys="same,other")
    assert s.groq_keys == ["same", "other"]


def test_labels_never_leak_keys():
    s = S(groq_api_keys="gsk_supersecret1234", gemini_api_key="AIzaSecretKey9876")
    joined = " ".join(c.label for c in collect_candidates(s))
    assert "supersecret" not in joined and "SecretKey" not in joined
    assert "1234" not in joined and "9876" not in joined  # not even a key suffix


def test_unconfigured_provider_in_order_is_skipped():
    labels = [c.label for c in collect_candidates(S(groq_api_key="k1234", llm_provider_order="gemini,ollama,groq"))]
    assert len(labels) == 1 and labels[0].startswith("groq")


def test_keys_rotate_round_robin_and_fall_back():
    s = S(groq_api_keys="a1111,b2222,c3333", gemini_api_key="g9999")
    router = build_router(s)
    firsts = [router._order()[0] for _ in range(6)]
    assert firsts == [0, 1, 2, 0, 1, 2]
    order = router._order()
    assert order[-1] == 3  # gemini is always the last resort
    runnable = router.runnable()
    assert len(runnable.fallbacks) == 2  # bounded: 2 tries per provider -> 2nd groq key + gemini


def test_dead_key_fails_over_to_next_provider():
    from langchain_core.messages import AIMessage
    from langchain_core.runnables import RunnableLambda

    from askql.llm.factory import Candidate

    def dead(_):
        raise RuntimeError("429 rate limited")

    router = LLMRouter([
        Candidate("groq", "groq:k1", lambda: RunnableLambda(dead)),
        Candidate("groq", "groq:k2", lambda: RunnableLambda(dead)),
        Candidate("gemini", "gemini:k3", lambda: RunnableLambda(lambda _: AIMessage(content="from gemini"))),
    ])
    for _ in range(3):  # whichever groq key is rotated first, the answer still arrives
        assert router.runnable().invoke("hi").content == "from gemini"


def test_failures_are_classified_safely_and_collected_per_request():
    from langchain_core.messages import AIMessage
    from langchain_core.runnables import RunnableLambda

    from askql.llm.diagnostics import FAILURES, classify_error
    from askql.llm.factory import Candidate

    def retired(_):
        raise RuntimeError("404 NOT_FOUND: models/gemini-2.0-flash is no longer available gsk_SECRETSECRETSECRET1234")

    def badkey(_):
        raise RuntimeError("401 Invalid API Key")

    router = LLMRouter([
        Candidate("groq", "groq:m (key 1)", lambda: RunnableLambda(badkey)),
        Candidate("gemini", "gemini:m (key 1)", lambda: RunnableLambda(retired)),
        Candidate("ollama", "ollama:m", lambda: RunnableLambda(lambda _: AIMessage(content="ok"))),
    ])
    sink = []
    token = FAILURES.set(sink)
    try:
        assert router.runnable().invoke("hi").content == "ok"
    finally:
        FAILURES.reset(token)
    assert sink == ["groq:m (key 1): API key rejected (invalid, revoked or lacking access)",
                    "gemini:m (key 1): model not available - change GEMINI_MODEL in your settings"]
    assert "SECRET" not in " ".join(sink)
    assert "rate-limited" in classify_error(RuntimeError("429 quota"), "groq")
    assert "ollama serve" in classify_error(ConnectionError("Connection refused"), "ollama")


def test_check_pings_every_endpoint_and_reports_reasons():
    from langchain_core.messages import AIMessage
    from langchain_core.runnables import RunnableLambda

    from askql.llm.factory import Candidate

    def down(_):
        raise RuntimeError("429 rate limit")

    router = LLMRouter([Candidate("groq", "g1", lambda: RunnableLambda(down)),
                        Candidate("gemini", "m1", lambda: RunnableLambda(lambda _: AIMessage(content="OK")))])
    res = router.check()
    assert [r["ok"] for r in res] == [False, True] and "rate-limited" in res[0]["detail"]
