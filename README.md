# 🔎 AskQL — Ask your data in plain English

![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-agent-1C3C3C)
![FastAPI](https://img.shields.io/badge/FastAPI-REST%20API-009688?logo=fastapi&logoColor=white)
![Streamlit](https://img.shields.io/badge/Streamlit-UI-FF4B4B?logo=streamlit&logoColor=white)
![DuckDB](https://img.shields.io/badge/DuckDB-files-FFF000?logo=duckdb&logoColor=black)

AskQL turns natural-language questions into **validated, read-only SQL**, runs it against **real data**
(CSV, TSV, Excel, JSON, Parquet, PostgreSQL, MySQL, SQLite) and returns an answer with a chart, insights and
follow-up suggestions. The answer is written from the actual result rows, and any figure in it that can't be traced
back to the result table is flagged.

[REST API](#rest-api) · [Deploy for free](#deploy-for-free) · [What has been verified](#verification-status)

## How it works

```
 Streamlit UI ─┐                        ┌─ FileSource ── DuckDB (CSV/TSV/Excel/JSON/Parquet)
               ├─► AskQLService ─► Agent┤
 FastAPI  ─────┘     │             │    └─ DatabaseSource ── SQLAlchemy (Postgres/MySQL/SQLite)
                     │             ▼
              HistoryStore   LangGraph:  generate ─► [SQL guard] ─► execute ─► analyze ─► [grounding check]
                                            ▲                          │
                                            └──── repair (DB error) ◄──┘     (bounded: MAX_REPAIR_ATTEMPTS)
                                   LLMRouter: Groq keys ─► Gemini keys ─► Ollama   (rotate + fail over)
```

1. **Schema retrieval** – tables, columns, types, primary/foreign keys and sample values (large schemas are trimmed to
   the tables relevant to the question plus their FK neighbours).
2. **SQL generation** – one LLM call returns JSON (`sql` or a chat reply). Follow-ups see the previous SQL.
3. **SQL guard** – parsed with sqlglot; must be one read-only statement over known tables (details below).
4. **Execution** – real database / DuckDB, with read-only sessions, timeouts and a row cap. On error the *real* error
   is fed back to the model for a bounded number of repairs.
5. **Analysis** – the model summarises the real rows; markdown images/links/HTML are stripped from its output and every
   number in the answer is checked against the result.

## Configure LLMs (`.env`)

```env
LLM_PROVIDER_ORDER=groq,gemini,ollama     # priority order; later ones are fallbacks
GROQ_API_KEYS=gsk_aaa,gsk_bbb             # any number; rotated round-robin
GEMINI_API_KEYS=AIza...,AIza...
GEMINI_MODEL=gemini-flash-latest          # Google retires model names; this alias keeps tracking the current Flash
OLLAMA_BASE_URL=http://localhost:11434    # empty = disabled
```

Keys within a provider rotate per request; a failing key (rate limit, quota, invalid, outage) falls through to the next
key and then the next provider. At most `LLM_TRIES_PER_PROVIDER` (default 2) keys per provider are tried per request
so many keys can't cause minutes of latency. Keys live only in environment variables, are never shown in the UI, and
are scrubbed from logs and error messages. Full reference: [`.env.example`](.env.example).

**Something not answering?** Click **Test connections** in the sidebar. It pings every configured model and tells you,
in safe terms, whether a key is rejected, a model name has been retired (set `GEMINI_MODEL` / `GROQ_MODEL`), a quota is
exhausted, or Ollama is unreachable. The same check is available at `GET /api/llm/check`. When every model fails during a
question, the chat shows the same per-model reasons.

## Quick start

```bash
git clone https://github.com/gowtham3172004/AI-System-for-LLM-Based-Natural-Language-Querying-Across-Multiple-Data-Sources---ASKQL.git
cd AI-System-for-LLM-Based-Natural-Language-Querying-Across-Multiple-Data-Sources---ASKQL
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # add at least one provider
streamlit run app/streamlit_app.py                     # click "Demo data" in the sidebar
```

For local databases (localhost Postgres/MySQL or SQLite files) set `ALLOW_LOCAL_DATABASES=true` in your `.env`.
It is **`false` by default** because on a public server it would let visitors reach the server's files and internal network.

## Security model

| Threat | Mitigation |
|---|---|
| LLM writes destructive / escaping SQL | sqlglot guard: single `SELECT`/`WITH` only; no DML/DDL/`SET`/`COPY`/`INTO`/locking; blocks file, system and nested-SQL functions (`pg_*`, `lo_*`, `query_to_xml`, `read_csv`, `load_file`, `sleep`…); only tables that exist in the reflected schema; only the connected schema qualifier; no catalogs, no system schemas |
| Guard bypass | Defence in depth: Postgres/MySQL sessions are read-only at the server, SQLite `query_only`, DuckDB `enable_external_access=false` (irreversible); statement timeouts on every engine; rows streamed and capped |
| SSRF via "connect database" | On public deployments: SQLite and URL parameters (`host=`, `unix_socket=`, `sslrootcert=`…) rejected; host must resolve only to **public** IPs; the connection is pinned to the validated IP (DNS-rebinding safe) |
| Malicious uploads | extension allow-list; size, file-count, row and column caps; xlsx zip-bomb check; parsed in memory, filename never used as a path; DuckDB memory limit |
| Prompt injection from data → exfiltration | markdown images, link targets, reference definitions and raw HTML are stripped from all LLM text before display |
| Fabricated numbers | numbers in the summary are matched against result cells/statistics; unmatched ones raise a visible warning |
| Quota abuse | per-session, per-client-IP and global rate limits; question length cap; API key option |
| Session mix-up | REST API requires an unguessable `X-Session-Id` (16-64 random chars); source IDs are 128-bit; sources/history are scoped to the session |
| Secret leakage | keys only in env; labels never contain key fragments; `/health` reveals nothing; settings `repr` hides secrets; logs/errors redacted (keys, `scheme://user:pass@`) |

**Still your responsibility:** connect with a **least-privilege, read-only database user**; AskQL's read-only enforcement
is a second layer, not a replacement. With `LLM_SEND_DATA=true` (default) the schema, sample values and up to 20 result
rows go to your LLM provider — set `LLM_SEND_DATA=false` or use Ollama for sensitive data.

## REST API

```bash
uvicorn askql.api.app:app --proxy-headers          # docs at http://localhost:8000/docs
SID=$(python -c "import uuid;print(uuid.uuid4())")  # your session id: keep it secret, it scopes your sources
curl -X POST localhost:8000/api/sources/files -H "X-Session-Id: $SID" -F files=@sample_data/orders.csv -F files=@sample_data/customers.csv
curl -X POST localhost:8000/api/ask -H "X-Session-Id: $SID" -H "Content-Type: application/json" \
     -d '{"source_id": "<id from above>", "question": "Top 5 customers by revenue"}'
```

Endpoints: `GET /health` · `POST /api/sources/files` · `POST /api/sources/database` · `GET/DELETE /api/sources` ·
`POST /api/ask` · `GET/DELETE /api/history`. Set `ASKQL_API_KEY` to require `X-API-Key` (health stays open for probes).

## Deploy for free

> **Always** keep `ALLOW_LOCAL_DATABASES=false` on a public deployment (the Dockerfile pins it), set at least one LLM key,
> and keep the rate-limit defaults. A public demo without `ASKQL_API_KEY` lets anyone spend your free-tier quota (bounded
> by the rate limits).

**A — Streamlit Community Cloud** (no Docker): push to GitHub → [share.streamlit.io](https://share.streamlit.io) → *New app* →
file `app/streamlit_app.py` → *Advanced → Secrets*: paste `.streamlit/secrets.toml.example` with your keys (top-level
string values only; they are bridged to environment variables). Choose Python 3.11 or 3.12.

**B — Hugging Face Spaces (Docker)**: create a Space with SDK *Docker*, push this repo, and put this front-matter at the top
of the *Space's* `README.md`:
```yaml
---
title: AskQL
sdk: docker
app_port: 7860
---
```
Add `GROQ_API_KEYS` / `GEMINI_API_KEYS` under *Settings → Variables and secrets*.

**C — Render**: *New → Blueprint* → select the repo (`render.yaml`). Free instances sleep when idle and have an ephemeral
disk; set `HISTORY_DB_URL` to a free [Neon](https://neon.tech)/Supabase Postgres to keep history. For the REST API set `APP=api`.

**Local Docker**: `docker compose up` → UI `:8501`, API `:8000`; `--profile ollama` adds a local Ollama.

## Development & testing

```bash
pip install -r requirements-dev.txt
pytest -q                                   # unit + security + API + UI tests (no network, no keys needed)

# real-database integration tests (skipped - not passed - when the variables are absent)
TEST_POSTGRES_URL=postgresql://postgres:pw@127.0.0.1:5432/shop \
TEST_MYSQL_URL=mysql://root:pw@127.0.0.1:3306/shop pytest tests/test_integration_db.py

# real-LLM integration tests (each provider is skipped unless its credentials are set)
GROQ_API_KEYS=... GEMINI_API_KEYS=... OLLAMA_BASE_URL=... pytest tests/test_integration_llm.py
```

CI runs the suite on Python 3.11 and 3.12 with Postgres 16 and MySQL 8.4 service containers, and builds the Docker image.

## The UI

Landing page with a one-click demo dataset and upload/database connectors · schema-derived starter questions · answers as
card + KPI tiles + **Chart / Table / SQL** tabs · CSV download · follow-up chips · relationship diagram and column
statistics in *Explore data* · searchable *History* with "Ask again" · responsive down to phone width.

```bash
# explore the real UI without API keys (stand-in model, real SQL/DuckDB/guard); dev tool only
streamlit run scripts/ui_preview.py
pip install playwright && playwright install chromium && python scripts/ui_shots.py   # browser walkthrough + screenshots
```

## Verification status

See [`docs/VERIFICATION.md`](docs/VERIFICATION.md) for exactly what was run, against what, and what was **not** tested.

## Known limitations

- No user accounts; history and sources are scoped to a browser session (UI) or `X-Session-Id` (API).
- Sources live in memory (2 h idle expiry, 3 per session, 20 per process); a free host restart drops them.
- Only SELECT-style analytics. Very large databases rely on schema trimming; there is no vector retrieval.
- Date strings other than ISO (`YYYY-MM-DD`) stay text rather than being guessed (day/month order is ambiguous).
- `.xls` (legacy Excel) is not supported — save as `.xlsx`.
- The grounding check flags numbers it cannot match (e.g. a percentage the model computed itself); it is a warning, not proof of correctness.
- Database connections to public hosts can use any port; restrict at the network level if that matters.

## License

[MIT](LICENSE)
