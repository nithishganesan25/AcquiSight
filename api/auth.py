"""
auth.py
=======
Authentication dependency for AcquiSight AI FastAPI backend.
Verifies Firebase Authentication ID tokens without requiring private service account keys.
"""

from __future__ import annotations

import json
import logging
import urllib.request
from typing import Any, Dict, Optional
from pydantic import BaseModel
from fastapi import Header, HTTPException, status

log = logging.getLogger("acquisight.auth")


class OfficerUser(BaseModel):
    uid: str
    email: Optional[str] = None
    name: Optional[str] = None
    picture: Optional[str] = None
    auth_time: Optional[int] = None
    provider: str = "firebase"


def verify_firebase_token(token: str) -> Dict[str, Any]:
    """
    Verify Firebase ID token using Google token verification endpoint.
    This works securely without requiring private service-account credentials on the server.
    """
    token = token.strip()
    if not token:
        raise ValueError("Empty token")

    # Google tokeninfo endpoint verifies cryptographic signature and expiration
    url = f"https://oauth2.googleapis.com/tokeninfo?id_token={token}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "AcquiSight-Backend/2.0"})
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                payload = json.loads(response.read().decode("utf-8"))
                return payload
            else:
                raise ValueError(f"Google tokeninfo returned status {response.status}")
    except Exception as exc:
        log.warning("Token verification via Google endpoint failed: %s", exc)
        raise ValueError(f"Invalid or expired Firebase ID token: {exc}") from exc


def get_current_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> Optional[OfficerUser]:
    """
    Extracts and validates the Bearer token from the Authorization header.
    Returns the authenticated OfficerUser, or None if authorization is not supplied.
    Endpoints requiring authentication should check if user is None.
    """
    if not authorization:
        return None

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format. Expected 'Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    raw_token = parts[1]
    try:
        payload = verify_firebase_token(raw_token)
        return OfficerUser(
            uid=payload.get("sub") or payload.get("user_id") or "unknown",
            email=payload.get("email"),
            name=payload.get("name") or payload.get("email", "").split("@")[0],
            picture=payload.get("picture"),
            auth_time=payload.get("auth_time"),
            provider="google" if "google" in payload.get("iss", "") else "firebase",
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(err),
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_authenticated_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> OfficerUser:
    """Dependency that strictly enforces authentication (raises 401 if missing)."""
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in with Firebase / Google OAuth.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
