/**
 * Recherche par capture d'écran : même chaîne que l'épingle Pinterest dans l'extension.
 * 1. /identify : le modèle de vision nomme la pièce (zone choisie dans la capture).
 * 2. /search : Google Shopping par magasin + filtre IA de similarité avec la zone.
 * Les appels passent par /api/fitting, qui transmet la session Supabase à apps/api.
 */
import { IdentifiedItemSchema, SearchResponseSchema, type IdentifiedItem } from "@buyfit/shared";
import { tailleConseillee } from "@/lib/mocks/search";
import type { SearchResult, WebProfile } from "@/lib/types";

/** Côté long max envoyé au modèle : assez pour les détails, sous la limite de 3 Mo en base64. */
const COTE_MAX = 1280;

export type Zone = { x: number; y: number; w: number; h: number };

async function apiJson(operation: "identify" | "search", body: unknown): Promise<unknown> {
  const res = await fetch("/api/fitting/" + operation, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-BuyFit-Request": "fitting" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res) throw new Error("Serveur BuyFit injoignable. Réessaie dans un instant.");
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (json as { error?: unknown } | null)?.error;
    throw new Error(typeof message === "string" ? message : "La recherche n'a pas abouti.");
  }
  return json;
}

/**
 * Découpe la zone (coordonnées 0–1 de l'image) et renvoie un JPEG en data URL.
 * Sans zone : l'image entière, redimensionnée.
 */
export async function decouper(image: Blob, zone?: Zone): Promise<string> {
  const bitmap = await createImageBitmap(image);
  const z = zone ?? { x: 0, y: 0, w: 1, h: 1 };
  const sx = z.x * bitmap.width;
  const sy = z.y * bitmap.height;
  const sw = Math.max(1, z.w * bitmap.width);
  const sh = Math.max(1, z.h * bitmap.height);
  const echelle = Math.min(1, COTE_MAX / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * echelle);
  canvas.height = Math.round(sh * echelle);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.88);
}

export async function identifierPiece(imageDataUrl: string): Promise<IdentifiedItem> {
  return IdentifiedItemSchema.parse(await apiJson("identify", { imageDataUrl }));
}

export async function chercherParImage(
  item: IdentifiedItem,
  imageDataUrl: string,
  profil: WebProfile | null,
): Promise<SearchResult[]> {
  // Genre du compte en priorité (un homme qui entoure un pull cherche au rayon homme).
  const g = profil?.genre;
  const genre = g === "homme" || g === "femme" ? g : item.genre;
  const res = SearchResponseSchema.parse(
    await apiJson("search", {
      requete: item.requete,
      ...(genre ? { genre } : {}),
      imageDataUrl,
    }),
  );
  // Même casse que le catalogue (« Pantalon », « Chaussures ») pour le guide des tailles.
  const brute = item.categorie?.trim() ?? "";
  const categorie = brute.charAt(0).toUpperCase() + brute.slice(1);
  return res.resultats.map((p) => ({
    ...p,
    categorie,
    tailleConseillee: tailleConseillee({ ...p, categorie }, profil),
  }));
}
