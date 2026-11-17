"""IDM-VTON adapter. No GPU or model weights are loaded on the Mac."""

import base64
from concurrent.futures import CancelledError as FutureCancelled, TimeoutError as FutureTimeout
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import urlsplit
from urllib.parse import quote

import httpx


# Gradio applies this timeout to its SSE result stream as well as ordinary HTTP.
# A quiet generation must not lose that stream before the job's own deadline.
MODEL_WAIT_SECONDS = 55
GRADIO_HTTP_TIMEOUT = httpx.Timeout(10.0, read=MODEL_WAIT_SECONDS + 15.0, write=20.0)


class ModelError(Exception):
    pass


class ModelTimeout(ModelError):
    pass


def describe_failure(exc: Exception) -> ModelError:
    """Only fixed messages leave the server, never tokens, paths or signed URLs."""
    if isinstance(exc, ModelTimeout):
        return ModelTimeout("Le moteur d'essayage n'a pas répondu dans le délai disponible.")
    if isinstance(exc, ModelError):
        return exc
    message = str(exc).lower()
    if isinstance(exc, (httpx.TimeoutException, FutureTimeout)) or any(
        text in message for text in ("readtimeout", "read operation timed out", "read timed out")
    ):
        return ModelTimeout("Le moteur d'essayage n'a pas répondu dans le délai disponible.")
    if isinstance(exc, FutureCancelled):
        # Gradio turns a failed SSE reader into CancelledError, losing the HTTP cause.
        return ModelError("La connexion au moteur a été interrompue avant la réception du résultat. Vérifier sa disponibilité et la connexion réseau avant de réessayer.")
    if isinstance(exc, httpx.ConnectError):
        return ModelError("Connexion au moteur impossible. Vérifier qu'il est lancé et que son adresse est correcte.")
    if any(word in message for word in ("quota", "exceeded", "zerogpu", "zero gpu")):
        return ModelError("Le GPU du Space est indisponible ou son quota est épuisé. Un moteur local évite cette dépendance.")
    if any(word in message for word in ("401", "403", "unauthorized", "authentication", "sign in", "log in")):
        return ModelError("Le moteur distant refuse l'accès. Vérifier le token et les autorisations du Space.")
    if any(word in message for word in ("api_name", "endpoint", "no api", "schema", "validationerror")):
        return ModelError("L'API du moteur n'est pas compatible avec le contrat IDM-VTON /tryon.")
    return ModelError("Le moteur a échoué pendant l'essayage. Vérifier son état et ses journaux avant de relancer.")


def validate_image_url(url: str, allowed_hosts: set[str]) -> str:
    parsed = urlsplit(url)
    try:
        port = parsed.port
    except ValueError as exc:
        raise ValueError("Port d'image invalide.") from exc
    if (
        parsed.scheme != "https"
        or parsed.hostname not in allowed_hosts
        or parsed.username is not None
        or parsed.password is not None
        or port not in (None, 443)
        or parsed.fragment
    ):
        raise ValueError("Image attendue en HTTPS sur un hôte autorisé.")
    return url


def download_image(url: str, allowed_hosts: set[str], *, local_origin: str | None = None, headers: dict[str, str] | None = None) -> tuple[bytes, str]:
    if local_origin:
        parsed = urlsplit(url)
        origin = urlsplit(local_origin)
        if (parsed.scheme, parsed.hostname, parsed.port) != (origin.scheme, origin.hostname, origin.port) or parsed.username or parsed.password or parsed.fragment:
            raise ModelError("Le résultat doit provenir du moteur local configuré.")
    else:
        validate_image_url(url, allowed_hosts)
    # Exact trusted hosts only; never follow a redirect to an internal resource.
    with httpx.Client(timeout=10, follow_redirects=False, trust_env=False, headers=headers) as client:
        with client.stream("GET", url) as response:
            response.raise_for_status()
            mime = response.headers.get("content-type", "").split(";")[0].lower()
            if mime not in {"image/jpeg", "image/png", "image/webp"}:
                raise ModelError("Format d'image non pris en charge.")
            data = bytearray()
            for chunk in response.iter_bytes(64 * 1024):
                data.extend(chunk)
                if len(data) > 8 * 1024 * 1024:
                    raise ModelError("Image supérieure à 8 Mo.")
            if not data:
                raise ModelError("Image vide.")
            return bytes(data), mime


class HuggingFaceModel:
    def __init__(self, space: str, token: str | None, allowed_hosts: set[str]):
        # Gradio owns uploads/authentication; user URLs are downloaded separately.
        from gradio_client import Client

        self.space_host = space.replace("/", "-").lower() + ".hf.space"
        self.client = Client(
            space, token=token, download_files=False, verbose=False,
            httpx_kwargs={"timeout": GRADIO_HTTP_TIMEOUT}, analytics_enabled=False,
        )
        self.allowed_hosts = allowed_hosts
        self.local_origin = None
        self.result_headers = {"Authorization": f"Bearer {token}"} if token else {}

    def generate(self, person_url: str, garment_url: str) -> str:
        return self.generate_images(
            download_image(person_url, self.allowed_hosts),
            download_image(garment_url, self.allowed_hosts),
        )

    def generate_images(self, person: tuple[bytes, str], garment: tuple[bytes, str]) -> str:
        try:
            return self._generate_images(person, garment)
        except Exception as exc:
            raise describe_failure(exc) from None

    def _generate_images(self, person: tuple[bytes, str], garment: tuple[bytes, str]) -> str:
        from gradio_client import handle_file

        with TemporaryDirectory(prefix="buyfit-tryon-") as directory:
            paths = []
            for name, (data, mime) in (("person", person), ("garment", garment)):
                suffix = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[mime]
                path = Path(directory) / (name + suffix)
                path.write_bytes(data)
                paths.append(handle_file(str(path)))
            job = self.client.submit(
                {"background": paths[0], "layers": [], "composite": None},
                paths[1], "a garment", True, False, 30, 42, api_name="/tryon",
            )
            try:
                result = job.result(timeout=MODEL_WAIT_SECONDS)
            except FutureTimeout as exc:
                try:
                    job.cancel()
                except Exception:
                    pass  # Cancellation is best-effort; preserve the timeout response.
                raise ModelTimeout("Délai Hugging Face dépassé.") from exc
            output = result[0] if isinstance(result, (list, tuple)) else result
            if isinstance(output, dict):
                url = output.get("url")
                # Some Gradio releases return only a remote FileData path.
                if not url and isinstance(output.get("path"), str):
                    url = self.client.src_prefixed + "file=" + quote(output["path"], safe="/")
            else:
                url = getattr(output, "url", output)
            if not isinstance(url, str):
                raise ModelError("Réponse Hugging Face inattendue.")
            data, mime = download_image(url, {self.space_host}, local_origin=self.local_origin, headers=self.result_headers)
            return f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"


class LocalGradioModel(HuggingFaceModel):
    """Connect only to a user-installed IDM-VTON Gradio engine on this computer.

    This adapter does not install weights or make an incompatible model run on Apple Silicon.
    """

    def __init__(self, url: str, allowed_hosts: set[str]):
        from gradio_client import Client

        parsed = urlsplit(url)
        if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost", "::1"} or parsed.username or parsed.password or parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
            raise ModelError("TRYON_LOCAL_URL doit désigner un moteur Gradio local, par exemple http://127.0.0.1:7860.")
        self.space_host = parsed.hostname
        self.local_origin = url.rstrip("/")
        self.allowed_hosts = allowed_hosts
        self.result_headers = {}
        self.client = Client(
            self.local_origin, token=False, download_files=False, verbose=False,
            httpx_kwargs={"timeout": GRADIO_HTTP_TIMEOUT, "trust_env": False}, analytics_enabled=False,
        )
