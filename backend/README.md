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
- `WHISPER_MODEL_SIZE`: faster-whisper モデルサイズ（デフォルト: `base`）
- `WHISPER_DEVICE`: 実行デバイス（デフォルト: `cpu`）
- `WHISPER_COMPUTE_TYPE`: 計算精度（デフォルト: `int8`）
- `WHISPER_LANGUAGE`: 文字起こし言語（デフォルト: `ja`）
- `AUDIO_SAMPLE_RATE`: 音声サンプルレート（デフォルト: `16000`）

## WebSocket エンドポイント
- `/ws/meetings/{meeting_id}/audio`:
  - 16-bit 16kHz ステレオPCM（Left: 自社マイク, Right: 相手Meet音声）をストリーミング受信
  - チャンネル物理分離ダイアライゼーション（`local_pm` / `remote_client`）
  - Silero VAD + faster-whisper による低遅延リアルタイム文字起こし結果を JSON 送信
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
