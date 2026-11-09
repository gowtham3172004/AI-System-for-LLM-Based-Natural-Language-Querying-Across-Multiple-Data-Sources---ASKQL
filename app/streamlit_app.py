"""AskQL web UI (Streamlit). Run with: streamlit run app/streamlit_app.py"""
from __future__ import annotations

import atexit
import os
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "app"))

import pandas as pd  # noqa: E402
import streamlit as st  # noqa: E402

# Streamlit Community Cloud / HF Spaces keep config in st.secrets - bridge it to env vars
# *before* settings are loaded, so one config mechanism (.env / env vars) serves every host.
try:
    for _k, _v in st.secrets.items():
        if isinstance(_v, (str, int, float, bool)):
            os.environ.setdefault(str(_k).upper(), str(_v))
except Exception:  # no secrets file locally
    pass

import ui  # noqa: E402
from askql.agent import Turn  # noqa: E402
from askql.config import get_settings  # noqa: E402
from askql.data import FileSource, build_url  # noqa: E402
from askql.llm import NoLLMConfiguredError  # noqa: E402
from askql.security import RateLimitError, safe_error  # noqa: E402
from askql.service import AskQLService  # noqa: E402
from askql.viz import auto_chart, build_figure  # noqa: E402

st.set_page_config(page_title="AskQL - Ask your data", page_icon="🔎", layout="wide", initial_sidebar_state="expanded")
ui.inject_css()


@st.cache_resource(show_spinner=False)
def get_service() -> AskQLService:
    service = AskQLService(get_settings())
    atexit.register(service.close_all)
    return service


svc = get_service()
S = get_settings()

ss = st.session_state
ss.setdefault("sid", uuid.uuid4().hex)
ss.setdefault("messages", [])
ss.setdefault("active", None)  # source id
ss.setdefault("pending", None)
ss.setdefault("llm_check", None)

NAV = ["💬 Ask", "🔎 Explore data", "🕑 History"]
FILE_TYPES = ["csv", "tsv", "xlsx", "xlsm", "json", "parquet"]


def active_source():
    return svc.get_source(ss.active, ss.sid) if ss.active else None


def activate(src) -> None:
    ss.active, ss.messages = src.id, []
    st.rerun()


def load_demo() -> None:
    files = [(p.name, p.read_bytes()) for p in sorted((ROOT / "sample_data").glob("*.csv"))]
    activate(svc.create_file_source(ss.sid, files, name="Demo shop"))


# --------------------------------------------------------------------------- connectors
def connectors(prefix: str) -> None:
    """Upload-files / connect-database widgets. Used on the landing page and in the sidebar."""
    tab_f, tab_d = st.tabs(["📁 Upload files", "🗄️ Database"])

    with tab_f:
        uploads = st.file_uploader(
            "Drop CSV, Excel, JSON or Parquet files", type=FILE_TYPES, accept_multiple_files=True, key=f"{prefix}_up",
            help="Several files become several tables - ask questions that join them. "
                 f"Up to {S.max_upload_mb} MB total.",
        )
        if st.button("Load files", key=f"{prefix}_load", disabled=not uploads, type="primary", width="stretch"):
            try:
                with st.spinner("Reading files..."):
                    src = svc.create_file_source(ss.sid, [(f.name, f.getvalue()) for f in uploads])
                activate(src)
            except Exception as e:
                st.error(f"Could not load files: {safe_error(e)}")

    with tab_d:
        types = ["postgres", "mysql"] + (["sqlite"] if S.allow_local_databases else [])
        db_type = st.selectbox("Database type", types, key=f"{prefix}_dbtype")
        use_url = st.toggle("Use a connection URL", value=False, key=f"{prefix}_useurl")
        host = username = password = database = url = ""
        port = 0
        with st.form(f"{prefix}_dbform", border=False):
            if use_url:
                url = st.text_input("Connection URL", placeholder="postgresql://user:pass@host:5432/dbname", type="password")
            elif db_type == "sqlite":
                database = st.text_input("Database file path", placeholder="sample_data/shop.db")
            else:
                c1, c2 = st.columns([3, 1])
                host = c1.text_input("Host", placeholder="db.example.com")
                port = c2.number_input("Port", value=5432 if db_type == "postgres" else 3306, step=1)
                c3, c4 = st.columns(2)
                username = c3.text_input("User")
                password = c4.text_input("Password", type="password")
                database = st.text_input("Database")
            schema_name = st.text_input("Schema (optional)", placeholder="public") if db_type == "postgres" else ""
            if st.form_submit_button("Connect (read-only)", type="primary", width="stretch"):
                try:
                    if not url:
                        url = build_url(db_type, host, int(port) or None, username, password, database)
                    with st.spinner("Connecting and reading the schema..."):
                        src = svc.create_database_source(ss.sid, url, schema=schema_name or None)
                        src.tables()
                    activate(src)
                except Exception as e:
                    st.error(f"Connection failed: {safe_error(e, [x for x in (url, password) if x])}")
        st.caption("🔒 Read-only session, time-limited queries, credentials kept in memory only. "
                   "Use a least-privilege database user.")


# --------------------------------------------------------------------------- sidebar
with st.sidebar:
    ui.brand()

    ui.section("AI models")
    llm = svc.llm_status()
    if llm["configured"]:
        st.markdown(ui.pill(f"● {len(llm['candidates'])} model endpoint(s) ready", "ok"), unsafe_allow_html=True)
        if st.button("Test connections", key="test_llm", width="stretch", icon=":material/network_check:"):
            with st.spinner("Pinging each model..."):
                try:
                    ss.llm_check = svc.llm_check()
                except Exception as e:
                    ss.llm_check = [{"label": "check", "ok": False, "detail": safe_error(e)}]
        if ss.llm_check:
            for r in ss.llm_check:
                st.markdown(
                    f"{'✅' if r['ok'] else '❌'} **{ui.esc(r['label'])}**<br>"
                    f"<span style='color:#64748b;font-size:.8rem'>{ui.esc(r['detail'])}</span>",
                    unsafe_allow_html=True,
                )
    else:
        st.markdown(ui.pill("● no model configured", "bad"), unsafe_allow_html=True)
        st.caption("Add `GROQ_API_KEYS`, `GEMINI_API_KEYS` or `OLLAMA_BASE_URL` to `.env`, then restart.")

    sources = svc.list_sources(ss.sid)
    ui.section("Data sources")
    if sources:
        names = {s.id: f"{'📁' if s.kind == 'files' else '🗄️'}  {s.name}" for s in sources}
        ss.active = st.radio("Active source", list(names), format_func=names.get, label_visibility="collapsed",
                             index=list(names).index(ss.active) if ss.active in names else 0)
        if st.button("Disconnect", key="disc", width="stretch", icon=":material/link_off:"):
            svc.delete_source(ss.active, ss.sid)
            ss.active, ss.messages = None, []
            st.rerun()
        with st.expander("➕ Add another source"):
            connectors("sb")
    else:
        st.caption("Nothing connected yet - start on the main page.")

    stats = svc.history.stats(ss.sid)
    if stats["total"]:
        ui.section("This session")
        a, b = st.columns(2)
        a.metric("Queries", stats["total"])
        b.metric("Success", f"{stats['success_rate']:.0f}%")

source = active_source()


# --------------------------------------------------------------------------- helpers
def client_ip() -> str | None:
    try:  # behind a proxy the real client is the first X-Forwarded-For entry
        h = st.context.headers
        return (h.get("X-Forwarded-For") or "").split(",")[0].strip() or None
    except Exception:
        return None


def turns_from_messages() -> list[Turn]:
    """Follow-up context = exactly what is on screen, so 'Clear conversation' really resets it."""
    turns, q = [], None
    for m in ss.messages:
        if m["role"] == "user":
            q = m["content"]
        elif q is not None and m["result"].ok and m["result"].intent == "sql":
            turns.append(Turn(q, m["result"].sql, m["result"].answer))
    return turns[-6:]


def render_error(res) -> None:
    items = "".join(f"<li>{ui.esc(d)}</li>" for d in res.error_detail)
    hint = ""
    if res.error_code == "llm_unavailable":
        hint = "<br><span style='font-size:.85rem'>Open <b>Test connections</b> in the sidebar to check each model.</span>"
    st.markdown(
        f"<div class='aq-err'><b>⚠ {ui.esc(res.answer)}</b>{('<ul>' + items + '</ul>') if items else ''}{hint}</div>",
        unsafe_allow_html=True,
    )


def render_result(res, key: str) -> None:
    if res.assumptions:
        st.caption(f"💡 Assumption: {res.assumptions}")

    if res.error and not res.result:
        render_error(res)
        if res.sql:
            with st.expander("Last SQL attempt"):
                st.code(res.sql, language="sql")
        return

    if res.answer:
        st.markdown(f"<div class='aq-answer'>\n\n{res.answer}\n\n</div>", unsafe_allow_html=True)

    df = res.result.df if res.result is not None else None

    # one-row numeric results read best as KPI tiles
    if df is not None and len(df) == 1 and 0 < len(df.columns) <= 4 and all(
            pd.api.types.is_numeric_dtype(df[c]) for c in df.columns):
        cols = st.columns(len(df.columns))
        for c, col in zip(df.columns, cols):
            col.metric(str(c).replace("_", " ").title(), ui.fmt(df[c].iloc[0]), border=True)

    if res.result is not None:
        spec = res.chart if res.chart.type != "none" else auto_chart(df)
        fig = build_figure(df, spec) if len(df) > 1 else None
        labels = (["📈 Chart"] if fig is not None else []) + ["📋 Table", "🧾 SQL"]
        tabs = st.tabs(labels)
        i = 0
        if fig is not None:
            with tabs[0]:
                st.plotly_chart(fig, width="stretch", key=f"chart_{key}")
            i = 1
        with tabs[i]:
            st.dataframe(df, width="stretch", hide_index=True, height=min(420, 38 + 35 * max(len(df), 1)))
            meta = f"{res.result.row_count:,} row(s) · {res.result.elapsed_ms:.0f} ms"
            if res.attempts > 1:
                meta += f" · self-corrected after {res.attempts - 1} failed attempt(s)"
            if res.result.truncated:
                meta += f" · truncated at {S.max_result_rows:,} rows"
            c1, c2 = st.columns([4, 1])
            c1.markdown(f"<div class='aq-meta'>{ui.esc(meta)}</div>", unsafe_allow_html=True)
            c2.download_button("Download CSV", df.to_csv(index=False).encode(), "askql_result.csv", "text/csv",
                               key=f"dl_{key}", width="stretch", icon=":material/download:")
        with tabs[i + 1]:
            st.code(res.sql or "", language="sql")
    elif res.sql:
        with st.expander("SQL"):
            st.code(res.sql, language="sql")

    for w in res.warnings:
        st.warning(w, icon="⚠️")
    for ins in res.insights:
        st.markdown(f"<div class='aq-insight'><span>💡</span><span>{ui.esc(ins)}</span></div>", unsafe_allow_html=True)
    if res.followups:
        st.caption("Ask next")
        cols = st.columns(len(res.followups))
        for i, (col, q) in enumerate(zip(cols, res.followups)):
            if col.button(q, key=f"fu_{key}_{i}", width="stretch"):
                ss.pending = q
                st.rerun()


def ask(question: str) -> None:
    ss.messages.append({"role": "user", "content": question})
    with st.chat_message("user", avatar="🧑"):
        st.markdown(question)
    with st.chat_message("assistant", avatar="✨"):
        try:
            with st.status("Thinking...", expanded=False) as status:
                res = svc.ask(ss.sid, question, source, turns=turns_from_messages(),
                              on_step=lambda m: status.update(label=m), client_ip=client_ip())
                status.update(label="Done" if res.ok else "Couldn't answer", state="complete" if res.ok else "error")
            render_result(res, str(len(ss.messages)))
            ss.messages.append({"role": "assistant", "result": res})
        except RateLimitError as e:
            ss.messages.pop()
            st.warning(str(e), icon="⏳")
        except NoLLMConfiguredError as e:
            ss.messages.pop()
            st.error(str(e))
        except Exception as e:
            ss.messages.pop()
            st.error(f"Something went wrong: {safe_error(e)}")


def ask_again(question: str) -> None:
    ss.pending, ss.nav = question, NAV[0]  # callbacks run before the rerun, so switching the view is allowed


def er_diagram(tables) -> str | None:
    edges = [(t.name, fk.ref_table, ", ".join(fk.columns)) for t in tables for fk in t.foreign_keys]
    if not edges:
        return None
    names = {t.name for t in tables}
    lines = ["digraph G {", 'rankdir=LR; bgcolor="transparent";',
             'node [shape=box, style="rounded,filled", fillcolor="#eff6ff", color="#93c5fd", fontname="Helvetica", fontsize=11];',
             'edge [color="#94a3b8", fontname="Helvetica", fontsize=9];']
    lines += [f'"{n}";' for n in sorted(names)]
    lines += [f'"{a}" -> "{b}" [label="{lbl}"];' for a, b, lbl in edges if b in names]
    lines.append("}")
    return "\n".join(lines)


# --------------------------------------------------------------------------- landing
def landing() -> None:
    ui.hero()
    _, mid, _ = st.columns([1, 1.2, 1])
    with mid:
        if st.button("🚀  Try the demo dataset", key="demo_main", type="primary", width="stretch"):
            load_demo()
        st.markdown("<div style='text-align:center;color:#64748b;font-size:.85rem;margin:.4rem 0 1rem'>"
                    "e-commerce sample · customers, products, orders · no setup</div>", unsafe_allow_html=True)
    if not svc.llm_status()["configured"]:
        st.warning("No AI model is configured yet - add `GROQ_API_KEYS`, `GEMINI_API_KEYS` or `OLLAMA_BASE_URL` to your "
                   "`.env` file and restart. You can still explore your data without one.", icon="🔑")

    with st.container(border=True):
        st.markdown("#### Bring your own data")
        connectors("main")

    st.write("")
    c1, c2, c3 = st.columns(3)
    c1.markdown(ui.card("📁", "Files, joined", "CSV, TSV, Excel (every sheet), JSON and Parquet become SQL tables you can "
                        "query and join together."), unsafe_allow_html=True)
    c2.markdown(ui.card("🗄️", "Real databases", "PostgreSQL, MySQL and SQLite with schema and foreign-key awareness, "
                        "read-only sessions and query timeouts."), unsafe_allow_html=True)
    c3.markdown(ui.card("🛡️", "Safe by design", "Generated SQL is parsed and restricted to read-only queries over known "
                        "tables. Numbers in answers are checked against the results."), unsafe_allow_html=True)
    st.write("")
    st.markdown(f"<div class='aq-card'><h4 style='margin-top:0'>How it works</h4>{ui.how_it_works()}</div>",
                unsafe_allow_html=True)


# --------------------------------------------------------------------------- main
if source is None:
    landing()
    st.stop()

nav = st.segmented_control("Navigation", NAV, default=NAV[0], key="nav", label_visibility="collapsed") or NAV[0]

# The chat box only exists on the Ask view (and is pinned to the bottom by Streamlit), so a question can never be
# typed somewhere its answer would be invisible.
prompt = None
if nav == NAV[0]:
    prompt = st.chat_input("Ask a question about your data...")
    if ss.pending:
        prompt, ss.pending = ss.pending, None
tables = source.tables()
total_rows = sum(t.row_count or 0 for t in tables)

if nav == NAV[0]:
    strip_l, strip_r = st.columns([6, 1], vertical_alignment="center")
    with strip_l:
        kind = "files" if source.kind == "files" else source.dialect
        rows_txt = f" · {total_rows:,} rows" if total_rows else ""
        st.markdown(
            f"<div class='aq-strip'><span class='name'>{ui.esc(source.name)}</span>"
            f"{ui.pill(kind)}{ui.pill(f'{len(tables)} table(s)', 'gray')}"
            f"{ui.pill(rows_txt.strip(' ·'), 'gray') if rows_txt else ''}</div>",
            unsafe_allow_html=True,
        )
    with strip_r:
        if ss.messages and st.button("Clear chat", key="clear", width="stretch", icon=":material/delete:"):
            ss.messages = []
            st.rerun()

    for i, m in enumerate(ss.messages):
        with st.chat_message(m["role"], avatar="🧑" if m["role"] == "user" else "✨"):
            if m["role"] == "user":
                st.markdown(m["content"])
            else:
                render_result(m["result"], str(i))

    if not ss.messages and not prompt:
        st.markdown(f"<div class='aq-welcome'><h2>What would you like to know?</h2>"
                    f"<p>Ask about <b>{ui.esc(source.name)}</b> in plain English - or start with one of these.</p></div>",
                    unsafe_allow_html=True)
        ideas = ui.suggest_questions(source)
        cols = st.columns(2)
        for i, q in enumerate(ideas):
            if cols[i % 2].button(q, key=f"idea_{i}", width="stretch"):
                ss.pending = q
                st.rerun()

    if prompt:
        ask(prompt)

if nav == NAV[1]:
    dot = er_diagram(tables)
    if dot:
        with st.expander("🔗 Relationships", expanded=True):
            st.graphviz_chart(dot, width="stretch")
    for t in tables:
        with st.container(border=True):
            head = f"<b style='font-size:1.05rem'>{ui.esc(t.name)}</b> &nbsp;{ui.pill(f'{len(t.columns)} columns', 'gray')}"
            if t.row_count is not None:
                head += ui.pill(f"{t.row_count:,} rows", "gray")
            st.markdown(head, unsafe_allow_html=True)
            names = ["Columns"] + (["Preview", "Statistics"] if isinstance(source, FileSource) else [])
            sub = st.tabs(names)
            with sub[0]:
                st.dataframe(
                    pd.DataFrame([{"column": c.name, "type": c.type,
                                   **({"key": "🔑" if c.primary_key else ""} if any(x.primary_key for x in t.columns) else {}),
                                   "examples": ", ".join(map(str, c.samples[:3]))} for c in t.columns]),
                    hide_index=True, width="stretch",
                )
                for fk in t.foreign_keys:
                    st.caption(f"🔗 ({', '.join(fk.columns)}) → {fk.ref_table}({', '.join(fk.ref_columns)})")
            if isinstance(source, FileSource):
                with sub[1]:
                    st.dataframe(source.preview(t.name), hide_index=True, width="stretch")
                with sub[2]:
                    st.dataframe(source.summary(t.name), hide_index=True, width="stretch")

if nav == NAV[2]:
    items = svc.history.list(ss.sid, limit=50)
    if not items:
        st.markdown("<div class='aq-welcome'><h2>No queries yet</h2><p>Your questions will appear here.</p></div>",
                    unsafe_allow_html=True)
    else:
        top = st.columns([5, 1], vertical_alignment="center")
        top[0].caption(f"{len(items)} most recent")
        if top[1].button("Clear history", key="clear_hist", width="stretch"):
            svc.history.clear(ss.sid)
            st.rerun()
        for it in items:
            ok = it["status"] == "success"
            with st.expander(f"{'✅' if ok else '⚠️'}  {it['question']}"):
                if it["sql"]:
                    st.code(it["sql"], language="sql")
                bits = [str(it["created_at"])[:19].replace("T", " "), it.get("source_name") or "no source"]
                if it.get("row_count") is not None:
                    bits.append(f"{it['row_count']:,} rows")
                if it.get("elapsed_ms"):
                    bits.append(f"{it['elapsed_ms']:.0f} ms")
                st.caption(" · ".join(bits))
                st.button("Ask again", key=f"again_{it['id']}", icon=":material/replay:", on_click=ask_again,
                          args=(it["question"],))
