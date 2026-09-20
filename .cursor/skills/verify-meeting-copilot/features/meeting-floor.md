# Meeting floor

The meeting room is a floor, not a 1:1 chat. Desktop shows アドバイス on the left and 話の地図 / 会議のメモ on the right. Preview seeds utterances, advice, and a growing map without a microphone.

## Sub-features

- `floor-sides` shows regions **こちら** and **むこう** with listening status in preview.
- `floor-whispers` shows complementary **こちらのアドバイス** with preview advice.
- `floor-map` shows region **話の地図** growing from `今日の会議` to `例外は宿題`.
- `floor-memos` shows tab **会議のメモ** with the seeded utterances.
- `floor-split` lets the user drag separator **左右の幅を変える**.
- `floor-map-fit` shows **ぜんぶ見る** only after the user pans or zooms the map.

## How to get to it (user POV)

- From home, choose **おためし** (preview) or **はじめる** (live).
- Or open `/meetings/<id>?title=…&demo=1` after a preview start.
- On a narrow screen, use tablist **会議の表示** (`話の地図` / `メモ` / `アドバイス`).

## Driving it with Playwright

Preconditions:

- Doctor passed.
- Viewport `1280x800` for desktop split; use `390x844` only for the mobile bullets.
- Start from home unless proving a deep link.

- **Enter preview floor.** From `/`, fill `検証フロア` and choose **おためし**. `scripts/drive.mjs meeting-floor` performs this path. URL has `demo=1`. Regions **こちら** and **むこう** are visible. Text `きいている` is visible. Button **おためしちゅう** is visible. **ききはじめる** count is `0`.
- **Whispers.** Complementary **こちらのアドバイス** is visible. Suggested question `『API連携でリアルタイム同期』は、今ある画面を見るだけですか？` is visible. Buttons **聞けた** / **あとで** / **不要** are visible. Copy is gone. Text `専門用語が説明なく使われています` and `❓ 専門用語の確認` stay folded until **くわしく** is opened. **あとで** moves the item into region **あとで聞く**.
- **Map grows.** Tab **話の地図** has `aria-selected=true`. Region **話の地図** shows `今日の会議`, then `対象範囲`, then `来月末の本番`, then `例外は宿題` (wait up to 4s). Text `React Flow` count is `0`. Button **ぜんぶ見る** count is `0` until the user moves the camera.
- **Memos.** Choose **会議のメモ**. `page.getByRole("tab", { name: "会議のメモ" }).click()`. Region **会議のメモ** shows `今回の対象範囲は、既存顧客向けの更新申請だけと考えてよいですか？` and `了解です。そこはお任せします。`.
- **Splitter.** Drag `page.getByRole("separator", { name: "左右の幅を変える" })` about 90px to the right. Complementary **こちらのアドバイス** width changes by more than 20px. Map node `例外は宿題` stays inside the map region (±8px).
- **User-moved map.** Wheel the `.react-flow__pane` inside region **話の地図**. **ぜんぶ見る** appears. Click it. The button count returns to `0`.
- **Mobile panes.** Viewport `390x844`. Tablist **会議の表示**. Choose tab `/アドバイス/`. Heading `アドバイス` and the preview advice are visible. Map region still shows `今日の会議` (peek). Choose **話の地図** again.
- **Live empty floor.** From `/`, **はじめる**. Map empty copy `マインドマップが作られます`. Memos empty copy `まだ、だれも話していません`. Whispers empty copy `いまは、アドバイスがありません`. **ききはじめる** is visible.
- **Proof.** Screenshots: floor with whispers + map (`今日の会議` visible), then memos with the preview utterance. Video: home → **おためし** → map nodes → **会議のメモ**. Record feature id `meeting-floor`. Helper: `scripts/drive.mjs meeting-floor`.

## Gotchas

- Preview map nodes appear on a short timer. Wait for `例外は宿題`, not a fixed 200ms sleep.
- **ぜんぶ見る** is absent until the user pans/zooms. A first-load screenshot must not require that button.
- Do not assert vendor chrome (`React Flow`) as user copy.
- `ききはじめる` opens `getDisplayMedia` plus mic. In this Cloud VM that picker is not a user-completable path. Do not stub the permission and call it a live-capture proof.
- Mobile tab **メモ** is the same feed as desktop **会議のメモ**. Desktop does not use tablist **会議の表示**.
