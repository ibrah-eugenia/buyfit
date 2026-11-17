# apps/web — Plateforme BuyFit (Next.js)

**Responsables : Antonin & Thomas.** Dossier volontairement vide : à initialiser par vos soins.

## Initialisation

Depuis la racine du repo :

```bash
pnpm dlx create-next-app@latest apps/web --ts --app --eslint --src-dir --use-pnpm --skip-install
```

Puis dans `apps/web/package.json` :

- `"name": "@buyfit/web"`
- dépendances : `"@buyfit/shared": "workspace:*"`, `"@supabase/supabase-js"`, `"zod"`
- script `"typecheck": "tsc --noEmit"` (la CI le lance sur toutes les briques)

Retirer ensuite `apps/web/**` de la liste `ignores` du `eslint.config.js` racine et faire `pnpm install`
à la racine.

## Ce que la brique doit faire

1. **Auth** : connexion Supabase (`SUPABASE_URL` + `SUPABASE_ANON_KEY` uniquement, jamais la
   service_role key côté navigateur).
2. **Profil** : création / édition d'un `UserProfile` (`packages/shared/src/user.ts`) :
   - `photos[]` : upload dans Supabase Storage (bucket `user-photos`), photos plein pied utilisées
     par l'essayage ;
   - `taille`, `mensurations`, `budgetMax`, `devise`, `marquesPreferees[]` ;
   - `comptesMarchands[]` : marchand + domaine + email. **Aucun mot de passe** stocké chez nous :
     les identifiants vont dans un vault H Company (`vaultId`), à voir avec Ibrahim.
3. **Historique** : liste des commandes (`OrderStatus`, table `orders`) avec le lien `agentViewUrl`
   pour revoir ce qu'a fait l'agent.

Valider chaque formulaire avec les schémas zod partagés :

```ts
import { UserProfileSchema, type UserProfile } from "@buyfit/shared";
const profile = UserProfileSchema.parse(formData);
```

## Données

Tables `profiles` et `orders` : voir [`apps/api/supabase/schema.sql`](../api/supabase/schema.sql).
Colonnes en snake_case côté SQL, champs camelCase côté TS (mapping dans
`apps/api/src/modules/supabase.ts`). Toute évolution du schéma passe par Ibrahim.
