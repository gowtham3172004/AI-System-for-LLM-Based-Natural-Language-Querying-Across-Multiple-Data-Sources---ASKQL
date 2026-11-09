"""Check that numbers quoted in an LLM answer actually come from the query result.

The SQL result is the source of truth; the model's prose is not. Any figure in the answer that cannot be
traced to a result cell, a column statistic, the row/column count or the user's own question is reported
so the UI can warn the user instead of silently presenting a possibly fabricated number.
"""
from __future__ import annotations

import re

import pandas as pd

_NUM = re.compile(r"(?<![\w.])[-+]?\$?\d[\d,]*(?:\.\d+)?%?")
_MAX_CELLS = 20000
FREE_INTS = range(0, 11)  # "top 3", "2 regions", "step 1" - counting words, not data claims


def _parse(tok: str) -> tuple[float, int] | None:
    t = tok.replace("$", "").replace(",", "").rstrip("%").lstrip("+")
    try:
        v = float(t)
    except ValueError:
        return None
    dec = len(t.split(".")[1]) if "." in t else 0
    return v, dec


def numbers_in(text: str) -> list[tuple[str, float, int]]:
    out = []
    for m in _NUM.finditer(text or ""):
        p = _parse(m.group(0))
        if p:
            out.append((m.group(0), *p))
    return out


def _known_values(df: pd.DataFrame, row_count: int) -> list[float]:
    vals: list[float] = [float(row_count), float(len(df.columns))]
    budget = _MAX_CELLS
    for c in df.columns:
        s = df[c]
        if pd.api.types.is_bool_dtype(s):
            continue
        if pd.api.types.is_numeric_dtype(s):
            n = s.dropna()
            if n.empty:
                continue
            vals += [float(x) for x in n.head(budget)]
            vals += [float(n.min()), float(n.max()), float(n.mean()), float(n.sum()), float(n.median()),
                     float(n.nunique())]
        elif pd.api.types.is_datetime64_any_dtype(s):
            d = s.dropna().head(budget)
            vals += [float(x) for x in d.dt.year.unique()] + [float(x) for x in d.dt.month.unique()]
            vals += [float(x) for x in d.dt.day.unique()]
        else:
            for v in s.dropna().astype(str).head(min(budget, 2000)):
                vals += [p[0] for p in (_parse(m.group(0)) for m in _NUM.finditer(v)) if p]
            vals.append(float(s.nunique()))
        budget = max(budget - len(s), 0)
    return vals


def _matches(x: float, dec: int, known: list[float], percent: bool) -> bool:
    cands = list(known)
    if percent:  # 0.256 stored, "25.6%" quoted
        cands += [k * 100 for k in known if -1.0 <= k <= 1.0]
    for k in cands:
        if round(k, dec) == x or abs(round(k, dec) - x) < 1e-9:
            return True
        if k and abs(k - x) <= 0.005 * abs(k):  # rounded/abbreviated within 0.5%
            return True
    # "1.2M" / "3.4K" style abbreviations are rare; handled by the 0.5% window on scaled values below
    for scale in (1e3, 1e6, 1e9):
        if any(k and abs(k / scale - x) <= 0.01 * abs(k / scale) for k in known if abs(k) >= scale):
            return True
    return False


def ungrounded_numbers(texts: list[str], df: pd.DataFrame, row_count: int, question: str = "") -> list[str]:
    """Numbers in `texts` that cannot be found in (or derived from) the result. Empty list = all grounded."""
    known = _known_values(df, row_count) + [v for _, v, _ in numbers_in(question)]
    bad: list[str] = []
    for text in texts:
        for tok, x, dec in numbers_in(text):
            if dec == 0 and x == int(x) and int(x) in FREE_INTS:
                continue
            if not _matches(x, dec, known, tok.endswith("%")):
                if tok not in bad:
                    bad.append(tok)
    return bad[:6]
