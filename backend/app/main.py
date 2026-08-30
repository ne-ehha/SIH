"""
FastAPI application — Ocean Model-Observation API.

Entry point for the backend server.
Assembles all routers and handles dataset lifecycle.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
from datetime import datetime, timezone

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

# ── Custom validation error handler ─────────────────────────────────────────
# Transforms Pydantic 422 errors into the standardized API contract format:
# {"status": "error", "error": {"code": "VALIDATION_ERROR", "message": "..."}}

@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    """Convert Pydantic RequestValidationError into the API's standard error format."""
    errors = []
    for err in exc.errors():
        loc = " → ".join(str(l) for l in err.get("loc", []))
        msg = err.get("msg", "Invalid input")
        errors.append(f"{loc}: {msg}")

    message = "; ".join(errors) if errors else "Request validation failed."

    return JSONResponse(
        status_code=422,
        content={
            "status": "error",
            "error": {
                "code": "VALIDATION_ERROR",
                "message": message,
            },
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "source": "api",
            },
        },
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
