# BuyFit

**De l'inspiration Pinterest à la commande, en un clic.**
Tu captures une tenue sur Pinterest, BuyFit trouve des équivalents chez tes marques et dans ton budget,
te montre l'essayage sur ta photo, puis un agent IA passe la commande sur ton compte marchand.

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
