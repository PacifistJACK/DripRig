import io
import os
import time
import uuid
import logging
import shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_DIMENSION = 1024
UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
RESULTS_DIR = Path(__file__).parent.parent / "results"

def ensure_dirs():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)


async def validate_and_save(file_bytes: bytes, content_type: str, slot: str) -> dict:
    """Save upload to disk."""
    ensure_dirs()
    if content_type not in ALLOWED_TYPES:
        raise ValueError(f"Invalid file type '{content_type}'. Allowed: JPEG, PNG, WEBP")

    img = Image.open(io.BytesIO(file_bytes))
    if img.mode in ("RGBA", "P"):
        bg = Image.new("RGB", img.size, (13, 13, 13))
        if img.mode == "P": img = img.convert("RGBA")
        bg.paste(img, mask=img.split()[3] if img.mode == "RGBA" else None)
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")

    original_w, original_h = img.size
    if original_w > MAX_DIMENSION or original_h > MAX_DIMENSION:
        img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)

    width, height = img.size
    filename = f"{slot}_{int(time.time() * 1000)}.jpg"
    save_path = UPLOAD_DIR / filename
    img.save(save_path, "JPEG", quality=90, optimize=True)
    
    return {"filename": filename, "path": str(save_path), "width": width, "height": height}


# ── VTON Model Adapters ──────────────────────────────────────────────────────
# Each adapter takes (person_path, garment_path) and returns a local Path
# to the generated result. They normalize the different API signatures so
# the fallback chain above can call them all the same way.

def _try_sm4ll_vton(person_path: Path, garment_path: Path) -> Path:
    """Adapter for sm4ll-VTON/sm4ll-VTON-Demo."""
    from gradio_client import Client, handle_file
    logger.info("Trying model 1: sm4ll-VTON/sm4ll-VTON-Demo")
    client = Client("sm4ll-VTON/sm4ll-VTON-Demo")
    result = client.predict(
        base_img=handle_file(str(person_path)),
        garment_img=handle_file(str(garment_path)),
        workflow_choice="dress",   # always full-outfit mode
        mask_img=None,
        api_name="/generate"
    )
    if isinstance(result, dict):
        return Path(result["path"])
    if isinstance(result, (list, tuple)):
        r = result[0]
        return Path(r["path"] if isinstance(r, dict) else r)
    return Path(str(result))


def _try_weshop_vton(person_path: Path, garment_path: Path) -> Path:
    """Adapter for WeShopAI/WeShopAI-Virtual-Try-On.
    No category input — always does full-outfit try-on by default.
    Note: despite the confusing naming, WeShopAI expects:
      main_image       → garment image
      background_image → person image
    """
    from gradio_client import Client, handle_file
    logger.info("Trying model 1 (primary): WeShopAI/WeShopAI-Virtual-Try-On")
    client = Client("WeShopAI/WeShopAI-Virtual-Try-On")
    result = client.predict(
        main_image=handle_file(str(garment_path)),       # garment goes here
        background_image=handle_file(str(person_path)),  # person goes here
        api_name="/generate_image"
    )
    if isinstance(result, dict):
        return Path(result["path"])
    if isinstance(result, (list, tuple)):
        r = result[0]
        return Path(r["path"] if isinstance(r, dict) else r)
    return Path(str(result))


# Priority-ordered list of model adapters — first one that succeeds wins
_VTON_MODELS = [
    ("WeShopAI",    _try_weshop_vton),   # primary — better quality
    ("sm4ll-VTON",  _try_sm4ll_vton),    # fallback
]

# Keywords that indicate a recoverable quota/capacity error → skip to next model
_QUOTA_KEYWORDS = (
    "zerogpu", "quota", "exceeded", "rate limit",
    "too many", "try again", "unavailable", "capacity", "error"
)


def generate_ai_tryon(slots: dict) -> tuple[str, int]:
    """
    2-slot UI pipeline:
      - slots['person']  → full-body photo of the person
      - slots['outfit']  → photo of the outfit to try on

    Tries each model in _VTON_MODELS in order. If a model hits a quota /
    capacity error it is skipped and the next one is tried automatically.
    Falls back to a MOCK image only when all models fail.
    """
    ensure_dirs()
    start = time.time()

    # ── 1. Resolve slots ────────────────────────────────────────────────────
    outfit_filename = slots.get("outfit") or slots.get("top")
    person_filename = slots.get("person")

    if not person_filename:
        raise ValueError("A person photo is required.")
    if not outfit_filename:
        raise ValueError("An outfit image is required.")

    person_path  = UPLOAD_DIR / person_filename
    garment_path = UPLOAD_DIR / outfit_filename

    if not person_path.exists():
        raise ValueError(f"Person file not found: {person_filename}")
    if not garment_path.exists():
        raise ValueError(f"Outfit file not found: {outfit_filename}")

    logger.info(f"AI Try-on | person={person_filename}  outfit={outfit_filename}")

    # ── 2. Model cascade — try each model in order ───────────────────────────
    last_error = None
    for model_name, adapter_fn in _VTON_MODELS:
        try:
            generated_path = adapter_fn(person_path, garment_path)

            result_filename = f"ai_{model_name.lower().replace('-','_')}_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}.jpg"
            result_path = RESULTS_DIR / result_filename
            shutil.copy2(generated_path, result_path)

            elapsed_ms = int((time.time() - start) * 1000)
            logger.info(f"✓ {model_name} succeeded → {result_filename} ({elapsed_ms / 1000:.1f}s)")
            return result_filename, elapsed_ms

        except Exception as e:
            error_msg = str(e).lower()
            is_recoverable = any(k in error_msg for k in _QUOTA_KEYWORDS)
            logger.warning(f"✗ {model_name} failed ({'quota/capacity' if is_recoverable else 'error'}): {e}")
            last_error = e

            if not is_recoverable:
                # Hard error (bad input, auth, etc.) — no point trying other models
                raise RuntimeError(f"AI generation failed ({model_name}): {e}")
            # Recoverable → continue to next model

    # ── 3. All models exhausted — return MOCK image ──────────────────────────
    logger.warning(f"All VTON models failed — returning MOCK image. Last error: {last_error}")
    time.sleep(2)

    mock_img = Image.open(person_path).convert("RGB")
    draw = ImageDraw.Draw(mock_img)
    draw.rectangle([0, 0, mock_img.width, 50], fill=(120, 0, 180))
    try:
        font = ImageFont.truetype("arial.ttf", 24)
    except Exception:
        font = ImageFont.load_default()
    draw.text((10, 12), "MOCK — All models are busy, try again soon", fill=(255, 255, 255), font=font)

    mock_filename = f"ai_mock_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}.jpg"
    mock_path = RESULTS_DIR / mock_filename
    mock_img.save(mock_path, "JPEG", quality=85)

    elapsed_ms = int((time.time() - start) * 1000)
    return mock_filename, elapsed_ms





