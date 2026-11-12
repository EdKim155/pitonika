"""Питоника — локальный тренажёр Python."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import ai, bootstrap, content, dev, export_api, grading, practice, review, run, settings_api
from app.config import WEB_DIST
from app.content import get_content
from app.content.loader import ContentError
from app.db.migrations import init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("pitonika")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    try:
        index = get_content(reload=True)
        logger.info("Контент загружен: %s модулей, %s уроков", len(index.modules), len(index.lesson_order))
    except ContentError as exc:
        logger.error("Ошибка контента: %s", exc)
        raise
    yield


app = FastAPI(title="Питоника", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
    bootstrap.router,
    content.router,
    grading.router,
    run.router,
    review.router,
    practice.router,
    settings_api.router,
    export_api.router,
    ai.router,
    dev.router,
):
    app.include_router(router)

if WEB_DIST.exists():
    assets = WEB_DIST / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")
    monaco = WEB_DIST / "monaco"
    if monaco.exists():
        app.mount("/monaco", StaticFiles(directory=monaco), name="monaco")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = WEB_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(WEB_DIST / "index.html")
else:
    @app.get("/", include_in_schema=False)
    async def placeholder():
        return {
            "app": "Питоника",
            "status": "backend-only",
            "hint": "Собери фронтенд: cd web && pnpm install && pnpm build",
        }
