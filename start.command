#!/bin/bash
# Двойной клик в Finder: подготовить окружение и запустить Питонику.
set -e
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  echo "Создаю виртуальное окружение…"
  python3.12 -m venv .venv 2>/dev/null || python3 -m venv .venv
fi

./.venv/bin/python -m pip install -q --upgrade pip
./.venv/bin/python -m pip install -q -r requirements.txt

if [ ! -d web/dist ]; then
  echo "Собираю интерфейс…"
  (cd web && pnpm install && pnpm build)
fi

exec ./.venv/bin/python scripts/serve.py
