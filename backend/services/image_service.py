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


def _call_fashn_api(person_path: Path, garment_path: Path, category: str = "one-pieces") -> Path:
    """
    Send a person image + garment image to fashn-ai/fashn-vton-1.5 on HF Spaces.
    
    category options:
      'tops'       → shirt, jacket, top, blouse
      'bottoms'    → pants, skirt, shorts
      'one-pieces' → full outfit, dress, jumpsuit, complete look (DEFAULT)

    Returns the local path to the generated result image.
    """
    from gradio_client import Client, handle_file

    # gradio_client auto-reads HUGGING_FACE_HUB_TOKEN from the environment.
    # load_dotenv() at the top of this file ensures it is set before this runs.
    client = Client("fashn-ai/fashn-vton-1.5")

    result = client.predict(
        person_image=handle_file(str(person_path)),
        garment_image=handle_file(str(garment_path)),
        category=category,
        garment_photo_type="model",  # garment photo is worn by a model (not a flat-lay)
        num_timesteps=50,
        guidance_scale=1.5,
        seed=42,
        segmentation_free=True,      # better quality on complex outfits
        api_name="/try_on"
    )

    # fashn API returns a single Image dict: {"path": "...", "url": "...", ...}
    if isinstance(result, dict):
        return Path(result["path"])
    # Fallback: some gradio versions wrap singles in a list/tuple
    if isinstance(result, (list, tuple)):
        r = result[0]
        return Path(r["path"] if isinstance(r, dict) else r)
    return Path(str(result))


def generate_ai_tryon(slots: dict) -> tuple[str, int]:
    """
    2-slot UI pipeline:
      - slots['person']  → full-body photo of the person
      - slots['outfit']  → photo of the outfit to try on

    Uses fashn-ai/fashn-vton-1.5 with category='one-pieces' so that
    the entire outfit (top + bottom, dress, jumpsuit, etc.) is applied
    to the person in a single, clean API call — no cropping hacks needed.
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

    logger.info(f"AI Try-on (fashn-vton-1.5) | person={person_filename}  outfit={outfit_filename}")

    # ── 2. Single-pass API call ──────────────────────────────────────────────
    try:
        generated_path = _call_fashn_api(person_path, garment_path, category="one-pieces")

        result_filename = f"ai_hf_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}.webp"
        result_path = RESULTS_DIR / result_filename
        shutil.copy2(generated_path, result_path)

        elapsed_ms = int((time.time() - start) * 1000)
        logger.info(f"Done: {result_filename}  ({elapsed_ms / 1000:.1f}s)")
        return result_filename, elapsed_ms

    # ── 3. Quota / error fallback ────────────────────────────────────────────
    except Exception as e:
        # Log the raw error so we can debug what Hugging Face is actually returning
        logger.error(f"RAW API ERROR [{type(e).__name__}]: {e}")
        error_msg = str(e).lower()
        is_quota = any(k in error_msg for k in (
            "zerogpu", "quota", "exceeded", "rate limit",
            "too many", "try again", "unavailable", "capacity"
        ))

        if is_quota:
            logger.warning(f"HF ZeroGPU quota hit — MOCK fallback. {e}")
            time.sleep(3)

            mock_img = Image.open(person_path).convert("RGB")
            draw = ImageDraw.Draw(mock_img)
            draw.rectangle([0, 0, mock_img.width, 50], fill=(180, 0, 200))
            try:
                font = ImageFont.truetype("arial.ttf", 26)
            except Exception:
                font = ImageFont.load_default()
            draw.text((10, 12), "MOCK — ZeroGPU quota exceeded, try again later", fill=(255, 255, 255), font=font)

            mock_filename = f"ai_mock_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}.jpg"
            mock_path = RESULTS_DIR / mock_filename
            mock_img.save(mock_path, "JPEG", quality=85)

            elapsed_ms = int((time.time() - start) * 1000)
            return mock_filename, elapsed_ms

        logger.error(f"Fashn API error: {e}")
        raise RuntimeError(f"AI generation failed: {e}")





