"""
DripRig — Upload Router
Handles image uploads for each clothing slot.
"""
import logging
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends

from backend.models.schemas import UploadResponse
from backend.services.image_service import validate_and_save
from backend.services.db_service import record_upload
from backend.middleware.auth import get_current_user

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
    
    Slots: person, outfit (or top, bottom, shoes for legacy)
    Accepted formats: JPEG, PNG, WEBP
    Max size: 20MB
    """
    # Validate slot name
    if slot not in VALID_SLOTS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid slot '{slot}'. Must be one of: {', '.join(sorted(VALID_SLOTS))}",
        )

    # Validate content type
    content_type = file.content_type or ""
    if content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type. Please upload a JPEG, PNG, or WEBP image.",
        )

    # Read file bytes
    file_bytes = await file.read()

    # Check file size
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

    # Record upload in Firestore (non-fatal)
    # record_upload(uid=user["uid"], slot=slot, filename=meta["filename"])

    return UploadResponse(
        slot=slot,
        url=f"/uploads/{meta['filename']}",
        filename=meta["filename"],
        width=meta["width"],
        height=meta["height"],
    )


@router.delete("/upload/{slot}/{filename}")
async def delete_upload(slot: str, filename: str):
    """Remove an uploaded image from a slot."""
    from pathlib import Path
    from backend.services.image_service import UPLOAD_DIR

    if slot not in VALID_SLOTS:
        raise HTTPException(status_code=422, detail=f"Invalid slot '{slot}'.")

    # Security: ensure filename belongs to this slot and has no path traversal
    if not filename.startswith(f"{slot}_") or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")

    file_path = UPLOAD_DIR / filename
    if file_path.exists():
        file_path.unlink()

    return {"deleted": filename}
