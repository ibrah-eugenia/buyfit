# BuyFit

**De l'inspiration Pinterest à la commande, en un clic.**
Tu captures une tenue sur Pinterest, BuyFit trouve des équivalents chez tes marques et dans ton budget,
te montre l'essayage sur ta photo, puis un agent IA passe la commande sur ton compte marchand.

## Le problème

Pinterest est l'un des premiers endroits où l'on trouve l'inspiration mode, mais il s'arrête à
l'image. Passer de « j'aime ce look » à « je l'ai acheté » reste long et décourageant :

- **retrouver la pièce** : l'épingle ne dit presque jamais d'où vient le vêtement, et il est
  souvent introuvable ou hors de prix ;
- **savoir si ça me va** : impossible de se projeter, et la taille varie d'une marque à l'autre ;
- **acheter** : ouvrir le site, chercher l'article, choisir la taille, se connecter, remplir la
  livraison… pour chaque marque.

Résultat : la plupart des looks enregistrés ne sont jamais achetés.

## La solution

BuyFit transforme une épingle Pinterest en commande, sans quitter Pinterest :

1. **Capturer** : clic droit sur une image (ou sélection à l'écran) dans l'extension Chrome.
2. **Trouver** : BuyFit identifie chaque pièce et cherche des équivalents chez les marques
   préférées de l'utilisateur (Zara, Mango, Uniqlo…), dans son budget, avec un score de ressemblance.
3. **Essayer** : le vêtement est montré porté sur la photo de l'utilisateur (essayage virtuel 2D).
4. **Acheter** : un agent computer-use H Company passe la commande sur **le compte marchand de
   l'utilisateur**, avec la bonne taille et sa livraison. Il s'arrête **avant le paiement** et
   attend un feu vert explicite.

La plateforme web garde le profil (tailles, budget, marques, photos), l'historique des looks,
essayages et commandes, et relie les comptes marchands **sans jamais stocker de mot de passe** :
les identifiants vont dans un coffre H Company propre à chaque utilisateur.

## Prototype

| Quoi                    | Lien                                                  |
| ----------------------- | ----------------------------------------------------- |
| Plateforme web          | _À COMPLÉTER : URL du site déployé_                   |
| API (Railway)           | _À COMPLÉTER : URL Railway_ (`/health` pour vérifier) |
| Extension Chrome (.zip) | _À COMPLÉTER : lien vers la release GitHub_           |
| Vidéo de démo           | _À COMPLÉTER_                                         |

## Comment tester (≈ 5 min)

**Sans rien installer : la plateforme web**

1. Ouvrir la plateforme web (lien ci-dessus) et **créer un compte** (email + mot de passe).
2. Suivre l'onboarding : genre, photo plein pied, silhouette, marques et budget, livraison.
3. Dans **Réglages**, relier un compte marchand : seuls des identifiants de référence sont
   enregistrés chez nous, le mot de passe part dans un coffre H Company.
4. **Tableau de bord** : looks capturés, produits trouvés, essayages et commandes.

**Le parcours complet avec l'extension**

1. Télécharger l'extension (.zip ci-dessus) et la décompresser.
2. `chrome://extensions` → activer le **Mode développeur** → **Charger l'extension non
   empaquetée** → choisir le dossier décompressé.
3. Aller sur [pinterest.com](https://www.pinterest.com), clic droit sur une tenue →
   **« Trouver ce look avec BuyFit »**.
4. Le panneau latéral affiche les équivalents : **Essayer** pour l'essayage, **Acheter** pour
   lancer l'agent, puis suivre la commande en direct. L'agent s'arrête avant le paiement.

**En local (développeurs)** : voir [Prérequis](#prérequis) et [Lancer chaque brique](#lancer-chaque-brique)
plus bas. Sans clés, chaque brique tourne en mode simulé.

## Le flux

```
 Pinterest                Extension Chrome              apps/api (Hono)                Briques externes
 ─────────                ────────────────              ───────────────                ────────────────
 clic droit image ──────▶ background + content script
                          (image grand format)
                          side panel React ── POST /capture ──▶ profil (Supabase) ────▶ Supabase
                                                              recherche visuelle ─────▶ Bright Data (SERP / Lens)
                          3 produits ◀──── ProductMatch[] ────
                          « Essayer » ─────── POST /tryon ───▶ proxy ─────────────────▶ services/tryon (Félix, HF)
                          image essayée ◀─── TryOnResult ─────
                          « Acheter » ─────── POST /order ───▶ session agent ─────────▶ H Company (hai-agents)
                          suivi ◀────────── GET /order/:id ──     (s'arrête avant paiement)
                          « Confirmer » ── POST /order/:id/confirm ─▶ l'agent valide la commande
```

Le contrat entre toutes les briques : [`packages/shared`](packages/shared) (schémas zod) et
[`api-contract.md`](packages/shared/api-contract.md).

## Architecture d'ensemble

```
                        ┌──────────────────────────────┐
  Pinterest ──────────▶ │ Extension Chrome (WXT, React) │ ─── capture / essayage / achat ───┐
                        └──────────────────────────────┘                                    │
                                                                                            ▼
  ┌─────────────────────────────┐   auth, profil, photos,     ┌────────────────────────────────────┐
  │ Plateforme web (Next.js 16)  │ ── comptes, historique ──▶ │ Supabase                           │
  │ onboarding, réglages,        │      (clé anon + RLS)       │ Postgres + RLS · Auth · Storage    │
  │ tableau de bord              │                             │ (buckets privés user-photos,       │
  └─────────────────────────────┘                             │  tryon-results)                    │
               │ relier un compte marchand                     └────────────────────────────────────┘
               ▼ (le mot de passe ne fait que transiter)                       ▲ clé service_role
  ┌─────────────────────────────┐                             ┌────────────────┴───────────────────┐
  │ H Company · vault par        │ ◀── vault_id (override) ─── │ API d'orchestration (Hono, Node)   │
  │ utilisateur + agent          │                             │ déployée sur Railway               │
  │ computer-use (hai-agents)    │ ── commande sur le site ──▶ │                                    │
  └─────────────────────────────┘     marchand (Zara…)        └───┬───────────────┬────────────────┘
                                                                  │               │
                                       recherche Google Images /  ▼               ▼  essayage 2D
                                       Shopping ─── Bright Data    Hugging Face    services/tryon
                                                                   (vision +       (FastAPI,
                                                                   similarité)     IDM-VTON)
```

Principes de sécurité : aucune clé dans l'extension, RLS « chacun ses lignes » sur toutes les
tables, aucun mot de passe marchand en base, paiement validé uniquement par l'utilisateur.
Détails : [`docs/data-access.md`](docs/data-access.md),
[`docs/comptes-marchands.md`](docs/comptes-marchands.md),
[`docs/auth-extension.md`](docs/auth-extension.md).

## Stack

| Brique             | Technologies                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Extension Chrome   | WXT (Manifest V3), React, TypeScript                                                       |
| Plateforme web     | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui, react-hook-form, zod         |
| API                | Node, Hono, TypeScript, zod · déployée sur Railway                                         |
| Données & auth     | Supabase : Postgres (RLS), Auth (email + mot de passe), Storage privé, migrations CLI      |
| Recherche produits | Bright Data (Google Images / Shopping)                                                     |
| IA                 | Hugging Face Inference (identification des pièces, filtre de similarité)                   |
| Essayage virtuel   | Python, FastAPI, IDM-VTON (Gradio / Hugging Face Space) — `services/tryon`                 |
| Agent d'achat      | H Company : agent computer-use (SDK `hai-agents`) + vaults pour les identifiants marchands |
| Contrat partagé    | `packages/shared` : schémas zod communs à toutes les briques                               |
| Qualité            | pnpm workspaces, ESLint, Prettier, `tsc` strict, GitHub Actions                            |

## Structure

```
apps/extension   Extension Chrome (WXT + React, MV3)        — Ibrahim
apps/api         API d'orchestration (Hono, Node)            — Ibrahim
apps/web         Plateforme Next.js (profil, historique)     — Antonin & Thomas
services/tryon   Service d'essayage 2D (HTTP)                — Félix
packages/shared  Types + schémas zod partagés                — Ibrahim
```

## Prérequis

- Node **≥ 20.19** (22 LTS recommandé)
- pnpm 9 : `npm install -g pnpm@9` (ou `corepack enable`)

```bash
pnpm install
cp .env.example .env     # puis remplir les clés (vides = mocks)
```

## Lancer chaque brique

### API — `apps/api`

```bash
pnpm dev:api             # http://localhost:8787 — affiche les mocks actifs
curl http://localhost:8787/health
```

Chaque module (Bright Data, H Company, try-on, Supabase) bascule en **mock** si sa clé manque ou si
`MOCK_<BRIQUE>=true`. `MOCK_ALL=true` pour tout simuler.

### Extension — `apps/extension`

```bash
pnpm dev:ext             # lance Chrome avec l'extension en hot-reload
pnpm build:ext           # build de prod → apps/extension/.output/chrome-mv3
```

`WXT_USE_MOCK_API=true` dans `.env` → l'extension simule l'API (pas besoin de lancer `apps/api`).

**Charger le build dans Chrome :**

1. Ouvrir `chrome://extensions`
2. Activer **Mode développeur** (en haut à droite)
3. **Charger l'extension non empaquetée** → sélectionner `apps/extension/.output/chrome-mv3`
4. Aller sur pinterest.com, clic droit sur une image → « Trouver ce look avec BuyFit »
5. Après un rebuild : bouton ⟳ sur la carte de l'extension

### Web — `apps/web`

Voir [`apps/web/README.md`](apps/web/README.md).

### Essayage — `services/tryon`

Voir [`services/tryon/README.md`](services/tryon/README.md).

## Qualité

```bash
pnpm lint          # ESLint (flat config commune)
pnpm format:check  # Prettier
pnpm typecheck     # tsc --noEmit sur chaque package
```

La CI GitHub Actions lance tout ça sur chaque PR. Règles de contribution :
[`CONTRIBUTING.md`](CONTRIBUTING.md).

## Sécurité

- Aucune clé d'API dans l'extension : elle ne parle qu'à `apps/api`.
- `SUPABASE_SERVICE_ROLE_KEY`, `HAI_API_KEY`, `BRIGHTDATA_API_TOKEN` : serveur uniquement.
- Identifiants marchands : vault H Company, jamais dans Supabase.
- L'agent s'arrête **avant le paiement** ; l'utilisateur confirme explicitement l'achat.

## Licence

MIT
