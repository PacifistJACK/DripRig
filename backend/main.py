"""
DripRig — FastAPI Application Entry Point
"""
import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from contextlib import asynccontextmanager

from backend.routers import upload, tryon, ping
from backend.services.image_service import ensure_dirs
from backend.services.keep_alive import keep_alive_service

from dotenv import load_dotenv
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# Ensure storage dirs exist on startup
ensure_dirs()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start keep-alive service task
    keep_alive_service.start()
    logger.info("Keep-alive service started.")
    yield
    # Shutdown: Stop keep-alive service
    keep_alive_service.stop()
    logger.info("Keep-alive service stopped.")

app = FastAPI(
    title="DripRig API",
    description="Virtual Try-On Backend — Upload clothes, generate your rig.",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Always allow local dev origins.
_dev_origins = [
    "http://localhost:5173",
    "http://localhost:4173",   # Vite preview
    "http://127.0.0.1:5173",
]

# Pull extra origins from env (comma-separated); set in Azure App Settings as ALLOWED_ORIGINS
_env_origins: list[str] = [
    o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()
]

# Azure & Render hostnames injected automatically
_azure_hostname = os.environ.get("WEBSITE_HOSTNAME", "")
_azure_origins: list[str] = (
    [f"https://{_azure_hostname}", f"http://{_azure_hostname}"]
    if _azure_hostname else []
)

_render_url = os.environ.get("RENDER_EXTERNAL_URL", "")
_render_origins: list[str] = (
    [f"{_render_url}"] if _render_url else []
)

allowed_origins = list(dict.fromkeys(_dev_origins + _env_origins + _azure_origins + _render_origins))
logger.info(f"CORS allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static file mounts ────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
UPLOADS_DIR = BASE_DIR / "uploads"
RESULTS_DIR = BASE_DIR / "results"

UPLOADS_DIR.mkdir(exist_ok=True)
RESULTS_DIR.mkdir(exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
app.mount("/results", StaticFiles(directory=str(RESULTS_DIR)), name="results")

# Include routers
app.include_router(upload.router)
app.include_router(tryon.router)
app.include_router(ping.router)


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "service": "DripRig API",
        "version": "0.1.0",
        "hostname": _azure_hostname or "local",
    }


STATIC_DIR = BASE_DIR / "static"
STATIC_DIR.mkdir(exist_ok=True)

# Mount the Vite-built frontend at root — MUST be the last mount registered.
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
