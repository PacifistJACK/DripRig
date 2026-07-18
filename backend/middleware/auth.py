"""
DripRig — Firebase Auth Middleware
Verifies Firebase ID tokens sent from the frontend on every protected route.
"""
import os
import logging
from functools import lru_cache
from typing import Optional

from fastapi import Header, HTTPException, status
import firebase_admin
from firebase_admin import auth as firebase_auth

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_firebase_app():
    """
    Initialize Firebase Admin SDK once per process.

    We initialize with just the project ID — this is sufficient for:
      - Verifying Firebase ID tokens (verify_id_token)
      - Reading from Firestore as admin

    No service account key file is required. Firebase token verification
    works by fetching Google's public keys from a public URL and checking
    the JWT signature — no private credentials needed.
    """
    if firebase_admin._apps:
        return firebase_admin.get_app()

    project_id = os.getenv("FIREBASE_PROJECT_ID", "driprig210")
    logger.info(f"Firebase Admin: initializing with project_id={project_id}")
    return firebase_admin.initialize_app(options={"projectId": project_id})


async def get_current_user(authorization: Optional[str] = Header(default=None)) -> dict:
    """
    FastAPI dependency — extracts and verifies the Firebase ID token.

    Usage:
        @router.post("/some-route")
        async def handler(user: dict = Depends(get_current_user)):
            uid = user["uid"]
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header. Expected: 'Bearer <firebase-id-token>'",
        )

    id_token = authorization.split(" ", 1)[1]

    try:
        _get_firebase_app()
        decoded = firebase_auth.verify_id_token(id_token)
        return {
            "uid": decoded["uid"],
            "email": decoded.get("email"),
            "name": decoded.get("name"),
            "picture": decoded.get("picture"),
            "email_verified": decoded.get("email_verified", False),
        }
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please sign in again.",
        )
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )
    except Exception as e:
        logger.error(f"Firebase token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
        )


async def get_current_admin(user: dict = None, authorization: Optional[str] = Header(default=None)) -> dict:
    """
    FastAPI dependency — verifies the user is an admin.
    Checks the 'admin' custom claim on the Firebase token.

    Usage:
        @router.get("/admin/users")
        async def handler(admin: dict = Depends(get_current_admin)):
            ...
    """
    # Re-verify the token fully
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    id_token = authorization.split(" ", 1)[1]
    try:
        _get_firebase_app()
        decoded = firebase_auth.verify_id_token(id_token)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.")

    # Check for admin custom claim
    if not decoded.get("admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )

    return {
        "uid": decoded["uid"],
        "email": decoded.get("email"),
        "name": decoded.get("name"),
        "is_admin": True,
    }
