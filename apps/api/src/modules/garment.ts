/**
 * Analyse du produit avant l'essayage : le modèle de vision Hugging Face décrit la pièce
 * (zone du corps, description précise en anglais pour le modèle d'image). L'essayage sait alors
 * quelle pièce du mannequin neutre remplacer (pull → t-shirt, jean → pantalon gris, veste → par-dessus)
 * et ne copie que cette pièce, pas le reste de la tenue portée sur la photo marchande.
 */
import { config } from "../config.js";

const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

export type GarmentZone = "haut" | "bas" | "veste" | "robe" | "chaussures";
export type GarmentAnalysis = { zone: GarmentZone; description: string };

const ZONES: GarmentZone[] = ["haut", "bas", "veste", "robe", "chaussures"];

const PROMPT = (
  name: string,
) => `You are a fashion product analyst. The image is a store product photo of "${name}".
It may show a model wearing a full outfit: analyse ONLY the product named above.
Answer ONLY with a JSON object, no other text:
{"zone": one of "haut" (t-shirt, shirt, sweater, hoodie, top), "bas" (trousers, jeans, shorts, skirt), "veste" (jacket, coat, blazer, cardigan worn open), "robe" (dress, jumpsuit), "chaussures" (shoes),
 "description": "precise English description of the product for an image model, 25 to 45 words: garment type, exact colour and shade, material and texture, pattern, neckline/collar, closure (zip, buttons), sleeves, fit, length, notable details"}`;

/** Zone déduite du nom seul (secours si le modèle de vision ne répond pas). */
export function zoneFromName(name: string): GarmentZone {
  if (/chaussure|basket|sneaker|botte|mocassin|sandale|derby/i.test(name)) return "chaussures";
  if (/robe|combinaison/i.test(name)) return "robe";
  if (/veste|blazer|manteau|blouson|parka|doudoune|trench|caban|bomber|surchemise/i.test(name))
    return "veste";
  if (/pantalon|jean|short|chino|jogging|jupe|bermuda|cargo|legging/i.test(name)) return "bas";
  return "haut";
}

export async function analyzeGarment(imageUrl: string, name: string): Promise<GarmentAnalysis> {
  const fallback: GarmentAnalysis = { zone: zoneFromName(name), description: name };
  if (config.mocks.vision || !config.HF_TOKEN) return fallback;
  const started = Date.now();
  try {
    const img = await fetch(imageUrl, {
      headers: { "User-Agent": UA, Accept: "image/webp,image/jpeg,image/png;q=0.9" },
      signal: AbortSignal.timeout(6_000),
    });
    if (!img.ok) return fallback;
    const type = img.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    const dataUrl = `data:${type};base64,${Buffer.from(await img.arrayBuffer()).toString("base64")}`;
    const res = await fetch(HF_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.HF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.HF_VISION_MODEL,
        max_tokens: 200,
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT(name.replace(/"/g, "'").slice(0, 160)) },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return fallback;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = parseAnalysis(json.choices?.[0]?.message?.content ?? "");
    console.info(`[garment] ${Date.now() - started} ms`, parsed ?? "réponse illisible");
    return parsed ?? fallback;
  } catch (err) {
    console.warn(
      "[garment] analyse ignorée :",
      err instanceof Error ? err.message.slice(0, 120) : err,
    );
    return fallback;
  }
}

export function parseAnalysis(text: string): GarmentAnalysis | null {
  try {
    const obj = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "null") as Record<string, unknown>;
    const zone = ZONES.find((z) => z === obj?.zone);
    const description = typeof obj?.description === "string" ? obj.description.trim() : "";
    if (!zone || description.length < 10) return null;
    return { zone, description: description.slice(0, 400) };
  } catch {
    return null;
  }
}

export type ProductRefs = {
  /** Photo du produit seul (packshot) si la fiche en a une, sinon la photo trouvée. */
  garment: string;
  /** Le même produit porté par un mannequin de la boutique (comment il tombe sur un corps). */
  look?: string;
};

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "fr-FR" },
    signal: AbortSignal.timeout(6_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/**
 * Photos de la fiche produit pour l'essayage. Zara : packshot « -p » + photo portée « -a1 / -a2 »
 * du même coloris (JSON `?ajax=true`). Uniqlo : 1re photo secondaire avec mannequin.
 * Échec ou délai → la photo trouvée seule (jamais bloquant).
 */
export async function productRefs(
  productUrl: string | undefined,
  imageUrl: string,
): Promise<ProductRefs> {
  const fallback: ProductRefs = { garment: imageUrl };
  if (!productUrl || config.mocks.brightdata) return fallback;
  try {
    if (/zara\.com/.test(productUrl)) {
      const code = imageUrl.match(/\/(\d{8,11}(?:-\d{3})?)-[a-z]\d*\//)?.[1];
      if (!code) return fallback;
      const json = await fetchPage(`${productUrl}${productUrl.includes("?") ? "&" : "?"}ajax=true`);
      const urls = [...json.matchAll(/"url":"(https:\/\/static\.zara\.net[^"]+)"/g)]
        .map((m) => m[1]!.replace("{width}", "1024"))
        .filter((u) => u.includes(`/${code}-`));
      const packshot = urls.find((u) => u.includes(`/${code}-p/`));
      const looks = urls.filter((u) => new RegExp(`/${code}-a\\d+/`).test(u));
      const imageIsLook = new RegExp(`/${code}-a\\d+/`).test(imageUrl);
      const look = imageIsLook ? imageUrl : looks[0];
      return { garment: packshot ?? imageUrl, ...(look && look !== packshot ? { look } : {}) };
    }
    if (/uniqlo\.com/.test(productUrl)) {
      const item = productUrl.match(/\/products\/E?(\d{6})/)?.[1];
      if (!item) return fallback;
      // Coloris de la photo trouvée (« eugoods_57_486068 ») : la photo portée doit montrer le
      // MÊME coloris, sinon le modèle reprend sa couleur (pull vert rendu crème).
      const color = imageUrl.match(new RegExp(`goods_(\\d{2})_${item}`))?.[1];
      if (!color) return fallback;
      const html = await fetchPage(productUrl);
      const subs = [
        ...html.matchAll(
          /\{"image":"(https:\/\/image\.uniqlo\.com[^"]+\/sub\/[^"]+)","model":\[\{/g,
        ),
      ];
      const sub = subs.find((m) => {
        const rest = html.slice(m.index! + m[0].length, m.index! + m[0].length + 1500);
        const seg = rest.slice(
          0,
          rest.indexOf('{"image":') > 0 ? rest.indexOf('{"image":') : undefined,
        );
        return new RegExp(`"itemId":"${item}","sampleCode":"[^"]*","colorCode":"${color}"`).test(
          seg,
        );
      })?.[1];
      return sub ? { garment: imageUrl, look: sub } : fallback;
    }
  } catch (err) {
    console.warn("[garment] fiche produit ignorée :", err instanceof Error ? err.message : err);
  }
  return fallback;
}
