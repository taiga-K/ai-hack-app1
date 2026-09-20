# Return to the meeting

From まとめ, **戻る** restores the floor. After a successful まとめ the floor stays ended: **まとめを見る** is shown and **おわる** is gone. An empty まとめ does not mark the meeting ended.

## Sub-features

- `return-from-document` follows link **戻る** to `/meetings/<id>?…&summary=1`.
- `return-while-making` uses button **戻る** on `まとめをつくっています` and waits on the floor.
- `return-reopen` opens the same まとめ via **まとめを見る**.
- `return-keeps-floor` keeps preview memos and whispers after back.
- `return-empty-continues` leaves **おわる** and **ききはじめる** in place when まとめ was never created.

## How to get to it (user POV)

- On `/meetings/<id>/document`, choose **戻る** in the header.
- While `まとめをつくっています` is on screen, choose header **戻る**.
- On an ended floor, choose **まとめを見る**.
- Browser Back after a preview end also lands on the ended floor (`summary=1`).

## Driving it with Playwright

Preconditions:

- Doctor passed.
- Happy path: preview floor already taken through **はい、おわる** to a ready document (`end-meeting-document`).

- **Back from ready まとめ.** `page.getByRole("link", { name: "戻る" }).click()`. URL matches `/\/meetings\/[^/]+\?/` and `summary=1`, and does **not** include `/document`. Complementary **こちらのアドバイス** is visible. Preview advice title is still visible. Link **まとめを見る** is visible. Button **おわる** count is `0`.
- **Reopen.** `page.getByRole("link", { name: "まとめを見る" }).click()`. URL includes `/document`. Link **戻る** is visible again.
- **Back while making.** From a new preview floor, confirm end, and while `まとめをつくっています` is visible click `page.getByRole("button", { name: "戻る" })` (button, not link). Floor returns without `/document`. **おわる** count is `0`. **まとめを見る** becomes visible when the document is ready. Opening it shows `あとで確認すること`.
- **Browser Back.** After preview auto-open of `/document`, `page.goBack()`. Floor has `summary=1`, memos still show the preview utterance, **おわる** is absent.
- **Empty まとめ back.** On `まとめは、まだ出来ていません`, choose **戻る**. URL has no `summary=1`. **おわる** and **ききはじめる** remain. **まとめを見る** count is `0`.
- **Proof.** Screenshot the ended floor (`まとめを見る` visible, no **おわる**). Video: まとめ → **戻る** → **まとめを見る**. Record feature id `return-to-meeting`.

The spec files `生成中に戻るとフロアで完了を待ち同じまとめを開ける` and `おためしでまとめが自動で開いたあとブラウザ戻るでも終わったまま` cover these paths on `:3217`.

## Gotchas

- Making-state **戻る** is a button. Ready-document **戻る** is a link. Use the role that is on screen.
- `summary=1` is the ended-floor hint. Missing `summary=1` after an empty document is correct.
- Do not seed `sessionStorage` (`return-to-meeting:floor-snapshot:*`) for a user proof. The spec does that only for live-floor persistence tests.
- After a successful end, **ききはじめる** must stay gone. If it comes back, the ended state leaked.
