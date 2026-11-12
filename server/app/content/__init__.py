"""Синглтон загруженного контента."""
from __future__ import annotations

from app.content.loader import ContentIndex, load_content

_index: ContentIndex | None = None


def get_content(reload: bool = False) -> ContentIndex:
    global _index
    if _index is None or reload:
        _index = load_content()
    return _index
