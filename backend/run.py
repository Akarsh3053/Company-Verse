"""Convenience launcher: ``python run.py``.

Equivalent to ``uvicorn app.main:app`` with reload driven by DEBUG.
"""

from __future__ import annotations

import uvicorn

from app.config import get_settings


def main() -> None:
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=settings.debug,
    )


if __name__ == "__main__":
    main()
