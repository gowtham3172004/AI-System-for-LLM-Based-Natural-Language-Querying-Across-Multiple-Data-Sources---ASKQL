"""SQL safety guard.

LLM-generated SQL is untrusted input. Before it touches a data source we parse
it with sqlglot and enforce: exactly one statement, read-only (SELECT/UNION/WITH),
no data-modifying CTEs, no file/system functions, and - when a schema is known -
only references to tables that actually exist. Sources additionally enforce
read-only transactions and timeouts at the driver level (defence in depth).
"""
from __future__ import annotations

from dataclasses import dataclass

import sqlglot
from sqlglot import exp
from sqlglot.errors import SqlglotError

DIALECTS = {
    "postgres": "postgres",
    "postgresql": "postgres",
    "mysql": "mysql",
    "sqlite": "sqlite",
    "duckdb": "duckdb",
    "mssql": "tsql",
}

_FORBIDDEN_NODES: tuple[type[exp.Expression], ...] = tuple(
    t
    for t in (
        getattr(exp, n, None)
        for n in (
            "Insert", "Update", "Delete", "Drop", "Create", "Alter", "AlterTable", "Merge",
            "TruncateTable", "Command", "Copy", "Set", "Pragma", "Use", "Grant", "Attach",
            "Detach", "LoadData", "Transaction", "Commit", "Rollback", "Into",
        )
    )
    if t is not None
)

_FORBIDDEN_FUNCS = {
    "pg_read_file", "pg_read_binary_file", "pg_ls_dir", "pg_stat_file", "lo_import", "lo_export",
    "pg_sleep", "dblink", "dblink_exec", "set_config", "pg_terminate_backend", "pg_cancel_backend",
    "load_file", "sleep", "benchmark", "load_extension", "readfile", "writefile",
    "read_csv", "read_csv_auto", "read_json", "read_json_auto", "read_parquet", "read_text",
    "read_blob", "read_ndjson", "glob", "sniff_csv", "parquet_scan", "csv_scan", "json_scan",
    "query", "query_table", "install_extension", "load", "xp_cmdshell", "openrowset", "opendatasource",
}

# Families of functions that can execute nested SQL (bypassing the table allow-list), touch the
# server's files/settings/sessions, or run extensions: blocked by prefix/suffix.
_FORBIDDEN_PREFIXES = ("pg_", "lo_", "dblink", "xp_", "sp_", "load_", "sys_", "get_lock", "release_lock")
_FORBIDDEN_SUFFIXES = ("_to_xml", "_to_xml_and_xmlschema", "_to_json_file")
_FORBIDDEN_FUNCS |= {"current_setting", "txid_current", "inet_server_addr", "inet_server_port", "query_to_xml",
                     "xpath", "ts_stat", "to_regclass", "nextval", "setval", "currval", "lastval"}

_BLOCKED_SCHEMAS = {"pg_catalog", "information_schema", "mysql", "performance_schema", "sys", "sqlite_master"}


class UnsafeSQLError(ValueError):
    """The SQL is not a single safe, read-only query."""


@dataclass
class GuardResult:
    sql: str
    tables: list[str]


def _func_name(node: exp.Expression) -> str:
    if isinstance(node, exp.Anonymous):
        return str(node.name).lower()
    try:
        return node.sql_name().lower()
    except Exception:  # pragma: no cover - defensive
        return ""


def _forbidden_func(name: str) -> bool:
    return name in _FORBIDDEN_FUNCS or name.startswith(_FORBIDDEN_PREFIXES) or name.endswith(_FORBIDDEN_SUFFIXES)


def validate_sql(
    sql: str,
    dialect: str = "duckdb",
    allowed_tables: set[str] | None = None,
    allowed_schemas: set[str] | None = None,
) -> GuardResult:
    """Return the cleaned SQL or raise UnsafeSQLError."""
    sql = (sql or "").strip().rstrip(";").strip()
    if not sql:
        raise UnsafeSQLError("Empty query.")
    d = DIALECTS.get(dialect.lower(), dialect.lower())

    try:
        statements = [s for s in sqlglot.parse(sql, read=d) if s is not None]
    except SqlglotError as e:
        raise UnsafeSQLError(f"SQL could not be parsed: {str(e).splitlines()[0]}") from e

    if len(statements) != 1:
        raise UnsafeSQLError("Only a single SQL statement is allowed.")
    tree = statements[0]

    if not isinstance(tree, (exp.Select, exp.Union, exp.Subquery, exp.With)) and not isinstance(
        tree, exp.Query
    ):
        raise UnsafeSQLError(f"Only SELECT queries are allowed (got {type(tree).__name__}).")

    cte_names = {c.alias_or_name.lower() for c in tree.find_all(exp.CTE)}
    tables: list[str] = []

    for node in tree.walk():
        if isinstance(node, _FORBIDDEN_NODES):
            raise UnsafeSQLError(f"{type(node).__name__.upper()} is not allowed - read-only queries only.")
        if isinstance(node, exp.Lock):
            raise UnsafeSQLError("Locking clauses (FOR UPDATE/SHARE) are not allowed.")
        if isinstance(node, exp.Func) and _forbidden_func(_func_name(node)):
            raise UnsafeSQLError(f"Function {_func_name(node)!r} is not allowed.")
        if isinstance(node, exp.Table):
            if isinstance(node.this, exp.Func):  # table-valued function in FROM
                if _forbidden_func(_func_name(node.this)):
                    raise UnsafeSQLError(f"Table function {_func_name(node.this)!r} is not allowed.")
                continue
            name = node.name
            schema = (node.args.get("db").name if node.args.get("db") else "").lower()
            if node.args.get("catalog"):
                raise UnsafeSQLError("Catalog-qualified table names are not allowed.")
            if schema and allowed_schemas is not None and schema not in allowed_schemas:
                raise UnsafeSQLError(f"Schema {schema!r} is not authorised. Allowed: {', '.join(sorted(allowed_schemas))}")
            if schema in _BLOCKED_SCHEMAS or name.lower() in _BLOCKED_SCHEMAS:
                raise UnsafeSQLError(f"Access to system schema {schema or name!r} is not allowed.")
            if name.lower() in cte_names and not schema:
                continue
            tables.append(name)
            if allowed_tables is not None and name.lower() not in allowed_tables:
                raise UnsafeSQLError(f"Unknown table {name!r}. Available: {', '.join(sorted(allowed_tables))}")

    return GuardResult(sql=sql, tables=tables)
