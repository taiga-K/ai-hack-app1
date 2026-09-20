import { expect, test, type Page } from "@playwright/test";

const PREVIEW_UTTERANCE =
  "今回の対象範囲は、既存顧客向けの更新申請だけと考えてよいですか？";
const PREVIEW_ADVICE_TITLE = "専門用語が説明なく使われています";
const PREVIEW_QUESTION =
  "『API連携でリアルタイム同期』は、今ある画面を見るだけですか？";

async function startUiPreview(page: Page, title: string): Promise<void> {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /会議がおわると/ })
  ).toBeVisible();
  await page.getByPlaceholder(/なまえ/).fill(title);
  await page.getByRole("button", { name: "おためし" }).click();
  await expect(page).toHaveURL(/\/meetings\/.+[?&]demo=1/);
  await expect(
    page
      .getByRole("region", { name: "会議のメモ" })
      .or(page.getByRole("tab", { name: "メモ" }))
  ).toBeVisible();
}

async function confirmEndMeeting(page: Page): Promise<void> {
  await page.getByRole("button", { name: "おわる" }).click();
  await expect(
    page.getByRole("heading", { name: "おわりますか？" })
  ).toBeVisible();
  await page.getByRole("button", { name: "はい、おわる" }).click();
}

test("ホームからおためしで発話と助言を確認できる", async ({ page }) => {
  await startUiPreview(page, "E2Eプレビュー会議");

  await expect(page.getByText("E2Eプレビュー会議").first()).toBeVisible();
  await expect(page.getByText("おためし").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "こちら" })).toBeVisible();
  await expect(page.getByRole("region", { name: "むこう" })).toBeVisible();
  await expect(page.getByRole("region", { name: "会議のメモ" })).toBeVisible();
  await expect(page.getByText(PREVIEW_UTTERANCE)).toBeVisible();
  await expect(page.getByText("了解です。そこはお任せします。")).toBeVisible();
  await expect(
    page.getByText("現場の担当も同じ認識です。例外はあとで共有します。")
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "こちらのささやき" })
  ).toBeVisible();
  await expect(page.getByText(PREVIEW_ADVICE_TITLE)).toBeVisible();
  await expect(page.getByText("❓ 専門用語の確認")).toBeVisible();
  await expect(page.getByText(PREVIEW_QUESTION)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "おためしちゅう" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "ききはじめる" })).toHaveCount(
    0
  );
  await expect(page.getByText("きいている").first()).toBeVisible();
});

test("モバイルのささやきタブは選択と本文が一致する", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startUiPreview(page, "E2Eモバイル会議");

  const whispersTab = page.getByRole("tab", { name: /ささやき/ });
  await whispersTab.click();
  await expect(whispersTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "メモ" })).toHaveAttribute(
    "aria-selected",
    "false"
  );
  await expect(page.getByRole("heading", { name: "ささやき" })).toBeVisible();
  await expect(page.getByText(PREVIEW_ADVICE_TITLE)).toBeVisible();
  await expect(page.getByText(PREVIEW_QUESTION)).toBeVisible();
  await expect(page.getByText("まだ、だれも話していません")).toHaveCount(0);
});

test("会議終了からまとめの確認・編集・書き出しまで通る", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await startUiPreview(page, "E2E要件書会議");
  await confirmEndMeeting(page);

  await expect(page).toHaveURL(/\/meetings\/.+\/document\?.*demo=1/);
  await expect(
    page.getByText("できたまとめ").or(page.getByText("おためし")).first()
  ).toBeVisible();
  await expect(page.getByText("あとで確認すること")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "要件定義書エディタ" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "E2E要件書会議" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /未決事項（ToDo \/ 宿題）/ })
  ).toBeVisible();

  const meetingId = new URL(page.url()).pathname.split("/")[2] ?? "unknown";

  await page.getByRole("button", { name: "コピー" }).click();
  await expect(page.getByText("コピーしました")).toBeVisible();
  await expect
    .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("# E2E要件書会議");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "保存" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`requirements-${meetingId}.md`);
  await expect(page.getByText("ファイルに保存しました")).toBeVisible();

  await page.getByRole("button", { name: "なおす" }).click();
  const editor = page.locator("#requirements-markdown");
  await expect(editor).toBeVisible();
  await editor.fill("# 編集後の要件定義書\n\nE2Eで書き換えました。");
  await page.getByRole("button", { name: "見る" }).click();
  await expect(
    page.getByRole("heading", { name: "編集後の要件定義書" })
  ).toBeVisible();

  await page.getByRole("link", { name: "会議に戻る" }).click();
  await expect(page).toHaveURL(/\/meetings\/.+\?.*demo=1/);
  await expect(page.getByText(PREVIEW_ADVICE_TITLE)).toBeVisible();
});

test("実会議開始では初回認証なしで空の会議ルームが開く", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder(/なまえ/).fill("実会議スモーク");
  await page.getByRole("button", { name: "はじめる" }).click();

  await expect(page).toHaveURL(/\/meetings\/[0-9a-f-]+\?title=/);
  await expect(page).not.toHaveURL(/demo=1/);
  await expect(page.getByText("まだ、だれも話していません")).toBeVisible();
  await expect(
    page.getByText("いまは、ささやくことがありません")
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ききはじめる" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "おわる" })).toBeEnabled();
});

test("画面共有を拒否すると聞けなかったことを表示する", async ({ page }) => {
  await page.addInitScript(() => {
    class ImmediateFailWebSocket {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
      readonly url: string;
      binaryType = "arraybuffer";
      readyState = ImmediateFailWebSocket.CLOSED;
      onopen: ((event: Event) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;

      constructor(url: string) {
        this.url = url;
        queueMicrotask(() => {
          this.onerror?.(new Event("error"));
          this.onclose?.(new CloseEvent("close"));
        });
      }

      send(): void {
        return undefined;
      }

      close(): void {
        return undefined;
      }
    }

    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      value: ImmediateFailWebSocket,
    });
    Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
      configurable: true,
      value: () =>
        Promise.reject(
          new DOMException("Permission denied", "NotAllowedError")
        ),
    });
  });

  await page.goto("/meetings/e2e-capture-denied?title=キャプチャ拒否");
  await page.getByRole("button", { name: "ききはじめる" }).click();
  await expect(page.getByText("うまく聞けませんでした")).toBeVisible();
});

test("未生成のまとめ画面は空状態を出す", async ({ page }) => {
  await page.route("**/api/v1/meetings/**/requirements", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ detail: "requirements document not found" }),
    });
  });

  await page.goto("/meetings/e2e-missing-doc/document?title=未生成会議");
  await expect(page.getByText("まとめは、まだ出来ていません")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "会議に戻る" }).first()
  ).toBeVisible();
});
