from pydantic import BaseModel
from typing import Optional


class UploadResponse(BaseModel):
    slot: str
    url: str
    filename: str
    width: int
    height: int


class GenerateRequest(BaseModel):
    outfit: Optional[str] = None   # Simplified 2-slot UI — maps to 'top' in the pipeline
    top: Optional[str] = None
    bottom: Optional[str] = None
    shoes: Optional[str] = None
    person: Optional[str] = None
    model: Optional[str] = "fast"  # "fast" = sm4ll-VTON | "quality" = WeShopAI


class GenerateResponse(BaseModel):
    result_url: str
    processing_time_ms: int
    slots_used: list[str]
    model_used: str = "unknown"


class ErrorResponse(BaseModel):
    detail: str
