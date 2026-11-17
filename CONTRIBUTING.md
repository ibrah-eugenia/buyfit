# Contribuer à BuyFit

## Équipe et périmètres

| Brique              | Dossier           | Responsable      |
| ------------------- | ----------------- | ---------------- |
| Extension Chrome    | `apps/extension`  | Ibrahim          |
| API d'orchestration | `apps/api`        | Ibrahim          |
| Contrat partagé     | `packages/shared` | Ibrahim          |
| Plateforme web      | `apps/web`        | Antonin & Thomas |
| Essayage virtuel    | `services/tryon`  | Félix            |

## Branches

- `main` : version de démo, toujours stable. Mise à jour uniquement par PR `dev` → `main` (Ibrahim).
- `dev` : branche d'intégration et **branche par défaut**.
- `ibrahim`, `felix`, `antonin`, `thomas` : une branche de travail par personne, créée depuis `dev`.
  Pour une fonctionnalité plus grosse, créer `prenom/nom-feature` depuis `dev`.

**On ne pousse jamais directement sur `main` ni sur `dev`.** Tout passe par une Pull Request vers `dev`.

Rester à jour avec `dev` régulièrement :

```bash
git checkout ibrahim
git fetch origin
git rebase origin/dev   # ou git merge origin/dev
```

## Commits

Convention [Conventional Commits](https://www.conventionalcommits.org/fr/) :

- `feat: ajoute le bouton Acheter dans le side panel`
- `fix: corrige l'URL grand format des images Pinterest`
- `chore: met à jour les dépendances`
- aussi : `docs:`, `refactor:`, `test:`, `ci:`

Scope optionnel : `feat(api): …`, `fix(extension): …`, `feat(web): …`, `feat(tryon): …`.

## Pull Requests

1. PR de votre branche vers `dev`, titre au format commit (`feat(web): page profil`).
2. La CI doit être verte : `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, build de l'extension.
3. **1 review minimum** d'un autre membre avant merge.
4. Merge en _squash_ ; supprimer les branches de feature après merge (pas les branches perso).
5. Petites PR, souvent : plus facile à relire, moins de conflits.

> Protection GitHub : si `main` et `dev` ne peuvent pas être protégées automatiquement (repo privé
> sur un plan GitHub Free), ces règles s'appliquent **par convention** : personne ne pousse sur
> `main`/`dev`, personne ne merge sa propre PR sans review.

## Contrat partagé

**On ne modifie `packages/shared` qu'avec l'accord d'Ibrahim.** C'est le contrat entre les briques :
un changement de schéma casse potentiellement l'extension, l'API, le web et l'essayage. Proposer le
changement dans une PR dédiée et prévenir l'équipe.

## Avant de pousser

```bash
pnpm lint
pnpm format     # corrige le formatage
pnpm typecheck
```

## Secrets

- Jamais de clé dans le code ni dans l'extension. Tout passe par `.env` (non commité) côté serveur.
- `.env.example` liste les variables : le mettre à jour quand vous en ajoutez une.
- Aucun mot de passe de compte marchand ne transite par nos bases : vault H Company uniquement.
