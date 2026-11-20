/**
 * Accès Supabase (profils, commandes). Clé service_role : côté serveur UNIQUEMENT.
 * Mode mock : stockage en mémoire + un profil de démo. Schéma SQL : apps/api/supabase/schema.sql
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  UserProfileSchema,
  type CompteMarchand,
  type OrderStatut,
  type UserProfile,
} from "@buyfit/shared";
import { config } from "../config.js";

export interface OrderRecord {
  id: string;
  userId: string;
  productId: string;
  productUrl: string;
  taille: string;
  hSessionId: string | null;
  agentViewUrl: string | null;
  statut: OrderStatut;
  confirmed: boolean;
  createdAt: string;
  updatedAt: string;
}

const DEMO_PROFILE: UserProfile = UserProfileSchema.parse({
  id: "demo-user",
  photos: ["https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=768"],
  taille: { haut: "M", bas: "38", pointure: "39" },
  mensurations: { hauteurCm: 168 },
  budgetMax: 80,
  devise: "EUR",
  marquesPreferees: ["Uniqlo", "Zara", "COS"],
  // Vault de démo partagé par tous les marchands : H choisit l'entrée d'après le domaine de la
  // page, donc un marchand sans entrée dans ce vault reste simplement non connecté.
  comptesMarchands: [
    { marchand: "Uniqlo", domaine: "uniqlo.com" },
    { marchand: "Zara", domaine: "zara.com" },
    { marchand: "Mango", domaine: "mango.com" },
    { marchand: "Bershka", domaine: "bershka.com" },
    { marchand: "COS", domaine: "cos.com" },
    { marchand: "H&M", domaine: "hm.com" },
  ].map((m) => ({
    ...m,
    ...(config.HAI_DEMO_VAULT_ID ? { vaultId: config.HAI_DEMO_VAULT_ID } : {}),
  })),
});

// ---------- mock ----------
const memProfiles = new Map<string, UserProfile>([[DEMO_PROFILE.id, DEMO_PROFILE]]);
const memOrders = new Map<string, OrderRecord>();

// ---------- real ----------
let client: SupabaseClient | null = null;
export function db(): SupabaseClient {
  client ??= createClient(config.SUPABASE_URL!, config.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return client;
}

type OrderRow = {
  id: string;
  user_id: string;
  product_id: string;
  product_url: string;
  taille: string;
  h_session_id: string | null;
  agent_view_url: string | null;
  statut: OrderStatut;
  confirmed: boolean;
  created_at: string;
  updated_at: string;
};

const fromRow = (r: OrderRow): OrderRecord => ({
  id: r.id,
  userId: r.user_id,
  productId: r.product_id,
  productUrl: r.product_url,
  taille: r.taille,
  hSessionId: r.h_session_id,
  agentViewUrl: r.agent_view_url,
  statut: r.statut,
  confirmed: r.confirmed,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toRow = (o: Partial<OrderRecord>): Partial<OrderRow> => {
  const row: Partial<OrderRow> = {};
  if (o.userId !== undefined) row.user_id = o.userId;
  if (o.productId !== undefined) row.product_id = o.productId;
  if (o.productUrl !== undefined) row.product_url = o.productUrl;
  if (o.taille !== undefined) row.taille = o.taille;
  if (o.hSessionId !== undefined) row.h_session_id = o.hSessionId;
  if (o.agentViewUrl !== undefined) row.agent_view_url = o.agentViewUrl;
  if (o.statut !== undefined) row.statut = o.statut;
  if (o.confirmed !== undefined) row.confirmed = o.confirmed;
  if (o.updatedAt !== undefined) row.updated_at = o.updatedAt;
  return row;
};

export async function getProfile(userId: string): Promise<UserProfile | null> {
  // Mock : un compte réel du site (uuid Supabase) reprend le profil de démo, sinon l'extension
  // connectée tomberait sur « Profil introuvable ».
  if (config.mocks.supabase) return memProfiles.get(userId) ?? { ...DEMO_PROFILE, id: userId };
  // Les ids Supabase sont des uuid : autre chose (ex. « demo-user ») = utilisateur inconnu.
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;
  // Profil reconstruit côté base (profiles + user_photos + merchant_accounts connectés).
  const { data, error } = await db().rpc("api_get_user_profile", { p_user_id: userId });
  if (error) throw error;
  if (!data) return null;
  const { photoPaths = [], ...rest } = data as { photoPaths?: string[] } & Record<string, unknown>;
  // Photos dans un bucket privé : URLs signées (10 min suffisent pour un essayage).
  const photos: string[] = [];
  for (const path of photoPaths.slice(0, 3)) {
    const signed = await db().storage.from("user-photos").createSignedUrl(path, 600);
    if (signed.data?.signedUrl) photos.push(signed.data.signedUrl);
  }
  return UserProfileSchema.parse({ ...rest, photos });
}

/**
 * Compte marchand relié par l'utilisateur pour le site du produit, avec son vault H
 * (identifiants rangés chez H depuis la page Réglages du site). Sans Supabase réel : profil
 * de démo (vault HAI_DEMO_VAULT_ID). `null` = aucun compte relié pour ce site.
 */
export async function findMerchantAccount(
  userId: string,
  host: string,
): Promise<CompteMarchand | null> {
  const matches = (domaine: string) => host === domaine || host.endsWith("." + domaine);
  if (config.mocks.supabase) {
    const profile = await getProfile(userId);
    return profile?.comptesMarchands.find((m) => m.vaultId && matches(m.domaine)) ?? null;
  }
  const { data, error } = await db()
    .from("merchant_accounts")
    .select("marchand, domaine, email, h_vault_id")
    .eq("user_id", userId)
    .eq("statut", "connecte")
    .not("h_vault_id", "is", null);
  if (error) throw error;
  const row = (
    data as { marchand: string; domaine: string; email: string | null; h_vault_id: string }[]
  ).find((r) => matches(r.domaine) && !r.h_vault_id.startsWith("mock-"));
  // `mock-vault-…` : compte relié pendant que le site tournait sans clé H → inutilisable.
  if (!row) return null;
  return {
    marchand: row.marchand,
    domaine: row.domaine,
    vaultId: row.h_vault_id,
    ...(row.email ? { email: row.email } : {}),
  };
}

export async function createOrder(
  o: Omit<OrderRecord, "id" | "createdAt" | "updatedAt">,
): Promise<OrderRecord> {
  const now = new Date().toISOString();
  if (config.mocks.supabase) {
    const rec: OrderRecord = { ...o, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    memOrders.set(rec.id, rec);
    return rec;
  }
  const { data, error } = await db().from("orders").insert(toRow(o)).select().single();
  if (error) throw error;
  return fromRow(data as OrderRow);
}

export async function getOrder(id: string): Promise<OrderRecord | null> {
  if (config.mocks.supabase) return memOrders.get(id) ?? null;
  const { data, error } = await db().from("orders").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as OrderRow) : null;
}

export async function updateOrder(id: string, patch: Partial<OrderRecord>): Promise<OrderRecord> {
  const updatedAt = new Date().toISOString();
  if (config.mocks.supabase) {
    const cur = memOrders.get(id);
    if (!cur) throw new Error(`commande ${id} introuvable`);
    const next = { ...cur, ...patch, updatedAt };
    memOrders.set(id, next);
    return next;
  }
  const { data, error } = await db()
    .from("orders")
    .update(toRow({ ...patch, updatedAt }))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data as OrderRow);
}
