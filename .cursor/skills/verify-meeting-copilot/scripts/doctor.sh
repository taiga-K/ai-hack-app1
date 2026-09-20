#!/usr/bin/env bash
set -euo pipefail

VERIFY_RUN_DIR=${VERIFY_RUN_DIR:-/tmp/verify-meeting-copilot}
LAUNCH_JSON="${VERIFY_RUN_DIR}/launch.json"

listening_pid() {
  local port=$1
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null | head -n1 || true
    return
  fi
  ss -lptn "sport = :${port}" 2>/dev/null | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | head -n1 || true
}

is_alive() {
  local pid=$1
  [[ -n "${pid}" && "${pid}" != "null" ]] && kill -0 "${pid}" 2>/dev/null
}

json_field() {
  local key=$1
  python3 -c "
import json, sys
value = json.load(sys.stdin).get(sys.argv[1])
if value is None:
    print('')
elif isinstance(value, bool):
    print('true' if value else 'false')
else:
    print(value)
" "${key}" <"${LAUNCH_JSON}"
}

if [[ ! -f "${LAUNCH_JSON}" ]]; then
  echo "Doctor fail: ${LAUNCH_JSON} is missing. This run did not launch an instance." >&2
  exit 1
fi

frontend_pid=$(json_field frontend_pid)
frontend_port=$(json_field frontend_port)
frontend_url=$(json_field frontend_url)
with_backend=$(json_field with_backend)
backend_pid=$(json_field backend_pid)
backend_port=$(json_field backend_port)
backend_url=$(json_field backend_url)

if ! is_alive "${frontend_pid}"; then
  echo "Doctor fail: frontend PID ${frontend_pid} is not alive." >&2
  exit 1
fi

owner=$(listening_pid "${frontend_port}")
if [[ -z "${owner}" ]]; then
  echo "Doctor fail: nothing is listening on ${frontend_port}." >&2
  exit 1
fi

# next-dev may listen from a child of the setsid PID we recorded.
if [[ "${owner}" != "${frontend_pid}" ]]; then
  owner_pgid=$(ps -o pgid= -p "${owner}" 2>/dev/null | tr -d ' ')
  launch_pgid=$(ps -o pgid= -p "${frontend_pid}" 2>/dev/null | tr -d ' ')
  if [[ -z "${owner_pgid}" || "${owner_pgid}" != "${launch_pgid}" ]]; then
    echo "Doctor fail: port ${frontend_port} is owned by PID ${owner}, not our group ${frontend_pid}." >&2
    exit 1
  fi
fi

body=$(curl -fsS "${frontend_url}/")
status=$(curl -sS -o /dev/null -w "%{http_code}" "${frontend_url}/")
if [[ "${status}" != "200" ]]; then
  echo "Doctor fail: GET ${frontend_url}/ returned HTTP ${status}." >&2
  exit 1
fi
if [[ "${body}" != *"会議がおわると"* || "${body}" != *"おためし"* ]]; then
  echo "Doctor fail: home HTML is missing 会議がおわると / おためし. Wrong app on ${frontend_url}." >&2
  exit 1
fi

echo "Frontend OK  pid=${frontend_pid} port=${frontend_port} url=${frontend_url}"

if [[ "${with_backend}" == "True" || "${with_backend}" == "true" ]]; then
  if ! is_alive "${backend_pid}"; then
    echo "Doctor fail: backend PID ${backend_pid} is not alive." >&2
    exit 1
  fi
  backend_owner=$(listening_pid "${backend_port}")
  if [[ -z "${backend_owner}" ]]; then
    echo "Doctor fail: nothing is listening on backend port ${backend_port}." >&2
    exit 1
  fi
  if [[ "${backend_owner}" != "${backend_pid}" ]]; then
    owner_pgid=$(ps -o pgid= -p "${backend_owner}" 2>/dev/null | tr -d ' ')
    launch_pgid=$(ps -o pgid= -p "${backend_pid}" 2>/dev/null | tr -d ' ')
    if [[ -z "${owner_pgid}" || "${owner_pgid}" != "${launch_pgid}" ]]; then
      echo "Doctor fail: port ${backend_port} is owned by PID ${backend_owner}, not our group ${backend_pid}." >&2
      exit 1
    fi
  fi
  health=$(curl -fsS "${backend_url}/api/v1/health")
  if [[ "${health}" != *'"status":"healthy"'* && "${health}" != *'"status": "healthy"'* ]]; then
    echo "Doctor fail: health body is not healthy: ${health}" >&2
    exit 1
  fi
  if [[ "${health}" != *'"version"'* ]]; then
    echo "Doctor fail: health body has no version: ${health}" >&2
    exit 1
  fi
  echo "Backend OK   pid=${backend_pid} port=${backend_port} url=${backend_url}"
else
  echo "Backend skipped (VERIFY_WITH_BACKEND=0 / おためし path)"
fi

echo "Doctor pass"
