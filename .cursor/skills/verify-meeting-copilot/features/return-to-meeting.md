# Return to the meeting

From まとめ, browser Back or the on-screen return path restores the floor. After a successful まとめ the floor stays ended: **まとめを見る** is shown and **おわる** is gone. An empty まとめ does not mark the meeting ended. While `まとめをつくっています` is on screen, **戻る** is hidden so the user stays on the generating screen.

## Sub-features

- `return-from-document` follows the document return path to `/meetings/<id>?…&summary=1`.
- `hide-back-while-making` keeps **戻る** off `まとめをつくっています` (and the short `まとめができました` beat).
- `return-reopen` opens the same まとめ via **まとめを見る**.
- `return-keeps-floor` keeps preview memos and whispers after back.
- `return-empty-continues` leaves **おわる** and **ききはじめる** in place when まとめ was never created.

## How to get to it (user POV)

- On `/meetings/<id>/document`, use browser Back or the on-screen return path.
- After **はい、おわる**, wait on `まとめをつくっています`. There is no **戻る**.
- On an ended floor, choose **まとめを見る**.
- Browser Back after a preview end also lands on the ended floor (`summary=1`).

## Driving it with Playwright

Preconditions:

- Doctor passed.
- Happy path: preview floor already taken through **はい、おわる** to a ready document (`end-meeting-document`).

- **Back from ready まとめ.** After the document is open, `page.goBack()`. URL matches `/\/meetings\/[^/]+\?/` and `summary=1`, and does **not** include `/document`. Complementary **こちらのアドバイス** is visible. Preview advice title is still visible. Link **まとめを見る** is visible. Button **おわる** count is `0`.
- **Reopen.** `page.getByRole("link", { name: "まとめを見る" }).click()`. URL includes `/document`.
- **No back while making.** From a new preview floor, confirm end. While `まとめをつくっています` is visible, `getByRole("button", { name: "戻る" })` and `getByRole("link", { name: "戻る" })` both have count `0`. Then URL matches `/\/document/`.
- **Browser Back.** After preview auto-open of `/document`, `page.goBack()`. Floor has `summary=1`, memos still show the preview utterance, **おわる** is absent.
- **Empty まとめ back.** On `まとめは、まだ出来ていません`, leave via Home or a new URL. URL has no `summary=1`. **おわる** and **ききはじめる** remain. **まとめを見る** count is `0`.
- **Proof.** Screenshot the generating screen (`まとめをつくっています` visible, no **戻る**). Video: **おわる** → **はい、おわる** → generating (no **戻る**) → document. Record feature id `return-to-meeting`.

The spec files `生成中は戻るが出ずまとめが開く` and `おためしでまとめが自動で開いたあとブラウザ戻るでも終わったまま` cover these paths on `:3217`.

## Gotchas

- Making-state has no **戻る**. Do not wait for a header back button on `まとめをつくっています`.
- `summary=1` is the ended-floor hint. Missing `summary=1` after an empty document is correct.
- Do not seed `sessionStorage` (`return-to-meeting:floor-snapshot:*`) for a user proof. The spec does that only for live-floor persistence tests.
- After a successful end, **ききはじめる** must stay gone. If it comes back, the ended state leaked.
