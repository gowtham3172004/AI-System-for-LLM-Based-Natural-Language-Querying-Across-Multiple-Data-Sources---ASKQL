from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pandas as pd


@dataclass
class ColumnInfo:
    name: str
    type: str
    samples: list[Any] = field(default_factory=list)
    nullable: bool = True
    primary_key: bool = False


@dataclass
class ForeignKey:
    columns: list[str]
    ref_table: str
    ref_columns: list[str]


@dataclass
class TableInfo:
    name: str
    columns: list[ColumnInfo]
    row_count: int | None = None
    foreign_keys: list[ForeignKey] = field(default_factory=list)

    def to_prompt(self, samples: bool = True) -> str:
        lines = [f"TABLE {self.name}" + (f"  (~{self.row_count} rows)" if self.row_count is not None else "")]
        for c in self.columns:
            extra = []
            if c.primary_key:
                extra.append("PK")
            if samples and c.samples:
                extra.append("e.g. " + ", ".join(repr(s) for s in c.samples[:3]))
            lines.append(f"  - {c.name} {c.type}" + (f"  [{'; '.join(extra)}]" if extra else ""))
        for fk in self.foreign_keys:
            lines.append(
                f"  FK: ({', '.join(fk.columns)}) -> {fk.ref_table}({', '.join(fk.ref_columns)})"
            )
        return "\n".join(lines)


@dataclass
class QueryResult:
    df: pd.DataFrame
    truncated: bool
    elapsed_ms: float

    @property
    def row_count(self) -> int:
        return len(self.df)

    def to_records(self) -> list[dict[str, Any]]:
        # round-trip via JSON so numpy/Timestamp/Decimal values become plain JSON types
        import json

        return json.loads(self.df.to_json(orient="records", date_format="iso", default_handler=str))
