---
name: verify-meeting-copilot
description: "Drive the AI HACK APP1 meeting-copilot web app (Next.js frontend + FastAPI backend) the way a user does. Use when proving UI behavior, reproducing a meeting-floor / まとめ / 戻る bug, or capturing screenshots and video of the real product surface."
---

# Verify Meeting Copilot

Agent-facing skill for the primary user surface: the meeting-copilot browser app. A later agent will read this cold. Follow the sections in order. Do not invent a login. There is no first-time auth.

Secondary surfaces (do not treat as the primary drive target): FastAPI at `/api/v1/*` and `/ws/meetings/{id}/audio`, plus `frontend/e2e/meeting-flow.spec.ts` as a Playwright regression harness. Use those only as documented below.

## Interview snapshot

- **Surface:** browser UI at `/` (home), `/meetings/{id}` (floor), `/meetings/{id}/document` (まとめ). Japanese copy. No account, no password, no OAuth.
- **Run (repo docs):** `cd backend && uv run uvicorn main:app --reload --port 8000` and `cd frontend && pnpm run dev` → `http://localhost:3000`. Verification uses the same Next.js / Uvicorn processes on isolated ports (`pnpm exec next dev --hostname 127.0.0.1 --port 3100`) so a human's `:3000` / `:8000` session is left alone. Do not pass a second `--` into `next dev`; Next 16 treats `--hostname` after `--` as a project directory.
- **Drive:** Playwright. Reuse the roles and names from `frontend/e2e/meeting-flow.spec.ts`. Prefer `scripts/drive.mjs` against the launched verify instance. `pnpm run test:e2e` is a separate production-build harness on `127.0.0.1:3217` (needs `pnpm run build` first); do not point it at the verify instance and do not treat its `webServer` as Launch.
- **Observe:** Playwright screenshots, Playwright video, ARIA snapshots, `curl` bodies, download filenames. Proof must show the user action and the resulting state.
- **Isolate:** two verify stacks can run if ports differ. Never attach to a server this run did not start. Refuse to double-drive a shared instance.

## Launch

Use the helpers. They wrap the documented start commands and record only the PIDs they spawn.

```bash
# from the repository root
export VERIFY_RUN_DIR=/tmp/verify-meeting-copilot
export VERIFY_FRONTEND_HOST=127.0.0.1
export VERIFY_FRONTEND_PORT=3100
export VERIFY_WITH_BACKEND=0
.cursor/skills/verify-meeting-copilot/scripts/launch.sh
```

Ready means `GET http://127.0.0.1:3100/` returns HTML that contains `会議がおわると` and `相手の画面には出ません`. `launch.sh` waits up to 120s and writes `$VERIFY_RUN_DIR/launch.json`.

- **UIプレビュー / おためし** (default, `VERIFY_WITH_BACKEND=0`): frontend only. Home → **おためし** is client-side (`demo=1`). No `ORCAROUTER_API_KEY`. No microphone. This is the safe proof path.
- **実会議 + まとめ生成:** `VERIFY_WITH_BACKEND=1`. The helper still runs the README backend command (`uv run uvicorn main:app --reload --port "$VERIFY_BACKEND_PORT"`) with `VERIFY_BACKEND_PORT` default `8010` and `BACKEND_HTTP_ORIGIN=http://127.0.0.1:8010` for Next rewrites. Live advice and finalize still need `ORCAROUTER_API_KEY` in `backend/.env` (never commit it). Do not create an auth flow to work around a missing key.
- **実キャプチャ（ききはじめる）:** Chrome tab picker + mic. Headless / this Cloud VM cannot finish that dialog. Record `verified-unreachable` with the attempted control and the missing OS prompt. Do not fake `getDisplayMedia`.

Teardown is Cleanup, not Launch. If Launch fails, run Cleanup before retrying.

## Doctor

Read-only. Run before the first drive, after any failed drive, and whenever the UI looks off.

```bash
export VERIFY_RUN_DIR=/tmp/verify-meeting-copilot
.cursor/skills/verify-meeting-copilot/scripts/doctor.sh
```

Pass requires all of:

1. `$VERIFY_RUN_DIR/launch.json` exists and was written by Launch.
2. The recorded frontend PID is alive (`kill -0`) and the listening socket on `VERIFY_FRONTEND_PORT` belongs to that PID or a descendant (`next-server` is a child of `pnpm exec next`). Check `/proc/net/tcp` plus `/proc/<pid>/fd` — `lsof` is often empty in this environment. If another tree owns the port, stop.
3. `GET $frontend_url/` is HTTP 200 and the body contains `会議がおわると` and `おためし`.
4. If `VERIFY_WITH_BACKEND=1`, the recorded backend PID is alive, owns `VERIFY_BACKEND_PORT`, and `GET http://127.0.0.1:$VERIFY_BACKEND_PORT/api/v1/health` returns JSON `"status":"healthy"` and `"version":"0.1.0"` (or the `APP_VERSION` from `backend/.env.example`).

Fail means do not drive. Fix Launch or Cleanup, then Doctor again.

## Drive

Read `features/README.md`, then the feature file. Start every recipe from home unless that file says otherwise. Prefer accessible names over CSS or coordinates.

Against the verify instance:

```bash
export VERIFY_FRONTEND_URL=http://127.0.0.1:3100
export VERIFY_EVIDENCE_DIR=/tmp/verify-meeting-copilot-evidence
.cursor/skills/verify-meeting-copilot/scripts/drive.mjs meeting-floor
```

`drive.mjs` uses the Playwright already declared in `frontend/package.json` (`@playwright/test`). It launches Chromium, locale `ja-JP`, viewport `1280x800`, and records video + screenshots into `VERIFY_EVIDENCE_DIR`.

Stable handles (from the product UI and `frontend/e2e/meeting-flow.spec.ts`):

| User thing | Handle |
| :--- | :--- |
| Home heading | `getByRole("heading", { name: /会議がおわると/ })` |
| Meeting title | `getByRole("textbox", { name: "今日の会議のなまえ" })` (placeholder `今日の会議のなまえ`) |
| Start live | `getByRole("button", { name: "はじめる" })` |
| Start preview | `getByRole("button", { name: "おためし" })` |
| Preview URL | `/meetings/<uuid>?title=...&demo=1` |
| Live URL | `/meetings/<uuid>?title=...` and **not** `demo=1` |
| Ours / theirs | `getByRole("region", { name: "こちら" })` / `むこう` |
| Whispers | `getByRole("complementary", { name: "こちらのささやき" })` |
| Map / memos tabs | `getByRole("tab", { name: "話の地図" })` / `会議のメモ` |
| Splitter | `getByRole("separator", { name: "左右の幅を変える" })` |
| Capture | `ききはじめる` / `きくのをやめる` / `おためしちゅう` |
| End | `おわる` → heading `おわりますか？` → `はい、おわる` (or `まだつづける`) |
| After end | text `まとめをつくっています` then `/document` |
| Back | `getByRole("link", { name: "戻る" })` or `getByRole("button", { name: "戻る" })` |
| Reopen まとめ | `getByRole("link", { name: "まとめを見る" })` |
| Export | `コピー` / `ファイルに保存` |
| Editor modes | `見る` / `ならべて` / `なおす` (`#requirements-markdown`) |

One-off Playwright in `frontend/` (same selectors as the spec):

```javascript
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({
  locale: "ja-JP",
  viewport: { width: 1280, height: 800 },
});
await page.goto("http://127.0.0.1:3100/");
await page.getByRole("textbox", { name: "今日の会議のなまえ" }).fill("検証会議");
await page.getByRole("button", { name: "おためし" }).click();
await page.waitForURL(/\/meetings\/.+[?&]demo=1/);
```

Existing E2E as a harness, not as Launch:

```bash
cd frontend
pnpm run build
pnpm exec playwright install --with-deps chromium
pnpm run test:e2e
```

That starts `next start` on `127.0.0.1:3217` (`reuseExistingServer` when `CI` is unset). Use it to re-run mapped flows the spec already drives (`startUiPreview`, `confirmEndMeeting`). Do not start it while you are driving `:3100` and expecting one browser to be both. Do not add a login helper.

Desktop recipes assume viewport ≥ `1280x800` (left whispers + right map). At `390x844` the same content is under tablist `会議の表示` (`話の地図` / `メモ` / `ささやき`).

## Evidence

Default directory: `$VERIFY_EVIDENCE_DIR` (if unset, `/tmp/verify-meeting-copilot-evidence`). Cleanup must not delete this directory.

Proof standards:

- Exercise the real user path (home → control → visible result). Do not POST finalize or write `sessionStorage` just to skip the UI, except when a feature file says the spec already stubs a missing backend for an error state.
- Capture the action and the resulting state (home before **おためし**, floor after; **おわる** dialog, then まとめ).
- UI proof: screenshot with the product heading or meeting title visible, plus Playwright video of the clicks. An ARIA snapshot is extra, not a substitute for the screenshot.
- Side effects: clipboard text after **コピー**, download name `requirements-<meetingId>.md` after **ファイルに保存**, URL query `demo=1` / `summary=1`.
- Preview (`demo=1`) is the product's own dry-run. It still renders the real floor, map, whispers, and まとめ. It does **not** open a WebSocket, call Orca Router, or use the mic. Confirm by URL (`demo=1`) and by **おためしちゅう** (no **ききはじめる**).
- `ききはじめる` against a real Meet tab is not preview. If the OS picker never appears, the feature is unreachable here — say so. Do not stub `getDisplayMedia` and call that a user proof (the spec does that only for the deny-path test).

Record the feature file id and entry point with every artifact (`meeting-floor` / home **おためし**, etc.).

## Cleanup

Kill only what Launch started. Never `pkill -f next`, `killall node`, or any name-based kill.

```bash
export VERIFY_RUN_DIR=/tmp/verify-meeting-copilot
.cursor/skills/verify-meeting-copilot/scripts/cleanup.sh
```

`cleanup.sh` reads `$VERIFY_RUN_DIR/launch.json`, sends SIGTERM to each recorded PID (and that PID's process group), waits, then SIGKILL those same PIDs if still alive. It removes `$VERIFY_RUN_DIR` scratch (pid files, logs, `launch.json`). It does **not** touch `$VERIFY_EVIDENCE_DIR`, `media/`, or git.

After Cleanup, confirm evidence files still exist at the named paths. A cleanup that ate the proof has failed.

If a drive failed, run Cleanup before the next Launch so ports are free.

## Helpers

All scripts are executable. Invoke them from the repository root as shown. Do not reverse-engineer flags that are not listed.

| Script | What it does |
| :--- | :--- |
| `scripts/launch.sh` | `pnpm install` if `frontend/node_modules` is missing, then `pnpm exec next dev --hostname … --port …` (same Next.js dev server as README `pnpm run dev`). Optional backend: `uv run uvicorn main:app --reload --port …`. Writes `launch.json`. |
| `scripts/doctor.sh` | Read-only ownership + HTTP check. Exit `0` only when the instance is ours and worth driving. |
| `scripts/cleanup.sh` | Signal the recorded PIDs / process groups. Keep evidence. |
| `scripts/drive.mjs <feature>` | Playwright driver. Implemented feature id: `meeting-floor`. Other map files use the same selectors in-process or via `pnpm run test:e2e`. |

```bash
.cursor/skills/verify-meeting-copilot/scripts/launch.sh
.cursor/skills/verify-meeting-copilot/scripts/doctor.sh
.cursor/skills/verify-meeting-copilot/scripts/drive.mjs meeting-floor
.cursor/skills/verify-meeting-copilot/scripts/cleanup.sh
```

Environment the helpers honor:

| Variable | Default | Meaning |
| :--- | :--- | :--- |
| `VERIFY_RUN_DIR` | `/tmp/verify-meeting-copilot` | PID / log / `launch.json` scratch |
| `VERIFY_FRONTEND_HOST` | `127.0.0.1` | Bind address |
| `VERIFY_FRONTEND_PORT` | `3100` | Isolated from README `:3000` |
| `VERIFY_BACKEND_PORT` | `8010` | Isolated from README `:8000` |
| `VERIFY_WITH_BACKEND` | `0` | `1` starts FastAPI |
| `VERIFY_FRONTEND_URL` | `http://127.0.0.1:3100` | Drive target |
| `VERIFY_EVIDENCE_DIR` | `/tmp/verify-meeting-copilot-evidence` | Screenshots and video; survives Cleanup |

## Feature map

Index: [`features/README.md`](features/README.md). Drive from those files, not from memory.

## Maintenance

When routes, labels, or preview fixtures change, run `/maintain-verification-skill` against this skill so the map stays honest.
