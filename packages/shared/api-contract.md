# Contrat d'API BuyFit (`apps/api`)

Source de vérité des formats : les schémas zod de [`src/`](src/). Ce document liste les endpoints ;
si les deux divergent, **le code zod fait foi**. Toute modification passe par Ibrahim.

- Base URL locale : `http://localhost:8787` (variable `API_URL`)
- Format : JSON (`Content-Type: application/json`)
- Erreurs : tout code `>= 400` renvoie un `ApiError` `{ "error": string, "details"?: unknown }`
  - `400` : corps invalide (`details` = erreurs zod)
  - `404` : ressource inconnue
  - `502` : une brique en aval (Bright Data, H Company, try-on, Supabase) a échoué

## `GET /health`

Renvoie `{ "ok": true, "mocks": { "brightdata": bool, "hcompany": bool, "tryon": bool, "supabase": bool } }`.

## `POST /capture`

Lance la recherche d'équivalents d'une tenue chez les marques préférées de l'utilisateur et dans
son budget (Bright Data → Google Shopping). `capture.description` (texte de l'épingle, lu par
l'extension) sert de requête : **sans elle, l'API répond `422`** tant que la recherche par image
(Google Lens) est désactivée. Les `tailleDisponibles` sont souvent vides : l'utilisateur saisit sa taille.

|               | Schéma                                                                     |
| ------------- | -------------------------------------------------------------------------- |
| Requête       | `CaptureRequest` = `{ userId, capture: InspirationCapture }`               |
| Réponse `200` | `CaptureResponse` = `ProductMatch[]` (trié par `score` décroissant, 3 max) |

```json
{
  "userId": "demo-user",
  "capture": {
    "imageUrl": "https://i.pinimg.com/originals/ab/cd/ef.jpg",
    "pinUrl": "https://www.pinterest.com/pin/123456/",
    "description": "Pull col roulé torsadé en laine",
    "capturedAt": "2026-11-17T10:00:00.000Z"
  }
}
```

## `POST /tryon`

Proxy vers le service d'essayage de Félix (`services/tryon`, `POST {TRYON_SERVICE_URL}/tryon`).

|                   | Schéma                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Requête           | `TryOnApiRequest` = `{ userId, garmentImageUrl, userPhotoUrl? }` — sans `userPhotoUrl`, l'API prend la 1re photo du profil |
| Envoyé au service | `TryOnRequest` = `{ userPhotoUrl, garmentImageUrl }`                                                                       |
| Réponse `200`     | `TryOnResult` = `{ resultImageUrl, latencyMs? }`                                                                           |

## `POST /order`

Lance un agent computer-use H Company qui passe la commande sur le compte marchand de
l'utilisateur. **L'agent s'arrête avant le paiement final** (statut `confirmation_requise`).

|               | Schéma                                                                                  |
| ------------- | --------------------------------------------------------------------------------------- |
| Requête       | `OrderRequest` = `{ userId, productId, productUrl, taille }`                            |
| Réponse `202` | `OrderStatus` = `{ orderId, statut, h_session_id, agentViewUrl?, message?, updatedAt }` |

## `GET /order/:id`

Suit l'avancement de la session H Company associée à la commande `:id`.

|               | Schéma            |
| ------------- | ----------------- |
| Réponse `200` | `OrderStatus`     |
| `404`         | commande inconnue |

Statuts : `en_attente` → `en_cours` → `confirmation_requise` → `commandee` | `echec`.
Polling conseillé côté client : toutes les 3 s jusqu'à un statut terminal (`commandee`, `echec`).

## `POST /order/:id/confirm` (ajout — garde-fou paiement)

Feu vert explicite de l'utilisateur quand la commande est en `confirmation_requise` : l'API
demande alors à l'agent H Company de cliquer sur le bouton final de paiement.

|               | Schéma                                                                   |
| ------------- | ------------------------------------------------------------------------ |
| Requête       | aucun corps                                                              |
| Réponse `200` | `OrderStatus` (statut `en_cours`, puis `commandee` via `GET /order/:id`) |
| `409`         | la commande n'est pas en `confirmation_requise`                          |
