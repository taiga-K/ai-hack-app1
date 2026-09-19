# Backend - AI HACK APP1

Python 3.12+ / FastAPI / Clean Architecture によるバックエンド API サービスです。

## 技術スタック
- **言語**: Python 3.12+
- **フレームワーク**: FastAPI + Uvicorn
- **設計**: Clean Architecture (`app/domain`, `app/application`, `app/infrastructure`, `app/presentation`)
- **パッケージマネージャー**: `uv`
- **品質・静的解析**:
  - `ruff`: リンター & フォーマッター
  - `mypy`: 型検査（strict モード）
  - `import-linter`: クリーンアーキテクチャのレイヤー境界保護
  - `pytest`: 単体・結合テスト

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
