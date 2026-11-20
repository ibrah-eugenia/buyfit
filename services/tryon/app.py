"""Local-only HTTP service compatible with packages/shared/src/tryon.ts."""

import os
import re
import base64
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from threading import Lock, BoundedSemaphore
from time import monotonic

from fastapi import FastAPI, Request, UploadFile, File, Form
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, FileResponse, RedirectResponse, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

from model_client import KontextModel, download_image, HuggingFaceModel, LocalGradioModel, ModelError, ModelTimeout, describe_failure, validate_image_url
from qwen_edit import QwenEditModel
from results import ResultStore


MODE = os.getenv("TRYON_MODE", "local")
HOSTS = {h.strip().lower() for h in os.getenv("TRYON_IMAGE_HOSTS", "i.pinimg.com,images.unsplash.com").split(",") if h.strip()}
SPACE = os.getenv("HF_SPACE_ID", "yisol/IDM-VTON")
# qwen : Qwen-Image-Edit-2511 (mannequin + essayage) ; legacy : FLUX Kontext + IDM-VTON.
ENGINE = os.getenv("TRYON_ENGINE", "qwen")
BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
    "Accept": "image/webp,image/jpeg,image/png;q=0.9",  # jamais AVIF (non géré)
}
lock = Lock()
# Le mannequin se génère en 3 poses en parallèle : sémaphore séparé de l'essayage.
avatar_slots = BoundedSemaphore(3)
DIRECTORY = Path(__file__).resolve().parent
exports = ResultStore(DIRECTORY / ".results")
logger = logging.getLogger("buyfit.tryon")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if MODE not in {"mock", "huggingface", "local"}:
        raise RuntimeError("TRYON_MODE doit être local, mock ou huggingface.")
    if not re.fullmatch(r"[A-Za-z0-9_-]+/[A-Za-z0-9_-]+", SPACE):
        raise RuntimeError("HF_SPACE_ID doit être de la forme propriétaire/space.")
    # The receipt page remains available even if the generation engine is offline.
    # The engine is connected lazily during a generation, without an implicit fallback.
    app.state.model = None
    app.state.avatar_model = None
    yield


app = FastAPI(title="BuyFit — Essayage", lifespan=lifespan)


class TryOnRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    userPhotoUrl: str = Field(max_length=4096)
    garmentImageUrl: str = Field(max_length=4096)

    @field_validator("userPhotoUrl", "garmentImageUrl")
    @classmethod
    def image_url(cls, value: str) -> str:
        return validate_image_url(value, HOSTS)


class TryOnResult(BaseModel):
    resultImageUrl: str
    latencyMs: int


@app.middleware("http")
async def limit_body(request: Request, call_next):
    if request.method == "POST":
        if request.url.path in {"/avatar", "/tryon/account"} and request.headers.get("X-BuyFit-Request") != "internal":
            return JSONResponse({"error": "Appel réservé à l’API BuyFit."}, status_code=403)
        data = bytearray()
        limit = 16 * 1024 * 1024 + 64 * 1024 if request.url.path in {"/tryon/upload", "/tryon/account", "/avatar"} else 16 * 1024
        async for chunk in request.stream():
            data.extend(chunk)
            if len(data) > limit:
                return JSONResponse({"error": "Requête trop volumineuse."}, status_code=413)
        request._body = bytes(data)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-TryOn-Mode"] = MODE
    return response


@app.exception_handler(RequestValidationError)
async def invalid_request(request: Request, exc: RequestValidationError):
    # Do not echo signed image URLs or photos into errors/logs.
    if request.url.path == "/tryon/upload":
        return JSONResponse({"error": "Sélectionner une photo de personne et une image de vêtement."}, status_code=400)
    return JSONResponse({"error": "Requête invalide : vérifier les deux URL et TRYON_IMAGE_HOSTS."}, status_code=400)


@app.get("/health")
def health():
    # Readiness of this adapter, not a guarantee of remote GPU availability.
    return {"ok": True}


@app.get("/", include_in_schema=False)
def home():
    return RedirectResponse("/tryon/upload")


@app.get("/tryon/upload", include_in_schema=False)
def upload_page():
    return FileResponse(DIRECTORY / "upload.html", headers={
        "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",
    })


@app.get("/tryon/assets/{asset}", include_in_schema=False)
def upload_asset(asset: str):
    if asset not in {"upload.css", "upload.js"}:
        return JSONResponse({"error": "Fichier inconnu."}, status_code=404)
    return FileResponse(DIRECTORY / asset)


@app.get("/tryon/status")
def model_status():
    messages = {
        "local": "Mode local : aucun envoi à Hugging Face. Le moteur IDM-VTON doit être installé et lancé séparément.",
        "huggingface": "Mode distant : les images seront envoyées au Space Hugging Face. Ce mode ne réalise pas le calcul sur le Mac.",
        "mock": "Mode simulation : vérifie l'affichage uniquement. Aucune image d'essayage IA ne sera générée.",
    }
    return {"mode": MODE, "message": messages[MODE]}


@app.get("/results/{result_id}", include_in_schema=False)
def result_image(result_id: str, download: bool = False):
    path = exports.find(result_id)
    if path is None:
        return JSONResponse({"error": "Image inconnue ou expirée."}, status_code=404)
    return FileResponse(path, filename=f"buyfit-{result_id}", content_disposition_type="attachment" if download else "inline")


def get_model(request: Request):
    if request.app.state.model is None:
        if MODE == "local":
            url = os.getenv("TRYON_LOCAL_URL")
            if not url:
                raise ModelError("Aucun moteur local configuré. Installer et lancer IDM-VTON, puis définir TRYON_LOCAL_URL (ex. http://127.0.0.1:7860). Le serveur HTTP seul ne génère pas d'essayage.")
            request.app.state.model = LocalGradioModel(url, HOSTS)
        elif ENGINE == "qwen":
            request.app.state.model = QwenEditModel(os.getenv("HF_TOKEN"))
        else:
            request.app.state.model = HuggingFaceModel(SPACE, os.getenv("HF_TOKEN"), HOSTS)
    return request.app.state.model


def run_generation(generate, request: Request):
    if not lock.acquire(blocking=False):
        return JSONResponse({"error": "Un essayage est déjà en cours."}, status_code=503)
    start = monotonic()
    try:
        image = generate()
        if image.startswith("data:"):
            result_id = exports.save(image)
            image = str(request.url_for("result_image", result_id=result_id))
        return TryOnResult(resultImageUrl=image, latencyMs=round((monotonic() - start) * 1000))
    except Exception as exc:
        failure = describe_failure(exc)
        # Never log original exception messages: providers may include tokens/URLs.
        logger.warning("Échec essayage (%s): %s", type(exc).__name__, failure)
        return JSONResponse({"error": str(failure)}, status_code=504 if isinstance(failure, ModelTimeout) else 502)
    finally:
        lock.release()


@app.post("/tryon", response_model=TryOnResult)
def tryon(body: TryOnRequest, request: Request):
    def generate():
        if MODE == "mock":
            # Connectivity fixture only: this is NOT an AI-generated image.
            return body.garmentImageUrl
        return get_model(request).generate(body.userPhotoUrl, body.garmentImageUrl)

    return run_generation(generate, request)


def read_upload(upload: UploadFile) -> tuple[bytes, str]:
    data = upload.file.read(8 * 1024 * 1024 + 1)
    if len(data) > 8 * 1024 * 1024:
        raise ValueError("Chaque image doit faire au maximum 8 Mo.")
    # Inspect signatures rather than trusting filenames or the browser's MIME type.
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        mime = "image/png"
    elif data.startswith(b"\xff\xd8\xff"):
        mime = "image/jpeg"
    elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        mime = "image/webp"
    else:
        raise ValueError("Utiliser une image JPEG, PNG ou WebP (pas HEIC ou PDF).")
    return data, mime


@app.post("/tryon/upload", response_model=TryOnResult, summary="Essayer avec deux fichiers du Mac")
def tryon_upload(
    request: Request,
    person: UploadFile = File(description="Photo de la personne — JPEG, PNG ou WebP, 8 Mo max."),
    garment: UploadFile = File(description="Image du vêtement — JPEG, PNG ou WebP, 8 Mo max."),
):
    """Envoie les deux images au Space Hugging Face en mode huggingface.

    En mode mock, renvoie uniquement l'image du vêtement sans génération IA.
    """
    try:
        person_image = read_upload(person)
        garment_image = read_upload(garment)
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)
    finally:
        person.file.close()
        garment.file.close()

    def generate():
        if MODE == "mock":
            data, mime = garment_image
            return f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"
        return get_model(request).generate_images(person_image, garment_image)

    return run_generation(generate, request)

@app.post("/avatar")
def avatar(request: Request, person: UploadFile = File(), face: UploadFile | None = File(None),
           pose: int = Form(0, ge=0, le=2), body: str | None = Form(None, max_length=400)):
    """Normalize a standing photo using the official FLUX.1 Kontext Space."""
    if MODE != "huggingface":
        return JSONResponse({"error": "La création du mannequin nécessite TRYON_MODE=huggingface."}, status_code=503)
    try:
        photo = read_upload(person)
        face_photo = read_upload(face) if face else None
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)
    finally:
        person.file.close()
        if face:
            face.file.close()
    if not avatar_slots.acquire(blocking=False):
        return JSONResponse({"error": "Une génération est en cours. Réessaie dans un instant."}, status_code=503)
    try:
        if request.app.state.avatar_model is None:
            request.app.state.avatar_model = (
                QwenEditModel(os.getenv("HF_TOKEN")) if ENGINE == "qwen" else KontextModel(os.getenv("HF_TOKEN"))
            )
        model = request.app.state.avatar_model
        data, mime = (
            model.avatar(photo, face_photo, pose, body) if isinstance(model, QwenEditModel) else model.avatar(photo)
        )
        return Response(data, media_type=mime)
    except Exception as exc:
        failure = describe_failure(exc)
        return JSONResponse({"error": str(failure)}, status_code=504 if isinstance(failure, ModelTimeout) else 502)
    finally:
        avatar_slots.release()


def _optional_image(url: str | None):
    """Photo portée de la fiche produit : bonus, l'essayage continue sans si elle ne charge pas."""
    if not url:
        return None
    try:
        return download_image(url, HOSTS, headers=BROWSER_HEADERS)
    except Exception:
        return None


@app.post("/tryon/account")
def account_tryon(request: Request, person: UploadFile = File(), garment: UploadFile | None = File(None),
                  garment_url: str | None = Form(None), garment_name: str | None = Form(None, max_length=300),
                  garment_zone: str | None = Form(None, max_length=20),
                  garment_description: str | None = Form(None, max_length=400),
                  look_url: str | None = Form(None, max_length=4096)):
    """Private server-to-server path. The API supplies the account's approved mannequin."""
    if MODE == "mock":
        return JSONResponse({"error": "Active un moteur réel pour essayer ce vêtement."}, status_code=503)
    try:
        mannequin = read_upload(person)
        if bool(garment) == bool(garment_url):
            raise ValueError("Choisis un fichier ou une URL de vêtement.")
        garment_image = read_upload(garment) if garment else None
        if garment_url:
            validate_image_url(garment_url, HOSTS)
        if look_url:
            validate_image_url(look_url, HOSTS)
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)
    finally:
        person.file.close()
        if garment:
            garment.file.close()
    if not lock.acquire(blocking=False):
        return JSONResponse({"error": "Un essayage est déjà en cours."}, status_code=503)
    try:
        if garment_image is None:
            # Les CDN marchands (Zara) refusent les clients sans en-tête de navigateur (HTTP 403).
            garment_image = download_image(garment_url, HOSTS, headers=BROWSER_HEADERS)
        model = get_model(request)
        image = (
            model.generate_images(
                mannequin, garment_image, garment_name, garment_zone, garment_description,
                _optional_image(look_url),
            )
            if isinstance(model, QwenEditModel)
            else model.generate_images(mannequin, garment_image)
        )
        header, encoded = image.split(",", 1)
        return Response(base64.b64decode(encoded, validate=True), media_type=header[5:-7])
    except Exception as exc:
        failure = describe_failure(exc)
        return JSONResponse({"error": str(failure)}, status_code=504 if isinstance(failure, ModelTimeout) else 502)
    finally:
        lock.release()
