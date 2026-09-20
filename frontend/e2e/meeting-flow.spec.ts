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
  await expect(page.getByText("相手の画面には出ません")).toBeVisible();
  await page.getByPlaceholder(/なまえ/).fill(title);
  await page.getByRole("button", { name: "おためし" }).click();
  await expect(page).toHaveURL(/\/meetings\/.+[?&]demo=1/);
  await expect(page.getByRole("tab", { name: "マインドマップ" })).toBeVisible();
}

async function showMeetingMemos(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "会議のメモ" }).click();
  await expect(page.getByRole("region", { name: "会議のメモ" })).toBeVisible();
}

async function confirmEndMeeting(page: Page): Promise<void> {
  await page.getByRole("button", { name: "おわる" }).click();
  await expect(
    page.getByRole("heading", { name: "おわりますか？" })
  ).toBeVisible();
  await page.getByRole("button", { name: "はい、おわる" }).click();
}

async function stubMissingRequirements(page: Page): Promise<void> {
  await page.route("**/api/v1/meetings/**/requirements", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ detail: "requirements document not found" }),
    });
  });
}

test("ホームからおためしで発話と助言を確認できる", async ({ page }) => {
  await startUiPreview(page, "E2Eプレビュー会議");

  await expect(page.getByText("E2Eプレビュー会議").first()).toBeVisible();
  await expect(page.getByText("おためし").first()).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "マインドマップ" })
  ).toHaveAttribute("aria-selected", "true");
  const widthHandle = page.getByRole("separator", { name: "左右の幅を変える" });
  await expect(widthHandle).toBeVisible();
  await expect(page.getByText("地図をかいています")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "マインドマップ" })
  ).toBeVisible();
  await expect(page.getByText("今日の会議").first()).toBeVisible({
    timeout: 4000,
  });
  await expect(page.getByText("対象範囲").first()).toBeVisible({
    timeout: 4000,
  });
  await expect(page.getByRole("button", { name: "ぜんぶ見る" })).toHaveCount(0);
  await page.getByRole("tab", { name: "会議のメモ" }).click();
  await expect(page.getByRole("region", { name: "会議のメモ" })).toBeVisible();
  await expect(page.getByText(PREVIEW_UTTERANCE)).toBeVisible();
  await expect(page.getByText("了解です。そこはお任せします。")).toBeVisible();
  await expect(
    page.getByText("現場の担当も同じ認識です。例外はあとで共有します。")
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "こちらのアドバイス" })
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
});

test("地図は動かさなければ成長しても画面内に収まる", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await startUiPreview(page, "E2E地図成長会議");

  const mapRegion = page.getByRole("region", { name: "マインドマップ" });
  await expect(mapRegion.getByText("今日の会議")).toBeVisible({
    timeout: 4000,
  });
  await expect(mapRegion.getByText("対象範囲")).toBeVisible({ timeout: 4000 });
  await expect(mapRegion.getByText("来月末の本番")).toBeVisible({
    timeout: 4000,
  });
  const grown = mapRegion.getByText("例外は宿題", { exact: true });
  await expect(grown).toBeVisible({ timeout: 4000 });
  await expect(mapRegion.getByText("今日の会議")).toBeVisible();
  const mapBox = await mapRegion.boundingBox();
  const nodeBox = await grown.boundingBox();
  expect(mapBox).not.toBeNull();
  expect(nodeBox).not.toBeNull();
  if (mapBox !== null && nodeBox !== null) {
    expect(nodeBox.x).toBeGreaterThanOrEqual(mapBox.x - 8);
    expect(nodeBox.y).toBeGreaterThanOrEqual(mapBox.y - 8);
    expect(nodeBox.x + nodeBox.width).toBeLessThanOrEqual(
      mapBox.x + mapBox.width + 8
    );
    expect(nodeBox.y + nodeBox.height).toBeLessThanOrEqual(
      mapBox.y + mapBox.height + 8
    );
  }
  await expect(page.getByRole("button", { name: "ぜんぶ見る" })).toHaveCount(0);
});

test("地図は浅く始まり、枝をおすとくわしい話と関係が見える", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await startUiPreview(page, "E2E構造化地図会議");

  const mapRegion = page.getByRole("region", { name: "マインドマップ" });
  await expect(mapRegion.getByText("今日の会議")).toBeVisible({
    timeout: 4000,
  });
  await expect(
    mapRegion.getByText("更新申請に限定で決定", { exact: true })
  ).toBeVisible({ timeout: 6000 });
  await expect(
    mapRegion.getByText("例外は宿題", { exact: true })
  ).toBeVisible();
  await expect(page.getByText(/保留中: 同期の対象データ/)).toBeVisible({
    timeout: 6000,
  });
  await expect(mapRegion.getByText("決定", { exact: true })).toBeVisible();
  await expect(
    mapRegion.getByText("つぎにやること", { exact: true })
  ).toBeVisible();
  await expect(
    mapRegion.getByText("更新申請だけ", { exact: true })
  ).toHaveCount(0);
  await expect(mapRegion.getByText("まず参照だけ反映")).toHaveCount(0);

  await mapRegion.getByRole("button", { name: /^対象範囲/ }).click();
  const scopeDetail = page.getByRole("region", {
    name: "対象範囲 のくわしい話",
  });
  await expect(scopeDetail).toBeVisible();
  await expect(scopeDetail.getByText("話題・まだ決まっていない")).toBeVisible();
  await expect(
    scopeDetail.getByText(
      "既存顧客向けの更新申請だけでよいか、はじめに確認した。"
    )
  ).toBeVisible();
  await expect(
    mapRegion.getByText("更新申請だけ", { exact: true })
  ).toBeVisible();
  await expect(mapRegion.getByText("採用", { exact: true })).toBeVisible();

  await mapRegion
    .getByRole("button", { name: /^更新申請に限定で決定/ })
    .click();
  const decisionDetail = page.getByRole("region", {
    name: "更新申請に限定で決定 のくわしい話",
  });
  await expect(decisionDetail.getByText("賛成: 更新申請だけ")).toBeVisible();
  await expect(decisionDetail.getByText("決定・決定")).toHaveCount(0);

  await mapRegion.getByRole("button", { name: /^システムのつなぎ/ }).click();
  await mapRegion.getByRole("button", { name: /^まず参照だけ反映/ }).click();
  await expect(
    page.getByText("言いなおし前: すぐ反映したい", { exact: true })
  ).toBeVisible();

  await mapRegion.getByRole("button", { name: /^来月末の本番/ }).click();
  await expect(
    mapRegion.getByText("来月末に間に合うか", { exact: true })
  ).toBeVisible();
  await expect(mapRegion.getByText("反対", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "とじる" }).click();
  await expect(page.getByRole("region", { name: /のくわしい話/ })).toHaveCount(
    0
  );
});

test("利用者が地図を動かしたらぜんぶ見るで戻せる", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await startUiPreview(page, "E2E地図操作会議");

  const mapRegion = page.getByRole("region", { name: "マインドマップ" });
  await expect(mapRegion.getByText("例外は宿題", { exact: true })).toBeVisible({
    timeout: 4000,
  });
  await expect(page.getByRole("button", { name: "ぜんぶ見る" })).toHaveCount(0);

  const pane = mapRegion.locator(".react-flow__pane");
  await expect(pane).toBeVisible();
  const paneBox = await pane.boundingBox();
  expect(paneBox).not.toBeNull();
  if (paneBox === null) {
    return;
  }
  await page.mouse.move(paneBox.x + paneBox.width - 16, paneBox.y + 16);
  await page.mouse.wheel(0, -320);
  await expect(page.getByRole("button", { name: "ぜんぶ見る" })).toBeVisible();
  await page.getByRole("button", { name: "ぜんぶ見る" }).click();
  await expect(page.getByRole("button", { name: "ぜんぶ見る" })).toHaveCount(0);
});

test("デスクトップで左右の幅を拖って変えられる", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await startUiPreview(page, "E2E幅変更会議");

  const whispers = page.getByRole("complementary", {
    name: "こちらのアドバイス",
  });
  const handle = page.getByRole("separator", { name: "左右の幅を変える" });
  await expect(handle).toBeVisible();
  const before = await whispers.boundingBox();
  expect(before).not.toBeNull();
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  if (before === null || handleBox === null) {
    return;
  }
  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    handleBox.x + handleBox.width / 2 + 90,
    handleBox.y + handleBox.height / 2,
    { steps: 8 }
  );
  await page.mouse.up();
  const after = await whispers.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs((after?.width ?? 0) - before.width)).toBeGreaterThan(20);
  const mapRegion = page.getByRole("region", { name: "マインドマップ" });
  const grown = mapRegion.getByText("例外は宿題", { exact: true });
  await expect(grown).toBeVisible();
  await expect(mapRegion.getByText("今日の会議")).toBeVisible();
  await expect
    .poll(async () => {
      const mapBox = await mapRegion.boundingBox();
      const nodeBox = await grown.boundingBox();
      if (mapBox === null || nodeBox === null) {
        return false;
      }
      return (
        nodeBox.x >= mapBox.x - 8 &&
        nodeBox.y >= mapBox.y - 8 &&
        nodeBox.x + nodeBox.width <= mapBox.x + mapBox.width + 8 &&
        nodeBox.y + nodeBox.height <= mapBox.y + mapBox.height + 8
      );
    })
    .toBe(true);
});

test("モバイルのアドバイスタブは選択と本文が一致する", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startUiPreview(page, "E2Eモバイル会議");

  const mapRegion = page.getByRole("region", { name: "マインドマップ" });
  await expect(mapRegion.getByText("今日の会議")).toBeVisible({
    timeout: 4000,
  });
  const lastTopic = mapRegion.getByText("来月末の本番");
  await expect(lastTopic).toBeVisible({ timeout: 4000 });
  await expect
    .poll(async () => {
      const mapBox = await mapRegion.boundingBox();
      const nodeBox = await lastTopic.boundingBox();
      if (mapBox === null || nodeBox === null) {
        return false;
      }
      return (
        nodeBox.x >= mapBox.x - 8 &&
        nodeBox.y >= mapBox.y - 8 &&
        nodeBox.x + nodeBox.width <= mapBox.x + mapBox.width + 8 &&
        nodeBox.y + nodeBox.height <= mapBox.y + mapBox.height + 8
      );
    })
    .toBe(true);
  const whispersTab = page.getByRole("tab", { name: /アドバイス/ });
  await expect(whispersTab).toBeVisible();
  await whispersTab.click();
  await expect(whispersTab).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("tab", { name: "マインドマップ" })
  ).toHaveAttribute("aria-selected", "false");
  await expect(page.getByRole("tab", { name: "メモ" })).toHaveAttribute(
    "aria-selected",
    "false"
  );
  await expect(page.getByRole("heading", { name: "アドバイス" })).toBeVisible();
  await expect(page.getByText(PREVIEW_ADVICE_TITLE)).toBeVisible();
  await expect(page.getByText(PREVIEW_QUESTION)).toBeVisible();
  await expect(
    page.getByRole("region", { name: "マインドマップ" })
  ).toBeVisible();
  const peek = page.getByRole("region", { name: "マインドマップ" });
  await expect(peek.getByText("今日の会議")).toBeVisible();
  await expect(peek.getByText("対象範囲")).toBeVisible();
  await expect(page.getByText("話の地図は残っています")).toHaveCount(0);
  await expect(page.getByText("まだ、だれも話していません")).toHaveCount(0);

  await page.getByRole("tab", { name: "マインドマップ" }).click();
  const mapLabel = page.getByText("今日の会議").first();
  await expect(mapLabel).toBeVisible({ timeout: 4000 });
  const fontSize = await mapLabel.evaluate((element) =>
    Number.parseFloat(window.getComputedStyle(element).fontSize)
  );
  expect(fontSize).toBeGreaterThanOrEqual(13);
  await expect(
    page.getByRole("link", { name: "React Flow attribution" })
  ).toBeVisible();
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
    page.getByText("『API連携でリアルタイム同期』の対象データ").first()
  ).toBeVisible();
  await page.getByText("あとで確認すること").click();
  await expect(
    page.getByRole("heading", { name: "E2E要件書会議" })
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "要件定義書エディタ" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /未決事項（ToDo \/ 宿題）/ })
  ).toBeVisible();

  const meetingId = new URL(page.url()).pathname.split("/")[2] ?? "unknown";
  const titleRow = page.locator("header");
  await expect(titleRow.getByText("E2E要件書会議")).toBeVisible();
  await expect(
    titleRow.getByRole("button", { name: "まとめをコピー" })
  ).toBeVisible();
  await expect(
    titleRow.getByRole("button", { name: "ファイルに保存" })
  ).toBeVisible();

  await titleRow.getByRole("button", { name: "まとめをコピー" }).click();
  await expect(page.getByText("コピーしました")).toBeVisible();
  await expect
    .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("# E2E要件書会議");

  const downloadPromise = page.waitForEvent("download");
  await titleRow.getByRole("button", { name: "ファイルに保存" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`requirements-${meetingId}.md`);
  await expect(page.getByText("ファイルに保存しました")).toBeVisible();

  await page.getByRole("button", { name: "なおす" }).click();
  const editor = page.locator("#requirements-markdown");
  await expect(editor).toBeVisible();
  await expect(editor).toHaveValue(/プロジェクト\/会議概要/);
  const editorBox = await editor.boundingBox();
  expect(editorBox?.height ?? 0).toBeGreaterThan(240);
  await editor.fill("# 編集後の要件定義書\n\nE2Eで書き換えました。");
  await page.getByRole("button", { name: "見る" }).click();
  await expect(
    page.getByRole("heading", { name: "編集後の要件定義書" })
  ).toBeVisible();
  await expect(page.getByText("確認することは、ありません")).toBeVisible();

  const homeInPreview = page
    .locator('[data-slot="scroll-area-viewport"]')
    .getByRole("link", { name: "ホーム" });
  await homeInPreview.scrollIntoViewIfNeeded();
  await expect(homeInPreview).toBeInViewport();
  await page.goBack();
  await expect(page).toHaveURL(/\/meetings\/[^/]+\?.*demo=1/);
  await expect(page).toHaveURL(/summary=1/);
  await expect(page).not.toHaveURL(/\/document/);
  await expect(page.getByText(PREVIEW_ADVICE_TITLE)).toBeVisible();
  await expect(page.getByRole("link", { name: "まとめを見る" })).toBeVisible();
  await expect(page.getByRole("button", { name: "おわる" })).toHaveCount(0);
  await page.getByRole("link", { name: "まとめを見る" }).click();
  await expect(page).toHaveURL(/\/document/);
  const homeAfterReturn = page
    .locator('[data-slot="scroll-area-viewport"]')
    .getByRole("link", { name: "ホーム" });
  await homeAfterReturn.scrollIntoViewIfNeeded();
  await homeAfterReturn.click();
  await expect(page).toHaveURL("/");
});

test("生成中に戻るとフロアで完了を待ち同じまとめを開ける", async ({ page }) => {
  await startUiPreview(page, "E2E生成中戻り");
  await confirmEndMeeting(page);

  await expect(page.getByText("まとめをつくっています")).toBeVisible();
  await expect(page.getByRole("button", { name: "戻る" })).toBeVisible();
  await page.getByRole("button", { name: "戻る" }).click();

  await expect(page).not.toHaveURL(/\/document/);
  await showMeetingMemos(page);
  await expect(page.getByText(PREVIEW_UTTERANCE)).toBeVisible();
  await expect(page.getByRole("button", { name: "おわる" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "まとめを見る" })).toBeVisible();
  await page.getByRole("link", { name: "まとめを見る" }).click();
  await expect(page).toHaveURL(/\/document/);
  await expect(page.getByText("あとで確認すること")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/summary=1/);
  await expect(page.getByRole("link", { name: "まとめを見る" })).toBeVisible();
  await expect(page.getByRole("button", { name: "おわる" })).toHaveCount(0);
});

async function stubRequirementsFailure(page: Page): Promise<void> {
  await page.route("**/api/v1/meetings/**/requirements", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ detail: "requirements unavailable" }),
    });
  });
}

test("実会議開始では初回認証なしで空の会議ルームが開く", async ({ page }) => {
  await stubMissingRequirements(page);
  await page.goto("/");
  await page.getByPlaceholder(/なまえ/).fill("実会議スモーク");
  await page.getByRole("button", { name: "はじめる" }).click();

  await expect(page).toHaveURL(/\/meetings\/[0-9a-f-]+\?title=/);
  await expect(page).not.toHaveURL(/demo=1/);
  await expect(page.getByText("マインドマップが作られます")).toBeVisible();
  await page.getByRole("tab", { name: "会議のメモ" }).click();
  await expect(page.getByText("まだ、だれも話していません")).toBeVisible();
  await expect(page.getByText("いまは、アドバイスがありません")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ききはじめる" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "おわる" })).toBeEnabled();
});

test("実会議は要件書GETが失敗しても操作できる", async ({ page }) => {
  await stubRequirementsFailure(page);
  await page.goto("/meetings/e2e-req-500?title=障害会議");
  await expect(page).not.toHaveURL(/demo=1/);
  await expect(
    page.getByRole("button", { name: "ききはじめる" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "おわる" })).toBeVisible();
  await expect(page.getByText("ききはじめるを押すと")).toBeVisible();
  await expect(page.getByRole("link", { name: "まとめを見る" })).toHaveCount(0);
});

test("画面共有を拒否すると聞けなかったことを表示する", async ({ page }) => {
  await stubMissingRequirements(page);
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
  await expect(page.getByText("マインドマップが作られます")).toBeVisible();
  await page.getByRole("tab", { name: "会議のメモ" }).click();
  await expect(page.getByText("まだ、だれも話していません")).toBeVisible();
  await page.getByRole("button", { name: "ききはじめる" }).click();
  await expect(page.getByText("うまく聞けませんでした")).toBeVisible();
});

function requirementDocumentPayload(meetingId: string, title: string) {
  return {
    id: `doc-${meetingId}`,
    meeting_id: meetingId,
    title,
    markdown: `# ${title}\n\n遅延したまとめです。`,
    sections: [
      {
        section_id: "open_issues",
        heading: "6. 未決事項（ToDo / 宿題）・確認中リスク一覧",
        body_markdown: "- なし",
      },
    ],
    created_at: "2026-09-20T00:00:00.000Z",
    model: "anthropic/claude-3-5-sonnet",
    source_utterance_count: 0,
    source_detection_count: 0,
  };
}

async function installClosedWebSocket(page: Page): Promise<void> {
  await page.addInitScript(() => {
    class ImmediateFailWebSocket {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSED = 3;
      readonly url: string;
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
  });
}

test("読込中のまとめから戻ってもおわるは出ない", async ({ page }) => {
  await page.route("**/api/v1/meetings/**/requirements", async (route) => {
    await new Promise((resolve) => {
      setTimeout(resolve, 2500);
    });
    const meetingId =
      route.request().url().split("/meetings/")[1]?.split("/")[0] ?? "unknown";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(requirementDocumentPayload(meetingId, "読込中会議")),
    });
  });

  await page.goto("/meetings/e2e-loading-doc/document?title=読込中会議");
  await expect(
    page.locator("header").getByRole("button", { name: "まとめをコピー" })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "ホーム" })).toHaveCount(0);
  await expect(page.getByText("遅延したまとめです。")).toHaveCount(0);
  await page.goto("/");
  await page.goto("/meetings/e2e-loading-doc?title=読込中会議&summary=1");
  await expect(page).not.toHaveURL(/\/document/);
  await expect(page.getByRole("link", { name: "まとめを見る" })).toBeVisible();
  await expect(page.getByRole("button", { name: "おわる" })).toHaveCount(0);
});

test("実会議の生成中に戻るとフロアで完了を待ち同じまとめを開ける", async ({
  page,
}) => {
  await installClosedWebSocket(page);
  let finalized = false;
  await page.route("**/api/v1/meetings/**/finalize", async (route) => {
    await new Promise((resolve) => {
      setTimeout(resolve, 1600);
    });
    finalized = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        requirementDocumentPayload("e2e-gen-wait", "生成待ち会議")
      ),
    });
  });
  await page.route("**/api/v1/meetings/**/requirements", async (route) => {
    if (!finalized) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: "requirements document not found" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        requirementDocumentPayload("e2e-gen-wait", "生成待ち会議")
      ),
    });
  });

  await page.goto("/meetings/e2e-gen-wait?title=生成待ち会議");
  await expect(page.getByRole("button", { name: "おわる" })).toBeVisible();
  await confirmEndMeeting(page);
  await expect(page.getByText("まとめをつくっています")).toBeVisible();
  await page.getByRole("button", { name: "戻る" }).click();
  await expect(page).not.toHaveURL(/\/document/);
  await expect(page.getByRole("button", { name: "おわる" })).toHaveCount(0);
  await expect(page.getByText("まとめをつくっています")).toBeVisible();
  await expect(page.getByRole("link", { name: "まとめを見る" })).toBeVisible({
    timeout: 8000,
  });
  await page.getByRole("link", { name: "まとめを見る" }).click();
  await expect(page).toHaveURL(/\/document/);
  await expect(
    page.getByText("遅延したまとめです。", { exact: true })
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/summary=1/);
  await expect(page.getByRole("link", { name: "まとめを見る" })).toBeVisible();
  await expect(page.getByRole("button", { name: "おわる" })).toHaveCount(0);
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
  await expect(page.getByRole("link", { name: "ホーム" })).toHaveCount(0);
  await page.goto("/");
  await page.goto("/meetings/e2e-missing-doc?title=未生成会議");
  await expect(page).not.toHaveURL(/summary=1/);
  await expect(page.getByRole("link", { name: "まとめを見る" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "おわる" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ききはじめる" })
  ).toBeVisible();
});

test("まとめの読込失敗ではホームを出さない", async ({ page }) => {
  await stubRequirementsFailure(page);
  await page.goto("/meetings/e2e-doc-error/document?title=失敗まとめ");
  await expect(page.getByText("まとめを開けませんでした")).toBeVisible();
  await expect(page.getByRole("link", { name: "ホーム" })).toHaveCount(0);
});

const REAL_MEMO = "実会議の残ったメモです。";
const REAL_WHISPER = "実会議の残ったささやき";

async function seedRealMeetingFloor(
  page: Page,
  meetingId: string,
  title: string,
  options?: { rememberSummary?: boolean; ended?: boolean }
): Promise<void> {
  const rememberSummary = options?.rememberSummary ?? true;
  const ended = options?.ended ?? true;
  await page.addInitScript(
    ({
      meetingId: id,
      title: meetingTitle,
      rememberSummary: remember,
      ended: alreadyEnded,
    }) => {
      const snapshot = {
        ended: alreadyEnded,
        utterances: [
          {
            id: "utt-real-1",
            meetingId: id,
            speaker: "local_pm",
            text: "実会議の残ったメモです。",
            startMs: 1000,
            endMs: 4000,
            isFinal: true,
            createdAt: "2026-09-20T00:00:01.000Z",
          },
        ],
        adviceItems: [
          {
            id: "adv-real-1",
            meetingId: id,
            category: "unexplained_jargon",
            priority: "high",
            title: "実会議の残ったささやき",
            reason: "用語が未定義のまま進んでいます。",
            suggestedQuestion: "その言葉は何を指しますか？",
            detectedAt: "2026-09-20T00:00:02.000Z",
            quote: "API連携",
          },
        ],
      };
      const snapKey = `return-to-meeting:floor-snapshot:${id}`;
      const sumKey = `return-to-meeting:completed-summary:${id}`;
      const href = `/meetings/${id}/document?title=${encodeURIComponent(meetingTitle)}`;
      const raw = JSON.stringify(snapshot);
      sessionStorage.setItem(snapKey, raw);
      if (remember) {
        sessionStorage.setItem(sumKey, href);
        localStorage.setItem(sumKey, href);
      }
    },
    { meetingId, title, rememberSummary, ended }
  );
}

async function stubReadyRequirements(
  page: Page,
  meetingId: string,
  title: string
): Promise<void> {
  await page.route("**/api/v1/meetings/**/requirements", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(requirementDocumentPayload(meetingId, title)),
    });
  });
}

test("実会議のまとめから戻るとメモとアドバイスが残る", async ({ page }) => {
  await seedRealMeetingFloor(page, "e2e-real-floor", "実会議フロア");
  await stubReadyRequirements(page, "e2e-real-floor", "実会議フロア");

  await page.goto("/meetings/e2e-real-floor/document?title=実会議フロア");
  await expect(
    page.getByText("遅延したまとめです。", { exact: true })
  ).toBeVisible();
  const homeInPreview = page
    .locator('[data-slot="scroll-area-viewport"]')
    .getByRole("link", { name: "ホーム" });
  await homeInPreview.scrollIntoViewIfNeeded();
  await expect(homeInPreview).toBeInViewport();
  await page.goto("/meetings/e2e-real-floor?title=実会議フロア&summary=1");

  await expect(page).toHaveURL(/\/meetings\/e2e-real-floor\?/);
  await expect(page).toHaveURL(/summary=1/);
  await expect(page).not.toHaveURL(/demo=1/);
  await expect(page).not.toHaveURL(/\/document/);
  await expect(page.getByText(REAL_WHISPER)).toBeVisible();
  await showMeetingMemos(page);
  await expect(page.getByText(REAL_MEMO)).toBeVisible();
  await expect(page.getByText("まだ、だれも話していません")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "まとめを見る" })).toBeVisible();
  await expect(page.getByRole("button", { name: "おわる" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ききはじめる" })).toHaveCount(
    0
  );
});

test("実会議を summary なしで開き直してもメモと終了が残る", async ({
  page,
}) => {
  await seedRealMeetingFloor(page, "e2e-real-reload", "実会議再読込");
  await stubReadyRequirements(page, "e2e-real-reload", "実会議再読込");

  await page.goto("/meetings/e2e-real-reload?title=実会議再読込");
  await expect(page).not.toHaveURL(/summary=1/);
  await expect(page).not.toHaveURL(/demo=1/);
  await expect(page.getByText(REAL_WHISPER)).toBeVisible();
  await showMeetingMemos(page);
  await expect(page.getByText(REAL_MEMO)).toBeVisible();
  await expect(page.getByRole("link", { name: "まとめを見る" })).toBeVisible();
  await expect(page.getByRole("button", { name: "おわる" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ききはじめる" })).toHaveCount(
    0
  );
  await expect(page.getByText("ききはじめるを押すと")).toHaveCount(0);
});

test("おためしでまとめが自動で開いたあとブラウザ戻るでも終わったまま", async ({
  page,
}) => {
  await startUiPreview(page, "E2Eブラウザ戻り");
  await confirmEndMeeting(page);
  await expect(page).toHaveURL(/\/meetings\/.+\/document\?.*demo=1/);
  await expect(page.getByText("あとで確認すること")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/meetings\/[^/]+\?/);
  await expect(page).toHaveURL(/summary=1/);
  await expect(page).not.toHaveURL(/\/document/);
  await showMeetingMemos(page);
  await expect(page.getByText(PREVIEW_UTTERANCE)).toBeVisible();
  await expect(page.getByRole("link", { name: "まとめを見る" })).toBeVisible();
  await expect(page.getByRole("button", { name: "おわる" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ききはじめる" })).toHaveCount(
    0
  );
});

test("読込のあと空のまとめから戻ると会議は続く", async ({ page }) => {
  await page.route("**/api/v1/meetings/**/requirements", async (route) => {
    await new Promise((resolve) => {
      setTimeout(resolve, 600);
    });
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ detail: "requirements document not found" }),
    });
  });

  await page.goto("/meetings/e2e-empty-after-load/document?title=空まとめ");
  await expect(page.getByText("まとめは、まだ出来ていません")).toBeVisible();
  await expect(page.getByRole("link", { name: "ホーム" })).toHaveCount(0);
  await page.goto("/");
  await page.goto("/meetings/e2e-empty-after-load?title=空まとめ");
  await expect(page).not.toHaveURL(/summary=1/);
  await expect(page.getByRole("button", { name: "おわる" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ききはじめる" })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "まとめを見る" })).toHaveCount(0);
});

test("終了スナップショットでもまとめが無いとやり直せる", async ({ page }) => {
  await seedRealMeetingFloor(page, "e2e-ended-missing", "終了欠落", {
    rememberSummary: true,
    ended: true,
  });
  await stubMissingRequirements(page);

  await page.goto("/meetings/e2e-ended-missing?title=終了欠落");
  await expect(page.getByRole("button", { name: "おわる" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ききはじめる" })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "まとめを見る" })).toHaveCount(0);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const raw = sessionStorage.getItem(
          "return-to-meeting:floor-snapshot:e2e-ended-missing"
        );
        return raw === null
          ? null
          : (JSON.parse(raw) as { ended: boolean }).ended;
      })
    )
    .toBe(false);
});

test("実会議の生成失敗後に開き直すとやり直せる", async ({ page }) => {
  await installClosedWebSocket(page);
  await seedRealMeetingFloor(page, "e2e-fail-finalize", "失敗会議", {
    rememberSummary: false,
    ended: false,
  });
  await page.route("**/api/v1/meetings/**/finalize", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ detail: "finalize failed" }),
    });
  });
  await stubRequirementsFailure(page);

  await page.goto("/meetings/e2e-fail-finalize?title=失敗会議");
  await showMeetingMemos(page);
  await expect(page.getByText(REAL_MEMO)).toBeVisible();
  await confirmEndMeeting(page);
  await expect(page.getByText("まとめを作れませんでした。")).toBeVisible();
  await expect(page.getByRole("button", { name: "もういちど" })).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const raw = sessionStorage.getItem(
          "return-to-meeting:floor-snapshot:e2e-fail-finalize"
        );
        return raw === null
          ? null
          : (JSON.parse(raw) as { ended: boolean }).ended;
      })
    )
    .toBe(false);

  await page.reload();
  await expect(page.getByText(REAL_WHISPER)).toBeVisible();
  await showMeetingMemos(page);
  await expect(page.getByText(REAL_MEMO)).toBeVisible();
  await expect(page.getByRole("button", { name: "おわる" })).toBeVisible();
  await expect(page.getByRole("button", { name: "もういちど" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "まとめを見る" })).toHaveCount(0);
});
