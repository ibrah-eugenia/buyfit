/**
 * Client BuyFit. Le site transmet la session des appels photo et recherche à apps/api.
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
import { webFetch } from "./web-fetch";

const BASE_URL = import.meta.env.WXT_API_URL;
export const USE_MOCK = import.meta.env.WXT_USE_MOCK_API;

async function request<S extends z.ZodType>(
  method: "GET" | "POST",
  path: string,
  schema: S,
  body?: unknown,
  account = false,
): Promise<z.infer<S>> {
  if (account) {
    // Compte : via le service worker, qui a les cookies du site (voir web-fetch.ts).
    const res = await webFetch("/api/fitting" + path, method as "GET" | "POST", body);
    if (res.status === 401) throw new Error("Connecte-toi à BuyFit (bouton en haut du panneau).");
    if (res.status < 200 || res.status >= 300) {
      const err = ApiErrorSchema.safeParse(res.json);
      throw new Error(err.success ? err.data.error : `HTTP ${res.status}`);
    }
    return schema.parse(res.json);
  }
  let res: Response;
  try {
    res = await fetch(
      new URL(
        account ? "/api/fitting" + path : path,
        account ? import.meta.env.WXT_WEB_URL : BASE_URL,
      ),
      {
        method,
        credentials: account ? "include" : "omit",
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(account ? { "X-BuyFit-Request": "fitting" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
  } catch {
    // Pas de réponse du tout (« Failed to fetch ») : serveur éteint ou URL injoignable.
    throw new Error("Serveur BuyFit injoignable. Vérifie que l'API est lancée, puis réessaie.");
  }
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
  /** POST /search : Zara / Uniqlo en parallèle + filtre IA de similarité. */
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
  capture: async (req) => {
    // Keep unauthenticated demo capture usable; fitting always needs an account.
    const response = await webFetch("/api/fitting/capture", "POST", req).catch(() => null);
    if (!response || response.status === 401)
      return request("POST", "/capture", CaptureResponseSchema, req);
    if (response.status < 200 || response.status >= 300)
      throw new Error(
        ApiErrorSchema.safeParse(response.json).data?.error ?? "Recherche indisponible.",
      );
    return CaptureResponseSchema.parse(response.json);
  },
  tryOn: (req) => request("POST", "/tryon", TryOnResultSchema, req, true),
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
