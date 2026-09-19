# AI HACK APP1

業務定期ヒアリングを AI が自律管理し、曖昧・矛盾・無理を検出して解消し、会議終了時点で要件定義書が完成している状態を実現するリアルタイムコパイロット Web アプリケーション。

---

## リポジトリ構成（モノレポ構造）

本リポジトリはフロントエンドとバックエンドの関心事を明確に分離した構成を採用しています。

```
ai-hack-app1/
├── frontend/             # Next.js App Router (TypeScript Strict Mode) / FSD
│   ├── app/              # Next.js ルーティング層（薄い配線）
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

| 領域 | 採用技術 |
| :--- | :--- |
| **ユーザー対応言語** | 日本語（Japanese） |
| **フロントエンド FW** | Next.js 16 (App Router, React 19) |
| **フロントエンド設計** | Feature-Sliced Design (FSD) |
| **フロントエンド言語** | TypeScript (Strict Mode) |
| **フロントエンド パッケージ管理** | `pnpm` (lockfile 必須) |
| **フロントエンド検証** | Steiger (FSD構造検証), ESLint, Prettier, `tsc --noEmit` |
| **バックエンド FW** | FastAPI + Uvicorn |
| **バックエンド設計** | Clean Architecture |
| **バックエンド言語** | Python 3.12+ (Go言語の利用は禁止) |
| **バックエンド パッケージ管理** | `uv` (lockfile 必須) |
| **バックエンド検証** | `ruff` (lint & format), `mypy` (strict), `import-linter`, `pytest` |
| **AI Gateway** | オルカルーター（Orca Router / `https://api.orcarouter.ai/v1`）必須 |
| **CI/CD** | GitHub Actions |

---

## クイックスタート

### フロントエンド (`frontend/`)

```bash
cd frontend
pnpm install
pnpm run dev      # 開発サーバー起動 (http://localhost:3000)
pnpm run verify   # 型検査・リント・Steiger FSD検査・フォーマット確認
pnpm run build    # 本番ビルド
```

会議コパイロット画面は `/meetings/{meetingId}` です。トップの「セッション開始」から開きます。表示確認だけする場合は「UIプレビュー」を使うと、実音声なしで文字起こしと助言カードを確認できます。会議終了後は `/meetings/{meetingId}/document` で要件定義書のプレビュー・編集・コピー・`.md` ダウンロードができます。UIプレビューから会議終了すると、同じ `demo=1` のまま要件書画面を確認できます。

ローカルでバックエンドの WebSocket に接続する場合、フロントは開発ポート（3000）から `ws://localhost:8000/ws/meetings/{id}/audio` へ接続します。別オリジンにするときは `NEXT_PUBLIC_BACKEND_WS_ORIGIN` を設定します。REST（`/api/v1/meetings/{id}/finalize` など）は開発時に Next.js が `http://localhost:8000` へリライトします。バックエンド HTTP の向き先を変えるときは `BACKEND_HTTP_ORIGIN` または `NEXT_PUBLIC_BACKEND_HTTP_ORIGIN` を設定します。

### バックエンド (`backend/`)

```bash
cd backend
uv sync           # 依存関係インストール
uv run uvicorn main:app --reload --port 8000 # 開発サーバー起動 (http://localhost:8000)
uv run pytest     # テスト実行
uv run lint-imports # クリーンアーキテクチャ依存方向検査
uv run mypy app main.py tests # 型検査
uv run ruff check . # リント検査
```
