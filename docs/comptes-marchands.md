# Comptes marchands (vault H Company)

Comment un utilisateur relie son compte Zara une fois, pour que l'agent H Company puisse ensuite
acheter en son nom, **sans qu'aucun mot de passe ne soit stocké chez nous**.

## Le choix : vault plutôt que browser profile

| Critère                    | Vault H (retenu)                                                   | Browser profile                                                                     |
| -------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Rien de sensible chez nous | ✅ identifiants chez H ; on garde `h_vault_id` + `h_vault_item_id` | ✅ cookies chez H                                                                   |
| Simple pour l'utilisateur  | ✅ email + mot de passe saisis une fois sur la plateforme          | ❌ profil par défaut = 1 par compte H (partagé), sinon upload d'un zip Chrome Linux |
| Faisable en 2 jours        | ✅ déjà utilisé par l'API (`vault_id` en override)                 | ❌ pas de création de profil nommé depuis une session                               |
| Double authentification    | ⚠️ TOTP géré ; codes email/SMS = `otpTool` à brancher              | ✅ session déjà ouverte                                                             |

L'agent ne voit jamais le mot de passe : sur la page de connexion, il demande `fill_secret_at` et
c'est H qui tape la valeur.

## Le flux

```
 Plateforme (page d'Antonin)          apps/web (server action)                 H Company            Supabase
 ──────────────────────────           ────────────────────────                 ─────────            ────────
 formulaire Zara : email + mdp ──▶ connectMerchantAccount()
                                      1. utilisateur connecté ? (getUser)
                                      2. ligne merchant_accounts (en_attente) ───────────────────────▶ upsert
                                      3. vault de l'utilisateur ───────────▶ createVault
                                         (buyfit-user-<uuid>, créé 1 fois)    (409 → listVaults)
                                      4. entrée zara.com ──────────────────▶ createVaultItem / updateVaultItem
                                         { email, username, password }
                                      5. mot de passe oublié (fin de la fonction)
                                      6. statut connecte + références ───────────────────────────────▶ update
 ◀──── MerchantAccountView (aucun id H, aucun secret)

 Commande (apps/api) : compte = merchant_accounts où user_id = <token> et domaine = domaine du produit
                       et statut = 'connecte' → overrides["agent.environments[kind=web].vault_id"] = h_vault_id
```

**Un vault par utilisateur, obligatoire** : H choisit l'entrée à remplir d'après le domaine de la page
(et, à égalité, la plus récente). Avec un vault partagé entre utilisateurs, l'agent pourrait se
connecter chez Zara avec le compte de quelqu'un d'autre.

## Côté plateforme (fait)

`apps/web/lib/supabase/` :

| Fichier                       | Rôle                                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| `merchant-accounts.ts`        | server actions `listMerchantAccounts`, `connectMerchantAccount`, `disconnectMerchantAccount` |
| `merchant-accounts.schema.ts` | `SUPPORTED_MERCHANTS`, `ConnectMerchantInputSchema`, `MerchantAccountView`                   |
| `h-vault.ts`                  | appels au SDK `hai-agents` (serveur uniquement), mode mock                                   |

Pour Antonin, dans un composant client :

```tsx
import { connectMerchantAccount } from "@/lib/supabase/merchant-accounts";
import { SUPPORTED_MERCHANTS } from "@/lib/supabase/merchant-accounts.schema";

const r = await connectMerchantAccount({ domaine: "zara.com", email, password });
if (!r.ok) setError(r.error);
else setAccount(r.data); // { marchand, domaine, email, statut, utilisable, … }
```

Toutes les fonctions renvoient `{ ok: true, data } | { ok: false, error }`, avec un message en
français prêt à afficher. Après l'envoi, vider le champ mot de passe du formulaire.

## Garanties

- **Base** : aucune colonne mot de passe. `merchant_accounts` ne garde que `h_vault_id` et
  `h_vault_item_id`, des identifiants qui ne donnent accès à rien sans notre clé H.
- **RLS** : l'utilisateur peut déclarer ou supprimer un compte, mais **ne peut pas** écrire
  `statut`, `auth_kind`, `h_vault_id` ni `h_vault_item_id` (droits par colonne). Sinon il pourrait
  pointer vers le vault d'un autre. Testé dans `supabase/tests/rls_isolation.sql`.
- **Transit** : le mot de passe ne fait que traverser la server action, en mémoire. Il n'est jamais
  écrit en base, jamais loggé, jamais renvoyé au navigateur. Les erreurs H sont réduites à
  « action + code HTTP », sans le corps de la réponse.
- **Liste fermée** de marchands (`SUPPORTED_MERCHANTS`) : pas d'identifiants pour un domaine arbitraire.
- **Clé H** (`HAI_API_KEY`) : serveur uniquement, jamais en `NEXT_PUBLIC_`.

## Mode mock

Sans `HAI_API_KEY` (ou avec `MOCK_HCOMPANY=true` / `MOCK_ALL=true`), rien ne part chez H : les ids
sont factices (`mock-vault-…`, `mock-item-…`) et le compte passe quand même en `connecte`. Antonin
peut développer ses pages sans clé.

⚠️ L'API doit utiliser le **même** mode : un id `mock-vault-…` envoyé à la vraie API H échouera.

## À faire côté API (Ibrahim)

1. `/order` : lire le compte dans `merchant_accounts` (user_id du token, domaine du produit,
   `statut = 'connecte'`) au lieu de `profile.comptesMarchands` / `HAI_DEMO_VAULT_ID`, puis passer
   `h_vault_id` en override comme aujourd'hui. Renseigner `orders.merchant_account_id`.
2. Si aucun compte relié : répondre `409` « Relie ton compte <marchand> sur BuyFit » au lieu de
   lancer l'agent.
3. Codes de vérification par email : si Zara en demande un depuis le navigateur cloud, brancher
   `otpTool` (le handler peut demander le code à l'utilisateur via l'extension).
4. Vérifier avec H que la clé d'override `agent.environments[kind=web].vault_id` est bien prise en
   charge : elle n'est pas documentée sur le hub, même si elle fonctionne déjà dans `hcompany.ts`.

## Limites connues

- `connecte` veut dire « identifiants enregistrés », pas « connexion testée ». Un bouton « tester
  la connexion » (courte session agent) pourrait suivre.
- La doc H ne donne pas de limite au nombre de vaults par organisation. À confirmer avec H si on
  dépasse la démo.
