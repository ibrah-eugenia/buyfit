# apps/web — Plateforme BuyFit (Next.js)

**Responsables : Antonin & Thomas.** Next.js 16 (App Router), TypeScript strict, Tailwind CSS 4,
shadcn/ui, lucide-react, react-hook-form + zod.

## Lancer

Depuis la racine du repo :

```bash
pnpm install
pnpm --filter @buyfit/web dev      # http://localhost:3000
```

Le build utilise webpack (`next build --webpack`) : le contrat `@buyfit/shared` est publié en
TypeScript source avec des imports en `.js`, que webpack résout grâce à `extensionAlias`.

## Pages

| Route         | Contenu                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`           | Landing : pitch, « Installer l'extension », « Créer mon compte »                                                                                                                           |
| `/signup`     | Email, mot de passe (règles affichées en direct), confirmation                                                                                                                             |
| `/login`      | Connexion                                                                                                                                                                                  |
| `/onboarding` | 7 étapes avec barre de progression : genre, photos (corps entier + tête de profil), silhouette, morphologie, marques, contact et livraison (+ daltonisme), comptes marchands (facultatifs) |
| `/search`     | Recherche écrite ou vocale (Web Speech API, fr-FR), % de ressemblance, taille conseillée, essayage « Sur moi », ajout au panier                                                            |
| `/checkout`   | Panier par marque, livraison à domicile ou en point relais, lancement de l'agent (il s'arrête avant le paiement)                                                                           |
| `/dashboard`  | Looks capturés, produits trouvés, essayages, commandes et leurs statuts                                                                                                                    |
| `/settings`   | Modifier tout le profil, connecter / déconnecter les comptes marchands                                                                                                                     |
| `/design`     | Système de design : logo, couleurs, typo, rayons, composants, états                                                                                                                        |

## Données

- **Tout passe par `@/lib/mocks`** (mocks typés, stockés dans le `localStorage` du navigateur),
  en attendant les fonctions de Thomas dans `lib/supabase/`. Pour brancher le vrai back-end, on
  remplace les exports de `lib/mocks/index.ts` : les pages n'importent que depuis là.
- Ajouter `?erreur=1` à n'importe quelle URL affiche les états d'erreur. Chercher « erreur » sur
  `/search` aussi.
- Types : `lib/types` étend `@buyfit/shared` avec les champs validés par l'équipe et absents du
  contrat. La proposition de changements pour Ibrahim est dans
  [`PROPOSITION-shared.md`](PROPOSITION-shared.md). `packages/shared` n'est pas modifié.
- Aucun mot de passe de compte marchand n'est saisi ni stocké par le site : seulement `vaultId`.

## Charte

Tokens dans `app/globals.css` (`bg-brand`, `bg-blush`, `bg-linen`, `text-grey`, `text-display`…),
branchés sur les variables shadcn (`primary`, `accent`, `muted`…). Logo et palette exportés pour
l'extension dans [`docs/brand/`](../../docs/brand).

## Qualité

```bash
pnpm lint && pnpm format:check && pnpm typecheck   # depuis la racine
```
