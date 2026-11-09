"""Turn a result DataFrame + ChartSpec into a Plotly figure."""
from __future__ import annotations

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

from askql.agent.schemas import ChartSpec

MAX_POINTS = 5000


def auto_chart(df: pd.DataFrame) -> ChartSpec:
    """Heuristic chart when the model didn't suggest a usable one."""
    if df.empty or len(df.columns) < 2 or len(df) < 2:
        return ChartSpec()
    num = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c]) and not pd.api.types.is_bool_dtype(df[c])]
    dt = [c for c in df.columns if pd.api.types.is_datetime64_any_dtype(df[c])]
    cat = [c for c in df.columns if c not in num and c not in dt]
    if dt and num:
        return ChartSpec(type="line", x=dt[0], y=num[0])
    if cat and num and df[cat[0]].nunique() <= 30:
        return ChartSpec(type="bar", x=cat[0], y=num[0])
    if len(num) >= 2:
        return ChartSpec(type="scatter", x=num[0], y=num[1])
    return ChartSpec()


def build_figure(df: pd.DataFrame, spec: ChartSpec) -> go.Figure | None:
    if spec.type == "none" or df.empty:
        return None
    d = df.head(MAX_POINTS)
    title = spec.title or None
    kw = dict(title=title, template="plotly_white")
    try:
        if spec.type == "bar":
            fig = px.bar(d, x=spec.x, y=spec.y, color=spec.color, **kw)
        elif spec.type == "line":
            fig = px.line(d.sort_values(spec.x), x=spec.x, y=spec.y, color=spec.color, markers=True, **kw)
        elif spec.type == "area":
            fig = px.area(d.sort_values(spec.x), x=spec.x, y=spec.y, color=spec.color, **kw)
        elif spec.type == "pie":
            fig = px.pie(d, names=spec.x, values=spec.y, **kw)
        elif spec.type == "scatter":
            fig = px.scatter(d, x=spec.x, y=spec.y, color=spec.color, **kw)
        elif spec.type == "histogram":
            fig = px.histogram(d, x=spec.x, color=spec.color, **kw)
        else:
            return None
    except Exception:  # bad column / dtype combination from the model - fall back to no chart
        return None
    fig.update_layout(margin=dict(l=10, r=10, t=50 if title else 10, b=10), height=380)
    return fig
