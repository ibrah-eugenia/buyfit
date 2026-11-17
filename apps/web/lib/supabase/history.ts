"use server";
/**
 * Historique de l'utilisateur connecté : captures (+ produits trouvés), essayages, commandes.
 * Lecture seule via le RLS (ces lignes sont écrites par apps/api), sauf suppression d'une capture.
 */
import {
  CaptureViewSchema,
  OrderViewSchema,
  PRODUCT_MATCH_COLUMNS,
  toProductMatchView,
  TryonViewSchema,
  type ActionResult,
  type CaptureView,
  type OrderView,
  type TryonView,
} from "./schemas";
import { createClient } from "./server";
import { BUCKETS, signPaths } from "./storage";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface PageOptions {
  limit?: number;
  offset?: number;
}

function range({ limit = DEFAULT_LIMIT, offset = 0 }: PageOptions = {}): [number, number] {
  const l = Math.min(Math.max(1, Math.floor(limit)), MAX_LIMIT);
  const o = Math.max(0, Math.floor(offset));
  return [o, o + l - 1];
}

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

const NOT_LOGGED_IN = { ok: false, error: "Connecte-toi d'abord." } as const;

/** Captures, de la plus récente à la plus ancienne, avec leurs produits triés par pertinence. */
export async function listCaptures(page?: PageOptions): Promise<ActionResult<CaptureView[]>> {
  const { supabase, userId } = await session();
  if (!userId) return NOT_LOGGED_IN;
  const [from, to] = range(page);
  const { data, error } = await supabase
    .from("captures")
    .select(`id, image_url, pin_url, captured_at, product_matches(${PRODUCT_MATCH_COLUMNS})`)
    .order("captured_at", { ascending: false })
    .range(from, to);
  if (error) return { ok: false, error: "Impossible de charger tes captures." };

  return {
    ok: true,
    data: data.map((c) =>
      CaptureViewSchema.parse({
        id: c.id,
        imageUrl: c.image_url,
        pinUrl: c.pin_url,
        capturedAt: c.captured_at,
        produits: [...c.product_matches].sort((a, b) => a.rang - b.rang).map(toProductMatchView),
      }),
    ),
  };
}

/** Supprime une capture et, en cascade, ses produits et essayages liés. */
export async function deleteCapture(captureId: string): Promise<ActionResult<null>> {
  const { supabase, userId } = await session();
  if (!userId) return NOT_LOGGED_IN;
  const { data, error } = await supabase.from("captures").delete().eq("id", captureId).select("id");
  if (error) return { ok: false, error: "Suppression impossible." };
  if (data.length === 0) return { ok: false, error: "Capture introuvable." };
  return { ok: true, data: null };
}

/** Essayages, du plus récent au plus ancien, avec l'image résultat en URL signée (1 h). */
export async function listTryons(page?: PageOptions): Promise<ActionResult<TryonView[]>> {
  const { supabase, userId } = await session();
  if (!userId) return NOT_LOGGED_IN;
  const [from, to] = range(page);
  const { data, error } = await supabase
    .from("tryons")
    .select(
      `id, created_at, garment_image_url, result_storage_path, latency_ms, product_matches(${PRODUCT_MATCH_COLUMNS})`,
    )
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) return { ok: false, error: "Impossible de charger tes essayages." };

  const urls = await signPaths(
    supabase,
    BUCKETS.tryonResults,
    data.flatMap((t) => (t.result_storage_path ? [t.result_storage_path] : [])),
  );
  return {
    ok: true,
    data: data.map((t) =>
      TryonViewSchema.parse({
        id: t.id,
        createdAt: t.created_at,
        garmentImageUrl: t.garment_image_url,
        resultImageUrl: (t.result_storage_path && urls.get(t.result_storage_path)) ?? null,
        latencyMs: t.latency_ms,
        produit: t.product_matches ? toProductMatchView(t.product_matches) : null,
      }),
    ),
  };
}

const ORDER_COLUMNS = `id, statut, h_session_id, agent_view_url, message, confirmed, taille, product_url,
  created_at, updated_at, merchant_accounts(marchand), product_matches(${PRODUCT_MATCH_COLUMNS})`;

type OrderRow = {
  id: string;
  statut: OrderView["statut"];
  h_session_id: string | null;
  agent_view_url: string | null;
  message: string | null;
  confirmed: boolean;
  taille: string;
  product_url: string;
  created_at: string;
  updated_at: string;
  merchant_accounts: { marchand: string } | null;
  product_matches: Parameters<typeof toProductMatchView>[0] | null;
};

function toOrderView(o: OrderRow): OrderView {
  return OrderViewSchema.parse({
    orderId: o.id,
    statut: o.statut,
    h_session_id: o.h_session_id,
    ...(o.agent_view_url ? { agentViewUrl: o.agent_view_url } : {}),
    ...(o.message ? { message: o.message } : {}),
    updatedAt: o.updated_at,
    taille: o.taille,
    productUrl: o.product_url,
    confirmed: o.confirmed,
    createdAt: o.created_at,
    marchand: o.merchant_accounts?.marchand ?? null,
    produit: o.product_matches ? toProductMatchView(o.product_matches) : null,
  });
}

/** Commandes, de la plus récente à la plus ancienne. */
export async function listOrders(page?: PageOptions): Promise<ActionResult<OrderView[]>> {
  const { supabase, userId } = await session();
  if (!userId) return NOT_LOGGED_IN;
  const [from, to] = range(page);
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) return { ok: false, error: "Impossible de charger tes commandes." };
  return { ok: true, data: data.map(toOrderView) };
}

/** Une commande (null si elle n'existe pas ou n'appartient pas à l'utilisateur). */
export async function getOrder(orderId: string): Promise<ActionResult<OrderView | null>> {
  const { supabase, userId } = await session();
  if (!userId) return NOT_LOGGED_IN;
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("id", orderId)
    .maybeSingle();
  if (error) return { ok: false, error: "Impossible de charger la commande." };
  return { ok: true, data: data ? toOrderView(data) : null };
}
