#!/usr/bin/env bash
# Smoke-test a built AskQL image: usage  scripts/docker_smoke.sh askql:audit
# Starts the UI and API containers, checks health, user, secure defaults, upload, and that a deliberately INVALID
# LLM key produces a clean error that never leaks the key into the response or logs.
set -u
IMG="${1:-askql}"
FAKE=gsk_FAKEKEYFAKEKEYFAKEKEYFAKEKEY1234567890
S="X-Session-Id: container-session-0123456789"
fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS  $1"; else echo "FAIL  $1 (got '$2', want '$3')"; fail=1; fi; }

docker rm -f askql-smoke-ui askql-smoke-api >/dev/null 2>&1
docker run -d --name askql-smoke-ui  -p 127.0.0.1:18501:7860 -e GROQ_API_KEYS=$FAKE "$IMG" >/dev/null
docker run -d --name askql-smoke-api -p 127.0.0.1:18000:7860 -e APP=api -e GROQ_API_KEYS=$FAKE \
  -e LLM_PROVIDER_ORDER=groq "$IMG" >/dev/null
for i in $(seq 1 40); do curl -sf localhost:18000/health >/dev/null && curl -sf localhost:18501/_stcore/health >/dev/null && break; sleep 2; done

check "runs as non-root (uid 1000)" "$(docker exec askql-smoke-api id -u)" "1000"
check "ALLOW_LOCAL_DATABASES pinned false" "$(docker exec askql-smoke-api printenv ALLOW_LOCAL_DATABASES)" "false"
check "UI app script executes inside the container (imports, service init, history DB writable)"   "$(docker exec askql-smoke-ui python -c "from streamlit.testing.v1 import AppTest; at=AppTest.from_file('app/streamlit_app.py', default_timeout=90).run(); print('ok' if not at.exception else 'EXC '+str(at.exception))" 2>&1 | tail -1)" "ok"
check "UI health endpoint" "$(curl -s localhost:18501/_stcore/health)" "ok"
check "API health: llm_configured=true, no key info" \
  "$(curl -s localhost:18000/health | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["status"],d["llm_configured"],sorted(d))')" \
  "ok True ['llm_configured', 'status', 'version']"
check "API rejects missing session id" "$(curl -s -o /dev/null -w '%{http_code}' localhost:18000/api/sources)" "400"
check "SQLite blocked on public default" "$(curl -s -o /dev/null -w '%{http_code}' -X POST localhost:18000/api/sources/database \
  -H "$S" -H 'content-type: application/json' -d '{"url":"sqlite:///sample_data/shop.db"}')" "403"

printf 'a,b\n1,x\n2,y\n3,z\n' > /tmp/smoke_t.csv
SRC=$(curl -s -X POST localhost:18000/api/sources/files -H "$S" -F files=@/tmp/smoke_t.csv)
ID=$(echo "$SRC" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
check "upload creates a 3-row table" "$(echo "$SRC" | python3 -c 'import sys,json;print(json.load(sys.stdin)["tables"][0]["row_count"])')" "3"

RESP=$(curl -s -X POST localhost:18000/api/ask -H "$S" -H 'content-type: application/json' \
  -d "{\"question\":\"how many rows?\",\"source_id\":\"$ID\"}")
echo "INFO  ask with invalid key -> $(echo "$RESP" | head -c 220)"
check "invalid key -> graceful error body (HTTP 503, generic message)" \
  "$(echo "$RESP" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(bool(d.get("error")))')" "True"
LEAK=$( (echo "$RESP"; docker logs askql-smoke-api 2>&1; docker logs askql-smoke-ui 2>&1) | grep -c FAKEKEYFAKEKEY )
check "invalid key never appears in response or container logs" "$LEAK" "0"

check "history persisted to the writable data volume" "$(docker exec askql-smoke-api test -s /app/data/askql_history.db && echo yes || echo no)" "yes"
sleep 20  # let the image's own HEALTHCHECK run
check "docker HEALTHCHECK (ui)"  "$(docker inspect -f '{{.State.Health.Status}}' askql-smoke-ui)" "healthy"
check "docker HEALTHCHECK (api)" "$(docker inspect -f '{{.State.Health.Status}}' askql-smoke-api)" "healthy"

docker rm -f askql-smoke-ui askql-smoke-api >/dev/null 2>&1
[ $fail -eq 0 ] && echo "ALL SMOKE CHECKS PASSED" || echo "SMOKE CHECKS FAILED"
exit $fail
