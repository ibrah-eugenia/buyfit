/**
 * Recherche d'équivalents via Bright Data SERP API (token côté serveur uniquement).
 * Doc : https://docs.brightdata.com/api-reference/rest-api/serp/serp-api
 *
 * Pipeline (testé contre l'API réelle le 17/11/2026) :
 * 1. Google Shopping (`udm=28`) avec la description de l'épingle comme requête texte,
 *    + une requête par marque préférée. Réponse parsée : { title, price, shop, link, image }.
 * 2. Filtre budget, dédoublonnage des variantes, bonus marques préférées, top 3.
 * 3. URL marchand : les liens Shopping pointent vers google.com ; on la retrouve par une
 *    recherche organique « titre + boutique ». À défaut on garde le lien Google.
 *
 * Google Lens (recherche par image) : désactivé par défaut, Bright Data renvoie
 * `no_local_parser` / `reject_element` sur lens.google.com. Réactivable avec BRIGHTDATA_USE_LENS.
 */
import { createHash } from "node:crypto";
import {
  ProductMatchSchema,
  type InspirationCapture,
  type ProductMatch,
  type UserProfile,
} from "@buyfit/shared";
import { config } from "../config.js";
import { HttpError } from "../errors.js";

const BRIGHTDATA_REQUEST_URL = "https://api.brightdata.com/request";
const MAX_RESULTS = 3;
const MAX_BRAND_QUERIES = 3;
/** Recouvrement minimal entre titre Shopping et titre de la page marchand retrouvée. */
const MIN_TITLE_OVERLAP = 0.5;

export async function findMatches(
  capture: InspirationCapture,
  profile: UserProfile,
  fallbackQueries: string[] = [],
): Promise<ProductMatch[]> {
  if (config.mocks.brightdata) return rank(mockResults(profile), profile);

  const query = cleanQuery(capture.description);
  if (!query && !config.BRIGHTDATA_USE_LENS) {
    throw new HttpError(
      422,
      "Description de l'épingle absente : impossible de lancer la recherche",
    );
  }

  const candidates: ProductMatch[] = [];
  if (config.BRIGHTDATA_USE_LENS) {
    candidates.push(...(await searchLens(capture.imageUrl).catch(() => [])));
  }
  if (query) {
    // 1. Requête principale, puis repli de plus en plus générique tant que Google ne renvoie rien.
    const { used, items } = await searchWithFallback(
      relaxQueries(query, fallbackQueries.map(cleanQuery)),
    );
    candidates.push(...items);
    // 2. Même requête chez les marques / marchands de l'utilisateur. Un échec n'arrête pas les autres.
    const brandQueries = userSites(profile)
      .slice(0, MAX_BRAND_QUERIES)
      .map((m) => `${m} ${used}`);
    const results = await Promise.allSettled(brandQueries.map(searchShopping));
    candidates.push(...results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])));
  }

  const top = rank(candidates, profile, query);
  return Promise.all(top.map(resolveMerchantUrl));
}

// ---------- classement ----------

/** Sites renseignés par l'utilisateur : marques préférées + marchands où il a un compte. */
function userSites(profile: UserProfile): string[] {
  const names = [...profile.marquesPreferees, ...profile.comptesMarchands.map((m) => m.marchand)];
  return [...new Map(names.map((n) => [brandKey(n), n])).values()];
}

/** Si au moins un résultat vient des sites de l'utilisateur, on ne garde que ceux-là. */
function onUserSites(items: ProductMatch[], profile: UserProfile): ProductMatch[] {
  const sites = new Set([
    ...userSites(profile).map(brandKey),
    ...profile.comptesMarchands.map((m) => brandKey(m.domaine)),
  ]);
  if (!sites.size) return items;
  const mine = items.filter((p) => sites.has(brandKey(p.marque)));
  return mine.length ? mine : items;
}

/** Poids de la pertinence titre ↔ requête (couleur, motif, matière…) dans le score final. */
const RELEVANCE_WEIGHT = 0.3;
/** Déguisements / costumes de fête : jamais un équivalent d'une tenue Pinterest. */
const COSTUME_PARTY = /d[ée]guisement|opposuits|halloween|carnaval|cosplay/i;

function rank(items: ProductMatch[], profile: UserProfile, query = ""): ProductMatch[] {
  const seen = new Set<string>();
  const inBudget = items
    .filter((p) => p.prix > 0 && p.prix <= profile.budgetMax)
    .filter((p) => !isMarketplace(p.marque))
    .filter((p) => !COSTUME_PARTY.test(`${p.nom} ${p.marque}`));
  return onUserSites(inBudget, profile)
    .filter((p) => {
      // Variantes taille/couleur : « Pull X | Vert / 5 » et « Pull X | Bleu / 6 » → un seul.
      const key = `${p.marque}|${p.nom.split("|")[0]!.trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((p) => ({ ...p, score: boostPreferredBrands(p, profile) }))
    .map((p) =>
      query
        ? {
            ...p,
            score: Math.min(
              1,
              Math.round((p.score * (1 - RELEVANCE_WEIGHT) + titleOverlap(query, p.nom) * RELEVANCE_WEIGHT) * 100) / 100,
            ),
          }
        : p,
    )
    .sort((a, b) => b.score - a.score)
    .reduce<ProductMatch[]>(diversify, [])
    .slice(0, MAX_RESULTS);
}

/** Un produit par marque d'abord ; on ne complète avec des doublons de marque qu'en dernier. */
function diversify(acc: ProductMatch[], p: ProductMatch, i: number, all: ProductMatch[]) {
  if (i === 0) {
    const firstPerBrand = new Map<string, ProductMatch>();
    for (const x of all)
      if (!firstPerBrand.has(brandKey(x.marque))) firstPerBrand.set(brandKey(x.marque), x);
    const firsts = [...firstPerBrand.values()];
    acc.push(...firsts, ...all.filter((x) => !firsts.includes(x)));
  }
  return acc;
}

/** « ZARA France », « zara.com » → « zara » ; « farfetch.com » → « farfetch ». */
export const brandKey = (shop: string) =>
  shop
    .toLowerCase()
    .replace(/\.[a-z]{2,}$/, "")
    .split(/[^a-z0-9]+/)
    .find((w) => w.length >= 2) ?? shop.toLowerCase();

/** Seconde main / places de marché : l'agent ne doit pas y commander (vendeurs tiers, pas de taille). */
const MARKETPLACES =
  /ebay|vinted|leboncoin|label.?emma|vestiaire|rakuten|amazon|cdiscount|aliexpress|temu|shein|wish|depop|backmarket|momox/i;
const isMarketplace = (shop: string) => MARKETPLACES.test(shop);

/** Bonus seulement si la BOUTIQUE est la marque (pas si la marque est juste citée dans le titre). */
function boostPreferredBrands(p: ProductMatch, profile: UserProfile): number {
  const shop = brandKey(p.marque);
  const pref = profile.marquesPreferees.some((m) => brandKey(m) === shop);
  return Math.min(1, Math.round((p.score + (pref ? 0.2 : 0)) * 100) / 100);
}

/** Part des mots significatifs du titre produit retrouvés dans le titre de la page. */
export function titleOverlap(product: string, page: string): number {
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "") // accents (après NFD)
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3),
    );
  const a = words(product);
  const b = words(page);
  if (!a.size) return 0;
  return [...a].filter((w) => b.has(w)).length / a.size;
}

// ---------- Bright Data ----------

/** Les erreurs 5xx de Bright Data (redirect rejected, reject element…) sont souvent passagères. */
async function serp(url: string, timeoutMs = 30_000, retries = 2): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await serpOnce(url, timeoutMs);
    } catch (err) {
      const transient = err instanceof Error && /Bright Data 5\d\d/.test(err.message);
      if (!transient || attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

async function serpOnce(url: string, timeoutMs: number): Promise<unknown> {
  const res = await fetch(BRIGHTDATA_REQUEST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.BRIGHTDATA_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ zone: config.BRIGHTDATA_SERP_ZONE, url, format: "raw" }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.text();
  // Bright Data répond souvent HTTP 200 avec le vrai statut dans x-brd-status-code.
  const brdStatus = Number(res.headers.get("x-brd-status-code") ?? res.status);
  if (!res.ok || brdStatus >= 400 || !body) {
    const err = res.headers.get("x-brd-error") ?? body.slice(0, 200);
    throw new Error(`Bright Data ${brdStatus}: ${err}`);
  }
  return JSON.parse(body);
}

const google = (q: string, extra = "") =>
  `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=fr&gl=fr&brd_json=1${extra}`;

type ShoppingItem = {
  title?: string;
  price?: string;
  shop?: string;
  link?: string;
  image?: string;
};

/**
 * Formats d'URL Google Shopping équivalents. Bright Data rejette aléatoirement certaines réponses
 * (« response body was rejected ») puis bloque l'URL EXACTE 60 s (429 « recently failed ») :
 * réessayer la même URL ne sert à rien, une URL différente pour la même requête passe souvent.
 */
const SHOPPING_URL_VARIANTS = ["&udm=28", "&tbm=shop", "&udm=28&pws=0"];

export async function searchShopping(query: string): Promise<ProductMatch[]> {
  let json: { shopping?: ShoppingItem[] } | null = null;
  let lastError: unknown = null;
  for (const extra of SHOPPING_URL_VARIANTS) {
    try {
      json = (await serp(google(query, extra), 30_000, 0)) as { shopping?: ShoppingItem[] };
      break;
    } catch (err) {
      lastError = err;
      console.warn(`[brightdata] « ${query} » ${extra} : ${err instanceof Error ? err.message.slice(0, 80) : err}`);
    }
  }
  if (!json) throw lastError;
  const out: ProductMatch[] = [];
  (json.shopping ?? []).forEach((it, i) => {
    const price = parsePrice(it.price);
    const parsed = ProductMatchSchema.safeParse({
      id: `bd-${hash(`${it.shop}|${it.title}`)}`,
      marque: decodeEntities(it.shop),
      nom: decodeEntities(it.title),
      prix: price?.value,
      devise: price?.currency,
      url: it.link,
      imageUrl: it.image,
      tailleDisponibles: [],
      score: Math.max(0.3, 0.75 - i * 0.015), // rang Google Shopping (bonus marque ajouté ensuite)
    });
    if (parsed.success) out.push(parsed.data);
  });
  return out;
}

/** Résultat Google Images (brd_json=1) : page d'origine, miniature Google et photo HD. */
export type ImageHit = {
  link: string;
  title: string;
  /** Miniature gstatic (légère) : utilisée par le filtre IA. */
  thumb: string;
  /** Photo d'origine du site (HD) : affichée dans l'extension. */
  image: string;
};

type RawImage = { link?: string; title?: string; image?: string; original_image?: string };

/**
 * Google Images par texte via Bright Data (testé le 17/11/2026 : 100 images, 3 à 6 s).
 * Avec `site:` on obtient directement les fiches produit du magasin et leur photo officielle.
 */
export async function searchImages(query: string): Promise<ImageHit[]> {
  // Requête « couverte » : la latence Bright Data varie de 3 à 30 s pour la même requête.
  // Si le 1er format n'a pas répondu après HEDGE_MS, on lance le 2nd ; la 1re réponse gagne.
  let settled = false;
  const run = (extra: string) =>
    serp(google(query, extra), 25_000, 0).then((json) => parseImages(json as { images?: RawImage[] }));
  const first = run("&udm=2");
  const second = new Promise((r) => setTimeout(r, HEDGE_MS)).then(() => {
    if (settled) throw new Error("inutile");
    return run("&tbm=isch");
  });
  try {
    return await Promise.any([first, second]);
  } catch (err) {
    const cause = err instanceof AggregateError ? err.errors[0] : err;
    console.warn(`[brightdata] images « ${query} » : ${cause instanceof Error ? cause.message.slice(0, 80) : cause}`);
    throw cause;
  } finally {
    settled = true;
  }
}

const HEDGE_MS = 4_000;

function parseImages(json: { images?: RawImage[] }): ImageHit[] {
  return (json.images ?? []).flatMap((it) =>
    it.link?.startsWith("http") && it.title && (it.image || it.original_image)
      ? [
          {
            link: it.link,
            title: decodeEntities(it.title)!,
            thumb: it.image ?? it.original_image!,
            image: it.original_image ?? it.image!,
          },
        ]
      : [],
  );
}

const SERP_MAX_RESULTS = 12;

/**
 * Recherche brute, sans filtre budget ni classement : ce que montrerait la console SERP
 * Bright Data pour la requête (Google Shopping FR), avec repli sur les requêtes plus larges.
 */
export async function serpShopping(
  query: string,
  fallbackQueries: string[] = [],
): Promise<{ requete: string; resultats: ProductMatch[] }> {
  if (config.mocks.brightdata) {
    return { requete: query, resultats: mockResults(MOCK_PROFILE_FOR_SERP) };
  }
  const { used, items } = await searchWithFallback(
    relaxQueries(cleanQuery(query), fallbackQueries.map(cleanQuery)),
  );
  return { requete: used, resultats: items.slice(0, SERP_MAX_RESULTS) };
}

const MOCK_PROFILE_FOR_SERP = { marquesPreferees: [] } as unknown as UserProfile;

/** Variantes de la requête, de la plus précise à la plus large (dédoublonnées, 4 max). */
export function relaxQueries(query: string, fallbacks: string[]): string[] {
  const words = query.split(" ");
  const truncated = words.length > 3 ? [words.slice(0, 3).join(" ")] : [];
  const all = [query, ...fallbacks, ...truncated].map((q) => q.trim()).filter(Boolean);
  return [...new Set(all.map((q) => q.toLowerCase()))].slice(0, 4);
}

/**
 * Essaie les variantes une à une. Bright Data rejette certaines formulations
 * (« response body was rejected », « recently failed ») : on passe alors à la suivante.
 */
async function searchWithFallback(
  queries: string[],
): Promise<{ used: string; items: ProductMatch[] }> {
  let lastError: unknown = null;
  for (const q of queries) {
    try {
      const items = await searchShopping(q);
      if (items.length) return { used: q, items };
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError) {
    console.error("[brightdata] toutes les variantes ont échoué", queries, lastError);
    throw new HttpError(
      503,
      "La recherche est momentanément indisponible (Google Shopping). Réessaie dans une minute.",
      lastError instanceof Error ? lastError.message : lastError,
    );
  }
  return { used: queries[0]!, items: [] };
}

type OrganicItem = { link?: string; title?: string };

/** Remplace le lien google.com/search?ibp=oshop par la page produit du marchand, si on la trouve. */
async function resolveMerchantUrl(p: ProductMatch): Promise<ProductMatch> {
  if (!new URL(p.url).hostname.endsWith("google.com")) return p;
  const shopSlug = brandKey(p.marque);
  try {
    const title = p.nom.split("|")[0]!.trim();
    const json = (await serp(google(`${title} ${p.marque}`), 20_000)) as {
      organic?: OrganicItem[];
    };
    const hit = (json.organic ?? []).find((o) => {
      if (!o.link?.startsWith("http")) return false; // liens /goto?url=… inexploitables
      const host = new URL(o.link).hostname.replace(/[^a-z0-9]/g, "");
      // Bon domaine ET même produit (sinon l'agent commanderait un autre article).
      return (
        shopSlug.length > 1 &&
        host.includes(shopSlug) &&
        titleOverlap(title, o.title ?? "") >= MIN_TITLE_OVERLAP
      );
    });
    return hit?.link ? { ...p, url: hit.link } : p;
  } catch {
    return p; // le lien Google reste exploitable par l'agent H (bouton « Voir sur le site »)
  }
}

async function searchLens(imageUrl: string): Promise<ProductMatch[]> {
  const url =
    `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}` +
    `&hl=fr&gl=fr&brd_json=1&brd_lens=products`;
  const json = (await serp(url, 60_000)) as {
    shopping?: ShoppingItem[];
    products?: ShoppingItem[];
  };
  // Format non documenté : on suppose les mêmes champs que Shopping (à vérifier quand Lens remarchera).
  const items = json.products ?? json.shopping ?? [];
  return items.flatMap((it, i) => {
    const price = parsePrice(it.price);
    const r = ProductMatchSchema.safeParse({
      id: `lens-${hash(`${it.shop}|${it.title}`)}`,
      marque: it.shop,
      nom: it.title,
      prix: price?.value,
      devise: price?.currency,
      url: it.link,
      imageUrl: it.image,
      tailleDisponibles: [],
      score: Math.max(0.4, 1 - i * 0.03),
    });
    return r.success ? [r.data] : [];
  });
}

// ---------- utilitaires ----------

/** Google renvoie parfois des entités HTML dans les titres (« H&amp;M »). */
const ENTITIES: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
const decodeEntities = (s: string | undefined) =>
  s
    ?.replace(/&(amp|quot|apos|lt|gt|nbsp);/g, (_, e: string) => ENTITIES[e]!)
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));

const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 12);

/** Nettoie le texte d'une épingle : hashtags, emojis, mots vides de Pinterest, longueur. */
export function cleanQuery(text: string | undefined): string {
  if (!text) return "";
  return text
    .replace(/#\S+/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\b(pin|épingle|this|cette|idée|idées|inspo|outfit ideas?)\b/giu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 10)
    .join(" ");
}

const CURRENCIES: Record<string, string> = { "€": "EUR", $: "USD", "£": "GBP", CHF: "CHF" };

/** « 30,99 € » → { value: 30.99, currency: "EUR" } ; « 1 299,00 € » → 1299. */
export function parsePrice(raw: string | undefined): { value: number; currency: string } | null {
  if (!raw) return null;
  // \s couvre aussi les espaces insécables (U+00A0, U+202F) utilisés par Google dans les prix.
  const m = /([\d\s.,]+)/.exec(raw);
  if (!m) return null;
  let num = m[1]!.replace(/\s/g, "");
  if (/,\d{1,2}$/.test(num)) num = num.replace(/\./g, "").replace(",", ".");
  else num = num.replace(/,/g, "");
  const value = Number(num);
  if (!Number.isFinite(value)) return null;
  const sym = Object.keys(CURRENCIES).find((s) => raw.includes(s));
  return { value, currency: sym ? CURRENCIES[sym]! : "EUR" };
}

function mockResults(profile: UserProfile): ProductMatch[] {
  const [m1 = "Uniqlo", m2 = "Zara", m3 = "COS"] = profile.marquesPreferees;
  return [
    {
      id: "mock-1",
      marque: m1,
      nom: "Pull col roulé 100% laine mérinos",
      prix: 39.9,
      devise: "EUR",
      url: "https://www.uniqlo.com/fr/fr/products/E460938-000/00",
      imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600",
      tailleDisponibles: ["S", "M", "L", "XL"],
      score: 0.74,
    },
    {
      id: "mock-2",
      marque: m2,
      nom: "Pull maille torsadée",
      prix: 45.95,
      devise: "EUR",
      url: "https://www.zara.com/fr/",
      imageUrl: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600",
      tailleDisponibles: ["S", "M", "L"],
      score: 0.68,
    },
    {
      id: "mock-3",
      marque: m3,
      nom: "Col roulé en laine",
      prix: 79,
      devise: "EUR",
      url: "https://www.cos.com/fr-fr/",
      imageUrl: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=600",
      tailleDisponibles: ["S", "M", "L"],
      score: 0.61,
    },
    {
      id: "mock-4",
      marque: "Marque hors budget",
      nom: "Pull cachemire premium",
      prix: 450,
      devise: "EUR",
      url: "https://example.com/",
      imageUrl: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600",
      tailleDisponibles: ["M"],
      score: 0.9,
    },
  ];
}
