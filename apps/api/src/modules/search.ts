/**
 * Recherche par magasin test : la requête de la pièce identifiée (+ genre) est lancée en
 * parallèle sur Google Images, restreinte au site de chaque magasin (Zara, Uniqlo),
 * via Bright Data. On ne garde que les fiches produit (une par article, version FR, bon genre),
 * puis le filtre IA de similarité écarte celles dont la couleur ou la coupe ne correspond pas.
 *
 * Pourquoi Google Images plutôt que Shopping : liens directs vers la fiche du magasin, photo
 * officielle HD, titres avec la couleur, et `site:` évite les revendeurs et le rayon femme.
 * Prix : Google Images ne le donne pas ; on le lit directement sur la fiche produit
 * (Zara : JSON `?ajax=true`, Uniqlo : données de la page) ; introuvable à temps → prix = 0,
 * l'extension affiche « Voir le prix ». (Mango retiré le 19/11/2026 : son site bloque les agents.)
 *
 * Budget total : SEARCH_BUDGET_MS (20 s). Magasins coupés à STORE_DEADLINE_MS, puis filtre IA
 * et prix en parallèle dans le temps restant ; filtre trop lent → résultats non filtrés.
 */
import { createHash } from "node:crypto";
import type { ProductMatch, SearchRequest, SearchResponse } from "@buyfit/shared";
import { config } from "../config.js";
import { cleanQuery, searchImages, type ImageHit } from "./brightdata.js";
import { filterBySimilarity } from "./similarity.js";
import { TtlCache } from "./cache.js";

/**
 * Résultats Google Images par magasin et requête, gardés 30 min : Bright Data renvoie des listes
 * différentes d'un appel à l'autre (et dépasse parfois le délai). Même requête → même résultat.
 */
const storeHits = new TtlCache<Hit[]>(30 * 60_000);
/** Recherche complète (requête + pièce) : même sélection → mêmes articles, instantanément. */
const searches = new TtlCache<SearchResponse>(30 * 60_000);

type Store = {
  name: string;
  site: string;
  /** Fiche produit (pas une catégorie, un look, une page d'aide…). */
  product: RegExp;
  /** Identifiant de l'article dans l'URL : sert à supprimer les doublons (pays, couleurs). */
  id: RegExp;
};

export const STORES: Store[] = [
  { name: "Zara", site: "zara.com", product: /-p\d{6,}\.html/, id: /-p(\d{6,})\.html/ },
  {
    name: "Uniqlo",
    site: "uniqlo.com",
    product: /\/products\/E?\d{6}/,
    id: /\/products\/(E?\d{6})/,
  },
];
/** Candidats par magasin envoyés au filtre IA : plus = meilleur rappel, mais plus lent. */
const PER_STORE = 6;
/** Temps maximum d'une recherche, de la requête à la réponse. */
const SEARCH_BUDGET_MS = 19_500;
/**
 * Au-delà, un magasin trop lent est ignoré : on affiche les autres plutôt que d'attendre.
 * Bright Data répond en 8 à 15 s pour une recherche Google Images (mesuré le 19/11/2026) ;
 * il reste ensuite ~7 s pour le filtre IA (~6 s) et les prix (en parallèle).
 */
const STORE_DEADLINE_MS = 12_500;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

export async function searchStores(req: SearchRequest): Promise<SearchResponse> {
  const key = createHash("sha1")
    .update(`${req.requete}|${req.genre ?? ""}|${req.imageDataUrl ?? ""}`)
    .digest("hex");
  const cached = searches.get(key);
  if (cached) {
    console.info(`[search] ${cached.resultats.length} résultats (cache)`);
    return cached;
  }
  const res = await searchOnce(req);
  // On ne garde que les recherches complètes (les 2 magasins ont répondu et il y a des articles).
  if (res.resultats.length) searches.set(key, res);
  return res;
}

async function searchOnce(req: SearchRequest): Promise<SearchResponse> {
  const started = Date.now();
  const base = withGender(cleanQuery(req.requete), req.genre);
  const perStore = await Promise.all(
    STORES.map((s) => withDeadline(searchStore(s, base, req.genre), STORE_DEADLINE_MS, s.name)),
  );
  const hits = perStore.flatMap((items) => items.slice(0, PER_STORE));
  const products = hits.map((h) => h.product);
  if (!products.length) return { resultats: [], filtreIA: false };

  // Filtre IA et prix en parallèle, dans le temps restant du budget.
  // Le filtre IA compare les miniatures Google (légères) ; l'extension affiche la photo HD.
  const remaining = Math.max(2_000, SEARCH_BUDGET_MS - (Date.now() - started));
  const thumbs = new Map(hits.map((h) => [h.product.id, h.thumb]));
  const unfiltered: SearchResponse = { resultats: products, filtreIA: false };
  const [filtered, prices] = await Promise.all([
    req.imageDataUrl
      ? within(
          filterBySimilarity(req.imageDataUrl, products, (p) => thumbs.get(p.id) ?? p.imageUrl),
          remaining,
          unfiltered,
          "filtre IA",
        )
      : Promise.resolve(unfiltered),
    findDetails(products, remaining),
  ]);
  // Rayon lu sur la fiche (Zara « WOMAN », Uniqlo « WOMEN »…) : Google renvoie des articles de
  // l'autre rayon même avec « homme » dans la requête. Rayon inconnu → on garde l'article.
  const wrongRayon = (id: string) => {
    const r = prices.get(id)?.rayon;
    return !!r && (req.genre === "homme" || req.genre === "femme") && r !== req.genre && r !== "mixte";
  };
  const resultats = filtered.resultats.filter((p) => !wrongRayon(p.id));
  console.info(
    `[search] ${resultats.length} résultats en ${Date.now() - started} ms` +
      (resultats.length < filtered.resultats.length
        ? ` (${filtered.resultats.length - resultats.length} de l'autre rayon écartés)`
        : ""),
  );
  return {
    ...filtered,
    resultats: resultats.map((p) => {
      const prix = prices.get(p.id)?.prix;
      return prix ? { ...p, prix, devise: "EUR" as const } : p;
    }),
  };
}

/** Résout `p`, ou `fallback` si `p` dépasse `ms`. */
function within<T>(p: Promise<T>, ms: number, fallback: T, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[search] ${label} : pas de réponse en ${ms} ms`);
      resolve(fallback);
    }, ms);
  });
  return Promise.race([p, late]).finally(() => clearTimeout(timer));
}

type Rayon = "homme" | "femme" | "mixte" | "enfant";
type Details = { prix: number | null; rayon: Rayon | null };

/** Prix (en euros) et rayon de chaque produit, lus sur sa fiche ; absents si introuvables à temps. */
async function findDetails(products: ProductMatch[], ms: number): Promise<Map<string, Details>> {
  if (config.mocks.brightdata) return new Map();
  const found = await Promise.all(
    products.map((p) =>
      within(
        detailsOf(p).catch(() => null),
        ms,
        null,
        `fiche ${p.marque}`,
      ).then((d) => (d ? ([p.id, d] as const) : null)),
    ),
  );
  return new Map(found.filter((x) => x !== null));
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "fr-FR" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function detailsOf(p: ProductMatch): Promise<Details | null> {
  if (p.marque === "Zara") {
    const json = await fetchText(zaraJsonUrl(p.url));
    return { prix: zaraPrice(json), rayon: zaraRayon(json) };
  }
  if (p.marque === "Uniqlo") {
    const html = await fetchText(p.url);
    return { prix: uniqloPrice(html), rayon: uniqloRayon(html) };
  }
  return null;
}

/** Rayon Zara : « "sectionName":"MAN" » / « WOMAN » / « KID ». */
export function zaraRayon(json: string): Rayon | null {
  const s = json.match(/"sectionName"\s*:\s*"([A-Z]+)"/)?.[1];
  return s === "MAN" ? "homme" : s === "WOMAN" ? "femme" : s === "KID" ? "enfant" : null;
}

/**
 * Rayon Uniqlo : catégorie du produit dans les données de la page,
 * « "gender":{"id":"37609","level":1,"name":"men",… » (les « "gender":["Women"] » des
 * recommandations ne comptent pas).
 */
export function uniqloRayon(html: string): Rayon | null {
  const g = html
    .match(/"gender"\s*:\s*\{\s*"id"\s*:\s*"\d+"\s*,\s*"level"\s*:\s*1\s*,\s*"name"\s*:\s*"([a-z]+)"/i)?.[1]
    ?.toUpperCase();
  if (!g) return null;
  if (g === "MEN" || g === "MAN" || g === "HOMME") return "homme";
  if (g === "WOMEN" || g === "WOMAN" || g === "FEMME") return "femme";
  if (g === "UNISEX") return "mixte";
  if (g === "KIDS" || g === "BABY" || g === "ENFANT") return "enfant";
  return null;
}

/** Fiche Zara en JSON : même URL avec `?ajax=true` (paramètres de coloris conservés). */
export const zaraJsonUrl = (url: string) => `${url}${url.includes("?") ? "&" : "?"}ajax=true`;

/** Prix Zara en centimes (« "price":4595 ») → euros. */
export function zaraPrice(json: string): number | null {
  const cents = json.match(/"price"\s*:\s*(\d+)/)?.[1];
  return cents ? Number(cents) / 100 : null;
}

/** Prix Uniqlo dans les données de la page : prix promo s'il existe, sinon prix de base. */
export function uniqloPrice(html: string): number | null {
  const m = html.match(
    /"prices":\{"base":\{"currency":\{[^}]*\},"value":([\d.]+)\},"promo":(?:\{"currency":\{[^}]*\},"value":([\d.]+)\}|null)/,
  );
  if (!m) return null;
  return Number(m[2] ?? m[1]);
}

/** Ajoute « homme » / « femme » à la requête s'il n'y figure pas déjà. */
export function withGender(query: string, genre?: SearchRequest["genre"]): string {
  if (!genre || genre === "mixte" || /\b(homme|femme|hommes|femmes)\b/i.test(query)) return query;
  return `${query} ${genre}`;
}

type Hit = { product: ProductMatch; thumb: string };

function withDeadline(p: Promise<Hit[]>, ms: number, name: string): Promise<Hit[]> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<Hit[]>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[search] ${name} ignoré : pas de réponse en ${ms} ms`);
      resolve([]);
    }, ms);
  });
  return Promise.race([p, late]).finally(() => clearTimeout(timer));
}

async function searchStore(
  store: Store,
  base: string,
  genre?: SearchRequest["genre"],
): Promise<Hit[]> {
  if (config.mocks.brightdata) return mockStore(store.name);
  // Une seule requête sur le site entier : les liens sont ramenés en version FR (toFrench).
  // (L'ancienne 1re tentative « site:<magasin>/fr » expirait souvent, ex. Mango n'a pas de
  // chemin /fr, et consommait tout le délai du magasin.)
  const cacheKey = `${store.name}|${base}|${genre ?? ""}`;
  const cached = storeHits.get(cacheKey);
  if (cached) return cached;
  try {
    const hits = pickProducts(await searchImages(`${base} site:${store.site}`), store, genre);
    if (hits.length) storeHits.set(cacheKey, hits);
    return hits;
  } catch (err) {
    console.warn(
      `[search] ${store.name} :`,
      err instanceof Error ? err.message.slice(0, 120) : err,
    );
    return [];
  }
}

const OTHER_GENDER = {
  homme: /\b(femme|women|woman|fille|girl)s?\b/i,
  femme: /\b(homme|men|man|garçon|boy)s?\b/i,
};

/** Fiches produit du magasin, une par article, version FR, sans le rayon de l'autre genre. */
export function pickProducts(
  hits: ImageHit[],
  store: Store,
  genre?: SearchRequest["genre"],
): Hit[] {
  const seen = new Set<string>();
  const out: Hit[] = [];
  hits.forEach((h, rank) => {
    if (!h.link.includes(store.site) || !store.product.test(h.link)) return;
    const wrong = genre === "homme" || genre === "femme" ? OTHER_GENDER[genre] : null;
    if (wrong && (wrong.test(h.title) || wrong.test(decodeURIComponent(h.link)))) return;
    const key = h.link.match(store.id)?.[1] ?? h.link;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      thumb: h.thumb,
      product: {
        id: `img-${createHash("sha1").update(`${store.name}|${key}`).digest("hex").slice(0, 12)}`,
        marque: store.name,
        nom: cleanTitle(h.title),
        prix: 0, // inconnu : Google Images ne donne pas le prix
        devise: "EUR",
        url: toFrench(h.link),
        imageUrl: h.image,
        tailleDisponibles: [],
        score: Math.max(0.3, 0.8 - rank * 0.01),
      },
    });
  });
  return out;
}

/** /be/fr/, /ne/fr/… → /fr/fr/ : boutique française (prix et livraison en France). */
const toFrench = (url: string) => url.replace(/^(https:\/\/[^/]+)\/[a-z]{2}\/fr\//, "$1/fr/fr/");

/** « VESTE À REVERS CROISÉS - Beige clair - 46 | ZARA France » → « Veste à revers croisés - Beige clair ». */
export function cleanTitle(title: string): string {
  let t = title
    .split(/\s[|｜]\s/)[0]!
    .replace(/\s-\s(\d{2,3}|X{0,3}[SML]|XXL)$/i, "")
    .replace(/\s-\s(Homme|Femme)$/i, "")
    .trim();
  // Zara écrit le nom en capitales (« VESTE CROISÉE - Beige clair ») : on le remet en minuscules.
  const [head = "", ...rest] = t.split(" - ");
  if (head === head.toUpperCase())
    t = [head.charAt(0) + head.slice(1).toLowerCase(), ...rest].join(" - ");
  return t.slice(0, 160) || title.slice(0, 160);
}

const MOCK: Record<string, [string, string][]> = {
  Zara: [
    [
      "Blazer croisé à carreaux",
      "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600",
    ],
    [
      "Blazer oversize laine mélangée",
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600",
    ],
  ],
  Uniqlo: [
    [
      "Veste confort en laine",
      "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=600",
    ],
  ],
};

async function mockStore(store: string): Promise<Hit[]> {
  await new Promise((r) => setTimeout(r, 600));
  return (MOCK[store] ?? []).map(([nom, imageUrl], i) => ({
    thumb: imageUrl,
    product: {
      id: `mock-${store}-${i}`,
      marque: store,
      nom,
      prix: 0,
      devise: "EUR",
      url: `https://www.${store.toLowerCase()}.com/fr/`,
      imageUrl,
      tailleDisponibles: [],
      score: 0.8 - i * 0.1,
    },
  }));
}
