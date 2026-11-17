/**
 * Recherche par magasin test : la requête de la pièce identifiée (+ genre) est lancée en
 * parallèle sur Google Images, restreinte au site de chaque magasin (Zara, Mango, Uniqlo),
 * via Bright Data. On ne garde que les fiches produit (une par article, version FR, bon genre),
 * puis le filtre IA de similarité écarte celles dont la couleur ou la coupe ne correspond pas.
 *
 * Pourquoi Google Images plutôt que Shopping : liens directs vers la fiche du magasin, photo
 * officielle HD, titres avec la couleur, et `site:` évite les revendeurs et le rayon femme.
 * Limite : pas de prix dans Google Images (prix = 0 → l'extension affiche « Voir le prix »).
 */
import { createHash } from "node:crypto";
import type { ProductMatch, SearchRequest, SearchResponse } from "@buyfit/shared";
import { config } from "../config.js";
import { cleanQuery, searchImages, type ImageHit } from "./brightdata.js";
import { filterBySimilarity } from "./similarity.js";

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
  { name: "Mango", site: "shop.mango.com", product: /\/p\/.+\/\d{8}/, id: /\/(\d{8})(?:[/?]|$)/ },
  { name: "Uniqlo", site: "uniqlo.com", product: /\/products\/E?\d{6}/, id: /\/products\/(E?\d{6})/ },
];
/** Candidats par magasin envoyés au filtre IA : plus = meilleur rappel, mais plus lent. */
const PER_STORE = 4;
/** Au-delà, un magasin trop lent est ignoré : on affiche les autres plutôt que d'attendre. */
const STORE_DEADLINE_MS = 15_000;

export async function searchStores(req: SearchRequest): Promise<SearchResponse> {
  const base = withGender(cleanQuery(req.requete), req.genre);
  const perStore = await Promise.all(
    STORES.map((s) => withDeadline(searchStore(s, base, req.genre), STORE_DEADLINE_MS, s.name)),
  );
  const hits = perStore.flatMap((items) => items.slice(0, PER_STORE));
  const products = hits.map((h) => h.product);
  if (!products.length || !req.imageDataUrl) return { resultats: products, filtreIA: false };
  // Le filtre IA compare les miniatures Google (légères) ; l'extension affiche la photo HD.
  const thumbs = new Map(hits.map((h) => [h.product.id, h.thumb]));
  return filterBySimilarity(req.imageDataUrl, products, (p) => thumbs.get(p.id) ?? p.imageUrl);
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

async function searchStore(store: Store, base: string, genre?: SearchRequest["genre"]): Promise<Hit[]> {
  if (config.mocks.brightdata) return mockStore(store.name);
  // Version française du site d'abord ; sinon le site entier (les liens sont ramenés en FR).
  for (const site of [`${store.site}/fr`, store.site]) {
    try {
      const hits = pickProducts(await searchImages(`${base} site:${site}`), store, genre);
      if (hits.length) return hits;
    } catch (err) {
      console.warn(`[search] ${store.name} :`, err instanceof Error ? err.message.slice(0, 120) : err);
    }
  }
  return [];
}

const OTHER_GENDER = { homme: /\b(femme|women|woman|fille|girl)s?\b/i, femme: /\b(homme|men|man|garçon|boy)s?\b/i };

/** Fiches produit du magasin, une par article, version FR, sans le rayon de l'autre genre. */
export function pickProducts(hits: ImageHit[], store: Store, genre?: SearchRequest["genre"]): Hit[] {
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
  if (head === head.toUpperCase()) t = [head.charAt(0) + head.slice(1).toLowerCase(), ...rest].join(" - ");
  return t.slice(0, 160) || title.slice(0, 160);
}

const MOCK: Record<string, [string, string][]> = {
  Zara: [
    ["Blazer croisé à carreaux", "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600"],
    ["Blazer oversize laine mélangée", "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600"],
  ],
  Mango: [["Veste de costume structurée", "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600"]],
  Uniqlo: [["Veste confort en laine", "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=600"]],
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
