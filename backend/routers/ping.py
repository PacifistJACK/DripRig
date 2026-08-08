"""
DripRig — Ping & Keep-Alive Router
Exposes endpoints for status check, keep-alive stats, manual ping triggers, and configuration.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.services.keep_alive import keep_alive_service

router = APIRouter(prefix="/api/ping", tags=["Keep-Alive"])


class PingConfigModel(BaseModel):
    enabled: Optional[bool] = None
    interval_seconds: Optional[int] = Field(default=None, ge=10, le=86400)


@router.get("", summary="Keep-Alive Ping Endpoint")
async def ping():
    """
    Lightweight keep-alive ping endpoint.
    Used by self-pinger, frontend poller, and external monitoring tools.
    """
    stats = keep_alive_service.get_stats()
    return {
        "status": "pong",
        "service": "DripRig API",
        "version": "0.1.0",
        "keep_alive_active": stats["running"] and stats["enabled"],
        "uptime_seconds": stats["uptime_seconds"],
        "target_url": stats["target_url"],
    }


@router.get("/stats", summary="Get Detailed Keep-Alive Statistics")
async def get_ping_stats():
    """
    Returns full metrics, latency history, and recent ping logs.
    """
    return keep_alive_service.get_stats()


@router.post("/trigger", summary="Trigger Immediate Self-Ping")
async def trigger_ping():
    """
    Manually triggers an immediate keep-alive ping to the configured target URL.
    """
    result = await keep_alive_service.ping_now()
    return {
        "message": "Keep-alive ping dispatched successfully",
        "ping_result": result,
    }


@router.post("/config", summary="Update Keep-Alive Configuration")
async def update_ping_config(config: PingConfigModel):
    """
    Updates keep-alive settings (enabled state, ping interval).
    """
    if config.enabled is not None:
        keep_alive_service.enabled = config.enabled

    if config.interval_seconds is not None:
        keep_alive_service.interval = config.interval_seconds

    return {
        "message": "Keep-alive configuration updated",
        "enabled": keep_alive_service.enabled,
        "interval_seconds": keep_alive_service.interval,
    }
