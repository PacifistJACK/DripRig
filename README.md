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
| GET | `/api/health` | Health check |
| GET | `/api/docs` | Swagger UI |

## Phase Roadmap

- **Phase 1** (current): Pillow-assembled composite image
- **Phase 2**: AI virtual try-on via Stable Diffusion / Replicate / Gemini Vision
- **Phase 3**: User accounts, saved looks, social sharing
