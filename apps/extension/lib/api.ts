/**
 * Client BuyFit. Le site transmet la session des appels photo et recherche à apps/api.
 * WXT_USE_MOCK_API=true → réponses simulées (dev sans back-end).
 */
import {
  ApiErrorSchema,
  CaptureResponseSchema,
  OrderStatusSchema,
  TryOnResultSchema,
  type CaptureRequest,
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
  account = false,
): Promise<z.infer<S>> {
  const res = await fetch(
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
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = ApiErrorSchema.safeParse(json);
    throw new Error(err.success ? err.data.error : `API HTTP ${res.status}`);
  }
  return schema.parse(json);
}

export interface BuyFitApi {
  capture(req: CaptureRequest): Promise<ProductMatch[]>;
  tryOn(req: TryOnApiRequest): Promise<TryOnResult>;
  order(req: OrderRequest): Promise<OrderStatus>;
  getOrder(orderId: string): Promise<OrderStatus>;
  confirmOrder(orderId: string): Promise<OrderStatus>;
}

const httpApi: BuyFitApi = {
  capture: async (req) => {
    // Keep unauthenticated demo capture usable; fitting always needs an account.
    const response = await fetch(new URL("/api/fitting/capture", import.meta.env.WXT_WEB_URL), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-BuyFit-Request": "fitting" },
      body: JSON.stringify(req),
    }).catch(() => null);
    if (!response || response.status === 401)
      return request("POST", "/capture", CaptureResponseSchema, req);
    const json: unknown = await response.json();
    if (!response.ok)
      throw new Error(ApiErrorSchema.safeParse(json).data?.error ?? "Recherche indisponible.");
    return CaptureResponseSchema.parse(json);
  },
  tryOn: (req) => request("POST", "/tryon", TryOnResultSchema, req, true),
  order: (req) => request("POST", "/order", OrderStatusSchema, req),
  getOrder: (id) => request("GET", `/order/${encodeURIComponent(id)}`, OrderStatusSchema),
  confirmOrder: (id) =>
    request("POST", `/order/${encodeURIComponent(id)}/confirm`, OrderStatusSchema),
};

export const api: BuyFitApi = USE_MOCK ? mockApi : httpApi;
