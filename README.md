# DripRig — Virtual Try-On

> Upload top, bottom, shoes & your photo → Generate your rig.

## Project Structure

```
DripRig/
├── backend/          # FastAPI Python server
│   ├── main.py
│   ├── routers/      # upload.py, tryon.py
│   ├── services/     # image_service.py
│   ├── models/       # schemas.py
│   └── requirements.txt
│
├── frontend/         # Vite + Vanilla JS
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.js
│       ├── styles/
│       ├── components/
│       └── pages/
│
└── prototype.html    # Original design prototype
```

## Running Locally

### 1. Backend (FastAPI)

```powershell
cd backend
pip install -r requirements.txt
python -m uvicorn backend.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/api/docs

### 2. Frontend (Vite)

```powershell
cd frontend
npm install
npm run dev
```

Open: http://localhost:5173

### Both servers must run simultaneously.
The Vite dev server proxies `/api`, `/uploads`, and `/results` to the FastAPI backend on port 8000.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload/{slot}` | Upload image for a slot (top/bottom/shoes/person) |
| DELETE | `/api/upload/{slot}/{filename}` | Remove an uploaded image |
| POST | `/api/generate` | Generate outfit composite |
| GET | `/api/ping` | Keep-alive ping endpoint (status: pong) |
| GET | `/api/ping/stats` | Render keep-alive metrics & execution log |
| POST | `/api/ping/trigger` | Manually dispatch immediate self-ping |
| GET | `/api/health` | Health check |
| GET | `/api/docs` | Swagger UI |

## Render Deployment & Keep-Alive System

Render free-tier web services automatically pause (spin down) after 15 minutes of inactivity. DripRig includes an automated **Keep-Alive Ping System** to prevent sleeping:

1. **Backend Self-Pinger**: Background task pings `RENDER_EXTERNAL_URL/api/ping` every 10 minutes (600s).
2. **Frontend Keep-Alive Poller**: Browsers keep the app warm while open and display live latency / uptime in the header bar.
3. **Environment Variables**:
   - `KEEP_ALIVE_ENABLED`: Set to `"true"` (default) or `"false"`.
   - `KEEP_ALIVE_INTERVAL`: Ping interval in seconds (default: `600`).
   - `KEEP_ALIVE_URL`: Custom ping target URL (defaults to auto-detected `RENDER_EXTERNAL_URL`).

## Phase Roadmap

- **Phase 1** (current): Pillow-assembled composite image & Render keep-alive system
- **Phase 2**: AI virtual try-on via Stable Diffusion / Replicate / Gemini Vision
- **Phase 3**: User accounts, saved looks, social sharing
