"""The AskQL agent, built as a LangGraph state machine.

    generate ──(chat)──────────────────────────────► END
        │
        └─(sql)─► execute ──(ok)──► analyze ──► END
                     │
                     └─(error, attempts left)──► generate   (self-repair loop)
                     └─(error, out of attempts)─► END
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable, TypedDict

import pandas as pd
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import Runnable, RunnableConfig
from langgraph.graph import END, START, StateGraph

from askql.config import Settings, get_settings
from askql.data import DataSource, QueryResult, UnsafeSQLError

from . import prompts
from askql.security import sanitize_markdown

from .grounding import ungrounded_numbers
from .schemas import Analysis, ChartSpec, Plan, message_text, parse_model

log = logging.getLogger(__name__)

HISTORY_TURNS = 6
PREVIEW_ROWS = 20


@dataclass
class Turn:
    """One prior exchange, used to resolve follow-ups like 'and for 2023?'."""

    question: str
    sql: str | None = None
    answer: str | None = None


@dataclass
class AskResult:
    question: str
    intent: str = "chat"
    answer: str = ""
    sql: str | None = None
    result: QueryResult | None = None
    insights: list[str] = field(default_factory=list)
    chart: ChartSpec = field(default_factory=ChartSpec)
    followups: list[str] = field(default_factory=list)
    assumptions: str | None = None
    warnings: list[str] = field(default_factory=list)
    error: str | None = None
    error_code: str | None = None  # 'llm_unavailable' | None
    error_detail: list[str] = field(default_factory=list)  # safe per-model failure reasons
    attempts: int = 0
    elapsed_ms: float = 0.0

    @property
    def ok(self) -> bool:
        return self.error is None

    def to_dict(self) -> dict[str, Any]:
        return {
            "question": self.question,
            "intent": self.intent,
            "answer": self.answer,
            "sql": self.sql,
            "columns": list(self.result.df.columns) if self.result else [],
            "rows": self.result.to_records() if self.result else [],
            "row_count": self.result.row_count if self.result else 0,
            "truncated": self.result.truncated if self.result else False,
            "insights": self.insights,
            "chart": self.chart.model_dump(),
            "followups": self.followups,
            "assumptions": self.assumptions,
            "warnings": self.warnings,
            "error": self.error,
            "error_code": self.error_code,
            "error_detail": self.error_detail,
            "attempts": self.attempts,
            "elapsed_ms": round(self.elapsed_ms, 1),
        }


class _State(TypedDict, total=False):
    question: str
    history: list[Turn]
    plan: Plan | None
    sql: str | None
    last_error: str | None
    attempts: int
    result: QueryResult | None
    analysis: Analysis | None
    error: str | None


def _history_text(history: list[Turn]) -> str:
    if not history:
        return "(none)"
    lines = []
    for t in history[-HISTORY_TURNS:]:
        lines.append(f"User: {t.question}")
        if t.sql:
            lines.append(f"SQL used: {t.sql}")
        if t.answer:
            lines.append(f"Answer: {t.answer[:300]}")
    return "\n".join(lines)


def _column_stats(df: pd.DataFrame) -> str:
    lines = []
    for c in df.columns[:15]:
        s = df[c]
        if pd.api.types.is_numeric_dtype(s) and not pd.api.types.is_bool_dtype(s):
            if s.notna().any():
                lines.append(f"- {c}: numeric min={s.min():.6g} max={s.max():.6g} mean={s.mean():.6g} sum={s.sum():.6g}")
        else:
            lines.append(f"- {c}: {s.nunique(dropna=True)} distinct, {int(s.isna().sum())} null")
    return "\n".join(lines) or "(none)"


def _validate_chart(chart: ChartSpec, df: pd.DataFrame) -> ChartSpec:
    cols = set(df.columns)
    if chart.type == "none" or df.empty:
        return ChartSpec()
    if chart.x not in cols or (chart.type != "histogram" and chart.y not in cols):
        return ChartSpec()
    if chart.color and chart.color not in cols:
        chart = chart.model_copy(update={"color": None})
    return chart


class AskQLAgent:
    """Question in -> verified SQL, real results, analysis and chart out."""

    def __init__(self, llm: Callable[[], Runnable], settings: Settings | None = None):
        self._llm = llm  # called per request so key rotation can happen
        self.settings = settings or get_settings()
        self._graph = self._build()

    # ------------------------------------------------------------------ API
    def ask(
        self,
        question: str,
        source: DataSource | None,
        history: list[Turn] | None = None,
        on_step: Callable[[str], None] | None = None,
    ) -> AskResult:
        start = time.perf_counter()
        # Per-request context travels in the run config, so one agent can serve concurrent requests.
        cfg = {"configurable": {"source": source, "on_step": on_step}}
        out = self._graph.invoke(
            {"question": question.strip(), "history": history or [], "attempts": 0}, config=cfg
        )
        return self._finish(question, out, (time.perf_counter() - start) * 1000)

    # --------------------------------------------------------------- helpers
    @staticmethod
    def _ctx(config: RunnableConfig) -> tuple[DataSource | None, Callable[[str], None] | None]:
        c = config.get("configurable", {})
        return c.get("source"), c.get("on_step")

    @staticmethod
    def _step(config: RunnableConfig, msg: str) -> None:
        log.debug(msg)
        on_step = config.get("configurable", {}).get("on_step")
        if on_step:
            on_step(msg)

    def _call(self, system: str, user: str) -> str:
        msgs = [SystemMessage(content=system), HumanMessage(content=user)]
        return message_text(self._llm().invoke(msgs).content)

    # ----------------------------------------------------------------- nodes
    def _generate(self, state: _State, config: RunnableConfig) -> _State:
        src, _ = self._ctx(config)
        attempts = state.get("attempts", 0)
        self._step(config, "Understanding your question..." if attempts == 0 else f"Repairing the query (attempt {attempts + 1})...")
        send = self.settings.llm_send_data
        system = prompts.PLAN_SYSTEM.format(
            dialect_hint=prompts.DIALECT_HINTS.get(src.dialect if src else "duckdb", ""),
            limit=self.settings.max_result_rows,
            no_source="" if src else prompts.NO_SOURCE_NOTE,
        )
        error_block = ""
        if state.get("last_error"):
            error_block = prompts.ERROR_BLOCK.format(sql=state.get("sql"), error=state["last_error"])
        user = prompts.PLAN_USER.format(
            schema=src.schema_text(state["question"], samples=send) if src else "(no data source connected)",
            history=_history_text(state.get("history", [])),
            question=state["question"],
            error_block=error_block,
        )
        try:
            plan = parse_model(self._call(system, user), Plan)
        except ValueError:
            # One cheap retry nudging the format; models occasionally wrap prose around the JSON.
            plan = parse_model(self._call(system, user + "\n\nReturn ONLY the JSON object."), Plan)
        if plan.intent == "sql" and not (plan.sql or "").strip():
            plan = Plan(intent="chat", reply=plan.reply or "I couldn't work out a query for that. Could you rephrase?")
        if plan.intent == "sql" and src is None:
            plan = Plan(intent="chat", reply="Please upload a file or connect a database first.")
        return {"plan": plan, "sql": plan.sql, "attempts": attempts + 1}

    def _route_after_generate(self, state: _State) -> str:
        return "execute" if state["plan"] and state["plan"].intent == "sql" else "end"

    def _execute(self, state: _State, config: RunnableConfig) -> _State:
        self._step(config, "Running the query...")
        src, _ = self._ctx(config)
        s = self.settings
        try:
            res = src.run_query(state["sql"], s.max_result_rows, s.query_timeout_seconds)
            return {"result": res, "last_error": None}
        except UnsafeSQLError as e:
            return {"last_error": f"Rejected by safety check: {e}"}
        except TimeoutError as e:
            return {"last_error": str(e) + " Make the query cheaper (filter earlier, avoid cross joins)."}
        except Exception as e:  # driver / syntax / binder errors -> feed back to the model
            msg = str(getattr(e, "orig", e)).strip().splitlines()[0][:400]
            return {"last_error": msg}

    def _route_after_execute(self, state: _State) -> str:
        if not state.get("last_error"):
            return "analyze"
        if state.get("attempts", 0) <= self.settings.max_repair_attempts:
            return "generate"
        return "fail"

    def _fail(self, state: _State) -> _State:
        return {"error": f"I couldn't produce a working query. Last error: {state.get('last_error')}"}

    def _analyze(self, state: _State, config: RunnableConfig) -> _State:
        self._step(config, "Analysing the results...")
        res: QueryResult = state["result"]
        df = res.df
        send = self.settings.llm_send_data
        preview = df.head(PREVIEW_ROWS).to_csv(index=False) if send else "(hidden - data not shared with the model)"
        user = prompts.ANALYZE_USER.format(
            question=state["question"],
            sql=state["sql"],
            rows=res.row_count,
            trunc=" (truncated to the row limit)" if res.truncated else "",
            columns=", ".join(map(str, df.columns)),
            n=PREVIEW_ROWS,
            preview=preview,
            stats=_column_stats(df) if send else "(hidden)",
        )
        try:
            analysis = parse_model(self._call(prompts.ANALYZE_SYSTEM, user), Analysis)
        except Exception as e:  # analysis is a bonus - never lose the real results because of it
            log.warning("Analysis step failed: %s", e)
            analysis = Analysis(answer=f"The query returned {res.row_count} row(s).")
        analysis.answer = sanitize_markdown(analysis.answer)
        analysis.insights = [sanitize_markdown(i) for i in analysis.insights]
        analysis.followups = [sanitize_markdown(f)[:200] for f in analysis.followups]
        analysis.chart = _validate_chart(analysis.chart, df)
        return {"analysis": analysis}

    # ----------------------------------------------------------------- graph
    def _build(self):
        g = StateGraph(_State)
        g.add_node("generate", self._generate)
        g.add_node("execute", self._execute)
        g.add_node("analyze", self._analyze)
        g.add_node("fail", self._fail)
        g.add_edge(START, "generate")
        g.add_conditional_edges("generate", self._route_after_generate, {"execute": "execute", "end": END})
        g.add_conditional_edges(
            "execute", self._route_after_execute, {"analyze": "analyze", "generate": "generate", "fail": "fail"}
        )
        g.add_edge("analyze", END)
        g.add_edge("fail", END)
        return g.compile()

    def _finish(self, question: str, out: _State, elapsed_ms: float) -> AskResult:
        plan: Plan | None = out.get("plan")
        r = AskResult(question=question, attempts=out.get("attempts", 0), elapsed_ms=elapsed_ms)
        if plan is None:
            r.error = "No plan produced."
            return r
        r.intent = plan.intent
        r.assumptions = sanitize_markdown(plan.assumptions) if plan.assumptions else None
        if plan.intent == "chat":
            r.answer = sanitize_markdown(plan.reply or "")
            return r
        r.sql = out.get("sql")
        if out.get("error"):
            r.error = out["error"]
            r.answer = r.error
            return r
        r.result = out.get("result")
        a: Analysis | None = out.get("analysis")
        if a:
            r.answer, r.insights, r.chart, r.followups = a.answer, a.insights[:3], a.chart, a.followups[:3]
            if r.result is not None:
                bad = ungrounded_numbers([a.answer, *r.insights], r.result.df, r.result.row_count, question)
                if bad:
                    r.warnings.append(
                        "Some figures in the summary could not be matched to the result table "
                        f"({', '.join(bad)}). Check the table below before relying on them."
                    )
        if r.result is not None and r.result.truncated:
            r.warnings.append(f"Results were cut off at {r.result.row_count:,} rows; aggregates cover only those rows.")
        return r
