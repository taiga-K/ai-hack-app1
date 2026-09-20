#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SKILL_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
REPO_ROOT=$(cd "${SKILL_DIR}/../../.." && pwd)

VERIFY_RUN_DIR=${VERIFY_RUN_DIR:-/tmp/verify-meeting-copilot}
VERIFY_RUN_DIR=$("${SCRIPT_DIR}/path-guard.py" --run "${VERIFY_RUN_DIR}")
VERIFY_FRONTEND_HOST=${VERIFY_FRONTEND_HOST:-127.0.0.1}
VERIFY_FRONTEND_PORT=${VERIFY_FRONTEND_PORT:-3100}
VERIFY_BACKEND_PORT=${VERIFY_BACKEND_PORT:-8010}
VERIFY_WITH_BACKEND=${VERIFY_WITH_BACKEND:-0}
FRONTEND_URL="http://${VERIFY_FRONTEND_HOST}:${VERIFY_FRONTEND_PORT}"
BACKEND_URL="http://127.0.0.1:${VERIFY_BACKEND_PORT}"

port_is_listening() {
  local port=$1
  python3 - "${port}" <<'PY'
import os
import sys

port_hex = f"{int(sys.argv[1]):04X}"
for path in ("/proc/net/tcp", "/proc/net/tcp6"):
    if not os.path.exists(path):
        continue
    with open(path, encoding="utf-8") as handle:
        next(handle, None)
        for line in handle:
            parts = line.split()
            if len(parts) < 4:
                continue
            local = parts[1]
            state = parts[3]
            if state != "0A":
                continue
            _ip, listen_port = local.split(":")
            if listen_port.upper() == port_hex:
                sys.exit(0)
sys.exit(1)
PY
}

is_alive() {
  local pid=$1
  [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null
}

mkdir -p "${VERIFY_RUN_DIR}"

if [[ -f "${VERIFY_RUN_DIR}/launch.json" ]]; then
  echo "launch.json already exists in ${VERIFY_RUN_DIR}." >&2
  echo "Run doctor.sh, or cleanup.sh if this run does not own the instance." >&2
  exit 1
fi

if port_is_listening "${VERIFY_FRONTEND_PORT}"; then
  echo "Port ${VERIFY_FRONTEND_PORT} is already listening. Refusing to share that instance. Run cleanup.sh if it is ours." >&2
  exit 1
fi

if [[ "${VERIFY_WITH_BACKEND}" == "1" ]]; then
  if port_is_listening "${VERIFY_BACKEND_PORT}"; then
    echo "Port ${VERIFY_BACKEND_PORT} is already listening. Refusing to share that instance. Run cleanup.sh if it is ours." >&2
    exit 1
  fi
fi

if [[ ! -d "${REPO_ROOT}/frontend/node_modules" ]]; then
  (cd "${REPO_ROOT}/frontend" && pnpm install)
fi

BACKEND_PID=""
if [[ "${VERIFY_WITH_BACKEND}" == "1" ]]; then
  if ! command -v uv >/dev/null 2>&1; then
    echo "uv is required for VERIFY_WITH_BACKEND=1. Install uv or keep VERIFY_WITH_BACKEND=0 for おためし." >&2
    exit 1
  fi
  : >"${VERIFY_RUN_DIR}/backend.log"
  setsid bash -c "
    cd \"${REPO_ROOT}/backend\"
    exec uv run uvicorn main:app --reload --host 127.0.0.1 --port ${VERIFY_BACKEND_PORT}
  " </dev/null >"${VERIFY_RUN_DIR}/backend.log" 2>&1 &
  BACKEND_PID=$!
  echo "${BACKEND_PID}" >"${VERIFY_RUN_DIR}/backend.pid"
fi

: >"${VERIFY_RUN_DIR}/frontend.log"
FRONTEND_ENV=(env)
if [[ "${VERIFY_WITH_BACKEND}" == "1" ]]; then
  FRONTEND_ENV+=(BACKEND_HTTP_ORIGIN="${BACKEND_URL}")
fi
# Same Next.js dev server as README `pnpm run dev`. Extra `--` must not
# be forwarded: Next 16 treats a leading `--hostname` as a project path.
setsid bash -c "
  cd \"${REPO_ROOT}/frontend\"
  exec ${FRONTEND_ENV[*]} pnpm exec next dev --hostname ${VERIFY_FRONTEND_HOST} --port ${VERIFY_FRONTEND_PORT}
" </dev/null >"${VERIFY_RUN_DIR}/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "${FRONTEND_PID}" >"${VERIFY_RUN_DIR}/frontend.pid"

ready=0
for _ in $(seq 1 120); do
  if ! is_alive "${FRONTEND_PID}"; then
    echo "Frontend process ${FRONTEND_PID} exited before becoming ready. See ${VERIFY_RUN_DIR}/frontend.log" >&2
    exit 1
  fi
  body=$(curl -fsS "${FRONTEND_URL}/" 2>/dev/null || true)
  if [[ "${body}" == *"会議がおわると"* && "${body}" == *"相手の画面には出ません"* ]]; then
    ready=1
    break
  fi
  sleep 1
done

if [[ "${ready}" != "1" ]]; then
  echo "Frontend at ${FRONTEND_URL} did not become ready within 120s. See ${VERIFY_RUN_DIR}/frontend.log" >&2
  exit 1
fi

if [[ "${VERIFY_WITH_BACKEND}" == "1" ]]; then
  backend_ready=0
  for _ in $(seq 1 60); do
    if ! is_alive "${BACKEND_PID}"; then
      echo "Backend process ${BACKEND_PID} exited before becoming ready. See ${VERIFY_RUN_DIR}/backend.log" >&2
      exit 1
    fi
    health=$(curl -fsS "${BACKEND_URL}/api/v1/health" 2>/dev/null || true)
    if [[ "${health}" == *'"status":"healthy"'* || "${health}" == *'"status": "healthy"'* ]]; then
      backend_ready=1
      break
    fi
    sleep 1
  done
  if [[ "${backend_ready}" != "1" ]]; then
    echo "Backend at ${BACKEND_URL}/api/v1/health did not become ready. See ${VERIFY_RUN_DIR}/backend.log" >&2
    exit 1
  fi
fi

cat >"${VERIFY_RUN_DIR}/launch.json" <<EOF
{
  "frontend_url": "${FRONTEND_URL}",
  "frontend_host": "${VERIFY_FRONTEND_HOST}",
  "frontend_port": ${VERIFY_FRONTEND_PORT},
  "frontend_pid": ${FRONTEND_PID},
  "backend_url": $([[ "${VERIFY_WITH_BACKEND}" == "1" ]] && echo "\"${BACKEND_URL}\"" || echo "null"),
  "backend_port": $([[ "${VERIFY_WITH_BACKEND}" == "1" ]] && echo "${VERIFY_BACKEND_PORT}" || echo "null"),
  "backend_pid": $([[ -n "${BACKEND_PID}" ]] && echo "${BACKEND_PID}" || echo "null"),
  "with_backend": $([[ "${VERIFY_WITH_BACKEND}" == "1" ]] && echo "true" || echo "false"),
  "repo_root": "${REPO_ROOT}"
}
EOF

echo "Ready ${FRONTEND_URL}"
if [[ "${VERIFY_WITH_BACKEND}" == "1" ]]; then
  echo "Backend ${BACKEND_URL} (health OK)"
fi
echo "Wrote ${VERIFY_RUN_DIR}/launch.json"
