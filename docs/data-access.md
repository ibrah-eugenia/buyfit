# Accès aux données (Supabase)

Schéma : `supabase/migrations/`. Seed de démo : `supabase/seed.sql`. Tests : `supabase/tests/`.

Il y a **deux façons** d'accéder à la base, avec des règles très différentes :

|               | Plateforme web (Antonin)                 | API (Ibrahim)                                                       |
| ------------- | ---------------------------------------- | ------------------------------------------------------------------- |
| Clé           | `anon` + session de l'utilisateur        | `service_role`                                                      |
| Sécurité      | **RLS** : ne voit que ses propres lignes | **contourne le RLS** : filtrer soi-même par `user_id`               |
| Où vit la clé | navigateur (publique par nature)         | serveur uniquement, **jamais** dans un bundle client ni l'extension |
| Code          | `apps/web/lib/supabase/`                 | `apps/api/src/modules/supabase.ts`                                  |

## 1. Plateforme web : fonctions à appeler depuis les pages

Toutes renvoient `{ ok: true, data } | { ok: false, error }` (message en français, prêt à afficher).
Les types (`Profile`, `UserPhoto`, `CaptureView`, `TryonView`, `OrderView`, `MerchantAccountView`)
sont dans `schemas.ts` et `merchant-accounts.schema.ts`, construits sur `@buyfit/shared`.

| Fonction                                                                  | Fichier                | Où l'appeler                             |
| ------------------------------------------------------------------------- | ---------------------- | ---------------------------------------- |
| `getProfile()`                                                            | `profile.ts`           | Server Component ou client               |
| `upsertProfile(patch)`                                                    | `profile.ts`           | idem (seuls les champs fournis changent) |
| `listUserPhotos()`                                                        | `profile.ts`           | idem (URLs signées 1 h)                  |
| `uploadUserPhoto(file, "pied" \| "face")`                                 | `photos.ts`            | **composant client uniquement**          |
| `deleteUserPhoto(id)`                                                     | `photos.ts`            | **composant client uniquement**          |
| `listMerchantAccounts()`                                                  | `merchant-accounts.ts` | Server Component ou client               |
| `connectMerchantAccount({ domaine, email, password })`                    | `merchant-accounts.ts` | idem (voir `docs/comptes-marchands.md`)  |
| `disconnectMerchantAccount(id)`                                           | `merchant-accounts.ts` | idem                                     |
| `listCaptures({ limit, offset })`                                         | `history.ts`           | idem (produits inclus, triés)            |
| `deleteCapture(id)`                                                       | `history.ts`           | idem                                     |
| `listTryons({ limit, offset })`                                           | `history.ts`           | idem (image résultat signée 1 h)         |
| `listOrders({ limit, offset })` / `getOrder(id)`                          | `history.ts`           | idem                                     |
| `signUpWithPassword`, `signInWithPassword`, `signInWithGoogle`, `signOut` | `auth.ts`              | composant client                         |
| `connectExtension()`, `getExtensionStatus()`                              | `extension-bridge.ts`  | composant client (`/extension/connect`)  |

Exemple (Server Component) :

```tsx
import { getProfile } from "@/lib/supabase/profile";
import { listOrders } from "@/lib/supabase/history";

export default async function HistoriquePage() {
  const orders = await listOrders({ limit: 20 });
  if (!orders.ok) return <p>{orders.error}</p>;
  return orders.data.map((o) => <OrderCard key={o.orderId} order={o} />);
}
```

Règles :

- Pas de fichier « index » qui ré-exporte tout : `photos.ts` / `auth.ts` sont pour le navigateur,
  `server.ts` / `h-vault.ts` pour le serveur. Importer chaque fichier directement.
- Les images sont dans des buckets **privés** : toujours afficher les `url` renvoyées (signées,
  valables 1 h), jamais construire une URL publique.
- Le mot de passe marchand ne passe que par `connectMerchantAccount` ; vider le champ après envoi.

## 2. API : ce que `apps/api` doit utiliser côté serveur

### Client

```ts
import { createClient } from "@supabase/supabase-js";
const db = createClient(config.SUPABASE_URL!, config.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```

`SUPABASE_SERVICE_ROLE_KEY` contourne tout le RLS. Donc :

1. **Le `userId` vient du token** (`Authorization: Bearer`, voir `docs/auth-extension.md`), jamais du corps.
2. **Chaque requête filtre par `user_id`** : `.eq("user_id", userId)`, y compris pour `GET /order/:id`
   et `POST /order/:id/confirm` (sinon n'importe qui lit ou confirme la commande d'un autre).

En base réelle, l'utilisateur de démo a l'id `a0000000-0000-4000-8000-000000000001` (plus `"demo-user"`).

### Lire le profil : `api_get_user_profile`

```ts
const { data, error } = await db.rpc("api_get_user_profile", { p_user_id: userId });
// null si l'utilisateur n'existe pas, sinon :
// { id, photoPaths: string[], taille, mensurations, budgetMax, devise, marquesPreferees,
//   comptesMarchands: [{ id, marchand, domaine, email?, vaultId }] }   ← comptes "connecte" seulement
```

C'est le format `UserProfile` de `packages/shared`, à deux différences près :

- `photoPaths` (plein pied d'abord) au lieu de `photos` : ce sont des chemins du bucket privé.
  Pour le service d'essayage, signer la première :
  ```ts
  const { data } = await db.storage.from("user-photos").createSignedUrl(photoPaths[0], 600);
  // data.signedUrl → TryOnRequest.userPhotoUrl (10 min suffisent)
  ```
- `comptesMarchands[].id` en plus : à recopier dans `orders.merchant_account_id`.

### Enregistrer une capture : `api_save_capture` (atomique)

```ts
const { data } = await db.rpc("api_save_capture", {
  p_user_id: userId,
  p_capture: req.capture, // InspirationCapture
  p_matches: matches, // ProductMatch[] dans l'ordre d'affichage
});
// { captureId, matches: [{ matchId, productId }] }
```

`matchId` est l'id en base du produit : le garder pour relier l'essayage et la commande
(`product_match_id`). Si un produit est invalide (ex. `score > 1`), rien n'est enregistré.

### Enregistrer un essayage

```ts
const tryonId = crypto.randomUUID();
const path = `${userId}/${tryonId}.png`; // 1er dossier = user_id, obligatoire
await db.storage.from("tryon-results").upload(path, imageBytes, { contentType: "image/png" });
await db.from("tryons").insert({
  id: tryonId,
  user_id: userId,
  product_match_id: matchId ?? null,
  garment_image_url: req.garmentImageUrl,
  result_storage_path: path,
  latency_ms,
});
const { data } = await db.storage.from("tryon-results").createSignedUrl(path, 3600);
// data.signedUrl → TryOnResult.resultImageUrl
```

Le service de Félix renvoie une URL ou une data URL : l'API télécharge / décode l'image puis
l'enregistre comme ci-dessus. On stocke le **chemin**, pas l'URL (les URLs signées expirent).

### Commandes

| `OrderStatus` (contrat) | colonne `orders`                          | Écrit par l'API                      |
| ----------------------- | ----------------------------------------- | ------------------------------------ |
| `orderId`               | `id`                                      | auto                                 |
| `statut`                | `statut` (enum)                           | à chaque `GET /order/:id`            |
| `h_session_id`          | `h_session_id`                            | au lancement (unique)                |
| `agentViewUrl`          | `agent_view_url`                          | au lancement                         |
| `message`               | `message`                                 | avec le statut                       |
| `updatedAt`             | `updated_at`                              | **auto** (trigger) : ne pas l'écrire |
| —                       | `product_id`, `product_url`, `taille`     | depuis `OrderRequest`                |
| —                       | `product_match_id`, `merchant_account_id` | si connus (`matchId`, compte)        |
| —                       | `confirmed`                               | `POST /order/:id/confirm`            |

Seule l'API écrit `orders` : le RLS interdit à l'utilisateur de modifier `statut` ou `confirmed`.

### Ce qui change dans `apps/api/src/modules/supabase.ts`

- `profiles.id` → `profiles.user_id` (uuid) ; plus de colonnes `photos` ni `comptes_marchands`
  → utiliser `api_get_user_profile`.
- `orders.statut` est un enum Postgres (mêmes valeurs que `OrderStatutSchema`).
- `apps/api/supabase/schema.sql` est remplacé par `supabase/migrations/` : à supprimer.

## 3. Variables d'environnement

| Variable                        | apps/web              | apps/api | Secret ?  |
| ------------------------------- | --------------------- | -------- | --------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | ✅                    |          | non       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅                    |          | non (RLS) |
| `SUPABASE_URL`                  |                       | ✅       | non       |
| `SUPABASE_SERVICE_ROLE_KEY`     | ✅ serveur uniquement | ✅       | **oui**   |
| `HAI_API_KEY`                   | ✅ serveur uniquement | ✅       | **oui**   |

En local, `npx supabase start` affiche l'URL et les clés (`npx supabase status`).

## 4. Après chaque migration

```bash
npx supabase db reset
npx supabase gen types typescript --local > apps/web/lib/supabase/database.types.ts
```

Puis rejouer les tests SQL (`supabase/tests/*.sql`, voir l'en-tête de chaque fichier).
`database.types.ts` est pour l'instant écrit à la main (pas de Docker) : le régénérer dès que possible.
