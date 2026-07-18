"""
DripRig — Admin Router
Protected endpoints for owner/admin dashboard.
Only accessible to users with the 'admin' Firebase custom claim.
"""
import logging
from fastapi import APIRouter, HTTPException, Depends

from backend.middleware.auth import get_current_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users")
async def list_users(admin: dict = Depends(get_current_admin)):
    """
    Return a list of all registered users and their generation counts.
    Reads from Firebase Auth + Firestore.
    """
    try:
        import firebase_admin
        from firebase_admin import auth as fb_auth, firestore

        db = firestore.client()

        # Get all users from Firebase Auth (paginated)
        users = []
        page = fb_auth.list_users()
        while page:
            for user in page.users:
                # Fetch generation count from Firestore
                gen_count = (
                    db.collection("generations")
                    .where("uid", "==", user.uid)
                    .count()
                    .get()[0][0].value
                )
                users.append({
                    "uid": user.uid,
                    "email": user.email or "—",
                    "displayName": user.display_name or "—",
                    "photoURL": user.photo_url,
                    "createdAt": user.user_metadata.creation_timestamp,
                    "lastSignIn": user.user_metadata.last_sign_in_timestamp,
                    "generationCount": gen_count,
                    "isAdmin": user.custom_claims.get("admin", False) if user.custom_claims else False,
                })
            page = page.get_next_page()

        return {"users": users, "total": len(users)}

    except Exception as e:
        logger.error(f"Admin list_users error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {e}")


@router.get("/generations")
async def list_generations(
    limit: int = 20,
    admin: dict = Depends(get_current_admin),
):
    """
    Return the most recent AI generations across all users.
    Ordered by creation time, newest first.
    """
    try:
        from firebase_admin import firestore

        db = firestore.client()

        docs = (
            db.collection("generations")
            .order_by("createdAt", direction=firestore.Query.DESCENDING)
            .limit(limit)
            .stream()
        )

        generations = []
        for doc in docs:
            data = doc.to_dict()
            generations.append({
                "id": doc.id,
                "uid": data.get("uid"),
                "email": data.get("userEmail", "—"),
                "personUrl": data.get("personUrl"),
                "outfitUrl": data.get("outfitUrl"),
                "resultUrl": data.get("resultUrl"),
                "processingTimeMs": data.get("processingTimeMs"),
                "createdAt": data.get("createdAt"),
            })

        return {"generations": generations, "count": len(generations)}

    except Exception as e:
        logger.error(f"Admin list_generations error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch generations: {e}")


@router.post("/set-admin/{uid}")
async def set_admin_claim(uid: str, admin: dict = Depends(get_current_admin)):
    """
    Grant admin privileges to a user by setting the 'admin' Firebase custom claim.
    Only callable by existing admins.
    """
    try:
        from firebase_admin import auth as fb_auth
        fb_auth.set_custom_user_claims(uid, {"admin": True})
        logger.info(f"Admin claim granted to uid={uid} by admin={admin['uid']}")
        return {"success": True, "uid": uid, "message": "Admin claim granted."}
    except Exception as e:
        logger.error(f"set_admin_claim failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
