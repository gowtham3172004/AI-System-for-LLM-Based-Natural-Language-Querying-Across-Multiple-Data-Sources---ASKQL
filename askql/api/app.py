"""REST API. Run with: uvicorn askql.api.app:app"""
# NOTE: no `from __future__ import annotations` here - FastAPI must resolve the
# locally-defined Annotated dependency aliases below.
import logging
import re
import secrets
from typing import Annotated

from fastapi import Depends, FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from askql import __version__
from askql.config import get_settings
from askql.data import build_url
from askql.llm import NoLLMConfiguredError
from askql.security import RateLimitError, safe_error
from askql.service import AskQLService

log = logging.getLogger("askql.api")


class DatabaseConnect(BaseModel):
    url: str | None = Field(default=None, description="SQLAlchemy/standard URL, e.g. postgresql://user:pw@host/db")
    type: str | None = Field(default=None, description="postgres | mysql | sqlite (when not using url)")
    host: str = ""
    port: int | None = None
    username: str | None = None
    password: str | None = None
    database: str = ""
    schema_name: str | None = Field(default=None, alias="schema")
    name: str | None = None

    model_config = {"populate_by_name": True}


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    source_id: str | None = None


def create_app(service: AskQLService | None = None) -> FastAPI:
    svc = service or AskQLService(get_settings())
    settings = svc.settings  # one source of truth: the service's settings drive limits, auth and CORS
    logging.basicConfig(level=settings.log_level, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    app = FastAPI(title="AskQL API", version=__version__,
                  description="Natural-language querying over CSV, Excel and SQL databases.")
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_methods=["*"],
                       allow_headers=["*"])

    def auth(x_api_key: Annotated[str | None, Header()] = None) -> None:
        if settings.askql_api_key and not secrets.compare_digest(x_api_key or "", settings.askql_api_key):
            raise HTTPException(401, "Invalid or missing X-API-Key.")

    def session(x_session_id: Annotated[str | None, Header()] = None) -> str:
        # The session id is the *only* thing separating one caller's sources/history from another's, so it
        # must be an unguessable client-generated value (e.g. a UUID) - never a shared default.
        sid = (x_session_id or "").strip()
        if not (16 <= len(sid) <= 64) or not re.fullmatch(r"[A-Za-z0-9_\-]+", sid):
            raise HTTPException(400, "X-Session-Id header required: a random 16-64 char [A-Za-z0-9_-] string (e.g. a UUID).")
        return sid

    Auth = Depends(auth)
    Session = Annotated[str, Depends(session)]

    @app.exception_handler(NoLLMConfiguredError)
    async def _no_llm(_: Request, e: NoLLMConfiguredError):
        return JSONResponse({"detail": str(e)}, status_code=503)

    @app.exception_handler(RateLimitError)
    async def _rate(_: Request, e: RateLimitError):
        return JSONResponse({"detail": str(e)}, status_code=429, headers={"Retry-After": "30"})

    @app.middleware("http")
    async def _limit_upload_size(request: Request, call_next):
        if request.method == "POST" and request.url.path == "/api/sources/files":
            declared = request.headers.get("content-length")
            if declared and declared.isdigit() and int(declared) > (settings.max_upload_mb + 1) * 1024 * 1024:
                return JSONResponse({"detail": f"Upload exceeds {settings.max_upload_mb} MB."}, status_code=413)
        return await call_next(request)

    @app.get("/health")
    def health():
        """Liveness/readiness probe. Deliberately reveals nothing about keys or providers."""
        return {"status": "ok", "version": __version__, "llm_configured": svc.llm_status()["configured"]}

    @app.get("/api/llm", dependencies=[Auth])
    def llm():
        return svc.llm_status()

    @app.get("/api/llm/check", dependencies=[Auth])
    def llm_check(request: Request):
        svc.enforce_rate_limit("llm-check", request.client.host if request.client else None)
        return svc.llm_check()

    # ---- sources ------------------------------------------------------
    @app.post("/api/sources/files", dependencies=[Auth])
    async def upload_files(sid: Session, files: list[UploadFile] = File(...)):
        if len(files) > settings.max_files_per_upload:
            raise HTTPException(400, f"At most {settings.max_files_per_upload} files per upload.")
        limit = settings.max_upload_mb * 1024 * 1024
        payload: list[tuple[str, bytes]] = []
        total = 0
        for f in files:
            data = await f.read(limit + 1)
            total += len(data)
            if total > limit:
                raise HTTPException(413, f"Upload exceeds {settings.max_upload_mb} MB.")
            payload.append((f.filename or "upload", data))
        try:
            src = svc.create_file_source(sid, payload)
        except ValueError as e:
            raise HTTPException(400, str(e))
        except Exception as e:
            raise HTTPException(400, f"Could not read file: {safe_error(e)}")
        return src.describe()

    @app.post("/api/sources/database", dependencies=[Auth])
    def connect_database(body: DatabaseConnect, sid: Session):
        try:
            url = body.url or build_url(body.type or "", body.host, body.port, body.username, body.password,
                                        body.database)
            src = svc.create_database_source(sid, url, name=body.name, schema=body.schema_name)
        except PermissionError as e:
            raise HTTPException(403, str(e))
        except Exception as e:
            secrets_ = [x for x in (body.url, body.password) if x]
            raise HTTPException(400, f"Could not connect: {safe_error(e, secrets_)}")
        return src.describe()

    @app.get("/api/sources", dependencies=[Auth])
    def list_sources(sid: Session):
        return [s.describe() for s in svc.list_sources(sid)]

    @app.delete("/api/sources/{source_id}", dependencies=[Auth])
    def delete_source(source_id: str, sid: Session):
        if not svc.delete_source(source_id, sid):
            raise HTTPException(404, "Source not found.")
        return {"deleted": source_id}

    # ---- ask ----------------------------------------------------------
    @app.post("/api/ask", dependencies=[Auth])
    def ask(body: AskRequest, sid: Session, request: Request):
        source = None
        if body.source_id:
            source = svc.get_source(body.source_id, sid)
            if source is None:
                raise HTTPException(404, "Source not found or expired - reconnect it.")
        ip = request.client.host if request.client else None  # real client IP behind proxies: --proxy-headers
        result = svc.ask(sid, body.question, source, client_ip=ip)
        status = 503 if result.error_code == "llm_unavailable" else 200  # SQL failures are a normal 200 + `error`
        return JSONResponse(result.to_dict(), status_code=status)

    # ---- history ------------------------------------------------------
    @app.get("/api/history", dependencies=[Auth])
    def history(sid: Session, limit: int = 100):
        return {"items": svc.history.list(sid, min(limit, 500)), "stats": svc.history.stats(sid)}

    @app.delete("/api/history", dependencies=[Auth])
    def clear_history(sid: Session):
        return {"deleted": svc.history.clear(sid)}

    return app


app = create_app()
