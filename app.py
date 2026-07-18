"""
Azure App Service entrypoint.
Azure looks for 'app' in this file by default.
"""
import sys
from pathlib import Path

# Ensure the repo root is on the path so 'backend.xxx' imports work
root = Path(__file__).resolve().parent
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

from backend.main import app  # noqa: F401 — 'app' is what Azure/uvicorn picks up
