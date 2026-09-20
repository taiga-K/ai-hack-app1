# Export markdown

On a ready まとめ the user copies Markdown, downloads `requirements-<meetingId>.md`, and can edit the source then switch back to preview.

## Sub-features

- `export-copy` copies the Markdown and shows `コピーしました`.
- `export-download` saves `requirements-<meetingId>.md` and shows `ファイルに保存しました`.
- `export-edit` switches **なおす**, edits `#requirements-markdown`, then **見る**.
- `export-disabled` keeps header title-row icon **コピー** / **ファイルに保存** disabled while status is not `ready`.

## How to get to it (user POV)

- Finish a meeting so `/meetings/<id>/document` is ready (preview: **おためし** → **おわる** → **はい、おわる**).
- Use the title-row icon buttons **コピー** and **ファイルに保存** (same `header` row as the meeting title).
- Use **見る** / **ならべて** / **なおす** on region **要件定義書エディタ**.

## Driving it with Playwright

Preconditions:

- Doctor passed.
- Document is ready (preview path from `end-meeting-document`).
- For clipboard proof, grant `clipboard-read` and `clipboard-write`.

- **Copy.** `page.locator("header").getByRole("button", { name: "コピー" }).click()`. Toast `コピーしました` is visible. `navigator.clipboard.readText()` contains `# <meeting title>` (preview title from the name field).
- **Download.** `const download = page.waitForEvent("download")` then `page.locator("header").getByRole("button", { name: "ファイルに保存" }).click()`. Suggested filename is `requirements-<meetingId>.md` where `meetingId` is `pathname.split("/")[2]`. Toast `ファイルに保存しました` is visible.
- **Edit then preview.** `page.getByRole("button", { name: "なおす" }).click()`. `#requirements-markdown` is visible and taller than 240px, value matches `/プロジェクト\/会議概要/`. Fill `# 編集後の要件定義書\n\n検証で書き換えました。`. Choose **見る**. Heading `編集後の要件定義書` is visible. Open-issue summary becomes `確認することは、ありません` when the edited source has no 未決事項 list.
- **Not ready.** During `まとめをつくっています` or `まとめは、まだ出来ていません`, **コピー** and **ファイルに保存** stay disabled. Do not treat a disabled click as export proof.
- **Proof.** Screenshot ready まとめ with the meeting title and both title-row icons visible, then the post-copy toast or the edited preview heading. Video: title-row **コピー** (or **なおす** → edit → **見る**). Keep the downloaded `.md` next to the screenshots when download is driven. Record feature id `export-markdown`.

The spec `会議終了からまとめの確認・編集・書き出しまで通る` drives copy, download, and edit on `:3217`.

## Gotchas

- Advice items also have a **コピー** button (question text). On the document page use `header` **コピー**, not an advice card.
- Clipboard proof fails without granted permissions. That is a harness gap, not a product auth wall.
- Filename uses the meeting id from the path, not the Japanese title.
- Editing is local to the page. Reloading a preview document restores the fixture Markdown. Do not expect the edited text to survive a reload.
