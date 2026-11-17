# Proposition de changements pour `packages/shared` (à valider par Ibrahim)

Le site web a besoin de données qui n'existent pas encore dans le contrat partagé. En attendant ta
décision, elles vivent **uniquement côté web**, dans `apps/web/lib/types` (types qui étendent ceux de
`@buyfit/shared`) et dans des mocks (`apps/web/lib/mocks`). **Rien n'a été modifié dans
`packages/shared`.**

Pour chaque point : ce qu'on propose, pourquoi, et l'impact sur les autres briques.

## 1. Profil (`UserProfile`)

| Champ proposé               | Type zod                                                                                       | Pourquoi                                            | Impact                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------- |
| `genre`                     | `z.enum(["femme", "homme", "non_precise"])`                                                    | Rayons et guides des tailles différents             | API (recherche)                             |
| `photoCorpsUrl`             | `z.url()`                                                                                      | Photo en pied pour l'essayage                       | Remplace `photos[0]` pour le try-on (Félix) |
| `photoTeteUrl`              | `z.url()`                                                                                      | Tête de profil, demandée pour l'avatar              | Try-on                                      |
| `poidsKg`                   | `z.number().positive()`                                                                        | Utilisé par les conseillers de taille des boutiques | Agent / recherche                           |
| `mensurations.entrejambeCm` | `z.number().positive().optional()`                                                             | Longueur des pantalons                              | Recherche                                   |
| `morphologie`               | `{ epaules, ventre, hanches, coupe }`, 3 choix chacun                                          | Affiner coupe et taille conseillée                  | Recherche                                   |
| `contact`                   | `{ prenom, nom, email, telephone }`                                                            | L'agent remplit la commande (surtout en invité)     | Agent H                                     |
| `adresse`                   | `{ numeroEtRue, codePostal, ville }`                                                           | Livraison à domicile, recherche de points relais    | Agent H                                     |
| `daltonisme`                | `{ actif: boolean, type?: "protanopie" \| "deuteranopie" \| "tritanopie" \| "achromatopsie" }` | Décrire les couleurs en toutes lettres              | Extension, recherche                        |

Suggestions associées :

- `budgetMax` : **le rendre optionnel**. L'équipe a décidé de ne pas le demander à l'inscription.
- `photos[]` : garder pour compatibilité, ou le remplacer par les deux champs nommés ci-dessus.
- `CompteMarchand` : rien à changer (le site n'enregistre jamais de mot de passe, seulement `vaultId`).
  Le site ajoute juste un `statut` d'affichage (`connecte` / `non_connecte`) déduit de `vaultId`.

Schémas de référence : `apps/web/lib/types/index.ts` (`WebProfileSchema`, `ContactSchema`,
`AdresseSchema`, `MorphologieSchema`, `DaltonismeSchema`, `MensurationsWebSchema`).

## 2. Commande (`OrderRequest` / `OrderStatus`)

1. **Commande en invité** : ajouter `mode: z.enum(["invite", "compte"])` à `OrderRequest`. Sans compte
   connecté chez le marchand, l'agent commande en invité avec `contact` + livraison.
2. **Livraison** : ajouter à `OrderRequest`
   ```ts
   livraison: z.discriminatedUnion("mode", [
     z.object({ mode: z.literal("domicile"), adresse: AdresseSchema }),
     z.object({ mode: z.literal("relais"), pointRelaisId: z.string(), libelle: z.string() }),
   ]);
   ```
   et un endpoint pour les points relais : `GET /relais?codePostal=&ville=` →
   `{ id, nom, adresse, distanceKm, horaires }[]`, ainsi que les frais
   (`GET /livraison/devis?marchands=` → `{ domicile: { prix, delai }, relais: { prix, delai } }`).
3. **Panier BuyFit (plusieurs articles)** : `OrderRequest` ne porte qu'un produit. Proposition :
   `articles: z.array(z.object({ productId, productUrl, taille }))`, **une commande par marchand**
   (le site regroupe déjà le panier par marque).
4. **Pas de bouton « Confirmer l'achat »** côté site : décision de l'équipe, l'agent s'arrête au
   statut `confirmation_requise` et on n'appelle pas `POST /order/:id/confirm`. Le site affiche ce
   statut comme « Prête, avant paiement ».

## 3. Recherche

1. **Recherche écrite ou vocale** (le site transcrit la voix en texte dans le navigateur) :
   `POST /search` `{ userId, texte, source: "texte" | "voix" }` → `ProductMatch[]`. Réutilisable
   avec le champ `description` que tu ajoutes à `InspirationCapture`.
2. **Taille conseillée** par le guide des tailles du marchand : ajouter à `ProductMatch`
   `tailleConseillee?: z.string()` (affichée « D'après le guide des tailles Zara : taille
   conseillée M »). Aujourd'hui le site la calcule lui-même à partir des mensurations (mock).
3. **Catégorie** du produit (`Veste`, `Pantalon`…) : `categorie?: z.string()` dans `ProductMatch`,
   pour l'affichage et les filtres.

## 4. Historique (tableau de bord)

Le schéma Supabase n'a que `profiles` et `orders`. Pour afficher l'historique, il faudrait (côté
Thomas, avec ton accord) des tables `captures` (looks capturés), `product_matches` (produits trouvés
par capture) et `tryons` (essayages avec statut `en_cours` / `pret` / `echec`).
