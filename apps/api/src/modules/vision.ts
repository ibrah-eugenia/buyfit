/**
 * Identification de la pièce sélectionnée par un modèle de vision Hugging Face
 * (Inference Providers, API compatible OpenAI : router.huggingface.co/v1/chat/completions).
 * Le modèle reçoit le crop en base64 (pas besoin d'héberger l'image) et renvoie un JSON
 * { nom, requete, categorie, couleur, matiere } qui sert ensuite de requête Google Shopping.
 */
import { IdentifiedItemSchema, type IdentifiedItem } from "@buyfit/shared";
import { config } from "../config.js";
import { HttpError } from "../errors.js";

const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";

const PROMPT = `Tu es un expert mode. L'image montre UNE pièce de vêtement ou un accessoire, sélectionnée par l'utilisateur.
Identifie-la pour la retrouver en boutique en ligne. Réponds UNIQUEMENT par un objet JSON, sans texte autour :
{"nom": "nom précis en français (type, coupe, matière, motif, couleur)",
 "requete": "requête Google Shopping en français, 4 à 6 mots, sans marque sauf logo visible",
 "secours": ["requête plus générique, 3 à 4 mots", "requête très générique, 2 à 3 mots (type + couleur)"],
 "categorie": "ex. veste, pantalon, chaussures, sac",
 "couleur": "couleur principale",
 "matiere": "matière probable ou vide",
 "genre": "homme, femme ou mixte"}`;

export async function identifyItem(imageDataUrl: string): Promise<IdentifiedItem> {
  if (config.mocks.vision) {
    await new Promise((r) => setTimeout(r, 900));
    return {
      nom: "Blazer croisé en laine à carreaux bleu",
      requete: "blazer croisé laine carreaux bleu homme",
      requetesSecours: ["blazer carreaux bleu homme", "blazer bleu"],
      categorie: "veste",
      couleur: "bleu",
      matiere: "laine",
      genre: "homme",
    };
  }

  const res = await fetch(HF_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.HF_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.HF_VISION_MODEL,
      max_tokens: 300,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    throw new Error(`Hugging Face ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content ?? "";
  return parseItem(text);
}

/** Extrait le premier objet JSON de la réponse (les modèles ajoutent parfois ```json …```). */
export function parseItem(text: string): IdentifiedItem {
  const raw = text.match(/\{[\s\S]*\}/)?.[0];
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  // Champs vides → absents, chaînes rognées à la longueur max du schéma.
  const obj = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const clean: Record<string, unknown> = Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => typeof v === "string" && v.trim())
      .map(([k, v]) => [k, (v as string).trim().slice(0, k === "nom" || k === "requete" ? 160 : 60)]),
  );
  if (typeof clean.genre === "string") {
    const g = clean.genre.toLowerCase();
    if (g.startsWith("hom")) clean.genre = "homme";
    else if (g.startsWith("fem")) clean.genre = "femme";
    else if (g.startsWith("mix") || g.startsWith("uni")) clean.genre = "mixte";
    else delete clean.genre;
  }
  const secours = Array.isArray(obj.secours) ? obj.secours : [];
  clean.requetesSecours = secours
    .filter((s): s is string => typeof s === "string" && s.trim() !== "")
    .map((s) => s.trim().slice(0, 100))
    .filter((s) => s.toLowerCase() !== String(clean.requete ?? "").toLowerCase())
    .slice(0, 3);
  const parsed = IdentifiedItemSchema.safeParse(clean);
  if (!parsed.success) {
    throw new HttpError(422, "Pièce non reconnue : essaie une sélection plus serrée", text.slice(0, 200));
  }
  return parsed.data;
}
