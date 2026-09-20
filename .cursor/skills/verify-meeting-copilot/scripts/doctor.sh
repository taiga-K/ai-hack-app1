#!/usr/bin/env bash
set -euo pipefail

VERIFY_RUN_DIR=${VERIFY_RUN_DIR:-/tmp/verify-meeting-copilot}
LAUNCH_JSON="${VERIFY_RUN_DIR}/launch.json"

port_owned_by_tree() {
  local port=$1
  local root_pid=$2
  python3 - "${port}" "${root_pid}" <<'PY'
import os
import sys

port = int(sys.argv[1])
root = int(sys.argv[2])
hex_port = f"{port:04X}"


def listening_inodes(port_hex: str) -> set[str]:
    found: set[str] = set()
    for path in ("/proc/net/tcp", "/proc/net/tcp6"):
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as handle:
            next(handle, None)
            for line in handle:
                parts = line.split()
                if len(parts) < 10:
                    continue
                local = parts[1]
                state = parts[3]
                inode = parts[9]
                if state != "0A":
                    continue
                _ip, listen_port = local.split(":")
                if listen_port.upper() == port_hex:
                    found.add(inode)
    return found


def children_of(pid: int) -> list[int]:
    kids: list[int] = []
    for entry in os.listdir("/proc"):
        if not entry.isdigit():
            continue
        try:
            with open(f"/proc/{entry}/stat", encoding="utf-8") as handle:
                stat = handle.read()
            close = stat.rfind(")")
            fields = stat[close + 2 :].split()
            ppid = int(fields[1])
        except (OSError, ValueError, IndexError):
            continue
        if ppid == pid:
            kids.append(int(entry))
    return kids


def walk(pid: int) -> list[int]:
    seen = [pid]
    stack = [pid]
    while stack:
        current = stack.pop()
        for child in children_of(current):
            if child not in seen:
                seen.append(child)
                stack.append(child)
    return seen


def pid_has_inode(pid: int, inodes: set[str]) -> bool:
    fd_dir = f"/proc/{pid}/fd"
    try:
        names = os.listdir(fd_dir)
    except OSError:
        return False
    for name in names:
        try:
            target = os.readlink(os.path.join(fd_dir, name))
        except OSError:
            continue
        if target.startswith("socket:[") and target[8:-1] in inodes:
            return True
    return False


inodes = listening_inodes(hex_port)
if not inodes:
    sys.exit(2)

for candidate in walk(root):
    if pid_has_inode(candidate, inodes):
        print(candidate)
        sys.exit(0)
sys.exit(1)
PY
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

owner=""
if owner=$(port_owned_by_tree "${frontend_port}" "${frontend_pid}"); then
  :
else
  status=$?
  if [[ "${status}" == "2" ]]; then
    echo "Doctor fail: nothing is listening on ${frontend_port}." >&2
  else
    echo "Doctor fail: port ${frontend_port} is not owned by PID ${frontend_pid} or its descendants." >&2
  fi
  exit 1
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
  backend_owner=""
  if backend_owner=$(port_owned_by_tree "${backend_port}" "${backend_pid}"); then
    :
  else
    status=$?
    if [[ "${status}" == "2" ]]; then
      echo "Doctor fail: nothing is listening on backend port ${backend_port}." >&2
    else
      echo "Doctor fail: port ${backend_port} is not owned by PID ${backend_pid} or its descendants." >&2
    fi
    exit 1
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
