/**
 * Upload et suppression des photos, côté NAVIGATEUR (composants "use client").
 *
 * Pourquoi pas une server action ? Les server actions de Next.js limitent le corps à 1 Mo
 * par défaut, trop peu pour une photo. Le navigateur envoie donc directement au bucket privé
 * `user-photos`, dans le dossier `<user_id>/` : la policy Storage refuse tout autre dossier.
 */
import { createClient } from "./client";
import {
  PHOTO_MAX_BYTES,
  PHOTO_MIME_TYPES,
  PhotoTypeSchema,
  UserPhotoSchema,
  type ActionResult,
  type PhotoType,
  type UserPhoto,
} from "./schemas";
import { BUCKETS, signPaths } from "./storage";

const EXTENSIONS: Record<(typeof PHOTO_MIME_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

const isAllowedMime = (t: string): t is (typeof PHOTO_MIME_TYPES)[number] =>
  (PHOTO_MIME_TYPES as readonly string[]).includes(t);

/**
 * `dossier` : true → `<user>/mannequin/` (mannequin validé), "sources" → `<user>/sources/`
 * (photos d'origine du visage et du corps, gardées pour régénérer le mannequin quand le moteur
 * change), false → `<user>/`.
 */
export async function uploadUserPhoto(
  file: File,
  type: PhotoType = "pied",
  dossier: boolean | "sources" = false,
): Promise<ActionResult<UserPhoto>> {
  if (!PhotoTypeSchema.safeParse(type).success)
    return { ok: false, error: "Type de photo invalide." };
  if (!isAllowedMime(file.type)) {
    return { ok: false, error: "Format non pris en charge (JPEG, PNG, WebP ou HEIC)." };
  }
  if (file.size > PHOTO_MAX_BYTES)
    return { ok: false, error: "Photo trop lourde (10 Mo maximum)." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Connecte-toi d'abord." };

  const sub = dossier === "sources" ? "sources/" : dossier ? "mannequin/" : "";
  const path = `${user.id}/${sub}${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKETS.userPhotos)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { ok: false, error: "Envoi de la photo impossible." };

  const { data: row, error: insertError } = await supabase
    .from("user_photos")
    .insert({ user_id: user.id, storage_path: path, type })
    .select("id, type, storage_path, created_at")
    .single();
  if (insertError) {
    await supabase.storage.from(BUCKETS.userPhotos).remove([path]); // pas de fichier orphelin
    return { ok: false, error: "Enregistrement de la photo impossible." };
  }

  const urls = await signPaths(supabase, BUCKETS.userPhotos, [path]);
  return {
    ok: true,
    data: UserPhotoSchema.parse({
      id: row.id,
      type: row.type,
      storagePath: row.storage_path,
      url: urls.get(path) ?? null,
      createdAt: row.created_at,
    }),
  };
}

export async function deleteUserPhoto(photoId: string): Promise<ActionResult<null>> {
  const supabase = createClient();
  const { data: photo, error } = await supabase
    .from("user_photos")
    .select("id, storage_path")
    .eq("id", photoId)
    .maybeSingle(); // RLS : uniquement ses propres photos
  if (error || !photo) return { ok: false, error: "Photo introuvable." };

  const { error: deleteError } = await supabase.from("user_photos").delete().eq("id", photo.id);
  if (deleteError) return { ok: false, error: "Suppression impossible." };
  await supabase.storage.from(BUCKETS.userPhotos).remove([photo.storage_path]);
  return { ok: true, data: null };
}
