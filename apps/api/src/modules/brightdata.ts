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
const MAX_BRAND_QUERIES = 2;
/** Recouvrement minimal entre titre Shopping et titre de la page marchand retrouvée. */
const MIN_TITLE_OVERLAP = 0.5;

export async function findMatches(
  capture: InspirationCapture,
  profile: UserProfile,
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
    const queries = [
      query,
      ...profile.marquesPreferees.slice(0, MAX_BRAND_QUERIES).map((m) => `${m} ${query}`),
    ];
    // Une requête qui échoue (ex. Google redirige vers une boutique de marque) n'arrête pas les autres.
    const results = await Promise.allSettled(queries.map(searchShopping));
    const ok = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    if (!ok.length && results.every((r) => r.status === "rejected")) {
      throw (results[0] as PromiseRejectedResult).reason;
    }
    candidates.push(...ok);
  }

  const top = rank(candidates, profile);
  return Promise.all(top.map(resolveMerchantUrl));
}

// ---------- classement ----------

function rank(items: ProductMatch[], profile: UserProfile): ProductMatch[] {
  const seen = new Set<string>();
  return items
    .filter((p) => p.prix > 0 && p.prix <= profile.budgetMax)
    .filter((p) => !isMarketplace(p.marque))
    .filter((p) => {
      // Variantes taille/couleur : « Pull X | Vert / 5 » et « Pull X | Bleu / 6 » → un seul.
      const key = `${p.marque}|${p.nom.split("|")[0]!.trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((p) => ({ ...p, score: boostPreferredBrands(p, profile) }))
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
const brandKey = (shop: string) =>
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
function titleOverlap(product: string, page: string): number {
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

async function searchShopping(query: string): Promise<ProductMatch[]> {
  const json = (await serp(google(query, "&udm=28"))) as { shopping?: ShoppingItem[] };
  const out: ProductMatch[] = [];
  (json.shopping ?? []).forEach((it, i) => {
    const price = parsePrice(it.price);
    const parsed = ProductMatchSchema.safeParse({
      id: `bd-${hash(`${it.shop}|${it.title}`)}`,
      marque: it.shop,
      nom: it.title,
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
