"""Mannequin et essayage avec Qwen-Image-Edit-2511 (open source, Apache 2.0).

Appelé via les Inference Providers de Hugging Face (fournisseur WaveSpeed, payé avec les crédits
du compte HF_TOKEN). Le modèle édite une ou plusieurs images selon une consigne :
- mannequin : la photo de l'utilisateur → photo catalogue en pied, pose de mannequin, fond studio ;
- essayage : [mannequin, photo produit] → le mannequin porte le produit, le reste est inchangé.

Choisi le 19/11/2026 après comparaison : FLUX.1 Kontext + IDM-VTON (rendu peu réaliste),
Qwen-Image-Edit-2509 via fal (fond et rôles des images mal respectés) ; 2511 garde visage, pose
et fond, reproduit couleur et coupe du produit, en ~10 s par image.
"""

import base64
import re
import time

import httpx

from model_client import ModelError, ModelTimeout

ROUTER = "https://router.huggingface.co/wavespeed"
MODEL_PATH = "/api/v3/wavespeed-ai/qwen-image/edit-2511"
# Portrait 3:4 : un corps entier tient avec une marge, comme sur une fiche produit.
SIZE = "960*1280"
DEADLINE_S = 120

# Poses proposées pour le mannequin (l'utilisateur choisit la sienne).
POSES = [
    "standing straight, facing the camera, arms hanging naturally at the sides, feet hip-width apart",
    "three-quarter view, body turned slightly to one side, weight on one leg, one hand casually in the "
    "trouser pocket, looking at the camera",
    "walking towards the camera in mid-stride, arms swinging naturally, relaxed confident look",
]

# Tenue neutre et simple : chaque essayage n'a qu'une pièce connue à remplacer (pull → t-shirt…).
# Image 1 = planche de photos du visage (une ou plusieurs), image 2 = planche du corps debout.
AVATAR_PROMPT = (
    "Image 1 shows one or several close-up photos of a real person's face. Image 2 shows one or several "
    "photos of the same real person standing. Create a full-length fashion e-commerce photo of THIS exact "
    "real person, like a real photograph of them, not an idealised model: reproduce the face from "
    "image 1 exactly (same identity, face shape, eye shape and spacing, nose width, lips, jawline, ears, "
    "facial hair density and shape, hairline, hair texture and style, skin tone and real skin texture, "
    "natural asymmetries); do not beautify, slim or change the age. Body build, height proportions and "
    "shoulder width from image 2.{body} Realistic everyday body exactly as it is: ordinary muscle tone, no "
    "added muscle definition, no broadened shoulders, no bulky arms or chest, no gym or fitness-model "
    "physique, never slimmer or bigger than described, no idealisation. Model pose: {pose}. The entire body is visible from the top of the head "
    "to the shoes, centered with a small margin. Outfit, all black and nothing else: a plain black "
    "short-sleeve crew-neck t-shirt, plain black trousers and plain black sneakers; no jacket, no "
    "jewellery, no watch, no glasses, no bag, no logo. Ignore the clothes and backgrounds of images 1 and "
    "2. Plain seamless light grey studio background, soft diffused even lighting, photorealistic, sharp "
    "focus, no text, no watermark, a single person in a single photo."
)
# Une seule photo (ancien parcours) : visage et corps sur la même image.
AVATAR_PROMPT_SINGLE = (
    AVATAR_PROMPT.replace(
        "Image 1 shows one or several close-up photos of a real person's face. Image 2 shows one or several "
        "photos of the same real person standing.",
        "The picture shows a real person.",
    )
    .replace("from image 1", "from the picture")
    .replace("from image 2", "from the picture")
    .replace("of images 1 and 2", "of the picture")
)

# Ce que la pièce remplace dans la tenue neutre du mannequin, selon sa zone (analyse IA du produit).
REPLACE = {
    "haut": "Replace the black t-shirt with this top. Keep the black trousers and black sneakers.",
    "bas": "Replace the black trousers with this bottom. Keep the black t-shirt (tucked or untucked naturally) and black sneakers.",
    "veste": "Put this jacket on the customer, worn over the black t-shirt. Keep the black trousers and black sneakers.",
    "robe": "Replace both the black t-shirt and the black trousers with this one-piece garment. Keep the black sneakers.",
    "chaussures": "Replace the black sneakers with these shoes. Keep the black t-shirt and black trousers.",
}

TRYON_PROMPT = (
    "Virtual try-on. Image 1: the customer in a neutral outfit. Image 2: the store photo of the "
    'product "{name}": {description}.{look} {replace} Copy the product faithfully from image 2: same '
    "colour and shade (the exact colour named in the description), fabric, knit or weave texture, "
    "pattern, neckline, closure, sleeves, cut, fit, length and details. Take ONLY this product from the store photos and ignore everything else in "
    "them (the models, their faces, skin, other clothes, accessories and backgrounds). Keep everything else from "
    "image 1 identical: face, identity, skin tone, hair, body proportions, pose, plain light grey "
    "studio background and full-length framing. The garment is sized for this body, with realistic "
    "drape and natural folds. Photorealistic catalogue photo, no text, no watermark."
)


def _data_uri(image: tuple[bytes, str]) -> str:
    data, mime = image
    return f"data:{mime};base64,{base64.b64encode(data).decode()}"


def _clean(text: str | None, limit: int, default: str) -> str:
    # Texte venu d'une page marchande ou d'un modèle : borné, sans guillemets ni retours ligne.
    cleaned = re.sub(r'[\s"\\{}]+', " ", text or "").strip()[:limit]
    return cleaned or default


class QwenEditModel:
    def __init__(self, token: str | None):
        if not token:
            raise ModelError("HF_TOKEN manquant : impossible d'appeler Qwen-Image-Edit.")
        self.headers = {"Authorization": f"Bearer {token}"}

    def avatar(
        self,
        photo: tuple[bytes, str],
        face: tuple[bytes, str] | None = None,
        pose: int = 0,
        body: str | None = None,
    ) -> tuple[bytes, str]:
        pose_text = POSES[pose if 0 <= pose < len(POSES) else 0]
        # Mesures du profil : elles priment sur l'impression donnée par les photos.
        body_text = (
            f" IMPORTANT: the body build follows the person's own profile, which takes priority over "
            f"image 2 and must be clearly visible in the result: {_clean(body, 400, '')}. If the build is "
            f"slim, the arms, chest and shoulders are slender with no visible muscle definition."
            if body
            else ""
        )
        if face is None:
            return self._run(
                [_data_uri(photo)], AVATAR_PROMPT_SINGLE.format(pose=pose_text, body=body_text)
            )
        return self._run(
            [_data_uri(face), _data_uri(photo)], AVATAR_PROMPT.format(pose=pose_text, body=body_text)
        )

    def generate_images(
        self,
        person: tuple[bytes, str],
        garment: tuple[bytes, str],
        name: str | None = None,
        zone: str | None = None,
        description: str | None = None,
        look: tuple[bytes, str] | None = None,
    ) -> str:
        prompt = TRYON_PROMPT.format(
            name=_clean(name, 140, "this clothing item"),
            description=_clean(description, 400, "see image 2"),
            replace=REPLACE.get(zone or "", REPLACE["haut"]),
            look=(
                " Image 3: the same product worn by a real model on the store page; use it ONLY to understand "
                "how it fits, drapes and falls on a real body, then reproduce that fit on the customer. The "
                "colour, shade and pattern always come from image 2 and the description, never from image 3."
                if look
                else ""
            ),
        )
        images = [_data_uri(person), _data_uri(garment)] + ([_data_uri(look)] if look else [])
        data, mime = self._run(images, prompt)
        return f"data:{mime};base64,{base64.b64encode(data).decode()}"

    def _run(self, images: list[str], prompt: str) -> tuple[bytes, str]:
        started = time.monotonic()
        with httpx.Client(timeout=httpx.Timeout(30.0, read=60.0), trust_env=False) as client:
            res = client.post(
                ROUTER + MODEL_PATH,
                headers=self.headers,
                json={"images": images, "prompt": prompt, "size": SIZE, "output_format": "jpeg"},
            )
            self._check(res)
            # La réponse recopie les entrées (parfois tronquée par le routeur) : on ne lit que l'id.
            match = re.search(r'"id"\s*:\s*"([0-9a-f]{16,})"', res.text)
            if not match:
                raise ModelError("Réponse inattendue du moteur d'image.")
            result_url = f"{ROUTER}/api/v3/predictions/{match.group(1)}/result"
            while True:
                if time.monotonic() - started > DEADLINE_S:
                    raise ModelTimeout("Le moteur d'image n'a pas répondu à temps.")
                time.sleep(1.2)
                poll = client.get(result_url, headers=self.headers)
                self._check(poll)
                data = poll.json().get("data") or {}
                status = data.get("status")
                if status == "completed":
                    outputs = data.get("outputs") or []
                    if not outputs:
                        raise ModelError("Le moteur d'image n'a renvoyé aucune image.")
                    image = client.get(outputs[0], timeout=60.0)
                    image.raise_for_status()
                    mime = image.headers.get("content-type", "image/jpeg").split(";")[0]
                    if mime not in {"image/jpeg", "image/png", "image/webp"}:
                        mime = "image/jpeg"
                    return image.content, mime
                if status == "failed":
                    raise ModelError(
                        "La génération a échoué chez le fournisseur. Réessaie avec une autre photo."
                    )

    @staticmethod
    def _check(res: httpx.Response) -> None:
        if res.status_code == 402:
            raise ModelError(
                "Crédits Hugging Face épuisés : ajoute des crédits (huggingface.co/settings/billing)."
            )
        if res.status_code in (401, 403):
            raise ModelError("Hugging Face refuse le token : vérifie HF_TOKEN.")
        if res.status_code == 429:
            raise ModelError("Trop de générations d'un coup. Réessaie dans quelques secondes.")
        if res.status_code >= 400:
            raise ModelError(f"Le moteur d'image a répondu HTTP {res.status_code}.")
