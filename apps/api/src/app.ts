import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { z } from "zod";
import {
  CaptureRequestSchema,
  CaptureResponseSchema,
  IdentifiedItemSchema,
  IdentifyRequestSchema,
  SearchRequestSchema,
  SearchResponseSchema,
  SerpRequestSchema,
  SerpResponseSchema,
  OrderConfirmRequestSchema,
  OrderRequestSchema,
  OrderStatusSchema,
  TryOnApiRequestSchema,
  TryOnResultSchema,
  sizeEquivalents,
  type ApiError,
  type OrderStatus,
} from "@buyfit/shared";
import { config } from "./config.js";
import { HttpError, upstream } from "./errors.js";
import { findMatches, serpShopping } from "./modules/brightdata.js";
import {
  bankApprovedSession,
  chooseDeliverySession,
  confirmOrderSession,
  getSessionState,
  startOrderSession,
  type SessionState,
} from "./modules/hcompany.js";
import {
  createOrder,
  getOrder,
  getProfile,
  updateOrder,
  type OrderRecord,
} from "./modules/supabase.js";
import { tryOn } from "./modules/tryon.js";
import { searchStores } from "./modules/search.js";
import { identifyItem } from "./modules/vision.js";

const allowedOrigins = config.CORS_ORIGINS?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Valide le corps JSON entrant avec un schéma zod (400 sinon). */
async function body<S extends z.ZodType>(c: Context, schema: S): Promise<z.infer<S>> {
  const json: unknown = await c.req.json().catch(() => {
    throw new HttpError(400, "Corps JSON invalide");
  });
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new HttpError(400, "Requête invalide", parsed.error.issues);
  return parsed.data;
}

/** Appelle une brique en aval et convertit ses erreurs en 502. */
async function call<T>(service: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.error(`[${service}]`, err);
    throw upstream(service, err);
  }
}

async function requireProfile(userId: string) {
  const profile = await call("supabase", () => getProfile(userId));
  if (!profile) throw new HttpError(404, `Profil ${userId} introuvable`);
  return profile;
}

async function requireOrder(id: string) {
  const order = await call("supabase", () => getOrder(id));
  if (!order) throw new HttpError(404, `Commande ${id} introuvable`);
  return order;
}

const toStatus = (o: OrderRecord, message?: string, state?: SessionState): OrderStatus =>
  OrderStatusSchema.parse({
    orderId: o.id,
    statut: o.statut,
    h_session_id: o.hSessionId,
    ...(o.agentViewUrl ? { agentViewUrl: o.agentViewUrl } : {}),
    ...(message ? { message } : {}),
    // Étape de pause (livraison / paiement) : seulement pendant `confirmation_requise`.
    ...(state && o.statut === "confirmation_requise"
      ? {
          ...(state.etape ? { etape: state.etape } : {}),
          ...(state.livraisons ? { livraisons: state.livraisons } : {}),
          ...(state.total ? { total: state.total } : {}),
        }
      : {}),
    ...(state?.motif && o.statut === "echec" ? { motif: state.motif } : {}),
    updatedAt: o.updatedAt,
  });

export const app = new Hono();

app.use(logger());
app.use(
  cors({
    // Sans CORS_ORIGINS : toute extension Chrome (pratique en dev, l'ID change par machine).
    origin: (origin) =>
      allowedOrigins?.length
        ? allowedOrigins.includes(origin)
          ? origin
          : null
        : origin.startsWith("chrome-extension://")
          ? origin
          : null,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json<ApiError>({ error: err.message, details: err.details }, err.status);
  }
  console.error(err);
  return c.json<ApiError>({ error: "Erreur interne" }, 500);
});

app.notFound((c) => c.json<ApiError>({ error: "Route inconnue" }, 404));

app.get("/health", (c) => c.json({ ok: true, mocks: config.mocks }));

// POST /capture → ProductMatch[]
app.post("/capture", async (c) => {
  const req = await body(c, CaptureRequestSchema);
  const profile = await requireProfile(req.userId);
  const budgetMax = req.budgetMax ?? profile.budgetMax;
  const matches = await call("brightdata", () =>
    findMatches(req.capture, { ...profile, budgetMax }, req.requetesSecours),
  );
  return c.json(CaptureResponseSchema.parse(matches));
});

// POST /identify → IdentifiedItem (zone sélectionnée → nom de l'article, modèle HF)
app.post("/identify", async (c) => {
  const req = await body(c, IdentifyRequestSchema);
  await requireProfile(req.userId);
  const item = await call("vision", () => identifyItem(req.imageDataUrl));
  return c.json(IdentifiedItemSchema.parse(item));
});

// POST /serp → { requete, resultats } (Google Shopping brut via Bright Data SERP)
app.post("/serp", async (c) => {
  const req = await body(c, SerpRequestSchema);
  await requireProfile(req.userId);
  const res = await call("brightdata", () => serpShopping(req.requete, req.requetesSecours));
  return c.json(SerpResponseSchema.parse(res));
});

// POST /search → { resultats, filtreIA } (Zara / Mango / Uniqlo + filtre IA de similarité)
app.post("/search", async (c) => {
  const req = await body(c, SearchRequestSchema);
  await requireProfile(req.userId);
  const res = await call("search", () => searchStores(req));
  return c.json(SearchResponseSchema.parse(res));
});

// POST /tryon → TryOnResult (proxy vers services/tryon)
app.post("/tryon", async (c) => {
  const req = await body(c, TryOnApiRequestSchema);
  let userPhotoUrl = req.userPhotoUrl;
  if (!userPhotoUrl) {
    const profile = await requireProfile(req.userId);
    userPhotoUrl = profile.photos[0];
    if (!userPhotoUrl) throw new HttpError(400, "Aucune photo dans le profil");
  }
  const result = await call("tryon", () =>
    tryOn({ userPhotoUrl, garmentImageUrl: req.garmentImageUrl }),
  );
  return c.json(TryOnResultSchema.parse(result));
});

// POST /order → OrderStatus (lance l'agent H Company)
app.post("/order", async (c) => {
  const req = await body(c, OrderRequestSchema);
  const profile = await requireProfile(req.userId);
  const host = new URL(req.productUrl).hostname;
  const compte = profile.comptesMarchands.find((m) => host.endsWith(m.domaine));

  const session = await call("hcompany", () =>
    startOrderSession({
      productUrl: req.productUrl,
      taille: req.taille,
      equivalents: sizeEquivalents(req.taille, {
        ...(req.genre ? { genre: req.genre } : {}),
        ...(req.categorie ? { categorie: req.categorie } : {}),
      }),
      ...(compte ? { compte } : {}),
    }),
  );
  const order = await call("supabase", () =>
    createOrder({
      userId: req.userId,
      productId: req.productId,
      productUrl: req.productUrl,
      taille: req.taille,
      hSessionId: session.sessionId,
      agentViewUrl: session.agentViewUrl,
      statut: "en_attente",
      confirmed: false,
    }),
  );
  return c.json(toStatus(order), 202);
});

// GET /order/:id → OrderStatus (suit la session H)
app.get("/order/:id", async (c) => {
  let order = await requireOrder(c.req.param("id"));
  if (!order.hSessionId || order.statut === "commandee" || order.statut === "echec") {
    return c.json(toStatus(order));
  }
  const { hSessionId, confirmed } = order;
  const state = await call("hcompany", () => getSessionState(hSessionId, confirmed));
  if (state.statut !== order.statut) {
    order = await call("supabase", () => updateOrder(order.id, { statut: state.statut }));
  }
  return c.json(toStatus(order, state.message, state));
});

// POST /order/:id/confirm → OrderStatus
// Étape livraison : { livraison } = mode choisi → l'agent va jusqu'à la page de paiement.
// Étape paiement : feu vert explicite de l'utilisateur → l'agent valide le paiement.
app.post("/order/:id/confirm", async (c) => {
  const raw: unknown = await c.req.json().catch(() => ({}));
  const parsed = OrderConfirmRequestSchema.safeParse(raw ?? {});
  if (!parsed.success) throw new HttpError(400, "Requête invalide", parsed.error.issues);
  let order = await requireOrder(c.req.param("id"));
  if (order.statut !== "confirmation_requise" || !order.hSessionId) {
    throw new HttpError(409, `Commande en statut "${order.statut}" : rien à confirmer`);
  }
  const { hSessionId } = order;
  const state = await call("hcompany", () => getSessionState(hSessionId, order.confirmed));

  if (state.etape === "livraison") {
    const option = state.livraisons?.find((l) => l.id === parsed.data.livraison);
    if (!option) throw new HttpError(400, "Choisis un mode de livraison proposé");
    await call("hcompany", () => chooseDeliverySession(hSessionId, option));
    order = await call("supabase", () => updateOrder(order.id, { statut: "en_cours" }));
    return c.json(toStatus(order, `${option.label} choisie, l'agent continue…`));
  }

  if (state.etape === "banque") {
    await call("hcompany", () => bankApprovedSession(hSessionId));
    order = await call("supabase", () => updateOrder(order.id, { statut: "en_cours" }));
    return c.json(toStatus(order, "Vérification du paiement…"));
  }

  await call("hcompany", () => confirmOrderSession(hSessionId));
  order = await call("supabase", () =>
    updateOrder(order.id, { confirmed: true, statut: "en_cours" }),
  );
  return c.json(toStatus(order, "Validation du paiement…"));
});
