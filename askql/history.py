"""Persistent query history (replaces the old Supabase tables).

Defaults to a local SQLite file; point HISTORY_DB_URL at any Postgres (Neon,
Supabase, ...) to keep history across redeploys on ephemeral free hosts.
"""
from __future__ import annotations

import datetime as dt
import logging
from typing import Any

from sqlalchemy import Column, DateTime, Float, Integer, String, Text, case, create_engine, delete, func, inspect, select
from sqlalchemy.orm import DeclarativeBase, Session
from sqlalchemy.pool import StaticPool

from askql.config import get_settings


log = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


class HistoryRow(Base):
    __tablename__ = "query_history"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(64), index=True, nullable=False)
    source_id = Column(String(64), index=True)
    source_name = Column(String(200))
    question = Column(Text, nullable=False)
    sql = Column(Text)
    answer = Column(Text)
    status = Column(String(16), nullable=False, default="success")
    row_count = Column(Integer)
    elapsed_ms = Column(Float)
    created_at = Column(DateTime(timezone=True), default=lambda: dt.datetime.now(dt.timezone.utc), index=True)


class HistoryStore:
    def __init__(self, url: str | None = None):
        url = url or get_settings().history_db_url
        kwargs: dict[str, Any] = {"pool_pre_ping": True}
        if url.startswith("sqlite"):
            kwargs["connect_args"] = {"check_same_thread": False}
        if url.startswith("postgres://"):
            url = "postgresql+psycopg2://" + url[len("postgres://"):]
        elif url.startswith("postgresql://"):
            url = "postgresql+psycopg2://" + url[len("postgresql://"):]
        try:
            self.engine = create_engine(url, **kwargs)
            Base.metadata.create_all(self.engine)
            self._migrate()
        except Exception as e:
            # A read-only filesystem / unreachable history DB must not take the whole app down.
            log.error("History DB unavailable (%s) - using in-memory history for this process", type(e).__name__)
            self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
            Base.metadata.create_all(self.engine)
            self.persistent = False
        else:
            self.persistent = True

    def _migrate(self) -> None:
        """Add columns introduced after a history DB was first created (create_all never alters tables)."""
        cols = {c["name"] for c in inspect(self.engine).get_columns(HistoryRow.__tablename__)}
        if "source_id" not in cols:
            with self.engine.begin() as conn:
                conn.exec_driver_sql("ALTER TABLE query_history ADD COLUMN source_id VARCHAR(64)")

    def add(self, session_id: str, source_id: str | None, source_name: str | None, result: Any) -> int:
        row = HistoryRow(
            session_id=session_id,
            source_id=source_id,
            source_name=source_name,
            question=result.question,
            sql=result.sql,
            answer=(result.answer or "")[:4000],
            status="success" if result.ok else "error",
            row_count=result.result.row_count if result.result else None,
            elapsed_ms=result.elapsed_ms,
        )
        with Session(self.engine) as s:
            s.add(row)
            s.commit()
            return row.id

    def list(self, session_id: str, limit: int = 100, source_id: str | None = None,
             only_success: bool = False) -> list[dict[str, Any]]:
        q = select(HistoryRow).where(HistoryRow.session_id == session_id)
        if source_id:
            q = q.where(HistoryRow.source_id == source_id)
        if only_success:
            q = q.where(HistoryRow.status == "success")
        with Session(self.engine) as s:
            rows = s.scalars(q.order_by(HistoryRow.id.desc()).limit(limit)).all()
            return [
                {c.name: getattr(r, c.name) for c in HistoryRow.__table__.columns}
                | {"created_at": r.created_at.isoformat() if r.created_at else None}
                for r in rows
            ]

    def clear(self, session_id: str) -> int:
        with Session(self.engine) as s:
            n = s.execute(delete(HistoryRow).where(HistoryRow.session_id == session_id)).rowcount
            s.commit()
            return n or 0

    def stats(self, session_id: str) -> dict[str, Any]:
        with Session(self.engine) as s:
            total, ok, avg = s.execute(
                select(
                    func.count(HistoryRow.id),
                    func.sum(case((HistoryRow.status == "success", 1), else_=0)),
                    func.avg(HistoryRow.elapsed_ms),
                ).where(HistoryRow.session_id == session_id)
            ).one()
        total = total or 0
        return {
            "total": total,
            "success_rate": round(100 * (ok or 0) / total, 1) if total else 0.0,
            "avg_ms": round(avg or 0, 1),
        }
