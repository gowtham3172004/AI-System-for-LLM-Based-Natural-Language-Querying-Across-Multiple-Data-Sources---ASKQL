"""Central configuration, loaded from environment variables / a .env file."""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _split(value: str | list[str] | None) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [v.strip() for v in value if v and v.strip()]
    return [v.strip() for v in value.split(",") if v.strip()]


def _dedupe(items: list[str]) -> list[str]:
    return list(dict.fromkeys(items))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ---- LLM providers -------------------------------------------------
    # Order in which providers are tried. Later ones are fallbacks.
    llm_provider_order: str = "groq,gemini,ollama"
    llm_temperature: float = 0.0
    llm_timeout_seconds: int = 60
    llm_max_retries: int = 1
    llm_tries_per_provider: int = 2  # bounds worst-case latency when many keys are configured

    # Comma-separated lists -> multiple keys are rotated and used as fallbacks.
    groq_api_keys: str = Field(default="", repr=False)
    groq_api_key: str = Field(default="", repr=False)  # single-key alias
    groq_model: str = "llama-3.3-70b-versatile"

    gemini_api_keys: str = Field(default="", repr=False)
    gemini_api_key: str = Field(default="", repr=False)  # single-key alias
    gemini_model: str = "gemini-flash-latest"  # alias that tracks the current Flash model

    ollama_base_url: str = ""  # e.g. http://localhost:11434 ; empty disables Ollama
    ollama_model: str = "llama3.1"

    # ---- Query safety --------------------------------------------------
    max_result_rows: int = 1000
    query_timeout_seconds: int = 30
    max_repair_attempts: int = 2
    max_upload_mb: int = 50
    max_files_per_upload: int = 10
    max_rows_per_file: int = 1_000_000
    duckdb_memory_limit: str = "512MB"
    # Secure default. Set true ONLY for local/private use: it allows SQLite files and private/loopback DB hosts.
    allow_local_databases: bool = False
    # False: never send sample values / result rows to the LLM (schema + SQL only)
    llm_send_data: bool = True

    # ---- App -----------------------------------------------------------
    askql_api_key: str = Field(default="", repr=False)  # if set, the REST API requires `X-API-Key`
    history_db_url: str = Field(default="sqlite:///askql_history.db", repr=False)  # may hold a DB password
    # Abuse protection for your LLM quota (per browser/API session, per client IP, and overall)
    rate_limit_per_minute: int = 15
    ip_rate_limit_per_minute: int = 30
    global_rate_limit_per_minute: int = 90
    cors_origins: str = "*"
    log_level: str = "INFO"

    @field_validator("log_level")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.upper()

    # ---- helpers -------------------------------------------------------
    @property
    def provider_order(self) -> list[str]:
        return [p.lower() for p in _split(self.llm_provider_order)]

    @property
    def groq_keys(self) -> list[str]:
        return _dedupe(_split(self.groq_api_keys) + _split(self.groq_api_key))

    @property
    def gemini_keys(self) -> list[str]:
        return _dedupe(_split(self.gemini_api_keys) + _split(self.gemini_api_key))

    @property
    def cors_origin_list(self) -> list[str]:
        return _split(self.cors_origins) or ["*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
