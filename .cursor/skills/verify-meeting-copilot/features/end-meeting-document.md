# End meeting and まとめ

**おわる** asks for confirmation, then builds a Markdown 要件定義書. Preview uses the in-app document (no Orca Router). After a successful end, the URL moves to `/meetings/<id>/document`.

## Sub-features

- `end-confirm` opens heading **おわりますか？** and can still **まだつづける**.
- `end-preview-document` reaches `/document?…&demo=1` with open issues and the meeting title.
- `end-making` shows `まとめをつくっています` before the document is ready.
- `end-empty` shows `まとめは、まだ出来ていません` when no document exists.
- `end-retry` shows `まとめを作れませんでした。` and **もういちど** when finalize fails.

## How to get to it (user POV)

- On a live or preview floor, choose **おわる**, then **はい、おわる**.
- After a completed まとめ, choose **まとめを見る**.
- Open `/meetings/<id>/document?title=…` (add `demo=1` only for preview).

## Driving it with Playwright

Preconditions:

- Doctor passed.
- For the happy path, start a preview floor (`start-meeting` / `meeting-floor`).
- Do not require `ORCAROUTER_API_KEY` for `demo=1`.

- **Open confirm.** On the preview floor, `page.getByRole("button", { name: "おわる" }).click()`. Heading `おわりますか？` is visible. Description mentions that a まとめ will be built.
- **Stay.** Choose **まだつづける**. The dialog closes. Complementary **こちらのアドバイス** remains. **おわる** is still present.
- **Confirm end.** Choose **おわる** then **はい、おわる**. `page.getByRole("button", { name: "はい、おわる" }).click()`. Text `まとめをつくっています` appears (preview waits ~720ms). Then URL matches `/\/meetings\/.+\/document\?.*demo=1/`.
- **Document ready.** Badge `おためし` (preview) or `できたまとめ` (live). Heading or title `検証…` matches the meeting name. Text `あとで確認すること` is visible. Open-issue line `『API連携でリアルタイム同期』の対象データ` is visible. Region **要件定義書エディタ** is visible. Heading `/未決事項（ToDo \/ 宿題）/` is visible after expanding the body.
- **Editor modes.** **見る** is the default preview. **なおす** reveals `#requirements-markdown` with value matching `/プロジェクト\/会議概要/`. **ならべて** shows both.
- **Empty document.** `page.goto("/meetings/e2e-missing-doc/document?title=未生成会議")` only when proving the empty state (spec stubs GET 404). Copy `まとめは、まだ出来ていません` and link **戻る** are visible.
- **Live finalize without a key.** **はじめる** then **おわる** against a backend with empty `ORCAROUTER_API_KEY` can yield `まとめを作れませんでした。` + **もういちど**. That is a configuration miss, not a UI auth wall.
- **Proof.** Screenshot the confirm dialog, then the ready まとめ (`あとで確認すること` visible). Video: **おわる** → **はい、おわる** → document. Record feature id `end-meeting-document`.

The spec `会議終了からまとめの確認・編集・書き出しまで通る` covers this path on the `:3217` production harness after `pnpm run build`.

## Gotchas

- Confirm is required. A single **おわる** click is not an end.
- Preview making-state is short. Capture `まとめをつくっています` immediately or you will only see the document.
- Live まとめ needs FastAPI + `ORCAROUTER_API_KEY`. Preview does not. Do not call a preview document proof of Orca Router.
- Direct `/document` without `demo=1` hits `GET /api/v1/meetings/{id}/requirements`. Without a rewrite target that 404s into `まとめは、まだ出来ていません`.
- Title-row save is the icon button `getByRole("button", { name: "ファイルに保存" })` inside `header`. Copy is `まとめをコピー`.
