# services/tryon — Essayage virtuel 2D

**Responsable : Félix.** Langage et framework au choix (Python/FastAPI conseillé pour les modèles
Hugging Face). Le service est appelé **uniquement par `apps/api`**, jamais par l'extension.

## Contrat HTTP à exposer

Formats définis dans [`packages/shared/src/tryon.ts`](../../packages/shared/src/tryon.ts).

### `POST /tryon`

Requête (`TryOnRequest`) :

```json
{
  "userPhotoUrl": "https://…/user.jpg",
  "garmentImageUrl": "https://…/vetement.jpg"
}
```

Réponse `200` (`TryOnResult`) :

```json
{
  "resultImageUrl": "https://…/resultat.jpg",
  "latencyMs": 8400
}
```

- `resultImageUrl` : URL publique (idéalement Supabase Storage, bucket `tryon-results`) ou data URL
  `data:image/jpeg;base64,…` pour démarrer.
- Erreur : code `4xx/5xx` + `{ "error": "message" }`.
- Timeout côté API : **90 s**. Viser < 20 s pour la démo.

### `GET /health`

Renvoie `200 { "ok": true }` (utile pour vérifier que le modèle est chargé).

## Intégration

- En local, lancer le service sur `http://localhost:8000` et mettre
  `TRYON_SERVICE_URL=http://localhost:8000` dans le `.env` racine.
- Tant que `TRYON_SERVICE_URL` est vide, l'API utilise un mock (renvoie l'image du vêtement).
- Mettre les dépendances (requirements.txt / pyproject) et un `Dockerfile` dans ce dossier.
- Si le service est en Python, il est exclu du lint/typecheck TS (déjà ignoré dans la config).
