# AI HACK APP1

業務定期ヒアリングを AI が自律管理し、曖昧・矛盾・無理・専門用語の取り違えを検出して解消し、会議終了時点で要件定義書が完成している状態を実現するリアルタイムコパイロット Web アプリケーション。

相手（クライアント）は通常の Google Meet のまま参加します。使うのは自社側（PM / コンサルタント）のブラウザだけです。初回認証はありません。

---

## リポジトリ構成（モノレポ構造）

本リポジトリはフロントエンドとバックエンドの関心事を明確に分離した構成を採用しています。

```
ai-hack-app1/
├── frontend/             # Next.js App Router (TypeScript Strict Mode) / FSD
│   ├── app/              # Next.js ルーティング層（薄い配線）
│   ├── e2e/              # Playwright 会議フロー E2E
│   ├── src/
│   │   ├── _app/         # FSD app レイヤー（グローバル設定・初期化）
│   │   ├── _pages/       # FSD pages レイヤー（画面単位コンポジション）
│   │   ├── widgets/      # FSD widgets レイヤー（自己完結型UIブロック）
│   │   ├── features/     # FSD features レイヤー（ユースケース・操作）
│   │   ├── entities/     # FSD entities レイヤー（ビジネスモデル・ドメインUI）
│   │   └── shared/       # FSD shared レイヤー（共通基盤・UI・ユーティリティ）
│   └── package.json
├── backend/              # Python 3.12+ / FastAPI / Clean Architecture
│   ├── app/
│   │   ├── domain/       # 純粋なドメインモデル・エンティティ・ポート
│   │   ├── application/  # ユースケース・DTO
│   │   ├── infrastructure/# 設定・Orca Router連携・外部アダプタ
│   │   └── presentation/ # FastAPI ルーター・スキーマ・DI
│   ├── main.py           # アプリケーション起動・合成ルート
│   └── pyproject.toml
├── .github/
│   └── workflows/
│       └── ci.yml        # フロントエンド・バックエンド自動検証 CI
└── AGENTS.md             # リポジトリ恒久設計規約・実装ルール
```

---

## 技術スタック

| 領域                              | 採用技術                                                                            |
| :-------------------------------- | :---------------------------------------------------------------------------------- |
| **ユーザー対応言語**              | 日本語（Japanese）                                                                  |
| **フロントエンド FW**             | Next.js 16 (App Router, React 19)                                                   |
| **フロントエンド設計**            | Feature-Sliced Design (FSD)                                                         |
| **フロントエンド言語**            | TypeScript (Strict Mode)                                                            |
| **フロントエンド パッケージ管理** | `pnpm` (lockfile 必須)                                                              |
| **フロントエンド検証**            | Steiger (FSD構造検証), ESLint, Prettier, `tsc --noEmit`, Playwright E2E             |
| **バックエンド FW**               | FastAPI + Uvicorn                                                                   |
| **バックエンド設計**              | Clean Architecture                                                                  |
| **バックエンド言語**              | Python 3.12+ (Go言語の利用は禁止)                                                   |
| **バックエンド パッケージ管理**   | `uv` (lockfile 必須)                                                                |
| **バックエンド検証**              | `ruff` (lint & format), `mypy` (strict), `import-linter`, `pytest`（結合 E2E 含む） |
| **AI Gateway**                    | オルカルーター（Orca Router / `https://api.orcarouter.ai/v1`）必須                  |
| **CI/CD**                         | GitHub Actions                                                                      |

---

## 環境変数

フロントエンドから AI Gateway やプロバイダへ直接通信しません。LLM キーはバックエンドだけが持ちます。

### バックエンド (`backend/.env`)

コピー用の実在名は `backend/.env.example` にあります。`cp backend/.env.example backend/.env` してから値を入れてください。初回認証は追加しません。助言・要件書のデフォルトは [Orca Router 無料モデル](https://docs.orcarouter.ai/ja/routing/free-models) です。名前付きルーティング（`orcarouter/free` 等）は後続で入れます。

| 変数                                      | 必須           | 説明                                                                                            |
| :---------------------------------------- | :------------- | :---------------------------------------------------------------------------------------------- |
| `ORCAROUTER_API_KEY`                      | 実運用時は必須 | オルカルーター API キー。未設定でも音声ストリームは動きますが、助言・話の地図・要件書生成は無効になります |
| `ORCAROUTER_BASE_URL`                     | 任意           | デフォルト `https://api.orcarouter.ai/v1`                                                       |
| `ORCAROUTER_DEFAULT_MODEL`                | 任意           | リアルタイム助言モデル。デフォルトは無料モデル `deepseek/deepseek-v4-flash-free`                |
| `ORCAROUTER_TIMEOUT_SECONDS`              | 任意           | 助言呼び出しタイムアウト秒。デフォルト `60.0`                                                   |
| `ORCAROUTER_REQUIREMENTS_MODEL`           | 任意           | 要件書生成モデル。デフォルトは無料モデル `deepseek/deepseek-v4-flash-free`                      |
| `ORCAROUTER_REQUIREMENTS_FALLBACK_MODELS` | 任意           | カンマ区切りフォールバック。デフォルトは空（`-free` は fallback 先にできないため）              |
| `ORCAROUTER_REQUIREMENTS_TIMEOUT_SECONDS` | 任意           | 要件書生成タイムアウト秒。デフォルト `120.0`                                                    |
| `WHISPER_MODEL_SIZE`                      | 任意           | faster-whisper サイズ。デフォルト `base`                                                        |
| `WHISPER_DEVICE`                          | 任意           | デフォルト `cpu`                                                                                |
| `WHISPER_COMPUTE_TYPE`                    | 任意           | デフォルト `int8`                                                                               |
| `WHISPER_LANGUAGE`                        | 任意           | デフォルト `ja`                                                                                 |
| `AUDIO_SAMPLE_RATE`                       | 任意           | デフォルト `16000`                                                                              |
| `APP_NAME`                                | 任意           | プロセス表示名。デフォルト `AI HACK APP1 API`                                                   |
| `APP_VERSION`                             | 任意           | デフォルト `0.1.0`                                                                              |
| `DEBUG`                                   | 任意           | デフォルト `false`                                                                              |

### フロントエンド

| 変数                            | 必須 | 説明                                                             |
| :------------------------------ | :--- | :--------------------------------------------------------------- |
| `BACKEND_HTTP_ORIGIN`           | 任意 | Next.js rewrite 先。デフォルト `http://localhost:8000`           |
| `NEXT_PUBLIC_BACKEND_WS_ORIGIN` | 任意 | 会議音声 WebSocket の接続先。未設定時は同一ホストの `/ws` を利用 |

`NEXT_PUBLIC_*` に API キーを置かないでください。

---

## クイックスタート

### バックエンド (`backend/`)

```bash
cd backend
uv sync
cp .env.example .env
# 実助言・要件書生成を使う場合は .env の ORCAROUTER_API_KEY を入れる
uv run uvicorn main:app --reload --port 8000
```

### フロントエンド (`frontend/`)

```bash
cd frontend
pnpm install
pnpm run dev      # http://localhost:3000
```

---

## デモ手順

### A. 認証なし・音声なしの UI プレビュー（提出デモ最短）

実マイクや Google Meet が無い環境でも、既存の会議〜助言〜終了〜要件書プレビュー／書き出しを通して見せられます。

1. フロントエンドを起動し http://localhost:3000 を開く。
2. 会議名を入力し **UIプレビュー** を押す（初回ログインは不要）。
3. 左のアドバイスと、右の「話の地図 / 会議のメモ」タブを確認する。境界を拖ると左右の幅を変えられます。おためしでは話の地図が育ちます。
4. **会議終了** → **終了する** で要件定義書画面へ進む。
5. タイトル右のアイコンでコピーまたはファイル保存し、見る / なおすを切り替える。

### B. Google Meet 併用の実機シナリオ

1. バックエンドとフロントエンドを起動し、`ORCAROUTER_API_KEY` を設定する。
2. Chrome で Google Meet を開き、相手は通常どおり参加する。
3. コパイロットを Meet の横に並べ、ホームで **セッション開始** する。
4. **キャプチャ開始** → Chrome タブ → Meet タブを選び、**タブの音声を共有** を ON にする。
5. マイク許可後、曖昧な要望・矛盾・無理な納期・説明なしの専門用語＋「了解です」などを話す。
6. 自社画面だけに助言カードが出ることを確認する（相手の Meet には出ない）。
7. **会議終了** で Markdown 要件定義書が生成され、プレビュー・編集・書き出しできる。

画面共有をキャンセルした場合は「うまく聞けませんでした」が出ます。WebSocket 切断時は再接続を試します。Orca Router 未設定時は助言・話の地図・要件書生成が無効になります。

---

## 検証コマンド

### フロントエンド

```bash
cd frontend
pnpm run verify   # 型検査・リント・Steiger・単体テスト・フォーマット
pnpm run build    # 本番ビルド（E2E の前提）
pnpm exec playwright install --with-deps chromium
pnpm run test:e2e # 会議〜助言〜終了〜要件書プレビュー／書き出し
```

### バックエンド

```bash
cd backend
uv run pytest     # 単体・結合。擬似音声 → 助言 → finalize → 要件書ダウンロードを含む
uv run lint-imports
uv run mypy app main.py tests
uv run ruff check .
```
