import { z } from "zod";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
import {
  analyzeGarment,
  productRefs,
  zoneFromName,
  type GarmentAnalysis,
  type ProductRefs,
} from "./garment.js";
import { db } from "./supabase.js";

export const MAX_IMAGE = 8 * 1024 * 1024;
const formats: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function fittingUser(authorization?: string) {
  const token = authorization?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) throw new HttpError(401, "Connecte-toi à BuyFit pour utiliser ton mannequin.");
  if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY)
    throw new HttpError(503, "La connexion Supabase du serveur reste à configurer.");
  const { data, error } = await db().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Reconnecte-toi à BuyFit.");
  return data.user.id;
}

export function checkPhoto(value: unknown): File {
  if (!(value instanceof File) || !Object.hasOwn(formats, value.type) || !value.size)
    throw new HttpError(400, "Choisis une photo JPEG, PNG ou WebP.");
  if (value.size > MAX_IMAGE) throw new HttpError(413, "La photo dépasse 8 Mo.");
  return value;
}

export async function modelImage(
  path: "/avatar" | "/tryon/account",
  form: FormData,
): Promise<Blob> {
  if (!config.TRYON_SERVICE_URL)
    throw new HttpError(503, "Configure TRYON_SERVICE_URL sur le serveur BuyFit.");
  const res = await fetch(new URL(path, config.TRYON_SERVICE_URL), {
    method: "POST",
    headers: { "X-BuyFit-Request": "internal" },
    body: form,
    redirect: "error",
    signal: AbortSignal.timeout(195_000),
  }).catch(() => {
    throw new HttpError(503, "Le service photo BuyFit est indisponible. Réessaie dans un instant.");
  });
  if (!res.ok) {
    const message = z
      .object({ error: z.string().max(400) })
      .safeParse(await res.json().catch(() => null));
    throw new HttpError(
      res.status === 400 ? 400 : res.status === 503 ? 503 : 502,
      message.success ? message.data.error : "La génération a échoué. Réessaie avec ta photo.",
    );
  }
  const image = await res.blob();
  if (!Object.hasOwn(formats, image.type) || !image.size || image.size > MAX_IMAGE)
    throw new HttpError(502, "Le modèle a renvoyé une image invalide.");
  return image;
}

export async function accountTryOn(
  userId: string,
  garment: File | string,
  garmentName?: string,
  productUrl?: string,
) {
  const { data: avatar, error } = await db()
    .from("user_photos")
    .select("id,storage_path")
    .eq("user_id", userId)
    .eq("type", "pied")
    .like("storage_path", `${userId}/mannequin/%`)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new HttpError(502, "Impossible de lire ton profil.");
  if (!avatar) throw new HttpError(409, "Crée ton mannequin dans les réglages Photos de BuyFit.");
  // Analyse du produit en parallèle du téléchargement du mannequin (~3 s, jamais bloquante).
  // Photos de la fiche (packshot + photo portée), puis analyse IA sur la photo la plus nette.
  const refs: Promise<ProductRefs | null> =
    typeof garment === "string" ? productRefs(productUrl, garment) : Promise.resolve(null);
  const analysis: Promise<GarmentAnalysis> =
    typeof garment === "string"
      ? refs.then((r) => analyzeGarment(r?.garment ?? garment, garmentName ?? ""))
      : Promise.resolve({ zone: zoneFromName(garmentName ?? ""), description: garmentName ?? "" });
  const photo = await db().storage.from("user-photos").download(avatar.storage_path);
  if (photo.error || !photo.data) throw new HttpError(502, "Impossible de charger ton mannequin.");
  const form = new FormData();
  form.set("person", photo.data, "mannequin");
  const ref = await refs;
  if (typeof garment === "string") form.set("garment_url", ref?.garment ?? garment);
  else form.set("garment", garment, "garment");
  if (ref?.look) form.set("look_url", ref.look);
  // Nom du produit (« Zara - Pantalon chino - Beige clair ») : guide le modèle sur couleur et coupe.
  if (garmentName) form.set("garment_name", garmentName.slice(0, 300));
  const { zone, description } = await analysis;
  form.set("garment_zone", zone);
  if (description) form.set("garment_description", description.slice(0, 400));
  const start = Date.now();
  const image = await modelImage("/tryon/account", form);
  const latencyMs = Date.now() - start;
  const path = `${userId}/${crypto.randomUUID()}.${formats[image.type]}`;
  const bucket = db().storage.from("tryon-results");
  const { error: uploadError } = await bucket.upload(path, image, { contentType: image.type });
  if (uploadError) throw new HttpError(502, "Impossible de sauvegarder l’essayage.");
  const signed = await bucket.createSignedUrl(path, 3600);
  if (!signed.data || signed.error) {
    await bucket.remove([path]);
    throw new HttpError(502, "Impossible d’ouvrir le résultat.");
  }
  const saved = await db()
    .from("tryons")
    .insert({
      user_id: userId,
      result_storage_path: path,
      latency_ms: latencyMs,
      garment_image_url: typeof garment === "string" ? garment : `urn:uuid:${crypto.randomUUID()}`,
    });
  if (saved.error) {
    await bucket.remove([path]);
    throw new HttpError(502, "Impossible d’enregistrer cet essayage.");
  }
  return { resultImageUrl: signed.data.signedUrl, latencyMs, zone };
}
