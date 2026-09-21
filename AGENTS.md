# AGENTS.md

本ドキュメントは、本リポジトリ（`ai-hack-app1`）で作業を行うすべての AI コーディングエージェントおよびアシスタントに対する恒久的な設計規約・実装ルールを定めたものです。
実装・提案・コードレビューを行う前に必ず熟読し、すべての制約を遵守してください。既存のツールやスキルに別の言語（Go言語等）を前提とする指示が含まれている場合でも、常に本書の規定を最優先とします。

---

## 1. コミュニケーション規約（日本語の徹底）

- **ユーザー向け返答の完全日本語化**:
  - 進捗報告、設計・方針の提案、質疑応答、レビューコメント、プルリクエストの説明文（PR Body）など、**ユーザーに向けた発答・記述はすべて日本語**で行うこと。
  - ユーザー向けメッセージにおける英語での返答は禁止とする。
- **コードおよび技術用語の表記**:
  - ソースコード、識別子（変数名・関数名・クラス名等）、ディレクトリ名・ファイル名、ターミナルコマンド、Conventional Commits 形式のコミットメッセージ（`feat:`, `fix:`, `docs:` 等）は英語を使用してよい。
  - 技術的な固有名詞（FastAPI, Next.js, Feature-Sliced Design, Orca Router 等）は正確な標準表記を維持する。

---

## 2. プロジェクト概要 & 全体アーキテクチャ

- **リポジトリ**: `ai-hack-app1`（AI HACK 提出用アプリケーション）
- **基本原則**: フロントエンドとバックエンドの関心事を明確に分離し、保守性と拡張性に優れた疎結合な構成を維持する。
- **AI / LLM 呼び出しの責務**:
  - 生成 AI（LLM、埋め込みベクトル生成、マルチモーダル推論等）の呼び出しは、**バックエンドのインフラ層（Infrastructure Layer）経由に限定**する。
  - フロントエンド（Next.js App Router、Route Handler、Server Actions 含む）から AI プロバイダや AI Gateway を直接呼び出すことは禁止する。フロントエンドは必ずバックエンドの FastAPI を介して AI 機能を利用する。
- **HTTP API 契約**:
  - FastAPI が公開する HTTP API は、[フューチャー Web API設計ガイドライン](https://future-architect.github.io/arch-guidelines/documents/forWebAPI/web_api_guidelines.html) に則って設計する。詳細は「7. API設計」を参照すること。

---

## 3. 技術スタック定義（固定・代替禁止）

本リポジトリで採用する技術スタックは以下の通り固定されています。代替フレームワークの提案や混在実装は厳禁です。

| 領域 | 採用技術・設計思想 | 禁止例・非推奨 |
| :--- | :--- | :--- |
| **ユーザー対応言語** | **日本語（Japanese）** | ユーザー向け返答での英語使用 |
| **フロントエンド言語** | **TypeScript（Strict Mode）** | JavaScript（`.js`）、`.jsx` の新規作成、`any` の多用 |
| **フロントエンド FW** | **Next.js（App Router）** | Pages Router（`pages/`）、Vite + React 単体、Remix |
| **フロントエンド設計** | **Feature-Sliced Design（FSD）** | 階層境界を無視した `components/` や `utils/` への集約 |
| **バックエンド言語** | **Python 3.12+** | **Go言語（Go を用いた API 構築は一切不可）**、Node.js |
| **バックエンド FW** | **FastAPI** | Gin、Echo、Django、Flask |
| **バックエンド設計** | **Clean Architecture** | ハンドラへのドメインロジック直書き、層を無視した密結合 |
| **AI Gateway** | **オルカルーター（Orca Router / Orcha Router）必須** | OpenAI / Anthropic / Google 等への直接 API 呼び出し |
| **API設計** | **フューチャー Web API設計ガイドライン**（REST 原則） | GraphQL / gRPC / JSON-RPC の新規採用、ガイドラインと矛盾する独自契約 |
| **ログ** | **Python / TypeScript の一般的な書き方を優先** | Future ログガイドライン固有キーの先行導入、Go / Java 規約の直写 |

- **補助ライブラリ・ツール群**:
  - パッケージマネージャー: フロントエンドは `pnpm`、バックエンドは `uv`（推奨）または `pip`（lockfile 必須）。フロントエンド・バックエンドそれぞれのサブプロジェクト内でパッケージマネージャーを混在させないこと（リポジトリ全体としてはフロント=pnpm、バック=uv/pip の構成とする）。
  - バリデーション / スキーマ定義: バックエンドは Pydantic v2、フロントエンドは Zod を推奨。
  - アーキテクチャ静的検証: フロントエンドは Steiger、バックエンドは `import-linter` または同等の層依存チェックツールの活用を推奨。

> **重要（Go言語の排除）**:
> 一部のエージェントスキルやテンプレートに Go / Gin 前提のルールが含まれている場合がありますが、本プロジェクトでは**完全に無効**です。バックエンドは一貫して **Python / FastAPI / Clean Architecture** で構築してください。

---

## 4. AI Gateway: オルカルーター（Orca Router / Orcha Router）必須要件

本プロジェクトにおけるすべての生成 AI・LLM 連携処理は、AI Gateway である**オルカルーター（Orca Router、別名 Orcha Router）**を経由することが必須要件です。例外は一切認められません。

### 4.1. 接続および実装の制約
- **直接アクセスの禁止**:
  - 各 AI プロバイダ（OpenAI、Anthropic、Google Gemini、DeepSeek、xAI 等）の公式 SDK や REST エンドポイント（例: `api.openai.com`）へ直接リクエストを送信することを禁ずる。
  - 「開発時の一時的な動作確認」や「緊急回避用のフォールバック」であっても直呼びは許可されない。
- **クライアント設定**:
  - OpenAI 互換クライアント（OpenAI Python SDK または HTTPX クライアント）を使用し、接続先をオルカルーターに設定する。
  - **Base URL**: `https://api.orcarouter.ai/v1`
  - **API キー**: 環境変数 `ORCAROUTER_API_KEY` から読み込む（コード内ハードコードやクライアントバンドルへの混入は厳禁）。
- **モデル指定およびルーティング**:
  - オルカルーターが解釈可能なモデル識別子を指定すること。
    - 自動ルーティング: `orcarouter/auto`
    - プロバイダ明示指定: `openai/gpt-4o-mini`, `anthropic/claude-3-5-sonnet` 等のプロバイダ接頭辞付き ID
  - フェイルオーバー / フォールバック制御はオルカルーターの標準機能（`extra_body={"models": [...], "route": "fallback"}`）を利用し、アプリケーション側でプロバイダ直呼びによる代替処理を実装しない。
- **アーキテクチャ上の配置**:
  - オルカルーターへの接続クライアントは、バックエンドの **Infrastructure 層（Adapter）**にのみ配置する。
  - Domain 層および Application 層は「テキスト生成」「埋め込みベクトル取得」等の抽象ポート（Interface / Protocol）のみに依存し、オルカルーターの SDK 仕様や HTTP 通信の詳細を知らない構造とする。

---

## 5. フロントエンド設計規約（Next.js App Router × Feature-Sliced Design）

フロントエンドは、Next.js App Router の機能と Feature-Sliced Design（FSD）のアーキテクチャを協調させて構築します。

### 5.1. ディレクトリ構成
Next.js の `app/` ルーティング層と FSD の `app` / `pages` レイヤー名の衝突を防ぐため、FSD 側のレイヤー名にはアンダースコア（`_`）を付与します。

```
app/                      # Next.js App Router（ルーティング、Layout、Page 定義の薄い配線のみ）
src/
  _app/                   # FSD app レイヤー（グローバル Provider、全体スタイル、初期化設定）
  _pages/                 # FSD pages レイヤー（画面単位のコンポジション・レイアウト）
  widgets/                # FSD widgets レイヤー（複数の feature/entity を組み合わせた自己完結型 UI ブロック）
  features/               # FSD features レイヤー（ユーザー操作・ユースケース単位の機能、例: auth-by-email）
  entities/               # FSD entities レイヤー（ビジネスエンティティ、ドメインモデル・UI、例: user, post）
  shared/                 # FSD shared レイヤー（プロジェクト共通の UI プリミティブ、ユーティリティ、API 基盤）
```

### 5.2. 依存関係のルール（単方向依存の徹底）
レイヤー間の依存関係は**上位から下位への一方向のみ**許可されます。

$$\text{\_app} \longrightarrow \text{\_pages} \longrightarrow \text{widgets} \longrightarrow \text{features} \longrightarrow \text{entities} \longrightarrow \text{shared}$$

1. **同層インポートの禁止**:
   - 同一レイヤー内の別スライス（例: `features/a` から `features/b`）を直接インポートしてはならない。
   - スライス間の連携が必要な場合は、上位レイヤーで合成する。Entities レイヤーにおいてドメイン構造上避けられない相互参照に限り、`@x`（クロスインポート専用の公開 API）を例外的に使用する（features など他のレイヤーでのスライス間結合は必ず上位レイヤーで行うこと）。
   - なお、`_app` と `shared` はビジネススライスを持たず、セグメント（`ui`, `model`, `api`, `lib`, `config` 等）単位で構成する。
2. **Public API の遵守**:
   - 各スライス外部への公開は `index.ts`（サーバー専用コードがある場合は `index.server.ts`）から行い、外部から内部セグメント（`ui/`, `model/`, `api/`, `lib/` 等）への深掘りインポート（Deep Import）を禁止する。
3. **App Router の責務制限**:
   - `app/**/page.tsx` および `app/**/layout.tsx` は、対応する `_pages` や `_app` のコンポーネントを呼び出して配線するのみにとどめ、画面の実装コードや状態管理、ビジネスロジックを直接記述しない。
   - `app/api/**/route.ts`（Route Handler）を設ける場合も、実装本体は `src/_app/api-routes` 等に置き、薄いラッパーとする。
4. **Server / Client Components の分離**:
   - サーバー専用モジュール（`server-only`）を Client Component から参照可能な `index.ts` で再エクスポートしない。サーバー専用の公開インターフェースは `index.server.ts` として分離する。

---

## 6. バックエンド設計規約（Python / FastAPI × Clean Architecture）

バックエンドは Python 3.12+ および FastAPI を採用し、クリーンアーキテクチャの原則に沿って構築します。

### 6.1. ディレクトリ構成
```
backend/
  app/
    domain/               # エンティティ、値オブジェクト、ドメイン例外、リポジトリ/AIポート（Protocol / ABC）
    application/          # ユースケース実装、入力/出力 DTO、アプリケーションサービス
    infrastructure/       # DB アクセス具象（SQLAlchemy等）、オルカルーター連携クライアント、外部 API 実装
    presentation/         # FastAPI ルーター、リクエスト/レスポンス Pydantic スキーマ、依存性注入（DI）配線
    main.py               # アプリケーション起動・合成ルート（Composition Root）
```

### 6.2. 依存方向とレイヤー境界
内側のレイヤーは外側のレイヤーに依存してはなりません。依存性は常に外側から内側（抽象）へ向かいます。

- **Domain レイヤー**:
  - 純粋な Python 標準ライブラリと型ヒントのみで構成する。
  - FastAPI、Pydantic（BaseSettings や HTTP スキーマ）、SQLAlchemy、HTTPX、AI SDK などの外部ライブラリへの依存を一切禁止する。
- **Application レイヤー**:
  - ドメイン知識を活用したユースケースを実装する。Domain レイヤーにのみ依存し、FastAPI や特定の DB/インフラ実装には依存しない。
- **Infrastructure レイヤー**:
  - Domain / Application レイヤーで定義されたインターフェース（ポート）の具象実装を提供する。DB セッション管理、オルカルーターとの通信、外部サービス連携を行う。
- **Presentation レイヤー**:
  - HTTP リクエストの受け付け、入力値検証（Pydantic）、ユースケースの実行呼び出し、HTTP レスポンス（JSON 等）へのシリアライズのみを担当する。
  - ルーター関数内にドメインロジック、クエリ直書き、AI プロンプト構築の本体を記述してはならない。

### 6.3. FastAPI 実装規約
- **依存性注入（DI）の活用**:
  - DB セッションやオルカルーターのクライアントインスタンスは、FastAPI の `Depends` などを通じてユースケースに明示的に注入し、グローバル変数やシングルトンからの暗黙的参照を排除する。
- **データモデルの分離**:
  - データベース永続化モデル（ORM モデル）、ドメインエンティティ、API スキーマ（Pydantic モデル）を安易に同一視・兼用しない。各層の責務に応じたマッピングを Infrastructure / Presentation 層で実施する。
- **例外処理設計**:
  - 業務エラーはドメイン例外として定義・送出し、Presentation レイヤーのエラーハンドラで適切な HTTP ステータスコード（4xx / 5xx）に変換する。広範な `except Exception:` や空の `except:` による例外の握りつぶしを禁止する。
- **型ヒントの完全適用**:
  - すべての引数・戻り値に型アノテーションを付与し、`Any` の安易な使用を避ける。

---

## 7. API設計（フューチャー Web API設計ガイドライン）

FastAPI が公開する HTTP API は、[フューチャー Web API設計ガイドライン](https://future-architect.github.io/arch-guidelines/documents/forWebAPI/web_api_guidelines.html) を設計のベースラインとする。ガイドラインと矛盾する独自規約を優先してはならない。細部はガイドライン本文を参照し、本節は本リポジトリでの適用方針のみを示す。

### 7.1. アーキテクチャ選定
- HTTP API は **REST を原則**とする。GraphQL / gRPC / JSON-RPC を新規採用しない。
- 会議音声など既存の双方向リアルタイム通信は、現行の WebSocket を維持してよい。これを理由に gRPC へ置き換えない。

### 7.2. 表記とリソース
- **パス（リソース名）**: kebab-case かつ複数形（例: `/api/v1/meetings/{meeting_id}`）。
- **クエリパラメータ / JSON 項目**: snake_case（例: `meeting_id`, `order_id`）。
- **リクエスト / レスポンスヘッダー**: kebab-case。
- 親子関係が強いサブリソースはネスト、独立リソースはフラットとし、両方の重複提供は最小限にする。

### 7.3. HTTP メソッドとステータス
- 参照は GET、新規作成は POST、全体置換は PUT、部分更新は PATCH、削除は DELETE を用いる。
- 新規作成に PUT / PATCH を使わない。複雑な検索条件や秘匿値をクエリに載せられない場合に限り、検索に POST を検討してよい。
- ステータスコードはセマンティクスに従って使い分ける。疑わしい場合は 200 / 400 / 500 を用いる。
  - 一覧検索の 0 件は 200（404 や 204 にしない）。
  - スキーマ検証エラーは 400、業務条件の不成立は 422。
  - パスで指定したリソースが無い場合は 404。権限の有無を推測させないため、参照権限の無いリソースの GET は 404 とする。
- 破壊的変更が必要になった場合のバージョニングは、既存どおり **パス方式**（`/api/v1`）を維持する。

### 7.4. レスポンス
- レスポンスボディは JSON とする。一覧はトップレベル配列にせず、オブジェクトでラップする（件数やページングを後から足せる形）。
- HTTP 契約（パス・スキーマ・ステータス）は Presentation 層で定義する。ルーターへ業務ロジックやプロンプト組み立てを直書きしない。

---

## 8. ログ方針

フューチャーの[ログ設計ガイドライン](https://future-architect.github.io/arch-guidelines/documents/forLog/log_guidelines.html) は**参考**にする。Go / Java 寄りの規約を直写せず、**Python・TypeScript の一般的な書き方を優先**する。

- **バックエンド**: 標準 `logging` または structlog など、Python で一般的な構造化ログを用いる。
- **フロントエンド**: サーバーは pino 等を用いてよい。クライアントに過剰な構造化ログや、バックエンドと同じスキーマを強制しない。
- ガイドライン固有のキー名（`severity.text` 等）、メッセージコード、通知フラグは、運用手順と結びつく必要が出るまで導入しない。
- 残す共通ルール:
  - 本番は構造化ログにする。
  - 秘密情報・個人情報をログに出さない。
  - ユーザー向け文言とログを分ける。
  - リクエストを追える識別子を付ける。

---

## 9. 共通実装・コーディング規準

エージェントがコードを生成・編集する際は、以下のコーディング規準を遵守してください。

1. **インポート規約（No Inline Imports）**:
   - すべての `import` 文はファイルの最上部（モジュールヘッダー）に記述すること。
   - 関数内、メソッド内、型アノテーション内、インターフェース定義内でのインラインインポートは、循環インポートの回避理由が明記されている場合を除き禁止とする。
2. **TypeScript の網羅性チェック（Exhaustive Switch）**:
   - TypeScript において Discriminated Union や Enum を `switch` 文で分岐処理する場合、必ず `default` 節で `never` 型への代入チェックを行い、将来のバリアント追加時にコンパイルエラーを検知できるように実装すること。
   - 例:
     ```typescript
     default: {
       const _exhaustiveCheck: never = x;
       throw new Error(`Unhandled variant: ${_exhaustiveCheck}`);
     }
     ```
3. **早期リターン（Guard Clauses）**:
   - 深いネストを避け、事前条件の不成立やエラーケースは関数の先頭でガード節（Early Return）を用いて処理する。
4. **明示的な命名と責務分離**:
   - 変数名・関数名・クラス名は役割が明確に伝わる命名とし、中身が不透明な `utils`, `common`, `helpers`, `manager` といった命名への無秩序な集約を避ける。
5. **セキュリティと機密情報の保護**:
   - API キー（`ORCAROUTER_API_KEY` 等）、認証トークン、パスワード、個人情報をソースコードやコミット履歴に含めない。
   - クライアント側（ブラウザ）へ渡す環境変数（`NEXT_PUBLIC_*`）に機密キーを露出させない。
6. **仕様・設計ドキュメントの同期**:
   - アーキテクチャ、API 契約、ディレクトリ構成、セットアップ手順に変更が生じた場合は、コードと共に関連ドキュメントを同一変更単位で更新する。
7. **コミットメッセージ規約**:
   - Conventional Commits 形式（`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:` 等）を使用し、変更理由と内容を簡潔に表現すること。

---

## 10. エージェント作業フロー

タスクを開始する際は、以下のステップに沿って進行してください。

1. **仕様と既存コードの確認**:
   - 本 `AGENTS.md`、`README.md`、および `docs/` 配下の関連ドキュメントを確認する。
2. **責務境界と修正対象の特定**:
   - 変更がフロントエンド・バックエンドのどちらに属するか、どのレイヤー・スライス・ユースケースに関係するかを事前に整理する。
3. **AI 機能の実装確認**:
   - AI 連携を伴う機能の場合、バックエンドのオルカルーター向けポート・アダプタを経由する設計になっているか確認する。
4. **実装と検証の実施**:
   - 実装後、環境で実行可能な検証を必ず実施する。
     - フロントエンド: 型チェック（`pnpm tsc --noEmit`）、リンター（`pnpm eslint`）、FSD 構造検証（Steiger 導入時）、画面表示確認
     - バックエンド: テスト実行（`pytest`）、静的型チェック（`mypy` / `pyright`）、API 契約確認（フューチャー Web API設計ガイドラインとの整合を含む）
   - **UI を触った PR は、ブラウザで操作した検証スクリーンショットと操作動画の両方を PR 本文に添付する。** 見た目のスクショだけでは不可。動画は実際のクリック・入力・画面遷移を映すこと。
5. **結果報告と PR 作成**:
   - 検証結果や変更内容を**日本語でユーザーに分かりやすく報告**する。環境要因等で実行できなかった検証がある場合は、その理由を明示する。
   - PR を作成・更新する際は、ドラフトではなくレビュー可能な状態（Ready for review）で提出する（ユーザーからの明示的な指示がない限り、マージは行わない）。
   - UI 変更を含む PR は、上記の検証スクショと操作動画が本文に無い状態でレビュー依頼しない。

---

## 11. レビュー却下基準（Review Rejection Criteria）

以下の項目に該当するプルリクエストやコード変更は、自動レビューおよび人間によるレビューにおいて即時却下（Changes Requested / Reject）の対象となります。

- [ ] ユーザーへの回答や PR 説明文が日本語で書かれていない
- [ ] バックエンドに Go 言語（Gin / Echo 等）を使用している、または `cmd/`, `internal/` といった Go 特有の構成を持ち込んでいる
- [ ] Next.js の Pages Router を使用している、または FSD のレイヤー構造を無視してファイルを配置している
- [ ] レイヤー依存方向が逆転している、またはスライスのプライベートセグメントを深掘りインポートしている
- [ ] オルカルーター（Orca Router）を経由せず、外部 AI プロバイダ（OpenAI, Anthropic 等）を直接呼び出している
- [ ] フロントエンドから AI Gateway / AI プロバイダへ直接通信している
- [ ] ドメイン層にフレームワーク（FastAPI, Pydantic, SQLAlchemy 等）への依存が漏れ込んでいる
- [ ] Presentation 層（ルーター）や Next.js `page.tsx` に業務ロジック・プロンプト組み立てが直書きされている
- [ ] 機密情報（API キー等）がコミットまたはクライアント公開用環境変数に含まれている
- [ ] UI を変更した PR に、ブラウザ操作の検証スクリーンショットと操作動画が揃っていない（スクショのみは不可）
- [ ] HTTP API がフューチャー Web API設計ガイドラインに明らかに反している（例: JSON の camelCase 化、一覧のトップレベル配列、HTTP メソッドのセマンティクス無視、GraphQL / gRPC の新規採用）

---

## 12. 参考ドキュメント・公式リンク

- **Feature-Sliced Design (FSD)**: [https://feature-sliced.design/](https://feature-sliced.design/)
- **FSD with Next.js Guide**: [https://feature-sliced.design/docs/guides/tech/with-nextjs](https://feature-sliced.design/docs/guides/tech/with-nextjs)
- **FastAPI Documentation**: [https://fastapi.tiangolo.com/](https://fastapi.tiangolo.com/)
- **オルカルーター（Orca Router）公式ドキュメント**: [https://docs.orcarouter.ai/ja/introduction](https://docs.orcarouter.ai/ja/introduction)
- **Orca Router Chat Completions API**: [https://docs.orcarouter.ai/api-reference/chat/create-a-chat-completion](https://docs.orcarouter.ai/api-reference/chat/create-a-chat-completion)
- **フューチャー Web API設計ガイドライン**（必須）: [https://future-architect.github.io/arch-guidelines/documents/forWebAPI/web_api_guidelines.html](https://future-architect.github.io/arch-guidelines/documents/forWebAPI/web_api_guidelines.html)
- **フューチャー ログ設計ガイドライン**（参考）: [https://future-architect.github.io/arch-guidelines/documents/forLog/log_guidelines.html](https://future-architect.github.io/arch-guidelines/documents/forLog/log_guidelines.html)
