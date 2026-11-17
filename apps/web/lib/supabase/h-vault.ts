/**
 * Vaults H Company (SDK hai-agents) : rangement des identifiants marchands CHEZ H.
 *
 * - Un vault "internal" (hébergé par H) par utilisateur BuyFit, nommé `buyfit-user-<uuid>`.
 *   Indispensable : H choisit l'entrée à remplir d'après le domaine de la page. Avec un vault
 *   partagé, l'agent pourrait se connecter chez Zara avec le compte d'un autre utilisateur.
 * - Une entrée par marchand (urls = https://<domaine>, valeurs = email + mot de passe).
 * - L'agent ne voit jamais les valeurs : il demande `fill_secret_at` et H tape le champ.
 *
 * Mode mock (comme apps/api) : sans HAI_API_KEY, ou avec MOCK_HCOMPANY / MOCK_ALL = true,
 * on renvoie des ids factices et rien ne part chez H.
 */
import "server-only";
import { HaiAgentsClient, HaiAgentsError } from "hai-agents";

const isTrue = (v: string | undefined) => v?.toLowerCase() === "true";

export function isHCompanyMocked(): boolean {
  return (
    !process.env.HAI_API_KEY || isTrue(process.env.MOCK_HCOMPANY) || isTrue(process.env.MOCK_ALL)
  );
}

let client: HaiAgentsClient | undefined;
function hai(): HaiAgentsClient {
  client ??= new HaiAgentsClient({
    apiKey: process.env.HAI_API_KEY,
    // Optionnel : autre région ou faux serveur de test. Par défaut, la région EU du SDK.
    ...(process.env.HAI_BASE_URL ? { baseUrl: process.env.HAI_BASE_URL } : {}),
  });
  return client;
}

/** Erreur H sans le corps de la réponse (qui ne doit jamais finir dans un log ou chez le client). */
export class HCompanyError extends Error {
  constructor(
    action: string,
    readonly statusCode?: number,
  ) {
    super(`H Company : ${action} impossible${statusCode ? ` (HTTP ${statusCode})` : ""}.`);
    this.name = "HCompanyError";
  }
}

function wrap(action: string, err: unknown): HCompanyError {
  return new HCompanyError(action, err instanceof HaiAgentsError ? err.statusCode : undefined);
}

const vaultName = (userId: string) => `buyfit-user-${userId}`;

/** Renvoie le vault de l'utilisateur, en le créant au besoin. */
export async function ensureUserVault(userId: string): Promise<string> {
  if (isHCompanyMocked()) return `mock-vault-${userId}`;
  const name = vaultName(userId);
  try {
    const vault = await hai().vaults.createVault({
      name,
      providerConfig: { provider: "internal" },
    });
    return vault.id;
  } catch (err) {
    // 409 : le vault existe déjà (création concurrente, ou id perdu en base) → on le retrouve.
    if (!(err instanceof HaiAgentsError && err.statusCode === 409))
      throw wrap("création du vault", err);
  }
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const page = await hai()
      .vaults.listVaults({ limit, offset })
      .catch((err: unknown) => {
        throw wrap("lecture des vaults", err);
      });
    const found = page.vaults.find((v) => v.name === name);
    if (found) return found.id;
    if (offset + limit >= page.total) break;
  }
  throw new HCompanyError("récupération du vault existant");
}

export interface MerchantLogin {
  vaultId: string;
  /** Entrée existante à mettre à jour ; absente = création. */
  itemId?: string | null;
  domaine: string;
  email: string;
  password: string;
}

/** Crée ou remplace l'entrée du marchand dans le vault. Renvoie l'id de l'entrée. */
export async function upsertMerchantLogin(login: MerchantLogin): Promise<string> {
  if (isHCompanyMocked()) return login.itemId ?? `mock-item-${crypto.randomUUID()}`;
  const urls = [`https://${login.domaine}`]; // couvre aussi www. et les sous-domaines
  const values = { email: login.email, username: login.email, password: login.password };

  if (login.itemId) {
    try {
      const item = await hai().vaults.updateVaultItem({
        vaultId: login.vaultId,
        itemId: login.itemId,
        name: login.domaine,
        urls,
        values,
      });
      return item.id;
    } catch (err) {
      // Entrée supprimée côté H entre-temps : on la recrée.
      if (!(err instanceof HaiAgentsError && err.statusCode === 404)) {
        throw wrap("mise à jour des identifiants", err);
      }
    }
  }

  try {
    const item = await hai().vaults.createVaultItem({
      vaultId: login.vaultId,
      name: login.domaine,
      urls,
      values,
    });
    return item.id;
  } catch (err) {
    throw wrap("enregistrement des identifiants", err);
  }
}

/** Supprime l'entrée du marchand (sans erreur si elle n'existe déjà plus). */
export async function deleteMerchantLogin(vaultId: string, itemId: string): Promise<void> {
  if (isHCompanyMocked()) return;
  try {
    await hai().vaults.deleteVaultItem({ vaultId, itemId });
  } catch (err) {
    if (err instanceof HaiAgentsError && err.statusCode === 404) return;
    throw wrap("suppression des identifiants", err);
  }
}
