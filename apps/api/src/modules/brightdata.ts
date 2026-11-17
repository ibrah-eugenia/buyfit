/**
 * Recherche d'équivalents via Bright Data (SERP API → Google Lens).
 * Le token reste côté serveur. Doc : https://docs.brightdata.com/scraping-automation/serp-api
 *
 * TODO(ibrahim) : valider le format exact de la réponse `brd_json=1` de Google Lens sur
 * notre zone, puis affiner `parseLensResults` (prix, tailles via scraping de la page produit).
 */
import {
  ProductMatchSchema,
  type InspirationCapture,
  type ProductMatch,
  type UserProfile,
} from "@buyfit/shared";
import { config } from "../config.js";

const BRIGHTDATA_REQUEST_URL = "https://api.brightdata.com/request";
const MAX_RESULTS = 3;

export async function findMatches(
  capture: InspirationCapture,
  profile: UserProfile,
): Promise<ProductMatch[]> {
  const raw = config.mocks.brightdata ? mockResults(profile) : await searchLens(capture.imageUrl);
  return raw
    .filter((p) => p.prix <= profile.budgetMax)
    .map((p) => ({ ...p, score: boostPreferredBrands(p, profile) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);
}

function boostPreferredBrands(p: ProductMatch, profile: UserProfile): number {
  const pref = profile.marquesPreferees.some((m) => m.toLowerCase() === p.marque.toLowerCase());
  return Math.min(1, p.score + (pref ? 0.2 : 0));
}

async function searchLens(imageUrl: string): Promise<ProductMatch[]> {
  const target = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}&brd_json=1`;
  const res = await fetch(BRIGHTDATA_REQUEST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.BRIGHTDATA_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ zone: config.BRIGHTDATA_SERP_ZONE, url: target, format: "raw" }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Bright Data HTTP ${res.status}: ${await res.text()}`);
  return parseLensResults(await res.json());
}

type LensPrice = { value?: number; extracted_value?: number; currency?: string };

/** Parse défensif : on garde uniquement les résultats qui passent le schéma ProductMatch. */
function parseLensResults(json: unknown): ProductMatch[] {
  const items = (json as { visual_matches?: unknown[] } | null)?.visual_matches ?? [];
  const out: ProductMatch[] = [];
  items.forEach((item, i) => {
    const it = item as Record<string, unknown>;
    const price = it.price as LensPrice | undefined;
    const parsed = ProductMatchSchema.safeParse({
      id: `bd-${i}-${String(it.link ?? "").slice(-24)}`,
      marque: it.source ?? "Inconnue",
      nom: it.title,
      prix: price?.extracted_value ?? price?.value,
      devise: price?.currency === "€" ? "EUR" : (price?.currency ?? "EUR"),
      url: it.link,
      imageUrl: it.thumbnail ?? it.image,
      tailleDisponibles: [],
      score: Math.max(0, 1 - i * 0.05),
    });
    if (parsed.success) out.push(parsed.data);
  });
  return out;
}

function mockResults(profile: UserProfile): ProductMatch[] {
  const [m1 = "Zara", m2 = "Mango", m3 = "COS"] = profile.marquesPreferees;
  return [
    {
      id: "mock-1",
      marque: m1,
      nom: "Blazer oversize en laine mélangée",
      prix: 69.95,
      devise: "EUR",
      url: "https://www.zara.com/fr/",
      imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600",
      tailleDisponibles: ["XS", "S", "M", "L"],
      score: 0.74,
    },
    {
      id: "mock-2",
      marque: m2,
      nom: "Veste structurée boutonnée",
      prix: 59.99,
      devise: "EUR",
      url: "https://shop.mango.com/fr",
      imageUrl: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600",
      tailleDisponibles: ["S", "M", "L"],
      score: 0.68,
    },
    {
      id: "mock-3",
      marque: m3,
      nom: "Manteau court droit",
      prix: 79,
      devise: "EUR",
      url: "https://www.cos.com/fr-fr/",
      imageUrl: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=600",
      tailleDisponibles: ["34", "36", "38", "40"],
      score: 0.61,
    },
    {
      id: "mock-4",
      marque: "Marque hors budget",
      nom: "Blazer premium",
      prix: 450,
      devise: "EUR",
      url: "https://example.com/",
      imageUrl: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600",
      tailleDisponibles: ["M"],
      score: 0.9,
    },
  ];
}
