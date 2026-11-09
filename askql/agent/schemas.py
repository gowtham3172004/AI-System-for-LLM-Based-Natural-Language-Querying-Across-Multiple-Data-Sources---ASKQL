from __future__ import annotations

import json
import re
from typing import Any, Literal, TypeVar

from pydantic import BaseModel, Field, ValidationError

T = TypeVar("T", bound=BaseModel)


class Plan(BaseModel):
    """What the model decided to do with the user's message."""

    intent: Literal["sql", "chat"] = "sql"
    sql: str | None = None
    reply: str | None = None  # used when intent == "chat"
    assumptions: str | None = Field(default=None, description="Any interpretation made about ambiguous wording")


class ChartSpec(BaseModel):
    type: Literal["bar", "line", "pie", "scatter", "histogram", "area", "none"] = "none"
    x: str | None = None
    y: str | None = None
    color: str | None = None
    title: str | None = None


class Analysis(BaseModel):
    answer: str
    insights: list[str] = Field(default_factory=list)
    chart: ChartSpec = Field(default_factory=ChartSpec)
    followups: list[str] = Field(default_factory=list)


def message_text(content: Any) -> str:
    """Chat models return str or a list of content parts depending on provider."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(p if isinstance(p, str) else p.get("text", "") for p in content)
    return str(content)


_FENCE = re.compile(r"```(?:json|sql)?\s*(.*?)```", re.S | re.I)


def extract_json(text: str) -> dict:
    """Pull the first JSON object out of an LLM reply (handles code fences / chatter)."""
    m = _FENCE.search(text)
    candidates = [m.group(1)] if m else []
    candidates.append(text)
    for c in candidates:
        start = c.find("{")
        while start != -1:
            depth, in_str, esc = 0, False, False
            for i in range(start, len(c)):
                ch = c[i]
                if in_str:
                    if esc:
                        esc = False
                    elif ch == "\\":
                        esc = True
                    elif ch == '"':
                        in_str = False
                elif ch == '"':
                    in_str = True
                elif ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(c[start : i + 1])
                        except json.JSONDecodeError:
                            break
            start = c.find("{", start + 1)
    raise ValueError("No JSON object found in model output")


def parse_model(text: str, model: type[T]) -> T:
    try:
        return model.model_validate(extract_json(text))
    except (ValueError, ValidationError) as e:
        raise ValueError(f"Could not parse model output: {e}") from e
