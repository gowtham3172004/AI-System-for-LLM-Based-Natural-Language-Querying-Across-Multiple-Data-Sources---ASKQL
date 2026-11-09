import pytest

from askql.data import UnsafeSQLError, validate_sql

TABLES = {"orders", "customers"}


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT * FROM orders",
        "select region, count(*) from customers group by region order by 2 desc limit 5",
        "WITH t AS (SELECT customer_id, sum(total_amount) s FROM orders GROUP BY 1) SELECT * FROM t JOIN customers USING (customer_id)",
        "SELECT a FROM orders UNION ALL SELECT a FROM customers",
        "SELECT * FROM orders;",
        "SELECT 'drop table x; --' AS note FROM orders",
        "SELECT * FROM public.orders",
    ],
)
def test_allows_read_only(sql):
    assert validate_sql(sql, "postgres", TABLES).sql


@pytest.mark.parametrize(
    "sql",
    [
        "DROP TABLE orders",
        "DELETE FROM orders",
        "UPDATE orders SET status='x'",
        "INSERT INTO orders VALUES (1)",
        "SELECT 1; DROP TABLE orders",
        "CREATE TABLE x AS SELECT * FROM orders",
        "ALTER TABLE orders ADD COLUMN x int",
        "TRUNCATE orders",
        "SELECT * INTO backup FROM orders",
        "SELECT * FROM orders FOR UPDATE",
        "WITH d AS (DELETE FROM orders RETURNING *) SELECT * FROM d",
        "SELECT pg_read_file('/etc/passwd')",
        "SELECT * FROM read_csv('/etc/passwd')",
        "SELECT * FROM pg_catalog.pg_user",
        "SELECT * FROM information_schema.tables",
        "SELECT * FROM secrets",
        "COPY orders TO '/tmp/x'",
        "PRAGMA table_info(orders)",
        "",
        "SELEC nonsense ((",
    ],
)
def test_blocks_unsafe(sql):
    with pytest.raises(UnsafeSQLError):
        validate_sql(sql, "postgres", TABLES)


def test_duckdb_file_functions_blocked():
    with pytest.raises(UnsafeSQLError):
        validate_sql("SELECT * FROM read_parquet('x.parquet')", "duckdb", TABLES)
    with pytest.raises(UnsafeSQLError):
        validate_sql("SELECT * FROM 'file.csv'", "duckdb", TABLES)


def test_cte_names_are_not_unknown_tables():
    assert validate_sql("WITH x AS (SELECT 1 a) SELECT * FROM x", "duckdb", TABLES).tables == []
