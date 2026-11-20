/**
 * Accès Supabase (profils, commandes). Clé service_role : côté serveur UNIQUEMENT.
 * Mode mock : stockage en mémoire + un profil de démo. Schéma SQL : apps/api/supabase/schema.sql
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { UserProfileSchema, type OrderStatut, type UserProfile } from "@buyfit/shared";
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
  comptesMarchands: [
    {
      marchand: "Uniqlo",
      domaine: "uniqlo.com",
      ...(config.HAI_DEMO_VAULT_ID ? { vaultId: config.HAI_DEMO_VAULT_ID } : {}),
    },
  ],
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
  const { data, error } = await db().from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return UserProfileSchema.parse({
    id: data.id,
    photos: data.photos,
    taille: data.taille,
    mensurations: data.mensurations,
    budgetMax: data.budget_max,
    devise: data.devise,
    marquesPreferees: data.marques_preferees,
    comptesMarchands: data.comptes_marchands,
  });
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
