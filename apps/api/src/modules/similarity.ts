/**
 * Filtre IA de similarité visuelle : un seul appel au modèle de vision Hugging Face compare la
 * pièce sélectionnée à toutes les images candidates (une note 0–10 par image). Un appel groupé
 * plutôt qu'un par produit : la latence reste celle d'une seule inférence.
 * En cas d'échec ou de dépassement du délai, on renvoie les candidats non filtrés (jamais bloquant).
 */
import type { ProductMatch, SearchResponse } from "@buyfit/shared";
import { config } from "../config.js";

const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";
/** Note minimale (sur 10) pour qu'un produit soit considéré comme la même pièce. */
const MIN_SCORE = 6;
/**
 * Chaque magasin garde au moins son meilleur produit s'il atteint cette note (même type de
 * vêtement) : on préfère montrer plusieurs magasins qu'un seul.
 */
const MIN_SCORE_BEST_OF_STORE = 4;
const IMAGE_TIMEOUT_MS = 4_000;
/**
 * Images notées par appel. Au-delà, le modèle sous-note les dernières (mesuré le 20/11/2026 :
 * le même blazer noté 3/10 en 14e position, 7/10 en 2e). Les lots partent en parallèle.
 */
const BATCH = 8;
const MODEL_TIMEOUT_MS = 20_000;

const PROMPT = (
  n: number,
) => `Tu compares des vêtements. La PREMIÈRE image est la pièce de référence.
Les ${n} images suivantes (numérotées de 1 à ${n}) sont des produits trouvés en boutique.
Vérifie d'abord la COULEUR (teinte exacte : beige ≠ marron ≠ gris) puis la COUPE
(ex. croisé ou droit, longueur, col, ajusté ou ample), puis le motif et la matière.
Note de 0 à 10 chaque produit :
10 = identique ; 7 à 9 = même type, même couleur et même coupe ;
5 à 6 = même type et même couleur, coupe ou motif un peu différents ;
2 à 4 = couleur différente OU coupe très différente ; 0 à 1 = autre type de vêtement.
Réponds UNIQUEMENT par un JSON : {"scores": [note1, note2, ...]} avec exactement ${n} notes.`;

export async function filterBySimilarity(
  referenceDataUrl: string,
  candidates: ProductMatch[],
  /** Image à comparer (ex. miniature légère plutôt que la photo HD affichée). */
  imageOf: (p: ProductMatch) => string = (p) => p.imageUrl,
): Promise<SearchResponse> {
  if (config.mocks.vision) return { resultats: candidates, filtreIA: false };
  const started = Date.now();
  try {
    // Les miniatures Google sont téléchargées par le serveur : le fournisseur HF n'a pas à les récupérer.
    const images = await Promise.all(candidates.map((p) => toDataUrl(imageOf(p))));
    const usable = candidates.flatMap((p, i) => (images[i] ? [{ p, img: images[i] }] : []));
    if (!usable.length) return { resultats: candidates, filtreIA: false };

    const imgs = usable.map((u) => u.img);
    const lots = Math.ceil(imgs.length / BATCH);
    // Lots équilibrés (16 → 8 + 8, 12 → 6 + 6) plutôt qu'un dernier lot presque vide.
    const size = Math.ceil(imgs.length / lots);
    const scores = (
      await Promise.all(
        Array.from({ length: lots }, (_, i) =>
          scoreImages(referenceDataUrl, imgs.slice(i * size, (i + 1) * size)),
        ),
      )
    ).flat();
    const scored = usable
      .map(({ p }, i) => ({ ...p, score: Math.round(((scores[i] ?? 0) / 10) * 100) / 100 }))
      .sort((a, b) => b.score - a.score);
    const bestOfStore = new Set(
      [...new Map(scored.map((p) => [p.marque, p] as const).reverse()).values()]
        .filter((p) => p.score * 10 >= MIN_SCORE_BEST_OF_STORE)
        .map((p) => p.id),
    );
    let resultats = scored.filter((p) => p.score * 10 >= MIN_SCORE || bestOfStore.has(p.id));
    // Rien d'assez proche : on montre quand même les 3 meilleurs s'ils sont du même type de
    // vêtement (note ≥ 3), plutôt qu'un écran vide d'une recherche à l'autre.
    if (!resultats.length) resultats = scored.filter((p) => p.score * 10 >= 3).slice(0, 3);
    console.info(
      `[similarity] ${resultats.length}/${usable.length} retenus en ${Date.now() - started} ms`,
      scores,
    );
    return { resultats, filtreIA: true };
  } catch (err) {
    console.warn(
      `[similarity] filtre ignoré (${Date.now() - started} ms) :`,
      err instanceof Error ? err.message.slice(0, 200) : err,
    );
    return { resultats: candidates, filtreIA: false };
  }
}

async function scoreImages(reference: string, images: string[]): Promise<number[]> {
  const content = [
    { type: "text", text: PROMPT(images.length) },
    { type: "image_url", image_url: { url: reference } },
    ...images.flatMap((url, i) => [
      { type: "text", text: `Produit ${i + 1} :` },
      { type: "image_url", image_url: { url } },
    ]),
  ];
  const res = await fetch(HF_CHAT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.HF_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.HF_VISION_MODEL,
      max_tokens: 120,
      temperature: 0,
      top_p: 1,
      seed: 7,
      messages: [{ role: "user", content }],
    }),
    signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Hugging Face ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return parseScores(json.choices?.[0]?.message?.content ?? "", images.length);
}

/**
 * {"scores":[8,3,…]} → nombres bornés 0–10. Le modèle oublie parfois une note (11 pour 12) :
 * on complète par 0 (produit écarté) plutôt que de jeter tout le filtre ; erreur seulement si
 * moins de la moitié des notes est revenue.
 */
export function parseScores(text: string, n: number): number[] {
  const raw = text.match(/\[[\d\s.,]*\]/)?.[0];
  const arr = raw ? (JSON.parse(raw) as unknown[]) : [];
  const scores = arr.slice(0, n).map((v) => Math.min(10, Math.max(0, Number(v) || 0)));
  if (scores.length < Math.ceil(n / 2))
    throw new Error(`Notes inattendues (${scores.length}/${n}) : ${text.slice(0, 120)}`);
  while (scores.length < n) scores.push(0);
  return scores;
}

async function toDataUrl(url: string): Promise<string | null> {
  if (url.startsWith("data:image/")) return url;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 1_500_000) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
