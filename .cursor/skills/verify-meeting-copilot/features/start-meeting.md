# Start a meeting

Home lets a user name a meeting and open a room immediately. There is no account, password, or first-time auth. **おためし** opens a seeded preview room; **はじめる** opens an empty live room.

## Sub-features

- `start-home` shows the Japanese home heading and the no-leak promise.
- `start-preview` opens a `demo=1` room from **おためし**.
- `start-live` opens a non-demo room from **はじめる**.
- `start-default-title` uses `今日の会議` when the name field is left empty.

## How to get to it (user POV)

- Open the app root `/` in the browser (README: `http://localhost:3000`; verify instance: `http://127.0.0.1:3100/`).
- Type a name into **今日の会議のなまえ** (optional).
- Choose **おためし** for the voice-free preview, or **はじめる** for a live room.

## Driving it with Playwright

Preconditions:

- Doctor passed for the verify instance.
- Viewport `1280x800`.
- No login step exists; do not add one.

- **Open home.** Go to `/`. `page.goto(process.env.VERIFY_FRONTEND_URL + "/")`. Heading `/会議がおわると/` is visible and the page shows `相手の画面には出ません`.
- **Name the meeting.** Fill the textbox. `page.getByRole("textbox", { name: "今日の会議のなまえ" }).fill("検証スタート")`.
- **Preview entry.** Choose **おためし**. `page.getByRole("button", { name: "おためし" }).click()`. URL matches `/\/meetings\/.+[?&]demo=1/` and `title` is `検証スタート`. Header badge text `おためし` is visible.
- **Live entry.** From a fresh `/`, fill `検証ライブ` and choose **はじめる**. `page.getByRole("button", { name: "はじめる" }).click()`. URL matches `/\/meetings\/[0-9a-f-]+\?title=/` and does **not** include `demo=1`. Button **ききはじめる** is visible. Empty map copy `マインドマップが作られます` is visible.
- **Default title.** From `/`, leave the textbox empty and choose **おためし**. The room title reads `今日の会議`.
- **Proof.** Screenshot home (heading visible) and the preview room (badge `おためし` + complementary `こちらのアドバイス`). Video must include the **おためし** click and the URL change. Record feature id `start-meeting`.

## Gotchas

- README demo text still says 「UIプレビュー」. The button on screen is **おためし**. Drive the button, not the README synonym.
- **はじめる** is a live room. Without backend + OS capture it stays empty. That empty state is the correct live proof; do not treat it as a broken preview.
- Next.js `pnpm run test:e2e` hits `127.0.0.1:3217`, not the verify port. Do not assert `:3100` URLs inside that run.
- Do not invent a login gate if home is already interactive.
