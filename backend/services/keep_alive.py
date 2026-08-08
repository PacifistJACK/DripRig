"""
DripRig — Render Keep-Alive Service
Periodically pings the application endpoint to keep Render web services active and prevent 15-min idle spin-down.
"""
import asyncio
import logging
import os
import time
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)


class KeepAliveService:
    def __init__(self):
        self.enabled: bool = os.environ.get("KEEP_ALIVE_ENABLED", "true").lower() in ("true", "1", "yes")
        
        # Default interval is 600s (10 mins) — safely under Render's 15-min timeout
        try:
            self.interval: int = int(os.environ.get("KEEP_ALIVE_INTERVAL", "600"))
        except ValueError:
            self.interval = 600

        self.start_time: float = time.time()
        self.total_pings: int = 0
        self.successful_pings: int = 0
        self.failed_pings: int = 0
        self.last_ping_time: str | None = None
        self.last_status: int | None = None
        self.last_latency_ms: float | None = None
        self.recent_logs: list[dict] = []
        self.max_logs: int = 50

        self._task: asyncio.Task | None = None
        self._running: bool = False

    def get_target_url(self) -> str:
        """
        Determines the target ping URL.
        Priority:
        1. KEEP_ALIVE_URL env var if specified
        2. RENDER_EXTERNAL_URL + '/api/ping' (automatically injected by Render)
        3. Local fallback http://127.0.0.1:8000/api/ping
        """
        custom_url = os.environ.get("KEEP_ALIVE_URL", "").strip()
        if custom_url:
            return custom_url if custom_url.endswith("/api/ping") else f"{custom_url.rstrip('/')}/api/ping"

        render_url = os.environ.get("RENDER_EXTERNAL_URL", "").strip()
        if render_url:
            return f"{render_url.rstrip('/')}/api/ping"

        port = os.environ.get("PORT", "8000")
        return f"http://127.0.0.1:{port}/api/ping"

    async def ping_now(self) -> dict:
        """
        Sends an immediate HTTP GET request to the target ping endpoint.
        Returns a dict summarizing the ping attempt.
        """
        url = self.get_target_url()
        now_iso = datetime.now(timezone.utc).isoformat()
        start_ts = time.monotonic()

        result = {
            "timestamp": now_iso,
            "target_url": url,
            "success": False,
            "status_code": None,
            "latency_ms": None,
            "message": "",
        }

        try:
            # We follow redirects and set a timeout of 10s
            async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
                response = await client.get(url, headers={"User-Agent": "DripRig-KeepAlive/1.0"})
                latency = round((time.monotonic() - start_ts) * 1000, 2)
                
                result["status_code"] = response.status_code
                result["latency_ms"] = latency
                result["success"] = (200 <= response.status_code < 400)
                result["message"] = f"HTTP {response.status_code}"

                logger.info(f"Keep-Alive ping to {url} -> status {response.status_code} ({latency}ms)")

        except Exception as e:
            latency = round((time.monotonic() - start_ts) * 1000, 2)
            result["latency_ms"] = latency
            result["message"] = f"Ping failed: {str(e)}"
            logger.warning(f"Keep-Alive ping to {url} failed: {e}")

        # Update stats
        self.total_pings += 1
        self.last_ping_time = now_iso
        self.last_status = result["status_code"]
        self.last_latency_ms = result["latency_ms"]

        if result["success"]:
            self.successful_pings += 1
        else:
            self.failed_pings += 1

        # Store log
        self.recent_logs.insert(0, result)
        if len(self.recent_logs) > self.max_logs:
            self.recent_logs.pop()

        return result

    async def _loop(self):
        """
        Background loop executing periodic pings.
        """
        self._running = True
        logger.info(
            f"Keep-Alive service initialized. Enabled={self.enabled}, Interval={self.interval}s, Target={self.get_target_url()}"
        )

        # Initial delay of 15 seconds after startup before first background ping
        await asyncio.sleep(15)

        while self._running:
            if self.enabled:
                try:
                    await self.ping_now()
                except Exception as e:
                    logger.error(f"Unexpected error during keep-alive ping loop: {e}")

            # Sleep for the configured interval
            await asyncio.sleep(self.interval)

    def start(self):
        """
        Starts the background task if not already running.
        """
        if self._task is None or self._task.done():
            self._running = True
            self._task = asyncio.create_task(self._loop())

    def stop(self):
        """
        Stops the background task cleanly.
        """
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()

    def get_stats(self) -> dict:
        """
        Returns full statistics and current state of the Keep-Alive engine.
        """
        uptime_sec = round(time.time() - self.start_time, 1)
        render_service = os.environ.get("RENDER_SERVICE_NAME", "")
        render_url = os.environ.get("RENDER_EXTERNAL_URL", "")

        success_rate = (
            round((self.successful_pings / self.total_pings) * 100, 1)
            if self.total_pings > 0
            else 100.0
        )

        return {
            "enabled": self.enabled,
            "running": self._running,
            "interval_seconds": self.interval,
            "target_url": self.get_target_url(),
            "uptime_seconds": uptime_sec,
            "total_pings": self.total_pings,
            "successful_pings": self.successful_pings,
            "failed_pings": self.failed_pings,
            "success_rate_percent": success_rate,
            "last_ping_time": self.last_ping_time,
            "last_status": self.last_status,
            "last_latency_ms": self.last_latency_ms,
            "render": {
                "is_render": bool(render_url or render_service),
                "service_name": render_service or None,
                "external_url": render_url or None,
            },
            "recent_logs": self.recent_logs[:20],
        }


# Singleton instance
keep_alive_service = KeepAliveService()
