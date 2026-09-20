#!/usr/bin/env python3
"""Resolve a helper path and reject anything outside the allowed prefixes."""

from __future__ import annotations

import os
import sys


def resolve(raw: str) -> str:
    if raw.strip() == "":
        raise SystemExit("path is empty")
    return os.path.realpath(os.path.abspath(raw))


def is_tmp_child(resolved: str) -> bool:
    return resolved.startswith("/tmp/") and resolved != "/tmp"


def is_store_media(resolved: str) -> bool:
    parts = [part for part in resolved.split("/") if part != ""]
    if len(parts) < 5:
        return False
    return (
        parts[0] == "cursor"
        and parts[1] == "stores"
        and parts[2] not in {".", ".."}
        and parts[3] == "media"
        and parts[4] not in {".", ".."}
    )


def require_host(raw: str) -> str:
    if raw == "" or not all(
        char.isalnum() or char in {".", "_", ":", "-"} for char in raw
    ):
        print(
            f"Rejected --host {raw!r}. Must match [A-Za-z0-9._:-]+ "
            "(no $, backticks, spaces, or other shell metacharacters).",
            file=sys.stderr,
        )
        raise SystemExit(1)
    return raw


def require_port(raw: str) -> str:
    if not raw.isdigit() or (len(raw) > 1 and raw.startswith("0")):
        print(
            f"Rejected --port {raw!r}. Must be an integer 1-65535.",
            file=sys.stderr,
        )
        raise SystemExit(1)
    value = int(raw)
    if value < 1 or value > 65535:
        print(
            f"Rejected --port {raw!r}. Must be an integer 1-65535.",
            file=sys.stderr,
        )
        raise SystemExit(1)
    return str(value)


def main() -> None:
    if len(sys.argv) != 3 or sys.argv[1] not in {
        "--run",
        "--evidence",
        "--host",
        "--port",
    }:
        raise SystemExit("usage: path-guard.py --run|--evidence|--host|--port VALUE")
    kind = sys.argv[1]
    raw = sys.argv[2]
    if kind == "--host":
        print(require_host(raw))
        return
    if kind == "--port":
        print(require_port(raw))
        return
    resolved = resolve(raw)
    if kind == "--run":
        allowed = is_tmp_child(resolved)
        expected = "/tmp/<name>"
    else:
        allowed = is_tmp_child(resolved) or is_store_media(resolved)
        expected = "/tmp/<name> or /cursor/stores/<id>/media/<name>"
    if not allowed:
        print(
            f"Rejected {kind} path {raw!r} -> {resolved!r}. Must resolve under {expected}.",
            file=sys.stderr,
        )
        raise SystemExit(1)
    print(resolved)


if __name__ == "__main__":
    main()
