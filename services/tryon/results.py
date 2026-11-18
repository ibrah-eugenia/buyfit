"""Bounded local image exports, addressed only by unguessable identifiers."""

import base64
import binascii
import re
from pathlib import Path
from time import time
from uuid import uuid4


RESULT_ID = re.compile(r"[a-f0-9]{32}\.(?:png|jpg|webp)\Z")
FORMATS = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}


class ResultStore:
    def __init__(self, root: Path):
        self.root = root

    def save(self, image_url: str) -> str:
        if len(image_url) > 12 * 1024 * 1024:
            raise ValueError("Résultat supérieur à 8 Mo.")
        header, separator, encoded = image_url.partition(",")
        mime = header.removeprefix("data:").removesuffix(";base64")
        if not separator or header != f"data:{mime};base64" or mime not in FORMATS:
            raise ValueError("Le modèle doit renvoyer une image JPEG, PNG ou WebP en data URL.")
        try:
            data = base64.b64decode(encoded, validate=True)
        except (ValueError, binascii.Error) as exc:
            raise ValueError("Résultat d'image invalide.") from exc
        if not data or len(data) > 8 * 1024 * 1024:
            raise ValueError("Taille du résultat invalide.")
        signatures = {
            "image/png": data.startswith(b"\x89PNG\r\n\x1a\n"),
            "image/jpeg": data.startswith(b"\xff\xd8\xff"),
            "image/webp": data[:4] == b"RIFF" and data[8:12] == b"WEBP",
        }
        if not signatures[mime]:
            raise ValueError("Le résultat ne correspond pas à une image reconnue.")
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.cleanup()
        result_id = f"{uuid4().hex}.{FORMATS[mime]}"
        # Create exclusively with private permissions; never write client filenames.
        import os

        descriptor = os.open(self.root / result_id, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(descriptor, "wb") as result:
            result.write(data)
        return result_id

    def cleanup(self):
        files = sorted(
            (p for p in self.root.iterdir() if RESULT_ID.fullmatch(p.name) and p.is_file() and not p.is_symlink()),
            key=lambda p: p.stat().st_mtime,
        )
        for index, path in enumerate(files):
            if path.stat().st_mtime < time() - 24 * 60 * 60 or index < len(files) - 19:
                path.unlink(missing_ok=True)

    def find(self, result_id: str) -> Path | None:
        if not RESULT_ID.fullmatch(result_id):
            return None
        path = self.root / result_id
        if path.is_symlink() or not path.is_file():
            return None
        if path.stat().st_mtime < time() - 24 * 60 * 60:
            path.unlink(missing_ok=True)
            return None
        return path
