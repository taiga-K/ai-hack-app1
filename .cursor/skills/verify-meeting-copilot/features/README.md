# Meeting Copilot verification map

This directory is the maintained source for verifying the user-facing behavior of the meeting-copilot web app (AI HACK APP1). Read this index before driving, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch the verify instance with `.cursor/skills/verify-meeting-copilot/scripts/launch.sh` (`VERIFY_WITH_BACKEND=0` unless the feature file asks for FastAPI).
- Doctor must pass: `.cursor/skills/verify-meeting-copilot/scripts/doctor.sh`.
- Open `VERIFY_FRONTEND_URL` (default `http://127.0.0.1:3100/`). There is no login.
- Desktop proofs use viewport `1280x800`. Mobile-only steps say so.
- Never drive a server this run did not start.

## Driving conventions

- Start every recipe from `/` unless the feature lists another entry URL.
- Prefer ARIA roles and accessible names from `frontend/e2e/meeting-flow.spec.ts`.
- Treat quoted Japanese labels as literal (`おためし`, `おわる`, `戻る`).
- Drive the verify instance with `scripts/drive.mjs` or an equivalent Playwright page against `VERIFY_FRONTEND_URL`.
- Use `cd frontend && pnpm run test:e2e` only for flows the spec already covers, after `pnpm run build`. That harness listens on `127.0.0.1:3217`, not `:3100`.
- Cleanup removes Launch scratch only. Keep proof artifacts.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the last screen.
- UI proof includes a screenshot (product title or heading visible) and a short video of the clicks.
- Preview (`demo=1`) is in-product. It is enough proof for floor / まとめ / 戻る / 書き出し. It is not proof of live capture or Orca Router.
- `ききはじめる` needs a real Chrome picker. If that UI never appears, report `verified-unreachable` with the control used and the missing prompt.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with Playwright` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Start a meeting](./start-meeting.md) covers home, **はじめる**, and **おためし** with no auth.
- [Meeting floor](./meeting-floor.md) covers アドバイス, マインドマップ, 会議のメモ, and the splitter. No microphone volume bar.
- [End meeting and まとめ](./end-meeting-document.md) covers **おわる** through the requirements document screen.
- [Return to the meeting](./return-to-meeting.md) covers **戻る** and **まとめを見る**.
- [Export markdown](./export-markdown.md) covers title-row icon **まとめをコピー** / **ファイルに保存**, and 見る / なおす.
