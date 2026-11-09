"""Presentation layer for the Streamlit app: theme CSS, small HTML components, suggestion heuristics."""
from __future__ import annotations

import html
import numbers
import re

import streamlit as st

from askql.data import DataSource

ACCENT = "#0ea5e9"
ACCENT_2 = "#6366f1"

CSS = f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
:root {{
  --aq-accent: {ACCENT}; --aq-accent2: {ACCENT_2};
  --aq-ink: #0f172a; --aq-muted: #64748b; --aq-line: #e2e8f0; --aq-soft: #f8fafc; --aq-tint: #eff6ff;
}}
html, body, [class*="css"], .stApp {{ font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif; }}
.stApp {{ background: radial-gradient(1200px 500px at 85% -10%, #e0f2fe 0%, rgba(224,242,254,0) 60%),
                      radial-gradient(900px 400px at -10% 0%, #ede9fe 0%, rgba(237,233,254,0) 55%), #ffffff; }}
/* chrome */
#MainMenu, footer, [data-testid="stToolbar"], [data-testid="stDecoration"] {{ display: none !important; }}
header[data-testid="stHeader"] {{ background: transparent; pointer-events: none; }}
header[data-testid="stHeader"] * {{ pointer-events: auto; }}
.block-container {{ padding-top: 3.4rem; padding-bottom: 6rem; max-width: 1180px; }}

/* sidebar */
section[data-testid="stSidebar"] {{ background: linear-gradient(180deg, #f8fbff 0%, #f1f5f9 100%); border-right: 1px solid var(--aq-line); }}
section[data-testid="stSidebar"] .block-container {{ padding-top: 1.2rem; }}
.aq-brand {{ display:flex; align-items:center; gap:.65rem; margin-bottom:.15rem; }}
.aq-logo {{ width:38px; height:38px; border-radius:11px; display:grid; place-items:center; font-size:20px; color:#fff;
            background: linear-gradient(135deg, var(--aq-accent), var(--aq-accent2)); box-shadow: 0 6px 16px rgba(14,165,233,.35); }}
.aq-brand b {{ font-size:1.35rem; letter-spacing:-.02em; color: var(--aq-ink); }}
.aq-tag {{ color: var(--aq-muted); font-size:.82rem; margin: 0 0 1rem 0; }}
.aq-section {{ font-size:.72rem; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color: var(--aq-muted); margin:1.1rem 0 .4rem; }}

/* pills / chips */
.aq-pill {{ display:inline-flex; align-items:center; gap:.35rem; padding:.18rem .65rem; border-radius:999px; font-size:.76rem; font-weight:600;
            background: var(--aq-tint); color:#0369a1; border:1px solid #dbeafe; margin-right:.35rem; }}
.aq-pill.ok {{ background:#ecfdf5; color:#047857; border-color:#d1fae5; }}
.aq-pill.bad {{ background:#fef2f2; color:#b91c1c; border-color:#fee2e2; }}
.aq-pill.gray {{ background:#f1f5f9; color:#475569; border-color:#e2e8f0; }}

/* hero */
.aq-hero {{ text-align:center; padding: 2.2rem 1rem 1.2rem; }}
.aq-hero .eyebrow {{ display:inline-block; padding:.28rem .85rem; border-radius:999px; font-size:.78rem; font-weight:600; color:#0369a1;
                     background:#e0f2fe; border:1px solid #bae6fd; margin-bottom:1rem; }}
.aq-hero h1 {{ font-size:3.1rem; line-height:1.08; font-weight:800; letter-spacing:-.035em; margin:0 0 .8rem; color: var(--aq-ink); }}
.aq-grad {{ background: linear-gradient(90deg, var(--aq-accent), var(--aq-accent2)); -webkit-background-clip:text; background-clip:text; color:transparent; }}
.aq-hero p {{ font-size:1.12rem; color: var(--aq-muted); max-width: 680px; margin: 0 auto; }}
@media (max-width: 640px) {{ .aq-hero h1 {{ font-size:2.1rem; }} }}

/* cards */
.aq-card {{ background:#fff; border:1px solid var(--aq-line); border-radius:16px; padding:1.1rem 1.2rem; height:100%;
            box-shadow: 0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.04); }}
.aq-card h4 {{ margin:.5rem 0 .25rem; font-size:1rem; color: var(--aq-ink); }}
.aq-card p {{ margin:0; color: var(--aq-muted); font-size:.9rem; line-height:1.5; }}
.aq-ico {{ width:40px; height:40px; border-radius:12px; display:grid; place-items:center; font-size:20px; background: var(--aq-tint); }}
.aq-step {{ display:flex; gap:.8rem; align-items:flex-start; }}
.aq-step .n {{ flex:none; width:28px; height:28px; border-radius:50%; background: linear-gradient(135deg,var(--aq-accent),var(--aq-accent2));
               color:#fff; font-weight:700; font-size:.85rem; display:grid; place-items:center; }}
.aq-step b {{ color: var(--aq-ink); }} .aq-step span {{ color: var(--aq-muted); font-size:.9rem; }}

/* source header strip */
.aq-strip {{ display:flex; flex-wrap:wrap; align-items:center; gap:.5rem .6rem; padding:.7rem 1rem; border:1px solid var(--aq-line);
             border-radius:14px; background:#fff; box-shadow:0 1px 2px rgba(15,23,42,.04); margin-bottom:.9rem; }}
.aq-strip .name {{ font-weight:700; color: var(--aq-ink); margin-right:.3rem; }}

/* answer */
.aq-answer {{ border-left:4px solid var(--aq-accent); background: linear-gradient(90deg, #f0f9ff, #ffffff); padding:.85rem 1.1rem;
              border-radius:0 12px 12px 0; margin:.2rem 0 .8rem; color: var(--aq-ink); }}
.aq-answer p:last-child {{ margin-bottom:0; }}
.aq-insight {{ display:flex; gap:.6rem; align-items:flex-start; padding:.55rem .8rem; background:#faf5ff; border:1px solid #f3e8ff;
               border-radius:10px; margin:.3rem 0; font-size:.92rem; color:#4c1d95; }}
.aq-err {{ border:1px solid #fecaca; background:#fef2f2; border-radius:12px; padding:.9rem 1.1rem; color:#7f1d1d; }}
.aq-err b {{ color:#991b1b; }} .aq-err ul {{ margin:.5rem 0 0 1.1rem; padding:0; font-size:.88rem; }}
.aq-meta {{ color: var(--aq-muted); font-size:.78rem; margin:.15rem 0 .5rem; }}
.aq-welcome {{ text-align:center; padding:1.6rem 1rem 1rem; }}
.aq-welcome h2 {{ margin:.2rem 0 .3rem; font-size:1.6rem; letter-spacing:-.02em; color: var(--aq-ink); }}
.aq-welcome p {{ color: var(--aq-muted); margin:0; }}

/* streamlit widgets */
div[data-testid="stChatMessage"] {{ background:#fff; border:1px solid var(--aq-line); border-radius:16px; padding:1rem 1.1rem;
        box-shadow:0 1px 2px rgba(15,23,42,.04), 0 6px 18px rgba(15,23,42,.035); margin-bottom:.8rem; }}
div[data-testid="stChatMessage"]:has([data-testid="stChatMessageAvatarUser"]) {{ background: var(--aq-tint); border-color:#dbeafe; }}
.stButton > button, .stDownloadButton > button, div[data-testid="stFormSubmitButton"] > button {{
        border-radius:11px; font-weight:600; border:1px solid var(--aq-line); transition: all .15s ease; }}
.stButton > button:hover {{ border-color: var(--aq-accent); color:#0369a1; transform: translateY(-1px); box-shadow:0 6px 14px rgba(14,165,233,.15); }}
.stButton > button[kind="primary"], div[data-testid="stFormSubmitButton"] > button[kind="primaryFormSubmit"] {{
        background: linear-gradient(135deg, var(--aq-accent), var(--aq-accent2)); border:none; color:#fff; box-shadow:0 6px 16px rgba(99,102,241,.28); }}
.stButton > button[kind="primary"]:hover {{ color:#fff; box-shadow:0 10px 22px rgba(99,102,241,.38); }}
.stTabs [data-baseweb="tab-list"] {{ gap:.25rem; border-bottom:1px solid var(--aq-line); }}
.stTabs [data-baseweb="tab"] {{ border-radius:10px 10px 0 0; font-weight:600; padding:.55rem 1rem; }}
.stTabs [aria-selected="true"] {{ color:#0369a1; }}
div[data-testid="stMetric"] {{ background:#fff; border:1px solid var(--aq-line); border-radius:14px; padding:.8rem 1rem;
        box-shadow:0 1px 2px rgba(15,23,42,.04); }}
div[data-testid="stMetricValue"] {{ font-weight:800; letter-spacing:-.02em; color: var(--aq-ink); }}
section[data-testid="stSidebar"] div[data-testid="stMetricValue"] {{ font-size:1.35rem; }}
div[data-testid="stSegmentedControl"] button {{ font-weight:600; }}
div[data-testid="stDataFrame"] {{ border:1px solid var(--aq-line); border-radius:12px; overflow:hidden; }}
div[data-testid="stExpander"] {{ border:1px solid var(--aq-line); border-radius:12px; background:#fff; }}
div[data-testid="stChatInput"] {{ border-radius:16px; border:1px solid #cbd5e1; box-shadow:0 10px 30px rgba(15,23,42,.08); }}
div[data-testid="stFileUploaderDropzone"] {{ border:2px dashed #bae6fd; border-radius:14px; background:#f8fbff; }}
.stCode, pre {{ border-radius:12px !important; }}
</style>
"""


def inject_css() -> None:
    st.markdown(CSS, unsafe_allow_html=True)


def fmt(v) -> str:
    if isinstance(v, bool) or v is None:
        return str(v)
    if isinstance(v, numbers.Integral):  # includes numpy ints
        return f"{int(v):,}"
    if isinstance(v, numbers.Real):
        return f"{int(v):,}" if v == v and v == int(v) and abs(v) < 1e15 else f"{v:,.2f}"
    return str(v)


def esc(x: object) -> str:
    return html.escape(str(x))


def pill(text: str, kind: str = "") -> str:
    return f'<span class="aq-pill {kind}">{esc(text)}</span>'


def brand() -> None:
    st.markdown(
        '<div class="aq-brand"><div class="aq-logo">⌕</div><b>AskQL</b></div>'
        '<div class="aq-tag">Ask your data in plain English</div>',
        unsafe_allow_html=True,
    )


def section(label: str) -> None:
    st.markdown(f'<div class="aq-section">{esc(label)}</div>', unsafe_allow_html=True)


def card(icon: str, title: str, body: str) -> str:
    return f'<div class="aq-card"><div class="aq-ico">{icon}</div><h4>{esc(title)}</h4><p>{esc(body)}</p></div>'


def hero() -> None:
    st.markdown(
        """
        <div class="aq-hero">
          <span class="eyebrow">✨ AI data analyst · CSV · Excel · Postgres · MySQL · SQLite</span>
          <h1>Ask your data <span class="aq-grad">anything.</span></h1>
          <p>Type a question in plain English. AskQL writes the SQL, checks it is safe, runs it on your real data
             and explains the result with a chart.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )


def how_it_works() -> str:
    steps = [("Connect", "Upload CSV / Excel / JSON / Parquet or connect a database (read-only)."),
             ("Ask", "Use everyday language - follow-up questions remember the context."),
             ("Verified SQL", "Every query is parsed and restricted to safe, read-only SELECTs."),
             ("Real answers", "Results come from your data, with charts and flagged figures.")]
    return "".join(
        f'<div class="aq-step" style="margin:.55rem 0"><div class="n">{i}</div><div><b>{esc(t)}</b><br><span>{esc(d)}</span></div></div>'
        for i, (t, d) in enumerate(steps, 1)
    )


# ------------------------------------------------------------------ suggestions
_NUM = re.compile(r"INT|DOUBLE|FLOAT|DECIMAL|NUMERIC|REAL|BIGINT|HUGEINT", re.I)
_DATE = re.compile(r"DATE|TIME", re.I)
_TEXT = re.compile(r"CHAR|TEXT|STRING|VARCHAR|ENUM", re.I)
_ID = re.compile(r"(^id$|_id$|^id_|uuid|^index$|unnamed)", re.I)
_PREF_NUM = ("revenue", "amount", "total", "sales", "price", "profit", "cost", "salary", "score", "quantity", "value")
_PREF_CAT = ("region", "category", "status", "type", "tier", "country", "segment", "department", "city", "state", "gender")


def _h(name: str) -> str:
    return name.replace("_", " ")


def suggest_questions(source: DataSource, limit: int = 4) -> list[str]:
    """Starter questions generated from the real schema (no LLM call)."""
    if source.name == "Demo shop":
        return ["Monthly revenue trend for completed orders", "Top 5 customers by total spend",
                "Return rate by product category", "Which region has the highest average order value?"]
    out: list[str] = []
    for t in source.tables():
        nums = [c.name for c in t.columns if _NUM.search(c.type) and not _ID.search(c.name)]
        cats = [c.name for c in t.columns if _TEXT.search(c.type) and not _ID.search(c.name)]
        dates = [c.name for c in t.columns if _DATE.search(c.type)]
        num = next((n for p in _PREF_NUM for n in nums if p in n.lower()), nums[0] if nums else None)
        cat = next((c for p in _PREF_CAT for c in cats if p in c.lower()), cats[0] if cats else None)
        tn = _h(t.name)
        if num and cat:
            out.append(f"What is the total {_h(num)} by {_h(cat)} in {tn}?")
            out.append(f"Show the top 10 {_h(cat)} by {_h(num)} in {tn}")
        if num and dates:
            out.append(f"How has {_h(num)} changed by month in {tn}?")
        if num:
            out.append(f"What are the average, minimum and maximum {_h(num)} in {tn}?")
        out.append(f"How many rows are in {tn}?")
        if len(out) >= limit * 2:
            break
    seen, uniq = set(), []
    for q in out:
        if q not in seen:
            seen.add(q)
            uniq.append(q)
    return uniq[:limit] or ["Show me the first 10 rows", "What columns are available?"]
