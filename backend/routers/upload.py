"""
DripRig — Upload Router
Handles image uploads: saves locally, uploads to Firebase, returns Firebase URL.
"""
import logging
from fastapi import APIRouter, File, UploadFile, HTTPException

from backend.models.schemas import UploadResponse
from backend.services.image_service import validate_and_save, upload_upload_to_firebase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["upload"])

VALID_SLOTS = {"top", "bottom", "shoes", "person", "outfit"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


@router.post("/upload/{slot}", response_model=UploadResponse)
async def upload_image(
    slot: str,
    file: UploadFile = File(...),
):
    """
    Upload an image for a specific clothing slot.
    Saves locally, uploads to Firebase Storage, returns Firebase URL.
    Slots: person, outfit (or top, bottom, shoes for legacy)
    Accepted formats: JPEG, PNG, WEBP
    Max size: 20MB
    """
    if slot not in VALID_SLOTS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid slot '{slot}'. Must be one of: {', '.join(sorted(VALID_SLOTS))}",
        )

    content_type = file.content_type or ""
    if content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type. Please upload a JPEG, PNG, or WEBP image.",
        )

    file_bytes = await file.read()

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB.",
        )

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        meta = await validate_and_save(file_bytes, content_type, slot)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to process upload")
        raise HTTPException(status_code=500, detail="Failed to process image. Please try again.")

    # Upload to Firebase Storage and get a public URL
    from pathlib import Path
    firebase_url = upload_upload_to_firebase(
        Path(meta["path"]), meta["filename"], folder="uploads"
    )

    return UploadResponse(
        slot=slot,
        url=firebase_url,
        filename=meta["filename"],
        width=meta["width"],
        height=meta["height"],
    )
