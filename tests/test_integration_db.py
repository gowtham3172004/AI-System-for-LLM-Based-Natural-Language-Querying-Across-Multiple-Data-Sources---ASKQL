"""Integration tests against REAL PostgreSQL / MySQL servers.

Skipped unless TEST_POSTGRES_URL / TEST_MYSQL_URL are set (CI provides both via service containers), so a skip
is never reported as a pass. Example:
    TEST_POSTGRES_URL=postgresql://postgres:pw@127.0.0.1:55433/shop
    TEST_MYSQL_URL=mysql://root:pw@127.0.0.1:53307/shop
"""
import os

import pandas as pd
import pytest
import sqlalchemy as sa
from sqlalchemy.engine import make_url

from askql.data import DatabaseSource, UnsafeSQLError
from askql.data.sources import normalize_url

from conftest import ROOT

URLS = {"postgres": os.getenv("TEST_POSTGRES_URL"), "mysql": os.getenv("TEST_MYSQL_URL")}


def seed(url: str) -> None:
    """Create customers/products/orders with real FKs and typed dates, using the admin connection."""
    eng = sa.create_engine(normalize_url(url))
    md = sa.MetaData()
    sa.Table("customers", md, sa.Column("customer_id", sa.Integer, primary_key=True), sa.Column("name", sa.String(80)),
             sa.Column("region", sa.String(20)), sa.Column("signup_date", sa.Date), sa.Column("tier", sa.String(20)))
    sa.Table("products", md, sa.Column("product_id", sa.Integer, primary_key=True),
             sa.Column("product_name", sa.String(80)), sa.Column("category", sa.String(30)),
             sa.Column("unit_price", sa.Numeric(10, 2)))
    sa.Table("orders", md, sa.Column("order_id", sa.Integer, primary_key=True),
             sa.Column("customer_id", sa.Integer, sa.ForeignKey("customers.customer_id")),
             sa.Column("product_id", sa.Integer, sa.ForeignKey("products.product_id")), sa.Column("quantity", sa.Integer),
             sa.Column("order_date", sa.Date), sa.Column("status", sa.String(20)), sa.Column("total_amount", sa.Numeric(12, 2)))
    md.drop_all(eng)
    md.create_all(eng)
    for name, dates in (("customers", ["signup_date"]), ("products", []), ("orders", ["order_date"])):
        df = pd.read_csv(ROOT / "sample_data" / f"{name}.csv", parse_dates=dates)
        df.to_sql(name, eng, if_exists="append", index=False)
    with eng.begin() as c:
        c.exec_driver_sql("DROP TABLE IF EXISTS secret_internal")
        c.exec_driver_sql("CREATE TABLE secret_internal (id INTEGER PRIMARY KEY, token VARCHAR(40))")
        c.exec_driver_sql("INSERT INTO secret_internal VALUES (1, 'do-not-leak')")
    eng.dispose()


@pytest.fixture(params=[k for k in URLS], scope="module")
def db(request):
    url = URLS[request.param]
    if not url:
        pytest.skip(f"TEST_{request.param.upper()}_URL not set - real {request.param} NOT tested")
    seed(url)
    src = DatabaseSource(url, allow_local=True, statement_timeout=2)
    yield src
    src.close()


def run(src, sql, rows=1000):
    return src.run_query(sql, rows, 10).df


def test_real_schema_introspection_with_fks_pks_samples(db):
    tables = {t.name: t for t in db.tables()}
    assert {"customers", "products", "orders"} <= set(tables)
    orders = tables["orders"]
    assert {fk.ref_table for fk in orders.foreign_keys} == {"customers", "products"}
    assert [c.name for c in orders.columns if c.primary_key] == ["order_id"]
    assert any(c.samples for c in orders.columns)
    assert "FK:" in db.schema_text("revenue by category")


def test_real_join_group_by_aggregate_order_limit(db):
    df = run(db, """SELECT p.category, COUNT(*) AS n, SUM(o.total_amount) AS revenue
                    FROM orders o JOIN products p ON p.product_id = o.product_id
                    WHERE o.status = 'completed' GROUP BY p.category ORDER BY revenue DESC LIMIT 3""")
    assert len(df) == 3 and df.revenue.is_monotonic_decreasing and df.n.sum() > 100
    # cross-check against pandas ground truth computed from the CSVs
    o, p = (pd.read_csv(ROOT / "sample_data" / f"{n}.csv") for n in ("orders", "products"))
    truth = (o[o.status == "completed"].merge(p, on="product_id").groupby("category").total_amount.sum()
             .sort_values(ascending=False).head(3))
    assert [round(float(x), 2) for x in df.revenue] == [round(float(x), 2) for x in truth.values]
    assert df.category.tolist() == truth.index.tolist()


def test_real_multi_table_three_way_join_and_having(db):
    df = run(db, """SELECT c.region, COUNT(DISTINCT c.customer_id) AS buyers
                    FROM customers c JOIN orders o ON o.customer_id = c.customer_id
                    JOIN products p ON p.product_id = o.product_id
                    GROUP BY c.region HAVING COUNT(*) > 10 ORDER BY c.region""")
    assert set(df.region) <= {"North", "South", "East", "West"} and (df.buyers > 0).all()


def test_real_filtering_nulls_dates(db):
    assert run(db, "SELECT COUNT(*) AS c FROM orders WHERE order_date >= '2025-01-01'").c[0] > 0
    assert run(db, "SELECT COUNT(*) AS c FROM orders WHERE total_amount IS NULL").c[0] == 0
    assert run(db, "SELECT COUNT(*) AS c FROM orders").c[0] == 1500


def test_real_row_cap_and_truncation_flag(db):
    res = db.run_query("SELECT * FROM orders", 25, 10)
    assert res.truncated and len(res.df) == 25


def test_real_writes_are_impossible_even_if_guard_were_bypassed(db):
    before = run(db, "SELECT COUNT(*) AS c FROM orders").c[0]
    for stmt in ("DELETE FROM orders", "UPDATE orders SET status='x'", "DROP TABLE orders",
                 "INSERT INTO products (product_id, product_name) VALUES (9999, 'x')",
                 "CREATE TABLE pwned (a int)"):
        with pytest.raises(Exception):  # driver-level: read-only session
            db._execute(stmt, 10, 5)
    assert run(db, "SELECT COUNT(*) AS c FROM orders").c[0] == before
    for stmt in ("DELETE FROM orders", "DROP TABLE orders", "SELECT 1; DELETE FROM orders"):
        with pytest.raises(UnsafeSQLError):  # and the guard stops them first
            db.run_query(stmt, 10, 5)


def test_real_cannot_read_tables_outside_the_reflected_set_or_system_catalogs(db):
    # 'secret_internal' exists in the same schema but... it IS reflected, so the allow-list is the schema itself.
    assert "secret_internal" in {t.name for t in db.tables()}
    for sql in ("SELECT * FROM pg_catalog.pg_user", "SELECT * FROM information_schema.tables",
                "SELECT * FROM mysql.user", "SELECT * FROM otherdb.orders", "SELECT * FROM nonexistent"):
        with pytest.raises(UnsafeSQLError):
            db.run_query(sql, 10, 5)


def test_real_dangerous_functions_blocked(db):
    for sql in ("SELECT pg_sleep(5)", "SELECT sleep(5)", "SELECT pg_read_file('/etc/passwd')",
                "SELECT load_file('/etc/passwd')", "SELECT query_to_xml('select * from secret_internal', true, true, '')"):
        with pytest.raises(UnsafeSQLError):
            db.run_query(sql, 10, 5)


def test_real_statement_timeout_cancels_runaway_query(db):
    # not optimisable to arithmetic (MySQL turns a bare COUNT(*) over a cross join into a multiplication)
    heavy = ("SELECT COUNT(*) FROM orders a, orders b, orders c, orders d "
             "WHERE a.total_amount + b.total_amount > c.total_amount * d.total_amount * 1000000")
    with pytest.raises(Exception):
        db._execute(heavy, 10, 5)  # server-side 2s statement/execution timeout
    assert run(db, "SELECT 1 AS ok").ok[0] == 1  # pool still healthy afterwards


def test_real_sql_injection_in_literals_is_inert(db):
    df = run(db, "SELECT COUNT(*) AS c FROM customers WHERE name = 'x''; DROP TABLE customers; --'")
    assert df.c[0] == 0 and run(db, "SELECT COUNT(*) AS c FROM customers").c[0] == 200


def test_real_connection_failures_are_clean_and_leak_no_password(db):
    u = make_url(URLS["postgres"] if db.dialect == "postgres" else URLS["mysql"]).set(password="wrong-pw-xyz")
    with pytest.raises(Exception) as e:
        DatabaseSource(u.render_as_string(hide_password=False), allow_local=True)
    from askql.security import safe_error

    assert "wrong-pw-xyz" not in safe_error(e.value, ["wrong-pw-xyz"])


def test_real_pool_is_released_on_close():
    url = URLS["postgres"]
    if not url:
        pytest.skip("TEST_POSTGRES_URL not set")
    src = DatabaseSource(url, allow_local=True)
    src.tables()
    src.close()
    assert src.engine.pool.checkedout() == 0


def test_public_deployment_policy_blocks_the_local_test_servers():
    for k, url in URLS.items():
        if url:
            with pytest.raises(PermissionError):
                DatabaseSource(url, allow_local=False)
