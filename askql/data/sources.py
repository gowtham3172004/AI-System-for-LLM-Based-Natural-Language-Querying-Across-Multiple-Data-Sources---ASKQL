"""Data sources: uploaded files (via DuckDB) and real databases (via SQLAlchemy)."""
from __future__ import annotations

import io
import ipaddress
import json
import logging
import re
import socket
import threading
import time
import uuid
import zipfile
from abc import ABC, abstractmethod
from pathlib import PurePath
from typing import Any

import duckdb
import pandas as pd
from sqlalchemy import create_engine, event, inspect
from sqlalchemy.engine import URL, Engine, make_url

from .guard import validate_sql
from .models import ColumnInfo, ForeignKey, QueryResult, TableInfo

log = logging.getLogger(__name__)

SUPPORTED_FILE_TYPES = (".csv", ".tsv", ".txt", ".xlsx", ".xlsm", ".json", ".parquet")
MAX_PROMPT_TABLES = 40
PREVIEW_ROWS = 200
MAX_XLSX_UNCOMPRESSED = 400 * 1024 * 1024  # zip-bomb guard
_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_$]{0,62}$")
_ISO_DT = re.compile(r"^\d{4}-\d{1,2}-\d{1,2}([ T]\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?)?(Z|[+-]\d{2}:?\d{2})?$")
_GROUPED_NUM = re.compile(r"^-?\d{1,3}(,\d{3})+(\.\d+)?$")
_PLAIN_NUM = re.compile(r"^[-+]?(0|[1-9]\d*)(\.\d+)?([eE][-+]?\d+)?$|^[-+]?0\.\d+$")  # no leading zeros: "01234" is an id


def snake(name: Any) -> str:
    s = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", str(name).strip())
    s = re.sub(r"[^0-9a-zA-Z]+", "_", s).strip("_").lower()
    return s or "col"


def _unique(names: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    out = []
    for n in names:
        if n in seen:
            seen[n] += 1
            out.append(f"{n}_{seen[n]}")
        else:
            seen[n] = 0
            out.append(n)
    return out


def _tokens(text: str) -> set[str]:
    return {t for t in re.split(r"[^a-z0-9]+", text.lower()) if len(t) > 2}


class DataSource(ABC):
    kind: str
    dialect: str

    def __init__(self, name: str):
        self.id = uuid.uuid4().hex  # unguessable
        self.name = name

    # -- schema ---------------------------------------------------------
    @abstractmethod
    def tables(self) -> list[TableInfo]: ...

    def table_names(self) -> set[str]:
        return {t.name.lower() for t in self.tables()}

    def allowed_schemas(self) -> set[str]:
        """Schema qualifiers a query may use (`schema.table`). Everything else is rejected."""
        return {"main"}

    def schema_text(self, question: str | None = None, max_chars: int = 14000, samples: bool = True) -> str:
        """Prompt-ready schema. For big schemas keep the tables most relevant to the question."""
        tables = self.tables()
        if len(tables) > MAX_PROMPT_TABLES or sum(len(t.to_prompt(samples)) for t in tables) > max_chars:
            tables = self._rank(tables, question or "")
        out, used = [], 0
        for t in tables:
            block = t.to_prompt(samples)
            if used + len(block) > max_chars and out:
                break
            out.append(block)
            used += len(block)
        return "\n\n".join(out)

    @staticmethod
    def _rank(tables: list[TableInfo], question: str) -> list[TableInfo]:
        q = _tokens(question)
        by_name = {t.name: t for t in tables}

        def score(t: TableInfo) -> int:
            name_t = _tokens(t.name.replace("_", " "))
            words = name_t | {w for c in t.columns for w in _tokens(c.name.replace("_", " "))}
            return len(q & words) * 2 + len(q & name_t) * 3

        ranked = sorted(tables, key=score, reverse=True)
        top = [t for t in ranked if score(t) > 0][:8] or ranked[:8]
        names = {t.name for t in top}
        for t in list(top):  # pull in FK neighbours so joins stay possible
            for fk in t.foreign_keys:
                if fk.ref_table in by_name and fk.ref_table not in names:
                    top.append(by_name[fk.ref_table])
                    names.add(fk.ref_table)
        return top + [t for t in ranked if t.name not in names]

    # -- execution ------------------------------------------------------
    def run_query(self, sql: str, max_rows: int, timeout: int) -> QueryResult:
        """Validate then execute. Raises UnsafeSQLError / driver errors."""
        checked = validate_sql(sql, self.dialect, self.table_names(), self.allowed_schemas())
        start = time.perf_counter()
        df, truncated = self._execute(checked.sql, max_rows, timeout)
        return QueryResult(df=df, truncated=truncated, elapsed_ms=(time.perf_counter() - start) * 1000)

    @abstractmethod
    def _execute(self, sql: str, max_rows: int, timeout: int) -> tuple[pd.DataFrame, bool]: ...

    def close(self) -> None:  # pragma: no cover - trivial
        pass

    def describe(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "kind": self.kind,
            "dialect": self.dialect,
            "tables": [
                {
                    "name": t.name,
                    "row_count": t.row_count,
                    "columns": [{"name": c.name, "type": c.type} for c in t.columns],
                }
                for t in self.tables()
            ],
        }


# ----------------------------------------------------------------------------
# Files
# ----------------------------------------------------------------------------
class FileSource(DataSource):
    """CSV / TSV / Excel / JSON / Parquet files loaded into an in-memory DuckDB.

    Several files become several tables, so questions can join across files.
    Uploaded bytes are parsed in memory and never written to disk.
    """

    kind = "files"
    dialect = "duckdb"

    def __init__(self, name: str = "Uploaded files", max_rows_per_file: int = 1_000_000,
                 memory_limit: str = "512MB"):
        super().__init__(name)
        if not re.fullmatch(r"\d{2,5}(MB|GB)", memory_limit):
            raise ValueError("memory_limit must look like '512MB' or '2GB'")
        self.max_rows = max_rows_per_file
        self._con = duckdb.connect(":memory:")
        self._con.execute(f"SET memory_limit='{memory_limit}'")
        self._con.execute("SET threads=2")
        # Defence in depth under the SQL guard: no file/network access, irreversible for this connection.
        self._con.execute("SET enable_external_access=false")
        self._lock = threading.Lock()
        self._head: dict[str, pd.DataFrame] = {}  # only a small preview is kept in Python memory
        self._counts: dict[str, int] = {}

    # -- loading --------------------------------------------------------
    def add_file(self, filename: str, content: bytes) -> list[str]:
        # Only the *extension and stem* of the client-supplied name are used (never as a path).
        ext = PurePath(str(filename).replace("\\", "/")).suffix.lower()
        if ext not in SUPPORTED_FILE_TYPES:
            raise ValueError(f"Unsupported file type {ext or '(none)'!r}. Supported: {', '.join(SUPPORTED_FILE_TYPES)}")
        stem = snake(PurePath(str(filename).replace("\\", "/")).stem)
        lim = self.max_rows
        frames: dict[str, pd.DataFrame] = {}
        try:
            if ext in (".xlsx", ".xlsm"):
                with zipfile.ZipFile(io.BytesIO(content)) as z:
                    if sum(i.file_size for i in z.infolist()) > MAX_XLSX_UNCOMPRESSED:
                        raise ValueError("Excel file expands to an unreasonable size.")
                sheets = pd.read_excel(io.BytesIO(content), sheet_name=None, nrows=lim + 1)
                for sheet, df in sheets.items():
                    if df.empty and len(df.columns) == 0:
                        continue  # blank sheet
                    frames[stem if len(sheets) == 1 else f"{stem}_{snake(sheet)}"] = df
            elif ext == ".json":
                try:
                    frames[stem] = pd.read_json(io.BytesIO(content))
                except ValueError:
                    frames[stem] = pd.read_json(io.BytesIO(content), lines=True)
            elif ext == ".parquet":
                import pyarrow.parquet as pq

                if pq.ParquetFile(io.BytesIO(content)).metadata.num_rows > lim:
                    raise ValueError(f"File has more than {lim:,} rows.")
                frames[stem] = pd.read_parquet(io.BytesIO(content))
            else:
                frames[stem] = self._read_delimited(content, "\t" if ext == ".tsv" else None, lim)
        except (zipfile.BadZipFile, pd.errors.EmptyDataError, pd.errors.ParserError) as e:
            raise ValueError(f"Could not read {filename!r}: {str(e).splitlines()[0][:150]}") from e
        if not frames:
            raise ValueError(f"{filename!r} contains no data.")
        return [self.add_dataframe(t, df) for t, df in frames.items()]

    @staticmethod
    def _read_delimited(content: bytes, sep: str | None, limit: int) -> pd.DataFrame:
        for enc in ("utf-8-sig", "latin-1"):
            try:
                head = content[:8192].decode(enc, errors="ignore")
                if sep is None:
                    first = (head.splitlines() or [""])[0]
                    counts = {d: first.count(d) for d in (",", ";", "\t", "|")}
                    sep = max(counts, key=counts.get) if max(counts.values()) else ","
                # dtype=str: pandas' own inference would turn ZIP "01234" into 1234. Types are inferred in _clean().
                return pd.read_csv(io.BytesIO(content), sep=sep, encoding=enc, nrows=limit + 1, dtype=str)
            except UnicodeDecodeError:
                continue
        raise ValueError("Could not decode the file (use UTF-8 or Latin-1).")

    def add_dataframe(self, table: str, df: pd.DataFrame) -> str:
        if len(df) > self.max_rows:
            raise ValueError(f"File has more than {self.max_rows:,} rows.")
        if len(df.columns) > 1000:
            raise ValueError("File has more than 1000 columns.")
        df = self._clean(df)
        table = snake(table)
        if table[0].isdigit():
            table = f"t_{table}"
        base, i = table, 1
        while table in self._counts:
            i += 1
            table = f"{base}_{i}"
        with self._lock:
            self._con.register("_tmp_upload", df)
            try:
                self._con.execute(f'CREATE TABLE "{table}" AS SELECT * FROM _tmp_upload')
            finally:
                self._con.unregister("_tmp_upload")
        self._head[table] = df.head(PREVIEW_ROWS)
        self._counts[table] = len(df)
        return table

    @staticmethod
    def _clean(df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df.columns = _unique([snake(c) for c in df.columns])
        df = df.dropna(how="all").dropna(axis=1, how="all")
        if df.empty:
            raise ValueError("File contains no data rows.")
        for col in df.columns:
            ser = df[col]
            if not (pd.api.types.is_object_dtype(ser) or pd.api.types.is_string_dtype(ser)):
                continue
            s = ser.dropna()
            if s.map(lambda v: isinstance(v, str)).all():
                strs = s.astype(str).str.strip()
                # ISO dates only: day/month order of "03/04/2024" is ambiguous, so it stays text.
                if strs.str.match(_ISO_DT).all():
                    parsed = pd.to_datetime(ser, errors="coerce", utc=False, format="mixed")
                    if parsed.notna().sum() == ser.notna().sum():
                        df[col] = parsed
                        continue
                low = strs.str.lower()
                if len(strs) and low.isin(["true", "false"]).all():
                    df[col] = ser.str.strip().str.lower().map({"true": True, "false": False}).astype("boolean")
                    continue
                if len(strs) and strs.str.match(_PLAIN_NUM).all():
                    df[col] = pd.to_numeric(ser.str.strip(), errors="coerce")
                    continue
                # numbers written with thousands separators ("1,200") - never touches ZIPs / ids like "01234"
                if len(strs) and strs.str.match(_GROUPED_NUM).all():
                    df[col] = pd.to_numeric(ser.str.replace(",", "", regex=False), errors="coerce")
            else:
                # mixed types (numbers + text, nested JSON) would break the DuckDB conversion
                df[col] = ser.map(
                    lambda v: v if v is None or (isinstance(v, float) and v != v) or isinstance(v, str)
                    else json.dumps(v, default=str) if isinstance(v, (dict, list)) else str(v)
                )
        return df.reset_index(drop=True)

    # -- schema ---------------------------------------------------------
    def tables(self) -> list[TableInfo]:
        out = []
        with self._lock:
            for table, head in self._head.items():
                rows = self._con.execute(f'DESCRIBE "{table}"').fetchall()
                cols = []
                for name, dtype, *_ in rows:
                    samples = head[name].dropna().drop_duplicates().head(3).tolist() if name in head else []
                    samples = [s.isoformat().removesuffix("T00:00:00") if hasattr(s, "isoformat") else s for s in samples]
                    cols.append(ColumnInfo(name=name, type=str(dtype), samples=samples))
                out.append(TableInfo(name=table, columns=cols, row_count=self._counts[table]))
        return out

    def preview(self, table: str, n: int = 20) -> pd.DataFrame:
        return self._head[table].head(n)

    def summary(self, table: str) -> pd.DataFrame:
        """Per-column statistics (min/max/mean/nulls...) computed by DuckDB over the whole table."""
        if table not in self._counts:
            raise KeyError(table)
        with self._lock:
            return self._con.execute(f'SUMMARIZE "{table}"').df()

    # -- execution ------------------------------------------------------
    def _execute(self, sql: str, max_rows: int, timeout: int) -> tuple[pd.DataFrame, bool]:
        with self._lock:
            cur = self._con.cursor()
            timer = threading.Timer(timeout, cur.interrupt)  # the cursor is its own connection: interrupt IT
            timer.start()
            try:
                cur.execute(sql)
                cols = [d[0] for d in cur.description]
                rows = cur.fetchmany(max_rows + 1)
            except duckdb.InterruptException as e:
                raise TimeoutError(f"Query exceeded {timeout}s and was cancelled.") from e
            finally:
                timer.cancel()
                cur.close()
        truncated = len(rows) > max_rows
        return pd.DataFrame(rows[:max_rows], columns=_unique(cols)), truncated

    def close(self) -> None:
        self._con.close()


# ----------------------------------------------------------------------------
# Databases
# ----------------------------------------------------------------------------
_DRIVERS = {
    "postgres": "postgresql+psycopg2",
    "postgresql": "postgresql+psycopg2",
    "mysql": "mysql+pymysql",
    "mariadb": "mysql+pymysql",
    "sqlite": "sqlite",
}
_DIALECT_OF = {"postgresql": "postgres", "mysql": "mysql", "sqlite": "sqlite"}
# URL query parameters are an escape hatch (host=/unix_socket=/sslrootcert=/read_default_file=...) so on
# public deployments only these harmless ones are accepted.
_SAFE_URL_QUERY = {"sslmode", "charset", "application_name"}


def build_url(
    db_type: str,
    host: str = "",
    port: int | None = None,
    username: str | None = None,
    password: str | None = None,
    database: str = "",
) -> str:
    """Build a SQLAlchemy URL safely (passwords with special characters are escaped)."""
    driver = _DRIVERS.get(db_type.lower())
    if not driver:
        raise ValueError(f"Unsupported database type {db_type!r}. Use: postgres, mysql, sqlite")
    return URL.create(driver, username=username or None, password=password or None,
                      host=host or None, port=port, database=database or None
                      ).render_as_string(hide_password=False)


def normalize_url(url: str) -> URL:
    url = url.strip()
    head = url.split(":", 1)[0]
    scheme = head.split("+", 1)[0].lower()
    if "+" not in head and scheme in _DRIVERS:
        url = _DRIVERS[scheme] + url[len(scheme):]
    return make_url(url)


def check_connection_policy(url: URL, allow_local: bool) -> str | None:
    """Public-deployment policy. Returns a validated IP to pin the connection to (None if unrestricted).

    Blocks SQLite files, URL-parameter tricks, and any host that resolves to a non-public address
    (loopback, RFC1918, link-local/cloud-metadata, CGNAT, ...). The caller connects to the *validated* IP,
    so DNS rebinding between this check and the connection cannot redirect it.
    """
    if allow_local:
        return None
    if url.get_backend_name() == "sqlite":
        raise PermissionError("SQLite file connections are disabled on this deployment.")
    extra = set(url.query) - _SAFE_URL_QUERY
    if extra:
        raise PermissionError(f"Connection parameter(s) not allowed: {', '.join(sorted(extra))}")
    host = url.host or ""
    if not host or host.startswith("/"):
        raise PermissionError("A public hostname is required.")
    try:
        infos = socket.getaddrinfo(host, url.port or 0, proto=socket.IPPROTO_TCP)
    except socket.gaierror as e:
        raise ConnectionError(f"Cannot resolve host {host!r}.") from e
    pinned = None
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        ip = getattr(ip, "ipv4_mapped", None) or ip
        if not ip.is_global:
            raise PermissionError("Connections to private/local network addresses are disabled on this deployment.")
        pinned = pinned or str(ip)
    return pinned


class DatabaseSource(DataSource):
    kind = "database"

    def __init__(self, url: str | URL, name: str | None = None, schema: str | None = None,
                 allow_local: bool = False, connect_timeout: int = 10, statement_timeout: int = 30):
        parsed = normalize_url(url) if isinstance(url, str) else url
        pinned_ip = check_connection_policy(parsed, allow_local)
        backend = parsed.get_backend_name()
        if backend not in _DIALECT_OF:
            raise ValueError(f"Unsupported database backend {backend!r}.")
        if schema and not _IDENT.match(schema):
            raise ValueError("Invalid schema name.")
        self.dialect = _DIALECT_OF[backend]
        super().__init__(name or f"{backend}:{parsed.database or parsed.host}")
        self.schema = schema or None
        self._database = (parsed.database or "").lower()
        self._deadline = threading.local()
        self.engine = self._make_engine(parsed, pinned_ip, connect_timeout, statement_timeout)
        try:
            with self.engine.connect() as conn:  # fail fast on bad credentials / host
                conn.exec_driver_sql("SELECT 1")
        except Exception:
            self.engine.dispose()
            raise
        self._tables_cache: list[TableInfo] | None = None

    def _make_engine(self, url: URL, pinned_ip: str | None, connect_timeout: int, statement_timeout: int) -> Engine:
        if self.dialect == "sqlite":
            engine = create_engine(url)
            deadline = self._deadline

            @event.listens_for(engine, "connect")
            def _sqlite_ro(dbapi_conn, _):  # noqa: ANN001
                dbapi_conn.execute("PRAGMA query_only = ON")
                dbapi_conn.set_progress_handler(
                    lambda: 1 if time.monotonic() > getattr(deadline, "t", float("inf")) else 0, 10000
                )

            return engine

        args: dict[str, Any] = {"connect_timeout": connect_timeout}
        if self.dialect == "postgres":
            opts = f"-c statement_timeout={statement_timeout * 1000} -c default_transaction_read_only=on"
            if self.schema:
                opts += f" -c search_path={self.schema}"  # validated against _IDENT above
            args["options"] = opts
            if pinned_ip:
                args["hostaddr"] = pinned_ip  # connect to the validated IP; `host` stays for TLS/SNI
        else:  # mysql
            args.update(read_timeout=statement_timeout, init_command="SET SESSION TRANSACTION READ ONLY")
            if pinned_ip:
                url = url.set(host=pinned_ip)
        engine = create_engine(url, connect_args=args, pool_pre_ping=True, pool_size=3, max_overflow=2,
                               pool_recycle=1800)
        if self.dialect == "mysql":

            @event.listens_for(engine, "connect")
            def _mysql_timeouts(dbapi_conn, _):  # noqa: ANN001
                cur = dbapi_conn.cursor()
                for stmt in (f"SET SESSION max_execution_time={statement_timeout * 1000}",  # MySQL
                             f"SET SESSION max_statement_time={statement_timeout}"):  # MariaDB
                    try:
                        cur.execute(stmt)
                    except Exception:  # not supported by this server flavour
                        pass
                cur.close()

        return engine

    def allowed_schemas(self) -> set[str]:
        if self.dialect == "sqlite":
            return {"main"}
        if self.dialect == "postgres":
            return {(self.schema or "public").lower()}
        return {(self.schema or self._database).lower()} - {""}

    # -- schema ---------------------------------------------------------
    def tables(self) -> list[TableInfo]:
        if self._tables_cache is None:
            self._tables_cache = self._reflect()
        return self._tables_cache

    def refresh(self) -> None:
        self._tables_cache = None

    def _reflect(self) -> list[TableInfo]:
        insp = inspect(self.engine)
        names = sorted(set(insp.get_table_names(schema=self.schema)) | set(insp.get_view_names(schema=self.schema)))
        quote = self.engine.dialect.identifier_preparer.quote
        out = []
        for t in names:
            try:
                pks = set(insp.get_pk_constraint(t, schema=self.schema).get("constrained_columns") or [])
                cols = [
                    ColumnInfo(c["name"], str(c["type"]), nullable=c.get("nullable", True), primary_key=c["name"] in pks)
                    for c in insp.get_columns(t, schema=self.schema)
                ]
                fks = [
                    ForeignKey(fk["constrained_columns"], fk["referred_table"], fk["referred_columns"])
                    for fk in insp.get_foreign_keys(t, schema=self.schema)
                ]
            except Exception as e:  # unreadable table (permissions etc.) - skip it, never authorise it
                log.warning("Skipping table %s: %s", t, type(e).__name__)
                continue
            try:
                qt = quote(t) if not self.schema else f"{quote(self.schema)}.{quote(t)}"
                with self.engine.connect() as conn:
                    res = conn.exec_driver_sql(f"SELECT * FROM {qt} LIMIT 5")
                    keys, rows = list(res.keys()), res.fetchall()
                for i, k in enumerate(keys):
                    vals = list(dict.fromkeys(r[i] for r in rows if r[i] is not None))[:3]
                    for c in cols:
                        if c.name == k:
                            c.samples = [str(v)[:40] if not isinstance(v, (int, float)) else v for v in vals]
            except Exception as e:
                log.debug("No samples for %s: %s", t, type(e).__name__)
            out.append(TableInfo(name=t, columns=cols, foreign_keys=fks))
        return out

    # -- execution ------------------------------------------------------
    def _execute(self, sql: str, max_rows: int, timeout: int) -> tuple[pd.DataFrame, bool]:
        self._deadline.t = time.monotonic() + timeout
        with self.engine.connect() as conn:
            # stream_results = server-side cursor: a runaway SELECT never loads more than max_rows+1 rows here
            res = conn.execution_options(stream_results=True).exec_driver_sql(sql)
            cols = list(res.keys())
            rows = res.fetchmany(max_rows + 1)
            res.close()
            conn.rollback()
        truncated = len(rows) > max_rows
        return pd.DataFrame([tuple(r) for r in rows[:max_rows]], columns=_unique(cols)), truncated

    def close(self) -> None:
        self.engine.dispose()
