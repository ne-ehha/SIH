"""
FastAPI application — Ocean Model-Observation API.

Entry point for the backend server.
Assembles all routers and handles dataset lifecycle.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .config import API_HOST, API_PORT, API_PREFIX
from .datasets import close_all


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle — open and close datasets."""
    # Startup: datasets are loaded lazily on first access
    yield
    # Shutdown: close all open datasets
    close_all()


app = FastAPI(
    title="Ocean Model-Observation API",
    description=(
        "Backend API for ocean model-observation comparison and visualization. "
        "Pipeline A: GLORYS×Argo scientific comparison (Jan 2024). "
        "Pipeline B: INCOIS HYCOM 2026 model exploration."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and register routers
from .routers import health, comparison, model, diagnostics

app.include_router(health.router, prefix=API_PREFIX, tags=["health"])
app.include_router(comparison.router, prefix=API_PREFIX, tags=["comparison"])
app.include_router(model.router, prefix=API_PREFIX, tags=["model"])
app.include_router(diagnostics.router, prefix=API_PREFIX, tags=["diagnostics"])


@app.get("/")
def root():
    return {
        "name": "Ocean Model-Observation API",
        "version": "2.0.0",
        "docs": "/docs",
        "health": f"{API_PREFIX}/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=API_HOST,
        port=API_PORT,
        reload=True,
    )
