#!/usr/bin/env node
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../../..");
const frontendDir = path.join(repoRoot, "frontend");
const require = createRequire(path.join(frontendDir, "package.json"));
const { chromium } = require("@playwright/test");

function resolveStrict(raw) {
  const absolute = path.resolve(raw);
  const root = path.parse(absolute).root;
  const segments = absolute.split(path.sep).filter(Boolean);
  let current = root;
  for (const segment of segments) {
    const next = path.join(current, segment);
    try {
      current = realpathSync(next);
    } catch {
      current = path.normalize(next);
    }
  }
  return current;
}

function isTmpChild(resolved) {
  return resolved.startsWith("/tmp/") && resolved !== "/tmp";
}

function isStoreMedia(resolved) {
  const parts = resolved.split(path.sep).filter(Boolean);
  return (
    parts.length >= 5 &&
    parts[0] === "cursor" &&
    parts[1] === "stores" &&
    parts[2] !== "." &&
    parts[2] !== ".." &&
    parts[3] === "media" &&
    parts[4] !== "." &&
    parts[4] !== ".."
  );
}

function requireAllowedEvidenceDir(raw) {
  const resolved = resolveStrict(raw);
  if (isTmpChild(resolved) || isStoreMedia(resolved)) {
    return resolved;
  }
  throw new Error(
    `VERIFY_EVIDENCE_DIR must resolve under /tmp/<name> or /cursor/stores/<id>/media/<name>, got: ${resolved}`
  );
}

const feature = process.argv[2] ?? "meeting-floor";
const baseURL = process.env.VERIFY_FRONTEND_URL ?? "http://127.0.0.1:3100";
const evidenceDir = requireAllowedEvidenceDir(
  process.env.VERIFY_EVIDENCE_DIR ?? "/tmp/verify-meeting-copilot-evidence"
);

const PREVIEW_UTTERANCE =
  "今回の対象範囲は、既存顧客向けの更新申請だけと考えてよいですか？";
const PREVIEW_ADVICE_TITLE = "専門用語が説明なく使われています";
const PREVIEW_QUESTION =
  "『API連携でリアルタイム同期』は、今ある画面を見るだけですか？";

async function driveMeetingFloor(page) {
  await page.goto(`${baseURL}/`);
  await page
    .getByRole("heading", { name: /会議がおわると/ })
    .waitFor({ state: "visible" });
  await page.getByText("相手の画面には出ません").waitFor({ state: "visible" });
  await page.screenshot({
    path: path.join(evidenceDir, "meeting-floor-home.png"),
    fullPage: true,
  });

  await page.getByRole("textbox", { name: "今日の会議のなまえ" }).fill("検証フロア");
  await page.getByRole("button", { name: "おためし" }).click();
  await page.waitForURL(/\/meetings\/.+[?&]demo=1/);

  await page.getByRole("region", { name: "こちら" }).waitFor({ state: "visible" });
  await page.getByRole("region", { name: "むこう" }).waitFor({ state: "visible" });
  await page.getByText("検証フロア").first().waitFor({ state: "visible" });
  await page.getByText("おためし").first().waitFor({ state: "visible" });
  await page.getByRole("button", { name: "おためしちゅう" }).waitFor({
    state: "visible",
  });

  const map = page.getByRole("region", { name: "話の地図" });
  await map.getByText("今日の会議").waitFor({ state: "visible", timeout: 4000 });
  await map.getByText("対象範囲").waitFor({ state: "visible", timeout: 4000 });
  await map.getByText("例外は宿題", { exact: true }).waitFor({
    state: "visible",
    timeout: 4000,
  });
  await page
    .getByRole("complementary", { name: "こちらのささやき" })
    .waitFor({ state: "visible" });
  await page.getByText(PREVIEW_ADVICE_TITLE).waitFor({ state: "visible" });
  await page.getByText(PREVIEW_QUESTION).waitFor({ state: "visible" });

  await page.screenshot({
    path: path.join(evidenceDir, "meeting-floor-map.png"),
    fullPage: true,
  });

  await page.getByRole("tab", { name: "会議のメモ" }).click();
  await page.getByRole("region", { name: "会議のメモ" }).waitFor({
    state: "visible",
  });
  await page.getByText(PREVIEW_UTTERANCE).waitFor({ state: "visible" });
  await page.getByText("了解です。そこはお任せします。").waitFor({
    state: "visible",
  });

  await page.screenshot({
    path: path.join(evidenceDir, "meeting-floor-memos.png"),
    fullPage: true,
  });

  const snapshot = await page.locator("body").ariaSnapshot();
  await writeFile(
    path.join(evidenceDir, "meeting-floor.aria.txt"),
    snapshot,
    "utf8"
  );
}

async function main() {
  if (feature !== "meeting-floor") {
    throw new Error(
      `drive.mjs implements meeting-floor only. Use the feature file selectors for ${feature}.`
    );
  }

  await mkdir(evidenceDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "ja-JP",
    viewport: { width: 1280, height: 800 },
    recordVideo: {
      dir: evidenceDir,
      size: { width: 1280, height: 800 },
    },
  });
  const page = await context.newPage();

  try {
    await driveMeetingFloor(page);
  } finally {
    const video = page.video();
    await page.close();
    if (video) {
      const rawPath = await video.path();
      const dest = path.join(evidenceDir, "meeting-floor.webm");
      await rename(rawPath, dest);
    }
    await context.close();
    await browser.close();
  }

  await writeFile(
    path.join(evidenceDir, "meeting-floor.json"),
    `${JSON.stringify(
      {
        feature: "meeting-floor",
        entry: "home おためし",
        baseURL,
        evidenceDir,
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  console.log(`Drove meeting-floor against ${baseURL}`);
  console.log(`Evidence: ${evidenceDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
