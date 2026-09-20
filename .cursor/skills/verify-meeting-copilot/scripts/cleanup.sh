#!/usr/bin/env bash
set -euo pipefail

VERIFY_RUN_DIR=${VERIFY_RUN_DIR:-/tmp/verify-meeting-copilot}
LAUNCH_JSON="${VERIFY_RUN_DIR}/launch.json"

is_alive() {
  local pid=$1
  [[ -n "${pid}" && "${pid}" != "null" ]] && kill -0 "${pid}" 2>/dev/null
}

stop_pid() {
  local pid=$1
  local label=$2
  if [[ -z "${pid}" || "${pid}" == "null" ]]; then
    return
  fi
  if ! is_alive "${pid}"; then
    echo "${label} PID ${pid} already gone"
    return
  fi
  local pgid
  pgid=$(ps -o pgid= -p "${pid}" 2>/dev/null | tr -d ' ' || true)
  if [[ -n "${pgid}" ]]; then
    kill -- "-${pgid}" 2>/dev/null || kill "${pid}" 2>/dev/null || true
  else
    kill "${pid}" 2>/dev/null || true
  fi
  for _ in $(seq 1 20); do
    if ! is_alive "${pid}"; then
      echo "Stopped ${label} PID ${pid}"
      return
    fi
    sleep 0.2
  done
  if is_alive "${pid}"; then
    if [[ -n "${pgid}" ]]; then
      kill -9 -- "-${pgid}" 2>/dev/null || kill -9 "${pid}" 2>/dev/null || true
    else
      kill -9 "${pid}" 2>/dev/null || true
    fi
    echo "Force-stopped ${label} PID ${pid}"
  fi
}

if [[ ! -d "${VERIFY_RUN_DIR}" ]]; then
  echo "Nothing to clean: ${VERIFY_RUN_DIR} does not exist"
  exit 0
fi

if [[ -f "${LAUNCH_JSON}" ]]; then
  frontend_pid=$(python3 -c "import json,sys; print(json.load(sys.stdin).get('frontend_pid'))" <"${LAUNCH_JSON}")
  backend_pid=$(python3 -c "import json,sys; print(json.load(sys.stdin).get('backend_pid'))" <"${LAUNCH_JSON}")
  stop_pid "${frontend_pid}" "frontend"
  stop_pid "${backend_pid}" "backend"
else
  echo "No launch.json; removing leftover scratch only"
fi

# Extra pid files if launch died mid-write.
if [[ -f "${VERIFY_RUN_DIR}/frontend.pid" ]]; then
  stop_pid "$(cat "${VERIFY_RUN_DIR}/frontend.pid")" "frontend-pidfile"
fi
if [[ -f "${VERIFY_RUN_DIR}/backend.pid" ]]; then
  stop_pid "$(cat "${VERIFY_RUN_DIR}/backend.pid")" "backend-pidfile"
fi

rm -rf "${VERIFY_RUN_DIR}"
echo "Removed scratch ${VERIFY_RUN_DIR}"
echo "Evidence directories were not touched"
