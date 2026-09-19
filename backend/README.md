# Backend - AI HACK APP1

Python 3.12+ / FastAPI / Clean Architecture によるバックエンド API サービスです。

## 技術スタック
- **言語**: Python 3.12+
- **フレームワーク**: FastAPI + Uvicorn
- **AI Gateway**: オルカルーター（Orca Router）経由でのみ LLM 呼び出し
- **設計**: Clean Architecture (`app/domain`, `app/application`, `app/infrastructure`, `app/presentation`)
- **パッケージマネージャー**: `uv`
- **品質・静的解析**:
  - `ruff`: リンター & フォーマッター
  - `mypy`: 型検査（strict モード）
  - `import-linter`: クリーンアーキテクチャのレイヤー境界保護
  - `pytest`: 単体・結合テスト

## 環境変数
- `ORCAROUTER_API_KEY`: オルカルーターの API キー（必須）
- `ORCAROUTER_BASE_URL`: オルカルーターの Base URL（デフォルト: `https://api.orcarouter.ai/v1`）
- `ORCAROUTER_DEFAULT_MODEL`: デフォルトモデル（デフォルト: `openai/gpt-4o-mini`）
- `ORCAROUTER_TIMEOUT_SECONDS`: タイムアウト秒数（デフォルト: `60.0`）
- `ORCAROUTER_REQUIREMENTS_MODEL`: 要件定義書生成モデル（デフォルト: `anthropic/claude-3-5-sonnet`）
- `ORCAROUTER_REQUIREMENTS_FALLBACK_MODELS`: 要件定義書生成のフォールバックモデル（カンマ区切り、デフォルト: `openai/gpt-4o`）
- `ORCAROUTER_REQUIREMENTS_TIMEOUT_SECONDS`: 要件定義書生成タイムアウト秒数（デフォルト: `120.0`）
- `WHISPER_MODEL_SIZE`: faster-whisper モデルサイズ（デフォルト: `base`）
- `WHISPER_DEVICE`: 実行デバイス（デフォルト: `cpu`）
- `WHISPER_COMPUTE_TYPE`: 計算精度（デフォルト: `int8`）
- `WHISPER_LANGUAGE`: 文字起こし言語（デフォルト: `ja`）
- `AUDIO_SAMPLE_RATE`: 音声サンプルレート（デフォルト: `16000`）

## エンドポイント
- `GET /api/v1/health`: システムヘルスチェック
- `POST /api/v1/analysis/dialogue`: 対話テキストから曖昧・矛盾・無理・未確認事項・専門用語の共通認識不一致を検出してPM向け助言と質問候補を返却（`meeting_id` 最大128文字、`utterances` 最大100件・各2000文字）
- `POST /api/v1/meetings/{meeting_id}/finalize`: 会議終了時に全発話と検出事項（`unexplained_jargon` 含む）を集約し、Orca Router 経由で構造化 Markdown 要件定義書を生成（`meeting_id` は英数字・`_`・`-` 1〜128文字、任意シード `utterances` 最大500件・各2000文字、`advice_items` 最大200件）
- `GET /api/v1/meetings/{meeting_id}/requirements`: 生成済み要件定義書の取得（JSON）
- `GET /api/v1/meetings/{meeting_id}/requirements/download`: 要件定義書の Markdown ダウンロード
- `WebSocket /ws/meetings/{meeting_id}/audio`:
  - 16-bit 16kHz ステレオPCM（Left: 自社マイク, Right: 相手Meet音声）をストリーミング受信
  - チャンネル物理分離ダイアライゼーション（`local_pm` / `remote_client`）
  - Silero VAD + faster-whisper による低遅延リアルタイム文字起こし結果を JSON 送信 (`type: "utterance"`)
  - 会話コンテキスト監視 & オルカルーター経由でのリアルタイム助言イベント送信 (`type: "advice"`)

## 開発コマンド
```bash
# 依存関係インストール
uv sync

# 開発サーバー起動
uv run uvicorn main:app --reload --port 8000

# リント・フォーマットチェック
uv run ruff check .
uv run ruff format --check .

# 型検査
uv run mypy app main.py tests

# レイヤー境界検査
uv run lint-imports

# テスト実行
uv run pytest
```
