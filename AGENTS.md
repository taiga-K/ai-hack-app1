# AGENTS.md

AI エージェントおよびコーディングアシスタント向けの恒久ルール。
実装・レビュー・提案の前に必ず読むこと。このファイルと矛盾する慣習（特に Go バックエンド前提）は採用しない。

## 言語

- ユーザーへの回答、進捗共有、レビューコメント、提案、質問は**必ず日本語**で行う。
- コード、識別子、コマンド、コミットメッセージ、API 名・ファイル名は英語でよい。
- ユーザー向け説明は日本語、実装面の固有名詞は既存スタックの英語表記を維持する。

## プロジェクト概要

- リポジトリ: AI HACK 提出用アプリ（`ai-hack-app1`）。
- 現状はグリーンフィールド。ソース、依存、設定が未投入でも、以降の実装はこの文書のスタックと境界に従う。
- フロントエンドとバックエンドは責務を分離する。LLM / 生成 AI 呼び出しはバックエンドのインフラ層からのみ行い、フロントからプロバイダへ直接接続しない。

## 技術スタック（固定）

変更しない。代替スタックの提案や混在実装は禁止。

| 領域 | 採用 | 禁止例 |
| --- | --- | --- |
| フロントエンド言語 | TypeScript（strict） | JavaScript 新規ファイル、`.jsx` 新規追加 |
| フロントエンド FW | Next.js App Router | Pages Router、Vite+React 単体、Remix |
| フロントエンド設計 | Feature-Sliced Design（FSD） | 層を無視した `components/` 一極集中 |
| バックエンド言語 | Python 3.12+ | Go、Node を API 本体にする |
| バックエンド FW | FastAPI | Gin、Echo、Django を API 本体にする |
| バックエンド設計 | Clean Architecture | ハンドラにドメインロジックを直書き |
| AI Gateway | **オルカルーター（OrcaRouter / Orcha Router）必須** | OpenAI / Anthropic / Google 等への直接呼び出し |

- UI ライブラリは React（Next.js 同梱）。状態・データ取得は FSD スライスの `model` / `api` に置く。
- バックエンドの HTTP スキーマ検証は Pydantic v2。ASGI サーバは uvicorn。
- パッケージ管理はフロント `pnpm`、バック `uv` または `pip` + lockfile。混在させない。
- アーキテクチャ検査はフロント Steiger、バックは import-linter / 同等の層依存チェックを推奨。

## AI Gateway（必須・例外なし）

オルカルーター（OrcaRouter、別名 Orcha Router）は任意ではない。生成 AI・LLM・埋め込み・マルチモーダル推論を行うすべてのリクエストは、このゲートウェイだけを通す。

### 必須制約

- 上流プロバイダ（OpenAI、Anthropic、Google、DeepSeek、xAI、Qwen 等）の公式 SDK や REST を**直接呼び出さない**。
- フロントエンド、BFF、スクリプト、評価用コード、Notebook も例外にしない。
- クライアントは OpenAI 互換 SDK 等を用い、向き先だけを OrcaRouter にする。
  - Base URL: `https://api.orcarouter.ai/v1`
  - API Key: 環境変数 `ORCAROUTER_API_KEY`（コード・リポジトリ・クライアントバンドルに埋め込まない）
- モデル指定は OrcaRouter が解釈できる ID のみ。
  - 自動ルーティング: `orcarouter/auto`
  - 明示指定: `openai/gpt-4o-mini` のようなプロバイダ接頭辞付き
- 障害時の切替はアプリ内でプロバイダを直呼びせず、OrcaRouter のフォールバック（`extra_body.models` と `extra_body.route: "fallback"`）を使う。
- 新規プロバイダ追加は「OrcaRouter 経由で届くモデル ID を増やす」ことであり、アダプタを増やすことではない。

### 配置

- OrcaRouter クライアントはバックエンドの **infrastructure adapter** にだけ置く。
- domain / application は「生成する」「完了を返す」といったポート（interface）だけを知り、HTTP・SDK・モデル名の都合を持たない。
- Next.js の Route Handler や Server Action から LLM プロバイダへ接続しない。必要な場合も必ず FastAPI 経由、その先で OrcaRouter を使う。
- シークレットはサーバ側のみ。`NEXT_PUBLIC_*` にゲートウェイキーを出さない。

### 違反

次はマージ禁止。

- `api.openai.com` / Anthropic / Gemini 等への直接接続
- プロバイダ公式 SDK を OrcaRouter 以外の `base_url` で使うこと
- フロントから OrcaRouter やプロバイダを直接叩くこと
- 「開発中だけ直呼び」「フォールバックとして直呼び」などの例外

## フロントエンド境界（Next.js App Router + FSD）

公式の FSD × Next.js ガイドに従う。Next.js の `app/` / `pages/` と FSD 層名が衝突するため、FSD 層はプレフィックスする。

```
app/                      # Next.js App Router のみ。薄い page / layout / route
src/
  _app/                   # FSD app 層（配線、providers、api-routes）
  _pages/                 # FSD pages 層（画面合成）
  widgets/
  features/
  entities/
  shared/
```

### 依存方向（上から下のみ）

`_app` → `_pages` → `widgets` → `features` → `entities` → `shared`

- 同じ層の別スライスを import しない。entities 同士が必要なときだけ `@x` 公開 API を使う。
- `_app` と `shared` はスライスではなくセグメントで分割する。
- スライス外からは `index.ts`（必要なら `index.server.ts`）だけを import する。内部セグメント（`ui` / `model` / `api` / `lib` / `config`）への深掘り import は禁止。
- `app/**/page.tsx` と `app/**/route.ts` は re-export と配線に留め、画面本体や業務ロジックを置かない。
- Server-only モジュールを Client Component が import する `index.ts` から再エクスポートしない。サーバ専用は `index.server.ts` と `server-only` で隔離する。
- Next.js Route Handler の実装は `src/_app/api-routes` に置き、`app/api/**/route.ts` は re-export する。ただし LLM 呼び出しの本体は FastAPI 側に置く。

### 置いてはいけないもの

- `src/components`、`src/hooks`、`src/utils` のような層を無視した汎用ダンプ
- `shared` を何でも置き場にすること（ビジネス用語の実体は `entities` / `features`）
- Pages Router（ルートの `pages/` をルーティングに使うこと）

## バックエンド境界（Python / FastAPI / Clean Architecture）

Go・Gin・`cmd/`・`internal/` 前提の配置は使わない。Python パッケージとして層を分ける。

```
backend/
  app/
    domain/               # エンティティ、値オブジェクト、ドメインエラー、リポジトリ/AI ポート
    application/          # ユースケース、入力/出力 DTO、アプリケーションサービス
    infrastructure/       # DB、OrcaRouter クライアント、外部 API、具象リポジトリ
    presentation/         # FastAPI ルーター、リクエスト/レスポンススキーマ、依存注入配線
    main.py               # 合成ルート（Composition Root）。アプリ組み立てのみ
```

パッケージ名は同等の意味を保てば変更してよいが、**依存の向きは変えない**。

### 依存規則

- 内側は外側を import しない。
  - `domain` → 標準ライブラリと純粋な型のみ。FastAPI / Pydantic 設定モデル / HTTPX / ORM / OrcaRouter SDK 禁止。
  - `application` → `domain` のみ。フレームワークと I/O 具象禁止。
  - `infrastructure` → `domain` / `application` のポートを実装する。
  - `presentation` → ユースケースを呼び、HTTP とスキーマ変換だけを行う。
- FastAPI のルーターに業務ルール、プロンプト組み立ての本体、トランザクション境界の判断を置かない。
- DB セッション、HTTP クライアント、OrcaRouter クライアントは usecase にコンストラクタ注入する。グローバルシングルトンからの暗黙取得で層をまたがない。
- 永続化モデル（ORM）とドメインエンティティを同一型にしない。変換は infrastructure。

### FastAPI 慣習

- パス操作は小さく保ち、ユースケースを await して結果を HTTP に写す。
- 入力検証は presentation の Pydantic モデル。ドメイン不変条件は domain。
- エラーは例外階層で上げ、presentation で HTTP 例外へ写す。空の `except` で握りつぶさない。
- 型ヒントを必須にする。`Any` の拡散を避ける。
- 副作用のある I/O はすべてポートの向こうに置く。

## 共通実装規約

- いきなり実装せず、変更対象の層とスライス（またはユースケース）を先に決める。
- 名前から責務が分かること。`utils` / `common` / `helpers` / `manager` だけで分割しない。
- 深いネストより早期 return。
- 境界入力とエラーは明示する。`None` や空文字で失敗を隠さない。
- import はモジュール先頭に置く。関数内のインライン import は循環依存を文書化した場合のみ。
- TypeScript の discriminated union / enum の `switch` は `default` で `never` チェックし、未処理バリアントをコンパイルエラーにする。
- 秘密情報、資格情報、個人情報をログやコミットに出さない。
- 仕様・構造・セットアップ・検証手順が変わる変更は、コードと文書を同じ変更単位で更新する。
- コミットは Conventional Commits 形式（`feat:` / `fix:` / `docs:` 等）。

## 作業フロー

1. `AGENTS.md` と `README.md` を読む。後続で `docs/` や ARCHITECTURE が追加されたらそれらも先に読む。
2. フロント変更かバック変更か、どの層の公開 API を触るかを決める。
3. AI 機能なら OrcaRouter ポート経由になることを実装前に確認する。
4. 実装後、実行可能な範囲で検証する。
   - フロント: 型チェック、Steiger（導入後）、対象画面の動作確認
   - バック: `pytest`、型チェック（mypy / pyright）、対象 API の契約確認
5. 検証できなかった場合は、理由を日本語で共有する。

## レビューで落とすもの

- ユーザー向け返答が日本語でない
- Go バックエンド、Pages Router、FSD 無視の配置
- 層の逆依存、スライス横断の深掘り import、`shared` の肥大化
- FastAPI ルーターや Next.js `page.tsx` への業務ロジック混入
- domain へのフレームワーク / ORM / SDK 漏れ込み
- OrcaRouter を迂回するあらゆる AI 呼び出し

## 参照

- FSD: https://feature-sliced.design/
- FSD × Next.js: https://feature-sliced.design/docs/guides/tech/with-nextjs
- FastAPI: https://fastapi.tiangolo.com/
- OrcaRouter: https://docs.orcarouter.ai/ja/introduction
- OrcaRouter Chat Completions: https://docs.orcarouter.ai/api-reference/chat/create-a-chat-completion
