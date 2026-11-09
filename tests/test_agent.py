from askql.agent import Turn
from askql.agent.schemas import extract_json

ANALYSIS = {
    "answer": "North leads.",
    "insights": ["a", "b", "c", "d"],
    "chart": {"type": "bar", "x": "region", "y": "n", "title": "Orders"},
    "followups": ["more?"],
}


def plan(sql, **kw):
    return {"intent": "sql", "sql": sql, **kw}


def test_happy_path_runs_real_sql_and_analyses(make_agent, files_source):
    agent, llm = make_agent([
        plan("SELECT c.region, COUNT(*) AS n FROM orders o JOIN customers c USING (customer_id) GROUP BY 1 ORDER BY 2 DESC"),
        ANALYSIS,
    ])
    steps = []
    r = agent.ask("orders by region", files_source, on_step=steps.append)
    assert r.ok and r.intent == "sql" and r.attempts == 1
    assert r.result.row_count == 4 and r.result.df["n"].sum() == 1500
    assert r.answer == "North leads." and len(r.insights) == 3
    assert r.chart.type == "bar"
    assert steps and "Running the query..." in steps
    # the schema (with sample values) and the real result both reached the model
    assert "TABLE orders" in llm.calls[0] and "region" in llm.calls[1]


def test_self_repair_loop_feeds_error_back(make_agent, files_source):
    agent, llm = make_agent([
        plan("SELECT regoin FROM customers"),
        plan("SELECT region FROM customers LIMIT 3"),
        ANALYSIS,
    ])
    r = agent.ask("show regions", files_source)
    assert r.ok and r.attempts == 2 and r.result.row_count == 3
    assert "previous SQL failed" in llm.calls[1] and "regoin" in llm.calls[1]


def test_unsafe_sql_is_rejected_and_model_gets_to_retry(make_agent, files_source):
    agent, llm = make_agent([plan("DELETE FROM orders"), plan("SELECT COUNT(*) AS c FROM orders"), ANALYSIS])
    r = agent.ask("clear the orders", files_source)
    assert r.ok and "safety check" in llm.calls[1]
    assert files_source.run_query("SELECT COUNT(*) c FROM orders", 1, 5).df["c"][0] == 1500


def test_gives_up_after_repair_budget(make_agent, files_source):
    agent, llm = make_agent([plan("SELECT x FROM orders")] * 3)
    r = agent.ask("broken", files_source)
    assert not r.ok and r.attempts == 3 and r.result is None
    assert "couldn't produce a working query" in r.error and r.sql == "SELECT x FROM orders"


def test_chat_intent_skips_execution(make_agent, files_source):
    agent, llm = make_agent([{"intent": "chat", "reply": "Hi! Ask me about orders."}])
    r = agent.ask("hello", files_source)
    assert r.ok and r.intent == "chat" and r.sql is None and "Hi!" in r.answer and len(llm.calls) == 1


def test_no_data_source_never_runs_sql(make_agent):
    agent, _ = make_agent([plan("SELECT 1")])
    r = agent.ask("count rows", None)
    assert r.intent == "chat" and "upload" in r.answer.lower()


def test_analysis_failure_keeps_real_results(make_agent, files_source):
    agent, _ = make_agent([plan("SELECT COUNT(*) AS n FROM orders"), "sorry, I cannot help", "still not json"])
    r = agent.ask("how many orders", files_source)
    assert r.ok and r.result.row_count == 1 and "1 row" in r.answer


def test_invalid_chart_columns_are_dropped(make_agent, files_source):
    bad = {**ANALYSIS, "chart": {"type": "bar", "x": "nope", "y": "n"}}
    agent, _ = make_agent([plan("SELECT region, COUNT(*) AS n FROM customers GROUP BY 1"), bad])
    assert agent.ask("q", files_source).chart.type == "none"


def test_followup_context_is_sent(make_agent, files_source):
    agent, llm = make_agent([plan("SELECT 1 AS x"), ANALYSIS])
    agent.ask("and for the west?", files_source, [Turn("orders by region", "SELECT region FROM customers", "ok")])
    assert "orders by region" in llm.calls[0] and "SELECT region FROM customers" in llm.calls[0]


def test_privacy_mode_hides_data_from_llm(make_agent, files_source, settings):
    settings.llm_send_data = False
    agent, llm = make_agent([plan("SELECT region FROM customers LIMIT 2"), ANALYSIS])
    agent.ask("q", files_source)
    assert "e.g." not in llm.calls[0] and "hidden" in llm.calls[1]


def test_works_on_real_database(make_agent, db_source):
    agent, _ = make_agent([plan("SELECT status, COUNT(*) AS n FROM orders GROUP BY status"), ANALYSIS])
    r = agent.ask("orders per status", db_source)
    assert r.ok and r.result.df["n"].sum() == 1500


def test_json_extraction_tolerates_chatter_and_fences():
    assert extract_json('Sure!\n```json\n{"a": {"b": "}"}}\n```\nbye') == {"a": {"b": "}"}}
    assert extract_json('prefix {"x": 1} suffix') == {"x": 1}
