"""Vercel entry point for the OceanScope FastAPI application.

Vercel's Python runtime discovers the exported ASGI ``app`` and preserves the
incoming ``/api/v1/...`` pathname for FastAPI routing.
"""

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app.main import app
