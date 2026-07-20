import sys
from pathlib import Path
import uvicorn

if __name__ == "__main__":
    # Add the parent directory to sys.path so 'backend.xxx' imports work correctly
    parent_dir = str(Path(__file__).resolve().parent.parent)
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)

    print("Starting DripRig Backend Server...")
    # host="0.0.0.0" is required for Azure App Service (and any containerized env)
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
