import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { z } from "zod";
import {
  CaptureRequestSchema,
  CaptureResponseSchema,
  OrderRequestSchema,
  OrderStatusSchema,
  TryOnApiRequestSchema,
  TryOnResultSchema,
  UserProfileSchema,
  type ApiError,
  type OrderStatus,
} from "@buyfit/shared";
import { config } from "./config.js";
import { HttpError, upstream } from "./errors.js";
import { findMatches } from "./modules/brightdata.js";
import { confirmOrderSession, getSessionState, startOrderSession } from "./modules/hcompany.js";
import {
  createOrder,
  getOrder,
  getProfile,
  updateOrder,
  type OrderRecord,
} from "./modules/supabase.js";
import {
  accountTryOn,
  checkPhoto,
  fittingUser,
  MAX_IMAGE,
  modelImage,
} from "./modules/account-fitting.js";
import { db } from "./modules/supabase.js";
import { tryOn } from "./modules/tryon.js";

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

const toStatus = (o: OrderRecord, message?: string): OrderStatus =>
  OrderStatusSchema.parse({
    orderId: o.id,
    statut: o.statut,
    h_session_id: o.hSessionId,
    ...(o.agentViewUrl ? { agentViewUrl: o.agentViewUrl } : {}),
    ...(message ? { message } : {}),
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
    allowHeaders: ["Content-Type", "Authorization"],
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
  let profile;
  if (c.req.header("Authorization")) {
    const userId = await fittingUser(c.req.header("Authorization"));
    const { data, error } = await db().rpc("api_get_user_profile", { p_user_id: userId });
    if (error || !data) throw new HttpError(404, "Profil BuyFit introuvable.");
    profile = UserProfileSchema.parse({ ...data, photos: [] });
  } else {
    profile = await requireProfile(req.userId);
  }
  const matches = await call("brightdata", () => findMatches(req.capture, profile));
  return c.json(CaptureResponseSchema.parse(matches));
});

const fittingLimit = bodyLimit({
  maxSize: MAX_IMAGE + 65536,
  onError: (c) => c.json({ error: "La photo dépasse 8 Mo." }, 413),
});

app.post("/avatar", fittingLimit, async (c) => {
  await fittingUser(c.req.header("Authorization"));
  const input = await c.req.formData().catch(() => {
    throw new HttpError(400, "Photo manquante.");
  });
  const form = new FormData();
  form.set("person", checkPhoto(input.get("person")), "person");
  const image = await modelImage("/avatar", form);
  return new Response(image, {
    headers: { "Content-Type": image.type, "Cache-Control": "private, no-store" },
  });
});

// POST /tryon → TryOnResult (proxy vers services/tryon)
app.post("/tryon", fittingLimit, async (c) => {
  const auth = c.req.header("Authorization");
  if (auth || !config.mocks.supabase) {
    const userId = await fittingUser(auth);
    if (c.req.header("Content-Type")?.startsWith("multipart/form-data")) {
      const form = await c.req.formData().catch(() => {
        throw new HttpError(400, "Vêtement manquant.");
      });
      return c.json(await accountTryOn(userId, checkPhoto(form.get("garment"))));
    }
    const req = await body(c, TryOnApiRequestSchema.omit({ userId: true }));
    if (!req.userPhotoUrl) return c.json(await accountTryOn(userId, req.garmentImageUrl));
    return c.json(
      await tryOn({ userPhotoUrl: req.userPhotoUrl, garmentImageUrl: req.garmentImageUrl }),
    );
  }
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
  return c.json(toStatus(order, state.message));
});

// POST /order/:id/confirm → OrderStatus (feu vert explicite de l'utilisateur avant paiement)
app.post("/order/:id/confirm", async (c) => {
  let order = await requireOrder(c.req.param("id"));
  if (order.statut !== "confirmation_requise" || !order.hSessionId) {
    throw new HttpError(409, `Commande en statut "${order.statut}" : rien à confirmer`);
  }
  const { hSessionId } = order;
  await call("hcompany", () => confirmOrderSession(hSessionId));
  order = await call("supabase", () =>
    updateOrder(order.id, { confirmed: true, statut: "en_cours" }),
  );
  return c.json(toStatus(order, "Validation du paiement…"));
});
