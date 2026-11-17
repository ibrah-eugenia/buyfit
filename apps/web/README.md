# apps/web — Plateforme BuyFit (Next.js)

**Responsables : Antonin & Thomas.**

## État actuel

Le package `@buyfit/web` existe déjà (Thomas) avec la couche données dans `lib/supabase/`
(auth, profil, photos, historique, comptes marchands). `package.json` et `tsconfig.json` sont
volontairement minimaux, sans pages, pour que `pnpm typecheck` et `pnpm lint` vérifient ce code.
Mode d'emploi des fonctions : [`docs/data-access.md`](../../docs/data-access.md).

## Ajouter Next.js (Antonin)

`create-next-app` refuse un dossier qui contient déjà un `package.json` : ne pas le lancer ici.
Les dépendances (`next`, `react`, `react-dom`, Supabase, zod) sont déjà installées. Il suffit de :

1. ajouter dans `package.json` les scripts `"dev": "next dev"`, `"build": "next build"`,
   `"start": "next start"` ;
2. créer `app/layout.tsx`, `app/page.tsx` et `next.config.ts` à la racine de `apps/web`
   (pas de `src/` : le code est importé en `@/lib/supabase/...`) ;
3. brancher l'auth en 2 fichiers, voir [`docs/auth-extension.md`](../../docs/auth-extension.md) :
   `app/auth/callback/route.ts` et `proxy.ts` ;
4. copier les variables `NEXT_PUBLIC_SUPABASE_*` (voir `.env.example`) dans `apps/web/.env.local`.

Alternative : lancer `create-next-app` dans un dossier temporaire et recopier `app/`,
`next.config.ts` et les réglages utiles de son `tsconfig.json`.

## Ce que la brique doit faire

1. **Auth** : email + mot de passe, Google, et liaison de l'extension (`lib/supabase/auth.ts`,
   `extension-bridge.ts`). Jamais la service_role key côté navigateur.
2. **Profil** : `getProfile` / `upsertProfile`, photos avec `uploadUserPhoto` (bucket privé
   `user-photos`, photos plein pied pour l'essayage).
3. **Comptes marchands** : `connectMerchantAccount` envoie les identifiants dans un vault H Company.
   **Aucun mot de passe** stocké chez nous ([`docs/comptes-marchands.md`](../../docs/comptes-marchands.md)).
4. **Historique** : `listCaptures`, `listTryons`, `listOrders` (avec `agentViewUrl` pour revoir ce
   qu'a fait l'agent).

Toutes les entrées et sorties sont validées avec zod, sur les schémas de `@buyfit/shared`.

## Données

Schéma : [`supabase/migrations/`](../../supabase/migrations) (snake_case en base, camelCase côté TS,
conversion dans `lib/supabase/schemas.ts`). Après une migration, régénérer
`lib/supabase/database.types.ts` (voir `docs/data-access.md`).
