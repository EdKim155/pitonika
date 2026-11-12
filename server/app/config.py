"""Пути и базовые константы приложения."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("PITONIKA_DATA", ROOT / "data"))
CONTENT_DIR = ROOT / "server" / "content"
WEB_DIST = ROOT / "web" / "dist"
DB_PATH = DATA_DIR / "app.db"
SECRETS_PATH = DATA_DIR / "secrets.json"
RUNS_DIR = DATA_DIR / "runs"
BACKUPS_DIR = DATA_DIR / "backups"

DEFAULT_PORT = int(os.environ.get("PITONIKA_PORT", "8420"))
HOST = "127.0.0.1"

# Лимиты исполнения ученического кода.
DEFAULT_TIMEOUT_SECONDS = 5
MAX_TIMEOUT_SECONDS = 15
OUTPUT_CAP_BYTES = 64 * 1024
FSIZE_LIMIT_BYTES = 8 * 1024 * 1024


def ensure_dirs() -> None:
    for path in (DATA_DIR, RUNS_DIR, BACKUPS_DIR):
        path.mkdir(parents=True, exist_ok=True)
