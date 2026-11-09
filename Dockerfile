FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

# Run as a non-root user (Hugging Face Spaces requires uid 1000)
RUN useradd -m -u 1000 askql && mkdir -p /app/data && chown askql:askql /app/data
COPY --chown=askql:askql . .
USER askql

# 7860 = Hugging Face Spaces default; Render/Fly inject $PORT.
# ALLOW_LOCAL_DATABASES defaults to false in the app; it is pinned here so an image can never be
# deployed publicly with SSRF protection accidentally off unless you override it on purpose.
ENV PORT=7860 \
    ALLOW_LOCAL_DATABASES=false \
    HISTORY_DB_URL=sqlite:////app/data/askql_history.db \
    STREAMLIT_SERVER_HEADLESS=true \
    STREAMLIT_BROWSER_GATHER_USAGE_STATS=false
EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD python -c "import os,urllib.request as u; u.urlopen('http://127.0.0.1:%s%s' % (os.environ.get('PORT','7860'), '/health' if os.environ.get('APP')=='api' else '/_stcore/health'), timeout=4)"

# APP=ui (default) serves the Streamlit app, APP=api serves the FastAPI REST API.
# --proxy-headers: behind Render/HF/Fly the real client IP comes from X-Forwarded-For (per-IP rate limits).
CMD ["sh", "-c", "if [ \"$APP\" = \"api\" ]; then exec uvicorn askql.api.app:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'; else exec streamlit run app/streamlit_app.py --server.port=${PORT} --server.address=0.0.0.0; fi"]
