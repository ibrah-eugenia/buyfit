/**
 * Client de apps/api. L'extension ne parle QU'À apps/api : aucune clé tierce ici.
 * WXT_USE_MOCK_API=true → réponses simulées (dev sans back-end).
 */
import {
  ApiErrorSchema,
  CaptureResponseSchema,
  IdentifiedItemSchema,
  SerpResponseSchema,
  SearchResponseSchema,
  type SearchRequest,
  type SearchResponse,
  OrderStatusSchema,
  TryOnResultSchema,
  type CaptureRequest,
  type IdentifiedItem,
  type IdentifyRequest,
  type SerpRequest,
  type SerpResponse,
  type OrderRequest,
  type OrderStatus,
  type ProductMatch,
  type TryOnApiRequest,
  type TryOnResult,
} from "@buyfit/shared";
import type { z } from "zod";
import { mockApi } from "./mock-api";

const BASE_URL = import.meta.env.WXT_API_URL;
export const USE_MOCK = import.meta.env.WXT_USE_MOCK_API;

async function request<S extends z.ZodType>(
  method: "GET" | "POST",
  path: string,
  schema: S,
  body?: unknown,
): Promise<z.infer<S>> {
  const res = await fetch(new URL(path, BASE_URL), {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = ApiErrorSchema.safeParse(json);
    throw new Error(err.success ? err.data.error : `API HTTP ${res.status}`);
  }
  return schema.parse(json);
}

export interface BuyFitApi {
  /** POST /identify : zone sélectionnée → nom de l'article (modèle de vision HF). */
  identify(req: IdentifyRequest): Promise<IdentifiedItem>;
  /** POST /serp : Google Shopping brut via Bright Data SERP pour les mots-clés. */
  serp(req: SerpRequest): Promise<SerpResponse>;
  /** POST /search : Zara / Mango / Uniqlo en parallèle + filtre IA de similarité. */
  search(req: SearchRequest): Promise<SearchResponse>;
  capture(req: CaptureRequest): Promise<ProductMatch[]>;
  tryOn(req: TryOnApiRequest): Promise<TryOnResult>;
  order(req: OrderRequest): Promise<OrderStatus>;
  getOrder(orderId: string): Promise<OrderStatus>;
  /** Étape livraison : `livraison` = id du mode choisi. Étape paiement : sans argument. */
  confirmOrder(orderId: string, livraison?: string): Promise<OrderStatus>;
}

const httpApi: BuyFitApi = {
  identify: (req) => request("POST", "/identify", IdentifiedItemSchema, req),
  serp: (req) => request("POST", "/serp", SerpResponseSchema, req),
  search: (req) => request("POST", "/search", SearchResponseSchema, req),
  capture: (req) => request("POST", "/capture", CaptureResponseSchema, req),
  tryOn: (req) => request("POST", "/tryon", TryOnResultSchema, req),
  order: (req) => request("POST", "/order", OrderStatusSchema, req),
  getOrder: (id) => request("GET", `/order/${encodeURIComponent(id)}`, OrderStatusSchema),
  confirmOrder: (id, livraison) =>
    request(
      "POST",
      `/order/${encodeURIComponent(id)}/confirm`,
      OrderStatusSchema,
      livraison ? { livraison } : {},
    ),
};

export const api: BuyFitApi = USE_MOCK ? mockApi : httpApi;
