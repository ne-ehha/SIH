"""
Vercel Serverless Entry Point for OceanScope FastAPI Backend.

This module wraps the existing FastAPI application for deployment
as a Vercel Python Serverless Function. All routes, middleware,
and logic remain in the original backend/app/ package.
"""

from Mangum import Mangum
from backend.app.main import app

# Mangum adapts ASGI apps to AWS Lambda / Vercel serverless
handler = Mangum(app, lifespan="auto")
