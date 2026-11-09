import io

import pandas as pd
import pytest

from askql.data import DatabaseSource, FileSource, UnsafeSQLError, build_url
from askql.data.sources import check_connection_policy, normalize_url


def test_csv_loaded_and_cross_file_join(files_source):
    names = {t.name for t in files_source.tables()}
    assert names == {"customers", "products", "orders"}
    res = files_source.run_query(
        "SELECT c.region, COUNT(*) AS n FROM orders o JOIN customers c USING (customer_id) GROUP BY c.region ORDER BY n DESC",
        1000, 10,
    )
    assert set(res.df["region"]) <= {"North", "South", "East", "West"}
    assert res.df["n"].sum() == 1500


def test_dates_are_parsed_and_typed(files_source):
    cols = {c.name: c.type for t in files_source.tables() for c in t.columns if t.name == "orders"}
    assert "TIMESTAMP" in cols["order_date"].upper() or "DATE" in cols["order_date"].upper()
    res = files_source.run_query("SELECT strftime(order_date, '%Y-%m') m, SUM(total_amount) s FROM orders GROUP BY 1 ORDER BY 1", 1000, 10)
    assert len(res.df) > 12


def test_excel_multi_sheet_each_sheet_is_a_table():
    buf = io.BytesIO()
    with pd.ExcelWriter(buf) as xl:
        pd.DataFrame({"A b": [1, 2], "C": ["x", "y"]}).to_excel(xl, sheet_name="Sheet One", index=False)
        pd.DataFrame({"v": [3]}).to_excel(xl, sheet_name="Two", index=False)
    src = FileSource()
    assert src.add_file("Book 1.xlsx", buf.getvalue()) == ["book_1_sheet_one", "book_1_two"]
    assert src.run_query("SELECT a_b FROM book_1_sheet_one ORDER BY 1", 10, 5).df["a_b"].tolist() == [1, 2]


def test_messy_csv_numbers_with_commas_and_latin1():
    raw = "Name,Revenue\nCafé,\"1,200\"\nBar,\"3,400\"\n".encode("latin-1")
    src = FileSource()
    src.add_file("sales.csv", raw)
    assert src.run_query("SELECT SUM(revenue) s FROM sales", 10, 5).df["s"][0] == 4600


def test_unsupported_and_empty_files():
    src = FileSource()
    with pytest.raises(ValueError):
        src.add_file("x.exe", b"")
    with pytest.raises(Exception):
        src.add_file("e.csv", b"")


def test_truncation_flag(files_source):
    res = files_source.run_query("SELECT * FROM orders", 10, 5)
    assert res.truncated and len(res.df) == 10


def test_file_source_blocks_file_access_and_writes(files_source):
    for sql in ("SELECT * FROM read_csv('sample_data/orders.csv')", "DROP TABLE orders", "SELECT * FROM nope"):
        with pytest.raises(UnsafeSQLError):
            files_source.run_query(sql, 10, 5)


def test_runtime_errors_surface_for_repair(files_source):
    with pytest.raises(Exception) as e:
        files_source.run_query("SELECT not_a_column FROM orders", 10, 5)
    assert "not_a_column" in str(e.value)


def test_database_schema_has_fks_and_samples(db_source):
    orders = next(t for t in db_source.tables() if t.name == "orders")
    assert {fk.ref_table for fk in orders.foreign_keys} == {"customers", "products"}
    assert any(c.primary_key for c in orders.columns)
    assert "FK:" in db_source.schema_text()


def test_database_query_and_readonly_enforced_below_the_guard(db_source):
    res = db_source.run_query("SELECT status, COUNT(*) n FROM orders GROUP BY status", 100, 5)
    assert res.df["n"].sum() == 1500
    with pytest.raises(UnsafeSQLError):
        db_source.run_query("DELETE FROM orders", 100, 5)
    # even if the guard were bypassed the connection itself is read-only
    with pytest.raises(Exception):
        db_source._execute("DELETE FROM orders", 100, 5)
    assert db_source.run_query("SELECT COUNT(*) c FROM orders", 1, 5).df["c"][0] == 1500


def test_schema_ranking_for_large_schemas(db_source):
    text = db_source.schema_text("revenue by product category", max_chars=300)
    assert "TABLE products" in text or "TABLE orders" in text


def test_url_helpers():
    assert normalize_url("postgres://u:p@h/db").drivername == "postgresql+psycopg2"
    assert normalize_url("mysql://u:p@h/db").drivername == "mysql+pymysql"
    assert "p%40ss" in build_url("postgres", "h", 5432, "u", "p@ss", "db")


def test_public_deployment_policy_blocks_local():
    with pytest.raises(PermissionError):
        check_connection_policy(normalize_url("sqlite:///x.db"), allow_local=False)
    with pytest.raises(PermissionError):
        check_connection_policy(normalize_url("postgresql://u:p@127.0.0.1/db"), allow_local=False)
    check_connection_policy(normalize_url("sqlite:///x.db"), allow_local=True)


def test_bad_connection_fails_fast():
    with pytest.raises(Exception):
        DatabaseSource("sqlite:////definitely/not/a/dir/x.db", allow_local=True)
