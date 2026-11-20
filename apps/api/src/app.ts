import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
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
  UserProfileSchema,
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
  findMerchantAccount,
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
import { searchStores } from "./modules/search.js";
import { identifyItem } from "./modules/vision.js";
import { bodyOf } from "./modules/body.js";

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

/**
 * Corps d'une requête faite soit par l'extension (userId dans le corps), soit par le site via
 * /api/fitting (jeton Supabase transmis) : l'utilisateur vient alors du jeton, pas du corps.
 */
async function accountBody<S extends z.ZodType<{ userId: string }>>(
  c: Context,
  schema: S,
): Promise<z.infer<S>> {
  const auth = c.req.header("Authorization");
  if (!auth) {
    const req = await body(c, schema);
    await requireProfile(req.userId);
    return req;
  }
  // Sans Supabase côté serveur (dev), le jeton ne peut pas être vérifié : profil de démo.
  const userId = config.mocks.supabase ? "demo-user" : await fittingUser(auth);
  const json: unknown = await c.req.json().catch(() => {
    throw new HttpError(400, "Corps JSON invalide");
  });
  const parsed = schema.safeParse({ ...(json as object), userId });
  if (!parsed.success) throw new HttpError(400, "Requête invalide", parsed.error.issues);
  return parsed.data;
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
  const budgetMax = req.budgetMax ?? profile.budgetMax;
  const matches = await call("brightdata", () =>
    findMatches(req.capture, { ...profile, budgetMax }, req.requetesSecours),
  );
  return c.json(CaptureResponseSchema.parse(matches));
});

// POST /identify → IdentifiedItem (zone sélectionnée → nom de l'article, modèle HF)
app.post("/identify", async (c) => {
  const req = await accountBody(c, IdentifyRequestSchema);
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

// POST /search → { resultats, filtreIA } (Zara / Uniqlo / Mango / Bershka + filtre IA de similarité)
app.post("/search", async (c) => {
  const req = await accountBody(c, SearchRequestSchema);
  const res = await call("search", () => searchStores(req));
  return c.json(SearchResponseSchema.parse(res));
});

const fittingLimit = bodyLimit({
  maxSize: MAX_IMAGE + 65536,
  onError: (c) => c.json({ error: "La photo dépasse 8 Mo." }, 413),
});

// Planche visage + planche corps : deux images, d'où une limite double.
const avatarLimit = bodyLimit({
  maxSize: 2 * MAX_IMAGE + 65536,
  onError: (c) => c.json({ error: "Les photos dépassent 16 Mo au total." }, 413),
});

app.post("/avatar", avatarLimit, async (c) => {
  const userId = await fittingUser(c.req.header("Authorization"));
  // Corps décrit depuis le profil (taille, poids, morphologie) : rendu fidèle, pas flatteur.
  const body = bodyOf(userId).catch(() => "");
  const input = await c.req.formData().catch(() => {
    throw new HttpError(400, "Photo manquante.");
  });
  const form = new FormData();
  form.set("person", checkPhoto(input.get("person")), "person");
  if (input.get("face")) form.set("face", checkPhoto(input.get("face")), "face");
  const pose = Number(input.get("pose") ?? 0);
  form.set("pose", String(Number.isInteger(pose) && pose >= 0 && pose <= 2 ? pose : 0));
  const description = await body;
  if (description) form.set("body", description.slice(0, 400));
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
    if (!req.userPhotoUrl)
      return c.json(
        await accountTryOn(userId, req.garmentImageUrl, req.garmentName, req.productUrl),
      );
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
  await requireProfile(req.userId);
  const host = new URL(req.productUrl).hostname.replace(/^www\./, "");
  // Sans compte relié, l'agent remplirait un panier invité dans SON navigateur cloud : l'article
  // n'apparaîtrait jamais dans le panier de l'utilisateur. On refuse donc avant de lancer l'agent.
  const compte = await call("supabase", () => findMerchantAccount(req.userId, host));
  if (!compte?.vaultId && !config.mocks.hcompany) {
    throw new HttpError(
      409,
      `Relie ton compte ${host} dans les Réglages BuyFit : l'agent s'y connecte pour ajouter l'article à TON panier.`,
    );
  }

  const session = await call("hcompany", () =>
    startOrderSession({
      productUrl: req.productUrl,
      taille: req.taille,
      equivalents: sizeEquivalents(req.taille, {
        ...(req.genre ? { genre: req.genre } : {}),
        ...(req.categorie ? { categorie: req.categorie } : {}),
      }),
      ...(req.couleur ? { couleur: req.couleur } : {}),
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
  if (!order.hSessionId || order.statut === "commandee") {
    return c.json(toStatus(order));
  }
  const { hSessionId, confirmed } = order;
  // Échec / panier déjà enregistrés : on relit quand même la session pour renvoyer le motif et
  // le message (sinon l'extension n'affiche qu'un « n'a pas pu terminer » générique).
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
