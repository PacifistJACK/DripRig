#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# DripRig — Azure App Service Startup Script
# Set this in Azure Portal: Configuration > General Settings > Startup Command
#   startup.sh
# Or point directly to gunicorn below.
# ──────────────────────────────────────────────────────────────────────────────

cd /home/site/wwwroot

# Create writable directories on Azure's persistent /home filesystem
mkdir -p /home/data/uploads /home/data/results

# Launch the ASGI app with gunicorn + uvicorn workers
# -w 4        : 4 worker processes (tune to your App Service plan vCPUs)
# --timeout   : 600s for slow AI try-on model calls
# --bind      : 0.0.0.0:8000 so Azure's reverse proxy can reach us
exec gunicorn \
    -w 4 \
    -k uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000 \
    --timeout 600 \
    --access-logfile - \
    --error-logfile - \
    app:app
