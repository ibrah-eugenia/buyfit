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

## `POST /identify`

Identifie la pièce que l'utilisateur a entourée sur l'épingle. L'extension découpe la zone et
l'envoie en base64 ; un modèle de vision Hugging Face (`HF_VISION_MODEL`, défaut `google/gemma-4-26B-A4B-it`, Inference Providers)
renvoie son nom et une requête courte, que l'extension passe ensuite en `capture.description`.
Sans `HF_TOKEN` → réponse simulée. `422` si le modèle ne reconnaît rien.

|               | Schéma                                                         |
| ------------- | -------------------------------------------------------------- |
| Requête       | `IdentifyRequest` = `{ userId, imageDataUrl: "data:image/…" }` |
| Réponse `200` | `IdentifiedItem` = `{ nom, requete, categorie?, couleur?, matiere? }` |

## `POST /serp`

Recherche Google Shopping **brute** via Bright Data SERP (équivalent de la console SERP) pour les
mots-clés de la pièce identifiée : pas de filtre budget ni de classement. Repli automatique sur
`requetesSecours` (puis sur les 3 premiers mots) si Google ne renvoie rien. 12 résultats max.

|               | Schéma                                                         |
| ------------- | -------------------------------------------------------------- |
| Requête       | `SerpRequest` = `{ userId, requete, requetesSecours? }`        |
| Réponse `200` | `SerpResponse` = `{ requete (celle qui a marché), resultats: ProductMatch[] }` |

## `POST /capture`

Lance la recherche d'équivalents d'une tenue chez les marques préférées de l'utilisateur et dans
son budget (Bright Data → Google Shopping). `capture.description` (texte de l'épingle, lu par
l'extension) sert de requête : **sans elle, l'API répond `422`** tant que la recherche par image
(Google Lens) est désactivée. Les `tailleDisponibles` sont souvent vides : l'utilisateur saisit sa taille.
`budgetMax` (optionnel) : budget choisi dans l'extension pour cette pièce ; absent → budget du profil.

|               | Schéma                                                                     |
| ------------- | -------------------------------------------------------------------------- |
| Requête       | `CaptureRequest` = `{ userId, capture: InspirationCapture, budgetMax? }`   |
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

L'agent fait deux pauses en `confirmation_requise`, distinguées par `etape` :

| `etape`     | L'agent s'est arrêté…                         | Champs en plus                        |
| ----------- | --------------------------------------------- | ------------------------------------- |
| `livraison` | sur le choix du mode de livraison (panier OK) | `livraisons: { id, label, prix?, delai? }[]` |
| `paiement`  | sur la dernière page avant le paiement        | `total` (ex. `"75,90 €"`), `message` = récapitulatif |
| `banque`    | sur la validation bancaire (3-D Secure)       | `message` ; l'utilisateur valide dans son appli |

## `POST /order/:id/confirm` (ajout — livraison puis garde-fou paiement)

Réponse de l'utilisateur quand la commande est en `confirmation_requise` :

- étape `livraison` : `{ livraison: "<id>" }` → l'agent choisit ce mode et va jusqu'à la page de
  paiement (nouvelle pause, étape `paiement`) ;
- étape `paiement` : corps vide → feu vert explicite, l'agent clique sur le bouton final de paiement.
- étape `banque` : corps vide → l'utilisateur a validé dans son appli bancaire, l'agent vérifie la confirmation.

|               | Schéma                                                                   |
| ------------- | ------------------------------------------------------------------------ |
| Requête       | `OrderConfirmRequest` = `{ livraison? }`                                 |
| Réponse `200` | `OrderStatus` (statut `en_cours`, puis pause suivante ou `commandee`)    |
| `400`         | étape `livraison` sans mode valide                                       |
| `409`         | la commande n'est pas en `confirmation_requise`                          |
