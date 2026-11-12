#!/bin/bash
# Режим разработки: API с автоперезагрузкой + Vite dev server.
set -e
cd "$(dirname "$0")"

trap 'kill 0' EXIT INT TERM

PITONIKA_DEV=1 ./.venv/bin/uvicorn --app-dir server app.main:app --host 127.0.0.1 --port 8420 --reload &
(cd web && pnpm dev)

wait
