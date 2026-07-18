"""
DripRig — Try-On Router
Handles outfit generation requests.
"""
import asyncio
import logging
from fastapi import APIRouter, HTTPException, Depends

from backend.models.schemas import GenerateRequest, GenerateResponse
from backend.services.image_service import generate_ai_tryon, UPLOAD_DIR

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["tryon"])


@router.post("/generate", response_model=GenerateResponse)
async def generate_outfit(
    request: GenerateRequest,
):
    """
    Generate a virtual try-on result.
    Requires: person photo + outfit photo (both uploaded first via /api/upload).
    """
    # Resolve the 2-slot schema (outfit key is the new standard)
    slots = {
        "person": request.person,
        "outfit": request.outfit or request.top,   # support both keys
    }

    # ── Validate required inputs ─────────────────────────────────────────────
    if not slots["person"]:
        raise HTTPException(status_code=400, detail="A 'person' photo is required.")
    if not slots["outfit"]:
        raise HTTPException(status_code=400, detail="An outfit image is required.")

    # ── Verify files exist on disk ───────────────────────────────────────────
    for slot_key, filename in slots.items():
        if filename and not (UPLOAD_DIR / filename).exists():
            raise HTTPException(
                status_code=404,
                detail=f"File not found for slot '{slot_key}'. Please re-upload.",
            )

    # ── Run AI generation (blocking → threadpool) ────────────────────────────
    try:
        loop = asyncio.get_running_loop()
        result_filename, processing_time_ms, model_used = await loop.run_in_executor(
            None, generate_ai_tryon, slots, request.model or "fast"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to generate AI composite")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")



    return GenerateResponse(
        result_url=f"/results/{result_filename}",
        processing_time_ms=processing_time_ms,
        slots_used=[k for k, v in slots.items() if v],
        model_used=model_used,
    )
