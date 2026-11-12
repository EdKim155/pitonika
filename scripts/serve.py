#!/usr/bin/env python3
"""Запуск Питоники: свободный порт, сервер и браузер."""
from __future__ import annotations

import socket
import sys
import threading
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))

import uvicorn  # noqa: E402


def free_port(start: int = 8420, end: int = 8432) -> int:
    for port in range(start, end):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind(("127.0.0.1", port))
            except OSError:
                continue
            return port
    raise RuntimeError("Не нашёл свободный порт в диапазоне 8420–8431")


def main() -> None:
    port = free_port()
    url = f"http://127.0.0.1:{port}"
    print(f"\n  Питоника запускается: {url}\n  Остановить: Ctrl+C\n")
    threading.Timer(1.2, lambda: webbrowser.open(url)).start()
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, log_level="info")


if __name__ == "__main__":
    main()
