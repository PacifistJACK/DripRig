"""
DripRig — Firestore Database Service
Records all user activity (uploads, generations) to Firebase Firestore.
This gives the admin dashboard a full history of every try-on.
"""
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def _get_db():
    """Get the Firestore client (Firebase Admin must already be initialised)."""
    from firebase_admin import firestore
    return firestore.client()


def record_generation(
    uid: str,
    user_email: str,
    person_filename: str,
    outfit_filename: str,
    result_filename: str,
    processing_time_ms: int,
):
    """
    Write a generation record to Firestore.
    Called by the tryon router after a successful AI generation.

    Schema (generations/{auto-id}):
      uid                str   — Firebase user ID
      userEmail          str   — user's email (for admin display)
      personUrl          str   — relative URL of the person image
      outfitUrl          str   — relative URL of the outfit image
      resultUrl          str   — relative URL of the generated result
      processingTimeMs   int   — how long the AI took
      createdAt          ts    — server timestamp
    """
    try:
        db = _get_db()
        from firebase_admin import firestore as fs
        db.collection("generations").add({
            "uid": uid,
            "userEmail": user_email or "—",
            "personUrl": f"/uploads/{person_filename}",
            "outfitUrl": f"/uploads/{outfit_filename}",
            "resultUrl": f"/results/{result_filename}",
            "processingTimeMs": processing_time_ms,
            "createdAt": fs.SERVER_TIMESTAMP,
        })
        logger.info(f"Firestore: generation recorded for uid={uid}")
    except Exception as e:
        # Non-fatal — don't crash the request if Firestore write fails
        logger.warning(f"Firestore: failed to record generation: {e}")


def record_upload(uid: str, slot: str, filename: str):
    """
    Write an upload record to Firestore.
    Called by the upload router after a successful image save.

    Schema (uploads/{auto-id}):
      uid       str — Firebase user ID
      slot      str — 'person' | 'outfit'
      filename  str — saved filename on disk
      url       str — relative URL of the uploaded image
      createdAt ts  — server timestamp
    """
    try:
        db = _get_db()
        from firebase_admin import firestore as fs
        db.collection("uploads").add({
            "uid": uid,
            "slot": slot,
            "filename": filename,
            "url": f"/uploads/{filename}",
            "createdAt": fs.SERVER_TIMESTAMP,
        })
        logger.info(f"Firestore: upload recorded for uid={uid} slot={slot}")
    except Exception as e:
        logger.warning(f"Firestore: failed to record upload: {e}")
