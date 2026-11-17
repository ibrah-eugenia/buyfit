# Authentification de l'extension

> **Statut : proposition, à valider avec Ibrahim.** Le côté plateforme est codé (`apps/web/lib/supabase/`).
> Les côtés extension et API ci-dessous sont des propositions de code, à intégrer par Ibrahim.

## Le problème

L'extension doit appeler `apps/api` au nom de l'utilisateur, alors qu'aujourd'hui elle envoie
`userId: "demo-user"` en dur. Deux contraintes :

1. **Aucune clé dans l'extension** (règle du README), même pas la clé anon Supabase.
2. L'API doit savoir **qui** appelle sans faire confiance au `userId` envoyé dans le corps :
   n'importe qui pourrait mettre l'id d'un autre utilisateur et commander avec ses comptes marchands.

## Le flux retenu

L'utilisateur se connecte **sur la plateforme** (email + mot de passe, ou Google), puis relie
l'extension en un clic. L'extension reçoit **sa propre session Supabase** et l'envoie à l'API à chaque appel.

```
 Plateforme (Next.js)                Extension                         apps/api              Supabase Auth
 ───────────────────                 ─────────                         ────────              ─────────────
 1. connexion (cookies)
 2. /extension/connect
    connectExtension()
      ├─ server action ──────────────────────────────────────────────────────────────────▶ generateLink (service_role)
      │  createExtensionSession()                                                          verifyOtp → NOUVELLE session
      │  ◀──────────────── { accessToken, refreshToken, expiresAt, userId, email } ────────
      └─ window.postMessage ─▶ content script (même origine)
                                └─ runtime.sendMessage ─▶ background
                                                          chrome.storage.local
      ◀── buyfit:ack ─────────────┘
 3. capture / essayage / commande :
                                     Authorization: Bearer <accessToken> ──▶ auth.getUser(token)
                                                                             userId = user.id
 4. token expiré (1 h) :
                                     POST /auth/refresh { refreshToken } ──▶ refreshSession ──▶ nouvelle paire
 5. déconnexion du site : signOut({ scope: "global" }) révoque aussi la session de l'extension
```

### Pourquoi une session à part, et pas les cookies du site ?

Supabase **fait tourner les refresh tokens** (`enable_refresh_token_rotation = true`) : chaque
refresh invalide l'ancien token. Si le site et l'extension partageaient la même session, le premier
qui rafraîchit casserait l'autre, et la détection de réutilisation pourrait déconnecter les deux.
`createExtensionSession()` crée donc une session distincte (lien magique généré et vérifié côté
serveur, aucun email envoyé). Bonus : on peut déconnecter l'extension sans toucher au site.

### Pourquoi un content script plutôt que `externally_connectable` ?

`externally_connectable` demande un ID d'extension stable (clé `key` dans le manifest), alors qu'en
dev l'ID change avec le dossier chargé. Le content script n'a besoin que de l'URL de la plateforme.
Garde-fous : la page ne poste que vers sa propre origine, et le content script vérifie
`event.source === window`, l'origine et le schéma zod. Le background vérifie aussi `sender.url`.

### Pourquoi le refresh passe par l'API ?

Rafraîchir directement auprès de Supabase demanderait la clé anon dans l'extension. Elle est
publique par nature (protégée par le RLS), mais la règle du README est « aucune clé dans
l'extension » : l'API s'en charge donc avec `POST /auth/refresh`.

## Côté plateforme (fait, `apps/web/lib/supabase/`)

| Fichier                 | Rôle                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `auth.ts`               | `signUpWithPassword`, `signInWithPassword`, `signInWithGoogle`, `signOut`           |
| `auth-callback.ts`      | `GET` du retour Google / confirmation email → `app/auth/callback/route.ts`          |
| `proxy.ts`              | `updateSession()` : rafraîchit les cookies, redirige vers `/login` si page protégée |
| `extension-session.ts`  | server action `createExtensionSession()` (service_role, serveur uniquement)         |
| `extension-bridge.ts`   | `getExtensionStatus()`, `connectExtension()`, `disconnectExtension()`               |
| `extension-protocol.ts` | schémas zod des messages page ↔ extension (**à déplacer dans `packages/shared`**)   |

À brancher par Antonin (3 lignes, pas de logique) :

```ts
// apps/web/app/auth/callback/route.ts
export { GET } from "@/lib/supabase/auth-callback";

// apps/web/proxy.ts (Next 16, ex-middleware.ts)
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
export const proxy = (request: NextRequest) =>
  updateSession(request, { protectedPaths: ["/profil", "/historique", "/extension"] });
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

Page `/extension/connect` : un bouton « Relier l'extension » qui appelle `connectExtension()` et
affiche le résultat (`connected` / `not_installed` / `error`).

## Protocole page ↔ extension

Messages `window.postMessage(message, window.location.origin)`, schémas dans `extension-protocol.ts` :

| Sens             | `type`           | Contenu                                                              |
| ---------------- | ---------------- | -------------------------------------------------------------------- |
| page → extension | `buyfit:ping`    | `{ source: "buyfit-web", nonce }`                                    |
| page → extension | `buyfit:session` | `{ source: "buyfit-web", nonce, session: ExtensionSession }`         |
| page → extension | `buyfit:logout`  | `{ source: "buyfit-web", nonce }`                                    |
| extension → page | `buyfit:ack`     | `{ source: "buyfit-extension", nonce, ok, connectedEmail?, error? }` |

`ExtensionSession = { accessToken, refreshToken, expiresAt (s epoch), userId (uuid), email | null }`.

## Côté extension (proposition pour Ibrahim)

1. `.env` : `WEB_URL=http://localhost:3000`, et un nouveau content script limité à la plateforme.

```ts
// apps/extension/entrypoints/buyfit-web.content.ts
import { WebToExtensionMessageSchema } from "@buyfit/shared"; // après déplacement du protocole
import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";

export default defineContentScript({
  matches: [`${import.meta.env.WXT_WEB_URL}/extension/*`, `${import.meta.env.WXT_WEB_URL}/`],
  main() {
    window.addEventListener("message", async (event) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const msg = WebToExtensionMessageSchema.safeParse(event.data);
      if (!msg.success) return;
      const ack = await browser.runtime.sendMessage(msg.data); // traité par le background
      window.postMessage(
        { source: "buyfit-extension", type: "buyfit:ack", nonce: msg.data.nonce, ...ack },
        window.location.origin,
      );
    });
  },
});
```

2. Background : stocker / oublier la session.

```ts
// dans defineBackground(() => { … })
const AUTH_KEY = "buyfit:auth";
browser.runtime.onMessage.addListener((raw, sender) => {
  if (!sender.url?.startsWith(import.meta.env.WXT_WEB_URL)) return; // uniquement la plateforme
  const msg = WebToExtensionMessageSchema.safeParse(raw);
  if (!msg.success) return;
  return (async () => {
    if (msg.data.type === "buyfit:session") {
      await browser.storage.local.set({ [AUTH_KEY]: msg.data.session });
    } else if (msg.data.type === "buyfit:logout") {
      await logout(); // POST /auth/logout puis storage.local.remove(AUTH_KEY)
    }
    const { [AUTH_KEY]: s } = await browser.storage.local.get(AUTH_KEY);
    return { ok: true, connectedEmail: s?.email ?? null };
  })();
});
```

3. `lib/api.ts` : ajouter `Authorization: Bearer <accessToken>` à chaque requête. Avant l'appel, si
   `expiresAt - 60 < now`, appeler `POST /auth/refresh` et stocker la nouvelle session. Sur un `401`,
   effacer la session et proposer « Se connecter » (ouvre `${WEB_URL}/extension/connect`).
   Le `userId` du corps devient inutile.

## Côté API (proposition pour Ibrahim)

```ts
// Middleware Hono : userId = utilisateur du token, jamais celui du corps.
app.use("/capture", "/tryon", "/order", "/order/*", async (c, next) => {
  if (config.mocks.supabase) {
    c.set("userId", DEMO_USER_ID);
    return next();
  }
  const token = c.req.header("Authorization")?.replace(/^Bearer /, "");
  if (!token) throw new HttpError(401, "Non connecté");
  const { data, error } = await db().auth.getUser(token); // vérifié par Supabase Auth
  if (error || !data.user) throw new HttpError(401, "Session invalide ou expirée");
  c.set("userId", data.user.id);
  return next();
});

// POST /auth/refresh { refreshToken } → ExtensionSession
const { data, error } = await statelessClient().auth.refreshSession({
  refresh_token: refreshToken,
});

// POST /auth/logout (Bearer) → révoque UNIQUEMENT la session de l'extension
await db().auth.admin.signOut(token, "local");
```

Autres points côté API :

- CORS : autoriser l'en-tête `Authorization`.
- `GET /order/:id` et `POST /order/:id/confirm` : vérifier que `order.user_id === userId` (sinon 404),
  car la clé service_role contourne le RLS.
- Mode mock (`MOCK_SUPABASE`) : pas de token, utilisateur de démo. En base réelle, l'utilisateur de
  démo du seed a l'id `a0000000-0000-4000-8000-000000000001`.

## Changements de contrat proposés (`packages/shared`, accord d'Ibrahim requis)

1. Déplacer `ExtensionSessionSchema`, `WebToExtensionMessageSchema` et `ExtensionAckSchema` dans `packages/shared`.
2. `userId` devient optionnel puis disparaît de `CaptureRequest`, `TryOnApiRequest` et `OrderRequest`
   (déduit du token).
3. `api-contract.md` : en-tête `Authorization: Bearer` obligatoire hors mock, réponse `401`, nouveaux
   endpoints `POST /auth/refresh` et `POST /auth/logout`.

## Variables d'environnement

| Variable                                              | Où                           | Rôle                                      |
| ----------------------------------------------------- | ---------------------------- | ----------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                            | apps/web                     | URL Supabase (publique)                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                       | apps/web                     | clé anon (publique, protégée par le RLS)  |
| `SUPABASE_SERVICE_ROLE_KEY`                           | apps/web (serveur), apps/api | `createExtensionSession`, API             |
| `WEB_URL`                                             | apps/extension               | origine de la plateforme (content script) |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET` | supabase/.env                | Google (optionnel, voir `config.toml`)    |
