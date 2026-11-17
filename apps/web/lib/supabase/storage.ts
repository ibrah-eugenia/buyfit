/**
 * Buckets Storage privés : on ne sert les fichiers que par URL signée à durée courte.
 * Utilisable côté serveur comme navigateur (le client passé décide des droits : RLS).
 */
import type { BuyFitClient } from "./client";

export const BUCKETS = { userPhotos: "user-photos", tryonResults: "tryon-results" } as const;
export type Bucket = (typeof BUCKETS)[keyof typeof BUCKETS];

/** Durée de validité des URLs signées renvoyées aux pages. */
export const SIGNED_URL_TTL_S = 60 * 60;

/** Signe plusieurs chemins d'un coup. Renvoie chemin → URL (absent si le fichier n'existe pas). */
export async function signPaths(
  supabase: BuyFitClient,
  bucket: Bucket,
  paths: string[],
  ttlSeconds = SIGNED_URL_TTL_S,
): Promise<Map<string, string>> {
  const unique = [...new Set(paths)];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(unique, ttlSeconds);
  if (error) return new Map();
  const urls = new Map<string, string>();
  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
  }
  return urls;
}
