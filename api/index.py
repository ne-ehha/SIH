"""Vercel entry point for the OceanScope FastAPI application.

Vercel's Python runtime discovers the exported ASGI ``app`` and preserves the
incoming ``/api/v1/...`` pathname for FastAPI routing.
"""

from backend.app.main import app
