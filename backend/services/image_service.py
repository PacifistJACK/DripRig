import io
import os
import time
import uuid
import logging
import shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from dotenv import load_dotenv
import pyrebase

load_dotenv()

# ── Azure-safe paths ──────────────────────────────────────────────────────────
# On Azure App Service, /home is the only persistent mount.
# Locally we fall back to the classic backend/uploads and backend/results dirs.
_AZURE_DATA = os.environ.get("AZURE_DATA_DIR", "")
if _AZURE_DATA:
    _BASE_DATA = Path(_AZURE_DATA)
else:
    _azure_home = os.environ.get("HOME", "")
    if _azure_home and Path(_azure_home).exists() and os.environ.get("WEBSITE_HOSTNAME"):
        # Running on Azure — use /home/data for persistence
        _BASE_DATA = Path(_azure_home) / "data"
    else:
        # Local dev — use backend/uploads and backend/results as before
        _BASE_DATA = Path(__file__).parent.parent

storage = None
try:
    import pyrebase
    firebaseConfig = {
        "apiKey":            os.environ.get("FIREBASE_API_KEY", ""),
        "authDomain":        os.environ.get("FIREBASE_AUTH_DOMAIN", ""),
        "projectId":         os.environ.get("FIREBASE_PROJECT_ID", ""),
        "storageBucket":     os.environ.get("FIREBASE_STORAGE_BUCKET", ""),
        "messagingSenderId": os.environ.get("FIREBASE_MESSAGING_SENDER_ID", ""),
        "appId":             os.environ.get("FIREBASE_APP_ID", ""),
        "measurementId":     os.environ.get("FIREBASE_MEASUREMENT_ID", ""),
        "databaseURL":       ""
    }
    firebase = pyrebase.initialize_app(firebaseConfig)
    storage = firebase.storage()
except Exception as _fb_err:
    logging.warning(f"Firebase Storage initialization bypassed: {_fb_err}")

logger = logging.getLogger(__name__)


def upload_to_firebase(local_path: Path, filename: str) -> str:
    """Upload result image to Firebase Storage under results/ folder."""
    if storage is None:
        return f"/results/{filename}"
    try:
        firebase_path = f"results/{filename}"
        storage.child(firebase_path).put(str(local_path))
        url = storage.child(firebase_path).get_url(None)
        logger.info(f"Uploaded to Firebase: {firebase_path}")
        return url
    except Exception as e:
        logger.error(f"Firebase upload failed: {e}")
        return f"/results/{filename}"


def upload_upload_to_firebase(local_path: Path, filename: str, folder: str = "uploads") -> str:
    """Upload a user-uploaded image to Firebase Storage under uploads/ folder."""
    if storage is None:
        return f"/{folder}/{filename}"
    try:
        firebase_path = f"{folder}/{filename}"
        storage.child(firebase_path).put(str(local_path))
        url = storage.child(firebase_path).get_url(None)
        logger.info(f"Uploaded to Firebase: {firebase_path}")
        return url
    except Exception as e:
        logger.error(f"Firebase upload (uploads) failed: {e}")
        return f"/{folder}/{filename}"

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_DIMENSION = 1024
UPLOAD_DIR = _BASE_DATA / "uploads"
RESULTS_DIR = _BASE_DATA / "results"

def ensure_dirs():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)


async def validate_and_save(file_bytes: bytes, content_type: str, slot: str) -> dict:
    """Save upload to disk, de-duplicating by MD5 content hash."""
    ensure_dirs()
    if content_type not in ALLOWED_TYPES:
        raise ValueError(f"Invalid file type '{content_type}'. Allowed: JPEG, PNG, WEBP")

    import hashlib
    file_hash = hashlib.md5(file_bytes).hexdigest()[:12]
    filename = f"{slot}_{file_hash}.jpg"
    save_path = UPLOAD_DIR / filename

    # De-duplication: Reuse existing file if identical bytes uploaded
    if save_path.exists():
        try:
            with Image.open(save_path) as existing_img:
                w, h = existing_img.size
                logger.info(f"Duplicate upload detected for {slot}: reusing existing {filename}")
                return {"filename": filename, "path": str(save_path), "width": w, "height": h}
        except Exception:
            pass

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
    img.save(save_path, "JPEG", quality=90, optimize=True)
    
    return {"filename": filename, "path": str(save_path), "width": width, "height": height}



# ── VTON Model Adapters ──────────────────────────────────────────────────────
# Each adapter takes (person_path, garment_path) and returns a local Path
# to the generated result. They normalize the different API signatures so
# the fallback chain above can call them all the same way.

def _try_catvton(person_path: Path, garment_path: Path, cloth_type: str = "overall") -> Path:
    """Adapter for zhengchong/CatVTON (Fast model)."""
    import tempfile
    from PIL import Image
    from gradio_client import Client, handle_file

    logger.info(f"Trying fast model: zhengchong/CatVTON (cloth_type={cloth_type})")
    client = Client("zhengchong/CatVTON")

    # Save clean RGB temporary PNG copies of inputs
    person_img = Image.open(person_path).convert("RGB")
    person_tmp = tempfile.mktemp(suffix=".png")
    person_img.save(person_tmp)

    garment_img = Image.open(garment_path).convert("RGB")
    garment_tmp = tempfile.mktemp(suffix=".png")
    garment_img.save(garment_tmp)

    # CatVTON's handler expects a fully transparent RGBA mask in layers[0] for automasking
    mask_tmp = tempfile.mktemp(suffix=".png")
    Image.new("RGBA", person_img.size, (0, 0, 0, 0)).save(mask_tmp)

    result = client.predict(
        person_image={
            "background": handle_file(person_tmp),
            "layers": [handle_file(mask_tmp)],
            "composite": handle_file(person_tmp),
        },
        cloth_image=handle_file(garment_tmp),
        cloth_type=cloth_type if cloth_type in ("upper", "lower", "overall") else "overall",
        num_inference_steps=30,
        guidance_scale=2.5,
        seed=42,
        show_type="result only",
        api_name="/submit_function"
    )

    if isinstance(result, dict):
        return Path(result.get("path") or result.get("value") or str(result))
    if isinstance(result, (list, tuple)):
        r = result[0]
        return Path(r["path"] if isinstance(r, dict) else r)
    return Path(str(result))


def _try_sm4ll_vton(person_path: Path, garment_path: Path) -> Path:
    """Adapter for sm4ll-VTON/sm4ll-VTON-Demo."""
    from gradio_client import Client, handle_file
    logger.info("Trying fallback model: sm4ll-VTON/sm4ll-VTON-Demo")
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
    logger.info("Trying model (quality): WeShopAI/WeShopAI-Virtual-Try-On")
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


def _try_nymbo_vton(person_path: Path, garment_path: Path) -> Path:
    """Adapter for Nymbo/Virtual-Try-On — fast, open API, 300k+ likes."""
    from gradio_client import Client, handle_file
    logger.info("Trying fast model: Nymbo/Virtual-Try-On")
    client = Client("Nymbo/Virtual-Try-On")
    result = client.predict(
        dict={
            "background": handle_file(str(person_path)),
            "layers": [],
            "composite": None
        },
        garm_img=handle_file(str(garment_path)),
        garment_des="",        # no description needed
        is_checked=True,
        is_checked_crop=False,
        denoise_steps=30,
        seed=42,
        api_name="/tryon"
    )
    if isinstance(result, (list, tuple)):
        r = result[0]
        if isinstance(r, dict):
            return Path(r.get("path") or r.get("value") or str(r))
        return Path(str(r))
    if isinstance(result, dict):
        return Path(result.get("path") or result.get("value") or str(result))
    return Path(str(result))


# Priority-ordered list of model adapters — first one that succeeds wins
_VTON_MODELS = [
    ("NymboVTON", _try_nymbo_vton),
    ("CatVTON",   _try_catvton),
    ("WeShopAI",  _try_weshop_vton),
    ("sm4ll-VTON",_try_sm4ll_vton),
]

# Keywords that indicate a recoverable quota/capacity error → try fallback model
_QUOTA_KEYWORDS = (
    "zerogpu", "quota", "exceeded", "rate limit",
    "too many requests", "try again", "unavailable", "capacity",
    "service unavailable", "429", "503",
)


def generate_ai_tryon(slots: dict, model: str = "fast") -> tuple[str, int, str]:
    """
    2-slot UI pipeline:
      - slots['person']  → full-body photo of the person
      - slots['outfit']  → photo of the outfit to try on
      - model            → "fast" (CatVTON) | "quality" (WeShopAI)

    Runs the user-selected model first. If it fails, falls back to other models cleanly.
    Falls back to a MOCK image only when all models fail.
    """
    ensure_dirs()
    start = time.time()

    # ── 1. Resolve slots ────────────────────────────────────────────────────
    outfit_url = slots.get("outfit") or slots.get("top")
    person_url = slots.get("person")

    if not person_url:
        raise ValueError("A person photo is required.")
    if not outfit_url:
        raise ValueError("An outfit image is required.")

    def resolve_file(url_or_path: str, slot_name: str) -> Path:
        """Accept either a Firebase/HTTP URL or a local /uploads/ path."""
        if url_or_path.startswith("http://") or url_or_path.startswith("https://"):
            # Check if it's pointing to our local server uploads or results
            if "/uploads/" in url_or_path or "/results/" in url_or_path:
                local_filename = url_or_path.split("/")[-1]
                local_path = UPLOAD_DIR / local_filename
                if local_path.exists():
                    return local_path

            try:
                resp = requests.get(url_or_path, timeout=30)
                resp.raise_for_status()
                filename = f"dl_{slot_name}_{int(time.time() * 1000)}.jpg"
                path = UPLOAD_DIR / filename
                with open(path, 'wb') as f:
                    f.write(resp.content)
                return path
            except Exception as e:
                raise ValueError(f"The uploaded {slot_name} image is no longer available on the server. Please re-upload your {slot_name} photo.")
        else:
            local_filename = url_or_path.lstrip("/").replace("uploads/", "").replace("results/", "")
            local_path = UPLOAD_DIR / local_filename
            if not local_path.exists():
                raise ValueError(f"The uploaded {slot_name} image is no longer available on the server. Please re-upload your {slot_name} photo.")
            return local_path

    person_path = resolve_file(person_url, "person")
    garment_path = resolve_file(outfit_url, "outfit")

    # ── 2. Build ordered model list based on user selection ──────────────────
    all_models = {
        "fast":    ("NymboVTON", _try_nymbo_vton),
        "quality": ("WeShopAI",  _try_weshop_vton),
    }
    primary = all_models.get(model, all_models["fast"])

    if model == "fast":
        ordered_models = [primary, ("CatVTON", _try_catvton), ("WeShopAI", _try_weshop_vton), ("sm4ll-VTON", _try_sm4ll_vton)]
    else:
        ordered_models = [primary, ("NymboVTON", _try_nymbo_vton), ("CatVTON", _try_catvton), ("sm4ll-VTON", _try_sm4ll_vton)]

    logger.info(f"AI Try-on | model={model} | person={person_url}  outfit={outfit_url}")

    # ── 3. Try models in order ───────────────────────────────────────────────
    last_error = None
    for model_name, adapter_fn in ordered_models:
        try:
            generated_path = adapter_fn(person_path, garment_path)

            result_filename = f"ai_{model_name.lower().replace('-','_')}_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}.jpg"
            result_path = RESULTS_DIR / result_filename
            
            # Ensure generated output is saved cleanly as RGB JPEG (handles webp/png/rgba output)
            res_img = Image.open(generated_path).convert("RGB")
            res_img.save(result_path, "JPEG", quality=92)
            
            result_url = upload_to_firebase(result_path, result_filename)

            elapsed_ms = int((time.time() - start) * 1000)
            logger.info(f"✓ {model_name} succeeded → {result_filename} ({elapsed_ms / 1000:.1f}s)")
            return result_url, elapsed_ms, model_name

        except Exception as e:
            logger.warning(f"✗ {model_name} failed: {e}")
            last_error = e

    # ── 4. All models exhausted — return MOCK image ──────────────────────────
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
    
    mock_url = upload_to_firebase(mock_path, mock_filename)

    elapsed_ms = int((time.time() - start) * 1000)
    return mock_url, elapsed_ms, "mock"





