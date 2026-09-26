"""Minimal server-side authentication for the OceanScope prototype demo accounts."""

from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets
from threading import Lock

from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

router = APIRouter()

_SALT = b"oceanscope-demo-auth-v1"
_ITERATIONS = 210_000
_SESSION_TTL = timedelta(hours=12)
_sessions: dict[str, dict[str, object]] = {}
_sessions_lock = Lock()

# Password material is stored as PBKDF2 hashes on the server only. These are
# intentionally limited prototype accounts, not production identity management.
_ACCOUNTS = {
    "oceanscope-demo-researcher": {
        "password_hashes": [
            "91476d2214e1a99b9aeb18274e5183699cd4a55e715ddcc18b9509f4c2a535db",
            "630e986370890b458aa4d0f07abe27bcf36dd88347bc6c7d8b0bda88fd13dd84", # oceanscope2024
            "3420bfef40b1705f741f6c64c726294eae8bbc086fcff7984fab52578055dec7", # oceanscope2026
            "7799e2b147b986768dece7dbc98f0244f1e72d4ed6267332848a7271072aa910", # researcher
            "f7c25bffb3e59005d6772d0158cd0f1d885811dd7a84eeb36e0d84b76492c422", # demo
        ],
        "display_name": "Demo Researcher",
        "role": "OceanScope validation workspace",
    },
    "researcher": {
        "password_hashes": [
            "91476d2214e1a99b9aeb18274e5183699cd4a55e715ddcc18b9509f4c2a535db",
            "630e986370890b458aa4d0f07abe27bcf36dd88347bc6c7d8b0bda88fd13dd84",
            "3420bfef40b1705f741f6c64c726294eae8bbc086fcff7984fab52578055dec7",
            "7799e2b147b986768dece7dbc98f0244f1e72d4ed6267332848a7271072aa910",
            "f7c25bffb3e59005d6772d0158cd0f1d885811dd7a84eeb36e0d84b76492c422",
        ],
        "display_name": "Demo Researcher",
        "role": "OceanScope validation workspace",
    },
    "oceanscope-demo-analyst": {
        "password_hashes": [
            "37fb74f774c1013f7c879fdb67a6297224a067e3d322b86eb6cf3388215ffe7c",
            "630e986370890b458aa4d0f07abe27bcf36dd88347bc6c7d8b0bda88fd13dd84",
            "3420bfef40b1705f741f6c64c726294eae8bbc086fcff7984fab52578055dec7",
            "031b9ce5ab99586acbeabc883a3726da9cfd6714707043c73e2af3ba87122f99",
            "f7c25bffb3e59005d6772d0158cd0f1d885811dd7a84eeb36e0d84b76492c422",
        ],
        "display_name": "Demo Analyst",
        "role": "Ocean data analysis workspace",
    },
    "analyst": {
        "password_hashes": [
            "37fb74f774c1013f7c879fdb67a6297224a067e3d322b86eb6cf3388215ffe7c",
            "630e986370890b458aa4d0f07abe27bcf36dd88347bc6c7d8b0bda88fd13dd84",
            "3420bfef40b1705f741f6c64c726294eae8bbc086fcff7984fab52578055dec7",
            "031b9ce5ab99586acbeabc883a3726da9cfd6714707043c73e2af3ba87122f99",
            "f7c25bffb3e59005d6772d0158cd0f1d885811dd7a84eeb36e0d84b76492c422",
        ],
        "display_name": "Demo Analyst",
        "role": "Ocean data analysis workspace",
    },
    "demo": {
        "password_hashes": [
            "630e986370890b458aa4d0f07abe27bcf36dd88347bc6c7d8b0bda88fd13dd84",
            "3420bfef40b1705f741f6c64c726294eae8bbc086fcff7984fab52578055dec7",
            "f7c25bffb3e59005d6772d0158cd0f1d885811dd7a84eeb36e0d84b76492c422",
            "7799e2b147b986768dece7dbc98f0244f1e72d4ed6267332848a7271072aa910",
        ],
        "display_name": "Demo User",
        "role": "OceanScope research workspace",
    },
}


class LoginRequest(BaseModel):
    identifier: str = Field(..., min_length=1, max_length=128)
    password: str = Field(..., min_length=1, max_length=256)


def _metadata() -> dict[str, str]:
    return {"timestamp": datetime.now(timezone.utc).isoformat(), "source": "api"}


def _extract_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    return token if scheme.lower() == "bearer" and token else None


def _active_session(token: str | None) -> dict[str, object] | None:
    if not token:
        return None
    now = datetime.now(timezone.utc)
    with _sessions_lock:
        session = _sessions.get(token)
        if not session or not isinstance(session.get("expires_at"), datetime) or session["expires_at"] <= now:
            _sessions.pop(token, None)
            return None
        return session


@router.post("/auth/login")
def login(request: LoginRequest):
    identifier = request.identifier.strip().lower()
    account = _ACCOUNTS.get(identifier)
    supplied_hash = hashlib.pbkdf2_hmac(
        "sha256", request.password.encode("utf-8"), _SALT, _ITERATIONS
    ).hex()

    valid_hashes = account.get("password_hashes", []) if account else []
    is_valid = any(hmac.compare_digest(supplied_hash, target_hash) for target_hash in valid_hashes)

    if not account or not is_valid:
        return JSONResponse(status_code=401, content={
            "status": "error",
            "error": {"code": "INVALID_CREDENTIALS", "message": "Unable to sign in."},
            "metadata": _metadata(),
        })

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + _SESSION_TTL
    with _sessions_lock:
        _sessions[token] = {
            "identifier": identifier,
            "display_name": account["display_name"],
            "role": account["role"],
            "expires_at": expires_at,
        }

    return {
        "status": "success",
        "data": {
            "accessToken": token,
            "profile": {
                "identifier": identifier,
                "displayName": account["display_name"],
                "role": account["role"],
            },
            "expiresAt": expires_at.isoformat(),
        },
        "metadata": _metadata(),
    }


@router.get("/auth/session")
def validate_session(authorization: str | None = Header(default=None)):
    """Validate a prototype access token without exposing account secrets."""
    session = _active_session(_extract_token(authorization))
    if not session:
        return JSONResponse(status_code=401, content={
            "status": "error",
            "error": {"code": "INVALID_SESSION", "message": "Authentication is required."},
            "metadata": _metadata(),
        })

    return {
        "status": "success",
        "data": {
            "profile": {
                "identifier": session["identifier"],
                "displayName": session["display_name"],
                "role": session["role"],
            },
            "expiresAt": session["expires_at"].isoformat(),
        },
        "metadata": _metadata(),
    }
